"""
CategoryUpdater - Safely update product categories in OpenCart.
Handles bulk updates with transaction support and audit logging.
"""

import asyncio
import csv
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import structlog

from ..connectors.opencart import OpenCartConnector
from ..connectors.supabase import SupabaseConnector

logger = structlog.get_logger()


class CategoryUpdater:
    """
    Updates product-category assignments in OpenCart.
    Supports individual and bulk updates with audit trail.
    """
    
    def __init__(
        self, 
        opencart: Optional[OpenCartConnector] = None,
        supabase: Optional[SupabaseConnector] = None
    ):
        """
        Initialize with connectors.
        
        Args:
            opencart: OpenCartConnector instance
            supabase: SupabaseConnector for audit logging (optional)
        """
        self.oc = opencart or OpenCartConnector()
        self.supabase = supabase
    
    async def get_product_categories(self, product_id: int) -> List[int]:
        """
        Get current category IDs for a product.
        
        Args:
            product_id: OpenCart product ID
            
        Returns:
            List of category IDs
        """
        conn = self.oc._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT category_id FROM oc_product_to_category
                    WHERE product_id = %s
                """, (product_id,))
                
                results = cursor.fetchall()
                
                if results and isinstance(results[0], dict):
                    return [r['category_id'] for r in results]
                else:
                    return [r[0] for r in results]
                    
        finally:
            conn.close()
    
    async def update_product_categories(
        self,
        product_id: int,
        category_ids: List[int],
        replace: bool = True,
        assigned_by: str = "ai"
    ) -> bool:
        """
        Update product's category assignments.
        
        Args:
            product_id: OpenCart product ID
            category_ids: List of category IDs to assign
            replace: If True, remove existing categories first
            assigned_by: Who/what made this assignment (for audit)
            
        Returns:
            True if successful
        """
        if not category_ids:
            logger.warning("no_categories_provided", product_id=product_id)
            return False
        
        # Get current categories for audit
        old_categories = await self.get_product_categories(product_id)
        
        conn = self.oc._get_connection()
        try:
            with conn.cursor() as cursor:
                if replace:
                    # Remove existing category assignments
                    cursor.execute("""
                        DELETE FROM oc_product_to_category 
                        WHERE product_id = %s
                    """, (product_id,))
                
                # Insert new assignments
                for cat_id in category_ids:
                    cursor.execute("""
                        INSERT INTO oc_product_to_category (product_id, category_id) 
                        VALUES (%s, %s)
                        ON DUPLICATE KEY UPDATE category_id = category_id
                    """, (product_id, cat_id))
                
                # Update product modified date
                cursor.execute("""
                    UPDATE oc_product SET date_modified = NOW()
                    WHERE product_id = %s
                """, (product_id,))
                
                conn.commit()
                
                logger.info(
                    "product_categories_updated",
                    product_id=product_id,
                    old_categories=old_categories,
                    new_categories=category_ids
                )
                
                # Log to Supabase if available
                if self.supabase:
                    await self._log_assignment(
                        product_id=product_id,
                        old_category_ids=old_categories,
                        new_category_ids=category_ids,
                        assigned_by=assigned_by
                    )
                
                return True
                
        except Exception as e:
            conn.rollback()
            logger.error(
                "category_update_failed",
                product_id=product_id,
                error=str(e)
            )
            raise
        finally:
            conn.close()
    
    async def _log_assignment(
        self,
        product_id: int,
        old_category_ids: List[int],
        new_category_ids: List[int],
        assigned_by: str,
        confidence: Optional[float] = None,
        reasoning: Optional[str] = None
    ):
        """Log category assignment to Supabase for audit."""
        if not self.supabase:
            return
            
        try:
            await self.supabase.insert("category_assignments", {
                "product_id": product_id,
                "old_category_ids": old_category_ids,
                "new_category_ids": new_category_ids,
                "assigned_by": assigned_by,
                "confidence": confidence,
                "reasoning": reasoning,
                "created_at": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.warning("audit_log_failed", error=str(e))
    
    async def bulk_update_from_csv(
        self,
        csv_path: str,
        dry_run: bool = True,
        progress_callback=None
    ) -> Dict:
        """
        Process categorization CSV and update OpenCart.
        
        Expected CSV columns:
        - product_id
        - primary_category_id
        - secondary_category_ids (comma-separated, optional)
        
        Args:
            csv_path: Path to input CSV
            dry_run: If True, simulate without changes
            progress_callback: Optional callback(current, total)
            
        Returns:
            Results dict with updated, skipped, failed counts
        """
        results = {
            "updated": 0,
            "skipped": 0,
            "failed": 0,
            "errors": []
        }
        
        # Read CSV
        rows = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        total = len(rows)
        logger.info("bulk_update_started", total=total, dry_run=dry_run)
        
        for idx, row in enumerate(rows):
            try:
                product_id = int(row["product_id"])
                
                # Skip if no primary category
                if not row.get("primary_category_id"):
                    results["skipped"] += 1
                    continue
                
                # Build category list
                category_ids = [int(row["primary_category_id"])]
                
                if row.get("secondary_category_ids"):
                    secondary = row["secondary_category_ids"].strip()
                    if secondary:
                        category_ids.extend([
                            int(x.strip()) 
                            for x in secondary.split(",")
                            if x.strip() and x.strip().isdigit()
                        ])
                
                if dry_run:
                    results["updated"] += 1
                else:
                    success = await self.update_product_categories(
                        product_id=product_id,
                        category_ids=category_ids,
                        replace=True,
                        assigned_by="bulk_import"
                    )
                    
                    if success:
                        results["updated"] += 1
                    else:
                        results["failed"] += 1
                        
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "row": idx + 1,
                    "product_id": row.get("product_id"),
                    "error": str(e)
                })
            
            if progress_callback and (idx + 1) % 100 == 0:
                progress_callback(idx + 1, total)
        
        logger.info(
            "bulk_update_complete",
            updated=results["updated"],
            skipped=results["skipped"],
            failed=results["failed"],
            dry_run=dry_run
        )
        
        return results
    
    async def bulk_update_from_assignments(
        self,
        assignments: List[Dict],
        dry_run: bool = True,
        min_confidence: float = 0.0,
        progress_callback=None
    ) -> Dict:
        """
        Update OpenCart from CategoryAssignment list.
        
        Args:
            assignments: List of CategoryAssignment dicts or objects
            dry_run: If True, simulate without changes
            min_confidence: Skip assignments below this confidence
            progress_callback: Optional callback(current, total)
            
        Returns:
            Results dict
        """
        results = {
            "updated": 0,
            "skipped": 0,
            "failed": 0,
            "low_confidence": 0,
            "errors": []
        }
        
        total = len(assignments)
        
        for idx, assignment in enumerate(assignments):
            # Handle both dict and object
            if hasattr(assignment, 'to_dict'):
                a = assignment
            else:
                a = type('Assignment', (), assignment)()
            
            try:
                # Skip low confidence
                confidence = getattr(a, 'confidence', assignment.get('confidence', 0))
                if confidence < min_confidence:
                    results["low_confidence"] += 1
                    results["skipped"] += 1
                    continue
                
                product_id = getattr(a, 'product_id', assignment.get('product_id'))
                primary_id = getattr(a, 'primary_category_id', assignment.get('primary_category_id'))
                
                if not primary_id:
                    results["skipped"] += 1
                    continue
                
                # Build category list
                category_ids = [primary_id]
                secondary = getattr(a, 'secondary_category_ids', assignment.get('secondary_category_ids', []))
                if secondary:
                    category_ids.extend(secondary)
                
                if dry_run:
                    results["updated"] += 1
                else:
                    success = await self.update_product_categories(
                        product_id=product_id,
                        category_ids=category_ids,
                        replace=True,
                        assigned_by="ai"
                    )
                    
                    if success:
                        results["updated"] += 1
                    else:
                        results["failed"] += 1
                        
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "idx": idx,
                    "error": str(e)
                })
            
            if progress_callback and (idx + 1) % 100 == 0:
                progress_callback(idx + 1, total)
        
        return results
    
    async def verify_assignments(
        self,
        product_ids: List[int]
    ) -> Dict[int, List[int]]:
        """
        Verify category assignments for a list of products.
        
        Args:
            product_ids: List of product IDs to check
            
        Returns:
            Dict mapping product_id to list of category_ids
        """
        result = {}
        
        for product_id in product_ids:
            categories = await self.get_product_categories(product_id)
            result[product_id] = categories
        
        return result
