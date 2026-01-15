import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env
env_path = Path("mcp-http-service/.env").resolve()
load_dotenv(env_path)

url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("❌ Missing credentials")
    exit(1)

supabase: Client = create_client(url, key)

# IDs to fix
updates = [
    {"id": "126fcafc-de30-43ad-a6d6-48bc57352aea", "name": "Denon"},
    {"id": "752457ca-7138-4db0-be08-681468d573f9", "name": "QED"},
    {"id": "77a180bf-c7d5-4030-af94-73be098908d3", "name": "Bowers & Wilkins"}
]

print("Updating instructions to 'retail' and resetting status...")

for item in updates:
    print(f"Fixing {item['name']} ({item['id']})...")
    supabase.table("price_list_uploads").update({
        "instruction": "retail",
        "status": "pending"
    }).eq("id", item['id']).execute()

print("✅ Done! Uploads queued for re-processing as Retail.")
