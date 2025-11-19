"""Test full email processing with draft creation."""
import asyncio
from src.agents.email_agent import get_email_agent

async def test():
    print("Processing your test email...")
    agent = get_email_agent()

    # Process the first unread email (your "Where is my order?" email)
    message_id = "19a92db14191ea50"

    print(f"\nProcessing message: {message_id}")
    result = await agent.process_email(message_id)

    print(f"\n===== RESULT =====")
    print(f"Status: {result['status']}")
    if result['status'] == 'success':
        print(f"Category: {result['category']}")
        print(f"Confidence: {result['confidence']}")
        print(f"Draft ID: {result['draft_id']}")
        print(f"\nCheck your Gmail drafts for the response!")
    else:
        print(f"Error: {result.get('error')}")

if __name__ == "__main__":
    asyncio.run(test())
