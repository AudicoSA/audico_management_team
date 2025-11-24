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
    This endpoint is called by Railway cron job.
    """
    try:
        result = await run_sync()
        
        return {
            "success": True,
            "message": f"Sync completed: {result['completed']}/{result['total']} suppliers successful",
            "session_id": result["session_id"],
            "total": result["total"],
            "completed": result["completed"],
            "failed": result["failed"],
            "results": result["results"]
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {str(e)}"
        )

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
