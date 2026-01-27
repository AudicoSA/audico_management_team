import asyncio
from src.connectors.supabase import get_supabase_connector
from dotenv import load_dotenv

load_dotenv(r'd:\AudicoAI\Audico Management Team\.env')

async def main():
    sb = get_supabase_connector()
    try:
        response = sb.client.table("supplier_addresses").select("*").execute()
        print(f"Found {len(response.data)} supplier addresses:")
        for s in response.data:
            print(f"- {s.get('name')}: Code='{s.get('code')}', City='{s.get('city')}'")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
