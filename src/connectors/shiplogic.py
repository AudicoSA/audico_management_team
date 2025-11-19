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

    async def create_shipment(
        self,
        order_id: str,
        customer_name: str,
        address: Dict[str, str],
        parcel_details: Dict[str, Any],
        service_level: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Create a shipment (stub - full implementation in Stage 2).

        Args:
            order_id: OpenCart order ID
            customer_name: Customer name
            address: Delivery address dict with street, city, postal_code, country
            parcel_details: Parcel details (weight, dimensions, value)
            service_level: Service level (default from config)

        Returns:
            Shipment creation response with tracking details
        """
        logger.warning(
            "create_shipment_stub_called",
            order_id=order_id,
            note="Stage 1 stub - returning mock data",
        )

        # Stage 1: Return mock response
        # Stage 2: Implement actual Shiplogic API call
        mock_response = {
            "shipment_id": f"MOCK-{order_id}",
            "tracking_number": f"TRK{order_id}",
            "tracking_url": f"https://track.shiplogic.com/MOCK-{order_id}",
            "courier": "Mock Courier",
            "service_level": service_level or "Express",
            "estimated_delivery": "3-5 business days",
            "cost": 0.00,
            "status": "pending",
        }

        logger.info("shipment_created_mock", order_id=order_id, shipment_id=mock_response["shipment_id"])
        return mock_response

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
