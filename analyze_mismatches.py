import asyncio
from src.connectors.supabase import SupabaseConnector
from src.connectors.opencart import OpenCartConnector
from difflib import SequenceMatcher

async def analyze_mismatches():
    sb = SupabaseConnector()
    oc = OpenCartConnector()
    
    print("Fetching recent 'new' products...")
    response = sb.client.table('new_products_queue')\
        .select('*')\
        .order('created_at', desc=True)\
        .limit(10)\
        .execute()
        
    with open("mismatch_analysis.txt", "w") as f:
        for item in response.data:
            f.write(f"Queue Item: {item['name']} (SKU: {item['sku']})\n")
            
            # 1. Search OpenCart by Name
            f.write("  Searching OpenCart by Name...\n")
            candidates = await oc.search_products_by_name(item['name'])
            
            if not candidates:
                f.write("  No candidates found by name search.\n")
            else:
                for cand in candidates:
                    # Calculate similarity
                    ratio = SequenceMatcher(None, item['name'].lower(), cand['name'].lower()).ratio()
                    f.write(f"  Candidate: {cand['name']} (SKU: {cand['sku']}, Model: {cand['model']})\n")
                    f.write(f"  Similarity: {ratio:.2f}\n")
            
            f.write("-" * 30 + "\n")

if __name__ == "__main__":
    asyncio.run(analyze_mismatches())
