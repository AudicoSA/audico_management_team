
import asyncio
from src.connectors.supabase import SupabaseConnector

async def check_schema():
    supabase = SupabaseConnector()
    
    # Get one item to see columns
    print("Checking orders_tracker schema...")
    response = supabase.client.table('orders_tracker')\
        .select('*')\
        .limit(1)\
        .execute()
        
    if response.data:
        keys = list(response.data[0].keys())
        print(f"Columns found: {len(keys)}")
        print(keys)
        
        needed = ["shipping_address_1", "shipping_city", "shipping_postcode", "shipping_country"]
        missing = [k for k in needed if k not in keys]
        
        if missing:
            print(f"\n❌ MISSING ADDRESS COLUMNS: {missing}")
        else:
            print("\n✅ All address columns present.")
    else:
        print("No data in orders_tracker to infer schema.")

if __name__ == "__main__":
    asyncio.run(check_schema())
