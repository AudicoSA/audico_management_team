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
        # We need to wrap single sync in a session for logging
        # Or just run it. Prefer running structured.
        
        # Start background task
        async def _run_single():
             await orchestrator.sync_supplier(server)
             
        asyncio.create_task(_run_single())
        
        return {
            "success": True,
            "message": f"Sync started for {server['name']}",
            "supplier": server['name']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
