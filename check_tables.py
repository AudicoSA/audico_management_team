import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Try to find .env file
env_path = Path("mcp-http-service/.env").resolve()
print(f"Loading .env from: {env_path}")
load_dotenv(env_path)

url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("❌ Failed to load Supabase credentials from .env")
    print(f"URL found: {bool(url)}")
    print(f"Key found: {bool(key)}")
    exit(1)
supabase: Client = create_client(url, key)

tables = ["price_list_uploads", "price_change_queue", "supplier_catalogs", "supplier_pricing_rules"]

print(f"Checking tables in {url}...")

for table in tables:
    try:
        response = supabase.table(table).select("count", count="exact").limit(1).execute()
        print(f"✅ Table '{table}' exists.")
    except Exception as e:
        print(f"❌ Table '{table}' does NOT exist (or error: {str(e)})")
