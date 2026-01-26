import smtplib
import imaplib
import email
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
from typing import List, Dict, Optional, Any
from src.utils.config import get_config

logger = logging.getLogger("EmailClient")

class EmailClient:
    """
    Standard IMAP/SMTP Client for Kait.
    """
    def __init__(self):
        from src.connectors.supabase import get_supabase_connector
        self.config = get_config()
        self.sb = get_supabase_connector()
        # Updated to GMAIL settings due to Split DNS resolution
        self.email = "kait@audicoonline.co.za"
        self.password = self.config.kait_email_password # Needs to be Google App Password
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 465
        self.imap_server = "imap.gmail.com"
        self.imap_port = 993

        if not self.password:
            logger.warning("kait_email_password_missing")

    def save_draft(self, order_no: str, to_email: str, subject: str, body_text: str, cc: Optional[List[str]] = None, metadata: Optional[Dict] = None) -> str:
        """Save email to Supabase drafts table instead of sending."""
        payload = {
            "order_no": order_no,
            "to_email": to_email,
            "cc_emails": cc if cc else [],
            "subject": subject,
            "body_text": body_text,
            "status": "draft",
            "metadata": metadata or {}
        }
        res = self.sb.client.table("kait_email_drafts").insert(payload).execute()
        draft_id = res.data[0]["id"]
        logger.info(f"Saved email draft for {order_no}: {draft_id}")
        return draft_id

    def send_email(self, to_email: str, subject: str, body_text: str, body_html: Optional[str] = None, cc: Optional[List[str]] = None) -> Optional[str]:
        """Send an email via SMTP (SSL). Returns Message-ID if successful, None otherwise."""
        from email.utils import make_msgid
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.email
            msg["To"] = to_email
            
            # Generate Message-ID
            msg_id = make_msgid(domain="audicoonline.co.za")
            msg["Message-ID"] = msg_id
            
            recipients = [to_email]
            if cc:
                msg["Cc"] = ", ".join(cc)
                recipients.extend(cc)

            part1 = MIMEText(body_text, "plain")
            msg.attach(part1)

            if body_html:
                part2 = MIMEText(body_html, "html")
                msg.attach(part2)

            with smtplib.SMTP_SSL(self.smtp_server, self.smtp_port) as server:
                server.login(self.email, self.password)
                server.sendmail(self.email, recipients, msg.as_string())
            
            logger.info(f"Email sent to {to_email} (CC: {cc}) ID: {msg_id}")
            return msg_id
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return None

    def fetch_unread_messages(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch unread emails from Inbox."""
        messages = []
        try:
            mail = imaplib.IMAP4_SSL(self.imap_server, self.imap_port)
            mail.login(self.email, self.password)
            mail.select("inbox")

            status, messages_data = mail.search(None, '(UNSEEN)')
            if status != "OK":
                return []

            email_ids = messages_data[0].split()
            # Process latest first
            for e_id in email_ids[-limit:]:
                status, msg_data = mail.fetch(e_id, "(RFC822)")
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        subject, encoding = decode_header(msg["Subject"])[0]
                        if isinstance(subject, bytes):
                            subject = subject.decode(encoding if encoding else "utf-8")
                        
                        from_ = msg.get("From")
                        in_reply_to = msg.get("In-Reply-To")
                        references = msg.get("References")
                        
                        body = ""
                        attachments = []
                        
                        if msg.is_multipart():
                            for part in msg.walk():
                                content_type = part.get_content_type()
                                content_disposition = str(part.get("Content-Disposition"))

                                if content_type == "text/plain" and "attachment" not in content_disposition:
                                    body = part.get_payload(decode=True).decode()
                                
                                # Setup Attachment Handling
                                if "attachment" in content_disposition:
                                    filename = part.get_filename()
                                    if filename:
                                        # Decode filename if needed
                                        filename_parts = decode_header(filename)[0]
                                        if isinstance(filename_parts[0], bytes):
                                            filename = filename_parts[0].decode(filename_parts[1] or "utf-8")
                                        else:
                                            filename = filename_parts[0]

                                        # Save PDF only
                                        if filename.lower().endswith(".pdf"):
                                            import os
                                            temp_dir = os.path.join(os.getcwd(), "temp", "attachments")
                                            os.makedirs(temp_dir, exist_ok=True)
                                            filepath = os.path.join(temp_dir, f"{e_id.decode()}_{filename}")
                                            
                                            with open(filepath, "wb") as f:
                                                f.write(part.get_payload(decode=True))
                                            
                                            attachments.append({
                                                "filename": filename,
                                                "path": filepath
                                            })
                        else:
                            body = msg.get_payload(decode=True).decode()

                        messages.append({
                            "id": e_id.decode(), # IMAP UID
                            "subject": subject,
                            "from": from_,
                            "body": body,
                            "in_reply_to": in_reply_to,
                            "references": references,
                            "attachments": attachments
                        })
            
            mail.close()
            mail.logout()
        except Exception as e:
            logger.error(f"Failed to fetch emails: {e}")
        
        return messages

_email_client = None

def get_email_client() -> EmailClient:
    global _email_client
    if not _email_client:
        _email_client = EmailClient()
    return _email_client
