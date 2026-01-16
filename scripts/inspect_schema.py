import asyncio
from src.connectors.supabase import get_supabase_connector

async def inspect():
    sb = get_supabase_connector()
    try:
        # Check columns of products table
        response = sb.client.table("products").select("*").limit(1).execute()
        if response.data:
            keys = sorted(list(response.data[0].keys()))
            print(f"Products Columns: {keys}")
            # print(f"Sample Data: {response.data[0]}")
    except Exception as e:
        print(f"Error checking products: {e}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(inspect())
