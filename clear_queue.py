import asyncio
from src.connectors.supabase import SupabaseConnector

async def clear_queue():
    supabase = SupabaseConnector()
    
    print("Clearing 'new_products_queue'...")
    # Delete all rows (using neq id 0 is a common trick if delete all isn't directly supported without filter)
    # Or just delete where status is not null
    try:
        response = supabase.client.table('new_products_queue')\
            .delete()\
            .neq('id', '00000000-0000-0000-0000-000000000000')\
            .execute()
        print("Queue cleared successfully.")
    except Exception as e:
        print(f"Error clearing queue: {e}")

if __name__ == "__main__":
    asyncio.run(clear_queue())
