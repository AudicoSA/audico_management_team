import asyncio
from src.connectors.supabase import SupabaseConnector

async def check_uploads():
    sb = SupabaseConnector()
    
    print("Fetching recent uploads...")
    response = sb.client.table('price_list_uploads')\
        .select('*')\
        .order('created_at', desc=True)\
        .limit(5)\
        .execute()
        
    with open("uploads_status.txt", "w") as f:
        for item in response.data:
            f.write(f"ID: {item['id']}\n")
            f.write(f"Filename: {item['filename']}\n")
            f.write(f"Status: {item['status']}\n")
            f.write(f"Created At: {item['created_at']}\n")
            f.write(f"Error: {item.get('error_message')}\n")
            f.write("-" * 20 + "\n")

if __name__ == "__main__":
    asyncio.run(check_uploads())
