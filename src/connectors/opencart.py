"""OpenCart Database connector using direct MySQL connection."""
from typing import Any, Dict, Optional, List
import pymysql
import pymysql.cursors
from src.utils.config import get_config
from src.utils.logging import AgentLogger

logger = AgentLogger("OpenCartConnector")

class OpenCartConnector:
    """Connector for OpenCart Database (Direct MySQL)."""

    def __init__(self):
        """Initialize OpenCart Database connection."""
        self.config = get_config()
        
        # Database credentials from config/env
        self.host = self.config.opencart_db_host
        self.port = self.config.opencart_db_port
        self.user = self.config.opencart_db_user
        self.password = self.config.opencart_db_password
        self.db_name = self.config.opencart_db_name
        self.prefix = self.config.opencart_table_prefix or "oc_"
        
        logger.info("opencart_db_connector_initialized", host=self.host, db=self.db_name)

    def _get_connection(self):
        """Create and return a new database connection."""
        try:
            connection = pymysql.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.db_name,
                cursorclass=pymysql.cursors.DictCursor,
                connect_timeout=10
            )
            return connection
        except Exception as e:
            logger.error("db_connection_failed", error=str(e))
            raise

    async def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Fetch order details by order ID directly from DB.

        Args:
            order_id: OpenCart order ID

        Returns:
            Order data dictionary or None if not found
        """
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                # Query main order table
                sql = f"""
                    SELECT 
                        order_id, invoice_no, customer_id,
                        firstname, lastname, email, telephone,
                        order_status_id, total, currency_code,
                        date_added, date_modified,
                        shipping_method,
                        shipping_firstname, shipping_lastname, shipping_company,
                        shipping_address_1, shipping_address_2,
                        shipping_city, shipping_postcode,
                        shipping_zone, shipping_country_id, shipping_country
                    FROM {self.prefix}order
                    WHERE order_id = %s
                    LIMIT 1
                """
                cursor.execute(sql, (order_id,))
                order = cursor.fetchone()

                if not order:
                    logger.warning("order_not_found_in_db", order_id=order_id)
                    return None

                # Query order products
                prod_sql = f"""
                    SELECT name, model, quantity, price, total
                    FROM {self.prefix}order_product
                    WHERE order_id = %s
                """
                cursor.execute(prod_sql, (order_id,))
                products = cursor.fetchall()
                
                # Add products to order dict
                order['products'] = products
                
                # Format shipping address for convenience
                order['shipping_address'] = {
                    'firstname': order.get('shipping_firstname'),
                    'lastname': order.get('shipping_lastname'),
                    'company': order.get('shipping_company'),
                    'address_1': order.get('shipping_address_1'),
                    'address_2': order.get('shipping_address_2'),
                    'city': order.get('shipping_city'),
                    'postcode': order.get('shipping_postcode'),
                    'zone': order.get('shipping_zone'),
                    'country': order.get('shipping_country')
                }

                logger.info("order_fetched_from_db", order_id=order_id)
                return order

        except Exception as e:
            logger.error("get_order_db_error", order_id=order_id, error=str(e))
            return None
        finally:
            if connection:
                connection.close()

    async def get_recent_orders(self, days_back: int = 30, limit: int = 50) -> list[Dict[str, Any]]:
        """Fetch recent orders from OpenCart DB.

        Args:
            days_back: Number of days back to fetch (default: 30)
            limit: Maximum number of orders to return (default: 50)

        Returns:
            List of order dictionaries
        """
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                sql = f"""
                    SELECT 
                        order_id, firstname, lastname, email, telephone,
                        order_status_id, total, date_added
                    FROM {self.prefix}order
                    ORDER BY date_added DESC
                    LIMIT %s
                """
                cursor.execute(sql, (limit,))
                orders = cursor.fetchall()
                
                logger.info("recent_orders_fetched_from_db", count=len(orders))
                return orders

        except Exception as e:
            logger.error("get_recent_orders_db_error", error=str(e))
            return []
        finally:
            if connection:
                connection.close()

    async def update_order_status(
        self, order_id: str, status_id: int, comment: Optional[str] = None
    ) -> None:
        """Update order status in DB.
        
        WARNING: This writes directly to OpenCart tables. Use with caution.
        """
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                # 1. Update main order table
                update_sql = f"""
                    UPDATE {self.prefix}order
                    SET order_status_id = %s, date_modified = NOW()
                    WHERE order_id = %s
                """
                cursor.execute(update_sql, (status_id, order_id))
                
                # 2. Insert into history
                history_sql = f"""
                    INSERT INTO {self.prefix}order_history 
                    (order_id, order_status_id, notify, comment, date_added)
                    VALUES (%s, %s, 0, %s, NOW())
                """
                cursor.execute(history_sql, (order_id, status_id, comment or ""))
                
            connection.commit()
            logger.info("order_status_updated_db", order_id=order_id, status_id=status_id)

        except Exception as e:
            logger.error("update_order_status_db_failed", order_id=order_id, error=str(e))
            raise
        finally:
            if connection:
                connection.close()

    async def close(self) -> None:
        """Close connection (no-op for per-request connection model)."""
        pass


# Global instance
_opencart_connector: Optional[OpenCartConnector] = None


def get_opencart_connector() -> OpenCartConnector:
    """Get or create global OpenCart connector instance."""
    global _opencart_connector
    if _opencart_connector is None:
        _opencart_connector = OpenCartConnector()
    return _opencart_connector
