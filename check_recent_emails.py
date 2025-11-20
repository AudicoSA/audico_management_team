"""Check what emails are in the Gmail inbox."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import json
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

def check_recent_emails():
    service = get_gmail_service()
    
    # Check emails from last 2 hours
    results = service.users().messages().list(
        userId="me",
        q="newer_than:2h",
        maxResults=10
    ).execute()
    
    messages = results.get("messages", [])
    
    print(f"\nFound {len(messages)} emails from last 2 hours:\n")
    print("=" * 80)
    
    for msg_ref in messages:
        msg = service.users().messages().get(
            userId="me",
            id=msg_ref['id'],
            format="metadata",
            metadataHeaders=["From", "Subject", "Date"]
        ).execute()
        
        headers = msg.get("payload", {}).get("headers", [])
        
        from_email = next((h["value"] for h in headers if h["name"] == "From"), "")
        subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
        date = next((h["value"] for h in headers if h["name"] == "Date"), "")
        
        print(f"From: {from_email}")
        print(f"Subject: {subject}")
        print(f"Date: {date}")
        print("-" * 80)

if __name__ == "__main__":
    check_recent_emails()
