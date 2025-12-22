"""Shiplogic API connector (Stage 1 stub - full implementation in Stage 2)."""
from typing import Any, Dict, Optional

import httpx

from src.utils.config import get_config
from src.utils.logging import AgentLogger

logger = AgentLogger("ShiplogicConnector")


class ShiplogicConnector:
    """Connector for Shiplogic shipping API (stub for Stage 1)."""

    def __init__(self):
        """Initialize Shiplogic API client."""
        self.config = get_config()
        self.api_key = self.config.ship_logic_api_key
        self.base_url = "https://api.shiplogic.com/v2"
        self.session = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        logger.info("shiplogic_connector_initialized")

    async def track_shipment(self, order_number: str) -> Optional[Dict[str, Any]]:
        """Track shipment status by order number.

        Args:
            order_number: Order number or tracking reference

        Returns:
            Tracking data dictionary or None if not found
        """
        try:
            url = f"{self.base_url}/track/{order_number}"

            response = await self.session.get(url)

            if response.status_code == 404:
                logger.warning("shipment_not_found", order_number=order_number)
                return None

            response.raise_for_status()
            tracking_data = response.json()

            logger.info("shipment_tracked", order_number=order_number, status=tracking_data.get("status"))
            return tracking_data

        except httpx.HTTPStatusError as e:
            logger.error("track_shipment_failed", order_number=order_number, status=e.response.status_code)
            return None
        except Exception as e:
            logger.error("track_shipment_error", order_number=order_number, error=str(e))
            return None

    async def get_rates(
        self,
        collection_address: Dict[str, Any],
        delivery_address: Dict[str, Any],
        parcels: list[Dict[str, Any]],
        declared_value: float = 0.0,
    ) -> list[Dict[str, Any]]:
        """Get shipping rates for a shipment.
        
        Args:
            collection_address: Collection address details
            delivery_address: Delivery address details
            parcels: List of parcel details
            declared_value: Declared value of goods
            
        Returns:
            List of available rates/services
        """
            url = f"{self.base_url}/rates"
            payload = {
                "collection_address": collection_address,
                "delivery_address": delivery_address,
                "parcels": parcels,
                "declared_value": declared_value,
            }
            
            response = await self.session.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            return data.get("rates", [])

    async def create_shipment(
        self,
        order_id: str,
        collection_address: Dict[str, Any],
        delivery_address: Dict[str, Any],
        parcels: list[Dict[str, Any]],
        collection_contact: Dict[str, Any],
        delivery_contact: Dict[str, Any],
        service_level_code: str = "ECO", # Default to Economy
        special_instructions: str = "",
        declared_value: float = 0.0,
        dry_run: bool = True,
        custom_tracking_reference: str = None,
        customer_reference: str = None,
    ) -> Optional[Dict[str, Any]]:
        """Create a shipment.
        
        Args:
            order_id: Internal order ID (used as reference)
            collection_address: Collection address details
            delivery_address: Delivery address details
            parcels: List of parcel details
            collection_contact: Collection contact details
            delivery_contact: Delivery contact details
            service_level_code: Service level code (e.g. 'ECO', 'ONX')
            special_instructions: Special instructions for courier
            dry_run: If True, returns mock data without calling API
            custom_tracking_reference: Optional custom reference to override default TCG{order_id}
            customer_reference: Optional customer reference (e.g. Supplier Invoice No)
            
        Returns:
            Shipment creation response with tracking details
        """
        tracking_ref = custom_tracking_reference or f"TCG{order_id}"
        cust_ref = customer_reference or order_id

        if dry_run:
            logger.info(
                "create_shipment_dry_run",
                order_id=order_id,
                note="Dry run enabled - returning mock data",
            )
            return {
                "shipment_id": f"DRY-RUN-{order_id}",
                "tracking_number": tracking_ref,
                "tracking_url": f"https://track.shiplogic.com/DRY-RUN-{order_id}",
                "courier": "Dry Run Courier",
                "service_level": service_level_code,
                "estimated_delivery": "3-5 business days",
                "cost": 150.00,
                "status": "pending",
                "customer_reference": cust_ref
            }

        try:
            url = f"{self.base_url}/shipments"
            payload = {
                "collection_address": collection_address,
                "delivery_address": delivery_address,
                "parcels": parcels,
                "collection_contact": collection_contact,
                "delivery_contact": delivery_contact,
                "service_level_code": service_level_code,
                "custom_tracking_reference": tracking_ref,
                "customer_reference": cust_ref,
                "special_instructions_collection": "",
                "special_instructions_delivery": special_instructions,
                "declared_value": declared_value,
            }

            response = await self.session.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            logger.info("shipment_created", order_id=order_id, shipment_id=data.get("id"))
            # Safe parsing helper
            def get_name(obj):
                if isinstance(obj, dict):
                    return obj.get("name")
                return obj

            return {
                "shipment_id": data.get("id"),
                "tracking_number": data.get("tracking_reference") or data.get("custom_tracking_reference") or data.get("short_tracking_reference"),
                "tracking_url": data.get("tracking_url"),
                "courier": get_name(data.get("courier")),
                "service_level": get_name(data.get("service_level")),
                "cost": data.get("cost", 0.0),
                "status": str(get_name(data.get("status")) or "pending").lower(),
            }

        except httpx.HTTPStatusError as e:
            logger.error(
                "create_shipment_http_error", 
                order_id=order_id, 
                status=e.response.status_code, 
                response=e.response.text
            )
            # Raise a more informative error
            raise Exception(f"Shiplogic API Error ({e.response.status_code}): {e.response.text}") from e
            
        except Exception as e:
            logger.error("create_shipment_failed", order_id=order_id, error=str(e))
            raise e

    async def close(self) -> None:
        """Close HTTP session."""
        await self.session.aclose()


# Global instance
_shiplogic_connector: Optional[ShiplogicConnector] = None


def get_shiplogic_connector() -> ShiplogicConnector:
    """Get or create global Shiplogic connector instance."""
    global _shiplogic_connector
    if _shiplogic_connector is None:
        _shiplogic_connector = ShiplogicConnector()
    return _shiplogic_connector
