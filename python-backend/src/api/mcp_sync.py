"""
FastAPI endpoint to trigger MCP sync
"""
from fastapi import APIRouter, HTTPException
from src.jobs.sync_all_suppliers import run_sync
import asyncio

router = APIRouter(prefix="/api/mcp", tags=["mcp"])

@router.post("/sync-all")
async def trigger_mcp_sync():
    """
    Trigger sync for all MCP supplier feeds.
    """
    try:
        # Run in background to avoid timeout
        asyncio.create_task(run_sync())
        
        return {
            "success": True,
            "message": "Sync started in background"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {str(e)}"
        )

@router.get("/sync-all")
async def trigger_mcp_sync_get():
    """Trigger sync for all MCP supplier feeds (GET wrapper for cron)."""
    return await trigger_mcp_sync()

@router.get("/suppliers")
async def get_suppliers():
    """List all available MCP suppliers."""
    from src.jobs.sync_all_suppliers import MCP_SERVERS
    return {"suppliers": MCP_SERVERS}

@router.post("/sync/{supplier_key}")
async def trigger_single_sync(supplier_key: str):
    """Trigger sync for a specific supplier."""
    from src.jobs.sync_all_suppliers import MCPSyncOrchestrator, MCP_SERVERS
    
    # Verify supplier exists
    server = next((s for s in MCP_SERVERS if s["endpoint"] == supplier_key), None)
    if not server:
         # Fallback try name match
        server = next((s for s in MCP_SERVERS if s["name"].lower() == supplier_key.lower()), None)
        
    if not server:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    try:
        orchestrator = MCPSyncOrchestrator()
        
        # Start background task with logging
        async def _run_single():
             await orchestrator.sync_single_with_logging(server["endpoint"])
             
        asyncio.create_task(_run_single())
        
        return {
            "success": True,
            "message": f"Sync started for {server['name']}",
            "supplier": server['name']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sync/{supplier_key}")
async def trigger_single_sync_get(supplier_key: str):
    """Trigger sync for a specific supplier (GET wrapper for cron)."""
    return await trigger_single_sync(supplier_key)

@router.get("/sync-status")
async def get_sync_status():
    """Get status of recent MCP syncs."""
    from src.connectors.supabase import get_supabase_connector
    
    supabase = get_supabase_connector()
    
    # Get last 10 sync sessions
    sessions = supabase.client.table("mcp_sync_sessions")\
        .select("*")\
        .order("started_at", desc=True)\
        .limit(10)\
        .execute()
    
    return {
        "recent_syncs": sessions.data
    }

@router.get("/sync-status/{session_id}")
async def get_sync_session(session_id: str):
    """Get detailed status of a specific sync session."""
    from src.connectors.supabase import get_supabase_connector
    
    supabase = get_supabase_connector()
    
    # Get session
    session = supabase.client.table("mcp_sync_sessions")\
        .select("*")\
        .eq("id", session_id)\
        .single()\
        .execute()
    
    # Get logs
    logs = supabase.client.table("mcp_sync_log")\
        .select("*")\
        .eq("session_id", session_id)\
        .order("created_at")\
        .execute()
    
    return {
        "session": session.data,
        "logs": logs.data
    }

@router.get("/health")
async def check_mcp_health():
    """Check connectivity to the Node.js MCP service."""
    from src.jobs.sync_all_suppliers import MCP_SERVICE_URL
    import httpx
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{MCP_SERVICE_URL}/health")
            
            if response.status_code == 200:
                return {
                    "status": "connected",
                    "mcp_service": "healthy",
                    "url": MCP_SERVICE_URL,
                    "details": response.json()
                }
            else:
                return {
                    "status": "error",
                    "mcp_service": "unhealthy", 
                    "status_code": response.status_code,
                    "url": MCP_SERVICE_URL,
                    "error": response.text
                }
    except Exception as e:
        return {
            "status": "error",
            "mcp_service": "unreachable",
            "url": MCP_SERVICE_URL,
            "error": str(e)
        }
