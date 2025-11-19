"""Check what's in the suppliers table."""
from src.connectors.supabase import get_supabase_connector

connector = get_supabase_connector()

# Get all suppliers
result = connector.client.table('suppliers').select('*').execute()

print(f"Found {len(result.data)} suppliers:")
print()

for supplier in result.data:
    print(f"Name: {supplier.get('name', 'N/A')}")
    print(f"Email: {supplier.get('email', 'N/A')}")
    print(f"Contact: {supplier.get('contact_person', 'N/A')}")
    print("-" * 50)
