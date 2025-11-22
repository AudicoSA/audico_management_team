import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.connectors.supabase import SupabaseConnector
from src.utils.logging import setup_logging

setup_logging()

def apply_migration():
    connector = SupabaseConnector()
    
    print("Applying migration 007: Fix supplier_addresses RLS policy...")
    
    # Read migration file
    migration_path = Path(__file__).parent / "src" / "db" / "migrations" / "007_fix_supplier_rls.sql"
    with open(migration_path, 'r') as f:
        sql = f.read()
    
    try:
        # Execute the SQL
        # Note: Supabase client doesn't support raw SQL execution directly
        # We need to use the PostgREST API or run this manually in Supabase SQL editor
        print("\nMigration SQL:")
        print(sql)
        print("\n⚠️  Please run this SQL in the Supabase SQL Editor:")
        print("   1. Go to https://supabase.com/dashboard")
        print("   2. Select your project")
        print("   3. Go to SQL Editor")
        print("   4. Copy and paste the SQL above")
        print("   5. Click 'Run'")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    apply_migration()
