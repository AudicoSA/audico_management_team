"""Email Management Agent for handling customer and supplier emails."""
import re
from typing import Any, Dict, Optional

from src.connectors.gmail import GmailConnector, ParsedEmail, get_gmail_connector
from src.connectors.opencart import OpenCartConnector, get_opencart_connector
from src.connectors.shiplogic import ShiplogicConnector, get_shiplogic_connector
from src.connectors.supabase import SupabaseConnector, get_supabase_connector
from src.models.llm_client import classify_email, draft_email_response
from src.utils.config import get_config
from src.utils.logging import AgentLogger, get_trace_id, set_trace_id

logger = AgentLogger("EmailManagementAgent")


class EmailManagementAgent:
    """Agent responsible for email intake, classification, and response drafting."""

    def __init__(self):
        """Initialize email management agent with connectors."""
        self.config = get_config()
        self.gmail = get_gmail_connector()
        self.opencart = get_opencart_connector()
        self.shiplogic = get_shiplogic_connector()
        self.supabase = get_supabase_connector()
        logger.info("email_agent_initialized")

    async def process_email(self, message_id: str) -> Dict[str, Any]:
        """Process a single email end-to-end.

        Args:
            message_id: Gmail message ID

        Returns:
            Processing result dictionary
        """
        # Set trace ID for this email processing (generate a new UUID)
        import uuid
        trace_id = str(uuid.uuid4())
        set_trace_id(trace_id)

        try:
            # 1. Check if already processed
            if await self.supabase.check_email_already_processed(message_id):
                logger.info("email_already_processed", message_id=message_id)
                return {"status": "skipped", "reason": "already_processed"}

            # 2. Fetch email
            email = self.gmail.get_message(message_id)
            logger.info(
                "email_fetched",
                message_id=message_id,
                from_email=email.from_email,
                subject=email.subject,
            )

            # 3. Classify email
            classification = await classify_email(email.body, email.subject)
            category = classification["category"]
            confidence = classification["confidence"]

            logger.info(
                "email_classified",
                message_id=message_id,
                category=category,
                confidence=confidence,
            )

            # Check classification confidence threshold
            threshold = self.config.email_classification_threshold
            if confidence < threshold:
                logger.warning(
                    "low_classification_confidence",
                    message_id=message_id,
                    confidence=confidence,
                    threshold=threshold,
                )
                # Escalate low-confidence classifications
                category = "GENERAL_OTHER"

            # 4. Create email log
            await self.supabase.create_email_log(
                gmail_message_id=message_id,
                gmail_thread_id=email.thread_id,
                from_email=email.from_email,
                to_email=email.to_email,
                subject=email.subject,
                category=category,
                classification_confidence=confidence,
                payload={
                    "has_attachments": email.has_attachments,
                    "attachment_count": email.attachment_count,
                    "classification_reasoning": classification.get("reasoning", ""),
                },
            )

            # 5. Extract order numbers if present
            order_numbers = self._extract_order_numbers(email.subject, email.body)
            if order_numbers:
                logger.info("order_numbers_extracted", message_id=message_id, orders=order_numbers)

            # 6. Check if this is an internal/supplier email that shouldn't get auto-response
            skip_categories = [
                "INTERNAL_STAFF",
                "SUPPLIER_COMMUNICATION",
                "SUPPLIER_INVOICE",
                "SUPPLIER_PRICELIST",
                "NEW_ORDER_NOTIFICATION",
                "SPAM"
            ]

            if category in skip_categories:
                logger.info(
                    "email_skipped_no_draft",
                    message_id=message_id,
                    category=category,
                    reason="Internal/supplier email - no auto-response needed",
                    has_attachments=email.has_attachments,
                    attachment_count=email.attachment_count
                )

                # Update email log - use CLASSIFIED status for supplier emails to track them
                # Future agents can query by category to find emails needing processing
                await self.supabase.update_email_log(
                    gmail_message_id=message_id,
                    status="CLASSIFIED",  # Keep as CLASSIFIED so future agents can process
                    handled_by_agent="EmailManagementAgent",
                )

                # Apply category-specific labels for future agents
                self.gmail.apply_label(message_id, "agent_processed")
                if category == "SUPPLIER_INVOICE":
                    self.gmail.apply_label(message_id, "supplier_invoice")
                elif category == "SUPPLIER_PRICELIST":
                    self.gmail.apply_label(message_id, "supplier_pricelist")
                elif category == "SUPPLIER_COMMUNICATION":
                    self.gmail.apply_label(message_id, "supplier_communication")

                # Log for future agent to process
                await self.supabase.log_agent_event(
                    agent="EmailManagementAgent",
                    level="INFO",
                    event_type="supplier_email_logged",
                    context={
                        "message_id": message_id,
                        "category": category,
                        "has_attachments": email.has_attachments,
                        "attachment_count": email.attachment_count,
                        "from_email": email.from_email,
                        "subject": email.subject,
                        "requires_future_processing": category in ["SUPPLIER_INVOICE", "SUPPLIER_PRICELIST"]
                    },
                )

                return {
                    "status": "logged_for_future_processing",
                    "message_id": message_id,
                    "category": category,
                    "has_attachments": email.has_attachments,
                    "reason": "Logged for future agent processing - no auto-response"
                }

            # 7. Route based on category for customer emails
            context = await self._gather_context(category, email, order_numbers)

            # 8. Draft response
            draft_content = await self._draft_response(email, category, context)

            # 9. Create Gmail draft
            draft_id = self.gmail.create_draft(
                to_email=email.from_email,
                subject=f"Re: {email.subject}",
                body=draft_content,
                thread_id=email.thread_id,
            )

            # 10. Update email log with draft
            await self.supabase.update_email_log(
                gmail_message_id=message_id,
                status="DRAFTED",
                draft_content=draft_content,
                handled_by_agent="EmailManagementAgent",
            )

            # 11. Apply label and mark as processed
            self.gmail.apply_label(message_id, "agent_processed")

            # 12. Log to agent_logs
            await self.supabase.log_agent_event(
                agent="EmailManagementAgent",
                level="INFO",
                event_type="email_processed",
                context={
                    "message_id": message_id,
                    "category": category,
                    "confidence": confidence,
                    "draft_id": draft_id,
                },
            )

            logger.info("email_processed_successfully", message_id=message_id, draft_id=draft_id)

            return {
                "status": "success",
                "message_id": message_id,
                "category": category,
                "confidence": confidence,
                "draft_id": draft_id,
            }

        except Exception as e:
            logger.error("email_processing_failed", message_id=message_id, error=str(e))
            await self.supabase.log_agent_event(
                agent="EmailManagementAgent",
                level="ERROR",
                event_type="email_processing_error",
                context={"message_id": message_id, "error": str(e)},
            )
            return {"status": "error", "message_id": message_id, "error": str(e)}

    def _extract_order_numbers(self, subject: str, body: str) -> list[str]:
        """Extract order numbers from email subject and body.

        Looks for patterns like: #12345, Order 12345, Order #12345
        """
        combined_text = f"{subject} {body}"
        patterns = [
            r"#(\d{4,6})",  # #12345
            r"Order\s+#?(\d{4,6})",  # Order 12345 or Order #12345
            r"order\s+number\s*:?\s*#?(\d{4,6})",  # order number: 12345
        ]

        order_numbers = []
        for pattern in patterns:
            matches = re.findall(pattern, combined_text, re.IGNORECASE)
            order_numbers.extend(matches)

        # Return unique order numbers
        return list(set(order_numbers))

    async def _gather_context(
        self, category: str, email: ParsedEmail, order_numbers: list[str]
    ) -> Dict[str, Any]:
        """Gather additional context based on email category.

        Args:
            category: Email category
            email: Parsed email
            order_numbers: Extracted order numbers

        Returns:
            Context dictionary for drafting response
        """
        context = {}

        # Stage 1: Context gathering is optional - don't block on external APIs
        if category in ["ORDER_STATUS_QUERY", "NEW_ORDER_NOTIFICATION"] and order_numbers:
            try:
                # Try to fetch order info (with timeout)
                import asyncio
                order_no = order_numbers[0]  # Use first order number

                # Wrap in timeout to prevent hanging
                order_info = await asyncio.wait_for(
                    self.opencart.get_order(order_no),
                    timeout=5.0  # 5 second timeout
                )
                if order_info:
                    context["order"] = order_info

                    # Check shipment status (also with timeout)
                    try:
                        shipment_info = await asyncio.wait_for(
                            self.shiplogic.track_shipment(order_no),
                            timeout=5.0
                        )
                        if shipment_info:
                            context["shipment"] = shipment_info
                    except asyncio.TimeoutError:
                        logger.warning("shipment_tracking_timeout", order_no=order_no)
                    except Exception as e:
                        logger.warning("shipment_tracking_failed", order_no=order_no, error=str(e))

            except asyncio.TimeoutError:
                logger.warning("order_fetch_timeout", order_no=order_no)
                context["note"] = "Order lookup timed out - manual verification needed"
            except Exception as e:
                logger.warning("context_gathering_failed", category=category, error=str(e))
                context["note"] = "Unable to fetch order details - may need manual lookup"

        elif category == "COMPLAINT":
            # Mark for escalation
            context["escalate"] = True
            context["escalate_to"] = "kenny@audico.co.za"

        return context

    async def _draft_response(
        self, email: ParsedEmail, category: str, context: Dict[str, Any]
    ) -> str:
        """Draft email response based on category and context.

        Args:
            email: Parsed email
            category: Email category
            context: Additional context

        Returns:
            Drafted email body
        """
        # Handle special cases
        if category == "SPAM":
            # Don't draft response for spam
            return "[SPAM - No response needed]"

        if context.get("escalate"):
            escalation_note = f"\n\nNote: This email has been flagged for escalation to {context.get('escalate_to')}."
            draft = await draft_email_response(
                email.body, email.subject, category, context
            )
            return draft + escalation_note

        # Standard drafting
        draft = await draft_email_response(
            email.body, email.subject, category, context
        )

        return draft

    async def poll_and_process(self) -> Dict[str, Any]:
        """Poll Gmail for unread messages and process them.

        Returns:
            Processing summary
        """
        try:
            # Fetch unread messages
            message_ids = self.gmail.list_unread_messages()
            logger.info("polling_complete", unread_count=len(message_ids))

            if not message_ids:
                return {"processed": 0, "errors": 0}

            # Process each message
            results = []
            for message_id in message_ids:
                result = await self.process_email(message_id)
                results.append(result)

            # Summary
            processed = sum(1 for r in results if r["status"] == "success")
            errors = sum(1 for r in results if r["status"] == "error")
            skipped = sum(1 for r in results if r["status"] == "skipped")

            logger.info(
                "polling_summary",
                total=len(message_ids),
                processed=processed,
                errors=errors,
                skipped=skipped,
            )

            return {
                "total": len(message_ids),
                "processed": processed,
                "errors": errors,
                "skipped": skipped,
                "results": results,
            }

        except Exception as e:
            logger.error("polling_failed", error=str(e))
            return {"processed": 0, "errors": 1, "error": str(e)}

    async def send_drafted_email(self, email_id: str) -> Dict[str, Any]:
        """Send a drafted email that's stored in Supabase.

        Args:
            email_id: The email_logs UUID

        Returns:
            Send result dictionary
        """
        import uuid
        trace_id = str(uuid.uuid4())
        set_trace_id(trace_id)

        try:
            # 1. Fetch email log from Supabase
            email_log = await self.supabase.get_email_log_by_id(email_id)
            if not email_log:
                logger.error("email_log_not_found", email_id=email_id)
                return {"status": "error", "error": "Email log not found"}

            # 2. Check status
            if email_log.get("status") != "DRAFTED":
                logger.warning(
                    "email_not_drafted",
                    email_id=email_id,
                    status=email_log.get("status")
                )
                return {
                    "status": "error",
                    "error": f"Email status is {email_log.get('status')}, expected DRAFTED"
                }

            # 3. Extract draft body from payload
            draft_body = email_log.get("payload", {}).get("draft_body")
            if not draft_body:
                logger.error("draft_body_not_found", email_id=email_id)
                return {"status": "error", "error": "Draft body not found in email log"}

            # 4. Get original email thread
            gmail_message_id = email_log.get("gmail_message_id")
            gmail_thread_id = email_log.get("payload", {}).get("gmail_thread_id")
            to_email = email_log.get("from_email")
            subject = email_log.get("subject")

            # 5. Send email via Gmail
            sent_message_id = self.gmail.send_message(
                to=to_email,
                subject=f"Re: {subject}" if not subject.startswith("Re:") else subject,
                body=draft_body,
                thread_id=gmail_thread_id,
            )

            logger.info(
                "email_sent",
                email_id=email_id,
                to=to_email,
                sent_message_id=sent_message_id
            )

            # 6. Update email log status to SENT
            await self.supabase.update_email_log_status(email_id, "SENT", {
                "sent_message_id": sent_message_id,
                "sent_at": "now()"
            })

            # 7. Mark original Gmail message as processed
            self.gmail.label_message(gmail_message_id, ["agent_processed"])

            return {
                "status": "success",
                "email_id": email_id,
                "sent_message_id": sent_message_id,
                "to": to_email,
            }

        except Exception as e:
            logger.error("email_send_failed", email_id=email_id, error=str(e))
            return {"status": "error", "email_id": email_id, "error": str(e)}


# Global instance
_email_agent: Optional[EmailManagementAgent] = None


def get_email_agent() -> EmailManagementAgent:
    """Get or create global EmailManagementAgent instance."""
    global _email_agent
    if _email_agent is None:
        _email_agent = EmailManagementAgent()
    return _email_agent
