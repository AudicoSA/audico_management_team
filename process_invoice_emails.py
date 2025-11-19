"""
Process supplier invoice emails and update orders_tracker.

This script:
1. Fetches emails from support@audicoonline.co.za
2. Identifies supplier invoices using AI
3. Extracts invoice data (order number, amount, reference)
4. Updates orders_tracker in Supabase
"""

import os
import sys
import re
from pathlib import Path
from typing import Dict, Any, Optional
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
logger = AgentLogger("invoice_processor")

# Initialize OpenAI
from openai import OpenAI
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def get_gmail_service():
    """Build Gmail API service using credentials."""
    import json

    # Load client secret
    client_secret_file = Path(__file__).parent / "client_secret_2_261944794374-odd129phrcv8l0k4nd5l9c3qokukesj9.apps.googleusercontent.com.json"

    with open(client_secret_file, 'r') as f:
        client_data = json.load(f)
        client_id = client_data['web']['client_id']
        client_secret = client_data['web']['client_secret']

    refresh_token = os.getenv('GMAIL_REFRESH_TOKEN')

    # Create credentials
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        client_id=client_id,
        client_secret=client_secret,
        token_uri="https://oauth2.googleapis.com/token",
    )

    # Refresh to get access token
    creds.refresh(Request())

    # Build Gmail API service
    return build("gmail", "v1", credentials=creds)


def extract_email_body(payload: Dict) -> str:
    """Extract email body from Gmail payload."""
    if "body" in payload and payload["body"].get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors='ignore')

    # Handle multi-part messages
    parts = payload.get("parts", [])
    for part in parts:
        if part["mimeType"] == "text/plain" and part["body"].get("data"):
            return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors='ignore')

    # Fallback to HTML
    for part in parts:
        if part["mimeType"] == "text/html" and part["body"].get("data"):
            html = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors='ignore')
            return html

    return ""


def extract_header(headers, name: str) -> Optional[str]:
    """Extract header value by name."""
    for header in headers:
        if header["name"].lower() == name.lower():
            return header["value"]
    return None


def classify_email(from_email: str, subject: str, body: str) -> Dict[str, Any]:
    """Use AI to classify if email is a supplier invoice."""
    import json

    prompt = f"""Analyze this email and determine if it's a supplier invoice or quote.

FROM: {from_email}
SUBJECT: {subject}
BODY (first 1000 chars):
{body[:1000]}

Respond in JSON format:
{{
  "is_supplier_invoice": true/false,
  "confidence": "high"/"medium"/"low",
  "supplier_name": "extracted supplier name or null",
  "reason": "brief explanation"
}}
"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an email classification assistant. Extract information accurately and respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )

        response_text = response.choices[0].message.content.strip()

        # Extract JSON from response (handle markdown code blocks)
        json_str = response_text
        if json_str.startswith('```'):
            json_str = re.sub(r'```json?\s*', '', json_str)
            json_str = re.sub(r'```\s*$', '', json_str)

        return json.loads(json_str.strip())
    except Exception as e:
        logger.error("json_parse_failed", error=str(e))
        return {"is_supplier_invoice": False, "confidence": "low", "reason": "Failed to parse response"}


def extract_invoice_data(from_email: str, subject: str, body: str, supplier_name: Optional[str]) -> Optional[Dict[str, Any]]:
    """Use AI to extract invoice data from email."""
    import json

    prompt = f"""Extract invoice information from this supplier email.

FROM: {from_email}
SUBJECT: {subject}
SUPPLIER: {supplier_name or "Unknown"}

EMAIL BODY:
{body[:3000]}

Extract the following information and respond in JSON format:
{{
  "order_number": "the order number (e.g., 28757, #28757, Order 28757) or null if not found",
  "invoice_number": "the invoice/reference number or null",
  "invoice_amount": "the total amount as a number (e.g., 1234.56) or null",
  "currency": "the currency (usually ZAR/R) or null",
  "confidence": "high"/"medium"/"low"
}}

Important:
- Look for patterns like "Order #28757", "Order Number: 28757", "Re: 28757"
- Invoice amount should be the TOTAL amount to be paid
- Exclude VAT breakdowns, just get the final total
- Return null if information cannot be found
"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an invoice data extraction assistant. Extract information accurately and respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )

        response_text = response.choices[0].message.content.strip()

        # Extract JSON from response (handle markdown code blocks)
        json_str = response_text
        if json_str.startswith('```'):
            json_str = re.sub(r'```json?\s*', '', json_str)
            json_str = re.sub(r'```\s*$', '', json_str)

        data = json.loads(json_str.strip())

        # Validate we got useful data
        if data.get('order_number') or data.get('invoice_number'):
            return data
        else:
            logger.warning("no_useful_data_extracted", data=data)
            return None

    except Exception as e:
        logger.error("json_parse_failed", error=str(e))
        return None


