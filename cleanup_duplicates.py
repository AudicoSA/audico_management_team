import asyncio
from src.connectors.opencart import OpenCartConnector

async def cleanup_duplicates():
    oc = OpenCartConnector()
    
    # Products to clean up
    queries = ["Zeppelin", "ISW-8", "FS-600 S3", "Manual Upload"]
    
    for query in queries:
        print(f"Searching for duplicates of '{query}'...")
        products = await oc.search_products_by_name(query)
        
        if not products:
            print("No products found.")
            continue
            
        # Group by SKU or Name to identify duplicates
        # Since these were created by the agent, they likely have the same SKU or Name
        grouped = {}
        for p in products:
            key = p['name'] # Group by name as SKU might be same
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(p)
            
        for name, items in grouped.items():
            if len(items) > 1:
                print(f"Found {len(items)} duplicates for '{name}'")
                
                # Sort by product_id (assuming higher ID = newer)
                items.sort(key=lambda x: int(x['product_id']))
                
                # Keep the first one (oldest), delete the rest
                to_delete = items[1:]
                print(f"Keeping ID: {items[0]['product_id']}")
                
                for item in to_delete:
                    print(f"Deleting ID: {item['product_id']}...")
                    # Direct SQL delete because OpenCart API might not be available
                    # Using the connector's connection
                    conn = oc._get_connection()
                    try:
                        with conn.cursor() as cursor:
                            cursor.execute(f"DELETE FROM {oc.prefix}product WHERE product_id = %s", (item['product_id'],))
                            cursor.execute(f"DELETE FROM {oc.prefix}product_description WHERE product_id = %s", (item['product_id'],))
                            cursor.execute(f"DELETE FROM {oc.prefix}product_to_store WHERE product_id = %s", (item['product_id'],))
                        conn.commit()
                        print("Deleted.")
                    except Exception as e:
                        print(f"Error deleting: {e}")
                    finally:
                        conn.close()

if __name__ == "__main__":
    asyncio.run(cleanup_duplicates())
