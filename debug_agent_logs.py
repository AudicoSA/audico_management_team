import asyncio
from src.connectors.supabase import get_supabase_connector

async def debug_agent_logs(message_id):
    supabase = get_supabase_connector()
    print(f"Searching agent_logs for message_id: {message_id}...")
    
    try:
        # Search agent_logs for the message_id in the context json
        # Supabase Python client might need a specific filter for JSON columns.
        # Alternatively, we can search by created_at range if we knew it, or just fetch recent logs and filter in python.
        # For this message, we know it was created around 2026-01-06T07:41:03
        
        # Let's try fetching logs from today
        res = supabase.client.table("agent_logs") \
            .select("*") \
            .order("created_at", desc=True) \
            .limit(100) \
            .execute()
            
        found = False
        for log in res.data:
            context = log.get('context', {})
            if context and context.get('message_id') == message_id:
                print(f"\n--- Log Entry ---")
                print(f"Level: {log['level']}")
                print(f"Event: {log['event_type']}")
                print(f"Context: {context}")
                found = True
        
        if not found:
            print("No agent logs found for this message ID in the last 100 entries.")

        print("\n--- Checking Orders Tracker for 900145 ---")
        res_order = supabase.client.table("orders_tracker").select("*").eq("order_no", "900145").execute()
        if res_order.data:
            print(f"Tracker Entry: {res_order.data[0]}")
        else:
            print("No entry in orders_tracker for 900145")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_agent_logs("54b33f7e-92f3-4672-8f0e-02b0bb3a696b"))
