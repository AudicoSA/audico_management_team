import asyncio
from src.connectors.supabase import SupabaseConnector
from src.connectors.opencart import OpenCartConnector

async def investigate_htm6():
    sb = SupabaseConnector()
    oc = OpenCartConnector()
    
    with open("htm6_debug.txt", "w") as f:
        f.write("--- Supabase Queue (Recent HTM6) ---\n")
        response = sb.client.table('new_products_queue')\
            .select('*')\
            .ilike('name', '%HTM6%')\
            .order('created_at', desc=True)\
            .limit(5)\
            .execute()
            
        for item in response.data:
            f.write(f"Queue ID: {item['id']}\n")
            f.write(f"Name: {item['name']}\n")
            f.write(f"SKU: {item['sku']}\n")
            f.write(f"Status: {item['status']}\n")
            f.write("-" * 20 + "\n")

        f.write("\n--- OpenCart Search (HTM6) ---\n")
        products = await oc.search_products_by_name("HTM6")
        for p in products:
            f.write(f"OC ID: {p['product_id']}\n")
            f.write(f"Name: {p['name']}\n")
            f.write(f"SKU: {p['sku']}\n")
            f.write(f"Model: {p.get('model')}\n")
            f.write("-" * 20 + "\n")

if __name__ == "__main__":
    asyncio.run(investigate_htm6())
