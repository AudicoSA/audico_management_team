
import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

async def update_rest():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    updates = [
        {"order": "900065", "supplier": "Homemation"},
        {"order": "900067", "supplier": "Solution Technologies"}
    ]
    
    async with httpx.AsyncClient() as client:
        for item in updates:
            url = f"{SUPABASE_URL}/rest/v1/orders_tracker?order_no=eq.{item['order']}"
            print(f"Updating {item['order']} to {item['supplier']} via REST...")
            
            try:
                resp = await client.patch(url, json={
                    "supplier": item["supplier"],
                    "updates": f"Manually corrected supplier to {item['supplier']}"
                }, headers=headers)
                
                print(f"Status: {resp.status_code}")
                print(f"Response: {resp.text}")
            except Exception as e:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(update_rest())
