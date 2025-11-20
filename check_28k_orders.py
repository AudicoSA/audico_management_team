"""Check if orders in the 28000+ range exist."""
import asyncio
from src.connectors.supabase import get_supabase_connector

async def check_recent_orders():
    supabase = get_supabase_connector()
    
    # Check for orders >= 28000
    response = supabase.client.table("orders_tracker").select("order_no, order_name, created_at").gte("order_no", "28000").order("order_no", desc=True).limit(50).execute()
    
    if response.data:
        print(f"\nFound {len(response.data)} orders in 28000+ range:")
        print("=" * 60)
        for order in response.data:
            print(f"Order #{order['order_no']}: {order.get('order_name', 'N/A')[:40]}")
        print("=" * 60)
    else:
        print("No orders found in 28000+ range")
    
    # Also check total count
    total_response = supabase.client.table("orders_tracker").select("order_no", count="exact").execute()
    print(f"\nTotal orders in database: {total_response.count}")

if __name__ == "__main__":
    asyncio.run(check_recent_orders())
