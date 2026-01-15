import asyncio
from src.connectors.supabase import SupabaseConnector

async def check_queue():
    sb = SupabaseConnector()
    
    print("Checking new_products_queue...")
    
    # Get count
    count_response = sb.client.table('new_products_queue').select('count', count='exact').execute()
    print(f"Total items in queue: {count_response.count}")
    
    # Get recent items
    response = sb.client.table('new_products_queue')\
        .select('*')\
        .order('created_at', desc=True)\
        .limit(5)\
        .execute()
        
    for item in response.data:
        print(f"ID: {item['id']}")
        print(f"Supplier: {item['supplier_name']}")
        print(f"Name: {item['name']}")
        print(f"SKU: {item['sku']}")
        print(f"Status: {item['status']}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check_queue())
