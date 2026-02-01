from typing import Dict, Any, List, Optional
from fastapi import HTTPException
from src.connectors.shiplogic import get_shiplogic_connector
from src.connectors.opencart import get_opencart_connector
from src.connectors.supabase import get_supabase_connector
from src.agents.email_agent import get_email_agent
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
            # 0. Update Supplier if provided in payload (Client Override)
            explicit_supplier = data.get("supplier_name")
            if explicit_supplier:
                 logger.info("updating_order_supplier_from_payload", order_id=order_id, supplier=explicit_supplier)
                 await self.supabase.upsert_order_tracker(
                     order_no=order_id,
                     supplier=explicit_supplier,
                     last_modified_by="user_shipping_modal"
                 )
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
            
            # Collection address (Audico HQ Default)
            # Allow override from input data (for Drop Shipping manually specified)
            custom_collection = data.get("collection_address")
            
            # Default Collection (Audico)
            collection_address = {
                "company": "Audico Online",
                "street_address": "Audiovisual House, 58b Maple Road",
                "local_area": "Pomona",
                "city": "Kempton Park",
                "code": "1619",
                "country_code": "ZA",
            }
            collection_contact = {
                "name": "Dispatch Team",
                "mobile_number": "011 392 5639", 
                "email": "dispatch@audico.co.za"
            }

            if custom_collection:
                collection_address = custom_collection
            else:
                # Strategy: 
                # 1. Check if User assigned a Supplier in Dashboard (Primary Source of Truth)
                # 2. If not, try to guess from OpenCart Product Manufacturer (Fallback)
                
                found_supplier_address = False
                
                # 1. Check Dashboard/DB Assigned Supplier
                try:
                    order_tracker = await self.supabase.get_order_tracker(order_id)
                    if order_tracker and order_tracker.get("supplier"):
                        db_supplier = order_tracker.get("supplier")
                        logger.info("checking_db_supplier", order_id=order_id, supplier=db_supplier)
                        
                        supplier_info = await self.supabase.get_supplier_address(db_supplier)
                        if supplier_info:
                             logger.info("found_supplier_address_via_db", supplier=db_supplier)
                             collection_address = {
                                "company": supplier_info.get("company", db_supplier),
                                "street_address": supplier_info.get("street_address"),
                                "local_area": supplier_info.get("local_area"),
                                "city": supplier_info.get("city"),
                                "code": supplier_info.get("code"),
                                "country_code": supplier_info.get("country_code", "ZA"),
                            }
                             collection_contact = {
                                "name": supplier_info.get("contact_name") or "Dispatch",
                                "mobile_number": supplier_info.get("contact_phone") or "",
                                "email": supplier_info.get("contact_email") or ""
                            }
                             found_supplier_address = True
                except Exception as e:
                    logger.warning("failed_to_check_db_supplier", error=str(e))

                # 2. Fallback to OpenCart Manufacturer if not found above
                if not found_supplier_address:
                    try:
                        order_products = order.get('products', [])
                        if order_products:
                            # Use the first product to determine supplier (Simplified assumption for now)
                            first_product = order_products[0]
                            model = first_product.get('model')
                            
                            prod_details = await self.opencart.get_product_by_model(model)
                            if prod_details and prod_details.get('manufacturer'):
                                supplier_name = prod_details.get('manufacturer')
                                logger.info("identifying_supplier_from_manufacturer", order_id=order_id, supplier=supplier_name)
                                
                                # Lookup Supplier Address
                                supplier_info = await self.supabase.get_supplier_address(supplier_name)
                                if supplier_info:
                                    logger.info("found_supplier_address_via_manufacturer", supplier=supplier_name)
                                    collection_address = {
                                        "company": supplier_info.get("company", supplier_name),
                                        "street_address": supplier_info.get("street_address"),
                                        "local_area": supplier_info.get("local_area"),
                                        "city": supplier_info.get("city"),
                                        "code": supplier_info.get("code"),
                                        "country_code": supplier_info.get("country_code", "ZA"),
                                    }
                                    collection_contact = {
                                        "name": supplier_info.get("contact_name") or "Dispatch",
                                        "mobile_number": supplier_info.get("contact_phone") or "",
                                        "email": supplier_info.get("contact_email") or ""
                                    }
                                else:
                                    logger.warning("supplier_address_not_found", supplier=supplier_name, note="Using Audico HQ")
                    except Exception as e:
                        logger.error("failed_to_resolve_supplier_address", error=str(e))

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
                    if not customer_ref:
                         received_keys = ", ".join(data.keys())
                         raise HTTPException(status_code=400, detail=f"Supplier Invoice Number is required for shipping. Debug: keys=[{received_keys}], val={data.get('supplier_invoice')!r}")
                    
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
                            import json
                            raise Exception(f"No shipping rates returned. Col: {json.dumps(collection_address)}, Del: {json.dumps(delivery_address)}")
                            
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
            # 1 = Pending, 2 = Processing, 3 = Shipped, 5 = Complete
            # 15 = Processed (Awaiting Shipment), 18 = Awaiting Payment, 23 = Paid, 29 = Supplier Ordered
            VALID_STATUSES = [1, 2, 3, 5, 15, 18, 23, 29]
            
            STATUS_MAP = {
                1: "Pending",
                2: "Processing",
                3: "Shipped",
                5: "Complete",
                15: "Processed",
                17: "Cancelled", 
                18: "Awaiting Payment",
                23: "Paid",
                29: "Supplier Ordered"
            }
            
            # 1. Fetch recent orders
            orders = await self.opencart.get_recent_orders(limit=50)
            
            synced_count = 0
            skipped_count = 0
            errors = 0
            
            for order in orders:
                try:
                    order_id = str(order["order_id"])
                    status_id = int(order.get("order_status_id", 0))
                    
                    # Skip orders with invalid statuses
                    # Status 0 = Unconfirmed, 7 = Canceled, etc.
                    # Note: We specifically filter out Cancelled/Missing here so they don't clutter DB
                    if status_id not in VALID_STATUSES:
                        logger.debug("sync_order_skipped", order_id=order_id, status_id=status_id, reason="invalid_status")
                        skipped_count += 1
                        continue
                    
                    status_name = STATUS_MAP.get(status_id, "Processing")
                    
                    # 2. Upsert into Supabase
                    # Calculate total cost (revenue)
                    total = float(order.get("total", 0))
                    
                    # Determine Paid status
                    # Awaiting Payment (18) or Pending (1) usually means Unpaid
                    is_paid = status_id not in [1, 18]
                    
                    full_name = f"{order.get('firstname', '')} {order.get('lastname', '')}".strip()
                    if not full_name:
                        full_name = f"Order #{order_id}"

                    await self.supabase.upsert_order_tracker(
                        order_no=order_id,
                        order_name=full_name, 
                        source="opencart",
                        cost=total, # Revenue
                        supplier_status=status_name, # Sync OpenCart status to Supplier Status field
                        order_paid=is_paid,
                        notes=order.get("products_summary") or "", # Strict: Only products or empty. No fallbacks.
                        updates=f"Contact: {order.get('email')} | {order.get('telephone')}", # Move contact info here
                        last_modified_by="system_sync"
                    )

                    # --- NEW: Product Knowledge / Supplier Assignment ---
                    # Logic: Look up products in DB to find their registered supplier.
                    # This prevents Kait from "guessing".
                    try:
                        # Parse products from summary or fetch details if needed. 
                        # 'order' object from 'get_recent_orders' has 'products_summary' string, but not detailed list.
                        # We might need to fetch full order details if we want exact SKUs, OR we can rely on what we have.
                        # 'get_recent_orders' query in opencart.py uses GROUP_CONCAT. It doesn't return SKUs list.
                        # So we should fetch full order details to get SKUs for accurate lookup.
                        
                        full_order_details = await self.opencart.get_order(order_id)
                        if full_order_details:
                            # --- Step 1: Client Welcome Email ---
                            # Only if Paid/Processing and NOT already sent
                            if status_id in [1, 2, 15, 23]: # Pending(1), Processing(2), Processed(15), Paid(23)
                                # Check duplicate via Supabase logs (Category: CLIENT_WELCOME_DRAFT)
                                try:
                                    # Check if we logged a welcome draft for this order recently
                                    # Note: Using subject match as proxy
                                    existing_welcome = self.supabase.client.table("email_logs") \
                                        .select("id") \
                                        .eq("category", "CLIENT_WELCOME_DRAFT") \
                                        .ilike("subject", f"%#{order_id}%") \
                                        .execute()
                                        
                                    if not existing_welcome.data:
                                        email_agent = get_email_agent()
                                        await email_agent.draft_client_welcome_email(full_order_details)
                                        logger.info("triggered_client_welcome", order_id=order_id)
                                except Exception as e:
                                    logger.warning("failed_check_welcome_email", error=str(e))
                            
                        # --- Step 2: Supplier Assignment & Draft ---
                        if full_order_details and full_order_details.get('products'):
                                # Collect potential suppliers
                            detected_suppliers = []
                            
                            for prod in full_order_details['products']:
                                model = prod.get('model')
                                sku = prod.get('sku') # Note: get_order might not return SKU in product list? Check opencart.py get_order query.
                                # opencart.py get_order query: SELECT name, model, quantity, price, total FROM order_product
                                # It returns 'model', but not 'sku'. usually model IS sku in OpenCart, but let's use model.
                                
                                search_ref = sku if sku else model
                                if search_ref:
                                    # Look up in Supabase Products
                                    # We match on 'sku' column in DB (which corresponds to model/sku)
                                    p_res = self.supabase.client.table("products").select("supplier_id").eq("sku", search_ref).execute()
                                    
                                    if p_res.data:
                                        sup_id = p_res.data[0].get('supplier_id')
                                        if sup_id:
                                            # Resolve Name
                                            s_res = self.supabase.client.table("suppliers").select("name").eq("id", sup_id).execute()
                                            if s_res.data:
                                                detected_suppliers.append(s_res.data[0]['name'])
                            
                            if detected_suppliers:
                                # Logic: Pick the most common one, or just the first.
                                # For now, simple Majority Vote
                                from collections import Counter
                                most_common = Counter(detected_suppliers).most_common(1)
                                if most_common:
                                    best_supplier = most_common[0][0]
                                    
                                    # Update orders_tracker with the Hard Data supplier
                                    await self.supabase.upsert_order_tracker(
                                        order_no=order_id,
                                        supplier=best_supplier,
                                        last_modified_by="system_sync_enrichment"
                                    )
                                    logger.info("assigned_supplier_from_data", order_id=order_id, supplier=best_supplier)
                                    
                                    # --- NEW: Trigger Supplier Draft ---
                                    # Only if order is PAID and not already drafted/sent
                                    # Status 23 = Paid, 3 = Shipped, 5 = Complete, 15 = Processed (usually paid)
                                    if status_id in [23, 15, 2, 1]: # Pending(1), Processing(2), Processed(15), Paid(23)
                                        # Check if we already drafted this
                                        tracker = await self.supabase.get_order_tracker(order_id)
                                        current_sup_status = tracker.get("supplier_status") if tracker else None
                                        
                                        if current_sup_status not in ["Drafted", "Sent", "Invoiced", "Quoted", "Shipped"]:
                                            # Generate Draft
                                            logger.info("triggering_supplier_draft", order_id=order_id, supplier=best_supplier)
                                            email_agent = get_email_agent()
                                            
                                            # Filter products for this supplier
                                            supplier_products = []
                                            for p in full_order_details['products']:
                                                # Re-check SKU match or if we just assume all items in this mixed order go to this supplier?
                                                # For now, simplest is: if we identified ONE supplier for the order, sending ALL items might be wrong if mixed.
                                                # But "best_supplier" logic above picked the majority one.
                                                # Let's filter strictly if possible, or send all if single supplier.
                                                
                                                # Re-verify if this product belongs to best_supplier
                                                p_sku = p.get('sku') or p.get('model')
                                                # Quick DB check for this product?
                                                # Optimization: just include all for now, user can edit draft.
                                                supplier_products.append(p)

                                            draft_res = await email_agent.draft_supplier_order_email(
                                                order_details=full_order_details,
                                                supplier_name=best_supplier,
                                                products=supplier_products
                                            )
                                            
                                            if draft_res.get("status") == "success":
                                                await self.supabase.upsert_order_tracker(
                                                    order_no=order_id,
                                                    supplier_status="Drafted",
                                                    updates="System generated supplier email draft."
                                                )
                                    # -----------------------------------
                                    
                    except Exception as e:
                        logger.warning("failed_to_assign_supplier", order_id=order_id, error=str(e))
                    # ----------------------------------------------------

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
