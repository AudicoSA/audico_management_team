"""Simple migration runner - run SQL directly via Supabase."""
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Load .env from parent directory
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    print(f"✅ Loading .env from: {env_path}")
    load_dotenv(env_path)
else:
    print(f"⚠️  .env not found at: {env_path}")
    print("Trying current directory...")
    load_dotenv()

# Get Supabase credentials
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("❌ ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment")
    print("\nMake sure .env file contains:")
    print("  SUPABASE_URL=https://...")
    print("  SUPABASE_SERVICE_ROLE_KEY=eyJ...")
    sys.exit(1)

print(f"\n✅ Supabase URL: {supabase_url}")
print(f"✅ Service key: {supabase_key[:20]}...")

# Read migration file
migration_file = Path(__file__).parent / "src" / "db" / "migrations" / "001_init.sql"
if not migration_file.exists():
    print(f"❌ Migration file not found: {migration_file}")
    sys.exit(1)

print(f"\n✅ Found migration file: {migration_file.name}")

with open(migration_file, "r", encoding="utf-8") as f:
    sql = f.read()

print(f"✅ Loaded {len(sql)} characters of SQL")

# Import Supabase client
try:
    from supabase import create_client
    print("✅ Supabase client imported")
except ImportError:
    print("❌ ERROR: supabase package not installed")
    print("Run: pip install supabase")
    sys.exit(1)

# Connect to Supabase
try:
    client = create_client(supabase_url, supabase_key)
    print("✅ Connected to Supabase")
except Exception as e:
    print(f"❌ ERROR connecting to Supabase: {e}")
    sys.exit(1)

# Execute SQL via PostgREST
print("\n📋 MANUAL MIGRATION REQUIRED")
print("=" * 60)
print("\nSupabase Python client cannot execute raw DDL SQL.")
print("You need to run the migration manually using one of these methods:")
print("\n1. RECOMMENDED: Supabase Dashboard SQL Editor")
print("   - Go to: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto")
print("   - Click 'SQL Editor' in left sidebar")
print("   - Create new query")
print(f"   - Copy contents from: {migration_file}")
print("   - Click 'Run' button")
print("\n2. ALTERNATIVE: Use psql command line")
print("   - Install psql (PostgreSQL client)")
print("   - Extract connection string from Supabase dashboard")
print("   - Run: psql [connection_string] < src/db/migrations/001_init.sql")
print("\n3. ALTERNATIVE: Use Supabase CLI")
print("   - Install: npm install -g supabase")
print("   - Run: supabase db push")
print("\n" + "=" * 60)

print("\n📄 SQL Preview (first 500 chars):")
print("-" * 60)
print(sql[:500])
print("...")
print("-" * 60)

print("\n✅ Migration script ready!")
print(f"📁 Full SQL file at: {migration_file.absolute()}")
