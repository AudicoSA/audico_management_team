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
    ) -> list[Dict[str, Any]]:
        """Get shipping rates for a shipment.
        
        Args:
            collection_address: Collection address details
            delivery_address: Delivery address details
            parcels: List of parcel details
            
        Returns:
            List of available rates/services
        """
        try:
            url = f"{self.base_url}/rates"
            payload = {
                "collection_address": collection_address,
                "delivery_address": delivery_address,
                "parcels": parcels,
            }
            
            response = await self.session.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            return data.get("rates", [])
            
        except Exception as e:
            logger.error("get_rates_failed", error=str(e))
            return []

    async def create_shipment(
        self,
        order_id: str,
        collection_address: Dict[str, Any],
        delivery_address: Dict[str, Any],
        parcels: list[Dict[str, Any]],
        service_level_code: str = "ECO", # Default to Economy
        special_instructions: str = "",
        dry_run: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """Create a shipment.
        
        Args:
            order_id: Internal order ID (used as reference)
            collection_address: Collection address details
            delivery_address: Delivery address details
            parcels: List of parcel details
            service_level_code: Service level code (e.g. 'ECO', 'ONX')
            special_instructions: Special instructions for courier
            dry_run: If True, returns mock data without calling API
            
        Returns:
            Shipment creation response with tracking details
        """
        if dry_run:
            logger.info(
                "create_shipment_dry_run",
                order_id=order_id,
                note="Dry run enabled - returning mock data",
            )
            return {
                "shipment_id": f"DRY-RUN-{order_id}",
                "tracking_number": f"TRK{order_id}",
                "tracking_url": f"https://track.shiplogic.com/DRY-RUN-{order_id}",
                "courier": "Dry Run Courier",
                "service_level": service_level_code,
                "estimated_delivery": "3-5 business days",
                "cost": 150.00,
                "status": "pending",
            }

        try:
            url = f"{self.base_url}/shipments"
            payload = {
                "collection_address": collection_address,
                "delivery_address": delivery_address,
                "parcels": parcels,
                "service_level_code": service_level_code,
                "references": [order_id],
                "special_instructions": special_instructions,
            }

            response = await self.session.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            logger.info("shipment_created", order_id=order_id, shipment_id=data.get("id"))
            return {
                "shipment_id": data.get("id"),
                "tracking_number": data.get("tracking_reference"),
                "tracking_url": data.get("tracking_url"),
                "courier": data.get("courier", {}).get("name"),
                "service_level": data.get("service_level", {}).get("name"),
                "cost": data.get("cost", 0.0),
                "status": data.get("status", {}).get("name", "pending").lower(),
            }

        except Exception as e:
            logger.error("create_shipment_failed", order_id=order_id, error=str(e))
            return None

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
