"""
Background worker for polling Gmail and processing emails.

This worker runs continuously and checks for new emails every 60 seconds.
It uses the EmailManagementAgent to classify and draft responses.
"""

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from agents.email_agent import EmailManagementAgent
from connectors.gmail import GmailConnector
from connectors.supabase import SupabaseConnector
from utils.logging import logger


class EmailWorker:
    """Background worker for email polling and processing."""

    def __init__(self, poll_interval: int = 60):
        """
        Initialize the email worker.

        Args:
            poll_interval: Seconds between polling cycles (default: 60)
        """
        self.poll_interval = poll_interval
        self.is_running = False
        self.agent = None

    async def initialize(self):
        """Initialize connectors and agent."""
        try:
            logger.info("worker_initializing", poll_interval=self.poll_interval)

            # Initialize agent (it will create its own connectors)
            self.agent = EmailManagementAgent()

            logger.info("worker_initialized")
        except Exception as e:
            logger.error("worker_init_failed", error=str(e))
            raise

    async def poll_and_process(self):
        """Poll Gmail and process new emails."""
        try:
            logger.info("polling_started")

            # Get unread emails from Gmail
            gmail = self.agent.gmail
            messages = gmail.list_unread(max_results=10)

            if not messages:
                logger.info("polling_no_new_emails")
                return

            logger.info("polling_found_emails", count=len(messages))

            # Process each email
            for message in messages:
                try:
                    message_id = message["id"]

                    # Check if already processed
                    existing = await self.agent.supabase.get_email_log_by_gmail_id(
                        message_id
                    )
                    if existing:
                        logger.info(
                            "email_already_processed",
                            message_id=message_id,
                        )
                        continue

                    # Process the email
                    logger.info("processing_email", message_id=message_id)
                    result = await self.agent.run({"gmail_message_id": message_id})

                    if result.get("status") == "success":
                        logger.info(
                            "email_processed_success",
                            message_id=message_id,
                            category=result.get("category"),
                        )
                    else:
                        logger.error(
                            "email_processed_failed",
                            message_id=message_id,
                            error=result.get("error"),
                        )

                except Exception as e:
                    logger.error(
                        "email_processing_error",
                        message_id=message.get("id"),
                        error=str(e),
                    )

            logger.info("polling_completed", processed=len(messages))

        except Exception as e:
            logger.error("polling_failed", error=str(e))

    async def run(self):
        """Run the worker loop."""
        await self.initialize()

        self.is_running = True
        logger.info("worker_started", poll_interval=self.poll_interval)

        try:
            while self.is_running:
                await self.poll_and_process()

                # Wait for next poll
                logger.info("worker_sleeping", seconds=self.poll_interval)
                await asyncio.sleep(self.poll_interval)

        except KeyboardInterrupt:
            logger.info("worker_interrupted")
        except Exception as e:
            logger.error("worker_error", error=str(e))
            raise
        finally:
            self.is_running = False
            logger.info("worker_stopped")

    def stop(self):
        """Stop the worker loop."""
        self.is_running = False


async def main():
    """Main entry point for the worker."""
    # Get poll interval from environment or use default
    poll_interval = int(os.getenv("EMAIL_POLL_INTERVAL", "60"))

    # Create and run worker
    worker = EmailWorker(poll_interval=poll_interval)

    try:
        await worker.run()
    except KeyboardInterrupt:
        logger.info("worker_shutdown_requested")
        worker.stop()


if __name__ == "__main__":
    asyncio.run(main())
