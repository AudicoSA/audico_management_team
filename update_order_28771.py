"""Manually update order 28771 with ProForma Invoice details."""
import asyncio
from src.connectors.supabase import get_supabase_connector

async def update_order_28771():
    supabase = get_supabase_connector()
    
    order_no = "28771"
    
    # Update with invoice details from the email
    print(f"Updating order #{order_no} with ProForma Invoice details...")
    
    try:
        await supabase.upsert_order_tracker(
            order_no=order_no,
            supplier="Data Video Communications (Pty) Ltd",
            supplier_invoice_no="IO104536",
            supplier_quote_no=None,
            supplier_amount=None,  # Amount not visible in email body, would need to check attachment
            supplier_status="Invoiced",
            source="agent",
            last_modified_by="manual_update"
        )
        
        print(f"✅ Successfully updated order #{order_no}")
        print(f"   Supplier: Data Video Communications (Pty) Ltd")
        print(f"   Invoice No: IO104536")
        print(f"   Status: Invoiced")
        
    except Exception as e:
        print(f"❌ Error updating order: {e}")

if __name__ == "__main__":
    asyncio.run(update_order_28771())
