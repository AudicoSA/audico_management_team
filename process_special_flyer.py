
import asyncio
import sys
import os
import dotenv
from src.agents.specials_agent import get_specials_agent

# Load env
dotenv.load_dotenv(r"d:\AudicoAI\Audico Management Team\.env")

async def main():
    if len(sys.argv) < 2:
        print("Usage: python process_special_flyer.py <path_to_image> [supplier_name]")
        return

    file_path = sys.argv[1]
    supplier_name = sys.argv[2] if len(sys.argv) > 2 else "Unknown"
    
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found.")
        return

    print(f"Processing '{file_path}' from '{supplier_name}'...")
    print("Sending to OpenAI Vision (this may take a few seconds)...")
    
    agent = get_specials_agent()
    result = await agent.ingest_flyer(file_path, supplier_name)
    
    if result.get("status") == "success":
        print("\n✅ Success!")
        print(f"Extracted {result.get('deals_count')} deals.")
        print(f"Data: {result.get('data')}")
    else:
        print(f"\n❌ Failed: {result.get('message')}")

if __name__ == "__main__":
    asyncio.run(main())
