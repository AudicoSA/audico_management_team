import asyncio
import sys
import os

# Ensure we can import from src
sys.path.append(os.getcwd())

from src.connectors.opencart import get_opencart_connector
from src.connectors.supabase import get_supabase_connector

async def verify_logic():
    print("Starting verification of Duplicates System Logic...\n")
    
    oc = get_opencart_connector()
    sup = get_supabase_connector()
    
    # 1. Check Duplicate SKUs
    print("--- Checking Duplicate SKUs ---")
    try:
        query = """
        SELECT 
            p.sku,
            COUNT(*) as count,
            GROUP_CONCAT(p.product_id) as product_ids,
            GROUP_CONCAT(pd.name SEPARATOR ' | ') as names
        FROM oc_product p
        LEFT JOIN oc_product_description pd ON p.product_id = pd.product_id
        WHERE p.sku IS NOT NULL AND p.sku != ''
        GROUP BY p.sku
        HAVING count > 1
        ORDER BY count DESC
        LIMIT 5
        """
        conn = oc._get_connection()
        with conn.cursor() as cursor:
            cursor.execute(query)
            dups = cursor.fetchall()
            print(f"Found {len(dups)} groups of duplicate SKUs (showing top 5).")
            for d in dups:
                print(f"  SKU: {d.get('sku')} | Count: {d.get('count')} | IDs: {d.get('product_ids')}")
    except Exception as e:
        print(f"Error checking duplicate SKUs: {e}")

    # 2. Check Duplicate Names
    print("\n--- Checking Duplicate Names ---")
    try:
        query = """
        SELECT 
            pd.name,
            COUNT(*) as count,
            GROUP_CONCAT(pd.product_id) as product_ids
        FROM oc_product_description pd
        LEFT JOIN oc_product p ON pd.product_id = p.product_id
        WHERE pd.name IS NOT NULL AND pd.name != ''
        GROUP BY pd.name
        HAVING count > 1
        ORDER BY count DESC
        LIMIT 5
        """
        # Re-use connection or get new one
        conn = oc._get_connection()
        with conn.cursor() as cursor:
            cursor.execute(query)
            dups = cursor.fetchall()
            print(f"Found {len(dups)} groups of duplicate Names (showing top 5).")
            for d in dups:
                names_val = d.get('name')
                # if isinstance(names_val, bytes):
                #     names_val = names_val.decode('utf-8', errors='ignore')
                print(f"  Name: {names_val} | Count: {d.get('count')} | IDs: {d.get('product_ids')}")
    except Exception as e:
        print(f"Error checking duplicate Names: {e}")

    # 3. Check Orphaned (In OpenCart but not Supabase)
    print("\n--- Checking Orphaned Products ---")
    try:
        # Get all SKUs from OpenCart
        oc_skus = set()
        conn = oc._get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT sku FROM oc_product WHERE sku IS NOT NULL AND sku != ''")
            for row in cursor.fetchall():
                oc_skus.add(str(row['sku']))
        
        # Get all SKUs from Supabase
        sup_response = sup.client.table("products").select("sku").execute()
        sup_skus = set(str(p['sku']) for p in sup_response.data if p.get('sku'))
        
        orphaned = [sku for sku in oc_skus if sku not in sup_skus]
        print(f"Found {len(orphaned)} orphaned SKUs (In OC, not in Supabase).")
        if orphaned:
            print(f"  Examples: {orphaned[:5]}")
            
    except Exception as e:
        print(f"Error checking orphaned products: {e}")

    # 4. Check Missing (In Supabase but not OpenCart)
    print("\n--- Checking Missing Products ---")
    try:
        # Re-use sets from above if possible, but for clarity let's assume variables persist
        # oc_skus and sup_skus are available
        
        # Get active Supabase products
        sup_response_active = sup.client.table("products").select("sku").eq("active", True).execute()
        sup_active_skus = set(str(p['sku']) for p in sup_response_active.data if p.get('sku'))
        
        missing = [sku for sku in sup_active_skus if sku not in oc_skus]
        print(f"Found {len(missing)} missing SKUs (Active in Supabase, not in OC).")
        if missing:
            print(f"  Examples: {missing[:5]}")

    except Exception as e:
        print(f"Error checking missing products: {e}")

    print("\nVerification Complete.")

if __name__ == "__main__":
    asyncio.run(verify_logic())
