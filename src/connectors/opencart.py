"""OpenCart REST API connector for order and product operations."""
from typing import Any, Dict, Optional

import httpx

from src.utils.config import get_config
from src.utils.logging import AgentLogger

logger = AgentLogger("OpenCartConnector")


class OpenCartConnector:
    """Connector for OpenCart REST API."""

    def __init__(self):
        """Initialize OpenCart API client."""
        self.config = get_config()
        self.base_url = self.config.opencart_base_url.rstrip("/")
        self.client_id = self.config.opencart_client_id
        self.client_secret = self.config.opencart_client_secret
        self.session = httpx.AsyncClient(timeout=30.0)
        logger.info("opencart_connector_initialized", base_url=self.base_url)

    async def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Fetch order details by order ID.

        Args:
            order_id: OpenCart order ID

        Returns:
            Order data dictionary or None if not found
        """
        try:
            # OpenCart REST API endpoint (adjust based on actual implementation)
            url = f"{self.base_url}/index.php?route=api/order/info&order_id={order_id}"

            response = await self.session.get(
                url,
                auth=(self.client_id, self.client_secret),
            )

            if response.status_code == 404:
                logger.warning("order_not_found", order_id=order_id)
                return None

            response.raise_for_status()
            order_data = response.json()

            logger.info("order_fetched", order_id=order_id)
            return order_data

        except httpx.HTTPStatusError as e:
            logger.error("get_order_failed", order_id=order_id, status=e.response.status_code)
            raise
        except Exception as e:
            logger.error("get_order_error", order_id=order_id, error=str(e))
            raise

    async def update_order_status(
        self, order_id: str, status_id: int, comment: Optional[str] = None
    ) -> None:
        """Update order status.

        Args:
            order_id: OpenCart order ID
            status_id: Status ID (e.g., 2=Processing, 3=Shipped, 5=Complete, 7=Cancelled)
            comment: Optional comment/note
        """
        try:
            url = f"{self.base_url}/index.php?route=api/order/history"

            payload = {
                "order_id": order_id,
                "order_status_id": status_id,
            }
            if comment:
                payload["comment"] = comment

            response = await self.session.post(
                url,
                json=payload,
                auth=(self.client_id, self.client_secret),
            )

            response.raise_for_status()
            logger.info("order_status_updated", order_id=order_id, status_id=status_id)

        except Exception as e:
            logger.error("update_order_status_failed", order_id=order_id, error=str(e))
            raise

    async def get_recent_orders(
        self, days_back: int = 30, limit: int = 50
    ) -> list[Dict[str, Any]]:
        """Fetch recent orders from OpenCart.

        Args:
            days_back: Number of days back to fetch (default: 30)
            limit: Maximum number of orders to return (default: 50)

        Returns:
            List of order dictionaries
        """
        try:
            # OpenCart REST API endpoint for order list
            url = f"{self.base_url}/index.php?route=api/order/list"

            params = {
                "limit": limit,
                "sort": "date_added",
                "order": "DESC",
            }

            response = await self.session.get(
                url,
                params=params,
                auth=(self.client_id, self.client_secret),
            )

            response.raise_for_status()
            data = response.json()

            orders = data.get("orders", []) if isinstance(data, dict) else data

            logger.info("orders_fetched", count=len(orders))
            return orders

        except Exception as e:
            logger.error("get_recent_orders_error", error=str(e))
            raise

    async def get_product(self, product_id: str) -> Optional[Dict[str, Any]]:
        """Fetch product details by product ID or SKU.

        Args:
            product_id: Product ID or SKU

        Returns:
            Product data dictionary or None if not found
        """
        try:
            url = f"{self.base_url}/index.php?route=api/product/info&product_id={product_id}"

            response = await self.session.get(
                url,
                auth=(self.client_id, self.client_secret),
            )

            if response.status_code == 404:
                logger.warning("product_not_found", product_id=product_id)
                return None

            response.raise_for_status()
            product_data = response.json()

            logger.info("product_fetched", product_id=product_id)
            return product_data

        except Exception as e:
            logger.error("get_product_error", product_id=product_id, error=str(e))
            raise

    async def close(self) -> None:
        """Close HTTP session."""
        await self.session.aclose()


# Global instance
_opencart_connector: Optional[OpenCartConnector] = None


def get_opencart_connector() -> OpenCartConnector:
    """Get or create global OpenCart connector instance."""
    global _opencart_connector
    if _opencart_connector is None:
        _opencart_connector = OpenCartConnector()
    return _opencart_connector
