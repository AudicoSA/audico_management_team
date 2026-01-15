import sys
import traceback

with open("approval_debug.txt", "w", encoding="utf-8") as f:
    f.write("DEBUG: Script starting...\n")
    f.flush()

    try:
        import asyncio
        import os
        f.write("DEBUG: Imported os/asyncio\n")
        f.flush()
        
        from dotenv import load_dotenv
        f.write("DEBUG: Imported dotenv\n")
        f.flush()
        
        import structlog
        f.write("DEBUG: Imported structlog\n")
        f.flush()

        # Load environment variables
        load_dotenv("mcp-http-service/.env")
        f.write("DEBUG: Loaded env vars\n")
        f.flush()

        from src.agents.stock_agent import StockListingsAgent
        f.write("DEBUG: Imported StockListingsAgent\n")
        f.flush()
        
        from src.connectors.supabase import SupabaseConnector
        f.write("DEBUG: Imported SupabaseConnector\n")
        f.flush()
        
        from src.connectors.opencart import OpenCartConnector
        f.write("DEBUG: Imported OpenCartConnector\n")
        f.flush()

        logger = structlog.get_logger()

        async def main():
            f.write("DEBUG: Inside main\n")
            f.flush()
            
            # Initialize agents
            sb_connector = SupabaseConnector()
            oc_connector = OpenCartConnector()
            agent = StockListingsAgent(sb_connector, oc_connector)
            f.write("DEBUG: Agents initialized\n")
            f.flush()
            
            try:
                # Fetch items marked for approval
                response = sb_connector.client.table("new_products_queue")\
                    .select("*")\
                    .eq("status", "approved_pending")\
                    .execute()
                
                items = response.data
                f.write(f"Found {len(items)} pending approvals\n")
                f.flush()
                
                for item in items:
                    f.write(f"Processing approval for: {item['name']}\n")
                    f.flush()
                    result = await agent.approve_new_product(item['id'])
                    f.write(f"Result: {result}\n")
                    f.flush()
                    
            except Exception as e:
                f.write(f"Error in processing: {e}\n")
                traceback.print_exc(file=f)
                f.flush()

        if __name__ == "__main__":
            asyncio.run(main())

    except Exception as e:
        f.write(f"CRITICAL ERROR: {e}\n")
        traceback.print_exc(file=f)
        f.flush()
