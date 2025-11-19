"""Add sample orders to Supabase for testing the dashboard."""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from connectors.supabase import SupabaseConnector

# Load environment variables
load_dotenv()


async def main():
    """Add sample orders."""
    supabase = SupabaseConnector()

    # Sample orders
    sample_orders = [
        {
            "order_no": "18593",
            "order_name": "Olympus WS853",
            "supplier": "Marshall",
            "notes": "Voice recorder order",
            "cost": 1500.00,
            "invoice_no": "INV-001",
            "order_paid": True,
            "supplier_amount": 1500.00,
            "shipping": 150.00,
            "profit": 350.00,
            "updates": "Ordered, awaiting delivery",
            "owner_wade": True,
            "owner_lucky": False,
            "owner_kenny": False,
            "owner_accounts": False,
            "flag_done": False,
            "flag_urgent": False,
            "source": "dashboard",
        },
        {
            "order_no": "19919",
            "order_name": "Marshall Order",
            "supplier": "Marshall",
            "notes": "Audio equipment",
            "cost": 2500.00,
            "invoice_no": "INV-002",
            "order_paid": False,
            "supplier_amount": 2500.00,
            "shipping": 200.00,
            "profit": 500.00,
            "updates": "Awaiting payment confirmation",
            "owner_wade": False,
            "owner_lucky": True,
            "owner_kenny": False,
            "owner_accounts": False,
            "flag_done": False,
            "flag_urgent": True,
            "source": "dashboard",
        },
        {
            "order_no": "22232",
            "order_name": "Sony Headphones",
            "supplier": "Sony SA",
            "notes": "Wireless headphones",
            "cost": 3200.00,
            "invoice_no": "INV-003",
            "order_paid": True,
            "supplier_amount": 3200.00,
            "shipping": 120.00,
            "profit": 680.00,
            "updates": "Delivered",
            "owner_wade": False,
            "owner_lucky": False,
            "owner_kenny": True,
            "owner_accounts": False,
            "flag_done": True,
            "flag_urgent": False,
            "source": "dashboard",
        },
    ]

    print("Adding sample orders to Supabase...")

    for order in sample_orders:
        try:
            # Check if exists
            response = supabase.client.table("orders_tracker").select("*").eq("order_no", order["order_no"]).execute()

            if response.data:
                print(f"Order {order['order_no']} already exists, skipping")
            else:
                supabase.client.table("orders_tracker").insert(order).execute()
                print(f"Added order {order['order_no']}: {order['order_name']}")

        except Exception as e:
            print(f"Error adding order {order['order_no']}: {e}")

    print("\nDone! Check your dashboard at http://localhost:3001/orders")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
