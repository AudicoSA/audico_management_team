"""Gmail connector using OAuth2 for email operations."""
import base64
import io
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from src.utils.config import get_config
from src.utils.logging import AgentLogger

logger = AgentLogger("GmailConnector")


class ParsedEmail:
    """Parsed email message with key fields extracted."""

    def __init__(self, raw_message: Dict[str, Any]):
        """Parse Gmail API message object."""
        self.id = raw_message["id"]
        self.thread_id = raw_message.get("threadId", "")

        payload = raw_message.get("payload", {})
        headers = payload.get("headers", [])

        # Extract headers
        self.subject = self._get_header(headers, "Subject") or "(No Subject)"
        self.from_email = self._get_header(headers, "From") or ""
        self.to_email = self._get_header(headers, "To") or ""
        self.date = self._get_header(headers, "Date") or ""

        # Extract body
        self.body = self._extract_body(payload)

        # Check for attachments
        self.has_attachments = len(payload.get("parts", [])) > 1
        self.attachment_count = len([p for p in payload.get("parts", []) if p.get("filename")])

        # Labels
        self.labels = raw_message.get("labelIds", [])

    @staticmethod
    def _get_header(headers: List[Dict], name: str) -> Optional[str]:
        """Extract header value by name."""
        for header in headers:
            if header["name"].lower() == name.lower():
                return header["value"]
        return None

    @staticmethod
    def _extract_body(payload: Dict) -> str:
        """Extract email body (plain text preferred)."""
        if "body" in payload and payload["body"].get("data"):
            return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8")

        # Handle multi-part messages
        parts = payload.get("parts", [])
        for part in parts:
            if part["mimeType"] == "text/plain" and part["body"].get("data"):
                return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8")

        # Fallback to HTML if no plain text
        for part in parts:
            if part["mimeType"] == "text/html" and part["body"].get("data"):
                html = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8")
                # TODO: Strip HTML tags for plain text version
                return html

        return ""


