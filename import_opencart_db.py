"""
Import real orders from OpenCart database to Supabase.

Uses direct MySQL connection for reliable data access.
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, List
from dotenv import load_dotenv
import pymysql
import pymysql.cursors

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.supabase import SupabaseConnector
from utils.logging import AgentLogger, setup_logging

# Load environment variables
load_dotenv()

# Setup logging
setup_logging()
logger = AgentLogger("opencart_db_import")


def connect_to_opencart():
    """Connect to OpenCart MySQL database."""
    return pymysql.connect(
        host=os.getenv("OPENCART_DB_HOST"),
        port=int(os.getenv("OPENCART_DB_PORT", "3306")),
        user=os.getenv("OPENCART_DB_USER"),
        password=os.getenv("OPENCART_DB_PASSWORD"),
        database=os.getenv("OPENCART_DB_NAME"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


async def import_orders(days_back: int = 30, limit: int = 100):
    """
    Import orders from OpenCart database to Supabase.

    Args:
        days_back: How many days back to fetch orders (default: 30)
        limit: Maximum number of orders to import (default: 100)
    """
    try:
        logger.info("import_started", days_back=days_back, limit=limit)
        print(f"\nImporting orders from OpenCart database...")
        print(f"Period: Last {days_back} days")
        print(f"Limit: {limit} orders\n")

        # Connect to OpenCart database
        print("Connecting to OpenCart database...")
        conn = connect_to_opencart()
        prefix = os.getenv("OPENCART_TABLE_PREFIX", "oc_")

        # Initialize Supabase
        supabase = SupabaseConnector()

        # Fetch recent orders
        with conn.cursor() as cursor:
            # Get order date threshold
            date_threshold = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")

            query = f"""
                SELECT
                    o.order_id,
                    o.invoice_no,
                    o.customer_id,
                    CONCAT(o.firstname, ' ', o.lastname) as customer_name,
                    o.email,
                    o.telephone,
                    o.payment_method,
                    o.shipping_method,
                    o.total,
                    o.order_status_id,
                    os.name as status_name,
                    o.date_added,
                    o.date_modified,
                    o.comment
                FROM {prefix}order o
                LEFT JOIN {prefix}order_status os ON o.order_status_id = os.order_status_id AND os.language_id = 1
                WHERE o.date_added >= %s
                ORDER BY o.date_added DESC
                LIMIT %s
            """

            cursor.execute(query, (date_threshold, limit))
            orders = cursor.fetchall()

        if not orders:
            print("No orders found in database")
            logger.warning("no_orders_found")
            conn.close()
            return

        print(f"Found {len(orders)} orders from OpenCart\n")
        logger.info("orders_fetched", count=len(orders))

        # Get order products for each order
        order_details = {}
        with conn.cursor() as cursor:
            for order in orders:
                order_id = order["order_id"]

                # Get products
                query = f"""
                    SELECT name, model, quantity, price, total
                    FROM {prefix}order_product
                    WHERE order_id = %s
                """
                cursor.execute(query, (order_id,))
                products = cursor.fetchall()
                order_details[order_id] = products

        conn.close()

        # Transform and sync to Supabase
        imported = 0
        updated = 0
        skipped = 0

        for order in orders:
            try:
                order_id = str(order["order_id"])
                products = order_details.get(int(order_id), [])

                # Generate product name summary
                if products:
                    if len(products) == 1:
                        product_name = products[0]["name"]
                    else:
                        names = [p["name"] for p in products[:2]]
                        product_name = ", ".join(names)
                        if len(products) > 2:
                            product_name += f" (+{len(products) - 2} more)"
                else:
                    product_name = "Unknown Product"

                # Skip cancelled/incomplete orders (status 0, 7, 9, 10, 11, 14)
                # 0=None/Incomplete, 7=Canceled, 9=Canceled Reversal, 10=Failed, 11=Refunded, 14=Expired
                if order["order_status_id"] in [0, 7, 9, 10, 11, 14]:
                    status_name = order.get('status_name') or 'Incomplete/Unknown'
                    logger.info("skipping_cancelled_order", order_no=order_id, status_id=order["order_status_id"], status=status_name)
                    print(f"  [SKIP]   Order #{order_id}: Status {order['order_status_id']} ({status_name}) - Not importing cancelled/incomplete orders")
                    skipped += 1
                    continue

                # Determine if order is paid based on payment method and status
                payment_method = order["payment_method"] or ""
                status_id = order["order_status_id"]

                # Order is considered PAID if status is: 2=Processing, 3=Shipped, 5=Complete, 15=Processed, 24=Payment received
                # Order is considered UNPAID if: 1=Pending, 23=Awaiting payment clearance, or payment method is COD/Bank Transfer
                is_paid = status_id in [2, 3, 5, 15, 24]  # Explicitly paid statuses

                # If not explicitly paid, check payment method
                if not is_paid:
                    # COD and Bank Transfer are definitely unpaid until status confirms otherwise
                    if "Cash On Delivery" in payment_method or "Bank Transfer" in payment_method:
                        is_paid = False
                    # Status 23 (Awaiting payment clearance) is explicitly unpaid
                    elif status_id == 23:
                        is_paid = False
                    # Status 1 (Pending) is unpaid
                    elif status_id == 1:
                        is_paid = False
                    # Other online payment methods we'll assume paid unless status says otherwise
                    else:
                        is_paid = True

                # Transform to orders_tracker format
                tracker_order = {
                    "order_no": order_id,
                    "order_name": product_name,
                    "supplier": None,  # Will be set manually or by agent
                    "notes": f"Customer: {order['customer_name']} | Email: {order['email']}",
                    "cost": float(order["total"]),
                    "invoice_no": order.get("invoice_no"),
                    "order_paid": is_paid,
                    "supplier_amount": None,
                    "shipping": None,  # TODO: Extract from order totals
                    "profit": None,
                    "updates": f"Status: {order['status_name']} | Payment: {payment_method} | Added: {order['date_added']}",
                    "owner_wade": False,
                    "owner_lucky": False,
                    "owner_kenny": False,
                    "owner_accounts": False,
                    "flag_done": order["order_status_id"] in [5, 3],  # Complete, Shipped
                    "flag_urgent": order["order_status_id"] in [1, 2],  # Pending, Processing
                    "source": "opencart",
                    "last_modified_by": "import_script",
                }

                # Check if order exists
                response = supabase.client.table("orders_tracker").select("*").eq("order_no", order_id).execute()

                if response.data:
                    # Update existing
                    supabase.client.table("orders_tracker").update(tracker_order).eq("order_no", order_id).execute()
                    updated += 1
                    print(f"  [UPDATE] Order #{order_id}: {product_name[:50]}")
                else:
                    # Insert new
                    supabase.client.table("orders_tracker").insert(tracker_order).execute()
                    imported += 1
                    print(f"  [NEW]    Order #{order_id}: {product_name[:50]}")

                logger.info("order_synced", order_no=order_id, action="update" if response.data else "insert")

            except Exception as e:
                skipped += 1
                logger.error("order_sync_failed", order_no=order.get("order_id"), error=str(e))
                print(f"  [ERROR]  Order {order.get('order_id')}: {e}")

        print(f"\n{'='*60}")
        print(f"Import completed!")
        print(f"{'='*60}")
        print(f"  New orders imported:    {imported}")
        print(f"  Existing orders updated: {updated}")
        print(f"  Errors/Skipped:         {skipped}")
        print(f"{'='*60}")
        print(f"\nRefresh your dashboard: http://localhost:3001/orders")

        logger.info(
            "import_completed",
            imported=imported,
            updated=updated,
            skipped=skipped,
            total=len(orders),
        )

    except Exception as e:
        logger.error("import_failed", error=str(e))
        print(f"\nERROR: Import failed: {e}")
        import traceback
        traceback.print_exc()
        raise


async def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Import orders from OpenCart database")
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days back to fetch orders (default: 30)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Maximum number of orders to import (default: 100)"
    )

    args = parser.parse_args()

    await import_orders(days_back=args.days, limit=args.limit)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
