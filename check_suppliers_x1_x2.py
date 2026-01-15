
import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

async def check_suppliers():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    orders = ["900061", "900059"]
    
    async with httpx.AsyncClient() as client:
        for order in orders:
            url = f"{SUPABASE_URL}/rest/v1/orders_tracker?order_no=eq.{order}"
            print(f"Checking Order {order}...")
            
            try:
                resp = await client.get(url, headers=headers)
                data = resp.json()
                
                if data:
                    print(f"Order {order}: Supplier = '{data[0].get('supplier')}'")
                else:
                    print(f"Order {order}: Not Found")
                    
            except Exception as e:
                print(f"Error checking {order}: {e}")

if __name__ == "__main__":
    asyncio.run(check_suppliers())
