"""
Script to remove duplicate products from new_products_queue that already exist in OpenCart.
Uses fuzzy name matching to catch products with different SKUs but similar names.
"""
import asyncio
from difflib import SequenceMatcher
import re
from src.connectors.supabase import SupabaseConnector
from src.connectors.opencart import OpenCartConnector

def normalize_string(s: str) -> str:
    """Normalize string for fuzzy matching."""
    if not s:
        return ""
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

async def main():
    print("🔍 Finding duplicate products in queue...")
    
    supabase = SupabaseConnector()
    opencart = OpenCartConnector()
    
    # Get all pending items from queue
    response = supabase.client.table('new_products_queue')\
        .select('*')\
        .eq('status', 'pending')\
        .execute()
    
    queue_items = response.data
    print(f"📋 Found {len(queue_items)} items in queue")
    
    duplicates_found = []
    
    for item in queue_items:
        # Try exact SKU match first
        oc_product = await opencart.get_product_by_sku(item['sku'])
        
        if oc_product:
            print(f"✓ Exact SKU match: {item['sku']}")
            duplicates_found.append(item['id'])
            continue
        
        # Try fuzzy name match
        if item['name']:
            # Get manufacturer
            manufacturer = await opencart.get_manufacturer_by_name(item['supplier_name'])
            if manufacturer:
                manufacturer_id = manufacturer['manufacturer_id']
                
                # Get all products from manufacturer
                manufacturer_products = await opencart.get_products_by_manufacturer(manufacturer_id)
                
                normalized_new = normalize_string(item['name'])
                
                for oc_prod in manufacturer_products:
                    oc_name = oc_prod.get('name', '')
                    normalized_oc = normalize_string(oc_name)
                    
                    ratio = SequenceMatcher(None, normalized_new, normalized_oc).ratio()
                    
                    if ratio > 0.75:
                        print(f"✓ Fuzzy match ({int(ratio*100)}%): {item['name']} ≈ {oc_name}")
                        duplicates_found.append(item['id'])
                        break
    
    print(f"\n🗑️  Found {len(duplicates_found)} duplicates to remove")
    
    if duplicates_found:
        confirm = input("\nDelete these duplicates? (yes/no): ")
        if confirm.lower() == 'yes':
            supabase.client.table('new_products_queue')\
                .delete()\
                .in_('id', duplicates_found)\
                .execute()
            print(f"✅ Deleted {len(duplicates_found)} duplicates")
        else:
            print("❌ Canceled")
    else:
        print("✅ No duplicates found!")

if __name__ == '__main__':
    asyncio.run(main())