class GmailConnector:
    """Gmail API connector with OAuth2 authentication."""

    def __init__(self):
        """Initialize Gmail API client with OAuth2 credentials."""
        self.config = get_config()
        self.service = self._build_service()
        logger.info("gmail_connected")

    def _build_service(self):
        """Build Gmail API service using refresh token."""
        # Create credentials from refresh token
        creds = Credentials(
            token=None,
            refresh_token=self.config.gmail_refresh_token,
            client_id=self.config.gmail_client_id,
            client_secret=self._get_client_secret(),
            token_uri="https://oauth2.googleapis.com/token",
        )

        # Refresh to get access token
        creds.refresh(Request())

        # Build Gmail API service
        return build("gmail", "v1", credentials=creds)

    def _get_client_secret(self) -> str:
        """Extract client secret from JSON file or environment variable."""
        import json

        # Option 1: Env Var (Preferred for deployment)
        if self.config.gmail_client_secret:
            return self.config.gmail_client_secret

        # Option 2: File (Local development)
        if not self.config.gmail_client_secret_file.exists():
            # If both are missing, raise error
            raise FileNotFoundError(
                f"Gmail client secret not found in env vars or file: {self.config.gmail_client_secret_file}"
            )

        with open(self.config.gmail_client_secret_file, "r") as f:
            data = json.load(f)
            # Handle both "web" and "installed" OAuth client types
            if "web" in data:
                return data["web"]["client_secret"]
            elif "installed" in data:
                return data["installed"]["client_secret"]
            else:
                raise ValueError("Invalid client secret JSON format")

    def list_unread_messages(
        self, label_ids: Optional[List[str]] = None, max_results: int = 100
    ) -> List[str]:
        """List unread message IDs.

        Args:
            label_ids: Filter by labels (default: ['INBOX', 'UNREAD'])
            max_results: Maximum number of messages to return

        Returns:
            List of Gmail message IDs
        """
        if label_ids is None:
            label_ids = ["INBOX", "UNREAD"]

        try:
            query = "is:unread"
            results = (
                self.service.users()
                .messages()
                .list(userId="me", q=query, labelIds=label_ids, maxResults=max_results)
                .execute()
            )

            messages = results.get("messages", [])
            message_ids = [msg["id"] for msg in messages]

            logger.info("listed_unread_messages", count=len(message_ids))
            return message_ids

        except HttpError as e:
            logger.error("list_messages_failed", error=str(e))
            raise

    def get_message(self, message_id: str) -> ParsedEmail:
        """Fetch and parse message by ID.

        Args:
            message_id: Gmail message ID

        Returns:
            ParsedEmail object
        """
        try:
            message = (
                self.service.users()
                .messages()
                .get(userId="me", id=message_id, format="full")
                .execute()
            )

            parsed = ParsedEmail(message)
            logger.debug("message_fetched", message_id=message_id, subject=parsed.subject)
            return parsed

        except HttpError as e:
            logger.error("get_message_failed", message_id=message_id, error=str(e))
            raise

    def get_attachments(self, message_id: str) -> List[Dict[str, Any]]:
        """Download and extract text from PDF attachments.
        
        Args:
            message_id: Gmail message ID
            
        Returns:
            List of attachment dictionaries with 'filename' and 'text' keys
        """
        attachments = []
        
        try:
            message = (
                self.service.users()
                .messages()
                .get(userId="me", id=message_id, format="full")
                .execute()
            )
            
            payload = message.get("payload", {})
            parts = payload.get("parts", [])
            
            for part in parts:
                if part.get("filename") and part.get("body", {}).get("attachmentId"):
                    filename = part["filename"]
                    attachment_id = part["body"]["attachmentId"]
                    
                    # Download attachment
                    attachment = (
                        self.service.users()
                        .messages()
                        .attachments()
                        .get(userId="me", messageId=message_id, id=attachment_id)
                        .execute()
                    )
                    
                    data = base64.urlsafe_b64decode(attachment["data"])
                    
                    # Extract text from PDF
                    if filename.lower().endswith(".pdf"):
                        text = self._extract_pdf_text(data)
                        if text:
                            attachments.append({
                                "filename": filename,
                                "text": text,
                                "data": data
                            })
                            logger.info("pdf_attachment_extracted", filename=filename, text_length=len(text))
            
            return attachments
        except Exception as e:
            logger.error("get_attachments_failed", message_id=message_id, error=str(e))
            return []
    
    @staticmethod
    def _extract_pdf_text(pdf_data: bytes) -> str:
        """Extract text from PDF bytes using PyPDF2.
        
        Args:
            pdf_data: PDF file as bytes
            
        Returns:
            Extracted text or empty string if extraction fails
        """
        try:
            from PyPDF2 import PdfReader
            
            pdf_file = io.BytesIO(pdf_data)
            reader = PdfReader(pdf_file)
            
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            
            return text
        except Exception as e:
            logger.error("pdf_extraction_failed", error=str(e))
            return ""

    def create_draft(
        self,
        to_email: str,
        subject: str,
        body: str,
        thread_id: Optional[str] = None,
    ) -> str:
        """Create a draft email.

        Args:
            to_email: Recipient email address
            subject: Email subject
            body: Email body (plain text)
            thread_id: Thread ID to reply to (optional)

        Returns:
            Draft ID
        """
        try:
            message = MIMEMultipart()
            message["To"] = to_email
            message["Subject"] = subject
            if thread_id:
                message["In-Reply-To"] = thread_id
                message["References"] = thread_id

            message.attach(MIMEText(body, "plain"))

            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
            draft_body = {"message": {"raw": raw_message}}

            if thread_id:
                draft_body["message"]["threadId"] = thread_id

            draft = (
                self.service.users()
                .drafts()
                .create(userId="me", body=draft_body)
                .execute()
            )

            draft_id = draft["id"]
            logger.info("draft_created", draft_id=draft_id, to_email=to_email)
            return draft_id

        except HttpError as e:
            logger.error("create_draft_failed", to_email=to_email, error=str(e))
            raise

    def send_draft(self, draft_id: str) -> str:
        """Send a draft email.

        Args:
            draft_id: Draft ID to send

        Returns:
            Sent message ID
        """
        try:
            sent_message = (
                self.service.users()
                .drafts()
                .send(userId="me", body={"id": draft_id})
                .execute()
            )

            message_id = sent_message["id"]
            logger.info("draft_sent", draft_id=draft_id, message_id=message_id)
            return message_id

        except HttpError as e:
            logger.error("send_draft_failed", draft_id=draft_id, error=str(e))
            raise

    def send_message(
        self,
        to_email: str,
        subject: str,
        body: str,
        thread_id: Optional[str] = None,
    ) -> str:
        """Send an email directly (not draft).

        Args:
            to_email: Recipient email address
            subject: Email subject
            body: Email body (plain text)
            thread_id: Thread ID to reply to (optional)

        Returns:
            Sent message ID
        """
        try:
            message = MIMEMultipart()
            message["To"] = to_email
            message["Subject"] = subject
            if thread_id:
                message["In-Reply-To"] = thread_id
                message["References"] = thread_id

            message.attach(MIMEText(body, "plain"))

            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
            send_body = {"raw": raw_message}

            if thread_id:
                send_body["threadId"] = thread_id

            sent_message = (
                self.service.users()
                .messages()
                .send(userId="me", body=send_body)
                .execute()
            )

            message_id = sent_message["id"]
            logger.info("message_sent", message_id=message_id, to_email=to_email)
            return message_id

        except HttpError as e:
            logger.error("send_message_failed", to_email=to_email, error=str(e))
            raise

    def apply_label(self, message_id: str, label_name: str) -> None:
        """Apply a label to a message.

        Args:
            message_id: Gmail message ID
            label_name: Label to apply (e.g., 'processed', 'agent_handled')
        """
        try:
            # Get or create label
            label_id = self._get_or_create_label(label_name)

            # Apply label and remove UNREAD
            self.service.users().messages().modify(
                userId="me",
                id=message_id,
                body={"addLabelIds": [label_id], "removeLabelIds": ["UNREAD"]},
            ).execute()

            logger.debug("label_applied", message_id=message_id, label=label_name)

        except HttpError as e:
            logger.error("apply_label_failed", message_id=message_id, error=str(e))
            raise

    def _get_or_create_label(self, label_name: str) -> str:
        """Get label ID by name, creating if it doesn't exist."""
        try:
            # List all labels
            results = self.service.users().labels().list(userId="me").execute()
            labels = results.get("labels", [])

            # Check if label exists
            for label in labels:
                if label["name"] == label_name:
                    return label["id"]

            # Create label if it doesn't exist
            label_body = {
                "name": label_name,
                "labelListVisibility": "labelShow",
                "messageListVisibility": "show",
            }
            created_label = (
                self.service.users()
                .labels()
                .create(userId="me", body=label_body)
                .execute()
            )

            logger.info("label_created", label_name=label_name, label_id=created_label["id"])
            return created_label["id"]

        except HttpError as e:
            logger.error("get_or_create_label_failed", label_name=label_name, error=str(e))
            raise


# Global instance
_gmail_connector: Optional[GmailConnector] = None


def get_gmail_connector() -> GmailConnector:
    """Get or create global Gmail connector instance."""
    global _gmail_connector
    if _gmail_connector is None:
        _gmail_connector = GmailConnector()
    return _gmail_connector
