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
        
        # 2. Nudge Check (Wait > 4h)
        # (Implementation Todo)
        pass

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

        # 2. Email Customer (Acknowledgement)
        # PRIVACY FIX: Never mention supplier name to customer
        # CC support@audicoonline.co.za
        subject = f"Order #{order_no} Update - Audico Online"
        body = f"""Hi {customer_name},

Thanks for your order #{order_no}!

We've assigned your order to our logistics partner for fulfillment.
You will receive another notification with your Waybill/Tracking number as soon as it's collected.

Best regards,
Kait Bayes
Customer Service Representative
Audico Online Team
"""
        # Send Email with CC
        success = email_client.send_email(
            to_email=customer_email, 
            subject=subject, 
            body_text=body, 
            cc=["support@audicoonline.co.za"]
        )
        
        if success:
            await self.log_action(order_no, f"Emailed Customer ({customer_email}) acknowledgement (CC: Support).")
            # Update state
            self.sb.client.table("kait_workflows").update({"status": "customer_emailed"}).eq("order_no", order_no).execute()
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

        # Build Product List
        products_text = ""
        for product in full_order.get("products", []):
            qty = product.get("quantity", 0)
            name = product.get("name", "Unknown Item")
            opts = ""
            if product.get("option"):
                opts = " - " + ", ".join([f"{o['name']}: {o['value']}" for o in product['option']])
            products_text += f"{qty}x {name}{opts}\n"

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
        
        sup_success = email_client.send_email(
            to_email=supplier_email, 
            subject=sup_subject, 
            body_text=sup_body, 
            cc=cc_list
        )
        
        if sup_success:
             await self.log_action(order_no, f"Emailed Supplier ({supplier_name}). CC: {cc_list}")
             self.sb.client.table("kait_workflows").update({"status": "supplier_contacted"}).eq("order_no", order_no).execute()
        else:
             await self.log_action(order_no, f"Failed to email supplier {supplier_name}.")

if __name__ == "__main__":
    import asyncio
    agent = KaitAgent()
    asyncio.run(agent.run_cycle())
