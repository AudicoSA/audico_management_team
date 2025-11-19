"""Check all logged emails."""
from src.connectors.supabase import get_supabase_connector

supabase = get_supabase_connector()

print("=" * 70)
print("ALL LOGGED EMAILS (Last 20):")
print("=" * 70)

response = supabase.client.table('email_logs') \
    .select('created_at, from_email, subject, category, status, handled_by_agent') \
    .order('created_at', desc=True) \
    .limit(20) \
    .execute()

for email in response.data:
    print(f"From: {email['from_email']}")
    print(f"Subject: {email['subject'][:60]}...")
    print(f"Category: {email['category']}")
    print(f"Status: {email['status']}")
    print(f"Handler: {email.get('handled_by_agent', 'N/A')}")
    print(f"Date: {email['created_at']}")
    print("-" * 70)

print(f"\nTotal emails logged: {len(response.data)}")

# Count by category
print("\n" + "=" * 70)
print("EMAILS BY CATEGORY:")
print("=" * 70)

response = supabase.client.table('email_logs') \
    .select('category') \
    .execute()

from collections import Counter
categories = Counter([e['category'] for e in response.data])

for category, count in categories.most_common():
    print(f"{category}: {count}")
