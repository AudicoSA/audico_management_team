"""Check for other unprocessed supplier invoice emails.

This script searches for recent unread emails that might be supplier invoices.
"""
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


def check_unprocessed_invoices():
    """Check for unprocessed supplier invoice emails."""
    
    print("\n" + "="*80)
    print("Checking for Unprocessed Supplier Invoice Emails")
    print("="*80 + "\n")
    
    service = get_gmail_service()
    
    # Search for unread emails from last 7 days
    query = "is:unread newer_than:7d"
    
    results = service.users().messages().list(
        userId="me",
        q=query,
        maxResults=50
    ).execute()
    
    messages = results.get("messages", [])
    
    print(f"Found {len(messages)} unread emails from last 7 days\n")
    
    if not messages:
        print("✅ No unread emails found")
        return
    
    # Keywords that might indicate supplier invoices
    invoice_keywords = [
        "invoice", "proforma", "quote", "quotation", "order",
        "SO", "PO", "sales order", "purchase order"
    ]
    
    potential_invoices = []
    
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
        
        # Check if it has PDF attachments
        payload = msg.get("payload", {})
        parts = payload.get("parts", [])
        pdf_attachments = [p["filename"] for p in parts if p.get("filename", "").endswith(".pdf")]
        
        # Check if subject contains invoice keywords
        subject_lower = subject.lower()
        has_invoice_keyword = any(keyword in subject_lower for keyword in invoice_keywords)
        
        # Skip if from audicoonline.co.za (internal)
        if "audicoonline.co.za" in from_email:
            continue
        
        # Check if it looks like a supplier invoice
        if (has_invoice_keyword or pdf_attachments) and "@" in from_email:
            potential_invoices.append({
                "message_id": msg_ref['id'],
                "from": from_email,
                "subject": subject,
                "date": date,
                "attachments": pdf_attachments
            })
    
    if potential_invoices:
        print(f"⚠️  Found {len(potential_invoices)} potential supplier invoices:\n")
        
        for idx, email in enumerate(potential_invoices, 1):
            print(f"{idx}. From: {email['from']}")
            print(f"   Subject: {email['subject']}")
            print(f"   Date: {email['date']}")
            if email['attachments']:
                print(f"   Attachments: {', '.join(email['attachments'])}")
            print()
    else:
        print("✅ No potential supplier invoices found in unread emails")
    
    print("="*80)
    print("\nRecommendation:")
    print("Run: python process_invoice_emails.py --query 'is:unread newer_than:7d' --max 50")
    print("="*80 + "\n")


if __name__ == "__main__":
    check_unprocessed_invoices()
