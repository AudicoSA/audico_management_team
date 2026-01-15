
import asyncio
from src.connectors.supabase import get_supabase_connector

async def verify():
    connector = get_supabase_connector()
    orders = ["900065", "900067"]
    
    print("Verifying suppliers...")
    for order_no in orders:
        try:
            response = connector.client.table("orders_tracker").select("*").eq("order_no", order_no).execute()
            if response.data:
                data = response.data[0]
                print(f"Order {order_no}: Supplier = '{data.get('supplier')}'")
            else:
                print(f"Order {order_no}: Not Found")
        except Exception as e:
            print(f"Error checking {order_no}: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
