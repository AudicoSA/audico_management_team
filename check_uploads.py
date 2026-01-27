import asyncio
from src.connectors.supabase import get_supabase_connector

async def check_uploads():
    sb = get_supabase_connector()
    
    # 1. Check Uploads
    print('--- Recent Uploads ---')
    res = sb.client.table('price_list_uploads').select('*').order('created_at', desc=True).limit(5).execute()
    for item in res.data:
        print(f"Upload: {item.get('filename')}, Supplier: {item.get('supplier_name')}, Status: {item.get('status')}, Date: {item.get('created_at')}")
    
    # 2. Check Supplier Catalogs for the pattern
    print('\n--- Searching Supplier Catalogs ---')
    res = sb.client.table("supplier_catalogs")\
            .select("*")\
            .ilike("name", "%Electronics Mega Store%")\
            .limit(5).execute()
            
    if res.data:
        print(f"Found {len(res.data)} faulty items in catalogs.")
        print(f"Sample: {res.data[0]}")
    else:
        print("No faulty items found in supplier_catalogs.")
        
    # 3. Check for specific SKU from the failure if known
    # OpenCart ID 17106 didn't have a SKU.
    # But maybe we can search by name in catalogs generally
    print('\n--- Searching Catalogs for "Mega Store" ---')
    res = sb.client.table("supplier_catalogs")\
            .select("*")\
            .ilike("name", "%Mega Store%")\
            .limit(5).execute()
    if res.data:
         print(f"Sample Mega Store: {res.data[0]}")

if __name__ == "__main__":
    asyncio.run(check_uploads())
