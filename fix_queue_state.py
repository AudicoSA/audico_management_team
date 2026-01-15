import asyncio
from src.connectors.supabase import SupabaseConnector

async def fix_queue():
    supabase = SupabaseConnector()
    
    with open("fix_output.txt", "w") as f:
        f.write("Fetching 'approved_pending' items...\n")
        response = supabase.client.table('new_products_queue')\
            .select('*')\
            .eq('status', 'approved_pending')\
            .execute()
            
        items = response.data
        f.write(f"Found {len(items)} items to fix.\n")
        
        for item in items:
            f.write(f"Fixing item: {item['name']} ({item['id']})\n")
            
            # Force update to approved
            result = supabase.client.table('new_products_queue')\
                .update({'status': 'approved'})\
                .eq('id', item['id'])\
                .execute()
                
            f.write(f"Update result: {result.data}\n")

if __name__ == "__main__":
    asyncio.run(fix_queue())
