"""Delete bad test/old orders from the database."""
import asyncio
from src.connectors.supabase import get_supabase_connector

async def clean_bad_orders():
    supabase = get_supabase_connector()
    
    # Delete test orders
    test_orders = ["999999", "ORD-999999", "OC-999999", "#999999"]
    
    # Delete old orders (< 1000 are from 2011-2013, not recent)
    print("Deleting test and old orders...")
    
    for order_no in test_orders:
        try:
            supabase.client.table("orders_tracker").delete().eq("order_no", order_no).execute()
            print(f"Deleted test order: {order_no}")
        except Exception as e:
            print(f"Error deleting {order_no}: {e}")
    
    # Delete orders with order_no < 1000 (old orders from 2011-2013)
    try:
        response = supabase.client.table("orders_tracker").select("order_no").execute()
        for order in response.data:
            try:
                order_no_int = int(order["order_no"])
                if order_no_int < 1000:
                    supabase.client.table("orders_tracker").delete().eq("order_no", order["order_no"]).execute()
                    print(f"Deleted old order: {order['order_no']}")
            except ValueError:
                # Skip non-numeric order numbers
                pass
    except Exception as e:
        print(f"Error cleaning old orders: {e}")
    
    print("\nCleaning complete!")

if __name__ == "__main__":
    asyncio.run(clean_bad_orders())
