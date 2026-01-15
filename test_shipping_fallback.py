
import asyncio
import logging
from src.agents.orders_agent import get_orders_agent
from src.utils.logging import setup_logging

# Setup console logging
setup_logging()

async def test_fallback():
    agent = get_orders_agent()
    
    # Payload for Divglo (Collection) -> Durban (Delivery)
    # We suspect this route lacks "ECO"
    payload = {
        "action": "create_shipment",
        "order_id": "900060", # Dummy or real ID
        "dry_run": True,
        "supplier_invoice": "TEST-FALLBACK",
        "collection_address": {
            "company": "Divglo imports",
            "street_address": "7 Dabchick Street,dalpark ext 1",
            "local_area": "Dalpark",
            "city": "Brakpan",
            "code": "1543",
            "country_code": "ZA"
        },
        "delivery_address": {
             "street_address": "21 Swapo Road",
             "local_area": "Durban North",
             "city": "Durban",
             "code": "4051",
             "country_code": "ZA"
        }
    }
    
    # We need to inject dummy parcels as they are usually fetched from DB by ID
    # But agent.run fetches order from DB. 
    # To test pure agent logic without DB order dependency, we might need to mock or ensure Order 900060 exists or use a robust method.
    # Actually, looking at `orders_agent.py` line 76: `order = self.connector.get_order(order_id)`
    # So we need a valid order ID. 
    # Let's use 900052 (Balanced Audio order) but override the collection address in the payload.
    # The agent uses `payload.get("collection_address")` if provided (line 89).
    
    payload["order_id"] = "900052"
    
    print("Running create_shipment for Divglo -> Durban (Expect Fallback)...")
    try:
        result = await agent.run(payload)
        
        print("\nResult:")
        print(result)
        
        shipment = result.get("shipment", {})
        if shipment:
            svc = shipment.get("service_level_code")
            print(f"\n✅ SUCCESS: Shipment created with Service Level: {svc}")
            if svc != "ECO":
                print("   (Fallback successfully triggered)")
            else:
                print("   (ECO was available, so fallback not needed but logic held)")
        else:
             print("\n❌ FAILURE: No shipment returned.")
             
    except Exception as e:
        print(f"\n❌ CRASHED: {e}")

if __name__ == "__main__":
    asyncio.run(test_fallback())
