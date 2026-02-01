from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from src.scheduler.supplier_scanner import SupplierScanner
from src.agents.stock_agent import StockListingsAgent
from src.connectors.supabase import get_supabase_connector
from src.connectors.opencart import OpenCartConnector
from src.utils.logging import AgentLogger

from src.scheduler.universal_sync import UniversalProductSyncer
from src.jobs.sync_all_suppliers import MCPSyncOrchestrator

from src.agents.kait_agent import KaitAgent

logger = AgentLogger("APSScheduler")

# Global scheduler instance
scheduler = AsyncIOScheduler()
scanner_service = SupplierScanner()
universal_syncer = UniversalProductSyncer()
kait_agent = KaitAgent()

async def run_scanner_job(supplier_name: str):
    """Wrapper to run scanner from job."""
    logger.info("scheduled_job_started", supplier=supplier_name)
    try:
        await scanner_service.run_scan(supplier_name)
    except Exception as e:
        logger.error("scheduled_job_failed", supplier=supplier_name, error=str(e))

async def run_kait_cycle_job():
    """Wrapper to run Kait's main cycle (Outbox, Replies, etc)."""
    # logger.info("kait_cycle_job_started")
    try:
        await kait_agent.run_cycle()
    except Exception as e:
        logger.error("kait_cycle_job_failed", error=str(e))

async def run_queue_processor_job():
    """Wrapper to run queue processor."""
    logger.info("queue_processor_job_started")
    try:
        sb = get_supabase_connector()
        oc = OpenCartConnector()
        agent = StockListingsAgent(sb, oc)
        await agent.process_approval_queue()
    except Exception as e:
        logger.error("queue_processor_job_failed", error=str(e))

async def run_universal_sync_job():
    """Wrapper to run universal product sync."""
    logger.info("universal_sync_job_started")
    try:
        await universal_syncer.sync_all_products(dry_run=False)
    except Exception as e:
        logger.error("universal_sync_job_failed", error=str(e))

async def run_mcp_sync_job(supplier_key: str):
    """Wrapper to run MCP supplier sync."""
    logger.info("mcp_sync_job_started", supplier=supplier_key)
    try:
        orchestrator = MCPSyncOrchestrator()
        await orchestrator.sync_single_with_logging(supplier_key)
        logger.info("mcp_sync_job_completed", supplier=supplier_key)
    except Exception as e:
        logger.error("mcp_sync_job_failed", supplier=supplier_key, error=str(e))

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
    
    # Kait Cycle: Every minute
    scheduler.add_job(
        run_kait_cycle_job,
        CronTrigger(minute="*"),
        id="kait_agent_lifecycle",
        replace_existing=True
    )
    
    # Queue Processor: Every minute
    scheduler.add_job(
        run_queue_processor_job,
        CronTrigger(minute="*"),
        id="process_approval_queue",
        replace_existing=True
    )

    # Upload Poller: Every minute
    scheduler.add_job(
        run_upload_poller_job,
        CronTrigger(minute="*"),
        id="poll_pending_uploads",
        replace_existing=True
    )

    # Pro Audio MCP Sync: 02:30 AM Daily (before 3 AM universal sync via cron-job.org)
    scheduler.add_job(
        run_mcp_sync_job,
        CronTrigger(hour=2, minute=30),
        args=["proaudio"],
        id="mcp_sync_proaudio",
        replace_existing=True
    )

    # Universal Sync: 03:00 AM Daily (also triggered externally via cron-job.org)
    scheduler.add_job(
        run_universal_sync_job,
        CronTrigger(hour=3, minute=0),
        id="universal_product_sync",
        replace_existing=True
    )

async def run_upload_poller_job():
    """Wrapper to run upload poller."""
    # logger.info("upload_poller_job_started") # Too noisy every minute
    try:
        sb = get_supabase_connector()
        oc = OpenCartConnector()
        agent = StockListingsAgent(sb, oc)
        await agent.poll_pending_uploads()
    except Exception as e:
        logger.error("upload_poller_job_failed", error=str(e))


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
