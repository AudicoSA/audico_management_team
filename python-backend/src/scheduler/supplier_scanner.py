import asyncio
from typing import Dict, List, Optional, Any
import importlib
import logging

from src.connectors.supabase import get_supabase_connector
from src.connectors.opencart import get_opencart_connector
from src.utils.logging import AgentLogger

logger = AgentLogger("SupplierScanner")

class SupplierScanner:
    """Service to run supplier scans and update OpenCart stock."""

    def __init__(self):
        self.supabase = get_supabase_connector()
        self.opencart = get_opencart_connector()
        self.scanners = {}
        self._register_default_scanners()

    def _register_default_scanners(self):
        """Register available scanners by name."""
        # Dynamic import to avoid circular dependencies and easy extension
        scanner_names = ["esquire", "rectron"]
        for name in scanner_names:
            try:
                module = importlib.import_module(f"src.scanners.{name}")
                class_name = name.capitalize() + "Scanner"
                if hasattr(module, class_name):
                    scanner_class = getattr(module, class_name)
                    self.scanners[name.capitalize()] = scanner_class()
                    logger.info("scanner_registered", name=name.capitalize())
                else:
                    logger.warning("scanner_class_not_found", module=name, class_name=class_name)
            except ImportError as e:
                logger.warning("scanner_import_failed", name=name, error=str(e))
            except Exception as e:
                logger.error("scanner_registration_error", name=name, error=str(e))

    async def run_scan(self, supplier_name: str) -> Dict[str, Any]:
        """Run a specific supplier scanner and update stock."""
        scanner = self.scanners.get(supplier_name)
        if not scanner:
            logger.error("scanner_not_found", supplier=supplier_name)
            return {"status": "error", "message": f"Scanner {supplier_name} not found"}

        logger.info("scan_started", supplier=supplier_name)
        
        try:
            # 1. Run the scanner
            scan_results = await scanner.run_scan()
            logger.info("scan_completed", supplier=supplier_name, items_found=len(scan_results))

            # 2. Process results
            updated_count = 0
            failed_count = 0
            
            for item in scan_results:
                try:
                    success = await self._process_item(supplier_name, item)
                    if success:
                        updated_count += 1
                    else:
                        failed_count += 1
                except Exception as e:
                    failed_count += 1
                    logger.error("item_processing_failed", sku=item.get('sku'), error=str(e))

            logger.info("scan_processing_finished", 
                        supplier=supplier_name, 
                        updated=updated_count, 
                        failed=failed_count)

            return {
                "status": "success",
                "total_scanned": len(scan_results),
                "updated": updated_count,
                "failed": failed_count
            }

        except Exception as e:
            logger.error("scan_failed_global", supplier=supplier_name, error=str(e))
            return {"status": "error", "message": str(e)}

    async def _process_item(self, supplier_name: str, item: Dict[str, Any]) -> bool:
        """Process a single scanned item: match to product -> update OpenCart."""
        supplier_sku = item.get("sku")
        stock = item.get("stock")
        price = item.get("price")

        if not supplier_sku:
            return False

        # 1. Find Internal ID from Products table using Supplier SKU
        # Assuming we can filter by supplier_id as well if we had it, but for now matching SKU
        # We might need to handle supplier-specific SKU prefixes if they exist in DB
        
        # Fetch product by SKU from Supabase 
        # Note: This might be slow doing it one by one. Bulk processing is better but for MVP one by one is safer logic-wise.
        # Check if 'products' table has a supplier_sku field or if 'sku' is the supplier sku.
        # Based on user description: "Scanner finds Item A. System looks up A in products table"
        
        response = self.supabase.client.table("products")\
            .select("id, sku")\
            .eq("sku", supplier_sku)\
            .execute()
        
        if not response.data:
            # Product not found in internal DB
            # logger.debug("product_not_found_internal", sku=supplier_sku)
            return False
            
        internal_product_id = response.data[0]["id"]

        # 2. Find OpenCart ID from product_matches table
        match_response = self.supabase.client.table("product_matches")\
            .select("opencart_product_id")\
            .eq("internal_product_id", internal_product_id)\
            .execute()
        
        if not match_response.data:
            # No link to OpenCart
            # logger.debug("no_opencart_match", internal_id=internal_product_id)
            return False
            
        opencart_product_id = match_response.data[0]["opencart_product_id"]

        # 3. Update OpenCart
        # Update Stock
        stock_updated = await self.opencart.update_product_stock(int(opencart_product_id), int(stock))
        
        # Update Price (optional, based on requirement "Stock, Price")
        price_updated = True
        if price:
             # Add margin or logic here if needed? 
             # Requirement says "Processing: Takes the standard output... and updates the OpenCart database."
             # Assuming direct update for now.
             price_updated = await self.opencart.update_product_price(int(opencart_product_id), float(price))

        return stock_updated and price_updated
