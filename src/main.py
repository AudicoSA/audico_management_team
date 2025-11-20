"""FastAPI entrypoint for Audico AI system."""
import asyncio
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.agents.email_agent import get_email_agent
from src.agents.orders_agent import get_orders_agent
from src.utils.config import get_config
from src.utils.logging import get_logger, setup_logging

# Setup logging
setup_logging()
logger = get_logger("main")

# Background task for email polling
email_poll_task = None


async def email_polling_loop():
    """Background task that polls Gmail periodically."""
    config = get_config()
    interval = config.gmail_polling_interval_seconds

    while True:
        try:
            logger.info("email_poll_started")
            agent = get_email_agent()
            result = await agent.poll_and_process()
            logger.info("email_poll_completed", **result)
        except Exception as e:
            logger.error("email_poll_error", error=str(e))

        # Wait before next poll
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan (startup and shutdown)."""
    global email_poll_task

    # Startup
    logger.info("application_starting")
    config = get_config()

    # Start email polling in background
    if config.agent_enabled.get("EmailManagementAgent", False):
        email_poll_task = asyncio.create_task(email_polling_loop())
        logger.info("email_polling_started", interval=config.gmail_polling_interval_seconds)

    yield

    # Shutdown
    logger.info("application_shutting_down")
    if email_poll_task:
        email_poll_task.cancel()
        try:
            await email_poll_task
        except asyncio.CancelledError:
            pass


# Create FastAPI app
app = FastAPI(
    title="Audico AI Executive Management System",
    description="Multi-agent AI system for e-commerce automation",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS for dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "https://*.vercel.app",  # Vercel deployments
        "https://dashboard.audicoonline.co.za",  # Production domain (if configured)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Audico AI",
        "version": "0.1.0",
        "status": "operational",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        config = get_config()
        return {
            "status": "healthy",
            "environment": config.environment,
            "agents": {
                "EmailManagementAgent": config.agent_enabled.get("EmailManagementAgent", False),
            },
        }
    except Exception as e:
        logger.error("health_check_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Health check failed")


@app.post("/email/poll")
async def trigger_email_poll(background_tasks: BackgroundTasks):
    """Manually trigger email polling."""
    try:
        agent = get_email_agent()
        result = await agent.poll_and_process()
        return result
    except Exception as e:
        logger.error("manual_poll_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/email/process/{message_id}")
async def process_email(message_id: str):
    """Process a specific email by message ID."""
    try:
        agent = get_email_agent()
        result = await agent.process_email(message_id)

        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result.get("error"))

        return result
    except Exception as e:
        logger.error("email_processing_failed", message_id=message_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/email/send/{email_id}")
async def send_email(email_id: str):
    """Send a drafted email by email_logs ID."""
    try:
        agent = get_email_agent()
        result = await agent.send_drafted_email(email_id)

        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error"))

        return result
    except Exception as e:
        logger.error("email_send_failed", email_id=email_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/shipments/create")
async def create_shipment(payload: Dict[str, Any]):
    """Create a shipment for an order."""
    try:
        agent = get_orders_agent()
        # Ensure action is set
        payload["action"] = "create_shipment"
        result = await agent.run(payload)
        
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error"))
            
        return result
    except Exception as e:
        logger.error("create_shipment_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/config")
async def get_configuration():
    """Get current configuration (non-sensitive)."""
    config = get_config()
    return {
        "environment": config.environment,
        "email_draft_mode": config.email_draft_mode,
        "polling_interval": config.gmail_polling_interval_seconds,
        "classification_threshold": config.email_classification_threshold,
        "agents_enabled": {
            "EmailManagementAgent": True,  # Stage 1 only
            "OrdersLogisticsAgent": False,
            "StockListingsAgent": False,
            "CustomerServiceAgent": False,
            "SocialMediaAgent": False,
        },
    }


@app.post("/config/agent/{agent_name}/toggle")
async def toggle_agent(agent_name: str, enabled: bool):
    """Enable or disable an agent."""
    global email_poll_task

    valid_agents = [
        "EmailManagementAgent",
        "OrdersLogisticsAgent",
        "StockListingsAgent",
        "CustomerServiceAgent",
        "SocialMediaAgent",
    ]

    if agent_name not in valid_agents:
        raise HTTPException(status_code=400, detail=f"Invalid agent name: {agent_name}")

    # Special handling for EmailManagementAgent - start/stop background polling
    if agent_name == "EmailManagementAgent":
        if enabled and (email_poll_task is None or email_poll_task.done()):
            email_poll_task = asyncio.create_task(email_polling_loop())
            logger.info("email_polling_started_via_api", interval=get_config().gmail_polling_interval_seconds)
        elif not enabled and email_poll_task and not email_poll_task.done():
            email_poll_task.cancel()
            try:
                await email_poll_task
            except asyncio.CancelledError:
                pass
            logger.info("email_polling_stopped_via_api")

    # TODO: Update config in Supabase for persistence
    logger.info("agent_toggled", agent=agent_name, enabled=enabled)

    return {"agent": agent_name, "enabled": enabled}


# Webhooks (Stage 2+)
@app.post("/webhooks/shiplogic")
async def shiplogic_webhook(payload: Dict[str, Any]):
    """Handle Shiplogic webhook for shipment updates."""
    logger.info("shiplogic_webhook_received", payload=payload)
    # TODO: Implement in Stage 2
    return {"status": "received"}


@app.post("/webhooks/opencart")
async def opencart_webhook(payload: Dict[str, Any]):
    """Handle OpenCart webhook for order updates."""
    logger.info("opencart_webhook_received", payload=payload)
    # TODO: Implement in Stage 2
    return {"status": "received"}


if __name__ == "__main__":
    import uvicorn

    config = get_config()
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=config.port,
        reload=config.environment == "development",
        log_level=config.log_level.lower(),
    )
