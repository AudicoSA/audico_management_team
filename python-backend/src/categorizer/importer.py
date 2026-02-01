"""
CategoryImporter - Safely imports new category structure to OpenCart.
Handles both creating new categories and mapping existing ones.
"""

import asyncio
from typing import List, Dict, Optional, Tuple
import structlog

from ..connectors.opencart import OpenCartConnector

logger = structlog.get_logger()


class CategoryImporter:
    """
    Imports and manages category structure in OpenCart.
    Supports dry-run mode for safe testing.
    """
    
    def __init__(self, opencart: Optional[OpenCartConnector] = None):
        """
        Initialize with OpenCart connector.
        
        Args:
            opencart: OpenCartConnector instance, or None to auto-create
        """
        self.oc = opencart or OpenCartConnector()
    
    async def get_existing_categories(self) -> List[Dict]:
        """
        Fetch all existing categories from OpenCart.
        
        Returns:
            List of category dicts with category_id, name, parent_id, sort_order
        """
        conn = self.oc._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        c.category_id,
                        cd.name,
                        c.parent_id,
                        c.sort_order,
                        c.status,
                        c.date_added,
                        c.date_modified
                    FROM oc_category c
                    JOIN oc_category_description cd ON c.category_id = cd.category_id
                    WHERE cd.language_id = 1
                    ORDER BY c.parent_id, c.sort_order
                """)
                
                categories = cursor.fetchall()
                
                logger.info("fetched_categories", count=len(categories))
                return categories
                
        finally:
            conn.close()
    
    async def find_category_by_name(
        self, 
        name: str, 
        parent_id: int = 0
    ) -> Optional[Dict]:
        """
        Find existing category by name and parent.
        
        Args:
            name: Category name to find
            parent_id: Parent category ID (0 for root)
            
        Returns:
            Category dict or None if not found
        """
        conn = self.oc._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        c.category_id,
                        cd.name,
                        c.parent_id,
                        c.sort_order,
                        c.status
                    FROM oc_category c
                    JOIN oc_category_description cd ON c.category_id = cd.category_id
                    WHERE cd.language_id = 1 
                      AND LOWER(cd.name) = LOWER(%s)
                      AND c.parent_id = %s
                """, (name, parent_id))
                
                return cursor.fetchone()
                
        finally:
            conn.close()
    
    async def create_category(
        self,
        name: str,
        parent_id: int = 0,
        slug: str = "",
        description: str = "",
        sort_order: int = 0,
        status: int = 1
    ) -> int:
        """
        Create a new category in OpenCart.
        
        Args:
            name: Category name
            parent_id: Parent category ID (0 for root)
            slug: SEO URL keyword
            description: Category description
            sort_order: Display order
            status: 1 for enabled, 0 for disabled
            
        Returns:
            New category ID
        """
        conn = self.oc._get_connection()
        try:
            with conn.cursor() as cursor:
                # Insert into oc_category
                cursor.execute("""
                    INSERT INTO oc_category (
                        parent_id, top, `column`, sort_order, status,
                        date_added, date_modified
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        NOW(), NOW()
                    )
                """, (parent_id, 1 if parent_id == 0 else 0, 1, sort_order, status))
                
                category_id = cursor.lastrowid
                
                # Insert description for default language (1 = English)
                cursor.execute("""
                    INSERT INTO oc_category_description (
                        category_id, language_id, name, description, meta_title,
                        meta_description, meta_keyword
                    ) VALUES (
                        %s, 1, %s, %s, %s, %s, %s
                    )
                """, (category_id, name, description, name, description[:160] if description else "", slug))
                
                # Insert into store mapping (store_id 0 is default)
                cursor.execute("""
                    INSERT INTO oc_category_to_store (category_id, store_id)
                    VALUES (%s, 0)
                """, (category_id,))
                
                # Build category path
                await self._rebuild_category_path(cursor, category_id, parent_id)
                
                # Add SEO URL if slug provided
                if slug:
                    cursor.execute("""
                        INSERT INTO oc_seo_url (store_id, language_id, query, keyword)
                        VALUES (0, 1, %s, %s)
                        ON DUPLICATE KEY UPDATE keyword = VALUES(keyword)
                    """, (f"category_id={category_id}", slug))
                
                conn.commit()
                
                logger.info(
                    "category_created",
                    category_id=category_id,
                    name=name,
                    parent_id=parent_id
                )
                
                return category_id
                
        except Exception as e:
            conn.rollback()
            logger.error("category_creation_failed", name=name, error=str(e))
            raise
        finally:
            conn.close()
    
    async def _rebuild_category_path(
        self, 
        cursor, 
        category_id: int, 
        parent_id: int
    ):
        """
        Rebuild the category path for proper hierarchy.
        OpenCart uses oc_category_path to track ancestry.
        """
        # Get parent's path
        if parent_id > 0:
            cursor.execute("""
                SELECT category_id, level FROM oc_category_path
                WHERE category_id = %s
                ORDER BY level
            """, (parent_id,))
            parent_path = cursor.fetchall()
        else:
            parent_path = []
        
        # Insert path entries
        level = 0
        for path_entry in parent_path:
            cursor.execute("""
                INSERT INTO oc_category_path (category_id, path_id, level)
                VALUES (%s, %s, %s)
            """, (category_id, path_entry['category_id'] if isinstance(path_entry, dict) else path_entry[0], level))
            level += 1
        
        # Add self as final path entry
        cursor.execute("""
            INSERT INTO oc_category_path (category_id, path_id, level)
            VALUES (%s, %s, %s)
        """, (category_id, category_id, level))
    
    async def import_category_tree(
        self, 
        tree: List[Dict], 
        parent_id: int = 0,
        dry_run: bool = True
    ) -> Dict:
        """
        Recursively create categories in OpenCart.
        
        Args:
            tree: Category tree from architect
            parent_id: Parent category ID (0 for root)
            dry_run: If True, simulate without changes
            
        Returns:
            Results dict with created, existing, errors, and id_mapping
        """
        results = {
            "created": [],
            "existing": [],
            "errors": [],
            "id_mapping": {}  # Maps category path to ID
        }
        
        for idx, category in enumerate(tree):
            try:
                # Check if exists
                existing = await self.find_category_by_name(category["name"], parent_id)
                
                if existing:
                    cat_id = existing["category_id"] if isinstance(existing, dict) else existing[0]
                    results["existing"].append({
                        "name": category["name"],
                        "id": cat_id,
                        "parent_id": parent_id
                    })
                    new_id = cat_id
                else:
                    if not dry_run:
                        new_id = await self.create_category(
                            name=category["name"],
                            parent_id=parent_id,
                            slug=category.get("slug", ""),
                            description=category.get("description", ""),
                            sort_order=idx
                        )
                        results["created"].append({
                            "name": category["name"],
                            "id": new_id,
                            "parent_id": parent_id
                        })
                    else:
                        new_id = f"[DRY_RUN_{len(results['created'])}]"
                        results["created"].append({
                            "name": category["name"],
                            "id": new_id,
                            "parent_id": parent_id
                        })
                
                # Track ID mapping
                results["id_mapping"][category["name"]] = new_id
                
                # Recurse for children
                if category.get("children"):
                    child_parent_id = new_id if not dry_run or isinstance(new_id, int) else 0
                    child_results = await self.import_category_tree(
                        category["children"], 
                        parent_id=child_parent_id if isinstance(child_parent_id, int) else 0,
                        dry_run=dry_run
                    )
                    
                    results["created"].extend(child_results["created"])
                    results["existing"].extend(child_results["existing"])
                    results["errors"].extend(child_results["errors"])
                    results["id_mapping"].update(child_results["id_mapping"])
                    
            except Exception as e:
                results["errors"].append({
                    "name": category["name"],
                    "error": str(e)
                })
                logger.error(
                    "category_import_error",
                    name=category["name"],
                    error=str(e)
                )
        
        return results
    
    async def export_categories_to_csv(self, filepath: str):
        """
        Export current OpenCart categories to CSV.
        
        Args:
            filepath: Output CSV path
        """
        import csv
        
        categories = await self.get_existing_categories()
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'category_id', 'name', 'parent_id', 'sort_order', 'status'
            ])
            
            for cat in categories:
                if isinstance(cat, dict):
                    writer.writerow([
                        cat['category_id'],
                        cat['name'],
                        cat['parent_id'],
                        cat['sort_order'],
                        cat['status']
                    ])
                else:
                    writer.writerow(cat[:5])
        
        logger.info("exported_categories", filepath=filepath, count=len(categories))
    
    async def get_category_product_counts(self) -> Dict[int, int]:
        """
        Get product count for each category.
        
        Returns:
            Dict mapping category_id to product count
        """
        conn = self.oc._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT category_id, COUNT(*) as product_count
                    FROM oc_product_to_category
                    GROUP BY category_id
                """)
                
                results = cursor.fetchall()
                
                if results and isinstance(results[0], dict):
                    return {r['category_id']: r['product_count'] for r in results}
                else:
                    return {r[0]: r[1] for r in results}
                    
        finally:
            conn.close()
