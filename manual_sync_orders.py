import sys
from pathlib import Path
import asyncio

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.agents.orders_agent import get_orders_agent
from src.utils.logging import setup_logging

setup_logging()

async def manual_sync():
    print("Manually triggering order sync...")
    agent = get_orders_agent()
    result = await agent.sync_orders()
    print(f"\nSync Result: {result}")

if __name__ == "__main__":
    asyncio.run(manual_sync())
