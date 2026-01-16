from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from src.scheduler.supplier_scanner import SupplierScanner
from src.utils.logging import AgentLogger

logger = AgentLogger("APSScheduler")

# Global scheduler instance
scheduler = AsyncIOScheduler()
scanner_service = SupplierScanner()

async def run_scanner_job(supplier_name: str):
    """Wrapper to run scanner from job."""
    logger.info("scheduled_job_started", supplier=supplier_name)
    try:
        await scanner_service.run_scan(supplier_name)
    except Exception as e:
        logger.error("scheduled_job_failed", supplier=supplier_name, error=str(e))

def setup_scheduler():
    """Configure and start the scheduler."""
    # Esquire: 08:00 AM Daily
    scheduler.add_job(
        run_scanner_job, 
        CronTrigger(hour=8, minute=0), 
        args=["Esquire"], 
        id="scan_esquire",
        replace_existing=True
    )
    
    # Rectron: 08:30 AM Daily
    scheduler.add_job(
        run_scanner_job, 
        CronTrigger(hour=8, minute=30), 
        args=["Rectron"], 
        id="scan_rectron",
        replace_existing=True
    )
    
    logger.info("scheduler_jobs_configured")

def start_scheduler():
    """Start the scheduler."""
    if not scheduler.running:
        setup_scheduler()
        scheduler.start()
        logger.info("scheduler_started")

def stop_scheduler():
    """Shutdown the scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("scheduler_stopped")
