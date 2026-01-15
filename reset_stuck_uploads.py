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

print("Resetting stuck 'processing' uploads to 'pending'...")

# Fetch stuck items
response = supabase.table("price_list_uploads").select("id").eq("status", "processing").execute()
stuck_ids = [row['id'] for row in response.data]

print(f"Found {len(stuck_ids)} stuck uploads.")

for uid in stuck_ids:
    print(f"Resetting {uid}...")
    supabase.table("price_list_uploads").update({"status": "pending"}).eq("id", uid).execute()

print("✅ Done! All stuck uploads are now pending.")
