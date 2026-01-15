
import asyncio
import httpx
import json

async def verify_shipping_api():
    base_url = "http://127.0.0.1:8000"
    async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
        # 1. Check Health with retries
        for i in range(5):
            try:
                print(f"Attempt {i+1} to connect...")
                resp = await client.get("/health")
                if resp.status_code == 200:
                    print(f"Health Check: {resp.status_code} (Connected)")
                    break
            except Exception as e:
                print(f"Connection failed: {e}")
                await asyncio.sleep(2)
        else:
            print("Failed to connect after 5 attempts.")
            return

        # 2. Create Shipment (Dry Run)
        payload = {
            "order_id": "900067",
            "dry_run": True,
            "collection_address": {
                "company": "Test Co",
                "street_address": "123 Test St",
                "city": "Test City",
                "code": "1234",
                "country_code": "ZA"
            }
        }
        
        print("\nTesting /shipments/create...")
        resp = await client.post("/shipments/create", json=payload)
        
        if resp.status_code != 200:
            print(f"Failed: {resp.status_code}")
            print(resp.text)
            return

        result = resp.json()
        print(json.dumps(result, indent=2))
        
        tracking = result.get("shipment", {}).get("tracking_number")
        if tracking == "TCG900067":
            print("\nSUCCESS: Tracking number format verified as 'TCG900067'")
        else:
            print(f"\nFAILURE: Expected 'TCG900067', got '{tracking}'")

if __name__ == "__main__":
    asyncio.run(verify_shipping_api())
