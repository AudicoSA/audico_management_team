
import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

async def update_supplier():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    # Update with contact details
    updates = {
        "contact_name": "JP/Cherrielee",
        "contact_email": "clarinen@tuningfork.co.za",
        "contact_phone": "0112597600"
    }
    
    async with httpx.AsyncClient() as client:
        # Find ID first or update by name? Name is unique enough for this context.
        # But REST update usually needs EQ.
        url = f"{SUPABASE_URL}/rest/v1/supplier_addresses?name=eq.Balanced%20Audio"
        
        print(f"Updating contact details for Balanced Audio...")
        
        try:
            resp = await client.patch(url, json=updates, headers=headers)
            
            if resp.status_code in (200, 204):
                print(f"✓ Success: {resp.json() if resp.content else 'No Content'}")
            else:
                print(f"✗ Failed (Status {resp.status_code}): {resp.text}")
                
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(update_supplier())
