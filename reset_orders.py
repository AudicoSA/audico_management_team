import sys
from pathlib import Path
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.supabase import SupabaseConnector
from utils.logging import AgentLogger, setup_logging

# Load environment variables
load_dotenv()

# Setup logging
setup_logging()

async def reset_orders():
    print("WARNING: This will DELETE ALL ORDERS from the dashboard.")
    print("Starting reset...")
    
    supabase = SupabaseConnector()
    
    # Delete all rows
    # Supabase delete without filter deletes all rows if RLS allows, 
    # but usually requires a filter. We'll use a filter that matches everything.
    try:
        # Fetch all IDs first to be safe/explicit
        response = supabase.client.table("orders_tracker").select("order_no").execute()
        if not response.data:
            print("No orders to delete.")
            return

        count = len(response.data)
        print(f"Found {count} orders. Deleting...")
        
        for order in response.data:
            # Delete history first to avoid FK constraint violation
            try:
                supabase.client.table("orders_tracker_history").delete().eq("order_no", order['order_no']).execute()
            except Exception as e:
                # Ignore if history doesn't exist or other error, try to proceed
                pass

            supabase.client.table("orders_tracker").delete().eq("order_no", order['order_no']).execute()
            print(f"  Deleted {order['order_no']}")
            
        print(f"Reset complete. Deleted {count} orders.")
        
    except Exception as e:
        print(f"Error resetting orders: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(reset_orders())
