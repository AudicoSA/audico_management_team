"""Test processing the next unprocessed email."""
import asyncio
from src.agents.email_agent import get_email_agent
from src.connectors.gmail import get_gmail_connector

async def test():
    print("Finding next unprocessed email...")

    gmail = get_gmail_connector()
    agent = get_email_agent()

    # Get unread messages
    message_ids = gmail.list_unread_messages(max_results=10)

    if not message_ids:
        print("No unread messages found. Send a test email to support@audicoonline.co.za")
        return

    # Find first unprocessed one
    for message_id in message_ids:
        already_processed = await agent.supabase.check_email_already_processed(message_id)
        if not already_processed:
            print(f"\nFound unprocessed email: {message_id}")
            email = gmail.get_message(message_id)
            print(f"Subject: {email.subject}")
            print(f"From: {email.from_email}")

            print(f"\nProcessing...")
            result = await agent.process_email(message_id)

            print(f"\n===== RESULT =====")
            print(f"Status: {result['status']}")
            if result['status'] == 'success':
                print(f"Category: {result['category']}")
                print(f"Confidence: {result['confidence']}")
                print(f"Draft ID: {result['draft_id']}")
                print(f"\n✓ Check your Gmail drafts for the auto-generated response!")
            else:
                print(f"Error: {result.get('error')}")
            return

    print("All unread emails have already been processed!")
    print("Send a new test email to support@audicoonline.co.za")

if __name__ == "__main__":
    asyncio.run(test())
