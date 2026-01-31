
import asyncio
import sys
from src.agents.specials_agent import get_specials_agent

async def main():
    if len(sys.argv) < 2:
        print("Usage: python run_specials_agent.py <file_path> <supplier>")
        return

    path = sys.argv[1]
    supplier = sys.argv[2] if len(sys.argv) > 2 else "Unknown"
    
    print(f"Processing {path} from {supplier}...")
    
    agent = get_specials_agent()
    result = await agent.ingest_flyer(path, supplier)
    
    print("\nResult:")
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
