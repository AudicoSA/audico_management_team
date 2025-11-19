"""Pytest configuration and fixtures."""
import pytest
from unittest.mock import Mock, AsyncMock
from src.connectors.gmail import GmailConnector, ParsedEmail
from src.connectors.supabase import SupabaseConnector


@pytest.fixture
def sample_email():
    """Sample parsed email for testing."""
    return ParsedEmail(
        message_id="test_message_123",
        thread_id="test_thread_123",
        from_email="customer@example.com",
        to_email="support@audicoonline.co.za",
        subject="Where is my order #12345?",
        body="Hi, I ordered a product last week (order #12345) and haven't received any updates. Can you help?",
        date="2024-01-15T10:30:00Z",
        has_attachments=False,
        attachment_count=0,
        labels=["INBOX", "UNREAD"],
    )


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
