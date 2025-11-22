import sys
import asyncio
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.connectors.supabase import SupabaseConnector
from src.agents.email_agent import EmailManagementAgent
from src.utils.logging import setup_logging

setup_logging()

async def reprocess():
    connector = SupabaseConnector()
    email_id = "f0e94d09-dbcc-4bea-9341-c9527c1c7d52"
    
    print(f"Fetching email log {email_id}...")
    email_log = await connector.get_email_log_by_id(email_id)
    
    if not email_log:
        print("Email log not found!")
        return

    subject = email_log.get("subject", "")
    # Payload might contain the body if we stored it, or we might need to fetch from Gmail if we didn't store the body in the log.
    # The 'payload' field usually stores extraction results, not the full body.
    # However, 'EmailManagementAgent.process_email' uses 'gmail.get_message_content'.
    # If we don't have the body, we can't re-extract without fetching from Gmail again.
    # Let's check if we have the gmail_message_id.
    
    gmail_message_id = email_log.get("gmail_message_id")
    print(f"Gmail Message ID: {gmail_message_id}")
    print(f"Subject: {subject}")
    
    agent = EmailManagementAgent()
    
    # Fetch content from Gmail
    print("Fetching content from Gmail...")
    try:
        email_content = agent.gmail.get_message(gmail_message_id)
        if not email_content:
            print("Could not fetch email content from Gmail.")
            return
            
        print(f"Body length: {len(email_content.body)}")
        
        # Check for 575757
        if "575757" in email_content.body or "575757" in subject:
            print("FOUND '575757' in email content!")
        else:
            print("'575757' NOT found in email content.")

        # Re-run extraction
        print("Re-running extraction...")
        extracted = await agent._extract_invoice_details(subject, email_content.body)
        
        output = []
        output.append("\n--- Extracted Details ---")
        output.append(json.dumps(extracted, indent=2))
        
        # Check what is currently in DB for 28771
        current_tracker = await connector.get_order_tracker("28771")
        output.append("\n--- Current DB State (28771) ---")
        output.append(json.dumps(current_tracker, indent=2, default=str))
        
        with open("reprocess_result.txt", "w") as f:
            f.write("\n".join(output))
            
        print("Results written to reprocess_result.txt")
        
    except Exception as e:
        print(f"Error during reprocessing: {e}")
        with open("reprocess_result.txt", "w") as f:
            f.write(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(reprocess())
