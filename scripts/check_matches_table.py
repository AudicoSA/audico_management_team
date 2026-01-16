import asyncio
from src.connectors.supabase import get_supabase_connector

async def check_table():
    sb = get_supabase_connector()
    try:
        # Try to select from the table
        response = sb.client.table("product_matches").select("*").limit(1).execute()
        print("Table 'product_matches' EXISTS.")
    except Exception as e:
        print(f"Table 'product_matches' DOES NOT EXIST or Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_table())
