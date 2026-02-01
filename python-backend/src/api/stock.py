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
