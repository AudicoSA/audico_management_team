"""
Sync Excel order tracker to Supabase orders_tracker table.

Reads from AUDICO_XX_Nov_2025.xlsx and syncs to Supabase.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
import pandas as pd
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.supabase import SupabaseConnector
from utils.logging import AgentLogger, setup_logging

# Load environment variables
load_dotenv()

# Setup logging
setup_logging()
logger = AgentLogger("excel_sync")


def find_latest_excel() -> Optional[Path]:
    """Find the latest AUDICO Excel file in the parent directory."""
    parent_dir = Path(__file__).parent.parent
    excel_files = list(parent_dir.glob("AUDICO*.xlsx"))

    # Filter out temp files (starting with ~$)
    excel_files = [f for f in excel_files if not f.name.startswith("~$")]

    if not excel_files:
        return None

    # Sort by modification time, newest first
    excel_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    return excel_files[0]


def parse_currency(value: Any) -> Optional[float]:
    """Parse currency string like 'R1,234.56' to float."""
    if pd.isna(value) or value == "":
        return None

    if isinstance(value, (int, float)):
        return float(value)

    # Remove R symbol, commas, spaces
    value_str = str(value).replace("R", "").replace(",", "").replace(" ", "").strip()

    if value_str == "" or value_str == "-":
        return None

    try:
        return float(value_str)
    except ValueError:
        return None


def parse_boolean(value: Any) -> bool:
    """Parse boolean from Excel (checkboxes might be TRUE/FALSE or x/blank)."""
    if pd.isna(value) or value == "":
        return False

    if isinstance(value, bool):
        return value

    value_str = str(value).strip().upper()
    return value_str in ("TRUE", "X", "YES", "1", "✓", "✔")


def read_excel_orders(excel_path: Path) -> List[Dict[str, Any]]:
    """Read orders from Excel file."""
    logger.info("reading_excel", path=str(excel_path))

    # Read the Excel file - skip first 3 rows, use row 0 as header
    df = pd.read_excel(excel_path, sheet_name="2025", skiprows=3)

    # The columns might be misaligned. Let's inspect what we got
    logger.info("excel_loaded", rows=len(df), first_few_columns=list(df.columns[:5]))

    orders = []

    for idx, row in df.iterrows():
        # Skip rows without an order number
        if pd.isna(row.get("ORDER NO", "")) or row.get("ORDER NO", "") == "":
            continue

        # Parse the row into order dict
        order = {
            "order_no": str(row.get("ORDER NO", "")).strip(),
            "order_name": str(row.get("ORDER NAME", "")).strip() if not pd.isna(row.get("ORDER NAME")) else None,
            "supplier": str(row.get("SUPPLIER", "")).strip() if not pd.isna(row.get("SUPPLIER")) else None,
            "notes": str(row.get("NOTES", "")).strip() if not pd.isna(row.get("NOTES")) else None,
            "cost": parse_currency(row.get("COST")),
            "invoice_no": str(row.get("INVOICE NO", "")).strip() if not pd.isna(row.get("INVOICE NO")) else None,
            "order_paid": parse_boolean(row.get("ORDER PAID")),
            "supplier_amount": parse_currency(row.get("SUPPLIER AMOUNT")),
            "shipping": parse_currency(row.get("SHIPPING")),
            "profit": parse_currency(row.get("PROFIT")),
            "updates": str(row.get("UPDATES", "")).strip() if not pd.isna(row.get("UPDATES")) else None,
            "owner_wade": parse_boolean(row.get("WADE")),
            "owner_lucky": parse_boolean(row.get("LUCKY")),
            "owner_kenny": parse_boolean(row.get("KENNY")),
            "owner_accounts": parse_boolean(row.get("ACCOUNTS")),
            "flag_done": parse_boolean(row.get("DONE")),
            "flag_urgent": parse_boolean(row.get("URGENT")),
            "source": "excel",
        }

        orders.append(order)

    logger.info("excel_parsed", order_count=len(orders))
    return orders


async def sync_orders_to_supabase(orders: List[Dict[str, Any]]):
    """Sync orders to Supabase."""
    supabase = SupabaseConnector()

    logger.info("syncing_to_supabase", order_count=len(orders))

    synced = 0
    updated = 0
    errors = 0

    for order in orders:
        try:
            order_no = order["order_no"]

            # Check if order exists
            response = supabase.client.table("orders_tracker").select("*").eq("order_no", order_no).execute()

            if response.data:
                # Update existing order
                supabase.client.table("orders_tracker").update(order).eq("order_no", order_no).execute()
                updated += 1
                logger.debug("order_updated", order_no=order_no)
            else:
                # Insert new order
                supabase.client.table("orders_tracker").insert(order).execute()
                synced += 1
                logger.debug("order_inserted", order_no=order_no)

        except Exception as e:
            errors += 1
            logger.error("order_sync_failed", order_no=order.get("order_no"), error=str(e))

    logger.info(
        "sync_completed",
        synced=synced,
        updated=updated,
        errors=errors,
        total=len(orders),
    )

    return {"synced": synced, "updated": updated, "errors": errors}


async def main():
    """Main entry point."""
    try:
        # Find latest Excel file
        excel_path = find_latest_excel()

        if not excel_path:
            logger.error("excel_file_not_found")
            print("ERROR: No Excel file found matching pattern: AUDICO*.xlsx")
            return

        logger.info("excel_file_found", path=str(excel_path))
        print(f"Found Excel file: {excel_path.name}")

        # Read orders from Excel
        orders = read_excel_orders(excel_path)

        if not orders:
            logger.warning("no_orders_found")
            print("WARNING: No orders found in Excel file")
            return

        print(f"Found {len(orders)} orders in Excel")

        # Sync to Supabase
        result = await sync_orders_to_supabase(orders)

        print(f"\nSync completed!")
        print(f"   - New orders: {result['synced']}")
        print(f"   - Updated orders: {result['updated']}")
        print(f"   - Errors: {result['errors']}")
        print(f"\nDashboard should now show {len(orders)} orders!")

    except Exception as e:
        logger.error("sync_failed", error=str(e))
        print(f"\nERROR: Sync failed: {e}")
        raise


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
