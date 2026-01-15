
import os
import sys
import json
import re
from pathlib import Path
from dotenv import load_dotenv

# Setup path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.gmail import get_gmail_connector
from utils.logging import AgentLogger, setup_logging

load_dotenv()
setup_logging()
from openai import OpenAI
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def classify_email(from_email: str, subject: str, body: str):
    print("\n--- CLASSIFYING ---")
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

IMPORTANT RULES:
1. TRUE for: "Tax Invoice", "Proforma Invoice", "Invoice", "Statement" (if it contains new invoice details).
2. FALSE for: "Order Confirmation", "Sales Order", "Quote", "Delivery Note", "Payment Receipt".
3. If the email is just confirming an order was placed, return FALSE.
4. If it contains a "Proforma Invoice" attachment or text, return TRUE.
"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an email classification assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        content = response.choices[0].message.content.strip()
        print(f"RAW CLASSIFICATION: {content}")
        
        # Clean JSON
        if content.startswith('```'):
            content = re.sub(r'```json?\s*', '', content)
            content = re.sub(r'```\s*$', '', content)
            
        return json.loads(content)
    except Exception as e:
        print(f"Classification Error: {e}")
        return {}

def extract_invoice_data(from_email: str, subject: str, body: str, supplier_name: str):
    print("\n--- EXTRACTING ---")
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
- **Order Number Rules:**
    - Audico order numbers are typically 5 or 6 digits (e.g., 28757, 900009).
    - If you see a number in parentheses like "(900009)", THAT is the order number.
    - Ignore long alphanumeric strings like "ORD159582-01" if a 5-6 digit number is present.
- **Amount Rules:**
    - Look for "Total", "Amount Due", "Grand Total".
    - Invoice amount should be the TOTAL amount to be paid.
    - Exclude VAT breakdowns, just get the final total.
- Return null if information cannot be found.
- DO NOT extract amounts from "Order Confirmation" or "Quote" emails unless they are explicitly Proforma Invoices.
"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an assistant. Extract info."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        content = response.choices[0].message.content.strip()
        print(f"RAW EXTRACTION: {content}")
        
        # Clean JSON
        if content.startswith('```'):
            content = re.sub(r'```json?\s*', '', content)
            content = re.sub(r'```\s*$', '', content)
            
        return json.loads(content)
    except Exception as e:
        print(f"Extraction Error: {e}")
        return {}

def main():
    connector = get_gmail_connector()
    query = "subject:ORD159956"
    
    print(f"Searching for: {query}")
    
    # Use raw service to search freely
    results = connector.service.users().messages().list(userId="me", q=query, maxResults=10).execute()
    messages = results.get("messages", [])
    
    print(f"Found {len(messages)} messages.")
    
    if not messages:
        # Try broader search
        query = "subject:ORD159956-01"
        print(f"Retrying with: {query}")
        results = connector.service.users().messages().list(userId="me", q=query, maxResults=5).execute()
        messages = results.get("messages", [])
        print(f"Found {len(messages)} messages.")

    if not messages:
        return

    for msg in messages:
        print(f"\nProcessing ID: {msg['id']}")
        # Get full message
        message = connector.service.users().messages().get(userId="me", id=msg['id'], format="full").execute()
        
        payload = message.get("payload", {})
        headers = payload.get("headers", [])
        
        subject = next((h["value"] for h in headers if h["name"]=="Subject"), "No Subject")
        from_email = next((h["value"] for h in headers if h["name"]=="From"), "Unknown")
        
        print(f"Subject: {subject}")
        print(f"From: {from_email}")
        
        # Simple body extraction for debug
        body = ""
        if "body" in payload and payload["body"].get("data"):
            import base64
            body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8")
        else:
            parts = payload.get("parts", [])
            for p in parts:
                 if p["mimeType"] == "text/plain":
                      if p["body"].get("data"):
                           import base64
                           body = base64.urlsafe_b64decode(p["body"]["data"]).decode("utf-8")
                           break
        
        # Attachments?
        attachments = connector.get_attachments(msg['id'])
        if attachments:
            print("Has attachments! Adding text...")
            body += "\n\n--- ATTACHMENTS ---\n"
            for att in attachments:
                body += att.get("text", "")
        
        print(f"Body snippet: {body[:100]}...")
        
        # Classify
        classification = classify_email(from_email, subject, body)
        print(f"Classification: {classification}")
        
        if classification.get("is_supplier_invoice"):
            data = extract_invoice_data(from_email, subject, body, classification.get("supplier_name"))
            print(f"Extraction: {data}")
        else:
            print("SKIPPED: Not identified as supplier invoice.")

if __name__ == "__main__":
    main()
