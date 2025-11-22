import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.connectors.supabase import SupabaseConnector
from src.utils.logging import setup_logging

setup_logging()

def check_suppliers():
    connector = SupabaseConnector()
    
    print("Checking supplier_addresses table...")
    
    # Try to fetch suppliers
    try:
        response = connector.client.table("supplier_addresses").select("*").execute()
        print(f"\nFound {len(response.data)} suppliers:")
        for supplier in response.data[:5]:  # Show first 5
            print(f"  - {supplier.get('name')} ({supplier.get('city')})")
    except Exception as e:
        print(f"Error fetching suppliers: {e}")
    
    # Check RLS policies
    print("\n\nChecking RLS policies...")
    try:
        # This query checks if RLS is enabled and what policies exist
        rls_query = """
        SELECT schemaname, tablename, rowsecurity 
        FROM pg_tables 
        WHERE tablename = 'supplier_addresses';
        """
        # Note: This won't work with the standard client, but we can try a different approach
        print("Note: RLS policy check requires admin access. Please verify in Supabase dashboard.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_suppliers()
