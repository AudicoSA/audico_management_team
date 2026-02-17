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
    name = re.sub(r'(?<=[a-z0-9])-(?=[a-z0-9])', '', name)
    return name


class AlignmentEngine:
    def __init__(self):
        self.oc = OpenCartConnector()

    async def find_matches(self, supplier_product: Dict[str, Any], limit: int = 10) -> List[Dict[str, Any]]:
        """Find OpenCart product candidates for a given supplier product.

        Uses three search strategies:
        1. SKU/model search (exact match in OpenCart sku/model fields)
        2. Name search (progressive relaxation with AND conditions)
        3. OR-based search (any 2+ words match — catches partial name overlaps)
        """
        s_sku = supplier_product.get('sku', '')
        s_name = supplier_product.get('name', '')
        s_price = float(supplier_product.get('price', 0) or 0)

        seen_ids = set()
        oc_products = []

        # Strategy 1: Search by SKU/model in OpenCart (fast, high confidence)
        if s_sku:
            sku_results = await self.oc.search_products_by_sku(s_sku)
            for p in sku_results:
                if p['product_id'] not in seen_ids:
                    oc_products.append(p)
                    seen_ids.add(p['product_id'])

        # Strategy 2: Standard name search (AND-based, progressive relaxation)
        name_results = await self.oc.search_products_by_name(s_name)
        for p in name_results:
            if p['product_id'] not in seen_ids:
                oc_products.append(p)
                seen_ids.add(p['product_id'])

        # Strategy 3: OR-based search if we still have few results
        if len(oc_products) < 5 and s_name:
            or_results = await self.oc.search_products_by_name_or(s_name)
            for p in or_results:
                if p['product_id'] not in seen_ids:
                    oc_products.append(p)
                    seen_ids.add(p['product_id'])

        # Score all candidates
        ranked_candidates = []
        s_name_norm = _normalize_name(s_name)
        s_sku_norm = re.sub(r'[^a-z0-9]', '', s_sku.lower()) if s_sku else ''

        for p in oc_products:
            score = 0
            match_type = "fuzzy"

            p_sku = p.get('sku', '') or ''
            p_model = p.get('model', '') or ''
            p_name = p.get('name', '')
            p_price = float(p.get('price', 0) or 0)

            # 1. Exact SKU/model match (highest priority)
            p_sku_norm = re.sub(r'[^a-z0-9]', '', p_sku.lower()) if p_sku else ''
            p_model_norm = re.sub(r'[^a-z0-9]', '', p_model.lower()) if p_model else ''

            if s_sku_norm and (
                (p_sku_norm and s_sku_norm == p_sku_norm) or
                (p_model_norm and s_sku_norm == p_model_norm)
            ):
                score = 100
                match_type = "exact_sku"
            else:
                # 2. Fuzzy name match with normalized names
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

                # 4. Bonus: SKU appears as substring in OpenCart name or vice versa
                if s_sku_norm and len(s_sku_norm) >= 4:
                    if s_sku_norm in p_name_norm.replace('-', '').replace(' ', ''):
                        score = max(score, 90)
                        match_type = "sku_in_name"

            # Price penalty: gentler — only penalize extreme differences
            # Supplier cost is typically 40-60% of retail, so >70% diff is suspicious
            if s_price > 0 and p_price > 0:
                diff_pct = abs(s_price - p_price) / max(s_price, p_price)
                if diff_pct > 0.85:
                    score = int(score * 0.7)  # Mild penalty for very large diff

            ranked_candidates.append({
                "confidence": score,
                "match_type": match_type,
                "price_diff_pct": round(abs(s_price - p_price) / max(s_price, p_price) * 100, 1) if s_price and p_price else 0,
                "product": p
            })

        ranked_candidates.sort(key=lambda x: x['confidence'], reverse=True)
        return ranked_candidates[:limit]
