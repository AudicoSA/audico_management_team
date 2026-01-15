import asyncio
from src.connectors.supabase import SupabaseConnector

async def inspect_queue_now():
    sb = SupabaseConnector()
    
    print("Fetching 'Zeppelin' items from queue...")
    response = sb.client.table('new_products_queue')\
        .select('*')\
        .ilike('name', '%Zeppelin%')\
        .order('created_at', desc=True)\
        .execute()
        
    for item in response.data:
        print(f"ID: {item['id']}")
        print(f"Supplier: {item['supplier_name']}")
        print(f"Name: '{item['name']}'")
        print(f"SKU: '{item['sku']}'")
        print(f"Status: {item['status']}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(inspect_queue_now())
