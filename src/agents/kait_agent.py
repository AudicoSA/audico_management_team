import logging
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from src.connectors.supabase import get_supabase_connector

logger = logging.getLogger("KaitAgent")

class KaitAgent:
    """
    Kait: The AI Administrator Agent.
    
    Architecture: State Machine
    Responsibility: Managing the lifecycle of orders from 'Assigned to Supplier' to 'Ready for Shipment'.
    """
    
    def __init__(self):
        self.sb = get_supabase_connector()
        self.agent_name = "Kait Bayes"
        self.email_address = "kait@audicoonline.co.za"

    async def get_workflow_state(self, order_no: str) -> Optional[Dict[str, Any]]:
        """Fetch the current Kait state for an order."""
        try:
            response = self.sb.client.table("kait_workflows").select("*").eq("order_no", order_no).execute()
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Failed to get workflow state for {order_no}: {e}")
            return None

    async def initialize_workflow(self, order_no: str) -> Dict[str, Any]:
        """Start tracking an order with Kait."""
        existing = await self.get_workflow_state(order_no)
        if existing:
            return existing
            
        payload = {
            "order_no": order_no,
            "status": "new",
            "logs": [f"Workflow initialized at {datetime.now()}"]
        }
        
        response = self.sb.client.table("kait_workflows").insert(payload).execute()
        return response.data[0]

    async def log_action(self, order_no: str, action: str):
        """Append to the audit log for this order."""
        # This requires fetching, appending, and updating. 
        # A stored proc would be better, but doing client-side for now.
        state = await self.get_workflow_state(order_no)
        if not state: return
        
        current_logs = state.get("logs", []) or []
        current_logs.append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] {action}")
        
        self.sb.client.table("kait_workflows").update({
            "logs": current_logs,
            "last_action_at": datetime.now().isoformat()
        }).eq("order_no", order_no).execute()

    async def run_cycle(self):
        """
        Main Heartbeat: Runs every few minutes to check for 'Timed Out' states 
        or move workflows forward.
        """
        print(f"[{datetime.now()}] Kait Heartbeat: Checking for actions...")
        
        # 0. Process Outbox (Send Approved Drafts)
        await self.process_outbox()

        # 0.5 Process Feedback (Reject & Teach)
        await self.process_feedback_queue()

        # 1. Process New Orders (Trigger: Assigned to Supplier but not in Workflow)
        await self.process_new_orders()
        
        # 2. Check for Replies (IMAP Scan)
        await self.check_for_replies()

        # 3. Nudge Check (Wait > 4h)
        await self.process_nudges()

    async def process_feedback_queue(self):
        """
        Check for drafts with status='changes_requested' and process user feedback.
        REINFORCEMENT LEARNING STEP.
        """
        # Fetch rejected drafts
        response = self.sb.client.table("kait_email_drafts").select("*").eq("status", "changes_requested").execute()
        
        for draft in response.data:
            feedback = draft.get("feedback")
            order_no = draft["order_no"]
            print(f"Processing Feedback for Order {order_no}: {feedback}")
            
            # Simple Rule Engine (LLM Lite)
            # 1. Check if feedback is a "Correction" (Supplier update)
            if "supplier" in feedback.lower() or "recipient" in feedback.lower() or " wrong " in feedback.lower():
                # Heuristic: User is correcting the supplier.
                # Try to extract the correction using OpenAI (if available) or basic parsing
                # For Phase 5 MVP, let's use a basic string search or assume specific intent.
                pass 
                
            # For now, let's just use GPT-4o-mini to interpret the correction and redraft
            # We will use the 'run_categorization' logic but simplified for text generation.
            
            await self.action_apply_feedback(draft, feedback)

    async def action_apply_feedback(self, draft: Dict[str, Any], feedback: str):
        """
        Apply feedback to a draft using LLM.
        """
        from openai import OpenAI
        from src.utils.config import get_config
        
        config = get_config()
        client = OpenAI(api_key=config.openai_api_key)
        
        prompt = f"""
You are Kait, an AI Assistant. You drafted an email, but the human user rejected it with feedback.
Your goal:
1. Understand the feedback.
2. If it's a permanent rule (e.g. "Sonos is always Planetworld"), extract a Memory.
3. Rewrite the email draft based on the feedback.

Original Draft:
To: {draft['to_email']}
Subject: {draft['subject']}
Body:
{draft['body_text']}

User Feedback: "{feedback}"

Output JSON:
{{
  "new_to_email": "updated email if changed, else original",
  "new_body": "rewritten body text",
  "memory_key": "optional key e.g. 'brand:sonos' if a rule was learned",
  "memory_value": "optional value e.g. 'Planetworld' if a rule was learned",
  "explanation": "brief explanation of what you changed"
}}
"""
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            
            # 1. Store Memory (if learned)
            if result.get("memory_key") and result.get("memory_value"):
                self.sb.client.table("kait_memories").insert({
                    "category": "learning",
                    "key_pattern": result["memory_key"],
                    "value": result["memory_value"],
                    "confidence": 1.0 # Taught by human
                }).execute()
                await self.log_action(draft['order_no'], f"Learned Rule: {result['memory_key']} -> {result['memory_value']}")

            # 2. Update Draft
            updates = {
                "status": "draft", # Ready for review again
                "to_email": result.get("new_to_email", draft["to_email"]),
                "body_text": result.get("new_body", draft["body_text"]),
                "feedback": None, # Clear feedback
                "retry_count": draft.get("retry_count", 0) + 1
            }
            
            # If email changed, we might need to lookup address again? 
            # The LLM might give us "Planetworld", but we need "orders@planetworld...".
            # For this MVP, let's assume the LLM might struggle with exact emails unless we provide a lookup tool.
            # IMPROVEMENT: If LLM suggests a Supplier Name change, we should do a DB lookup here.
            
            # Let's check if 'new_to_email' looks like an email or a name
            if "@" not in updates["to_email"]:
                # Try to find a supplier address
                sup_info = await self.sb.get_supplier_address(updates["to_email"])
                if sup_info and sup_info.get("contact_email"):
                    updates["to_email"] = sup_info["contact_email"]
            
            self.sb.client.table("kait_email_drafts").update(updates).eq("id", draft["id"]).execute()
            await self.log_action(draft['order_no'], f"Redrafted email based on feedback: {result['explanation']}")

        except Exception as e:
            logger.error(f"LLM Error on Feedback: {e}")
            await self.log_action(draft['order_no'], f"Failed to apply feedback: {e}")

        """
        Check for emails in 'kait_email_drafts' with status='approved' and send them.
        """
        from src.connectors.email_client import get_email_client
        email_client = get_email_client()

        # Fetch approved drafts
        response = self.sb.client.table("kait_email_drafts").select("*").eq("status", "approved").execute()
        
        for draft in response.data:
            print(f"Sending Approved Email: {draft['id']} to {draft['to_email']}")
            
            msg_id = email_client.send_email(
                to_email=draft['to_email'],
                subject=draft['subject'],
                body_text=draft['body_text'],
                # body_html=draft.get('body_html'), # TODO: Add HTML support if needed
                cc=draft.get('cc_emails', [])
            )
            
            if msg_id:
                # Mark as Sent
                self.sb.client.table("kait_email_drafts").update({
                    "status": "sent",
                    "sent_at": datetime.now().isoformat(),
                    "message_id": msg_id
                }).eq("id", draft['id']).execute()
                
                # Update Workflow State (if needed)
                # We need to link this back to the workflow via order_no if we want to update status
                # But for now, the status might have already been updated when drafted, OR we should update it now?
                # Actually, in draft mode, we probably update status to 'customer_emailed' ONLY after sending.
                # But current logic updates it immediately. Let's keep it simple: Status updates happens at DRAFT time (optimistic),
                # If it's draft, it's "in progress".
                
                # Wait, if we need the Message-ID for threading (e.g. supplier_thread_id), we need to update kait_workflows NOW.
                # So we should find the workflow and update the thread_id.
                
                # Check for active workflow
                wf_res = self.sb.client.table("kait_workflows").select("*").eq("order_no", draft['order_no']).execute()
                if wf_res.data:
                    wf = wf_res.data[0]
                    updates = {}
                    # Heuristic to detect which thread ID to update based on recipient?
                    # Or maybe we store 'context' in drafts table?
                    # For now, let's just log it.
                    await self.log_action(draft['order_no'], f"Approved Email Sent to {draft['to_email']}. ID: {msg_id}")

    async def check_for_replies(self):
        """
        Scan inbox for replies to our threads.
        """
        from src.connectors.email_client import get_email_client
        email_client = get_email_client()
        
        # 1. Fetch unread emails
        messages = email_client.fetch_unread_messages(limit=20)
        
        for msg in messages:
            subject = msg.get("subject", "")
            sender = msg.get("from", "")
            in_reply_to = msg.get("in_reply_to")
            references = msg.get("references")
            
            # Strategy 1: Thread ID Match
            # We check if 'in_reply_to' matches any known thread_id in our DB
            matched_wf = None
            if in_reply_to:
                # Check supplier threads
                dataset = self.sb.client.table("kait_workflows").select("*").eq("supplier_thread_id", in_reply_to).execute()
                if dataset.data:
                    matched_wf = dataset.data[0]
                    await self.log_action(matched_wf["order_no"], f"Received Supplier Reply from {sender}")
                    self.sb.client.table("kait_workflows").update({"status": "supplier_replied"}).eq("id", matched_wf["id"]).execute()
                
                # Check customer threads
                if not matched_wf:
                    dataset = self.sb.client.table("kait_workflows").select("*").eq("customer_thread_id", in_reply_to).execute()
                    if dataset.data:
                        matched_wf = dataset.data[0]
                        await self.log_action(matched_wf["order_no"], f"Received Customer Reply from {sender}")
            
            # Check for Invoice / Attachments
            attachments = msg.get("attachments", [])
            
            # --- NEW: Process Specials via Email ---
            # Command: Email subject contains "Specials", "Promo", "Deals" OR "Load Specials"
            # And has attachment.
            clean_subject = subject.lower()
            if "specials" in clean_subject or "promo" in clean_subject or "deals" in clean_subject:
                if attachments:
                    await self.process_email_specials(msg, attachments, sender)
                    continue 
            # ---------------------------------------

            if matched_wf and attachments:
                # We have a matching workflow and attachments
                await self.process_invoice(matched_wf, attachments, sender)
                continue # Skip further processing if handled as invoice

            # Check for Body Keywords (NLU Lite)
            if matched_wf and not attachments:
                body_lower = msg.get("body", "").lower()
                stock_keywords = ["no stock", "out of stock", "discontinued", "backorder", "lead time", "eta"]
                
                if any(kw in body_lower for kw in stock_keywords):
                     await self.process_stock_status(matched_wf, body_lower, sender)

    async def process_email_specials(self, msg: Dict[str, Any], attachments: List[Dict[str, Any]], sender: str):
        """
        Handle incoming specials flyer via email.
        """
        from src.agents.specials_agent import get_specials_agent
        agent = get_specials_agent()
        
        # Heuristic: Sender name/email is likely the supplier
        # In prod, we'd map sender email -> supplier in DB.
        # For now, pass the sender string.
        
        # Also check body for instructions?
        print(f"Detected Specials Email from {sender}. Processing attachments...")
        
        for att in attachments:
            path = att["path"]
            filename = att["filename"]
            
            # Only process images for now (since we used Vision).
            # If PDF, we need to convert?
            # SpecialsAgent 'ingest_flyer' handles basic file ingestion.
            # Ideally we'd support PDF -> Image conversion there. 
            # If the user sends a PDF, the CLI/Agent might complain.
            # But let's try.
            
            result = await agent.ingest_flyer(path, supplier_name=sender)
            
            if result.get("status") == "success":
                await self.log_system_event(f"Ingested Specials from {sender}: {filename} ({result.get('deals_count')} deals)")
            else:
                await self.log_system_event(f"Failed to ingest specials from {sender}: {filename} - {result.get('message')}")

    async def log_system_event(self, message: str):
        """Log a general system event (not tied to specific order)."""
        # We don't have a general log table yet, so just print/logger
        logger.info(message)
        print(f"[SYSTEM] {message}")

    async def process_stock_status(self, wf: Dict[str, Any], body: str, sender: str):
        """
        Step 4 & 5: Analyze supplier reply for No Stock / ETA.
        """
        order_no = wf["order_no"]
        import re
        
        # 1. Check for "No Stock" indicators
        no_stock = any(kw in body for kw in ["no stock", "out of stock", "discontinued", "cannot supply", "0 stock"])
        
        if no_stock:
            await self.log_action(order_no, f"Detected 'No Stock' from {sender}")
            
            # 2. Check for ETA
            # Matches: "ETA 2026-05-01", "Expect stock 5th May", "2-3 weeks"
            eta_indicators = ["eta", "expect", "arrive", "weeks", "days"]
            has_eta = any(kw in body for kw in eta_indicators) or re.search(r"\d{4}-\d{2}-\d{2}", body)
            
            if has_eta:
                # Step 5: No Stock + ETA -> Notify Client
                await self.log_action(order_no, "Detected ETA. Triggering Client Options.")
                await self.action_notify_client_option(order_no, body)
            else:
                # Step 4: No Stock + No ETA -> Request ETA
                await self.log_action(order_no, "No ETA detected. Requesting ETA from Supplier.")
                await self.action_request_eta(order_no, wf)

    async def action_request_eta(self, order_no: str, wf: Dict[str, Any]):
        """Step 4: Ask Supplier for ETA."""
        from src.connectors.email_client import get_email_client
        email_client = get_email_client()
        
        supplier_thread_id = wf.get("supplier_thread_id")
        
        # Need Supplier Email - Re-fetch or cache? 
        # Need Supplier Email
        order_info = self.sb.client.table("orders_tracker").select("supplier").eq("order_no", order_no).execute()
        if not order_info.data: return
        supplier_name = order_info.data[0]["supplier"]
        supplier_info = await self.sb.get_supplier_address(supplier_name)
        if not supplier_info: return
        to_email = supplier_info["contact_email"]

        subject = f"Re: Order {order_no} - ETA Request"
        body = f"""Hi there,

Thanks for the update.

Could you please provide an estimated time of arrival (ETA) for when this stock will be available?
We need to advise our client whether to wait or cancel.

Kind regards,
Kait
"""
        email_client.save_draft(
            order_no=order_no,
            to_email=to_email,
            subject=subject,
            body_text=body,
            cc=["support@audicoonline.co.za"],
            metadata={
                "action": "request_eta",
                "target_field": "supplier_thread_id",
                "next_status": "waiting_eta"
            }
        )
        await self.log_action(order_no, "Drafted ETA Request to Supplier.")

    async def action_notify_client_option(self, order_no: str, supplier_msg: str):
        """Step 5: Notify Customer of Backorder/Refund options."""
        from src.connectors.email_client import get_email_client
        from src.connectors.opencart import get_opencart_connector
        
        email_client = get_email_client()
        oc = get_opencart_connector()

        # Fetch Customer
        try:
            full_order = await oc.get_order(order_no)
        except: full_order = None
        
        if not full_order: return

        customer_email = full_order.get("email")
        customer_name = f"{full_order.get('firstname', '')} {full_order.get('lastname', '')}".strip()
        
        clean_msg = supplier_msg[:500] + "..." # Truncate for sanity if including
        
        subject = f"Order #{order_no} Update - Stock Delay"
        body = f"""Hi {customer_name},

We have received an update regarding your order #{order_no}.

Unfortunately, the supplier has informed us that they are currently out of stock.
They have indicated the following ETA/Availability:
"{clean_msg}"

**Please let us know how you would like to proceed:**
1. Place this order on **Backorder** (Wait for stock).
2. **Refund** the order.
3. Replace with an alternative product.

Apologies for the inconvenience!

Best regards,
Kait Bayes
Customer Service Representative
Audico Online Team
"""
        email_client.save_draft(
            order_no=order_no,
            to_email=customer_email,
            subject=subject,
            body_text=body,
            cc=["support@audicoonline.co.za"],
            metadata={
                "action": "client_options",
                "target_field": "customer_thread_id",
                "next_status": "client_options_sent"
            }
        )
        await self.log_action(order_no, "Drafted Options Email to Customer.")
            

    async def process_invoice(self, wf: Dict[str, Any], attachments: List[Dict[str, Any]], sender: str):
        """
        Attempt to parse invoice from attachments.
        """
        import PyPDF2
        order_no = wf["order_no"]
        
        for att in attachments:
            path = att["path"]
            filename = att["filename"]
            
            if not filename.lower().endswith(".pdf"):
                continue
                
            try:
                text = ""
                with open(path, "rb") as f:
                    reader = PyPDF2.PdfReader(f)
                    for page in reader.pages:
                        text += page.extract_text() + "\n"
                
                # Basic Heuristics
                if "invoice" in text.lower() or "tax invoice" in text.lower():
                    # It's an invoice
                    await self.log_action(order_no, f"Received Invoice: {filename}")
                    
                    # Try to extract Total
                    import re
                    # Regex for "Total" followed by R (currency) + digits
                    # e.g. "Total R 1,200.00" or "Total Due: R1200.00"
                    total_match = re.search(r"Total.*?(R\s?[\d,]+\.\d{2})", text, re.IGNORECASE)
                    
                    extracted_total = total_match.group(1) if total_match else "Unknown"
                    
                    await self.log_action(order_no, f"Extracted Total: {extracted_total}")
                    
                    # Update status to 'invoiced'
                    self.sb.client.table("kait_workflows").update({
                        "status": "invoiced",
                        "metadata": wf.get("metadata", {}) | {"invoice_file": filename, "invoice_total": extracted_total}
                    }).eq("id", wf["id"]).execute()
                    
                    # Step 3: Trigger Customer Update
                    await self.action_stock_confirmed(order_no)

            except Exception as e:
                logger.error(f"Failed to parse PDF {path}: {e}")
                await self.log_action(order_no, f"Failed to parse PDF {filename}")

    async def action_stock_confirmed(self, order_no: str):
        """
        Step 3: Notify customer that stock is confirmed and processing.
        """
        from src.connectors.opencart import get_opencart_connector
        from src.connectors.email_client import get_email_client
        
        email_client = get_email_client()
        oc = get_opencart_connector()

        # Re-fetch customer details (or could store in metadata to save API call)
        try:
            full_order = await oc.get_order(order_no)
        except:
            full_order = None

        if not full_order:
             await self.log_action(order_no, "Could not fetch OC details for Stock Confirmation email.")
             return

        customer_email = full_order.get("email")
        customer_name = f"{full_order.get('firstname', '')} {full_order.get('lastname', '')}".strip()

        subject = f"Order #{order_no} Confirmed - Preparing for Shipment"
        body = f"""Hi {customer_name},

Good news! We have confirmed stock for your order #{order_no} and it is now being processed.

Our logistics team will be booking the shipment shortly. You will receive your tracking details in a separate email as soon as the courier collects your parcel.

Thank you for your patience!

Best regards,
Kait Bayes
Customer Service Representative
Audico Online Team
"""
        # Send
        email_client.save_draft(
            order_no=order_no,
            to_email=customer_email, 
            subject=subject, 
            body_text=body, 
            cc=["support@audicoonline.co.za"],
            metadata={
                "action": "stock_confirmed",
                "next_status": "processing_shipment" # or keep 'invoiced'?
            }
        )

        await self.log_action(order_no, "Drafted 'Stock Confirmed' email to Customer.")

    async def process_nudges(self):
        """
        Check for workflows stuck in 'supplier_contacted' for > 4 hours.
        """
        # Get stale workflows
        time_limit = datetime.now() - timedelta(hours=4)
        
        response = self.sb.client.table("kait_workflows") \
            .select("*") \
            .eq("status", "supplier_contacted") \
            .lt("last_action_at", time_limit.isoformat()) \
            .execute()

        for wf in response.data:
            order_no = wf["order_no"]
            nudge_count = wf.get("nudge_count", 0)
            
            if nudge_count >= 1:
                # Don't nudge more than once for now
                continue
                
            print(f"[{order_no}] Order waiting for reply > 4h. Sending nudge...")
            await self.action_send_nudge(order_no, wf)

    async def action_send_nudge(self, order_no: str, wf: Dict[str, Any]):
        """Send a polite follow-up email."""
        from src.connectors.email_client import get_email_client
        email_client = get_email_client()
        
        # Need to re-fetch supplier email (it's not in wf, maybe I should store it?)
        # For now, fetch from tracker -> supplier -> address
        order_info = self.sb.client.table("orders_tracker").select("supplier").eq("order_no", order_no).execute()
        if not order_info.data: return
        
        supplier_name = order_info.data[0]["supplier"]
        supplier_info = await self.sb.get_supplier_address(supplier_name)
        if not supplier_info: return
        
        to_email = supplier_info["contact_email"]
        
        subject = f"Follow up: Order {order_no}"
        body = f"""Hi there,
        
I'm just following up on the order below ({order_no}).
Could you please confirm receipt and stock availability?

Kind regards,
Kait
"""
        # Send
        # If we had threading support in send_email (In-Reply-To), we'd use supplier_thread_id here
        email_client.save_draft(
            order_no=order_no,
            to_email=to_email,
            subject=subject,
            body_text=body,
            cc=["support@audicoonline.co.za"],
            metadata={
                "action": "nudge",
                "increment_nudge": True
            }
        )
        
        await self.log_action(order_no, "Drafted Nudge Email.")

    async def process_new_orders(self):
        """
        Identify orders that are in 'orders_tracker' with a Supplier assigned
        but haven't been 'processed' by Kait yet.
        """
        # Fetch orders from tracker that have a supplier assigned -> status 'Pending' usually
        # We look for orders where we don't have a kait_workflow record yet.
        
        # 1. Get recent orders with supplier
        recent_orders_response = self.sb.client.table("orders_tracker") \
            .select("order_no, supplier, order_name") \
            .neq("supplier", None) \
            .order("order_no", desc=True) \
            .limit(10) \
            .execute()
            
        if not recent_orders_response.data:
            return

        for order in recent_orders_response.data:
            order_no = order["order_no"]
            
            # Check if workflow exists
            state = await self.get_workflow_state(order_no)
            if state:
                # Already active, skip (unless we add logic to resume)
                continue
                
            print(f"[{order_no}] Found new order assigned to {order['supplier']}. Initializing workflow...")
            
            # Start Workflow
            await self.initialize_workflow(order_no)
            await self.action_new_order(order_no, order.get("supplier"))
            
    async def action_new_order(self, order_no: str, supplier_name: str):
        """
        Handle the specific actions for a brand new assigned order.
        1. Fetch Customer Details from OpenCart.
        2. Email Customer (Acknowledgement).
        3. Email Supplier (Order Placement).
        """
        from src.connectors.opencart import get_opencart_connector
        from src.connectors.email_client import get_email_client
        
        oc = get_opencart_connector()
        email_client = get_email_client()
        
        # 1. Fetch Order Details (Customer Name, Email, Products)
        try:
            full_order = await oc.get_order(order_no)
        except Exception as e:
            logger.error(f"Failed to fetch OC order {order_no}: {e}")
            await self.log_action(order_no, f"Error fetching OpenCart details: {e}")
            return
            
        if not full_order:
            await self.log_action(order_no, "Order not found in OpenCart.")
            return

        customer_email = full_order.get("email")
        customer_name = f"{full_order.get('firstname', '')} {full_order.get('lastname', '')}".strip()
        
        if not customer_email:
            await self.log_action(order_no, "No customer email found.")
            return

        # Build Product List
        products_text = ""
        for product in full_order.get("products", []):
            qty = product.get("quantity", 0)
            name = product.get("name", "Unknown Item")
            opts = ""
            if product.get("option"):
                opts = " - " + ", ".join([f"{o['name']}: {o['value']}" for o in product['option']])
            products_text += f"{qty}x {name}{opts}\n"

        # 2. Email Customer (Acknowledgement)
        # PRIVACY FIX: Never mention supplier name to customer
        # CC support@audicoonline.co.za
        subject = f"Order #{order_no} Update - Audico Online"
        body = f"""Hi {customer_name},

Thanks for your order #{order_no}!

We have received your order for:
{products_text}

We've assigned your order to our logistics partner for fulfillment.
You will receive another notification with your Waybill/Tracking number as soon as it's collected.

Best regards,
Kait Bayes
Customer Service Representative
Audico Online Team
"""
        # Save Draft
        email_client.save_draft(
            order_no=order_no,
            to_email=customer_email,
            subject=subject,
            body_text=body,
            cc=["support@audicoonline.co.za"],
            metadata={
                "action": "new_order_customer", 
                "target_field": "customer_thread_id", 
                "next_status": "customer_emailed"
            }
        )
        await self.log_action(order_no, "Drafted Customer Acknowledgement.")

        # 3. Email Supplier
        # Fetch Supplier Email Address
        supplier_info = await self.sb.get_supplier_address(supplier_name)
        supplier_email = supplier_info.get("contact_email") if supplier_info else None
        supplier_contact_name = supplier_info.get("contact_name", "Partner") if supplier_info else "Partner"

        if not supplier_email:
             # Fallback: Check if it's Planetworld or known ones hardcoded if DB lookup fails?
             # For now, log error
             await self.log_action(order_no, f"Could not find email for supplier: {supplier_name}")
             return

        # Generate Dynamic Greeting
        import random
        greetings = [
            "Hope you are keeping well!",
            "Hope you're having a great week!",
            "Trust you are well today!",
            "Hope business is treating you well!",
            "Happy to be sending another order your way!"
        ]
        greeting = random.choice(greetings)

        # Compose Supplier Email
        sup_subject = f"{order_no}"
        sup_body = f"""Hi {supplier_contact_name}

{greeting}

Please could you invoice:
{products_text}
REF: {order_no}

Should this not be in stock could you kindly indicate an ETA.

Warm regards

Kait Bayes
Customer Service Representative
"""
        # Save Draft
        email_client.save_draft(
            order_no=order_no,
            to_email=supplier_email, 
            subject=sup_subject, 
            body_text=sup_body, 
            cc=["support@audicoonline.co.za", "lucky@audico.co.za", "kenny@audico.co.za"],
            metadata={
                "action": "new_order_supplier", 
                "target_field": "supplier_thread_id", 
                "next_status": "supplier_contacted"
            }
        )
        await self.log_action(order_no, f"Drafted Supplier Order ({supplier_name}).")

if __name__ == "__main__":
    import asyncio
    agent = KaitAgent()
    asyncio.run(agent.run_cycle())
