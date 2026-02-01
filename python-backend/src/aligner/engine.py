from typing import List, Dict, Any, Optional
try:
    from thefuzz import fuzz
    FUZZ_AVAILABLE = True
except ImportError:
    FUZZ_AVAILABLE = False
    logger = AgentLogger("alignment_engine")
    logger.warning("thefuzz_not_installed", detail="Using simple fallback matching")

if not FUZZ_AVAILABLE:
    class FuzzFallback:
        @staticmethod
        def token_set_ratio(s1: str, s2: str) -> int:
            # Simple Jaccard similarity on tokens as fallback
            set1 = set(s1.lower().split())
            set2 = set(s2.lower().split())
            if not set1 or not set2: return 0
            intersection = len(set1 & set2)
            union = len(set1 | set2)
            return int((intersection / union) * 100)
    
    fuzz = FuzzFallback()
from src.connectors.opencart import OpenCartConnector
from src.utils.logging import AgentLogger

logger = AgentLogger("alignment_engine")

class AlignmentEngine:
    def __init__(self):
        self.oc = OpenCartConnector()

    async def find_matches(self, supplier_product: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
        """
        Find OpenCart product candidates for a given supplier product.
        
        Args:
            supplier_product: Dict containing 'sku', 'name', 'price'
            limit: Max number of candidates to return
            
        Returns:
            List of candidate dicts with 'score', 'price_diff', 'opencart_product'
        """
        s_sku = supplier_product.get('sku', '')
        s_name = supplier_product.get('name', '')
        s_price = float(supplier_product.get('price', 0) or 0)

        candidates = []

        # 1. Exact SKU Match (100% Confidence)
        # Note: OpenCartConnector needs a method to get by SKU, or we search by model
        # For now, let's assume we search by name first to get a broad list, 
        # OR we implement a specific get_by_sku in OpenCartConnector if it doesn't exist.
        # Let's try to search by name in OpenCart to get candidates.
        
        oc_products = await self.oc.search_products_by_name(s_name)
        
        # If no results by name, try searching by SKU/Model if possible, 
        # but usually search_products_by_name does a simplified query.
        
        ranked_candidates = []
        
        for p in oc_products:
            score = 0
            match_type = "fuzzy"
            
            p_sku = p.get('sku', '') or p.get('model', '')
            p_name = p.get('name', '')
            p_price = float(p.get('price', 0) or 0)
            
            # SKU Match
            if s_sku and p_sku and s_sku.lower().strip() == p_sku.lower().strip():
                score = 100
                match_type = "exact_sku"
            else:
                # Fuzzy Name Match (Token Set Ratio is good for partial matches)
                score = fuzz.token_set_ratio(s_name, p_name)
            
            # Price Penalty
            # If price difference is > 50%, penalize the score significantly
            price_similarity = 100
            if s_price > 0 and p_price > 0:
                diff_pct = abs(s_price - p_price) / max(s_price, p_price)
                if diff_pct > 0.5: # 50% difference
                    # Penalize: Reduce score by 50% of the original score
                    score = int(score * 0.5)
                    price_similarity = int((1 - diff_pct) * 100)
            
            ranked_candidates.append({
                "confidence": score,
                "match_type": match_type,
                "price_diff_pct": round(abs(s_price - p_price) / max(s_price, p_price) * 100, 1) if s_price and p_price else 0,
                "product": p
            })
            
        # Sort by confidence desc
        ranked_candidates.sort(key=lambda x: x['confidence'], reverse=True)
        
        return ranked_candidates[:limit]
