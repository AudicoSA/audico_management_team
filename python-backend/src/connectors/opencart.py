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

    async def get_recent_orders(self, days_back: int = 30, limit: int = 100) -> list[Dict[str, Any]]:
        """Fetch recent orders from OpenCart DB.

        Args:
            days_back: Number of days back to fetch (default: 30)
            limit: Maximum number of orders to return (default: 100)

        Returns:
            List of order dictionaries
        """
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                sql = f"""
                    SELECT
                        o.order_id, o.firstname, o.lastname, o.email, o.telephone,
                        o.order_status_id, os.name as status_name, o.total, o.date_added,
                        o.shipping_address_1, o.shipping_address_2, o.shipping_city,
                        o.shipping_postcode, o.shipping_zone, o.shipping_country,
                        (
                            SELECT GROUP_CONCAT(CONCAT(op.quantity, 'x ', op.name) SEPARATOR ', ')
                            FROM {self.prefix}order_product op
                            WHERE op.order_id = o.order_id
                        ) as products_summary
                    FROM {self.prefix}order o
                    LEFT JOIN {self.prefix}order_status os ON (o.order_status_id = os.order_status_id AND os.language_id = 1)
                    WHERE o.order_status_id > 0
                      AND o.date_added >= DATE_SUB(NOW(), INTERVAL %s DAY)
                    ORDER BY o.date_added DESC
                    LIMIT %s
                """
                cursor.execute(sql, (days_back, limit))
                orders = cursor.fetchall()

                logger.info("recent_orders_fetched_from_db", count=len(orders), days_back=days_back)
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

    async def get_product_by_sku(self, sku: str) -> Optional[Dict[str, Any]]:
        """Get product details by SKU from OpenCart database.
        
        Args:
            sku: Product SKU
            
        Returns:
            Product dict with id, model, sku, price, quantity or None
        """
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                sql = f"""
                    SELECT 
                        product_id, model, sku, price, quantity, status
                    FROM {self.prefix}product
                    WHERE sku = %s
                    LIMIT 1
                """
                cursor.execute(sql, (sku,))
                product = cursor.fetchone()
                
                if product:
                    logger.info("product_found_by_sku", sku=sku, product_id=product['product_id'])
                    return product
                else:
                    logger.warning("product_not_found", sku=sku)
                    return None
                    
        except Exception as e:
            logger.error("get_product_by_sku_error", sku=sku, error=str(e))
            return None
        finally:
            if connection:
                connection.close()

    async def get_product_by_id(self, product_id: int) -> Optional[Dict[str, Any]]:
        """Get product details by ID from OpenCart database."""
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                sql = f"""
                    SELECT 
                        product_id, model, sku, price, quantity, status
                    FROM {self.prefix}product
                    WHERE product_id = %s
                    LIMIT 1
                """
                cursor.execute(sql, (product_id,))
                product = cursor.fetchone()
                return product
        except Exception as e:
            logger.error("get_product_by_id_error", id=product_id, error=str(e))
            return None
        finally:
            if connection:
                connection.close()

    async def update_product_price(self, product_id: int, price: float) -> bool:
        """Update product price directly in OpenCart database.
        
        Args:
            product_id: OpenCart product_id
            price: New price
            
        Returns:
            True if successful, False otherwise
        """
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                sql = f"UPDATE {self.prefix}product SET price = %s WHERE product_id = %s"
                cursor.execute(sql, (price, product_id))
            connection.commit()
            
            logger.info("product_price_updated", product_id=product_id, price=price)
            return True
            
        except Exception as e:
            if connection:
                connection.rollback()
            logger.error("update_price_failed", product_id=product_id, error=str(e))
            return False
        finally:
            if connection:
                connection.close()

    async def update_product_stock(self, product_id: int, quantity: int) -> bool:
        """Update product stock quantity directly in OpenCart database.
        
        Args:
            product_id: OpenCart product_id
            quantity: New stock quantity
            
        Returns:
            True if successful, False otherwise
        """
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                sql = f"UPDATE {self.prefix}product SET quantity = %s WHERE product_id = %s"
                cursor.execute(sql, (quantity, product_id))
            connection.commit()
            
            logger.info("product_stock_updated", product_id=product_id, quantity=quantity)
            return True
            
        except Exception as e:
            if connection:
                connection.rollback()
            logger.error("update_stock_failed", product_id=product_id, error=str(e))
            return False
        finally:
            if connection:
                connection.close()

    async def bulk_update_products(self, updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Bulk update multiple products in a single transaction.
        
        Args:
            updates: List of dicts with keys: product_id, price (optional), quantity (optional)
            
        Returns:
            Dict with success count, failed count, and errors
        """
        connection = None
        success_count = 0
        failed_count = 0
        errors = []
        
        try:
            connection = self._get_connection()
            
            for update in updates:
                try:
                    product_id = update['product_id']
                    
                    with connection.cursor() as cursor:
                        # Build dynamic UPDATE query
                        set_clauses = []
                        params = []
                        
                        if 'price' in update:
                            set_clauses.append("price = %s")
                            params.append(update['price'])
                        
                        if 'quantity' in update:
                            set_clauses.append("quantity = %s")
                            params.append(update['quantity'])
                        
                        if not set_clauses:
                            continue
                        
                        params.append(product_id)
                        sql = f"UPDATE {self.prefix}product SET {', '.join(set_clauses)} WHERE product_id = %s"
                        cursor.execute(sql, params)
                    
                    success_count += 1
                    
                except Exception as e:
                    failed_count += 1
                    errors.append({
                        'product_id': update.get('product_id'),
                        'error': str(e)
                    })
            
            connection.commit()
            logger.info("bulk_update_completed", success=success_count, failed=failed_count)
            
            return {
                'success': True,
                'updated': success_count,
                'failed': failed_count,
                'errors': errors
            }
            
        except Exception as e:
            if connection:
                connection.rollback()
            logger.error("bulk_update_failed", error=str(e))
            return {
                'success': False,
                'updated': 0,
                'failed': len(updates),
                'errors': [{'error': str(e)}]
            }
        finally:
            if connection:
                connection.close()

    async def get_manufacturer_by_name(self, name: str) -> Optional[Dict]:
        """Get manufacturer by name."""
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                sql = f"SELECT * FROM {self.prefix}manufacturer WHERE name = %s"
                cursor.execute(sql, (name,))
                return cursor.fetchone()
        except Exception as e:
            logger.error("get_manufacturer_failed", name=name, error=str(e))
            return None
        finally:
            if connection:
                connection.close()

    async def get_products_by_manufacturer(self, manufacturer_id: int) -> List[Dict]:
        """Get all products for a manufacturer."""
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                sql = f"""
                    SELECT p.product_id, p.model, p.quantity, p.price, pd.name 
                    FROM {self.prefix}product p
                    LEFT JOIN {self.prefix}product_description pd ON (p.product_id = pd.product_id)
                    WHERE p.manufacturer_id = %s AND pd.language_id = 1
                """
                cursor.execute(sql, (manufacturer_id,))
                return cursor.fetchall()
        except Exception as e:
            logger.error("get_manufacturer_products_failed", id=manufacturer_id, error=str(e))
            return []
            if connection:
                connection.close()

    async def get_product_by_model(self, model: str) -> Optional[Dict]:
        """Get product by exact model match."""
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                sql = f"""
                    SELECT p.product_id, p.model, p.sku, p.quantity, p.price, pd.name, m.name as manufacturer
                    FROM {self.prefix}product p
                    LEFT JOIN {self.prefix}product_description pd ON (p.product_id = pd.product_id)
                    LEFT JOIN {self.prefix}manufacturer m ON (p.manufacturer_id = m.manufacturer_id)
                    WHERE p.model = %s AND pd.language_id = 1
                """
                cursor.execute(sql, (model,))
                result = cursor.fetchone()
                return result
        except Exception as e:
            logger.error("get_product_by_model_failed", model=model, error=str(e))
            return None
        finally:
            if connection:
                connection.close()

    async def search_products_by_name(self, query: str) -> List[Dict]:
        """Search products by name - flexible multi-token matching with progressive relaxation
        and model number normalization (handles RP1400SW vs RP-1400SW)."""
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                import re

                # Common stop words that hurt matching
                stop_words = {
                    'the', 'and', 'with', 'for', 'from', 'free', 'new', 'pro',
                    'series', 'edition', 'version', 'model', 'type', 'style',
                    'pair', 'set', 'kit', 'pack', 'bundle', 'combo', 'single',
                    'matte', 'gloss', 'active', 'passive', 'powered', 'wireless',
                    'wired', 'portable', 'indoor', 'outdoor', 'heritage',
                    'inspired', 'premium', 'standard', 'basic', 'advanced',
                    'eua', 'usa', 'black', 'white', 'silver', 'walnut', 'oak',
                    'ebony', 'cherry', 'each', 'per',
                }

                # Extract all words
                words = re.findall(r'\w+', query.lower())
                all_sig_words = [w for w in words if len(w) > 2 or any(c.isdigit() for c in w)]

                if not all_sig_words:
                    return []

                # Detect model numbers: words with both letters and digits (e.g. rp1400sw, ht50d)
                def _is_model_number(w):
                    return bool(re.search(r'[a-z]', w)) and bool(re.search(r'\d', w))

                model_numbers = [w for w in all_sig_words if _is_model_number(w)]

                # Split into core words (brand/model) and descriptor words
                core_words = [w for w in all_sig_words if w not in stop_words]
                if not core_words:
                    core_words = all_sig_words[:3]

                results = []
                seen_ids = set()

                base_sql = f"""
                    SELECT p.product_id, p.model, p.sku, p.quantity, p.price, pd.name, m.name as manufacturer
                    FROM {self.prefix}product p
                    LEFT JOIN {self.prefix}product_description pd ON (p.product_id = pd.product_id)
                    LEFT JOIN {self.prefix}manufacturer m ON (p.manufacturer_id = m.manufacturer_id)
                """

                def _run_search(word_list):
                    """Execute AND search with given word list, return new results."""
                    if not word_list:
                        return []
                    conditions = [f"LOWER(pd.name) LIKE %s" for _ in word_list]
                    params = [f"%{w}%" for w in word_list]
                    where_clause = " AND ".join(conditions)
                    sql = f"{base_sql} WHERE {where_clause} AND pd.language_id = 1 LIMIT 50"
                    cursor.execute(sql, tuple(params))
                    return cursor.fetchall()

                def _run_normalized_search(word_list):
                    """Search with dashes/hyphens stripped from both query and DB name.
                    Handles model number mismatches like RP1400SW vs RP-1400SW."""
                    if not word_list:
                        return []
                    conditions = [f"LOWER(REPLACE(pd.name, '-', '')) LIKE %s" for _ in word_list]
                    # Strip dashes from search terms too
                    params = [f"%{w.replace('-', '')}%" for w in word_list]
                    where_clause = " AND ".join(conditions)
                    sql = f"{base_sql} WHERE {where_clause} AND pd.language_id = 1 LIMIT 50"
                    cursor.execute(sql, tuple(params))
                    return cursor.fetchall()

                def _collect(new_results):
                    """Add new results avoiding duplicates."""
                    for r in new_results:
                        if r['product_id'] not in seen_ids:
                            results.append(r)
                            seen_ids.add(r['product_id'])

                # Strategy 1: AND with all significant words (strictest)
                _collect(_run_search(all_sig_words))

                # Strategy 2: Same but with dash-normalized search (RP1400SW matches RP-1400SW)
                if len(results) < 5:
                    _collect(_run_normalized_search(all_sig_words))

                # Strategy 3: AND with core words only (no stop words)
                if len(results) < 5 and core_words != all_sig_words:
                    _collect(_run_search(core_words))
                    if len(results) < 5:
                        _collect(_run_normalized_search(core_words))

                # Strategy 4: Model number search - brand + model number only
                # e.g. "Klipsch" + "RP1400SW" → matches "KLIPSCH RP-1400SW ..."
                if len(results) < 5 and model_numbers and core_words:
                    brand = core_words[0]
                    for model in model_numbers:
                        _collect(_run_normalized_search([brand, model]))
                        if len(results) >= 10:
                            break

                # Strategy 5: Progressive relaxation - drop words from end of core
                if len(results) < 5 and len(core_words) > 2:
                    for n in range(len(core_words) - 1, max(1, len(core_words) // 2) - 1, -1):
                        subset = core_words[:n]
                        _collect(_run_search(subset))
                        if len(results) < 5:
                            _collect(_run_normalized_search(subset))
                        if len(results) >= 10:
                            break

                # Strategy 6: Brand + any one other core word
                if len(results) < 5 and len(core_words) >= 2:
                    brand = core_words[0]
                    for extra_word in core_words[1:4]:
                        _collect(_run_search([brand, extra_word]))
                        if len(results) >= 20:
                            break

                logger.info("search_products_by_name", query=query[:50],
                            core_words=core_words, model_numbers=model_numbers,
                            total_words=len(all_sig_words), results=len(results))
                return results[:50]
        except Exception as e:
            logger.error("search_products_failed", query=query[:50], error=str(e))
            return []
        finally:
            if connection:
                connection.close()

    async def add_product_special(self, product_id: int, price: float, date_start: str = None, date_end: str = None, priority: int = 1) -> bool:
        """
        Add a special price to a product.
        """
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                # Default dates if None
                if not date_start: date_start = "0000-00-00"
                if not date_end: date_end = "0000-00-00"
                
                # Check for existing special? Or just add new one?
                # Usually we might want to clear old specials first or check if one exists.
                # For this implementation, we will INSERT a new one.
                sql = f"""
                    INSERT INTO {self.prefix}product_special 
                    (product_id, customer_group_id, priority, price, date_start, date_end)
                    VALUES (%s, 1, %s, %s, %s, %s)
                """
                # customer_group_id = 1 (Default Retail)
                cursor.execute(sql, (product_id, priority, price, date_start, date_end))
                
                # IMPORTANT: Update date_modified on main product table to trigger cache invalidation
                cursor.execute(f"UPDATE {self.prefix}product SET date_modified = NOW() WHERE product_id = %s", (product_id,))
                
            connection.commit()
            logger.info("product_special_added", product_id=product_id, price=price)
            return True
            
        except Exception as e:
            if connection: connection.rollback()
            logger.error("add_product_special_failed", product_id=product_id, error=str(e))
            return False
        finally:
            if connection: connection.close()

    async def clear_product_specials(self, product_id: int) -> bool:
        """Remove all specials for a product."""
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                sql = f"DELETE FROM {self.prefix}product_special WHERE product_id = %s"
                cursor.execute(sql, (product_id,))
            connection.commit()
            return True
        except Exception as e:
            if connection: connection.rollback()
            logger.error("clear_product_specials_failed", product_id=product_id, error=str(e))
            return False
        finally:
            if connection: connection.close()

    async def create_product(self, product_data: Dict[str, Any]) -> Optional[int]:
        """Create a new product in OpenCart (with pre-creation duplicate check)."""
        connection = None
        try:
            connection = self._get_connection()
            with connection.cursor() as cursor:
                # Pre-creation safety: check if SKU already exists in OpenCart
                sku = product_data.get('sku')
                if sku:
                    cursor.execute(
                        f"SELECT product_id FROM {self.prefix}product WHERE sku = %s LIMIT 1",
                        (sku,)
                    )
                    existing = cursor.fetchone()
                    if existing:
                        logger.info("create_product_skipped_duplicate", sku=sku, existing_id=existing['product_id'])
                        return existing['product_id']

                # 1. Insert into product table
                sql_product = f"""
                    INSERT INTO {self.prefix}product 
                    (model, sku, quantity, stock_status_id, image, manufacturer_id, shipping, price, 
                    points, tax_class_id, date_available, weight, weight_class_id, length, width, height, 
                    length_class_id, subtract, minimum, sort_order, status, viewed, date_added, date_modified)
                    VALUES 
                    (%s, %s, %s, 7, '', %s, 1, %s, 0, 0, NOW(), 0, 1, 0, 0, 0, 1, 1, 1, 0, %s, 0, NOW(), NOW())
                """
                cursor.execute(sql_product, (
                    product_data['sku'], # model = sku
                    product_data['sku'],
                    product_data['quantity'],
                    product_data['manufacturer_id'],
                    product_data['price'],
                    product_data['status']
                ))
                product_id = cursor.lastrowid
                
                # 2. Insert into product_description
                sql_desc = f"""
                    INSERT INTO {self.prefix}product_description 
                    (product_id, language_id, name, description, tag, meta_title, meta_description, meta_keyword)
                    VALUES (%s, 1, %s, '', '', %s, '', '')
                """
                cursor.execute(sql_desc, (
                    product_id,
                    product_data['name'],
                    product_data['name'] # meta_title = name
                ))
                
                # 3. Insert into product_to_store (Default store 0)
                sql_store = f"INSERT INTO {self.prefix}product_to_store (product_id, store_id) VALUES (%s, 0)"
                cursor.execute(sql_store, (product_id,))
                
                connection.commit()
                return product_id
                
        except Exception as e:
            logger.error("create_product_failed", sku=product_data.get('sku'), error=str(e))
            if connection:
                connection.rollback()
            return None
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
