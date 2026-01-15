
import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

async def add_supplier():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    # Details from screenshot
    new_supplier = {
        "name": "Balanced Audio",
        "company": "Balanced audio-Yamaha",
        "street_address": "11 Galaxy Avenue, Nightwing, Linbro Business Park F",
        "local_area": "Frankenwald",
        "city": "Sandton",
        "code": "2090",
        "country_code": "ZA"
    }
    
    async with httpx.AsyncClient() as client:
        url = f"{SUPABASE_URL}/rest/v1/supplier_addresses"
        print(f"Adding supplier '{new_supplier['name']}'...")
        
        try:
            resp = await client.post(url, json=new_supplier, headers=headers)
            
            if resp.status_code in (200, 201):
                print(f"✓ Success: {resp.json()}")
            else:
                print(f"✗ Failed (Status {resp.status_code}): {resp.text}")
                
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(add_supplier())
