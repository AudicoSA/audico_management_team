import asyncio
from src.connectors.supabase import SupabaseConnector
from src.connectors.opencart import OpenCartConnector
from difflib import SequenceMatcher

async def inspect_failure():
    sb = SupabaseConnector()
    oc = OpenCartConnector()
    
    print("--- Fetching latest queue items ---")
    response = sb.client.table('new_products_queue')\
        .select('*')\
        .order('created_at', desc=True)\
        .limit(5)\
        .execute()
        
    with open("inspect_output.txt", "w") as f:
        if not response.data:
            f.write("Queue is empty.\n")
            return

        # Pick the first item
        item = response.data[0]
        f.write(f"Queue Item ID: {item['id']}\n")
        f.write(f"Name in Queue: '{item['name']}'\n")
        f.write(f"SKU in Queue: '{item['sku']}'\n")
        
        # Run the EXACT search logic from stock_agent.py
        f.write("\n--- Running Search Logic ---\n")
        product_name = item['name']
        
        search_queries = [
            product_name,
            " ".join(product_name.split()[:3]),
            " ".join(product_name.split()[:2]),
            max(product_name.split(), key=len)
        ]
        
        candidates = []
        seen_ids = set()
        
        for query in search_queries:
            if len(query) < 3: continue
            
            f.write(f"Query: '{query}'\n")
            results = await oc.search_products_by_name(query)
            f.write(f"  -> Found {len(results)} results\n")
            
            for res in results:
                if res['product_id'] not in seen_ids:
                    candidates.append(res)
                    seen_ids.add(res['product_id'])
                    f.write(f"     Candidate: '{res['name']}' (ID: {res['product_id']})\n")
        
        f.write(f"\nTotal Candidates Found: {len(candidates)}\n")
        
        # Run Comparison Logic
        f.write("\n--- Running Comparison Logic ---\n")
        best_match = None
        best_ratio = 0.0
        
        normalized_new = item['name'].lower().replace(" ", "") # Simplified normalization
        
        for oc_prod in candidates:
            oc_name = oc_prod.get('name', '')
            normalized_oc = oc_name.lower().replace(" ", "")
            
            ratio = SequenceMatcher(None, normalized_new, normalized_oc).ratio()
            f.write(f"Comparing with: '{oc_name}' -> Ratio: {ratio:.4f}\n")
            
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = oc_prod
                
        f.write(f"\nBest Ratio: {best_ratio:.4f}\n")
        if best_ratio > 0.65:
            f.write("CONCLUSION: SHOULD MATCH\n")
        else:
            f.write("CONCLUSION: NO MATCH\n")

if __name__ == "__main__":
    asyncio.run(inspect_failure())
