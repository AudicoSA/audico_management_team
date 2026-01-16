import asyncio
from src.connectors.supabase import get_supabase_connector

async def test_query():
    sb = get_supabase_connector()
    print("Fetching products...")
    try:
        products = sb.client.table("products").select("*").order("created_at", desc=True).limit(5).execute()
        print(f"Products fetched: {len(products.data)}")
        
        internal_ids = [p['id'] for p in products.data]
        if not internal_ids:
            print("No internal IDs found.")
            return

        print(f"Checking matches for IDs: {internal_ids}")
        matches = sb.client.table("product_matches").select("internal_product_id").in_("internal_product_id", internal_ids).execute()
        print(f"Matches fetched: {len(matches.data)}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_query())
