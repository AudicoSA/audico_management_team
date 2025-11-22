from typing import Dict, Any, List, Optional
from src.connectors.shiplogic import get_shiplogic_connector
from src.connectors.opencart import get_opencart_connector
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

logger = AgentLogger("OrdersLogisticsAgent")

class OrdersLogisticsAgent:
    """
    Agent responsible for handling order data, logistics operations, and Shiplogic integration.
    Stage 2 Implementation.
    """

    def __init__(self):
        self.name = "OrdersLogisticsAgent"
        self.shiplogic = get_shiplogic_connector()
        self.opencart = get_opencart_connector()
        self.supabase = get_supabase_connector()
        logger.info("orders_agent_initialized")

    async def run(self, input_data: Dict[str, Any], state: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Main entry point for the agent.
        
        Args:
            input_data: The input payload (e.g., order details, command).
            state: The shared state object from the orchestrator.
            
        Returns:
            Updated state or result.
        """
        logger.info("processing_input", input_data=input_data)
        
        action = input_data.get("action")
        
        if action == "create_shipment":
            return await self._create_shipment(input_data)
        elif action == "track_shipment":
            return await self._track_shipment(input_data)
        elif action == "get_rates":
            return await self._get_rates(input_data)
        else:
            return {"status": "error", "error": f"Unknown action: {action}"}

    async def _create_shipment(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a shipment via Shiplogic.
        """
        order_id = data.get("order_id")
        dry_run = data.get("dry_run", True)
        
        if not order_id:
            return {"status": "error", "error": "Missing order_id"}

        logger.info("creating_shipment", order_id=order_id, dry_run=dry_run)

        try:
            # 1. Fetch order details from OpenCart
            order = await self.opencart.get_order(order_id)
            if not order:
                return {"status": "error", "error": f"Order {order_id} not found in OpenCart"}

            # 2. Prepare addresses
            # Map OpenCart address to Shiplogic format
            # Note: This is a simplified mapping. Real implementation might need more robust parsing.
            shipping_address = order.get("shipping_address", {})
            delivery_address = {
                "company": order.get("company") or "",
                "street_address": f"{shipping_address.get('address_1', '')} {shipping_address.get('address_2', '')}".strip(),
                "local_area": shipping_address.get("city", ""),
                "city": shipping_address.get("city", ""),
                "code": shipping_address.get("postcode", ""),
                "zone": shipping_address.get("zone", ""),
                "country_code": "ZA", # Assuming South Africa for now
            }
            
            # Collection address (Audico HQ - hardcoded for now or fetch from config)
            # Allow override from input data (for Drop Shipping)
            custom_collection = data.get("collection_address")
            if custom_collection:
                collection_address = custom_collection
            else:
                # Default Placeholder
                collection_address = {
                    "company": "Audico Online",
                    "street_address": "123 Example Street", # Placeholder
                    "local_area": "Sandton",
                    "city": "Johannesburg",
                    "code": "2000",
                    "country_code": "ZA",
                }

            # 3. Prepare parcels
            # Simplified: 1 parcel, 2kg
            parcels = [{
                "parcel_description": "Standard Box",
                "weight": 2.0,
                "height": 10,
                "length": 20,
                "width": 15,
            }]

            # 4. Create Shipment
            shipment = await self.shiplogic.create_shipment(
                order_id=order_id,
                collection_address=collection_address,
                delivery_address=delivery_address,
                parcels=parcels,
                service_level_code="ECO", # Default
                dry_run=dry_run
            )

            if not shipment:
                return {"status": "error", "error": "Failed to create shipment via Shiplogic"}

            # 5. Update Supabase
            if not dry_run:
                # Create shipment record
                await self.supabase.create_shipment(
                    order_no=order_id,
                    shiplogic_shipment_id=shipment.get("shipment_id"),
                    tracking_url=shipment.get("tracking_url"),
                    courier=shipment.get("courier"),
                    shipping_cost=shipment.get("cost"),
                    status=shipment.get("status"),
                    payload=shipment
                )
                
                # Update tracker
                await self.supabase.upsert_order_tracker(
                    order_no=order_id,
                    shipping=shipment.get("cost"),
                    updates=f"Shipment created: {shipment.get('tracking_number')}"
                )

            return {
                "status": "success",
                "shipment": shipment
            }

        except Exception as e:
            logger.error("create_shipment_failed", order_id=order_id, error=str(e))
            return {"status": "error", "error": str(e)}

    async def _track_shipment(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Track a shipment.
        """
        order_id = data.get("order_id")
        if not order_id:
            return {"status": "error", "error": "Missing order_id"}
            
        result = await self.shiplogic.track_shipment(order_id)
        if result:
            return {"status": "success", "tracking": result}
        return {"status": "error", "error": "Tracking info not found"}

    async def sync_orders(self) -> Dict[str, Any]:
        """
        Sync recent orders from OpenCart to Supabase.
        Only syncs orders with valid statuses (excludes unconfirmed, cancelled, etc.)
        """
        logger.info("sync_orders_started")
        try:
            # Valid OpenCart status IDs to sync
            # 1 = Pending, 2 = Processing, 15 = Processed (Awaiting Shipment)
            # 18 = Awaiting Payment, 23 = Paid, 29 = Supplier Ordered
            VALID_STATUSES = [1, 2, 15, 18, 23, 29]
            
            # 1. Fetch recent orders
            orders = await self.opencart.get_recent_orders(limit=50)
            
            synced_count = 0
            skipped_count = 0
            errors = 0
            
            for order in orders:
                try:
                    order_id = str(order["order_id"])
                    status_id = order.get("order_status_id")
                    
                    # Skip orders with invalid statuses
                    # Status 0 = Unconfirmed, 7 = Canceled, etc.
                    if status_id not in VALID_STATUSES:
                        logger.debug("sync_order_skipped", order_id=order_id, status_id=status_id, reason="invalid_status")
                        skipped_count += 1
                        continue
                    
                    # 2. Upsert into Supabase
                    # Calculate total cost (revenue)
                    total = float(order.get("total", 0))
                    
                    await self.supabase.upsert_order_tracker(
                        order_no=order_id,
                        order_name=f"Order #{order_id}", # Placeholder name
                        source="opencart",  # Changed from opencart_sync
                        cost=total, # Revenue
                        notes=f"Customer: {order.get('firstname')} {order.get('lastname')} | Email: {order.get('email')}",
                        last_modified_by="system_sync"
                    )
                    synced_count += 1
                    
                except Exception as e:
                    logger.error("sync_order_failed", order_id=order.get("order_id"), error=str(e))
                    errors += 1
            
            logger.info("sync_orders_completed", synced=synced_count, skipped=skipped_count, errors=errors)
            return {"status": "success", "synced": synced_count, "skipped": skipped_count, "errors": errors}
            
        except Exception as e:
            logger.error("sync_orders_failed", error=str(e))
            return {"status": "error", "error": str(e)}

    async def _get_rates(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Get shipping rates."""
        # TODO: Implement full rate fetching logic
        # For now, return mock rates
        return {
            "status": "success",
            "rates": [
                {"service": "Economy", "cost": 100.00},
                {"service": "Express", "cost": 150.00}
            ]
        }

# Global instance
_orders_agent: Optional[OrdersLogisticsAgent] = None

def get_orders_agent() -> OrdersLogisticsAgent:
    """Get or create global OrdersLogisticsAgent instance."""
    global _orders_agent
    if _orders_agent is None:
        _orders_agent = OrdersLogisticsAgent()
    return _orders_agent
