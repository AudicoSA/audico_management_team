import asyncio
print("Script starting...")
import os
import time
from dotenv import load_dotenv
from supabase import create_client, Client
import structlog

# Load environment variables
load_dotenv("mcp-http-service/.env")

from src.agents.stock_agent import StockListingsAgent
from src.connectors.supabase import SupabaseConnector
from src.connectors.opencart import OpenCartConnector

logger = structlog.get_logger()

async def process_pending_uploads():
    """Polls Supabase for pending price list uploads and processes them."""
    
    # Initialize connectors
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        logger.error("missing_supabase_credentials")
        return

    # Initialize agents
    sb_connector = SupabaseConnector()
    oc_connector = OpenCartConnector()
    agent = StockListingsAgent(sb_connector, oc_connector)
    
    logger.info("starting_upload_processor")
    
    while True:
        try:
            # 1. Fetch pending uploads
            response = sb_connector.client.table("price_list_uploads")\
                .select("*")\
                .eq("status", "pending")\
                .execute()
            
            uploads = response.data
            
            if not uploads:
                # No work, sleep and retry
                await asyncio.sleep(10)
                continue
                
            logger.info("found_pending_uploads", count=len(uploads))
            
            for upload in uploads:
                upload_id = upload['id']
                filename = upload['filename']
                storage_path = upload['storage_path']
                supplier_name = upload.get('supplier_name', 'Unknown')
                instruction = upload.get('instruction', 'cost_excl_vat')
                markup_pct = upload.get('markup_pct')
                
                logger.info("processing_upload", upload_id=upload_id, filename=filename, instruction=instruction, markup=markup_pct)
                
                try:
                    # 2. Download file from Storage
                    file_data = sb_connector.client.storage\
                        .from_("invoices")\
                        .download(storage_path)
                    
                    # 3. Process with Agent
                    result = await agent.process_price_list(
                        file_data, 
                        filename, 
                        supplier_name,
                        instruction,
                        upload_id=upload_id,
                        markup_pct=markup_pct
                    )
                    
                    logger.info("upload_processed", result=result)
                    
                except Exception as e:
                    logger.error("upload_processing_failed", upload_id=upload_id, error=str(e))
                    # Update status to failed
                    sb_connector.client.table("price_list_uploads").update({
                        "status": "failed",
                        "error_message": str(e)
                    }).eq("id", upload_id).execute()
            
        except Exception as e:
            logger.error("processor_loop_error", error=str(e))
            await asyncio.sleep(30)

async def process_pending_approvals():
    """Polls Supabase for approved products and pushes them to OpenCart."""
    
    # Initialize agents
    sb_connector = SupabaseConnector()
    oc_connector = OpenCartConnector()
    agent = StockListingsAgent(sb_connector, oc_connector)
    
    print("Starting approval processor loop...")
    
    while True:
        try:
            # Fetch items marked for approval
            response = sb_connector.client.table("new_products_queue")\
                .select("*")\
                .eq("status", "approved_pending")\
                .execute()
            
            items = response.data
            
            if not items:
                await asyncio.sleep(5)
                continue
                
            print(f"Found {len(items)} pending approvals")
            
            for item in items:
                print(f"Processing approval for: {item['name']}")
                await agent.approve_new_product(item['id'])
                print(f"Finished approval for: {item['name']}")
                
        except Exception as e:
            print(f"Approval processor error: {e}")
            await asyncio.sleep(30)

async def main():
    # Run both processors concurrently
    await asyncio.gather(
        process_pending_uploads(),
        process_pending_approvals()
    )

if __name__ == "__main__":
    asyncio.run(main())
