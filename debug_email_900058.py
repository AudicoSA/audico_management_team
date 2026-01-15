
import asyncio
import os
import logging
from src.agents.email_agent import get_email_agent
from src.connectors.gmail import get_gmail_connector
from process_invoice_emails import classify_email, extract_invoice_data

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("debug_email")

def main():
    connector = get_gmail_connector()
    query = "subject:(900058)"
    
    print(f"Searching for: {query}")
    results = connector.service.users().messages().list(userId="me", q=query, maxResults=5).execute()
    messages = results.get("messages", [])
    
    print(f"Found {len(messages)} messages.")
    
    for msg in messages:
        msg_detail = connector.service.users().messages().get(userId="me", id=msg['id'], format='full').execute()
        headers = msg_detail['payload']['headers']
        
        subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), "No Subject")
        from_email = next((h['value'] for h in headers if h['name'].lower() == 'from'), "Unknown")
        snippet = msg_detail.get('snippet', '')
        
        print(f"\n--- Processing: {subject} ---")
        print(f"From: {from_email}")
        print(f"Snippet: {snippet}")
        
        # Get body (simplified)
        body = snippet # Use snippet for quick debug or full body if needed
        # (For accurate classification we should use full body logic like in process_invoice_emails.py, 
        # but snippet often gives a clue. Let's try to get full text if we can easily, usually buried in parts)
        
        # ... Trying to reuse the logic from process_invoice_emails.py would be best, 
        # but let's just call the classification function with what we have.
        
        # Get full body content
        parts = msg_detail['payload'].get('parts', [])
        full_body = snippet
        for part in parts:
            if part.get('mimeType') == 'text/plain':
                import base64
                data = part['body'].get('data')
                if data:
                    full_body = base64.urlsafe_b64decode(data).decode()
                    break
        
        print("\n[AI Classification Analysis]")
        classification = classify_email(from_email, subject, full_body)
        print(f"Result: {classification}")
        
        if classification.get("is_supplier_invoice"):
            print("[AI Extraction Analysis]")
            extraction = extract_invoice_data(from_email, subject, full_body, classification.get("supplier_name"))
            print(f"Result: {extraction}")

if __name__ == "__main__":
    main()
