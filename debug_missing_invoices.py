import asyncio
import os
import sys
from src.connectors.gmail import get_gmail_connector
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

# Setup logging
logger = AgentLogger("DebugInvoice")

async def main():
    gmail = get_gmail_connector()
    supabase = get_supabase_connector()
    
    orders = ["28772", "28766"]
    
    print(f"--- Searching for Orders: {orders} ---")
    
    for order_id in orders:
        print(f"\n\n=== Analyzing Order {order_id} ===")
        
        # 1. Search Gmail
        query = f"{order_id}"
        messages = gmail.service.users().messages().list(userId='me', q=query).execute()
        
        if 'messages' in messages:
            print(f"Found {len(messages['messages'])} emails in Gmail.")
            for msg in messages['messages']:
                full_msg = gmail.service.users().messages().get(userId='me', id=msg['id']).execute()
                headers = full_msg['payload']['headers']
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                sender = next((h['value'] for h in headers if h['name'] == 'From'), 'No Sender')
                
                # Check for attachments
                parts = full_msg['payload'].get('parts', [])
                attachments = []
                for part in parts:
                    if part.get('filename'):
                        attachments.append(part['filename'])
                
                print(f"  - Msg ID: {msg['id']}")
                print(f"    From: {sender}")
                print(f"    Subject: {subject}")
                print(f"    Attachments: {attachments}")
                
                # Check if processed in Supabase
                logs = supabase.client.table('email_logs').select('*').eq('gmail_message_id', msg['id']).execute()
                if logs.data:
                    print(f"    [Supabase Log]: Category={logs.data[0].get('category')}, Status={logs.data[0].get('status')}")
                else:
                    print("    [Supabase Log]: NOT FOUND")
        else:
            print("No emails found in Gmail.")

if __name__ == "__main__":
    asyncio.run(main())
