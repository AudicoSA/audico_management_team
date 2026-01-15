import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env
env_path = Path("mcp-http-service/.env").resolve()
load_dotenv(env_path)

url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
# IMPORTANT: Use ANON key to test RLS
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZGVoeWNveXBpbHNlZ214YnRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzOTE0NTEsImV4cCI6MjA2Nzk2NzQ1MX0.VExJeWcZlyzBGBUBYoYX503bGZfqZXlhtP3Z34_qsoc"

if not url or not key:
    print("❌ Missing ANON credentials")
    exit(1)

print(f"Testing ANON access to {url}...")
supabase: Client = create_client(url, key)

try:
    # 1. Test Table Insert
    print("Attempting insert into price_list_uploads...")
    data = {
        "filename": "test_anon.txt",
        "storage_path": "test/path",
        "supplier_name": "Test Anon",
        "status": "pending",
        "instruction": "cost_excl_vat"
    }
    response = supabase.table("price_list_uploads").insert(data).execute()
    print("✅ Insert successful!")
    print(response.data)
    
    # Clean up (if possible, might fail if delete policy not set)
    try:
        id = response.data[0]['id']
        supabase.table("price_list_uploads").delete().eq("id", id).execute()
        print("✅ Cleanup successful")
    except:
        print("⚠️ Cleanup failed (expected if delete policy missing)")

except Exception as e:
    print(f"❌ Insert FAILED: {e}")

try:
    # 2. Test Storage Upload
    print("\nAttempting storage upload to 'invoices'...")
    res = supabase.storage.from_("invoices").upload("test_anon.txt", b"test content")
    print("✅ Upload successful!")
except Exception as e:
    print(f"❌ Upload FAILED: {e}")
