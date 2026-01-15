
import asyncio
import os
import logging
from src.connectors.shiplogic import get_shiplogic_connector
from src.connectors.shiplogic import get_shiplogic_connector

# Suppress JSON logging
logging.basicConfig(level=logging.WARNING, force=True)
logger = logging.getLogger("debug_rates_variants")

async def test_rates():
    connector = get_shiplogic_connector()
    
    # Base DivGlo Address
    collection_base = {
        "company": "Divglo imports",
        "street_address": "7 Dabchick Street,dalpark ext 1",
        "local_area": "Dalpark",
        "city": "Brakpan",
        "code": "1543",
        "country_code": "ZA"
    }
    
    # Scenarios
    scenarios = [
        {
            "name": "Divglo -> Cape Town (Remote)",
            "delivery": {
                "street_address": "123 Main Rd",
                "local_area": "Sea Point",
                "city": "Cape Town",
                "code": "8005",
                "country_code": "ZA"
            }
        },
        {
            "name": "Divglo -> Sandton (Local)",
            "delivery": { # Audico Office
                "street_address": "14 Commerce Crescent",
                "local_area": "Kramerville",
                "city": "Sandton",
                "code": "2090",
                "country_code": "ZA"
            }
        },
        {
            "name": "Divglo -> Brakpan (Same City)",
            "delivery": {
                "street_address": "10 Other Street",
                "local_area": "Brakpan Central",
                "city": "Brakpan",
                "code": "1540",
                "country_code": "ZA"
            }
        },
        {
            "name": "Divglo (Modified Suburb) -> Sandton",
            "modified_collection": {**collection_base, "local_area": "Dalpark Ext 1"},
            "delivery": {
                "street_address": "14 Commerce Crescent",
                "local_area": "Kramerville",
                "city": "Sandton",
                "code": "2090",
                "country_code": "ZA"
            }
        }
    ]
    
    parcels = [{
        "parcel_description": "Standard Box",
        "submitted_weight_kg": 2.0,
        "submitted_height_cm": 10,
        "submitted_length_cm": 20,
        "submitted_width_cm": 15,
    }]
    
    for sc in scenarios:
        print(f"\n##################################################")
        print(f"TESTING SCENARIO: {sc['name']}")
        print(f"##################################################")
        coll = sc.get("modified_collection", collection_base)
        deliv = sc["delivery"]
        
        try:
            rates = await connector.get_rates(coll, deliv, parcels)
            print(f"RATES COUNT: {len(rates)}")
            available_services = []
            for rate in rates:
                print(f" >> SERVICE: {rate['service_level_code']} | COST: {rate['cost']}")
                available_services.append(rate['service_level_code'])
            
            if "ECO" not in available_services:
                print("!! WARNING: 'ECO' service NOT available for this route !!")
                
        except Exception as e:
            print(f"FAILED with Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_rates())
