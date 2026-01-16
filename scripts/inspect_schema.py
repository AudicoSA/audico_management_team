import asyncio
from src.connectors.supabase import get_supabase_connector

async def inspect():
    sb = get_supabase_connector()
    try:
        # Check columns of new_products_queue table
        response = sb.client.table("new_products_queue").select("*").limit(1).execute()
        if response.data:
            print(f"Queue Columns: {response.data[0].keys()}")
        else:
             print("new_products_queue is empty, cannot infer columns. Trying insert test or assumed columns.")
    except Exception as e:
        print(f"Error checking new_products_queue: {e}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(inspect())
