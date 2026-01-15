import asyncio
from src.connectors.supabase import get_supabase_connector
from src.agents.email_agent import get_email_agent

async def reprocess_email():
    """
    1. Get gmail_message_id for the log ID 54b33f7e-92f3-4672-8f0e-02b0bb3a696b
    2. Delete the log entry to allow reprocessing
    3. Run email_agent.process_email(gmail_message_id)
    """
    supabase = get_supabase_connector()
    email_agent = get_email_agent()
    
    log_id = "54b33f7e-92f3-4672-8f0e-02b0bb3a696b"
    
    print(f"Fetching log {log_id}...")
    log = await supabase.get_email_log_by_id(log_id)
    
    if not log:
        print("Log not found!")
        return

    gmail_id = log.get('gmail_message_id')
    print(f"Found Gmail ID: {gmail_id}")
    
    # Delete log to unblock check_email_already_processed
    print("Deleting log entry...")
    supabase.client.table("email_logs").delete().eq("id", log_id).execute()
    
    print(f"Reprocessing email {gmail_id}...")
    result = await email_agent.process_email(gmail_id)
    print(f"Result: {result}")

if __name__ == "__main__":
    asyncio.run(reprocess_email())
