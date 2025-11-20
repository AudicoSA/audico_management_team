"""
Script to sync recent orders from OpenCart to Supabase.
Run with: py -m src.scripts.sync_orders
"""
import asyncio
import sys
from src.connectors.opencart import get_opencart_connector
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

logger = AgentLogger("SyncOrders")

async def sync_orders(days_back: int = 30):
    """Fetch recent orders from OpenCart and upsert to Supabase."""
    opencart = get_opencart_connector()
    supabase = get_supabase_connector()
    
    logger.info("starting_sync", days_back=days_back)
    
    try:
        # Fetch recent orders
        orders = await opencart.get_recent_orders(days_back=days_back, limit=100)
        logger.info("fetched_orders", count=len(orders))
        
        # Debug: Log first order keys
        if orders:
            logger.info("first_order_debug", keys=list(orders[0].keys()), sample=orders[0])
        
        for order in orders:
            order_id = str(order.get("order_id") or "").strip()
            if not order_id:
                logger.warning("skipping_order_no_id", order=order)
                continue
                
            # API might return 'name' or 'firstname'/'lastname'
            customer = order.get("name") or f"{order.get('firstname', '')} {order.get('lastname', '')}".strip() or "Unknown Customer"
            total = float(order.get("total", 0))
            status = order.get("status")
            
            logger.info("upserting_order", order_id=order_id, customer=customer)
            
            # Upsert to Supabase
            # We only map basic fields here. The rest comes from emails/agents.
            await supabase.upsert_order_tracker(
                order_no=order_id,
                order_name=customer,
                supplier_amount=None, # Unknown until invoice
                notes=f"Synced from OpenCart. Status: {status}",
                source="opencart",
                flag_urgent=False
            )
            print(f"Synced Order #{order_id} - {customer}")
            
        logger.info("sync_complete")
        print("\nSync complete!")
        
    except Exception as e:
        logger.error("sync_failed", error=str(e))
        print(f"\nError: {e}")
    finally:
        await opencart.close()

if __name__ == "__main__":
    # Allow passing days_back as argument
    days = 30
    if len(sys.argv) > 1:
        try:
            days = int(sys.argv[1])
        except ValueError:
            pass
            
    asyncio.run(sync_orders(days))
