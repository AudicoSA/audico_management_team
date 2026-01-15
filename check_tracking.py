
import asyncio
from src.agents.orders_agent import get_orders_agent
from src.utils.logging import AgentLogger

logger = AgentLogger("CheckTracking")

async def check_tracking():
    print("--- Checking Tracking for Order 900067 ---")
    agent = get_orders_agent()
    
    # Try tracking by the Order ID (which is the customer reference)
    # or potentially we need to try TCG900067 if the connector allows
    
    payload = {
        "action": "track_shipment",
        "order_id": "TCG900067-1" 
    }
    
    result = await agent.run(payload)
    print(f"Result: {result}")

if __name__ == "__main__":
    asyncio.run(check_tracking())
