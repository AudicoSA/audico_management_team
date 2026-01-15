"""Process the specific supplier invoice email for Order 28799.

This script will:
1. Find the supplier invoice email from justin@proaudiosa.com
2. Extract invoice details from the PDF
3. Update Order 28799 in orders_tracker
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
logger = AgentLogger("process_28799")

# Initialize OpenAI
from openai import OpenAI
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


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


def extract_pdf_text(attachment_data: bytes) -> str:
    """Extract text from PDF attachment."""
    try:
        import io
        from PyPDF2 import PdfReader
        
        pdf_file = io.BytesIO(attachment_data)
        reader = PdfReader(pdf_file)
        
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        return text
    except Exception as e:
        logger.error("pdf_extraction_failed", error=str(e))
        return ""


def extract_invoice_details(subject: str, body: str, pdf_text: str):
    """Extract invoice details using AI."""
    import re
    
    combined_text = f"{subject}\n\n{body}\n\n{pdf_text}"
    
    system_prompt = """You are a data extraction assistant for an accounting system.

EXTRACT these fields from the email/invoice text:
- invoice_no: The invoice/sales order number.
- amount: The TOTAL AMOUNT INCLUDING VAT/TAX. 
  - Look for "Total Incl", "Total Due", "Grand Total", "Total Inc".
  - The amount is usually the largest value in the summary section.
- supplier_name: The name of the supplier sending the invoice.

Return JSON only:
{
    "invoice_no": "string or null",
    "amount": number or null,
    "supplier_name": "string or null"
}
"""
    
    user_prompt = f"""Extract invoice details from this text:

{combined_text[:4000]}

Extract invoice details."""
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1
        )
        
        response_text = response.choices[0].message.content.strip()
        
        # Parse JSON
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
        else:
            data = json.loads(response_text)
        
        # Clean amount
        if data.get("amount"):
            if isinstance(data["amount"], str):
                clean_amt = re.sub(r'[^\d.]', '', data["amount"])
                try:
                    data["amount"] = float(clean_amt)
                except:
                    data["amount"] = None
        
        return data
        
    except Exception as e:
        logger.error("invoice_extraction_failed", error=str(e))
        return {}


async def process_order_28799():
    """Process the supplier invoice for Order 28799."""
    
    print("\n" + "="*80)
    print("Processing Supplier Invoice for Order 28799")
    print("="*80 + "\n")
    
    service = get_gmail_service()
    supabase = SupabaseConnector()
    
    # Find the email from justin@proaudiosa.com
    print("1. Searching for supplier invoice email...")
    
    query = "from:justin@proaudiosa.com 28799 newer_than:7d"
    
    results = service.users().messages().list(
        userId="me",
        q=query,
        maxResults=5
    ).execute()
    
    messages = results.get("messages", [])
    
    if not messages:
        print("❌ No email found from justin@proaudiosa.com containing 28799")
        return
    
    print(f"✅ Found {len(messages)} email(s)\n")
    
    # Process the first (most recent) message
    msg_id = messages[0]['id']
    
    msg = service.users().messages().get(
        userId="me",
        id=msg_id,
        format="full"
    ).execute()
    
    headers = msg.get("payload", {}).get("headers", [])
    
    from_email = next((h["value"] for h in headers if h["name"] == "From"), "")
    subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
    
    print(f"From: {from_email}")
    print(f"Subject: {subject}")
    print()
    
    # Extract email body
    payload = msg.get("payload", {})
    body = ""
    
    if "body" in payload and payload["body"].get("data"):
        body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors='ignore')
    
    # Get PDF attachment
    print("2. Extracting PDF attachment...")
    
    parts = payload.get("parts", [])
    pdf_text = ""
    
    for part in parts:
        if part.get("filename") and part.get("filename").endswith(".pdf"):
            filename = part["filename"]
            attachment_id = part["body"].get("attachmentId")
            
            if attachment_id:
                print(f"   Found: {filename}")
                
                attachment = service.users().messages().attachments().get(
                    userId="me",
                    messageId=msg_id,
                    id=attachment_id
                ).execute()
                
                data = base64.urlsafe_b64decode(attachment["data"])
                pdf_text = extract_pdf_text(data)
                
                print(f"   ✅ Extracted {len(pdf_text)} characters from PDF\n")
                break
    
    # Extract invoice details
    print("3. Extracting invoice details using AI...")
    
    invoice_details = extract_invoice_details(subject, body, pdf_text)
    
    print(f"\nExtracted Details:")
    print(f"  Invoice No: {invoice_details.get('invoice_no')}")
    print(f"  Amount (incl VAT): R{invoice_details.get('amount')}")
    print(f"  Supplier: {invoice_details.get('supplier_name')}")
    print()
    
    # Update order tracker
    print("4. Updating Order 28799 in orders_tracker...")
    
    try:
        await supabase.upsert_order_tracker(
            order_no="28799",
            supplier=invoice_details.get('supplier_name') or "Pro Audio SA",
            supplier_invoice_no=invoice_details.get('invoice_no'),
            supplier_amount=invoice_details.get('amount'),
            supplier_status="Invoiced",
            source="agent",
            updates=f"Supplier invoice received from {from_email}"
        )
        
        print("✅ Successfully updated Order 28799!")
        print()
        
        # Verify update
        response = supabase.client.table("orders_tracker").select("*").eq("order_no", "28799").execute()
        
        if response.data:
            order = response.data[0]
            print("Updated Order Details:")
            print(f"  Supplier: {order.get('supplier')}")
            print(f"  Supplier Invoice No: {order.get('supplier_invoice_no')}")
            print(f"  Supplier Amount: R{order.get('supplier_amount')}")
            print(f"  Supplier Status: {order.get('supplier_status')}")
            print(f"  Updates: {order.get('updates')}")
        
        # Mark email as processed
        print("\n5. Marking email as processed...")
        service.users().messages().modify(
            userId="me",
            id=msg_id,
            body={"addLabelIds": [], "removeLabelIds": ["UNREAD"]}
        ).execute()
        print("✅ Email marked as read")
        
    except Exception as e:
        print(f"❌ Error updating order: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*80)
    print("Processing Complete!")
    print("="*80 + "\n")


if __name__ == "__main__":
    asyncio.run(process_order_28799())
