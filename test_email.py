"""Test email polling step by step for debugging."""
import asyncio
from src.agents.email_agent import get_email_agent

async def test_poll():
    print("1. Creating email agent...")
    agent = get_email_agent()
    print("   OK - Agent created")

    print("\n2. Polling for emails...")
    try:
        result = await agent.poll_and_process()
        print(f"   OK - Poll completed: {result}")
    except Exception as e:
        print(f"   ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_poll())
