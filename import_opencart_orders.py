"""
Import real orders from OpenCart to Supabase orders_tracker.

This script fetches recent orders from OpenCart and syncs them to your dashboard.
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, List
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.opencart import OpenCartConnector
from connectors.supabase import SupabaseConnector
from utils.logging import AgentLogger, setup_logging

# Load environment variables
load_dotenv()

# Setup logging
setup_logging()
logger = AgentLogger("opencart_import")


async def import_orders(days_back: int = 30, limit: int = 50):
    """
    Import orders from OpenCart to Supabase.

    Args:
        days_back: How many days back to fetch orders (default: 30)
        limit: Maximum number of orders to import (default: 50)
    """
    try:
        logger.info("import_started", days_back=days_back, limit=limit)
        print(f"Importing orders from OpenCart (last {days_back} days)...")

        # Initialize connectors
        opencart = OpenCartConnector()
        supabase = SupabaseConnector()

        # Fetch recent orders from OpenCart
        print("Fetching orders from OpenCart...")
        orders = await opencart.get_recent_orders(days_back=days_back, limit=limit)

        if not orders:
            print("No orders found in OpenCart")
            logger.warning("no_orders_found")
            return

        print(f"Found {len(orders)} orders from OpenCart")
        logger.info("orders_fetched", count=len(orders))

        # Transform and sync to Supabase
        imported = 0
        updated = 0
        skipped = 0

        for order in orders:
            try:
                order_no = str(order.get("order_id", ""))

                if not order_no:
                    skipped += 1
                    continue

                # Transform OpenCart order to orders_tracker format
                tracker_order = {
                    "order_no": order_no,
                    "order_name": extract_product_names(order),
                    "supplier": None,  # Will be set manually or by agent
                    "notes": f"Customer: {order.get('customer', 'Unknown')}",
                    "cost": float(order.get("total", 0)),
                    "invoice_no": None,
                    "order_paid": order.get("payment_method") != "COD",
                    "supplier_amount": None,
                    "shipping": float(order.get("shipping_cost", 0)),
                    "profit": None,  # To be calculated
                    "updates": f"Status: {order.get('status_name', 'Unknown')}",
                    "owner_wade": False,
                    "owner_lucky": False,
                    "owner_kenny": False,
                    "owner_accounts": False,
                    "flag_done": order.get("status_name") in ["Complete", "Shipped"],
                    "flag_urgent": order.get("status_name") == "Pending",
                    "source": "opencart",
                    "last_modified_by": "import_script",
                }

                # Check if order already exists
                response = supabase.client.table("orders_tracker").select("*").eq("order_no", order_no).execute()

                if response.data:
                    # Update existing
                    supabase.client.table("orders_tracker").update(tracker_order).eq("order_no", order_no).execute()
                    updated += 1
                    print(f"  Updated: Order #{order_no}")
                else:
                    # Insert new
                    supabase.client.table("orders_tracker").insert(tracker_order).execute()
                    imported += 1
                    print(f"  Imported: Order #{order_no} - {tracker_order['order_name']}")

                logger.info("order_synced", order_no=order_no, action="update" if response.data else "insert")

            except Exception as e:
                skipped += 1
                logger.error("order_sync_failed", order_no=order.get("order_id"), error=str(e))
                print(f"  Error syncing order {order.get('order_id')}: {e}")

        print(f"\n{'='*50}")
        print(f"Import completed!")
        print(f"  Imported: {imported}")
        print(f"  Updated:  {updated}")
        print(f"  Skipped:  {skipped}")
        print(f"{'='*50}")
        print(f"\nCheck your dashboard: http://localhost:3001/orders")

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
        raise


def extract_product_names(order: Dict[str, Any]) -> str:
    """Extract product names from order."""
    products = order.get("products", [])

    if not products:
        return "Unknown Product"

    if len(products) == 1:
        return products[0].get("name", "Unknown Product")

    # Multiple products
    names = [p.get("name", "Unknown") for p in products[:3]]
    result = ", ".join(names)

    if len(products) > 3:
        result += f" (+{len(products) - 3} more)"

    return result


async def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Import orders from OpenCart")
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days back to fetch orders (default: 30)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Maximum number of orders to import (default: 50)"
    )

    args = parser.parse_args()

    await import_orders(days_back=args.days, limit=args.limit)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
