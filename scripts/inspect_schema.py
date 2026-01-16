import asyncio
from src.connectors.supabase import get_supabase_connector

async def inspect():
    sb = get_supabase_connector()
    try:
        response = sb.client.table('products').select("*").limit(1).execute()
        if response.data:
            cols = sorted(list(response.data[0].keys()))
            print(f"Total Columns: {len(cols)}")
            for c in cols:
                print(f"- {c}")
        else:
             print("Table 'products' exists but is empty.")
    except Exception as e:
        print(f"Error inspecting 'products': {e}")

if __name__ == "__main__":
    asyncio.run(inspect())
