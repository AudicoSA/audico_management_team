"""Duplicate detection engine for grouping similar products from different suppliers."""
from typing import List, Dict, Any
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


class DuplicateDetector:
    """Detects and groups duplicate products based on name similarity."""

    def __init__(self, similarity_threshold: int = 90):
        """
        Initialize detector with similarity threshold.

        Args:
            similarity_threshold: Minimum similarity score (0-100) to consider products as duplicates
        """
        self.similarity_threshold = similarity_threshold

    def group_duplicates(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Group products by name similarity.

        Args:
            products: List of product dicts with 'id', 'name', 'sku', 'price', 'supplier', etc.

        Returns:
            List of groups, where each group contains:
            - primary: The first/representative product
            - variants: List of similar products (including primary)
            - is_duplicate: True if group has multiple products
        """
        if not products:
            return []

        # Track which products have been grouped
        grouped_ids = set()
        groups = []

        for i, product in enumerate(products):
            # Skip if already in a group
            if product['id'] in grouped_ids:
                continue

            # Start a new group with this product as primary
            group_variants = [product]
            grouped_ids.add(product['id'])

            # Compare with remaining products
            for j in range(i + 1, len(products)):
                other = products[j]

                # Skip if already grouped
                if other['id'] in grouped_ids:
                    continue

                # Calculate similarity
                similarity = fuzz.token_set_ratio(product['name'], other['name'])

                # If similar enough, add to this group
                if similarity >= self.similarity_threshold:
                    group_variants.append(other)
                    grouped_ids.add(other['id'])

            # Create group object
            groups.append({
                "primary": product,
                "variants": group_variants,
                "is_duplicate": len(group_variants) > 1,
                "variant_count": len(group_variants),
                "suppliers": list(set(v.get('supplier', 'Unknown') for v in group_variants))
            })

        return groups

    def find_duplicates_for_product(
        self,
        product: Dict[str, Any],
        candidates: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Find duplicate candidates for a specific product.

        Args:
            product: Product to find duplicates for
            candidates: List of candidate products to check against

        Returns:
            List of duplicate products with similarity scores
        """
        duplicates = []

        for candidate in candidates:
            # Skip self
            if candidate.get('id') == product.get('id'):
                continue

            similarity = fuzz.token_set_ratio(product.get('name', ''), candidate.get('name', ''))

            if similarity >= self.similarity_threshold:
                duplicates.append({
                    **candidate,
                    'similarity_score': similarity
                })

        # Sort by similarity (highest first)
        duplicates.sort(key=lambda x: x['similarity_score'], reverse=True)

        return duplicates
