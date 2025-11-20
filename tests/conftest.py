"""Pytest configuration and fixtures."""
import pytest
from unittest.mock import Mock, AsyncMock
from src.connectors.gmail import GmailConnector, ParsedEmail
from src.connectors.supabase import SupabaseConnector


@pytest.fixture
def sample_email():
    """Sample parsed email for testing."""
    import base64
    body_text = "Hi, I ordered a product last week (order #12345) and haven't received any updates. Can you help?"
    b64_body = base64.urlsafe_b64encode(body_text.encode("utf-8")).decode("utf-8")

    return ParsedEmail({
        "id": "test_message_123",
        "threadId": "test_thread_123",
        "labelIds": ["INBOX", "UNREAD"],
        "payload": {
            "headers": [
                {"name": "From", "value": "customer@example.com"},
                {"name": "To", "value": "support@audicoonline.co.za"},
                {"name": "Subject", "value": "Where is my order #12345?"},
                {"name": "Date", "value": "2024-01-15T10:30:00Z"},
            ],
            "body": {
                "data": b64_body
            },
            "parts": [
                {
                    "mimeType": "text/plain",
                    "body": {
                        "data": b64_body
                    }
                }
            ]
        }
    })


@pytest.fixture
def mock_gmail_connector():
    """Mock Gmail connector for testing."""
    mock = Mock(spec=GmailConnector)
    mock.list_unread_messages = Mock(return_value=["msg1", "msg2"])
    mock.get_message = Mock()
    mock.create_draft = Mock(return_value="draft_123")
    mock.send_message = Mock(return_value="sent_123")
    mock.label_message = Mock()
    return mock


@pytest.fixture
def mock_supabase_connector():
    """Mock Supabase connector for testing."""
    mock = Mock(spec=SupabaseConnector)
    mock.create_email_log = AsyncMock(return_value="log_uuid_123")
    mock.update_email_log = AsyncMock()
    mock.check_email_already_processed = AsyncMock(return_value=False)
    mock.log_agent_event = AsyncMock()
    mock.get_email_log_by_id = AsyncMock()
    mock.update_email_log_status = AsyncMock()
    return mock
