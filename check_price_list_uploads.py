
import asyncio
import os
from dotenv import load_dotenv
from src.connectors.supabase import SupabaseConnector

load_dotenv()

async def check_uploads():
    sb = SupabaseConnector()
    print("Checking price_list_uploads for 'Bridgee'...")
    try:
        # Search for Bridgee
        response = sb.client.table("price_list_uploads")\
            .select("*")\
            .ilike("filename", "%Bridgee%")\
            .execute()
            
        print(f"Found {len(response.data)} records:")
        for row in response.data:
            print(f"ID: {row['id']}")
            print(f"Filename: {row['filename']}")
            print(f"Status: {row['status']}")
            print(f"Created: {row['created_at']}")
            print(f"Error: {row.get('error_message')}")
            print("-" * 30)
            
        # Also print top 5 pending
        print("\nTop 5 Pending:")
        response = sb.client.table("price_list_uploads")\
            .select("*")\
            .eq("status", "pending")\
            .order("created_at", desc=True)\
            .limit(5)\
            .execute()
        for row in response.data:
            print(f"ID: {row['id']} - {row['filename']} ({row['created_at']})")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_uploads())
