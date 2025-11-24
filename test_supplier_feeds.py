"""Simple test script to verify MCP supplier feeds - no dependencies needed."""
import os
from supabase import create_client

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def test_supplier_feed(supplier_name: str, supplier_id: str):
    """Test a single supplier's feed."""
    print(f"\n{'='*60}")
    print(f"Testing: {supplier_name}")
    print(f"{'='*60}")
    
    try:
        # 1. Check supplier details
        supplier_response = supabase.table("suppliers")\
            .select("*")\
            .eq("id", supplier_id)\
            .single()\
            .execute()
        
        if not supplier_response.data:
            print(f"❌ Supplier not found")
            return False
        
        supplier = supplier_response.data
        print(f"✅ Supplier found:")
        print(f"   - Type: {supplier.get('type')}")
        print(f"   - Supplier Type: {supplier.get('supplier_type')}")
        print(f"   - Active: {supplier.get('is_active')}")
        
        # 2. Check products
        products_response = supabase.table("products")\
            .select("*")\
            .eq("supplier_id", supplier_id)\
            .limit(5)\
            .execute()
        
        products = products_response.data
        if not products:
            print(f"❌ No products found for this supplier")
            return False
        
        print(f"✅ Found {len(products)} products (showing first 3):")
        
        for i, product in enumerate(products[:3], 1):
            print(f"\n   Product {i}:")
            print(f"   - SKU: {product.get('sku')}")
            print(f"   - Name: {product.get('product_name', 'N/A')[:50]}")
            print(f"   - Cost: R{product.get('cost_price', 0):.2f}")
            print(f"   - Stock: {product.get('total_stock', 0)}")
        
        # 3. Check pricing rule
        pricing_response = supabase.table("supplier_pricing_rules")\
            .select("*")\
            .eq("supplier_id", supplier_id)\
            .maybe_single()\
            .execute()
        
        if pricing_response.data:
            rule = pricing_response.data
            print(f"\n✅ Pricing rule:")
            print(f"   - Type: {rule.get('pricing_type')}")
            print(f"   - Markup: {rule.get('default_markup_pct')}%")
        else:
            print(f"\n⚠️  No pricing rule (using 30% default)")
        
        print(f"\n✅ {supplier_name} - PASS")
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    """Test all MCP supplier feeds."""
    print("\n" + "="*60)
    print("MCP SUPPLIER FEED TESTING")
    print("="*60)
    
    # Get all active MCP suppliers
    suppliers_response = supabase.table("suppliers")\
        .select("*")\
        .eq("is_active", True)\
        .not_("supplier_type", "is", None)\
        .order("name")\
        .execute()
    
    suppliers = suppliers_response.data
    
    if not suppliers:
        print("❌ No MCP suppliers found!")
        return
    
    print(f"\nFound {len(suppliers)} MCP suppliers to test\n")
    
    results = {}
    for supplier in suppliers:
        success = test_supplier_feed(supplier['name'], supplier['id'])
        results[supplier['name']] = success
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for supplier_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {supplier_name}")
    
    print(f"\nTotal: {passed}/{total} suppliers passing")
    
    if passed == total:
        print("\n🎉 All feeds working! Ready for automation.")
    else:
        print(f"\n⚠️  {total - passed} supplier(s) need attention.")

if __name__ == "__main__":
    main()
