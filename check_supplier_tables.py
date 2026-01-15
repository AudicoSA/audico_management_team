import asyncio
from src.connectors.supabase import get_supabase_connector

async def check_suppliers():
    supabase = get_supabase_connector()
    
    print("--- Checking 'suppliers' table ---")
    try:
        res = supabase.client.table("suppliers").select("*").limit(5).execute()
        print(f"Found {len(res.data)} rows.")
        if res.data:
            print(f"Sample: {res.data[0]}")
    except Exception as e:
        print(f"Error querying 'suppliers': {e}")

    print("\n--- Checking 'supplier_addresses' table ---")
    try:
        res = supabase.client.table("supplier_addresses").select("*").limit(5).execute()
        print(f"Found {len(res.data)} rows.")
        if res.data:
            print(f"Sample: {res.data[0]}")
    except Exception as e:
        print(f"Error querying 'supplier_addresses': {e}")

if __name__ == "__main__":
    asyncio.run(check_suppliers())
