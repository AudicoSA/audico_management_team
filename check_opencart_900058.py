
import asyncio
import os
import logging
from src.connectors.opencart import get_opencart_connector
from src.utils.logging import setup_logging

setup_logging()

async def check_opencart_raw():
    connector = get_opencart_connector()
    
    print("Fetching Order 900058 from OpenCart...")
    try:
        # Get order details
        order = await connector.get_order("900058")
        
        if order:
            print("\n--- OPENCART RAW DATA ---")
            print(f"Shipping Firstname: {order.get('shipping_firstname')}")
            print(f"Shipping Lastname: {order.get('shipping_lastname')}")
            print(f"Shipping Company: {order.get('shipping_company')}")
            print(f"Shipping Address 1: {order.get('shipping_address_1')}")
            print(f"Shipping Address 2: {order.get('shipping_address_2')}")
            print(f"Shipping City: {order.get('shipping_city')}")
            print(f"Shipping Postcode: {order.get('shipping_postcode')}")
            print(f"Shipping Zone: {order.get('shipping_zone')}")
            print(f"Shipping Country: {order.get('shipping_country')}")
        else:
            print("Order 900058 NOT found in OpenCart.")
            
    except Exception as e:
        print(f"Error fetching from OpenCart: {e}")

if __name__ == "__main__":
    asyncio.run(check_opencart_raw())
