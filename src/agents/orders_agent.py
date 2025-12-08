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
            # Check if payload provided an override (User Edit in Dashboard)
            custom_delivery = data.get("delivery_address")
            if custom_delivery:
                 delivery_address = custom_delivery
                 # Ensure defaults
                 if not delivery_address.get("country_code"):
                     delivery_address["country_code"] = "ZA"
            else:
                # Map OpenCart address to Shiplogic format (Handle Flat Structure)
                
                # Construct Street Address
                addr1 = order.get("shipping_address_1") or order.get("payment_address_1") or ""
                addr2 = order.get("shipping_address_2") or order.get("payment_address_2") or ""
                street = f"{addr1} {addr2}".strip()
                
                city = order.get("shipping_city") or order.get("payment_city") or ""
                postcode = order.get("shipping_postcode") or order.get("payment_postcode") or ""
                zone = order.get("shipping_zone") or order.get("payment_zone") or ""
                company = order.get("shipping_company") or order.get("payment_company") or ""

                delivery_address = {
                    "company": company,
                    "street_address": street,
                    "local_area": city, # Often city is the best proxy, or use suburb if available
                    "city": city,
                    "code": postcode,
                    "zone": zone,
                    "country_code": "ZA", # Default to ZA
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
                "submitted_weight_kg": 2.0,
                "submitted_height_cm": 10,
                "submitted_length_cm": 20,
                "submitted_width_cm": 15,
            }]

            # 4. Prepare contacts
            delivery_contact = {
                "name": f"{order.get('firstname', '')} {order.get('lastname', '')}".strip(),
                "mobile_number": order.get("telephone", ""),
                "email": order.get("email", "")
            }
            
            # Default Collection Contact (Audico)
            collection_contact = {
                "name": "Dispatch Team",
                "mobile_number": "", 
                "email": "dispatch@audico.co.za"
            }

            # 5. Create Shipment
            # Retry logic for duplicate references (e.g. TCG123 -> TCG123-1)
            max_retries = 3
            current_try = 0
            shipment = None
            shipment = None
            last_error = None
            
            declared_value = float(data.get("declared_value", 0.0))
            
            while current_try <= max_retries:
                try:
                    # Construct reference suffix if retrying
                    custom_ref = None
                    if current_try > 0:
                        custom_ref = f"TCG{order_id}-{current_try}"
                        logger.info("retrying_shipment_creation", attempt=current_try, new_ref=custom_ref)

                    # Extract supplier invoice / customer reference
                    customer_ref = data.get("supplier_invoice")
                    logger.info("creating_shipment_params", order_id=order_id, supplier_invoice=customer_ref, custom_ref=custom_ref)

                    # Determine Service Level (Dynamic Fallback)
                    # Use strictly what is available from Shiplogic
                    service_level = None
                    try:
                        rates = await self.shiplogic.get_rates(collection_address, delivery_address, parcels, declared_value)
                        # Helper to safely extract code
                        def get_code(r):
                            sl = r.get('service_level')
                            if isinstance(sl, dict):
                                return sl.get('code')
                            return r.get('service_level_code') # Fallback if flattened

                        logger.info("fetched_rates", order_id=order_id, count=len(rates), rates=[get_code(r) for r in rates])
                        
                        if not rates:
                            raise Exception("No shipping rates returned by Shiplogic for this route.")
                            
                        available_services = {get_code(r): r for r in rates}
                        
                        # Preference Logic
                        if "LOX" in available_services:
                            service_level = "LOX"
                        elif "ECO" in available_services:
                            service_level = "ECO"
                        else:
                            # Fallback to the first available service (any)
                            # We sort by cost just to be nice (safest default)
                            # Note: key might be 'total', 'cost', 'total_charge'
                            def get_cost(r):
                                return float(r.get('total') or r.get('cost') or r.get('total_charge') or 999999.0)
                                
                            cheapest_rate = sorted(rates, key=get_cost)[0]
                            service_level = get_code(cheapest_rate)
                            
                        logger.info("service_level_selected", order_id=order_id, selected=service_level)
                                               
                    except Exception as e:
                        logger.warning("failed_to_fetch_rates_dynamic_logic", error=str(e))
                        # If we can't get rates, we can't reliably guess. 
                        # But for backward compatibility/desperation, we *could* try ECO, but that's what caused the 400.
                        # Better to fail or throw clearly.
                        if "No shipping rates" in str(e):
                            raise e
                        # If it was an API error, maybe default ECO is worth a shot (risky)
                        # Let's fail fast.
                        raise Exception(f"Could not determine valid service level: {str(e)}")

                    shipment = await self.shiplogic.create_shipment(
                        order_id=order_id,
                        collection_address=collection_address,
                        delivery_address=delivery_address,
                        parcels=parcels,
                        collection_contact=collection_contact,
                        delivery_contact=delivery_contact,
                        service_level_code=service_level,
                        dry_run=dry_run,
                        custom_tracking_reference=custom_ref,
                        customer_reference=customer_ref,
                        declared_value=declared_value
                    )

                    if shipment:
                        break # Success
                        
                except Exception as e:
                    last_error = e
                    logger.warning("create_shipment_attempt_failed", attempt=current_try, error=str(e))
                
                current_try += 1

            if not shipment:
                 # If we exhausted retries or failed
                error_msg = str(last_error) if last_error else "Failed to create shipment via Shiplogic"
                return {"status": "error", "error": error_msg}

            # 6. Update Supabase
            if not dry_run:
                # Normalize status for Supabase enum/check constraint
                raw_status = shipment.get("status")
                # Map Shiplogic statuses to simple stats allowed by DB
                valid_db_statuses = ["pending", "booked", "shipped", "delivered", "cancelled"]
                
                db_status = "pending"
                if raw_status in ["collection-assigned", "collection-unassigned", "submitted"]:
                    db_status = "booked"
                elif raw_status in ["collected", "in-transit", "at-hub", "out-for-delivery"]:
                     db_status = "shipped"
                elif raw_status == "delivered":
                    db_status = "delivered"
                elif raw_status == "cancelled":
                    db_status = "cancelled"
                
                # Create shipment record
                await self.supabase.create_shipment(
                    order_no=order_id,
                    shiplogic_shipment_id=shipment.get("shipment_id"),
                    tracking_url=shipment.get("tracking_url"),
                    courier=shipment.get("courier"),
                    shipping_cost=shipment.get("cost"),
                    status=db_status,
                    payload=shipment
                )
                
                # Update tracker
                await self.supabase.upsert_order_tracker(
                    order_no=order_id,
                    supplier_status="Shipped", 
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
                        notes=f"Customer: {order.get('firstname')} {order.get('lastname')} | Email: {order.get('email')} | Address: {order.get('shipping_address_1', '')}, {order.get('shipping_city', '')}, {order.get('shipping_postcode', '')}",
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
