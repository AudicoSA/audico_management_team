"""Tests for connector modules."""
import pytest
from unittest.mock import Mock, patch, AsyncMock


class TestGmailConnector:
    """Test suite for Gmail connector."""

    def test_list_unread_messages(self):
        """Test listing unread messages."""
        from src.connectors.gmail import GmailConnector

        with patch('src.connectors.gmail.GmailConnector._build_service') as mock_build_service:
            mock_service = Mock()
            mock_build_service.return_value = mock_service

            # Mock Gmail API response
            mock_service.users().messages().list().execute.return_value = {
                "messages": [
                    {"id": "msg1", "threadId": "thread1"},
                    {"id": "msg2", "threadId": "thread2"},
                ]
            }

            # Mock config to avoid file access
            with patch('src.connectors.gmail.get_config') as mock_config:
                mock_config.return_value.gmail_client_secret_file.exists.return_value = True
                
                connector = GmailConnector()
                messages = connector.list_unread_messages(max_results=10)

            assert len(messages) == 2
            assert "msg1" in messages
            assert "msg2" in messages

    def test_create_draft(self):
        """Test creating email draft."""
        from src.connectors.gmail import GmailConnector

        with patch('src.connectors.gmail.GmailConnector._build_service') as mock_build_service:
            mock_service = Mock()
            mock_build_service.return_value = mock_service

            mock_service.users().drafts().create().execute.return_value = {
                "id": "draft_123"
            }

            # Mock config to avoid file access
            with patch('src.connectors.gmail.get_config') as mock_config:
                mock_config.return_value.gmail_client_secret_file.exists.return_value = True
                
                connector = GmailConnector()
                draft_id = connector.create_draft(
                    to_email="customer@example.com",
                    subject="Re: Order inquiry",
                    body="Thank you for your inquiry.",
                    thread_id="thread_123"
                )

            assert draft_id == "draft_123"


class TestSupabaseConnector:
    """Test suite for Supabase connector."""

    @pytest.mark.asyncio
    async def test_create_email_log(self):
        """Test creating email log entry."""
        from src.connectors.supabase import SupabaseConnector

        with patch('src.connectors.supabase.create_client') as mock_create:
            mock_client = Mock()
            mock_create.return_value = mock_client

            # Mock Supabase response
            mock_response = Mock()
            mock_response.data = [{"id": "log_uuid_123"}]
            mock_client.table().insert().execute.return_value = mock_response

            connector = SupabaseConnector()
            log_id = await connector.create_email_log(
                gmail_message_id="msg_123",
                gmail_thread_id="thread_123",
                from_email="customer@example.com",
                to_email="support@audicoonline.co.za",
                subject="Test email",
                category="ORDER_STATUS_QUERY",
                classification_confidence=0.95
            )

            assert log_id == "log_uuid_123"

    @pytest.mark.asyncio
    async def test_check_email_already_processed(self):
        """Test checking if email was already processed."""
        from src.connectors.supabase import SupabaseConnector

        with patch('src.connectors.supabase.create_client') as mock_create:
            mock_client = Mock()
            mock_create.return_value = mock_client

            # Mock Supabase response - email exists
            mock_response = Mock()
            mock_response.data = [{"id": "log_uuid_123"}]
            mock_client.table().select().eq().execute.return_value = mock_response

            connector = SupabaseConnector()
            is_processed = await connector.check_email_already_processed("msg_123")

            assert is_processed is True


class TestLLMClient:
    """Test suite for LLM client."""

    @pytest.mark.asyncio
    async def test_classify_email(self):
        """Test email classification."""
        from src.models.llm_client import classify_email

        # Patch LLMClient.generate instead of get_openai_client
        with patch('src.models.llm_client.LLMClient.generate') as mock_generate:
            mock_generate.return_value = '''
            {
                "category": "ORDER_STATUS_QUERY",
                "confidence": 0.95,
                "reasoning": "Customer is asking about order status"
            }
            '''

            # No need to mock OpenAI client internals anymore
            # mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

            result = await classify_email(
                email_body="Where is my order?",
                subject="Order inquiry"
            )

            assert result["category"] == "ORDER_STATUS_QUERY"
            assert result["confidence"] == 0.95

    @pytest.mark.asyncio
    async def test_draft_email_response(self):
        """Test drafting email response."""
        from src.models.llm_client import draft_email_response

        # Patch LLMClient.generate instead of get_openai_client
        with patch('src.models.llm_client.LLMClient.generate') as mock_generate:
            mock_generate.return_value = "Thank you for your inquiry. We are checking on your order."

            # No need to mock OpenAI client internals anymore
            # mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

            result = await draft_email_response(
                email_body="Where is my order #12345?",
                subject="Order inquiry",
                category="ORDER_STATUS_QUERY",
                context={}
            )

            assert "Thank you" in result
            assert len(result) > 10
