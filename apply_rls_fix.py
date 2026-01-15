import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env
env_path = Path("mcp-http-service/.env").resolve()
load_dotenv(env_path)

url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("❌ Missing credentials")
    exit(1)

supabase: Client = create_client(url, key)

# Read SQL
with open("FIX_RLS_POLICIES.sql", "r") as f:
    sql = f.read()

# Execute (using a hack via rpc or just raw query if possible, but supabase-py doesn't support raw sql easily without rpc)
# Actually, the best way is to use the REST API's /sql endpoint if enabled, or just use the dashboard.
# But wait, I can use the `postgres` library if I had connection string.
# Or I can try to use the `rpc` if I have a function for it.

# Alternative: I'll use the `psycopg2` or `postgres` connector if I have the connection string.
# But I only have the URL/Key.

# Wait, I can use the `supabase-js` client in a node script? No, same issue.

# Let's try to use the `rpc` method if there is an `exec_sql` function (common pattern).
try:
    response = supabase.rpc("exec_sql", {"query": sql}).execute()
    print("✅ SQL Executed via RPC")
except Exception as e:
    print(f"⚠️ RPC failed: {e}")
    print("Attempting to use direct connection string if available...")
    
    # Check for DB connection string in env
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        import psycopg2
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
        conn.close()
        print("✅ SQL Executed via Direct Connection")
    else:
        print("❌ No DATABASE_URL found. Cannot execute raw SQL.")
        print("Please run the SQL manually in Supabase SQL Editor.")
