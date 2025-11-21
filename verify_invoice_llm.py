import asyncio
import os
import sys
from src.agents.email_agent import get_email_agent
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

logger = AgentLogger("VerifyInvoiceLLM")

async def main():
    agent = get_email_agent()
    supabase = get_supabase_connector()
    
    # Message IDs for the problematic orders
    # 28772: 19a9c42170d4c3b6
    # 28766: 19a9b6a9b07f95fe
    # 28771: Need to find this one, but let's test the known ones first
    
    # Let's find 28771 first
    from src.connectors.gmail import get_gmail_connector
    gmail = get_gmail_connector()
    msgs = gmail.service.users().messages().list(userId='me', q="28771").execute()
    msg_id_28771 = None
    if 'messages' in msgs:
        for m in msgs['messages']:
            # Get snippet/subject to confirm it's a supplier email
            full = gmail.service.users().messages().get(userId='me', id=m['id']).execute()
            headers = full['payload']['headers']
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), '')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), '')
            if "planetworld" in sender.lower() or "invoice" in subject.lower():
                msg_id_28771 = m['id']
                print(f"Found 28771 candidate: {msg_id_28771} ({subject})")
                break
    
    test_cases = [
        # {"order": "28772", "msg_id": "19a9c42170d4c3b6"},
        {"order": "28766", "msg_id": "19a9b6a9b07f95fe"},
    ]
    
    if msg_id_28771:
        test_cases.append({"order": "28771", "msg_id": msg_id_28771})
    
    print(f"--- Verifying LLM Extraction for: {[t['order'] for t in test_cases]} ---")
    
    for case in test_cases:
        msg_id = case['msg_id']
        order_id = case['order']
        print(f"\nProcessing Order {order_id} (Msg: {msg_id})...")
        
        # 1. Clear log
        try:
            supabase.client.table('email_logs').delete().eq('gmail_message_id', msg_id).execute()
        except:
            pass
            
        # 2. Process
        result = await agent.process_email(msg_id)
        
        # 3. Check Supabase for the updated value
        tracker = await supabase.get_order_tracker(order_id)
        
        with open("verification_result.txt", "a") as f:
            f.write(f"\nOrder {order_id}:\n")
            if tracker:
                f.write(f"  Supplier: {tracker.get('supplier')}\n")
                f.write(f"  Invoice No: {tracker.get('supplier_invoice_no')}\n")
                f.write(f"  Amount: R{tracker.get('supplier_amount')}\n")
                f.write(f"  Status: {tracker.get('supplier_status')}\n")
            else:
                f.write("  Tracker NOT found/updated.\n")
                
    print("Verification complete. Results written to verification_result.txt")

if __name__ == "__main__":
    asyncio.run(main())