def update_order_tracker(order_no: str, invoice_data: Dict[str, Any], supplier_name: Optional[str]) -> bool:
    """Update orders_tracker in Supabase with invoice data."""
    supabase = SupabaseConnector()

    # Check if order exists
    response = supabase.client.table("orders_tracker").select("*").eq("order_no", order_no).execute()

    if not response.data:
        logger.warning("order_not_found", order_no=order_no)
        return False

    # Prepare update data
    update_data = {}

    if supplier_name and not response.data[0].get('supplier'):
        update_data['supplier'] = supplier_name

    if invoice_data.get('invoice_number'):
        update_data['invoice_no'] = invoice_data['invoice_number']

    if invoice_data.get('invoice_amount'):
        update_data['supplier_amount'] = float(invoice_data['invoice_amount'])

    if not update_data:
        logger.info("no_updates_needed", order_no=order_no)
        return False

    # Add tracking info to updates field
    current_updates = response.data[0].get('updates', '')
    new_update = f" | Invoice: {invoice_data.get('invoice_number', 'N/A')} Amount: R{invoice_data.get('invoice_amount', '0')}"
    update_data['updates'] = current_updates + new_update

    # Update order
    try:
        supabase.client.table("orders_tracker").update(update_data).eq("order_no", order_no).execute()
        logger.info("order_updated", order_no=order_no, updates=update_data)
        print(f"  ✓ Updated Order #{order_no}: {update_data}")
        return True
    except Exception as e:
        logger.error("update_failed", order_no=order_no, error=str(e))
        print(f"  ✗ Failed to update Order #{order_no}: {e}")
        return False


async def process_emails(max_emails: int = 20, query: str = "is:unread"):
    """
    Process recent emails looking for supplier invoices.

    Args:
        max_emails: Maximum number of emails to process
        query: Gmail search query (default: unread emails)
    """
    try:
        logger.info("processing_started", max_emails=max_emails, query=query)
        print(f"\nProcessing emails from support@audicoonline.co.za...")
        print(f"Query: {query}")
        print(f"Max emails: {max_emails}\n")

        # Connect to Gmail
        print("Connecting to Gmail...")
        service = get_gmail_service()

        # Fetch emails
        results = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=max_emails
        ).execute()

        messages = results.get("messages", [])

        if not messages:
            print("No messages found")
            logger.info("no_messages")
            return

        print(f"Found {len(messages)} messages\n")
        logger.info("messages_fetched", count=len(messages))

        processed = 0
        invoices_found = 0
        orders_updated = 0

        for msg_ref in messages:
            msg_id = msg_ref['id']

            # Get full message
            message = service.users().messages().get(
                userId="me",
                id=msg_id,
                format="full"
            ).execute()

            payload = message.get("payload", {})
            headers = payload.get("headers", [])

            from_email = extract_header(headers, "From") or ""
            subject = extract_header(headers, "Subject") or "(No Subject)"
            body = extract_email_body(payload)

            print(f"{'='*80}")
            print(f"Email: {subject[:60]}")
            print(f"From: {from_email[:60]}")

            # Classify email
            classification = classify_email(from_email, subject, body)

            if classification.get('is_supplier_invoice'):
                print(f"  → Supplier Invoice Detected (Confidence: {classification.get('confidence')})")
                print(f"  → Supplier: {classification.get('supplier_name')}")
                invoices_found += 1

                # Extract invoice data
                invoice_data = extract_invoice_data(
                    from_email,
                    subject,
                    body,
                    classification.get('supplier_name')
                )

                if invoice_data and invoice_data.get('order_number'):
                    order_no = str(invoice_data['order_number']).strip('#').strip()
                    print(f"  → Order Number: {order_no}")
                    print(f"  → Invoice Number: {invoice_data.get('invoice_number')}")
                    print(f"  → Amount: R{invoice_data.get('invoice_amount')}")

                    # Update order tracker
                    if update_order_tracker(order_no, invoice_data, classification.get('supplier_name')):
                        orders_updated += 1
                else:
                    print(f"  → Could not extract order number")
            else:
                print(f"  → Not a supplier invoice ({classification.get('reason')})")

            processed += 1

        print(f"\n{'='*80}")
        print(f"Processing completed!")
        print(f"{'='*80}")
        print(f"  Emails processed:     {processed}")
        print(f"  Invoices found:       {invoices_found}")
        print(f"  Orders updated:       {orders_updated}")
        print(f"{'='*80}")

        logger.info(
            "processing_completed",
            processed=processed,
            invoices_found=invoices_found,
            orders_updated=orders_updated
        )

    except Exception as e:
        logger.error("processing_failed", error=str(e))
        print(f"\nERROR: Processing failed: {e}")
        import traceback
        traceback.print_exc()
        raise


async def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Process supplier invoice emails")
    parser.add_argument(
        "--max",
        type=int,
        default=20,
        help="Maximum number of emails to process (default: 20)"
    )
    parser.add_argument(
        "--query",
        type=str,
        default="is:unread",
        help="Gmail search query (default: is:unread)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all recent emails, not just unread"
    )

    args = parser.parse_args()

    query = "newer_than:7d" if args.all else args.query

    await process_emails(max_emails=args.max, query=query)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
