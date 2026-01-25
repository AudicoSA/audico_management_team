import asyncio
import sys
import os
import re
from difflib import SequenceMatcher

# Ensure we can import from src
sys.path.append(os.getcwd())

from src.connectors.opencart import get_opencart_connector
from src.connectors.supabase import get_supabase_connector

def normalize_string(s):
    if not s: return ""
    return re.sub(r'[^a-z0-9]', '', s.lower())

def similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()

async def investigate_fuzzy_v2():
    print("Starting Advanced Fuzzy Duplicate Investigation...\n")
    
    oc = get_opencart_connector()
    sup = get_supabase_connector()
    
    # 1. Fetch OpenCart Products
    print("Fetching OpenCart products...")
    conn = oc._get_connection()
    oc_products = []
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT p.product_id, p.sku, p.model, pd.name 
            FROM oc_product p 
            JOIN oc_product_description pd ON p.product_id = pd.product_id 
            WHERE pd.language_id = 1
        """)
        oc_products = cursor.fetchall()

    # 2. Fetch Alignment
    print("Fetching Alignment Matches...")
    matches = sup.client.table("product_matches").select("opencart_product_id").execute()
    aligned_ids = set(m['opencart_product_id'] for m in matches.data if m.get('opencart_product_id'))
    
    aligned = []
    unaligned = []
    
    for p in oc_products:
        pid = p['product_id']
        p['norm_sku'] = normalize_string(p['sku'])
        p['norm_model'] = normalize_string(p['model'])
        p['norm_name'] = normalize_string(p['name'])
        
        if pid in aligned_ids:
            aligned.append(p)
        else:
            unaligned.append(p)
            
    print(f"Aligned: {len(aligned)} | Unaligned: {len(unaligned)}")
    
    # 3. Build Indexes for Aligned Products
    aligned_sku_map = {}
    aligned_model_map = {}
    
    for p in aligned:
        if p['norm_sku']: aligned_sku_map[p['norm_sku']] = p
        if p['norm_model']: aligned_model_map[p['norm_model']] = p
        
    duplicates = []
    
    print("\nScanning (Model & Fuzzy Name)...")
    
    # optimization: simple blocking?
    # O(N*M) is too slow for 10k * 600 ~ 6M comparisons.
    # We will trust direct Model/SKU matches first.
    
    for u in unaligned:
        match_found = False
        match_type = ""
        target = None
        
        # Check 1: Model Match (Unaligned Model == Aligned SKU or Model)
        u_model = u['norm_model']
        if u_model:
            if u_model in aligned_sku_map:
                match_found = True
                match_type = "Model->SKU"
                target = aligned_sku_map[u_model]
            elif u_model in aligned_model_map:
                match_found = True
                match_type = "Model->Model"
                target = aligned_model_map[u_model]
        
        # Check 2: SKU Match (Unaligned SKU == Aligned SKU or Model)
        if not match_found:
            u_sku = u['norm_sku']
            if u_sku:
                if u_sku in aligned_sku_map:
                    match_found = True
                    match_type = "SKU->SKU"
                    target = aligned_sku_map[u_sku]
                elif u_sku in aligned_model_map:
                    match_found = True
                    match_type = "SKU->Model"
                    target = aligned_model_map[u_sku]

        if match_found:
            duplicates.append({
                "u": u, "a": target, "algo": match_type
            })

    print(f"Found {len(duplicates)} duplicates via Model/SKU keys.")
    
    # Check 3: Name Similarity (Only for a subset or if key match failed)
    # Let's try to match names that are very similar but have diff IDs
    # Warning: Slow. Let's do a quick prefix bucket.
    
    # Bucket by first 3 chars of normalized name
    buckets = {}
    for p in aligned:
        pre = p['norm_name'][:3]
        if pre not in buckets: buckets[pre] = []
        buckets[pre].append(p)
        
    name_dups = 0
    for u in unaligned:
        # Skip if already found
        if any(d['u']['product_id'] == u['product_id'] for d in duplicates):
            continue
            
        pre = u['norm_name'][:3]
        if pre in buckets:
            best_score = 0
            best_match = None
            
            for a in buckets[pre]:
                # Quick length check
                if abs(len(u['norm_name']) - len(a['norm_name'])) > 10:
                    continue
                    
                score = similarity(u['name'].lower(), a['name'].lower())
                if score > 0.95: # Very strict
                    if score > best_score:
                        best_score = score
                        best_match = a
            
            if best_match:
                duplicates.append({
                    "u": u, "a": best_match, "algo": f"Name ({best_score:.2f})"
                })
                name_dups += 1
                
    print(f"Found {name_dups} additional duplicates via Name Similarity.")
    print(f"Total Matches: {len(duplicates)}")
    
    if duplicates:
        print("\n=== Examples ===")
        for d in duplicates[:20]:
            print(f"[{d['algo']}]")
            print(f"  BAD: {d['u']['name']} (SKU: {d['u']['sku']} / Model: {d['u']['model']})")
            print(f"  GOOD: {d['a']['name']} (SKU: {d['a']['sku']} / Model: {d['a']['model']})")
            print("")

if __name__ == "__main__":
    asyncio.run(investigate_fuzzy_v2())
