"""
MCP Sync Orchestration Service
Triggers all MCP supplier feeds to sync data into Supabase
"""
import asyncio
import subprocess
import os
from datetime import datetime
from typing import Dict, List
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

logger = AgentLogger("MCPSyncOrchestrator")

# Path to MCP servers directory
MCP_SERVERS_PATH = os.getenv("MCP_SERVERS_PATH", "D:\\AudicoAI\\Audico Final Quote System\\audico-mcp-servers")

# MCP servers to sync (in order)
MCP_SERVERS = [
    {"name": "Nology", "path": "mcp-feed-nology", "enabled": True},
    {"name": "Stock2Shop", "path": "mcp-feed-stock2shop", "enabled": True},
    {"name": "Solution Technologies", "path": "mcp-feed-solution-technologies", "enabled": True},
    {"name": "Esquire", "path": "mcp-feed-esquire", "enabled": True},
    {"name": "Scoop", "path": "mcp-feed-scoop", "enabled": True},
    {"name": "Smart Homes", "path": "mcp-feed-smart-homes", "enabled": True},
    {"name": "Connoisseur", "path": "mcp-feed-connoisseur", "enabled": True},
    {"name": "ProAudio", "path": "mcp-feed-proaudio", "enabled": True},
    {"name": "Planet World", "path": "mcp-feed-planetworld", "enabled": True},
    # Disabled servers (have issues per Claude's report)
    {"name": "Homemation", "path": "mcp-feed-homemation", "enabled": False},
    {"name": "Google Merchant", "path": "mcp-feed-google-merchant", "enabled": False},
]

class MCPSyncOrchestrator:
    """Orchestrates syncing of all MCP supplier feeds."""
    
    def __init__(self):
        self.supabase = get_supabase_connector()
        self.session_id = None
        self.results = []
    
    async def sync_supplier(self, server: Dict) -> Dict:
        """Sync a single MCP server."""
        supplier_name = server["name"]
        server_path = os.path.join(MCP_SERVERS_PATH, server["path"])
        
        logger.info("sync_supplier_start", supplier=supplier_name, path=server_path)
        
        start_time = datetime.now()
        
        try:
            # Check if directory exists
            if not os.path.exists(server_path):
                raise FileNotFoundError(f"MCP server directory not found: {server_path}")
            
            # Run npm run sync in the server directory
            process = await asyncio.create_subprocess_exec(
                "npm", "run", "sync",
                cwd=server_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            duration = (datetime.now() - start_time).total_seconds()
            
            if process.returncode == 0:
                logger.info("sync_supplier_success", 
                           supplier=supplier_name, 
                           duration=duration)
                
                return {
                    "supplier": supplier_name,
                    "status": "success",
                    "duration": duration,
                    "output": stdout.decode()[:500],  # First 500 chars
                    "error": None
                }
            else:
                logger.error("sync_supplier_failed", 
                            supplier=supplier_name, 
                            error=stderr.decode())
                
                return {
                    "supplier": supplier_name,
                    "status": "failed",
                    "duration": duration,
                    "output": None,
                    "error": stderr.decode()[:500]
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
