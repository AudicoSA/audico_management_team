import asyncio
from src.connectors.supabase import SupabaseConnector

async def check_specific_product():
    supabase = SupabaseConnector()
    
    print("Checking for 'BB ISW-8'...")
    response = supabase.client.table('new_products_queue')\
        .select('*')\
        .ilike('name', '%ISW-8%')\
        .execute()
        
    with open("isw8_status.txt", "w") as f:
        if not response.data:
            f.write("No product found matching 'ISW-8'\n")
        
        for item in response.data:
            f.write(f"ID: {item['id']}\n")
            f.write(f"Name: {item['name']}\n")
            f.write(f"Status: {item['status']}\n")
            f.write(f"Created: {item['created_at']}\n")
            f.write("-" * 20 + "\n")

if __name__ == "__main__":
    asyncio.run(check_specific_product())
