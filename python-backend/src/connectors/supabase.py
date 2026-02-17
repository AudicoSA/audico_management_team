"""Supabase connector for database operations and logging."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from src.utils.config import get_config
from src.utils.logging import AgentLogger, get_trace_id

logger = AgentLogger("SupabaseConnector")


class SupabaseConnector:
    """Connector for Supabase database operations."""

    def __init__(self):
        """Initialize Supabase client."""
        config = get_config()
        self.client: Client = create_client(
            config.supabase_url,
            config.supabase_service_role_key,
        )
        logger.info("supabase_connected", url=config.supabase_url)

    # Agent Logs
    async def log_agent_event(
        self,
        agent: str,
        level: str,
        event_type: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log an agent event to agent_logs table.

        Args:
            agent: Agent name (e.g., 'EmailManagementAgent')
            level: Log level ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')
            event_type: Type of event (e.g., 'email_classified', 'draft_created')
            context: Additional context as JSON
        """
        try:
            record = {
                "agent": agent,
                "level": level,
                "event_type": event_type,
                "context": context or {},
                "trace_id": get_trace_id(),
                "created_at": datetime.utcnow().isoformat(),
            }
            self.client.table("agent_logs").insert(record).execute()
            logger.debug("agent_event_logged", target_agent=agent, event_type=event_type)

        except Exception as e:
            logger.error("agent_log_failed", target_agent=agent, error=str(e))
            # Don't raise - logging failures shouldn't break the flow

    # Email Logs
    async def create_email_log(
        self,
        gmail_message_id: str,
        gmail_thread_id: str,
        from_email: str,
        to_email: str,
        subject: str,
        category: str,
        classification_confidence: float,
        payload: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Create email log entry and return ID.

        Returns:
            UUID of created email log
        """
        try:
            record = {
                "gmail_message_id": gmail_message_id,
                "gmail_thread_id": gmail_thread_id,
                "from_email": from_email,
                "to_email": to_email,
                "subject": subject,
                "category": category,
                "classification_confidence": classification_confidence,
                "status": "CLASSIFIED",
                "payload": payload or {},
                "trace_id": get_trace_id(),
            }

            response = self.client.table("email_logs").insert(record).execute()
            email_log_id = response.data[0]["id"]
            logger.info("email_log_created", email_log_id=email_log_id, category=category)
            return email_log_id

        except Exception as e:
            logger.error("email_log_create_failed", error=str(e))
            raise

    async def update_email_log(
        self,
        gmail_message_id: str,
        status: Optional[str] = None,
        draft_content: Optional[str] = None,
        sent_message_id: Optional[str] = None,
        handled_by_agent: Optional[str] = None,
    ) -> None:
        """Update email log status and content."""
        try:
            updates = {}
            if status:
                updates["status"] = status
            if draft_content:
                updates["draft_content"] = draft_content
            if sent_message_id:
                updates["sent_message_id"] = sent_message_id
            if handled_by_agent:
                updates["handled_by_agent"] = handled_by_agent

            if updates:
                (
                    self.client.table("email_logs")
                    .update(updates)
                    .eq("gmail_message_id", gmail_message_id)
                    .execute()
                )
                logger.debug("email_log_updated", gmail_message_id=gmail_message_id)

        except Exception as e:
            logger.error("email_log_update_failed", error=str(e))
            raise

    async def get_email_log_by_message_id(self, gmail_message_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve email log by Gmail message ID."""
        try:
            response = (
                self.client.table("email_logs")
                .select("*")
                .eq("gmail_message_id", gmail_message_id)
                .execute()
            )

            if response.data:
                return response.data[0]
            return None

        except Exception as e:
            logger.error("email_log_fetch_failed", error=str(e))
            return None

    async def check_email_already_processed(self, gmail_message_id: str) -> bool:
        """Check if email has already been processed."""
        log = await self.get_email_log_by_message_id(gmail_message_id)
        return log is not None

    # Orders Tracker
    async def upsert_order_tracker(
        self,
        order_no: str,
        order_name: Optional[str] = None,
        supplier: Optional[str] = None,
        notes: Optional[str] = None,
        cost: Optional[float] = None,
        invoice_no: Optional[str] = None,
        order_paid: Optional[bool] = None,
        supplier_amount: Optional[float] = None,
        shipping: Optional[float] = None,
        profit: Optional[float] = None,
        updates: Optional[str] = None,
        owner_wade: Optional[bool] = None,
        owner_lucky: Optional[bool] = None,
        owner_kenny: Optional[bool] = None,
        owner_accounts: Optional[bool] = None,
        flag_done: Optional[bool] = None,
        flag_urgent: Optional[bool] = None,

        supplier_invoice_no: Optional[str] = None,
        supplier_quote_no: Optional[str] = None,
        supplier_status: Optional[str] = None,
        source: str = "agent",
        last_modified_by: Optional[str] = "system",
        supplier_invoice_url: Optional[str] = None,
    ) -> None:
        """Insert or update order tracker record."""
        try:
            # 1. Fetch existing record to get current values for profit calculation
            existing = await self.get_order_tracker(order_no)
            current_data = existing if existing else {}

            record = {"order_no": order_no, "source": source}
            if last_modified_by is not None:
                record["last_modified_by"] = last_modified_by

            # Add non-None fields
            if order_name is not None:
                record["order_name"] = order_name
            if supplier is not None:
                record["supplier"] = supplier
            if notes is not None:
                record["notes"] = notes
            if cost is not None:
                record["cost"] = cost
            if invoice_no is not None:
                record["invoice_no"] = invoice_no
            if order_paid is not None:
                record["order_paid"] = order_paid
            if supplier_amount is not None:
                record["supplier_amount"] = supplier_amount
            if shipping is not None:
                record["shipping"] = shipping
            if supplier_invoice_no is not None:
                record["supplier_invoice_no"] = supplier_invoice_no
            if supplier_quote_no is not None:
                record["supplier_quote_no"] = supplier_quote_no
            if supplier_status is not None:
                record["supplier_status"] = supplier_status
            if flag_done is not None:
                record["flag_done"] = flag_done
            if flag_urgent is not None:
                record["flag_urgent"] = flag_urgent
            if supplier_invoice_url is not None:
                record["supplier_invoice_url"] = supplier_invoice_url

            # 3. Calculate Profit
            # Profit = Cost (Revenue) - Supplier Amount - Shipping
            # Use new value if provided, else existing value, else 0
            
            # Note: 'cost' in DB is actually Revenue/Order Total
            rev_val = cost if cost is not None else current_data.get("cost", 0)
            sup_val = supplier_amount if supplier_amount is not None else current_data.get("supplier_amount", 0)
            ship_val = shipping if shipping is not None else current_data.get("shipping", 0)
            
            # Ensure we handle None values from DB
            rev_val = float(rev_val) if rev_val else 0.0
            sup_val = float(sup_val) if sup_val else 0.0
            ship_val = float(ship_val) if ship_val else 0.0
            
            # Only calculate profit if we have at least Revenue
            if rev_val > 0:
                record["profit"] = rev_val - sup_val - ship_val

            if updates is not None:
                # Append updates if existing
                existing_updates = current_data.get("updates", "")
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
                new_update = f"[{timestamp}] {updates}"
                if existing_updates:
                    record["updates"] = f"{new_update}\n{existing_updates}"
                else:
                    record["updates"] = new_update

            # Owner flags
            if owner_wade is not None:
                record["owner_wade"] = owner_wade
            if owner_lucky is not None:
                record["owner_lucky"] = owner_lucky
            if owner_kenny is not None:
                record["owner_kenny"] = owner_kenny
            if owner_accounts is not None:
                record["owner_accounts"] = owner_accounts

            self.client.table("orders_tracker").upsert(record).execute()
            logger.info("order_tracker_upserted", order_no=order_no, source=source)

        except Exception as e:
            logger.error("order_tracker_upsert_failed", order_no=order_no, error=str(e))
            raise

    async def upload_file(self, bucket: str, path: str, data: bytes, content_type: str = "application/pdf") -> Optional[str]:
        """Upload file to Supabase Storage and return public URL.
        
        Args:
            bucket: Storage bucket name
            path: File path within bucket
            data: File content as bytes
            content_type: MIME type
            
        Returns:
            Public URL of the uploaded file or None if failed
        """
        try:
            # Upload file
            self.client.storage.from_(bucket).upload(
                path=path,
                file=data,
                file_options={"content-type": content_type, "upsert": "true"}
            )
            
            # Get public URL
            public_url = self.client.storage.from_(bucket).get_public_url(path)
            logger.info("file_uploaded", bucket=bucket, path=path, url=public_url)
            return public_url
            
        except Exception as e:
            logger.error("file_upload_failed", bucket=bucket, path=path, error=str(e))
            return None

    async def get_order_tracker(self, order_no: str) -> Optional[Dict[str, Any]]:
        """Retrieve order tracker record by order number."""
        try:
            response = (
                self.client.table("orders_tracker")
                .select("*")
                .eq("order_no", order_no)
                .is_("deleted_at", "null")
                .execute()
            )

            if response.data:
                return response.data[0]
            return None

        except Exception as e:
            logger.error("order_tracker_fetch_failed", order_no=order_no, error=str(e))
            return None

    # Order Shipments
    async def create_shipment(
        self,
        order_no: str,
        shiplogic_shipment_id: Optional[str] = None,
        tracking_url: Optional[str] = None,
        courier: Optional[str] = None,
        shipping_cost: Optional[float] = None,
        status: str = "pending",
        payload: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Create shipment record and return ID."""
        try:
            record = {
                "order_no": order_no,
                "shiplogic_shipment_id": shiplogic_shipment_id,
                "tracking_url": tracking_url,
                "courier": courier,
                "shipping_cost": shipping_cost,
                "status": status,
                "payload": payload or {},
            }

            response = self.client.table("order_shipments").insert(record).execute()
            shipment_id = response.data[0]["id"]
            logger.info("shipment_created", shipment_id=shipment_id, order_no=order_no)
            return shipment_id

        except Exception as e:
            logger.error("shipment_create_failed", order_no=order_no, error=str(e))
            raise

    async def update_shipment_status(
        self,
        shipment_id: str,
        status: str,
        webhook_payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Update shipment status and log to history."""
        try:
            # Update shipment
            updates = {
                "status": status,
                "last_status_update": datetime.utcnow().isoformat(),
            }
            if webhook_payload:
                updates["webhook_payload"] = webhook_payload

            self.client.table("order_shipments").update(updates).eq("id", shipment_id).execute()

            # Log to history
            history_record = {
                "shipment_id": shipment_id,
                "new_status": status,
                "source": "webhook",
                "payload": webhook_payload or {},
            }
            self.client.table("order_shipments_history").insert(history_record).execute()

            logger.info("shipment_status_updated", shipment_id=shipment_id, status=status)

        except Exception as e:
            logger.error("shipment_update_failed", shipment_id=shipment_id, error=str(e))
            raise

    # Configuration
    async def get_config(self, key: str) -> Optional[Any]:
        """Retrieve configuration value by key."""
        try:
            response = self.client.table("config").select("value").eq("key", key).execute()

            if response.data:
                return response.data[0]["value"]
            return None

        except Exception as e:
            logger.error("config_fetch_failed", key=key, error=str(e))
            return None

    async def set_config(self, key: str, value: Any, description: Optional[str] = None) -> None:
        """Set configuration value."""
        try:
            record = {"key": key, "value": value}
            if description:
                record["description"] = description

            self.client.table("config").upsert(record).execute()
            logger.debug("config_set", key=key)

        except Exception as e:
            logger.error("config_set_failed", key=key, error=str(e))
            raise

    # Suppliers
    def get_supplier_names(self) -> list[str]:
        """Get list of all supplier names."""
        try:
            response = self.client.table("suppliers").select("name").execute()
            supplier_names = [s["name"] for s in response.data if s.get("name")]
            logger.debug("suppliers_fetched", count=len(supplier_names))
            return supplier_names

        except Exception as e:
            logger.error("get_suppliers_failed", error=str(e))
            return []

    async def get_email_log_by_id(self, email_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve email log by UUID.

        Args:
            email_id: The UUID of the email_logs record

        Returns:
            Email log dictionary or None if not found
        """
        try:
            response = (
                self.client.table("email_logs")
                .select("*")
                .eq("id", email_id)
                .execute()
            )

            if response.data:
                return response.data[0]
            return None

        except Exception as e:
            logger.error("email_log_fetch_by_id_failed", email_id=email_id, error=str(e))
            return None

    async def update_email_log_status(
        self,
        email_id: str,
        status: str,
        additional_payload: Optional[Dict[str, Any]] = None
    ) -> None:
        """Update email log status and optionally merge additional payload data.

        Args:
            email_id: The UUID of the email_logs record
            status: New status value
            additional_payload: Additional data to merge into payload JSON
        """
        try:
            updates = {"status": status, "updated_at": datetime.utcnow().isoformat()}

            # If additional payload provided, we need to merge it with existing payload
            if additional_payload:
                # Fetch current record to get existing payload
                current = await self.get_email_log_by_id(email_id)
                if current:
                    existing_payload = current.get("payload", {})
                    existing_payload.update(additional_payload)
                    updates["payload"] = existing_payload

            (
                self.client.table("email_logs")
                .update(updates)
                .eq("id", email_id)
                .execute()
            )
            logger.debug("email_log_status_updated", email_id=email_id, status=status)

        except Exception as e:
            logger.error("email_log_status_update_failed", email_id=email_id, error=str(e))
            raise

    async def get_supplier_address(self, name: str) -> Optional[Dict[str, Any]]:
        """Retrieve supplier address details by supplier name (case-insensitive)."""
        try:
            # Try exact match first
            response = (
                self.client.table("supplier_addresses")
                .select("*")
                .ilike("name", name) # Case-insensitive match
                .limit(1)
                .execute()
            )

            if response.data:
                return response.data[0]
            return None

        except Exception as e:
            logger.error("get_supplier_address_failed", name=name, error=str(e))
            return None

# Global instance
_supabase_connector: Optional[SupabaseConnector] = None


def get_supabase_connector() -> SupabaseConnector:
    """Get or create global Supabase connector instance."""
    global _supabase_connector
    if _supabase_connector is None:
        _supabase_connector = SupabaseConnector()
    return _supabase_connector
