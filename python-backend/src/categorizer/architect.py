"""
CategoryArchitect - Uses AI to design an optimal category structure
based on product catalog analysis and industry best practices.
"""

import json
import asyncio
from typing import List, Dict, Any, Optional
from openai import OpenAI
from dataclasses import dataclass, asdict
import structlog

from ..utils.config import get_config

logger = structlog.get_logger()


@dataclass
class CategoryNode:
    """Represents a category in the tree."""
    name: str
    slug: str
    description: Optional[str] = None
    children: Optional[List['CategoryNode']] = None
    
    def to_dict(self) -> Dict:
        result = {
            "name": self.name,
            "slug": self.slug
        }
        if self.description:
            result["description"] = self.description
        if self.children:
            result["children"] = [c.to_dict() for c in self.children]
        return result


@dataclass 
class CategoryArchitectureResult:
    """Result from category architecture design."""
    category_tree: List[Dict]
    rationale: str
    migration_notes: str
    estimated_product_distribution: Dict[str, int]


class CategoryArchitect:
    """
    Designs optimal category structures for e-commerce stores
    using AI analysis of existing products and industry best practices.
    """
    
    def __init__(self):
        config = get_config()
        self.client = OpenAI(api_key=config.get("OPENAI_API_KEY"))
        
    async def design_category_tree(
        self, 
        current_categories: List[Dict],
        product_sample: List[Dict],
        industry: str = "audio-visual and pro-audio equipment",
        max_depth: int = 4,
        preferences: Optional[Dict] = None
    ) -> CategoryArchitectureResult:
        """
        Analyze current categories and products to propose an optimal tree.
        
        Args:
            current_categories: List of current category dicts with name, parent_id
            product_sample: Sample of products to analyze (100-500 recommended)
            industry: Industry description for context
            max_depth: Maximum category tree depth
            preferences: Optional dict with user preferences like required categories
            
        Returns:
            CategoryArchitectureResult with proposed tree and rationale
        """
        logger.info(
            "designing_category_tree",
            current_count=len(current_categories),
            sample_size=len(product_sample)
        )
        
        # Build preference instructions
        pref_text = ""
        if preferences:
            if preferences.get("required_categories"):
                pref_text += f"\n- MUST include these top-level categories: {preferences['required_categories']}"
            if preferences.get("exclude_categories"):
                pref_text += f"\n- Do NOT include: {preferences['exclude_categories']}"
            if preferences.get("style"):
                pref_text += f"\n- Category naming style: {preferences['style']}"
        
        # Truncate product sample if too large
        sample = product_sample[:200] if len(product_sample) > 200 else product_sample
        
        prompt = f"""
You are an e-commerce category architecture expert specializing in {industry}.

## Current Categories (may be incomplete/poorly organized)
```json
{json.dumps(current_categories[:50], indent=2)}
```

## Product Sample (representative of ~10,000 products)
```json
{json.dumps(sample, indent=2)}
```

## Requirements
1. Design a comprehensive, professional category hierarchy
2. Maximum {max_depth} levels deep
3. Use industry-standard naming conventions for audio/visual equipment
4. Group products logically for customer navigation
5. Include catch-all categories for edge cases (e.g., "Other Audio Equipment")
6. Balance category sizes (aim for 10-300 products per leaf category)
7. Consider SEO-friendly category names
{pref_text}

## Industry Context
This is for a South African audio-visual e-commerce store selling:
- Professional audio equipment (microphones, mixers, amplifiers, speakers)
- Musical instruments and accessories
- DJ equipment
- Studio/recording gear
- Lighting equipment
- Video/broadcast equipment
- Installation/integration products
- Cables, stands, accessories

## Output Format (JSON)
{{
    "category_tree": [
        {{
            "name": "Pro Audio",
            "slug": "pro-audio",
            "description": "Professional audio equipment for studios and live events",
            "children": [
                {{
                    "name": "Microphones",
                    "slug": "microphones",
                    "children": [
                        {{"name": "Dynamic Microphones", "slug": "dynamic-microphones"}},
                        {{"name": "Condenser Microphones", "slug": "condenser-microphones"}},
                        {{"name": "Wireless Microphone Systems", "slug": "wireless-microphone-systems"}},
                        {{"name": "USB Microphones", "slug": "usb-microphones"}}
                    ]
                }}
            ]
        }}
    ],
    "rationale": "Detailed explanation of design decisions and how it addresses current gaps",
    "migration_notes": "Guidance on mapping current categories to new structure",
    "estimated_product_distribution": {{
        "Pro Audio": 3500,
        "Pro Audio > Microphones": 800,
        "Pro Audio > Microphones > Dynamic Microphones": 200
    }}
}}
"""
        
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.3  # Lower temperature for consistent structure
            )
            
            result = json.loads(response.choices[0].message.content)
            
            logger.info(
                "category_tree_designed",
                top_level_count=len(result.get("category_tree", [])),
                tokens_used=response.usage.total_tokens
            )
            
            return CategoryArchitectureResult(
                category_tree=result.get("category_tree", []),
                rationale=result.get("rationale", ""),
                migration_notes=result.get("migration_notes", ""),
                estimated_product_distribution=result.get("estimated_product_distribution", {})
            )
            
        except Exception as e:
            logger.error("category_design_failed", error=str(e))
            raise
    
    async def refine_category_tree(
        self,
        current_tree: List[Dict],
        feedback: str,
        product_sample: Optional[List[Dict]] = None
    ) -> CategoryArchitectureResult:
        """
        Refine an existing category tree based on user feedback.
        
        Args:
            current_tree: The current proposed category tree
            feedback: User's feedback/requested changes
            product_sample: Optional additional products to consider
            
        Returns:
            Updated CategoryArchitectureResult
        """
        logger.info("refining_category_tree", feedback_length=len(feedback))
        
        sample_text = ""
        if product_sample:
            sample_text = f"""
## Additional Products to Consider
```json
{json.dumps(product_sample[:50], indent=2)}
```
"""
        
        prompt = f"""
You previously designed this category tree for an audio-visual e-commerce store:

## Current Proposed Tree
```json
{json.dumps(current_tree, indent=2)}
```

{sample_text}

## User Feedback
{feedback}

## Task
Modify the category tree based on the feedback while maintaining:
1. Professional structure
2. Logical product grouping
3. SEO-friendly names
4. Maximum 4 levels depth

## Output Format (JSON)
{{
    "category_tree": [...],
    "rationale": "Explanation of changes made based on feedback",
    "migration_notes": "Updated migration guidance",
    "estimated_product_distribution": {{...}}
}}
"""
        
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            result = json.loads(response.choices[0].message.content)
            
            return CategoryArchitectureResult(
                category_tree=result.get("category_tree", []),
                rationale=result.get("rationale", ""),
                migration_notes=result.get("migration_notes", ""),
                estimated_product_distribution=result.get("estimated_product_distribution", {})
            )
            
        except Exception as e:
            logger.error("category_refinement_failed", error=str(e))
            raise
    
    def flatten_tree(
        self, 
        tree: List[Dict], 
        path: str = "",
        parent_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Flatten category tree to list for easier processing.
        
        Args:
            tree: Nested category tree
            path: Current path prefix
            parent_id: Parent category ID
            
        Returns:
            List of flat category dicts with path info
        """
        result = []
        
        for idx, cat in enumerate(tree):
            current_path = f"{path} > {cat['name']}" if path else cat['name']
            
            flat_cat = {
                "name": cat["name"],
                "slug": cat.get("slug", ""),
                "description": cat.get("description", ""),
                "path": current_path,
                "parent_id": parent_id,
                "sort_order": idx
            }
            result.append(flat_cat)
            
            if cat.get("children"):
                # For now, use negative temp IDs; real IDs assigned on import
                temp_id = -(len(result))
                flat_cat["temp_id"] = temp_id
                
                child_results = self.flatten_tree(
                    cat["children"],
                    path=current_path,
                    parent_id=temp_id
                )
                result.extend(child_results)
        
        return result
    
    def count_categories(self, tree: List[Dict]) -> Dict[str, int]:
        """
        Count categories at each level.
        
        Returns:
            Dict with level counts, e.g., {"level_1": 8, "level_2": 45, ...}
        """
        counts = {}
        
        def count_level(nodes: List[Dict], level: int):
            key = f"level_{level}"
            counts[key] = counts.get(key, 0) + len(nodes)
            
            for node in nodes:
                if node.get("children"):
                    count_level(node["children"], level + 1)
        
        count_level(tree, 1)
        return counts
    
    def validate_tree(self, tree: List[Dict]) -> List[str]:
        """
        Validate category tree for common issues.
        
        Returns:
            List of warning/error messages
        """
        issues = []
        seen_slugs = set()
        
        def validate_node(node: Dict, depth: int, path: str):
            # Check depth
            if depth > 4:
                issues.append(f"Category '{path}' exceeds maximum depth of 4")
            
            # Check slug uniqueness
            slug = node.get("slug", "")
            if slug in seen_slugs:
                issues.append(f"Duplicate slug: '{slug}' at '{path}'")
            seen_slugs.add(slug)
            
            # Check name length
            name = node.get("name", "")
            if len(name) > 64:
                issues.append(f"Category name too long (>64 chars): '{name}'")
            if len(name) < 2:
                issues.append(f"Category name too short: '{name}'")
            
            # Recurse
            for child in node.get("children", []):
                child_path = f"{path} > {child.get('name', 'Unknown')}"
                validate_node(child, depth + 1, child_path)
        
        for cat in tree:
            validate_node(cat, 1, cat.get("name", "Unknown"))
        
        return issues
    
    def export_to_csv(self, tree: List[Dict], filepath: str):
        """
        Export flattened tree to CSV for review.
        
        Args:
            tree: Category tree to export
            filepath: Output CSV path
        """
        import csv
        
        flat = self.flatten_tree(tree)
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'path', 'name', 'slug', 'description', 'parent_id', 'sort_order'
            ])
            writer.writeheader()
            writer.writerows(flat)
        
        logger.info("exported_category_tree", filepath=filepath, count=len(flat))
