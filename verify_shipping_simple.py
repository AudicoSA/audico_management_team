
import urllib.request
import json

def verify_shipping():
    url = "http://127.0.0.1:8000/shipments/create"
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
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(json.dumps(data, indent=2))
            
            tracking = data.get("shipment", {}).get("tracking_number")
            if tracking == "TCG900067":
                print("\nSUCCESS: Tracking number is TCG900067")
            else:
                print(f"\nFAILURE: Tracking number is {tracking}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_shipping()
