
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import json

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.supabase import SupabaseConnector
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from openai import OpenAI
import base64

load_dotenv()
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_gmail_service():
    client_secret_file = Path(__file__).parent / "client_secret_2_261944794374-odd129phrcv8l0k4nd5l9c3qokukesj9.apps.googleusercontent.com.json"
    with open(client_secret_file, 'r') as f:
        client_data = json.load(f)
        client_id = client_data['web']['client_id']
        client_secret = client_data['web']['client_secret']

    creds = Credentials(
        token=None,
        refresh_token=os.getenv('GMAIL_REFRESH_TOKEN'),
        client_id=client_id,
        client_secret=client_secret,
        token_uri="https://oauth2.googleapis.com/token",
    )
    creds.refresh(Request())
    return build("gmail", "v1", credentials=creds)

def extract_email_body(payload):
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

def check_order():
    print("Checking Supabase for order 900067...")
    supabase = SupabaseConnector()
    response = supabase.client.table("orders_tracker").select("*").eq("order_no", "900067").execute()
    if response.data:
        print(f"Order found: {json.dumps(response.data[0], indent=2)}")
    else:
        print("Order 900067 NOT found in Supabase.")

def check_emails():
    print("\nSearching Gmail for '900067'...")
    service = get_gmail_service()
    results = service.users().messages().list(userId="me", q="900067").execute()
    messages = results.get("messages", [])
    
    if not messages:
        print("No emails found with '900067'.")
        return

    print(f"Found {len(messages)} emails.")
    for msg_ref in messages:
        msg = service.users().messages().get(userId="me", id=msg_ref['id'], format="full").execute()
        headers = msg['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), '(no subject)')
        from_email = next((h['value'] for h in headers if h['name'] == 'From'), '(unknown)')
        print(f"\nEmail ID: {msg_ref['id']}")
        print(f"Subject: {subject}")
        print(f"From: {from_email}")
        
        body = extract_email_body(msg['payload'])
        print(f"Body snippet: {body[:200]}...")

        # AI Check
        print("Running AI classification...")
        prompt = f"Is this a supplier invoice? Subject: {subject}. Body: {body[:500]}"
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}]
            )
            print(f"AI Opinion: {response.choices[0].message.content}")
        except Exception as e:
            print(f"AI Check failed: {e}")

if __name__ == "__main__":
    check_order()
    try:
        check_emails()
    except Exception as e:
        print(f"Email check failed: {e}")
