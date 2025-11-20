"""Search Gmail for emails containing specific order number."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import json
import base64
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

load_dotenv()

def get_gmail_service():
    """Build Gmail API service."""
    client_secret_file = Path(__file__).parent / "client_secret_2_261944794374-odd129phrcv8l0k4nd5l9c3qokukesj9.apps.googleusercontent.com.json"
    
    with open(client_secret_file, 'r') as f:
        client_data = json.load(f)
        client_id = client_data['web']['client_id']
        client_secret = client_data['web']['client_secret']
    
    refresh_token = os.getenv('GMAIL_REFRESH_TOKEN')
    
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        client_id=client_id,
        client_secret=client_secret,
        token_uri="https://oauth2.googleapis.com/token",
    )
    
    creds.refresh(Request())
    return build("gmail", "v1", credentials=creds)

def extract_email_body(payload):
    """Extract email body from Gmail payload."""
    if "body" in payload and payload["body"].get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors='ignore')
    
    parts = payload.get("parts", [])
    for part in parts:
        if part["mimeType"] == "text/plain" and part["body"].get("data"):
            return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors='ignore')
    
    for part in parts:
        if part["mimeType"] == "text/html" and part["body"].get("data"):
            return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors='ignore')
    
    return ""

def search_for_order(order_no):
    service = get_gmail_service()
    
    # Search for emails containing the order number
    query = f"{order_no} newer_than:7d"
    
    results = service.users().messages().list(
        userId="me",
        q=query,
        maxResults=10
    ).execute()
    
    messages = results.get("messages", [])
    
    print(f"\nSearching for emails containing '{order_no}' from last 7 days...")
    print(f"Found {len(messages)} emails\n")
    print("=" * 80)
    
    if not messages:
        print("No emails found!")
        return
    
    for msg_ref in messages:
        msg = service.users().messages().get(
            userId="me",
            id=msg_ref['id'],
            format="full"
        ).execute()
        
        headers = msg.get("payload", {}).get("headers", [])
        
        from_email = next((h["value"] for h in headers if h["name"] == "From"), "")
        subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
        date = next((h["value"] for h in headers if h["name"] == "Date"), "")
        
        body = extract_email_body(msg.get("payload", {}))
        
        print(f"From: {from_email}")
        print(f"Subject: {subject}")
        print(f"Date: {date}")
        print(f"\nBody preview (first 500 chars):")
        print(body[:500])
        print("\n" + "=" * 80 + "\n")

if __name__ == "__main__":
    import sys
    order_no = sys.argv[1] if len(sys.argv) > 1 else "28771"
    search_for_order(order_no)
