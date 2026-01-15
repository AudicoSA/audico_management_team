
import asyncio
import json
from src.connectors.opencart import get_opencart_connector

async def inspect():
    oc = get_opencart_connector()
    order_id = "900123"
    print(f"Fetching order {order_id}...")
    
    order = await oc.get_order(order_id)
    
    if not order:
        print("Order not found!")
        return

    print("\n--- Raw Address Data ---")
    fields = [
        "shipping_company", "shipping_address_1", "shipping_address_2", 
        "shipping_city", "shipping_postcode", "shipping_zone", 
        "shipping_country", "shipping_iso_code_2", "shipping_iso_code_3"
    ]
    
    for f in fields:
        print(f"{f}: {order.get(f)}")

    print("\n--- Constructed Address for Shiplogic ---")
    # Simulate the logic in orders_agent.py
    addr1 = order.get("shipping_address_1") or order.get("payment_address_1") or ""
    addr2 = order.get("shipping_address_2") or order.get("payment_address_2") or ""
    street = f"{addr1} {addr2}".strip()
    city = order.get("shipping_city") or order.get("payment_city") or ""
    postcode = order.get("shipping_postcode") or order.get("payment_postcode") or ""
    
    constructed = {
        "company": order.get("shipping_company") or "",
        "street_address": street,
        "local_area": city,
        "city": city,
        "code": postcode,
        "country_code": "ZA" 
    }
    print(json.dumps(constructed, indent=2))

if __name__ == "__main__":
    asyncio.run(inspect())
