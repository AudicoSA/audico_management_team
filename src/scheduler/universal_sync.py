import asyncio
from typing import Dict, List, Any
from datetime import datetime
from src.connectors.supabase import get_supabase_connector
from src.connectors.opencart import get_opencart_connector
from src.utils.logging import AgentLogger

logger = AgentLogger("UniversalProductSyncer")

class UniversalProductSyncer:
    """
    Syncs Price and Stock for ALL linked products from Supabase to OpenCart.
    This acts as the source-of-truth enforcer, ensuring OpenCart always matches Supabase.
    """

    def __init__(self):
        self.supabase = get_supabase_connector()
        self.opencart = get_opencart_connector()

    async def sync_all_products(self, dry_run: bool = False) -> Dict[str, Any]:
        """
        Iterate through all linked products and update OpenCart if data differs.
        """
        logger.info("universal_sync_started", dry_run=dry_run)
        stats = {"total": 0, "updated": 0, "skipped": 0, "errors": 0}

        try:
            # 1. Fetch all matches
            matches_response = self.supabase.client.table("product_matches")\
                .select("internal_product_id, opencart_product_id")\
                .execute()
            
            all_matches = matches_response.data
            matches = [m for m in all_matches if m.get('opencart_product_id')]
            
            stats["total"] = len(matches)
            logger.info("found_linked_products", total_raw=len(all_matches), valid_links=len(matches))

            for match in matches:
                try:
                    await self._sync_single_product(match, dry_run, stats)
                except Exception as e:
                    stats["errors"] += 1
                    logger.error("sync_failed_for_product", 
                                 internal_id=match.get('internal_product_id'), 
                                 error=str(e))

            logger.info("universal_sync_completed", stats=stats)
            return stats

        except Exception as e:
            logger.error("universal_sync_fatal_error", error=str(e))
            return stats

    async def _sync_single_product(self, match: Dict, dry_run: bool, stats: Dict):
        """Sync a single product record."""
        internal_id = match['internal_product_id']
        oc_id = match['opencart_product_id']
        
        if not oc_id: 
            return # Should be filtered already data logic check

        # 1. Get current Supabase Data
        p_res = self.supabase.client.table("products")\
            .select("sku, selling_price, total_stock, product_name")\
            .eq("id", internal_id)\
            .limit(1)\
            .execute()
        
        if not p_res.data:
            # logger.warning("linked_product_missing_in_db", internal_id=internal_id) # Optional: reduce noise
            stats["errors"] += 1
            return

        product = p_res.data[0]

        sb_price = float(product.get('selling_price') or 0)
        sb_stock = int(product.get('total_stock') or 0)
        sku = product.get('sku', 'unknown')

        # 2. Get current OpenCart Data (to check if update matches)
        # Note: Ideally we just overwrite to be safe, but fetching helps us log "Changes"
        # For efficiency we could skip fetching and just update, but checking is safer for logging.
        oc_product = await self.opencart.get_product_by_id(oc_id)
        if not oc_product:
             logger.warning("linked_product_missing_in_opencart", oc_id=oc_id)
             stats["errors"] += 1
             return

        oc_price = float(oc_product.get('price', 0))
        oc_stock = int(oc_product.get('quantity', 0))

        # 3. Compare and Update
        price_differs = abs(sb_price - oc_price) > 0.1 # Floating point tolerance
        stock_differs = sb_stock != oc_stock

        if price_differs or stock_differs:
            req_log = {
                "sku": sku,
                "price_update": f"{oc_price} -> {sb_price}" if price_differs else "unchanged",
                "stock_update": f"{oc_stock} -> {sb_stock}" if stock_differs else "unchanged"
            }

            if not dry_run:
                # Execute Updates
                if price_differs:
                    await self.opencart.update_product_price(oc_id, sb_price)
                if stock_differs:
                    await self.opencart.update_product_stock(oc_id, sb_stock)
                
                logger.info("product_synced", **req_log)
                stats["updated"] += 1
            else:
                logger.info("dry_run_would_update", **req_log)
                stats["skipped"] += 1 # Counted as skipped in dry run
        else:
            stats["skipped"] += 1
