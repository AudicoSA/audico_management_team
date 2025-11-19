"""Test that supplier emails are being logged for future processing."""
import asyncio
from src.connectors.supabase import get_supabase_connector

async def check_supplier_emails():
    print("Checking supplier emails in database...\n")

    supabase = get_supabase_connector()

    # Query 1: Supplier invoices logged for processing
    print("=" * 60)
    print("SUPPLIER INVOICES (For Future Processing):")
    print("=" * 60)
    response = supabase.client.table('email_logs') \
        .select('created_at, from_email, subject, category, status, handled_by_agent') \
        .eq('category', 'SUPPLIER_INVOICE') \
        .eq('status', 'CLASSIFIED') \
        .order('created_at', desc=True) \
        .limit(5) \
        .execute()

    if response.data:
        for email in response.data:
            print(f"From: {email['from_email']}")
            print(f"Subject: {email['subject']}")
            print(f"Status: {email['status']}")
            print(f"Date: {email['created_at']}")
            print("-" * 60)
    else:
        print("No supplier invoices found yet.")

    # Query 2: All supplier communications
    print("\n" + "=" * 60)
    print("ALL SUPPLIER EMAILS (Last 10):")
    print("=" * 60)
    response = supabase.client.table('email_logs') \
        .select('created_at, from_email, subject, category, status') \
        .in_('category', ['SUPPLIER_INVOICE', 'SUPPLIER_PRICELIST', 'SUPPLIER_COMMUNICATION']) \
        .order('created_at', desc=True) \
        .limit(10) \
        .execute()

    if response.data:
        for email in response.data:
            print(f"From: {email['from_email']}")
            print(f"Subject: {email['subject']}")
            print(f"Category: {email['category']}")
            print(f"Status: {email['status']}")
            print(f"Date: {email['created_at']}")
            print("-" * 60)
    else:
        print("No supplier emails logged yet.")

    # Query 3: Agent logs for supplier emails
    print("\n" + "=" * 60)
    print("AGENT LOGS - SUPPLIER EMAILS:")
    print("=" * 60)
    response = supabase.client.table('agent_logs') \
        .select('created_at, event_type, context') \
        .eq('event_type', 'supplier_email_logged') \
        .order('created_at', desc=True) \
        .limit(5) \
        .execute()

    if response.data:
        for log in response.data:
            ctx = log.get('context', {})
            print(f"From: {ctx.get('from_email')}")
            print(f"Subject: {ctx.get('subject')}")
            print(f"Category: {ctx.get('category')}")
            print(f"Has Attachments: {ctx.get('has_attachments')}")
            print(f"Requires Processing: {ctx.get('requires_future_processing')}")
            print(f"Date: {log['created_at']}")
            print("-" * 60)
    else:
        print("No supplier emails logged yet.")

if __name__ == "__main__":
    asyncio.run(check_supplier_emails())
