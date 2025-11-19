"""Test processing a single email."""
import asyncio
from src.connectors.gmail import get_gmail_connector

async def test():
    print("Fetching unread messages...")
    gmail = get_gmail_connector()

    message_ids = gmail.list_unread_messages(max_results=1)

    if not message_ids:
        print("No unread messages found")
        return

    message_id = message_ids[0]
    print(f"Found message: {message_id}")

    email = gmail.get_message(message_id)
    print(f"Subject: {email.subject}")
    print(f"From: {email.from_email}")
    print(f"Body preview: {email.body[:200]}...")

    # Now test classification
    print("\nTesting LLM classification...")
    from src.models.llm_client import classify_email

    result = await classify_email(email.body, email.subject)
    print(f"Classification result: {result}")

if __name__ == "__main__":
    asyncio.run(test())
