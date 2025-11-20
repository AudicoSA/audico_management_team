"""Delete all single, double, and triple digit orders (1-999)."""
import asyncio
from src.connectors.supabase import get_supabase_connector

async def delete_old_orders():
    supabase = get_supabase_connector()
    
    print("Fetching all orders to identify 1-3 digit order numbers...")
    
    # Get all orders
    response = supabase.client.table("orders_tracker").select("order_no").execute()
    
    orders_to_delete = []
    for order in response.data:
        order_no = order["order_no"]
        # Check if it's a numeric order number with 1-3 digits
        try:
            order_num = int(order_no)
            if 1 <= order_num <= 999:
                orders_to_delete.append(order_no)
        except ValueError:
            # Skip non-numeric order numbers
            pass
    
    print(f"\nFound {len(orders_to_delete)} orders to delete (1-999 range)")
    
    if orders_to_delete:
        print("\nDeleting orders:")
        for order_no in sorted(orders_to_delete, key=lambda x: int(x)):
            try:
                supabase.client.table("orders_tracker").delete().eq("order_no", order_no).execute()
                print(f"  ✓ Deleted order #{order_no}")
            except Exception as e:
                print(f"  ✗ Error deleting order #{order_no}: {e}")
    
    print(f"\n✅ Cleanup complete! Deleted {len(orders_to_delete)} old orders.")
    print("\nRemaining orders should now be in the 28000+ range.")

if __name__ == "__main__":
    asyncio.run(delete_old_orders())
