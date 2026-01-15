
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
        "name": "Divglo imports", # As typed in "Company" can serve as name, or "DivGlo"
        "company": "Divglo imports",
        "street_address": "7 Dabchick Street,dalpark ext 1",
        "local_area": "Dalpark",
        "city": "Brakpan",
        "code": "1543", 
        "country_code": "ZA", # Defaulting to ZA as Province is Gauteng
        # Contact details
        "contact_name": "mike lowmass",
        "contact_email": "mike@divglo.co.za",
        "contact_phone": "+27 833257437"
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
