from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, List
from src.scheduler.jobs import scheduler, scanner_service

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])

@router.get("/jobs")
async def get_jobs():
    """List all scheduled jobs."""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "next_run_time": job.next_run_time,
            "args": job.args
        })
    return {"jobs": jobs, "running": scheduler.running}

@router.post("/scan/{supplier_name}")
async def trigger_scan(supplier_name: str, background_tasks: BackgroundTasks):
    """Manually trigger a scan for a supplier."""
    supplier_name = supplier_name.capitalize()
    
    # Check if scanner exists
    if supplier_name not in scanner_service.scanners:
        raise HTTPException(status_code=404, detail=f"Scanner for {supplier_name} not found")
    
    # Run in background
    background_tasks.add_task(scanner_service.run_scan, supplier_name)
    
    return {"message": f"Scan for {supplier_name} started in background"}
    
@router.post("/start")
async def start_scheduler_api():
    """Start the scheduler manually if stopped."""
    if not scheduler.running:
        scheduler.start()
        return {"status": "started"}
    return {"status": "already_running"}

@router.post("/stop")
async def stop_scheduler_api():
    """Stop the scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        return {"status": "stopped"}
    return {"status": "not_running"}

@router.post("/run-universal-sync")
async def run_universal_sync(background_tasks: BackgroundTasks):
    """
    Trigger the universal product sync (price + stock updates).
    
    This endpoint is designed to be called by external cron services like:
    - cron-job.org
    - Railway Cron (with public URL)
    - GitHub Actions
    
    Schedule: Daily at 6:00 AM (or whenever you configure external cron)
    """
    from src.scheduler.jobs import universal_syncer
    from src.utils.logging import AgentLogger
    
    logger = AgentLogger("UniversalSyncAPI")
    logger.info("universal_sync_triggered_via_api")
    
    # Run in background so the HTTP response returns immediately
    background_tasks.add_task(universal_syncer.sync_all_products, dry_run=False)
    
    return {
        "status": "started",
        "message": "Universal product sync started in background",
        "note": "Check /api/logs for progress"
    }

