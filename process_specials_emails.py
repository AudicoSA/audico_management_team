"""
Process supplier specials emails and update supplier_specials table.

This script:
1. Fetches emails with "Special", "Promotion", "Pricelist" in subject.
2. Identifies attachments (Excel/PDF).
3. Extracts product deals using Pandas (Excel) or AI (PDF).
4. Updates supplier_specials in Supabase.
"""

import os
import sys
import re
import json
import asyncio
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8')
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import base64

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.supabase import SupabaseConnector
from utils.logging import AgentLogger, setup_logging

# Load environment variables
load_dotenv()

# Setup logging
setup_logging()
logger = AgentLogger("specials_processor")

# Initialize OpenAI
from openai import OpenAI
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def get_gmail_service():
    """Build Gmail API service using credentials."""
    # Load client secret
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


def get_attachments(service, msg_id: str) -> list[Dict[str, Any]]:
    """Download email attachments."""
    attachments = []
    
    try:
        message = service.users().messages().get(
            userId="me",
            id=msg_id,
            format="full"
        ).execute()
        
        payload = message.get("payload", {})
        parts = payload.get("parts", [])
        
        for part in parts:
            if part.get("filename") and part.get("body", {}).get("attachmentId"):
                filename = part["filename"]
                attachment_id = part["body"]["attachmentId"]
                mime_type = part.get("mimeType", "")
                
                # Check for Excel or PDF
                if not (filename.lower().endswith(('.xlsx', '.xls', '.pdf'))):
                    continue

                print(f"  → Downloading attachment: {filename}")
                
                attachment = service.users().messages().attachments().get(
                    userId="me",
                    messageId=msg_id,
                    id=attachment_id
                ).execute()
                
                data = base64.urlsafe_b64decode(attachment["data"])
                
                attachments.append({
                    "filename": filename,
                    "data": data,
                    "mime_type": mime_type
                })
        
        return attachments
    except Exception as e:
        logger.error("attachment_download_failed", error=str(e))
        return []



async def process_emails(query: str = "subject:Promotion OR subject:Special"):
    """Main processing loop."""
    print(f"\nProcessing Specials Emails...")
    print(f"Query: {query}\n")
    
    from src.agents.specials_agent import get_specials_agent
    agent = get_specials_agent()

    service = get_gmail_service()
    
    # Check emails
    results = service.users().messages().list(userId="me", q=query, maxResults=10).execute()
    messages = results.get("messages", [])
    
    print(f"Found {len(messages)} matching emails\n")
    
    for msg_ref in messages:
        try:
            msg = service.users().messages().get(userId="me", id=msg_ref['id'], format="full").execute()
            headers = msg.get("payload", {}).get("headers", [])
            
            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
            from_email = next((h["value"] for h in headers if h["name"] == "From"), "Unknown")
            
            print(f"{'='*60}")
            print(f"Subject: {subject}")
            print(f"From: {from_email}")
            
            # TODO: Extract supplier name from email/AI
            supplier = "Unknown" 
            if "Planetworld" in subject or "Planetworld" in from_email:
                supplier = "Planetworld"
            elif "TAD" in subject:
                supplier = "TAD"
            
            # Get Attachments
            attachments = get_attachments(service, msg_ref['id'])
            
            for att in attachments:
                filename = att["filename"]
                data = att["data"]
                
                # Save to temp
                temp_path = Path("temp") / filename
                temp_path.parent.mkdir(exist_ok=True)
                
                with open(temp_path, "wb") as f:
                    f.write(data)
                
                print(f"  → Saved to {temp_path}")
                
                # Use Agent
                print(f"  → running Agent on {filename}...")
                result = await agent.ingest_flyer(str(temp_path), supplier_name=supplier)
                
                if result.get("status") == "success":
                   print(f"  ✓ Success! {result.get('deals_count')} deals found.")
                else:
                   print(f"  ✗ Failed: {result.get('message')}")
                   
        except Exception as e:
            print(f"Error processing email {msg_ref['id']}: {e}")
            import traceback
            traceback.print_exc()
            
    print("\nDone.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", default="subject:Promotion OR subject:Special")
    args = parser.parse_args()
    
    asyncio.run(process_emails(query=args.query))
