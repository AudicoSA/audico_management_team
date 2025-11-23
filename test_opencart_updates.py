import sys
from pathlib import Path
import asyncio

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.connectors.opencart import get_opencart_connector
from src.utils.logging import setup_logging

setup_logging()

async def test_opencart_updates():
    """Test OpenCart direct database update methods."""
    opencart = get_opencart_connector()
    
    print("=" * 60)
    print("TESTING OPENCART DIRECT DATABASE UPDATES")
    print("=" * 60)
    
    # Test 1: Get product by SKU
    print("\n1. Testing get_product_by_sku()...")
    print("-" * 60)
    test_sku = "AUD-TEST-001"  # Replace with a real SKU from your database
    product = await opencart.get_product_by_sku(test_sku)
    
    if product:
        print(f"✅ Product found:")
        print(f"   Product ID: {product['product_id']}")
        print(f"   Model: {product['model']}")
        print(f"   SKU: {product['sku']}")
        print(f"   Current Price: R{product['price']}")
        print(f"   Current Stock: {product['quantity']}")
        
        product_id = product['product_id']
        original_price = float(product['price'])
        original_stock = int(product['quantity'])
        
        # Test 2: Update price
        print("\n2. Testing update_product_price()...")
        print("-" * 60)
        new_price = original_price + 10.00  # Add R10 for testing
        success = await opencart.update_product_price(product_id, new_price)
        
        if success:
            print(f"✅ Price updated successfully!")
            print(f"   Old Price: R{original_price}")
            print(f"   New Price: R{new_price}")
            
            # Verify the change
            updated_product = await opencart.get_product_by_sku(test_sku)
            if updated_product and float(updated_product['price']) == new_price:
                print(f"✅ Verified: Price is now R{updated_product['price']}")
            
            # Restore original price
            await opencart.update_product_price(product_id, original_price)
            print(f"✅ Restored original price: R{original_price}")
        else:
            print("❌ Price update failed")
        
        # Test 3: Update stock
        print("\n3. Testing update_product_stock()...")
        print("-" * 60)
        new_stock = original_stock + 5  # Add 5 units for testing
        success = await opencart.update_product_stock(product_id, new_stock)
        
        if success:
            print(f"✅ Stock updated successfully!")
            print(f"   Old Stock: {original_stock}")
            print(f"   New Stock: {new_stock}")
            
            # Verify the change
            updated_product = await opencart.get_product_by_sku(test_sku)
            if updated_product and int(updated_product['quantity']) == new_stock:
                print(f"✅ Verified: Stock is now {updated_product['quantity']}")
            
            # Restore original stock
            await opencart.update_product_stock(product_id, original_stock)
            print(f"✅ Restored original stock: {original_stock}")
        else:
            print("❌ Stock update failed")
        
        # Test 4: Bulk update
        print("\n4. Testing bulk_update_products()...")
        print("-" * 60)
        updates = [
            {
                'product_id': product_id,
                'price': original_price + 5.00,
                'quantity': original_stock + 2
            }
        ]
        
        result = await opencart.bulk_update_products(updates)
        print(f"✅ Bulk update result:")
        print(f"   Updated: {result['updated']}")
        print(f"   Failed: {result['failed']}")
        
        # Restore original values
        await opencart.bulk_update_products([{
            'product_id': product_id,
            'price': original_price,
            'quantity': original_stock
        }])
        print(f"✅ Restored original values")
        
    else:
        print(f"❌ Product not found with SKU: {test_sku}")
        print("\n💡 Please update test_sku variable with a real SKU from your OpenCart database")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_opencart_updates())
