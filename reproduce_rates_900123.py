
import asyncio
from src.connectors.shiplogic import get_shiplogic_connector

async def test_rates():
    connector = get_shiplogic_connector()
    
    # Collection Address (Standard)
    collection_address = {
        "company": "Audico Online",
        "street_address": "123 Example Street",
        "local_area": "Sandton",
        "city": "Johannesburg",
        "code": "2000",
        "country_code": "ZA"
    }

    # Base Delivery Address from Order 900123
    base_delivery = {
        "company": "",
        "street_address": "16 Nicolaas Cleef De Zalze Golf Estate",
        "city": "Stellenbosch",
        "code": "7600",
        "country_code": "ZA"
    }
    
    parcels = [{
        "parcel_description": "Standard Box",
        "submitted_weight_kg": 2.0,
        "submitted_height_cm": 10,
        "submitted_length_cm": 20,
        "submitted_width_cm": 15,
    }]

    variations = [
        ("Current Logic (Stellenbosch)", "Stellenbosch"),
        ("Suburb from Address 2 (De Zalze Golf Estate)", "De Zalze Golf Estate"),
        ("Suburb from Address 2 (De Zalze)", "De Zalze"),
        ("Broad Suburb (Stellenbosch Central)", "Stellenbosch Central")
    ]

    print("Testing Shiplogic Rates for 900123...\n")

    for name, area in variations:
        delivery_address = base_delivery.copy()
        delivery_address["local_area"] = area
        
        print(f"--- Testing: {name} [local_area='{area}'] ---")
        try:
            rates = await connector.get_rates(
                collection_address, 
                delivery_address, 
                parcels
            )
            print(f"Result: Success! Found {len(rates)} rates.")
            for r in rates[:1]:
                print(f"  Sample: {r.get('service_level', {}).get('name')} - R{r.get('total')}")
        except Exception as e:
             print(f"Result: Failed. Error: {e}")
        print("")

    await connector.close()

if __name__ == "__main__":
    asyncio.run(test_rates())
