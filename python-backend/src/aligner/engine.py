from typing import List, Dict, Any, Optional
import re

try:
    from thefuzz import fuzz
    FUZZ_AVAILABLE = True
except ImportError:
    FUZZ_AVAILABLE = False

if not FUZZ_AVAILABLE:
    class FuzzFallback:
        @staticmethod
        def token_set_ratio(s1: str, s2: str) -> int:
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


def _normalize_name(name: str) -> str:
    """Normalize product name for better fuzzy matching.
    Strips dashes from model numbers so RP-1400SW and RP1400SW score the same."""
    name = name.lower()
    # Replace dashes/hyphens between alphanumeric chars (model numbers)
    # "RP-1400SW" → "RP1400SW", but preserve " - " separators
    name = re.sub(r'(?<=[a-z0-9])-(?=[a-z0-9])', '', name)
    return name


class AlignmentEngine:
    def __init__(self):
        self.oc = OpenCartConnector()

    async def find_matches(self, supplier_product: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
        """Find OpenCart product candidates for a given supplier product."""
        s_sku = supplier_product.get('sku', '')
        s_name = supplier_product.get('name', '')
        s_price = float(supplier_product.get('price', 0) or 0)

        oc_products = await self.oc.search_products_by_name(s_name)

        ranked_candidates = []
        s_name_norm = _normalize_name(s_name)

        for p in oc_products:
            score = 0
            match_type = "fuzzy"

            p_sku = p.get('sku', '') or p.get('model', '')
            p_name = p.get('name', '')
            p_price = float(p.get('price', 0) or 0)

            # 1. Exact SKU match
            s_sku_norm = re.sub(r'[^a-z0-9]', '', s_sku.lower()) if s_sku else ''
            p_sku_norm = re.sub(r'[^a-z0-9]', '', p_sku.lower()) if p_sku else ''
            if s_sku_norm and p_sku_norm and s_sku_norm == p_sku_norm:
                score = 100
                match_type = "exact_sku"
            else:
                # 2. Fuzzy name match with normalized names (strips model number dashes)
                p_name_norm = _normalize_name(p_name)
                score_raw = fuzz.token_set_ratio(s_name, p_name)
                score_norm = fuzz.token_set_ratio(s_name_norm, p_name_norm)
                score = max(score_raw, score_norm)

                # 3. Bonus: if a model number from supplier appears in OpenCart name
                model_nums = [w for w in re.findall(r'\w+', s_name_norm)
                              if re.search(r'[a-z]', w) and re.search(r'\d', w) and len(w) >= 4]
                p_name_stripped = re.sub(r'[^a-z0-9\s]', '', p_name.lower())
                for model in model_nums:
                    if model in p_name_stripped.replace('-', '').replace(' ', ''):
                        score = max(score, 85)
                        match_type = "model_match"
                        break

            # Price penalty: >50% difference halves the score
            if s_price > 0 and p_price > 0:
                diff_pct = abs(s_price - p_price) / max(s_price, p_price)
                if diff_pct > 0.5:
                    score = int(score * 0.5)

            ranked_candidates.append({
                "confidence": score,
                "match_type": match_type,
                "price_diff_pct": round(abs(s_price - p_price) / max(s_price, p_price) * 100, 1) if s_price and p_price else 0,
                "product": p
            })

        ranked_candidates.sort(key=lambda x: x['confidence'], reverse=True)
        return ranked_candidates[:limit]
