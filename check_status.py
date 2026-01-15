import asyncio
from src.connectors.supabase import SupabaseConnector

async def check_queue():
    supabase = SupabaseConnector()
    
    with open("status_output.txt", "w", encoding="utf-8") as f:
        f.write("Checking for 'Zeppelin McLaren'...\n")
        response = supabase.client.table('new_products_queue')\
            .select('*')\
            .ilike('name', '%Zeppelin McLaren%')\
            .execute()
            
        for item in response.data:
            f.write(f"ID: {item['id']}\n")
            f.write(f"Name: {item['name']}\n")
            f.write(f"Status: {item['status']}\n")
            f.write(f"Created: {item['created_at']}\n")
            f.write("-" * 20 + "\n")

        f.write("\nChecking all 'approved_pending' items...\n")
        pending = supabase.client.table('new_products_queue')\
            .select('*')\
            .eq('status', 'approved_pending')\
            .execute()
            
        f.write(f"Found {len(pending.data)} items stuck in 'approved_pending'\n")
        for item in pending.data:
            f.write(f"- {item['name']} ({item['id']})\n")

if __name__ == "__main__":
    asyncio.run(check_queue())
