
import asyncio
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

logger = AgentLogger("ManualCorrection")

async def update_suppliers():
    connector = get_supabase_connector()
    
    updates = [
        {"order": "900065", "supplier": "Homemation"},
        {"order": "900067", "supplier": "Solution Technologies"}
    ]
    
    for item in updates:
        print(f"Updating Order {item['order']} supplier to '{item['supplier']}'...")
        try:
            # Direct update to avoid wrapper issues
            response = connector.client.table("orders_tracker").update({
                "supplier": item['supplier'],
                "updates": f"Manually corrected supplier to {item['supplier']} | "
            }).eq("order_no", item['order']).execute()
            
            print(f"  ✓ Success for {item['order']}: {response.data}")
        except Exception as e:
            print(f"  ✗ Failed for {item['order']}: {e}")

if __name__ == "__main__":
    asyncio.run(update_suppliers())
