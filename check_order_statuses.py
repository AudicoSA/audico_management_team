import sys
from pathlib import Path
import asyncio

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.connectors.opencart import get_opencart_connector
from src.utils.logging import setup_logging

setup_logging()

async def check_order_statuses():
    opencart = get_opencart_connector()
    
    print("Checking OpenCart order statuses...")
    print("=" * 80)
    
    # Get recent orders with status info
    orders = await opencart.get_recent_orders(limit=30)
    
    # Group by status
    status_groups = {}
    for order in orders:
        status_id = order.get('order_status_id')
        if status_id not in status_groups:
            status_groups[status_id] = []
        status_groups[status_id].append(order)
    
    print(f"\nFound {len(orders)} recent orders with the following statuses:\n")
    for status_id, orders_list in sorted(status_groups.items()):
        print(f"Status ID {status_id}: {len(orders_list)} orders")
        # Show first 3 examples
        for order in orders_list[:3]:
            print(f"  - Order #{order['order_id']}: ${order.get('total')} - {order.get('date_added')}")
        if len(orders_list) > 3:
            print(f"  ... and {len(orders_list) - 3} more")
        print()
    
    print("\n" + "=" * 80)
    print("Common OpenCart Status IDs:")
    print("  1 = Pending")
    print("  2 = Processing / Processed")
    print("  3 = Shipped")
    print("  5 = Complete")
    print("  7 = Canceled")
    print("  8 = Denied")
    print("  9 = Canceled Reversal")
    print(" 10 = Failed")
    print(" 11 = Refunded")
    print(" 12 = Reversed")
    print(" 13 = Chargeback")
    print(" 14 = Expired")
    print(" 15 = Processed (Awaiting Shipment)")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(check_order_statuses())
