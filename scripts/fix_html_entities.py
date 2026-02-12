
import os
import html
import time
from dotenv import load_dotenv
from supabase import create_client

# Load env from .env file in current dir
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    print("Error: SUPABASE_URL not found")
    exit(1)

def fix_names():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("Fetching ALL products to scan for HTML entities...")
    
    offset = 0
    limit = 1000
    updated_count = 0
    scanned_count = 0
    
    while True:
        # Fetch batch
        res = sb.table("products").select("id, product_name").range(offset, offset + limit - 1).execute()
        batch = res.data
        
        if not batch:
            break
            
        scanned_count += len(batch)
        print(f"Scanning batch {offset}-{offset+len(batch)}...")
        
        for p in batch:
            original_name = p['product_name']
            if not original_name:
                continue
                
            decoded_name = html.unescape(original_name).strip()
            
            if decoded_name != original_name:
                print(f"Fixing: {original_name} -> {decoded_name}")
                
                # Update
                try:
                    sb.table("products").update({"product_name": decoded_name}).eq("id", p['id']).execute()
                    updated_count += 1
                except Exception as e:
                    print(f"  Error updating {p['id']}: {e}")
        
        if len(batch) < limit:
            break
        offset += limit
        
    print(f"\nScan Complete.")
    print(f"Total Scanned: {scanned_count}")
    print(f"Total Fixed: {updated_count}")

if __name__ == "__main__":
    fix_names()
