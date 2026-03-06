"""Stock sync API endpoints for applying approved price changes."""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from src.connectors.opencart import get_opencart_connector
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

router = APIRouter(prefix="/api/stock", tags=["stock"])
logger = AgentLogger("StockAPI")

@router.post("/apply-changes")
async def apply_price_changes(payload: Dict[str, Any]):
    """Apply approved price changes to OpenCart database.
    
    Request body:
        {
            "changes": [
                {
                    "product_id": 123,
                    "sku": "ABC-001",
                    "new_price": 1250.00
                }
            ]
        }
    """
    try:
        changes = payload.get('changes', [])
        
        if not changes:
            raise HTTPException(status_code=400, detail="No changes provided")
        
        opencart = get_opencart_connector()
        supabase = get_supabase_connector()
        
        # Prepare bulk update
        updates = []
        for change in changes:
            updates.append({
                'product_id': change['product_id'],
                'price': change['new_price']
            })
        
        # Apply to OpenCart
        result = await opencart.bulk_update_products(updates)
        
        # Log each successful update
        if result['success']:
            for change in changes:
                try:
                    supabase.client.table("stock_sync_log").insert({
                        'product_id': change['product_id'],
                        'sku': change['sku'],
                        'field_name': 'price',
                        'old_value': change.get('current_price'),
                        'new_value': change['new_price'],
                        'changed_by': 'dashboard_user',
                        'change_source': 'dashboard'
                    }).execute()
                except Exception as e:
                    logger.error("log_update_failed", sku=change.get('sku'), error=str(e))
        
        logger.info("price_changes_applied", 
                   updated=result['updated'], 
                   failed=result['failed'])
        
        return {
            'success': result['success'],
            'updated': result['updated'],
            'failed': result['failed'],
            'errors': result.get('errors', [])
        }
        
    except Exception as e:
        logger.error("apply_changes_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/round-prices")
async def round_all_prices(payload: Dict[str, Any] = None):
    """
    Round ALL linked OpenCart product prices to the nearest R10.
    Only updates products where the rounded price differs from current.

    Request body (optional):
        { "dry_run": true }
    """
    dry_run = True
    if payload:
        dry_run = payload.get("dry_run", True)

    try:
        opencart = get_opencart_connector()

        # Fetch all active product prices from OpenCart
        conn = opencart._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"""
                    SELECT product_id, price FROM {opencart.prefix}product
                    WHERE status = 1 AND price > 0
                """)
                products = cursor.fetchall()
        finally:
            conn.close()

        # Find products needing rounding
        to_update = []
        for p in products:
            current = float(p['price'])
            rounded = round(current / 10) * 10
            if abs(current - rounded) > 0.01:
                to_update.append({
                    'product_id': p['product_id'],
                    'price': rounded
                })

        if not to_update:
            return {
                "status": "success",
                "dry_run": dry_run,
                "checked": len(products),
                "updated": 0,
                "message": "All prices already rounded to nearest R10"
            }

        if dry_run:
            return {
                "status": "success",
                "dry_run": True,
                "checked": len(products),
                "would_update": len(to_update),
                "sample": to_update[:10],
                "message": f"[DRY RUN] Would round {len(to_update)} of {len(products)} products"
            }

        # Apply updates
        result = await opencart.bulk_update_products(to_update)

        logger.info("prices_rounded", checked=len(products), updated=result['updated'])

        return {
            "status": "success",
            "dry_run": False,
            "checked": len(products),
            "updated": result['updated'],
            "failed": result['failed'],
            "message": f"Rounded {result['updated']} product prices to nearest R10"
        }

    except Exception as e:
        logger.error("round_prices_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
