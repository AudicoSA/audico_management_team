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
        
        # 1. Process New Orders (Trigger: Assigned to Supplier but not in Workflow)
        await self.process_new_orders()
        
        # 2. Check for Replies (IMAP Scan)
        await self.check_for_replies()

        # 3. Nudge Check (Wait > 4h)
        await self.process_nudges()

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

            # Strategy 2: Subject Regex (Fallback)
            if not matched_wf:
                import re
                match = re.search(r"Order #?(\d+)", subject, re.IGNORECASE)
                if match:
                    order_no = match.group(1)
                    await self.log_action(order_no, f"Received email with matching Subject from {sender}: {subject}")

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
        
        supplier_thread_id = wf.get("supplier_thread_id")
        
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
        msg_id = email_client.send_email(to_email, subject, body, cc=["support@audicoonline.co.za"])
        
        if msg_id:
            await self.log_action(order_no, "Sent Nudge (Follow-up)")
            self.sb.client.table("kait_workflows").update({
                "nudge_count": wf.get("nudge_count", 0) + 1,
                "last_action_at": datetime.now().isoformat()
            }).eq("id", wf["id"]).execute()

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
        # Send Email with CC
        msg_id = email_client.send_email(
            to_email=customer_email, 
            subject=subject, 
            body_text=body, 
            cc=["support@audicoonline.co.za"]
        )
        
        if msg_id:
            await self.log_action(order_no, f"Emailed Customer ({customer_email}) acknowledgement (CC: Support).")
            # Update state
            self.sb.client.table("kait_workflows").update({
                "status": "customer_emailed",
                "customer_thread_id": msg_id
            }).eq("order_no", order_no).execute()
        else:
            await self.log_action(order_no, "Failed to send customer email.")

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
            "Trust you are well today.",
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
        # Send Supplier Email
        # CC: lucky, kenny, support
        cc_list = ["support@audicoonline.co.za", "lucky@audico.co.za", "kenny@audico.co.za"]
        
        sup_msg_id = email_client.send_email(
            to_email=supplier_email, 
            subject=sup_subject, 
            body_text=sup_body, 
            cc=cc_list
        )
        
        if sup_msg_id:
             await self.log_action(order_no, f"Emailed Supplier ({supplier_name}). CC: {cc_list}")
             self.sb.client.table("kait_workflows").update({
                 "status": "supplier_contacted",
                 "supplier_thread_id": sup_msg_id
             }).eq("order_no", order_no).execute()
        else:
             await self.log_action(order_no, f"Failed to email supplier {supplier_name}.")

if __name__ == "__main__":
    import asyncio
    agent = KaitAgent()
    asyncio.run(agent.run_cycle())
