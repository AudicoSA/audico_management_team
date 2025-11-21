import asyncio
import os
import sys
from src.agents.email_agent import get_email_agent
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

logger = AgentLogger("VerifyFix")

async def main():
    agent = get_email_agent()
    supabase = get_supabase_connector()
    
    # IDs to process
    # 28766: 19a9b6a9b07f95fe (Was misclassified)
    # 28772: 19a9c42170d4c3b6 (Was skipped/unread)
    message_ids = ["19a9b6a9b07f95fe", "19a9c42170d4c3b6"]
    
    print(f"--- Verifying Fix for Messages: {message_ids} ---")
    
    for msg_id in message_ids:
        print(f"\nProcessing {msg_id}...")
        
        # 1. Clear existing log to force re-processing
        try:
            supabase.client.table('email_logs').delete().eq('gmail_message_id', msg_id).execute()
            print(f"  - Cleared existing log for {msg_id}")
        except Exception as e:
            print(f"  - Error clearing log (might not exist): {e}")
            
        # 2. Process
        result = await agent.process_email(msg_id)
        
        print(f"  - Result: {result}")
        
        # 3. Verify classification
        if result.get('status') == 'logged_for_future_processing':
            print(f"  - SUCCESS: Classified as {result.get('category')}")
            if result.get('category') == 'SUPPLIER_INVOICE':
                print("  - CORRECT CATEGORY!")
            else:
                print(f"  - WARNING: Category is {result.get('category')}, expected SUPPLIER_INVOICE")
        else:
            print(f"  - STATUS: {result.get('status')} (Category: {result.get('category')})")

if __name__ == "__main__":
    asyncio.run(main())
