import asyncio
from src.connectors.supabase import get_supabase_connector

async def search_email_logs(query):
    supabase = get_supabase_connector()
    print(f"Searching email_logs for '{query}'...")
    
    try:
        # Search by subject
        res_subject = supabase.client.table("email_logs").select("*").ilike("subject", f"%{query}%").execute()
        
        # Search by payload (if possible, though ilike might not work on jsonb deeply, let's try shallow text search or just rely on subject first)
        # For now, let's stick to subject and maybe we can filter results in python if needed.
        
        logs = res_subject.data
        print(f"Found {len(logs)} logs matching subject.")
        
        for log in logs:
            print(f"\nID: {log['id']}")
            print(f"Subject: {log['subject']}")
            print(f"From: {log['from_email']}")
            print(f"Category: {log['category']}")
            print(f"Status: {log['status']}")
            print(f"Created At: {log['created_at']}")
            print(f"Payload: {log.get('payload')}")

    except Exception as e:
        print(f"Error searching logs: {e}")

if __name__ == "__main__":
    asyncio.run(search_email_logs("900145"))
