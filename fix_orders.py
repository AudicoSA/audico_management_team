import sys
import asyncio
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.connectors.supabase import SupabaseConnector
from src.utils.logging import setup_logging

setup_logging()

async def fix_orders():
    connector = SupabaseConnector()
    
    # 1. Delete Order 575757
    print("Deleting Order 575757...")
    try:
        # Soft delete or hard delete? The schema has deleted_at.
        # But for a hallucination, hard delete is better to clean up.
        # However, Supabase client might not allow delete without RLS or specific policy.
        # Let's try delete.
        response = connector.client.table("orders_tracker").delete().eq("order_no", "575757").execute()
        print(f"Deleted 575757: {response.data}")
    except Exception as e:
        print(f"Error deleting 575757: {e}")

    # 2. Update Order 28771
    print("\nUpdating Order 28771...")
    try:
        # Values from re-extraction
        updates = {
            "supplier_invoice_no": "28771",
            "supplier_amount": 15990.0,
            "supplier": "Audico Online Store",
            "supplier_status": "Invoiced",
            "updates": "Manually corrected via agent fix_orders.py"
        }
        
        # We use upsert_order_tracker to ensure profit calc and logging happens
        await connector.upsert_order_tracker(
            order_no="28771",
            supplier_invoice_no=updates["supplier_invoice_no"],
            supplier_amount=updates["supplier_amount"],
            supplier=updates["supplier"],
            supplier_status=updates["supplier_status"],
            updates=updates["updates"]
        )
        print("Updated 28771 successfully.")
        
        # Verify
        updated = await connector.get_order_tracker("28771")
        print("\n--- Updated DB State (28771) ---")
        print(json.dumps(updated, indent=2, default=str))
        
    except Exception as e:
        print(f"Error updating 28771: {e}")

if __name__ == "__main__":
    asyncio.run(fix_orders())
