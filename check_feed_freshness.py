"""Check when MCP feeds last updated - uses .env file."""
import os
from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials in .env file")
    print(f"SUPABASE_URL: {'✅' if SUPABASE_URL else '❌'}")
    print(f"SUPABASE_KEY: {'✅' if SUPABASE_KEY else '❌'}")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("\n" + "="*60)
print("MCP FEED FRESHNESS CHECK")
print("="*60)

# Get all MCP suppliers
suppliers_response = supabase.table("suppliers")\
    .select("*")\
    .eq("is_active", True)\
    .neq("supplier_type", None)\
    .order("name")\
    .execute()

suppliers = suppliers_response.data

if not suppliers:
    print("❌ No MCP suppliers found")
    exit(1)

print(f"\nChecking {len(suppliers)} MCP suppliers...\n")

for supplier in suppliers:
    print(f"{supplier['name']}:")
    
    # Get most recent product update
    products_response = supabase.table("products")\
        .select("updated_at, created_at, sku, product_name")\
        .eq("supplier_id", supplier['id'])\
        .order("updated_at", desc=True)\
        .limit(1)\
        .execute()
    
    if products_response.data:
        product = products_response.data[0]
        updated_at = product.get('updated_at')
        
        if updated_at:
            # Parse timestamp
            try:
                updated_time = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                now = datetime.now(updated_time.tzinfo)
                age = now - updated_time
                
                hours_old = age.total_seconds() / 3600
                
                print(f"  Last update: {updated_at}")
                
                if hours_old < 1:
                    print(f"  Age: {int(age.total_seconds() / 60)} minutes ago")
                elif hours_old < 24:
                    print(f"  Age: {int(hours_old)} hours ago")
                else:
                    print(f"  Age: {age.days} days, {int(hours_old % 24)} hours ago")
                
                # Freshness indicator
                if age < timedelta(hours=24):
                    print(f"  Status: ✅ FRESH (updated today)")
                elif age < timedelta(days=7):
                    print(f"  Status: ⚠️  STALE ({age.days} days old)")
                else:
                    print(f"  Status: ❌ VERY STALE ({age.days} days old)")
                    
            except Exception as e:
                print(f"  Status: ⚠️  Error parsing timestamp: {e}")
        else:
            print(f"  Status: ⚠️  No timestamp available")
    else:
        print(f"  Status: ❌ No products found")
    
    print()

print("="*60)
print("INTERPRETATION:")
print("="*60)
print("✅ FRESH: MCP server is actively updating")
print("⚠️  STALE: MCP server may need attention")  
print("❌ VERY STALE: MCP server likely not running")
print("\nMCP servers location:")
print("D:\\AudicoAI\\Audico Final Quote System\\audico-mcp-servers")
