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
        # Strict limit as requested
        limit = 100 
        logger.info("import_started", days_back=days_back, limit=limit)
        print(f"Importing LAST {limit} orders from OpenCart...")

        # Initialize connectors
        opencart = OpenCartConnector()
        supabase = SupabaseConnector()

        # Fetch recent orders from OpenCart
        print("Fetching recent orders list...")
        recent_orders = await opencart.get_recent_orders(days_back=days_back, limit=limit)

        if not recent_orders:
            print("No orders found in OpenCart")
            logger.warning("no_orders_found")
            return

        print(f"Found {len(recent_orders)} orders. Filtering and Processing...")
        logger.info("orders_fetched", count=len(recent_orders))

        # Transform and sync to Supabase
        imported = 0
        updated = 0
        skipped = 0

        # Strict Status Filtering
        ALLOWED_STATUSES = ["Processing", "Awaiting Payment"]

        for simple_order in recent_orders:
            try:
                order_id = str(simple_order.get("order_id", ""))
                if not order_id:
                    skipped += 1
                    continue

                # Fetch FULL order details to get products and customer info
                order = await opencart.get_order(order_id)
                if not order:
                    print(f"  Warning: Could not fetch details for order {order_id}")
                    continue

                # Use status from simple_order (get_recent_orders has the join)
                status_name = simple_order.get('status_name', 'Unknown')
                
                # STRICT FILTER: Only allow Processing or Awaiting Payment
                if status_name not in ALLOWED_STATUSES:
                    # print(f"  Skipping Order #{order_id} (Status: {status_name})") # Verbose
                    skipped += 1
                    continue

                # Construct Customer Name
                customer_name = f"{order.get('firstname', '')} {order.get('lastname', '')}".strip()
                if not customer_name:
                    customer_name = "Unknown"
                
                # Construct Product Names string
                product_names = extract_product_names(order)

                # Paid Logic: Processing = Paid, Awaiting Payment = Unpaid
                is_paid = status_name == "Processing"

                # Prepare base data from OpenCart
                opencart_data = {
                    "order_no": order_id,
                    "order_name": product_names, # User requested Order Name = Product Name
                    "cost": float(order.get("total", 0)),
                    "order_paid": is_paid,
                    "flag_done": False, # Default to not done
                    "flag_urgent": status_name == "Processing", # Maybe urgent if paid?
                    "source": "opencart",
                    "last_modified_by": "import_script",
                    "supplier_status": "Pending" # Default
                }

                # Check if order already exists
                response = supabase.client.table("orders_tracker").select("*").eq("order_no", order_id).execute()

                if response.data:
                    existing_order = response.data[0]
                    
                    # SAFE UPDATE: Only update specific fields
                    update_payload = {
                        "order_name": opencart_data["order_name"],
                        "cost": opencart_data["cost"],
                        "order_paid": opencart_data["order_paid"],
                        # Do not overwrite flags if they were manually changed? 
                        # User asked to "start again", so maybe we should overwrite?
                        # "place tick on paid for processing orders, place x on awaiting payment"
                        # implies strict sync.
                    }

                    # Only update notes if it's currently "Customer: Unknown" or empty
                    current_notes = existing_order.get("notes", "")
                    if not current_notes or current_notes == "Customer: Unknown":
                         update_payload["notes"] = f"Customer: {customer_name} | Email: {order.get('email', '')}"

                    # Append status to updates log
                    current_updates = existing_order.get("updates", "")
                    new_status = f"Status: {status_name}"
                    if new_status not in current_updates:
                        update_payload["updates"] = f"{current_updates} | {new_status}"

                    supabase.client.table("orders_tracker").update(update_payload).eq("order_no", order_id).execute()
                    updated += 1
                    print(f"  Updated: Order #{order_id} ({status_name})")

                else:
                    # Insert new order
                    new_order = opencart_data.copy()
                    new_order["supplier"] = None
                    new_order["notes"] = f"Customer: {customer_name} | Email: {order.get('email', '')}"
                    new_order["invoice_no"] = None
                    new_order["supplier_amount"] = None
                    new_order["shipping"] = 0 
                    new_order["profit"] = None
                    new_order["updates"] = f"Status: {status_name}"
                    new_order["owner_wade"] = False
                    new_order["owner_lucky"] = False
                    new_order["owner_kenny"] = False
                    new_order["owner_accounts"] = False

                    supabase.client.table("orders_tracker").insert(new_order).execute()
                    imported += 1
                    print(f"  Imported: Order #{order_id} ({status_name}) - {new_order['order_name']}")

                logger.info("order_synced", order_no=order_id, action="update" if response.data else "insert")

            except Exception as e:
                skipped += 1
                logger.error("order_sync_failed", order_no=simple_order.get("order_id"), error=str(e))
                print(f"  Error syncing order {simple_order.get('order_id')}: {e}")

        print(f"\n{'='*50}")
        print(f"Import completed!")
        print(f"  Imported: {imported}")
        print(f"  Updated:  {updated}")
        print(f"  Skipped:  {skipped}")
        print(f"{'='*50}")

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
