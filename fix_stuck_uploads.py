import asyncio
from src.connectors.supabase import SupabaseConnector

async def fix_stuck_uploads():
    sb = SupabaseConnector()
    
    # 1. Reset the latest upload to 'pending' so the worker picks it up
    latest_id = "a1735a5c-8b6d-4e91-bae0-0cac71c3a826"
    print(f"Resetting latest upload {latest_id} to 'pending'...")
    sb.client.table('price_list_uploads').update({'status': 'pending'}).eq('id', latest_id).execute()
    
    # 2. Mark older stuck uploads as 'failed'
    stuck_ids = [
        "e3bcf21e-01df-4f54-bea0-cf75957070b6",
        "56e37da2-9970-4135-ada5-3af3019274dd"
    ]
    
    for uid in stuck_ids:
        print(f"Marking stuck upload {uid} as 'failed'...")
        sb.client.table('price_list_uploads').update({
            'status': 'failed', 
            'error_message': 'Stuck in processing (system restart)'
        }).eq('id', uid).execute()
        
    print("Done.")

if __name__ == "__main__":
    asyncio.run(fix_stuck_uploads())
