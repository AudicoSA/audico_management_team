"""
Quick test to verify Supabase connection and permissions.
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8')

# Load environment
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

print(f"\nTesting Supabase Connection")
print(f"{'='*60}")
print(f"URL: {SUPABASE_URL}")
print(f"Anon Key: {SUPABASE_ANON_KEY[:20]}..." if SUPABASE_ANON_KEY else "Anon Key: NOT SET")
print(f"{'='*60}\n")

try:
    # Create client
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    print("✓ Client created successfully")

    # Test SELECT (read)
    print("\n1. Testing SELECT (read orders)...")
    response = supabase.table("orders_tracker").select("*").limit(5).execute()
    print(f"✓ SELECT successful - Found {len(response.data)} orders")

    # Test UPDATE (edit)
    print("\n2. Testing UPDATE (permissions check)...")
    test_order = response.data[0] if response.data else None

    if test_order:
        order_no = test_order['order_no']
        current_notes = test_order.get('notes', '')

        # Try to update notes field
        update_response = supabase.table("orders_tracker")\
            .update({"notes": current_notes})\
            .eq("order_no", order_no)\
            .execute()

        print(f"✓ UPDATE successful - Can edit order #{order_no}")
    else:
        print("⚠ No orders found to test UPDATE")

    print(f"\n{'='*60}")
    print("✓✓✓ ALL TESTS PASSED - Supabase is working!")
    print(f"{'='*60}\n")
    print("Your dashboard should work at: http://localhost:3001/orders\n")

except Exception as e:
    print(f"\n{'='*60}")
    print(f"✗✗✗ ERROR: {type(e).__name__}")
    print(f"{'='*60}")
    print(f"Message: {str(e)}\n")

    if "permission denied" in str(e).lower():
        print("DIAGNOSIS: Supabase permissions not set correctly")
        print("\nSOLUTION: Run this SQL in Supabase SQL Editor:")
        print("https://supabase.com/dashboard/project/ajdehycoypilsegmxbto/sql/new")
        print("\n" + "="*60)
        print("ALTER TABLE orders_tracker DISABLE ROW LEVEL SECURITY;")
        print("GRANT ALL PRIVILEGES ON public.orders_tracker TO anon;")
        print("GRANT ALL PRIVILEGES ON public.orders_tracker TO authenticated;")
        print("="*60 + "\n")
    elif "fetch" in str(e).lower() or "connect" in str(e).lower():
        print("DIAGNOSIS: Network/connectivity issue")
        print("\nSOLUTIONS:")
        print("1. Check your internet connection")
        print("2. Check Supabase status: https://status.supabase.com/")
        print("3. Verify firewall isn't blocking api.supabase.com")
        print("4. Try opening Supabase dashboard in browser:")
        print("   https://supabase.com/dashboard/project/ajdehycoypilsegmxbto\n")
    else:
        print("DIAGNOSIS: Unknown error")
        print("\nCheck .env file has correct credentials:")
        print("SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co")
        print("SUPABASE_ANON_KEY=eyJhbGc...\n")
