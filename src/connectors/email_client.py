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
        self.config = get_config()
        self.email = "kait@audicoonline.co.za"
        self.password = self.config.kait_email_password
        self.smtp_server = "smtp.audicoonline.co.za"
        self.smtp_port = 465
        self.imap_server = "mail.audicoonline.co.za"
        self.imap_port = 993

        if not self.password:
            logger.warning("kait_email_password_missing")

    def send_email(self, to_email: str, subject: str, body_text: str, body_html: Optional[str] = None, cc: Optional[List[str]] = None) -> Optional[str]:
        """Send an email via SMTP (SSL). Returns Message-ID if successful, None otherwise."""
        from email.utils import making_msgid
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
                        if msg.is_multipart():
                            for part in msg.walk():
                                if part.get_content_type() == "text/plain":
                                    body = part.get_payload(decode=True).decode()
                                    break
                        else:
                            body = msg.get_payload(decode=True).decode()

                        messages.append({
                            "id": e_id.decode(), # IMAP UID
                            "subject": subject,
                            "from": from_,
                            "body": body,
                            "in_reply_to": in_reply_to,
                            "references": references
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
