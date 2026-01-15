
import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

async def fix_address():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    # Data fetched from OpenCart check
    updates = {
        "shipping_address_1": "535 Delphi Street, Waterkloof Glen",
        "shipping_address_2": "", 
        "shipping_city": "Pretoria",
        "shipping_postcode": "0181",
        "shipping_zone": "Gauteng",
        "shipping_country": "South Africa"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/orders_tracker?order_no=eq.900058"
    
    async with httpx.AsyncClient() as client:
        print(f"Updating Order 900058 address...")
        try:
            resp = await client.patch(url, json=updates, headers=headers)
            
            if resp.status_code in (200, 204):
                print(f"✓ Success: Updated address.")
            else:
                print(f"✗ Failed (Status {resp.status_code}): {resp.text}")
                
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_address())
