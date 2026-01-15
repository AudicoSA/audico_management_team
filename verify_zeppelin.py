import asyncio
from src.connectors.opencart import OpenCartConnector
from difflib import SequenceMatcher

async def verify_zeppelin():
    oc = OpenCartConnector()
    
    product_name = "Zeppelin Wall Bracket" # Assuming this is roughly what came in
    # Strategy: Try increasingly broad searches to find candidates
    search_queries = [
        product_name,  # Full name
        " ".join(product_name.split()[:3]),  # First 3 words
        " ".join(product_name.split()[:2]),  # First 2 words
        max(product_name.split(), key=len)   # Longest word (e.g. "Zeppelin")
    ]

    with open("verify_zeppelin_output.txt", "w") as f:
        f.write(f"Testing match for: '{product_name}'\n")
        f.write(f"Search Queries: {search_queries}\n")
        
        for query in search_queries:
            if len(query) < 3: continue
            
            f.write(f"Searching for: '{query}'\n")
            results = await oc.search_products_by_name(query)
            f.write(f"  Found {len(results)} results\n")
            
            for res in results:
                if res['product_id'] not in seen_ids:
                    candidates.append(res)
                    seen_ids.add(res['product_id'])
            
            if len(candidates) > 5:
                break
                
        f.write(f"\nTotal Candidates: {len(candidates)}\n")
        
        best_match = None
        best_ratio = 0.0
        
        for oc_prod in candidates:
            oc_name = oc_prod.get('name', '')
            
            # Simple normalization for test
            normalized_new = product_name.lower()
            normalized_oc = oc_name.lower()
            
            ratio = SequenceMatcher(None, normalized_new, normalized_oc).ratio()
            
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = oc_prod
                
        f.write(f"Best Match: {best_match['name'] if best_match else 'None'}\n")
        f.write(f"Similarity: {best_ratio:.2f}\n")
        
        if best_ratio > 0.65:
            f.write("RESULT: MATCH FOUND! (Would be linked)\n")
        else:
            f.write("RESULT: NO MATCH (Would create duplicate)\n")

if __name__ == "__main__":
    asyncio.run(verify_zeppelin())
