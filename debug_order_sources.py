import sys
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.connectors.supabase import SupabaseConnector
from src.utils.logging import setup_logging

setup_logging()

def debug_sources():
    connector = SupabaseConnector()
    search_terms = ["575757", "28771"]
    
    print(f"Searching email_logs for: {search_terms}")
    
    for term in search_terms:
        print(f"\n--- Searching for {term} ---")
        
        # Search in subject
        try:
            response = connector.client.table("email_logs").select("id, subject, from_email, created_at, payload").ilike("subject", f"%{term}%").execute()
            if response.data:
                print(f"Found {len(response.data)} emails with '{term}' in SUBJECT:")
                for email in response.data:
                    print(f"  ID: {email['id']}")
                    print(f"  Subject: {email['subject']}")
                    print(f"  From: {email['from_email']}")
                    print(f"  Payload: {json.dumps(email.get('payload', {}), indent=2)}")
            else:
                print(f"No emails with '{term}' in SUBJECT.")
        except Exception as e:
            print(f"Error searching subject: {e}")

        # Search in payload (if possible, though ilike on jsonb is tricky, usually we cast to text)
        # We'll just fetch recent logs and check python-side if needed, or rely on subject/body search if we had full text search.
        # Let's try to search where payload->>'order_numbers' contains the term
        
        try:
            # This assumes payload has order_numbers as a list or string
            # Supabase/Postgres JSONB query: payload->'order_numbers' ? '575757'
            # But the connector might not expose raw queries easily.
            # Let's try a text search on the payload column if cast is supported, or just fetch recent logs.
            pass
        except Exception:
            pass

if __name__ == "__main__":
    debug_sources()
