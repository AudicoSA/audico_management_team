import asyncio
from src.connectors.supabase import SupabaseConnector

async def check_recent():
    supabase = SupabaseConnector()
    
    print("Checking recent items in queue...")
    response = supabase.client.table('new_products_queue')\
        .select('*')\
        .order('created_at', desc=True)\
        .limit(10)\
        .execute()
        
    with open("recent_queue.txt", "w") as f:
        for item in response.data:
            f.write(f"ID: {item['id']}\n")
            f.write(f"Name: {item['name']}\n")
            f.write(f"Status: {item['status']}\n")
            f.write(f"Created: {item['created_at']}\n")
            f.write("-" * 20 + "\n")

if __name__ == "__main__":
    asyncio.run(check_recent())
