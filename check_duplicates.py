import asyncio
from src.connectors.opencart import OpenCartConnector

async def check_duplicates():
    oc = OpenCartConnector()
    
    products_to_check = [
        "ISW-8",
        "Zeppelin",
        "FS-600 S3",
        "Manual Upload"
    ]
    
    with open("duplicate_check.txt", "w") as f:
        for query in products_to_check:
            f.write(f"Checking duplicates for '{query}'...\n")
            products = await oc.search_products_by_name(query)
            
            if not products:
                f.write("No products found.\n")
                continue
                
            f.write(f"Found {len(products)} products:\n")
            for p in products:
                f.write(f"- ID: {p['product_id']}, SKU: {p['sku']}, Name: {p['name']}, Status: {p['status']}\n")
            f.write("-" * 20 + "\n")

if __name__ == "__main__":
    asyncio.run(check_duplicates())
