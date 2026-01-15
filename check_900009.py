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

def check_order(order_no):
    print(f"Checking Order #{order_no}...")
    supabase = SupabaseConnector()
    
    response = supabase.client.table("orders_tracker").select("*").eq("order_no", order_no).execute()
    
    if not response.data:
        print("  Order not found in Supabase.")
        return
        
    order = response.data[0]
    print(f"  Order Name:      {order.get('order_name')}")
    print(f"  Cost:            {order.get('cost')}")
    print(f"  Supplier Amount: {order.get('supplier_amount')}")
    print(f"  Invoice No:      {order.get('invoice_no')}")
    print(f"  Paid:            {order.get('order_paid')}")
    print(f"  Status:          {order.get('supplier_status')}")
    print(f"  Updates:         {order.get('updates')}")

if __name__ == "__main__":
    check_order("900009")
