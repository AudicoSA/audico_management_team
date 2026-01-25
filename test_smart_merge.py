import asyncio
import sys
import os

# Ensure we can import from src
sys.path.append(os.getcwd())

from src.connectors.opencart import get_opencart_connector
from src.connectors.supabase import get_supabase_connector
from src.api.products import merge_products

async def test_merge():
    print("Testing Merge Logic (Dry Run Simulation)...")
    
    # We won't actually call the API endpoint via HTTP, but we'll import the function
    # and maybe verify the 'smart logic' if possible, or creating dummy records is safer.
    
    # Strategy: 
    # 1. Create 2 Dummy Products in OpenCart directly.
    # 2. Add one to 'product_matches' (simulate alignment).
    # 3. Call 'merge_products' with both IDs and determine_target=True.
    # 4. Verify the Aligned one remains and the other is deleted.
    
    oc = get_opencart_connector()
    sup = get_supabase_connector()
    conn = oc._get_connection()
    
    try:
        # Create Dummy Products
        import time
        ts = int(time.time())
        p1_sku = f"TEST-MERGE-1-{ts}"
        p2_sku = f"TEST-MERGE-2-{ts}"
        
        print(f"Creating dummy products: {p1_sku}, {p2_sku}")
        
        # Helper to create product
        def create_dummy(sku, name):
            with conn.cursor() as cursor:
                cursor.execute("INSERT INTO oc_product (sku, model, quantity, price, status, date_added, date_modified) VALUES (%s, %s, 10, 100, 1, NOW(), NOW())", (sku, sku))
                pid = cursor.lastrowid
                cursor.execute("INSERT INTO oc_product_description (product_id, language_id, name) VALUES (%s, 1, %s)", (pid, name))
                return pid
        
        p1_id = create_dummy(p1_sku, "Test Merge Master (Aligned)")
        p2_id = create_dummy(p2_sku, "Test Merge Slave (Unaligned)")
        conn.commit()
        
        print(f"Created P1: {p1_id}, P2: {p2_id}")
        
        # Verify creation
        with conn.cursor() as cursor:
            cursor.execute("SELECT product_id FROM oc_product WHERE product_id IN (%s, %s)", (p1_id, p2_id))
            rows = cursor.fetchall()
            if len(rows) != 2:
                print("Failed to create dummy products!")
                return
                
        # Simulate Alignment for P1
        # Insert into product_matches
        print(f"Simulating alignment for P1 ({p1_id})...")
        sup.client.table("product_matches").insert({
            "internal_product_id": "00000000-0000-0000-0000-000000000000", # Fake UUID
            "opencart_product_id": p1_id,
            "match_type": "manual",
            "score": 100
        }).execute()
        
        # Test Merge
        print("Executing Merge...")
        payload = {
            "source_product_ids": [p1_id, p2_id],
            "determine_target": True
        }
        
        result = await merge_products(payload)
        
        print("Merge Result:", result)
        
        # Verify P1 exists, P2 deleted
        with conn.cursor() as cursor:
            cursor.execute("SELECT product_id FROM oc_product WHERE product_id = %s", (p1_id,))
            p1_exists = cursor.fetchone()
            
            cursor.execute("SELECT product_id FROM oc_product WHERE product_id = %s", (p2_id,))
            p2_exists = cursor.fetchone()
            
            if p1_exists and not p2_exists:
                print("SUCCESS: P1 remains, P2 deleted.")
                if result['target_id'] == p1_id:
                    print(f"SUCCESS: Logic correctly picked P1 ({p1_id}) as target.")
                else:
                    print(f"FAILURE: Logic picked {result['target_id']} instead of {p1_id}.")
            else:
                print(f"FAILURE: P1 exists? {bool(p1_exists)}, P2 exists? {bool(p2_exists)}")

    except Exception as e:
        print(f"Test Failed: {e}")
        conn.rollback()
    finally:
        # Cleanup Supabase
        if 'p1_id' in locals():
            sup.client.table("product_matches").delete().eq("opencart_product_id", p1_id).execute()
        conn.close()

if __name__ == "__main__":
    asyncio.run(test_merge())
