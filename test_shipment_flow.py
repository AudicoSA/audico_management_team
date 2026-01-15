
import asyncio
import logging
from src.agents.orders_agent import get_orders_agent
from src.utils.logging import setup_logging

# Setup console logging
setup_logging()

async def test_shipment():
    agent = get_orders_agent()
    
    payload = {
        "action": "create_shipment",
        "order_id": "900052", # Using the order ID from user screenshot
        "dry_run": True,
        "supplier_invoice": "TEST-INVOICE-579261",
        "collection_address": {
            "company": "Test Supplier",
            "street_address": "123 Test St",
            "local_area": "Test Area",
            "city": "Test City",
            "code": "1234",
            "country_code": "ZA"
        }
    }
    
    print("Running create_shipment with supplier_invoice='TEST-INVOICE-579261'...")
    result = await agent.run(payload)
    
    print("\nResult:")
    print(result)
    
    if result.get("shipment", {}).get("customer_reference") == "TEST-INVOICE-579261":
        print("\n✅ SUCCESS: Customer reference matches input.")
    else:
        print(f"\n❌ FAILURE: Customer reference is '{result.get('shipment', {}).get('customer_reference')}'")

if __name__ == "__main__":
    asyncio.run(test_shipment())
