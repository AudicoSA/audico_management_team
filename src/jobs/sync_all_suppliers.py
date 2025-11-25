"""
MCP Sync Orchestration Service
Triggers all MCP supplier feeds to sync data into Supabase via HTTP
"""
import asyncio
import httpx
import os
from datetime import datetime
from typing import Dict, List
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

logger = AgentLogger("MCPSyncOrchestrator")

# MCP HTTP Service URL (configured via Railway environment variable)
MCP_SERVICE_URL = os.getenv("MCP_SERVICE_URL", "http://localhost:3000")


# MCP servers to sync (in order)
# Each entry maps to an endpoint on the MCP HTTP service
MCP_SERVERS = [
    {"name": "Nology", "endpoint": "nology", "enabled": True},
    {"name": "Stock2Shop", "endpoint": "stock2shop", "enabled": True},
    {"name": "Solution Technologies", "endpoint": "solution-technologies", "enabled": True},
    {"name": "Esquire", "endpoint": "esquire", "enabled": True},
    {"name": "Scoop", "endpoint": "scoop", "enabled": True},
    {"name": "Smart Homes", "endpoint": "smart-homes", "enabled": True},
    {"name": "Connoisseur", "endpoint": "connoisseur", "enabled": True},
    {"name": "ProAudio", "endpoint": "proaudio", "enabled": True},
    {"name": "Planet World", "endpoint": "planetworld", "enabled": True},
    # Disabled servers (have issues per Claude's report)
    {"name": "Homemation", "endpoint": "homemation", "enabled": False},
    {"name": "Google Merchant", "endpoint": "google-merchant", "enabled": False},
]

class MCPSyncOrchestrator:
    """Orchestrates syncing of all MCP supplier feeds."""
    
    def __init__(self):
        self.supabase = get_supabase_connector()
        self.session_id = None
        self.results = []
    
    async def sync_supplier(self, server: Dict) -> Dict:
        """Sync a single MCP server via HTTP."""
        supplier_name = server["name"]
        endpoint = server["endpoint"]
        
        logger.info("sync_supplier_start", supplier=supplier_name, endpoint=endpoint)
        
        start_time = datetime.now()
        
        try:
            # Make HTTP POST request to MCP HTTP service
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{MCP_SERVICE_URL}/sync/{endpoint}"
                )
                
                duration = (datetime.now() - start_time).total_seconds()
                
                if response.status_code == 200:
                    data = response.json()
                    
                    logger.info("sync_supplier_success", 
                               supplier=supplier_name, 
                               duration=duration)
                    
                    return {
                        "supplier": supplier_name,
                        "status": "success",
                        "duration": duration,
                        "output": data.get("output", "")[:500],
                        "error": None
                    }
                else:
                    error_data = response.json() if response.headers.get("content-type") == "application/json" else {"error": response.text}
                    
                    logger.error("sync_supplier_failed", 
                                supplier=supplier_name, 
                                error=error_data.get("error", "Unknown error"))
                    
                    return {
                        "supplier": supplier_name,
                        "status": "failed",
                        "duration": duration,
                        "output": None,
                        "error": str(error_data.get("error", "Unknown error"))[:500]
                    }
                    
        except httpx.TimeoutException as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error("sync_supplier_timeout", 
                        supplier=supplier_name, 
                        error=str(e))
            
            return {
                "supplier": supplier_name,
                "status": "error",
                "duration": duration,
                "output": None,
                "error": f"Timeout after {duration}s"
            }
            
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error("sync_supplier_error", 
                        supplier=supplier_name, 
                        error=str(e))
            
            return {
                "supplier": supplier_name,
                "status": "error",
                "duration": duration,
                "output": None,
                "error": str(e)
            }
    
    async def sync_all(self) -> Dict:
        """Sync all enabled MCP servers sequentially."""
        logger.info("sync_all_start", total_servers=len([s for s in MCP_SERVERS if s["enabled"]]))
        
        # Create sync session in database
        session_data = {
            "started_at": datetime.now().isoformat(),
            "status": "running",
            "total_suppliers": len([s for s in MCP_SERVERS if s["enabled"]]),
            "completed_suppliers": 0,
            "failed_suppliers": 0
        }
        
        session_response = self.supabase.client.table("mcp_sync_sessions")\
            .insert(session_data)\
            .execute()
        
        self.session_id = session_response.data[0]["id"]
        
        # Sync each server sequentially
        results = []
        for server in MCP_SERVERS:
            if not server["enabled"]:
                logger.info("sync_supplier_skipped", supplier=server["name"])
                continue
            
            result = await self.sync_supplier(server)
            results.append(result)
            
            # Log to database
            self.supabase.client.table("mcp_sync_log")\
                .insert({
                    "session_id": self.session_id,
                    "supplier_name": result["supplier"],
                    "status": result["status"],
                    "duration_seconds": result["duration"],
                    "output": result["output"],
                    "error": result["error"]
                })\
                .execute()
        
        # Update session
        completed = len([r for r in results if r["status"] == "success"])
        failed = len([r for r in results if r["status"] in ["failed", "error"]])
        
        self.supabase.client.table("mcp_sync_sessions")\
            .update({
                "completed_at": datetime.now().isoformat(),
                "status": "completed" if failed == 0 else "partial",
                "completed_suppliers": completed,
                "failed_suppliers": failed
            })\
            .eq("id", self.session_id)\
            .execute()
        
        logger.info("sync_all_complete", 
                   completed=completed, 
                   failed=failed, 
                   total=len(results))
        
        return {
            "session_id": self.session_id,
            "total": len(results),
            "completed": completed,
            "failed": failed,
            "results": results
        }

async def run_sync():
    """Main entry point for MCP sync."""
    orchestrator = MCPSyncOrchestrator()
    return await orchestrator.sync_all()

if __name__ == "__main__":
    # For manual testing
    result = asyncio.run(run_sync())
    print(f"\nSync completed: {result['completed']}/{result['total']} successful")
