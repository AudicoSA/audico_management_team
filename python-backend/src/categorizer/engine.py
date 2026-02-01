"""
CategoryEngine - AI-powered product categorization system.
Uses the approved category tree to classify products.
"""

import json
import asyncio
from typing import List, Dict, Optional, Tuple, Callable
from openai import OpenAI
from dataclasses import dataclass, asdict
import structlog

from ..utils.config import get_config

logger = structlog.get_logger()


@dataclass
class CategoryAssignment:
    """Result of categorizing a single product."""
    product_id: int
    product_name: str
    primary_category_id: Optional[int]
    primary_category_path: str
    secondary_category_ids: List[int]
    secondary_category_paths: List[str]
    confidence: float
    reasoning: str
    
    def to_dict(self) -> Dict:
        return asdict(self)


class CategoryEngine:
    """
    AI-powered product categorization engine.
    Uses GPT-4o-mini for cost-effective bulk categorization.
    """
    
    def __init__(self, category_tree: List[Dict]):
        """
        Initialize with the approved category tree.
        
        Args:
            category_tree: Nested category tree structure with id, name, slug, children
        """
        config = get_config()
        self.client = OpenAI(api_key=config.get("OPENAI_API_KEY"))
        self.category_tree = category_tree
        self.flat_categories = self._flatten_tree(category_tree)
        
        logger.info(
            "category_engine_initialized",
            total_categories=len(self.flat_categories)
        )
    
    def _flatten_tree(
        self, 
        tree: List[Dict], 
        path: str = ""
    ) -> Dict[str, Dict]:
        """
        Convert tree to flat dict for lookup.
        
        Returns:
            Dict mapping path to category info:
            {"Pro Audio > Microphones > Condenser": {"id": 45, "path": "...", "name": "..."}}
        """
        result = {}
        
        for cat in tree:
            current_path = f"{path} > {cat['name']}" if path else cat['name']
            
            result[current_path] = {
                "id": cat.get("id") or cat.get("category_id"),
                "name": cat["name"],
                "slug": cat.get("slug", ""),
                "path": current_path
            }
            
            if cat.get("children"):
                result.update(self._flatten_tree(cat["children"], current_path))
        
        return result
    
    def get_category_list(self) -> str:
        """Get formatted category list for prompts."""
        return "\n".join([f"- {path}" for path in sorted(self.flat_categories.keys())])
    
    def get_category_by_path(self, path: str) -> Optional[Dict]:
        """Look up category by path."""
        return self.flat_categories.get(path)
    
    async def categorize_product(
        self, 
        product: Dict,
        allow_multiple: bool = True,
        max_categories: int = 3
    ) -> CategoryAssignment:
        """
        Categorize a single product using AI.
        
        Args:
            product: Dict with keys: product_id, name, model/sku, manufacturer, description_snippet, price
            allow_multiple: Whether to allow multiple category assignments
            max_categories: Maximum number of categories to suggest
            
        Returns:
            CategoryAssignment with primary and optional secondary categories
        """
        category_list = self.get_category_list()
        
        prompt = f"""
You are a product categorization expert for an audio-visual equipment store in South Africa.

## Available Categories
{category_list}

## Product to Categorize
Name: {product.get('name', 'Unknown')}
Model/SKU: {product.get('model', '')} / {product.get('sku', '')}
Manufacturer/Brand: {product.get('manufacturer', product.get('brand', 'Unknown'))}
Description: {str(product.get('description_snippet', product.get('description', 'No description')))[:500]}
Price: R {product.get('price', 0)}

## Task
Select the BEST matching category path from the list above.
{'If product fits multiple categories, list up to ' + str(max_categories) + ' in order of relevance.' if allow_multiple else 'Select only ONE category.'}

## Rules
1. Choose the MOST SPECIFIC category that fits (leaf categories preferred)
2. The category path must EXACTLY match one from the list above
3. Consider the product type, not just keywords in the name
4. If unsure, choose a broader parent category rather than wrong specific one

## Output Format (JSON)
{{
    "primary_category": "Exact category path from list above",
    "secondary_categories": ["Optional second path", "Optional third path"],
    "confidence": 0.95,
    "reasoning": "Brief explanation of why this category fits"
}}
"""
        
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model="gpt-4o-mini",  # Cost-effective for bulk
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1  # Low temperature for consistency
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # Look up primary category
            primary_path = result.get("primary_category", "")
            primary_cat = self.flat_categories.get(primary_path, {})
            
            # Look up secondary categories
            secondary_ids = []
            secondary_paths = []
            for sec_path in result.get("secondary_categories", [])[:max_categories-1]:
                sec_cat = self.flat_categories.get(sec_path)
                if sec_cat and sec_cat.get("id"):
                    secondary_ids.append(sec_cat["id"])
                    secondary_paths.append(sec_path)
            
            assignment = CategoryAssignment(
                product_id=product.get("product_id", 0),
                product_name=product.get("name", "Unknown"),
                primary_category_id=primary_cat.get("id"),
                primary_category_path=primary_path,
                secondary_category_ids=secondary_ids,
                secondary_category_paths=secondary_paths,
                confidence=result.get("confidence", 0.5),
                reasoning=result.get("reasoning", "")
            )
            
            logger.debug(
                "product_categorized",
                product_id=product.get("product_id"),
                category=primary_path,
                confidence=assignment.confidence
            )
            
            return assignment
            
        except Exception as e:
            logger.error(
                "categorization_failed",
                product_id=product.get("product_id"),
                error=str(e)
            )
            # Return uncategorized assignment
            return CategoryAssignment(
                product_id=product.get("product_id", 0),
                product_name=product.get("name", "Unknown"),
                primary_category_id=None,
                primary_category_path="",
                secondary_category_ids=[],
                secondary_category_paths=[],
                confidence=0.0,
                reasoning=f"Error: {str(e)}"
            )
    
    async def categorize_batch(
        self, 
        products: List[Dict],
        batch_size: int = 10,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        allow_multiple: bool = True
    ) -> List[CategoryAssignment]:
        """
        Categorize products in parallel batches.
        
        Args:
            products: List of product dicts to categorize
            batch_size: Number of concurrent API calls
            progress_callback: Optional callback(current, total) for progress updates
            allow_multiple: Whether to allow multiple category assignments
            
        Returns:
            List of CategoryAssignment results
        """
        results = []
        total = len(products)
        
        logger.info("batch_categorization_started", total=total, batch_size=batch_size)
        
        for i in range(0, total, batch_size):
            batch = products[i:i+batch_size]
            
            batch_results = await asyncio.gather(
                *[self.categorize_product(p, allow_multiple=allow_multiple) for p in batch],
                return_exceptions=True
            )
            
            for idx, r in enumerate(batch_results):
                if isinstance(r, Exception):
                    logger.error(
                        "batch_item_failed",
                        product_id=batch[idx].get("product_id"),
                        error=str(r)
                    )
                    # Add failed assignment
                    results.append(CategoryAssignment(
                        product_id=batch[idx].get("product_id", 0),
                        product_name=batch[idx].get("name", "Unknown"),
                        primary_category_id=None,
                        primary_category_path="",
                        secondary_category_ids=[],
                        secondary_category_paths=[],
                        confidence=0.0,
                        reasoning=f"Error: {str(r)}"
                    ))
                else:
                    results.append(r)
            
            if progress_callback:
                progress_callback(min(i + batch_size, total), total)
            
            # Small delay between batches to avoid rate limits
            if i + batch_size < total:
                await asyncio.sleep(0.5)
        
        # Log summary
        successful = len([r for r in results if r.confidence > 0])
        high_confidence = len([r for r in results if r.confidence >= 0.8])
        
        logger.info(
            "batch_categorization_complete",
            total=total,
            successful=successful,
            high_confidence=high_confidence
        )
        
        return results
    
    def filter_by_confidence(
        self,
        assignments: List[CategoryAssignment],
        min_confidence: float = 0.8
    ) -> Tuple[List[CategoryAssignment], List[CategoryAssignment]]:
        """
        Split assignments into high and low confidence groups.
        
        Args:
            assignments: List of category assignments
            min_confidence: Threshold for high confidence
            
        Returns:
            Tuple of (high_confidence, low_confidence) lists
        """
        high = [a for a in assignments if a.confidence >= min_confidence]
        low = [a for a in assignments if a.confidence < min_confidence]
        
        return high, low
    
    def export_to_csv(self, assignments: List[CategoryAssignment], filepath: str):
        """
        Export categorization results to CSV.
        
        Args:
            assignments: List of CategoryAssignment results
            filepath: Output CSV path
        """
        import csv
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'product_id',
                'product_name',
                'primary_category_id',
                'primary_category_path',
                'secondary_category_ids',
                'secondary_category_paths',
                'confidence',
                'reasoning'
            ])
            
            for a in assignments:
                writer.writerow([
                    a.product_id,
                    a.product_name,
                    a.primary_category_id or '',
                    a.primary_category_path,
                    ','.join(map(str, a.secondary_category_ids)),
                    '|'.join(a.secondary_category_paths),
                    a.confidence,
                    a.reasoning
                ])
        
        logger.info("exported_assignments", filepath=filepath, count=len(assignments))
    
    @classmethod
    def load_tree_from_json(cls, filepath: str) -> 'CategoryEngine':
        """
        Load category tree from JSON file.
        
        Args:
            filepath: Path to JSON file with category tree
            
        Returns:
            Initialized CategoryEngine
        """
        with open(filepath, 'r', encoding='utf-8') as f:
            tree = json.load(f)
        
        return cls(tree)
    
    @classmethod
    def load_tree_from_supabase(cls, supabase_connector) -> 'CategoryEngine':
        """
        Load category tree from Supabase category_tree table.
        
        Args:
            supabase_connector: SupabaseConnector instance
            
        Returns:
            Initialized CategoryEngine
        """
        # This will be implemented when we have the DB schema
        raise NotImplementedError("Supabase loading not yet implemented")
