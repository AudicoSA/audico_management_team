
import asyncio
import os
import argparse
from dotenv import load_dotenv
import structlog

# Load env from mcp-http-service if available, or .env
load_dotenv("mcp-http-service/.env")
load_dotenv(".env")
# Also load from parent directory
load_dotenv(os.path.join(os.path.dirname(os.getcwd()), ".env"))
load_dotenv("../.env")

from src.agents.stock_agent import StockListingsAgent
from src.connectors.supabase import SupabaseConnector
from src.connectors.opencart import OpenCartConnector
from unittest.mock import AsyncMock

# Setup logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()

async def main():
    parser = argparse.ArgumentParser(description="Run StockListingsAgent locally")
    parser.add_argument("file", help="Path to pricelist file (CSV/XLSX)")
    parser.add_argument("--supplier", default="Test Supplier", help="Supplier Name")
    parser.add_argument("--mock-storage", action="store_true", help="Mock Supabase Storage upload")
    parser.add_argument("--mock-openai", action="store_true", help="Mock OpenAI extraction (save cost)")
    
    args = parser.parse_args()
    
    # Validation
    if not os.path.exists(args.file):
        print(f"Error: File {args.file} not found.")
        return

    # Check Env
    if not os.getenv("SUPABASE_URL"):
        print("Warning: SUPABASE_URL not set. Ensure .env is loaded.")

    # Init Connectors
    sb = SupabaseConnector()
    oc = OpenCartConnector()
    
    agent = StockListingsAgent(sb, oc)
    
    # Mocks
    if args.mock_storage:
        print("Mocking Supabase Storage upload...")
        agent._upload_to_storage = AsyncMock(return_value="mock/path/to/file")
        agent._create_upload_record = AsyncMock(return_value="mock_upload_id_123")
        agent._mark_upload_completed = AsyncMock()
        
        # We need to mock _extract_text_from_file depending on if we want to test regex or openai
        # But actually process_price_list reads file_data.
    
    if args.mock_openai:
        print("Mocking OpenAI extraction...")
        # We need to mock _extract_with_openai to return parsed data from the file content
        # For simplicity, let's just use the real one unless specified, or implement a basic CSV parser fallback
        pass

    # Read file
    with open(args.file, "rb") as f:
        file_data = f.read()
        
    print(f"Processing {args.file} for {args.supplier}...")
    
    try:
        result = await agent.process_price_list(
            file_data,
            os.path.basename(args.file),
            args.supplier,
            instruction="cost_excl_vat"
        )
        import json
        print("Result:", json.dumps(result, indent=2))
    except Exception as e:
        print("CRITICAL ERROR:", str(e))
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
