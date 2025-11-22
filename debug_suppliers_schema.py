import sys
from pathlib import Path
import json

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.connectors.supabase import SupabaseConnector
from src.utils.logging import setup_logging

setup_logging()

def debug_schema():
    connector = SupabaseConnector()
    
    print("Attempting to select from suppliers...")
    try:
        response = connector.client.table("suppliers").select("*").limit(1).execute()
        print("Select successful!")
        if response.data:
            print("Columns found in first record:")
            print(json.dumps(list(response.data[0].keys()), indent=2))
        else:
            print("Table is empty, cannot infer columns from data.")
            # Try to insert a dummy record to see what fails
            print("Attempting dry-run insert...")
            try:
                connector.client.table("suppliers").insert({"name": "TEST_SCHEMA_CHECK"}).execute()
            except Exception as e:
                print(f"Insert failed: {e}")
                
    except Exception as e:
        print(f"Select failed: {e}")

if __name__ == "__main__":
    debug_schema()
