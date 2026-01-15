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

print("Checking price_list_uploads...")
response = supabase.table("price_list_uploads").select("*").order("created_at", desc=True).limit(5).execute()

for row in response.data:
    print(f"ID: {row['id']}")
    print(f"Filename: {row['filename']}")
    print(f"Status: {row['status']}")
    print(f"Instruction: {row.get('instruction')}")
    print(f"Error: {row.get('error_message')}")
    print("-" * 20)
