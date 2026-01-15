import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.supabase import SupabaseConnector
from connectors.opencart import OpenCartConnector
from utils.logging import AgentLogger, setup_logging

# Load environment variables
load_dotenv()

# Setup logging
setup_logging()
logger = AgentLogger("cleanup_orders")

async def cleanup_orders():
    print("Starting cleanup of unwanted orders...")
    
    supabase = SupabaseConnector()
    opencart = OpenCartConnector()
    
    # Get all orders from Supabase
    response = supabase.client.table("orders_tracker").select("order_no").execute()
    if not response.data:
        print("No orders found in Supabase.")
        return

    print(f"Checking {len(response.data)} orders...")
    
    deleted_count = 0
    kept_count = 0
    
    IGNORED_STATUSES = ["Missing Orders", "Canceled", "Voided", "Denied", "Expired", "Failed", "Refunded", "Reversed"]
    
    for record in response.data:
        order_no = record['order_no']
        
        # Check status in OpenCart
        try:
            order = await opencart.get_order(order_no)
            
            if not order:
                # If not in OpenCart, maybe we should keep it? Or delete? 
                # For now, let's log it.
                print(f"  ? Order {order_no} not found in OpenCart. Skipping.")
                continue
                
            status_name = order.get('status_name', 'Unknown')
            
            if status_name in IGNORED_STATUSES:
                print(f"  X Deleting Order {order_no} (Status: {status_name})")
                supabase.client.table("orders_tracker").delete().eq("order_no", order_no).execute()
                deleted_count += 1
            else:
                kept_count += 1
                
        except Exception as e:
            print(f"  ! Error checking order {order_no}: {e}")

    print(f"\nCleanup Completed!")
    print(f"  Deleted: {deleted_count}")
    print(f"  Kept:    {kept_count}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(cleanup_orders())
