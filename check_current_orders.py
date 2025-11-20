"""Check what orders are currently in the database."""
import asyncio
from src.connectors.supabase import get_supabase_connector

async def check_orders():
    supabase = get_supabase_connector()
    
    # Get all orders sorted by order_no descending
    response = supabase.client.table("orders_tracker").select("order_no, order_name, created_at").order("order_no", desc=True).limit(20).execute()
    
    if response.data:
        print(f"\nFound {len(response.data)} most recent orders:")
        print("=" * 60)
        for order in response.data:
            print(f"Order #{order['order_no']}: {order.get('order_name', 'N/A')[:40]}")
        print("=" * 60)
    else:
        print("No orders found in database")

if __name__ == "__main__":
    asyncio.run(check_orders())
