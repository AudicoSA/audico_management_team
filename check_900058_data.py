
import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

async def check_order():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/orders_tracker?order_no=eq.900058"
    
    async with httpx.AsyncClient() as client:
        print("Fetching Order 900058 details...")
        resp = await client.get(url, headers=headers)
        data = resp.json()
        
        if data:
            order = data[0]
            print("\n--- DELIVERY ADDRESS ---")
            print(f"Street: {order.get('shipping_address_1', '')} {order.get('shipping_address_2', '')}")
            print(f"City: {order.get('shipping_city', '')}")
            print(f"Postcode: {order.get('shipping_postcode', '')}")
            print(f"Zone: {order.get('shipping_zone', '')}")
            print(f"Country: {order.get('shipping_country', '')}")
        else:
            print("Order 900058 not found.")

if __name__ == "__main__":
    asyncio.run(check_order())
