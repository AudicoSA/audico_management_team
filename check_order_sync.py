import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.connectors.opencart import get_opencart_connector
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import setup_logging
import asyncio

setup_logging()

async def check_order_sync():
    opencart = get_opencart_connector()
    supabase = get_supabase_connector()
    
    print("=" * 60)
    print("CHECKING ORDER SYNC STATUS")
    print("=" * 60)
    
    # 1. Check latest orders in OpenCart
    print("\n1. Latest Orders in OpenCart:")
    print("-" * 60)
    opencart_orders = await opencart.get_recent_orders(limit=10)
    print(f"Found {len(opencart_orders)} recent orders in OpenCart:")
    for order in opencart_orders[:5]:
        print(f"  - Order #{order['order_id']}: {order.get('firstname')} {order.get('lastname')} - ${order.get('total')} - {order.get('date_added')}")
    
    # 2. Check latest orders in Supabase
    print("\n2. Latest Orders in Supabase orders_tracker:")
    print("-" * 60)
    try:
        response = supabase.client.table("orders_tracker").select("order_no, order_name, created_at, source").order("created_at", desc=True).limit(10).execute()
        print(f"Found {len(response.data)} orders in Supabase:")
        for order in response.data[:5]:
            print(f"  - Order #{order['order_no']}: {order.get('order_name')} - Source: {order.get('source')} - {order.get('created_at')}")
    except Exception as e:
        print(f"Error fetching from Supabase: {e}")
    
    # 3. Check if OpenCart orders exist in Supabase
    print("\n3. Checking Sync Status:")
    print("-" * 60)
    missing_orders = []
    for oc_order in opencart_orders[:10]:
        order_id = str(oc_order['order_id'])
        try:
            sb_order = await supabase.get_order_tracker(order_id)
            if sb_order:
                print(f"  ✅ Order #{order_id} exists in Supabase")
            else:
                print(f"  ❌ Order #{order_id} MISSING from Supabase")
                missing_orders.append(order_id)
        except:
            print(f"  ❌ Order #{order_id} MISSING from Supabase")
            missing_orders.append(order_id)
    
    if missing_orders:
        print(f"\n⚠️  {len(missing_orders)} orders need to be synced: {', '.join(missing_orders)}")
    else:
        print("\n✅ All recent OpenCart orders are synced to Supabase!")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(check_order_sync())
