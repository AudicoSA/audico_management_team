"""Delete old orders (1-999) by first removing their history records."""
import asyncio
from src.connectors.supabase import get_supabase_connector

async def delete_old_orders_with_history():
    supabase = get_supabase_connector()
    
    print("Fetching all orders to identify 1-3 digit order numbers...")
    
    # Get all orders
    response = supabase.client.table("orders_tracker").select("order_no").execute()
    
    orders_to_delete = []
    for order in response.data:
        order_no = order["order_no"]
        try:
            order_num = int(order_no)
            if 1 <= order_num <= 999:
                orders_to_delete.append(order_no)
        except ValueError:
            pass
    
    print(f"\nFound {len(orders_to_delete)} orders to delete (1-999 range)")
    
    if orders_to_delete:
        print("\nStep 1: Deleting history records...")
        for order_no in sorted(orders_to_delete, key=lambda x: int(x)):
            try:
                # Delete history records first
                supabase.client.table("orders_tracker_history").delete().eq("order_no", order_no).execute()
                print(f"  ✓ Deleted history for order #{order_no}")
            except Exception as e:
                print(f"  ⚠ No history for order #{order_no}")
        
        print("\nStep 2: Deleting orders...")
        deleted_count = 0
        for order_no in sorted(orders_to_delete, key=lambda x: int(x)):
            try:
                supabase.client.table("orders_tracker").delete().eq("order_no", order_no).execute()
                print(f"  ✓ Deleted order #{order_no}")
                deleted_count += 1
            except Exception as e:
                print(f"  ✗ Error deleting order #{order_no}: {str(e)[:100]}")
        
        print(f"\n✅ Cleanup complete! Deleted {deleted_count} orders.")
    else:
        print("\nNo orders to delete.")

if __name__ == "__main__":
    asyncio.run(delete_old_orders_with_history())
