import sys
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.connectors.supabase import SupabaseConnector
from src.utils.logging import setup_logging

setup_logging()

def inspect_orders():
    connector = SupabaseConnector()
    order_ids = ["575757", "28771"]
    
    print(f"Inspecting orders: {order_ids}")
    
    for order_id in order_ids:
        print(f"\n--- Order {order_id} ---")
        
        # Check orders_tracker table
        try:
            response = connector.client.table("orders_tracker").select("*").eq("order_no", order_id).execute()
            if response.data:
                print("Found in 'orders_tracker' table:")
                print(json.dumps(response.data[0], indent=2, default=str))
            else:
                print("NOT FOUND in 'orders_tracker' table.")
        except Exception as e:
            print(f"Error checking 'orders_tracker' table: {e}")

        # Check order_tracking table (if it exists or is used for this)
        # Based on previous context, 'orders' seems to be the main table, but let's check if there's other info.
        # There is also 'email_logs' which might be relevant to see where it came from.
        
        try:
            # Search email logs for this order ID in the subject or body (might be slow, but useful)
            # Or just check if we can find logs related to it.
            # actually, let's just look for logs where order_id might be stored if that column exists, 
            # or just rely on the order entry for now.
            pass
        except Exception:
            pass

if __name__ == "__main__":
    inspect_orders()
