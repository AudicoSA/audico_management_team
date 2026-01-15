
import asyncio
import logging
from src.agents.orders_agent import get_orders_agent
from src.utils.logging import setup_logging

setup_logging()

async def verify_fix():
    agent = get_orders_agent()
    
    payload = {
        "action": "create_shipment",
        "order_id": "900058", # The problematic order
        "dry_run": True,
        # No manual collection/delivery address; let it fetch from OpenCart
    }
    
    print("Running create_shipment for Order 900058 (Expect Success)...")
    try:
        result = await agent.run(payload)
        
        print("\nResult:")
        print(result)
        
        if result.get("shipment"):
            print("\n✅ SUCCESS: Shipment created.")
            print(f"Details: {result['shipment']}")
        else:
            print(f"\n❌ FAILURE: {result.get('error')}")

    except Exception as e:
        print(f"\n❌ CRASHED: {e}")

if __name__ == "__main__":
    asyncio.run(verify_fix())
