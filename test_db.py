"""Quick test to check if Supabase tables exist."""
from src.connectors.supabase import get_supabase_connector

def test_tables():
    try:
        connector = get_supabase_connector()

        # Test email_logs table
        result = connector.client.table('email_logs').select('id').limit(1).execute()
        print(f"[OK] email_logs table exists (found {len(result.data)} rows)")

        # Test agent_logs table
        result = connector.client.table('agent_logs').select('id').limit(1).execute()
        print(f"[OK] agent_logs table exists (found {len(result.data)} rows)")

        print("\n[OK] All tables exist!")
        return True

    except Exception as e:
        print(f"[ERROR] {e}")
        print("\nTables might not exist. Run the migrations in Supabase SQL editor:")
        print("src/db/migrations/001_init.sql")
        return False

if __name__ == "__main__":
    test_tables()
