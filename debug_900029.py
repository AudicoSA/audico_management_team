import sys
from pathlib import Path
from dotenv import load_dotenv
import asyncio

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.opencart import OpenCartConnector
from import_opencart_orders import extract_product_names

# Load environment variables
load_dotenv()

async def debug_order(order_id):
    print(f"Debugging Order #{order_id}...")
    opencart = OpenCartConnector()
    
    order = await opencart.get_order(order_id)
    
    if not order:
        print("  Order not found in OpenCart.")
        return
        
    print(f"  Status: {order.get('status_name')}")
    print(f"  Products Raw: {order.get('products')}")
    
    name = extract_product_names(order)
    print(f"  Extracted Name: {name}")

if __name__ == "__main__":
    asyncio.run(debug_order("900029"))
