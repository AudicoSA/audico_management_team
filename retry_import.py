
import asyncio
from src.connectors.supabase import SupabaseConnector
from src.connectors.opencart import OpenCartConnector
from src.agents.stock_agent import StockListingsAgent
from dotenv import load_dotenv

load_dotenv()

async def retry_upload(upload_id):
    sb = SupabaseConnector()
    
    print(f"Resetting upload {upload_id} to pending...")
    sb.client.table("price_list_uploads").update({
        "status": "pending",
        "error_message": None
    }).eq("id", upload_id).execute()
    
    print("Triggering poller manually...")
    oc = OpenCartConnector()
    agent = StockListingsAgent(sb, oc)
    await agent.poll_pending_uploads()
    print("Done.")

if __name__ == "__main__":
    # ID from previous step
    upload_id = "a2188558-5265-44f0-acfe-9f74f145f8a9"
    asyncio.run(retry_upload(upload_id))
