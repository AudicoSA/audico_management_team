"""Diagnose why Order 28799 supplier invoice was not added to orders_tracker.

This script:
1. Searches Gmail for emails containing "28799"
2. Checks if Order 28799 exists in orders_tracker
3. Checks email_logs for any processed emails about this order
4. Provides recommendations
"""
import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv
import json
import base64
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.supabase import SupabaseConnector
from utils.logging import AgentLogger, setup_logging

load_dotenv()
setup_logging()
logger = AgentLogger("order_28799_diagnostic")


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


async def diagnose_order_28799():
    """Run full diagnostic for Order 28799."""
    
    print("\n" + "="*80)
    print("DIAGNOSTIC REPORT: Order 28799 - Missing Supplier Invoice")
    print("="*80 + "\n")
    
    # 1. Check if order exists in database
    print("1. Checking orders_tracker database...")
    print("-" * 80)
    
    supabase = SupabaseConnector()
    
    try:
        response = supabase.client.table("orders_tracker").select("*").eq("order_no", "28799").execute()
        
        if response.data:
            print("✅ Order 28799 EXISTS in orders_tracker")
            print("\nCurrent data:")
            order = response.data[0]
            print(f"  Order Name: {order.get('order_name')}")
            print(f"  Supplier: {order.get('supplier')}")
            print(f"  Supplier Invoice No: {order.get('supplier_invoice_no')}")
            print(f"  Supplier Amount: {order.get('supplier_amount')}")
            print(f"  Supplier Status: {order.get('supplier_status')}")
            print(f"  Updates: {order.get('updates')}")
            print(f"  Last Updated: {order.get('updated_at')}")
        else:
            print("❌ Order 28799 DOES NOT EXIST in orders_tracker")
            print("   This order needs to be created first!")
    except Exception as e:
        print(f"❌ Error checking database: {e}")
    
    print("\n" + "-" * 80 + "\n")
    
    # 2. Search Gmail for emails containing 28799
    print("2. Searching Gmail for emails containing '28799'...")
    print("-" * 80)
    
    try:
        service = get_gmail_service()
        
        # Search last 14 days
        query = "28799 newer_than:14d"
        
        results = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=20
        ).execute()
        
        messages = results.get("messages", [])
        
        print(f"Found {len(messages)} emails containing '28799' in last 14 days\n")
        
        if messages:
            for idx, msg_ref in enumerate(messages, 1):
                msg = service.users().messages().get(
                    userId="me",
                    id=msg_ref['id'],
                    format="full"
                ).execute()
                
                headers = msg.get("payload", {}).get("headers", [])
                
                from_email = next((h["value"] for h in headers if h["name"] == "From"), "")
                subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
                date = next((h["value"] for h in headers if h["name"] == "Date"), "")
                
                # Check labels
                labels = msg.get("labelIds", [])
                
                print(f"\nEmail #{idx}:")
                print(f"  Message ID: {msg_ref['id']}")
                print(f"  From: {from_email}")
                print(f"  Subject: {subject}")
                print(f"  Date: {date}")
                print(f"  Labels: {', '.join(labels)}")
                
                # Check if it has attachments
                payload = msg.get("payload", {})
                parts = payload.get("parts", [])
                attachments = [p for p in parts if p.get("filename")]
                if attachments:
                    print(f"  Attachments: {', '.join([a['filename'] for a in attachments])}")
                
                # Check if processed
                if "agent_processed" in labels:
                    print("  ✅ Marked as agent_processed")
                if "supplier_invoice" in labels:
                    print("  ✅ Marked as supplier_invoice")
                
        else:
            print("❌ No emails found containing '28799'")
            
    except Exception as e:
        print(f"❌ Error searching Gmail: {e}")
    
    print("\n" + "-" * 80 + "\n")
    
    # 3. Check email_logs table
    print("3. Checking email_logs for Order 28799...")
    print("-" * 80)
    
    try:
        # Search for emails that might contain this order number
        response = supabase.client.table("email_logs").select("*").ilike("subject", "%28799%").execute()
        
        if response.data:
            print(f"✅ Found {len(response.data)} email log(s) with '28799' in subject\n")
            for log in response.data:
                print(f"  Gmail Message ID: {log.get('gmail_message_id')}")
                print(f"  From: {log.get('from_email')}")
                print(f"  Subject: {log.get('subject')}")
                print(f"  Category: {log.get('category')}")
                print(f"  Status: {log.get('status')}")
                print(f"  Handled By: {log.get('handled_by_agent')}")
                print(f"  Created At: {log.get('created_at')}")
                print()
        else:
            print("❌ No email_logs found with '28799' in subject")
            
    except Exception as e:
        print(f"❌ Error checking email_logs: {e}")
    
    print("\n" + "="*80)
    print("RECOMMENDATIONS:")
    print("="*80 + "\n")
    
    # Provide recommendations based on findings
    if not response.data:
        print("1. Order 28799 does not exist in orders_tracker")
        print("   → You need to create this order first before invoice can be added")
        print("   → Check if the order exists in OpenCart and sync it")
        print()
    
    print("2. To manually process the supplier invoice email:")
    print("   → Run: python process_invoice_emails.py --query '28799 newer_than:14d' --max 5")
    print()
    
    print("3. To manually update the order:")
    print("   → Create a script to upsert Order 28799 with invoice details")
    print()
    
    print("4. Check if the email agent is running:")
    print("   → The email agent should automatically process supplier invoices")
    print("   → Check Railway logs or run locally: python -m src.agents.email_agent")
    print()


if __name__ == "__main__":
    asyncio.run(diagnose_order_28799())
