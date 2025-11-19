"""Tests for EmailManagementAgent."""
import pytest
from unittest.mock import AsyncMock, Mock, patch
from src.agents.email_agent import EmailManagementAgent


class TestEmailManagementAgent:
    """Test suite for EmailManagementAgent."""

    @pytest.mark.asyncio
    async def test_process_email_success(self, sample_email, mock_gmail_connector, mock_supabase_connector):
        """Test successful email processing."""
        with patch('src.agents.email_agent.get_gmail_connector', return_value=mock_gmail_connector), \
             patch('src.agents.email_agent.get_supabase_connector', return_value=mock_supabase_connector), \
             patch('src.agents.email_agent.get_opencart_connector'), \
             patch('src.agents.email_agent.get_shiplogic_connector'), \
             patch('src.agents.email_agent.classify_email', new_callable=AsyncMock) as mock_classify, \
             patch('src.agents.email_agent.draft_email_response', new_callable=AsyncMock) as mock_draft:

            # Setup mocks
            mock_gmail_connector.get_message.return_value = sample_email
            mock_classify.return_value = {
                "category": "ORDER_STATUS_QUERY",
                "confidence": 0.95,
                "reasoning": "Customer asking about order status"
            }
            mock_draft.return_value = "Thank you for your inquiry. Your order #12345 is being processed."

            # Create agent and process email
            agent = EmailManagementAgent()
            result = await agent.process_email("test_message_123")

            # Assertions
            assert result["status"] == "success"
            assert result["category"] == "ORDER_STATUS_QUERY"
            assert result["confidence"] == 0.95
            mock_supabase_connector.create_email_log.assert_called_once()
            mock_gmail_connector.create_draft.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_email_already_processed(self, mock_gmail_connector, mock_supabase_connector):
        """Test that already processed emails are skipped."""
        mock_supabase_connector.check_email_already_processed.return_value = True

        with patch('src.agents.email_agent.get_gmail_connector', return_value=mock_gmail_connector), \
             patch('src.agents.email_agent.get_supabase_connector', return_value=mock_supabase_connector), \
             patch('src.agents.email_agent.get_opencart_connector'), \
             patch('src.agents.email_agent.get_shiplogic_connector'):

            agent = EmailManagementAgent()
            result = await agent.process_email("test_message_123")

            assert result["status"] == "skipped"
            assert result["reason"] == "already_processed"

    @pytest.mark.asyncio
    async def test_extract_order_numbers(self, mock_gmail_connector, mock_supabase_connector):
        """Test order number extraction from email."""
        with patch('src.agents.email_agent.get_gmail_connector', return_value=mock_gmail_connector), \
             patch('src.agents.email_agent.get_supabase_connector', return_value=mock_supabase_connector), \
             patch('src.agents.email_agent.get_opencart_connector'), \
             patch('src.agents.email_agent.get_shiplogic_connector'):

            agent = EmailManagementAgent()

            # Test various order number formats
            orders = agent._extract_order_numbers(
                "Order #12345",
                "My order number is 67890 and also #54321"
            )

            assert "12345" in orders
            assert "67890" in orders or "54321" in orders

    @pytest.mark.asyncio
    async def test_supplier_email_no_draft(self, sample_email, mock_gmail_connector, mock_supabase_connector):
        """Test that supplier emails don't get drafted responses."""
        sample_email.from_email = "supplier@example.com"
        sample_email.subject = "Invoice for Order 12345"

        with patch('src.agents.email_agent.get_gmail_connector', return_value=mock_gmail_connector), \
             patch('src.agents.email_agent.get_supabase_connector', return_value=mock_supabase_connector), \
             patch('src.agents.email_agent.get_opencart_connector'), \
             patch('src.agents.email_agent.get_shiplogic_connector'), \
             patch('src.agents.email_agent.classify_email', new_callable=AsyncMock) as mock_classify:

            mock_gmail_connector.get_message.return_value = sample_email
            mock_classify.return_value = {
                "category": "SUPPLIER_INVOICE",
                "confidence": 0.98,
                "reasoning": "Invoice from supplier"
            }

            agent = EmailManagementAgent()
            result = await agent.process_email("test_message_123")

            # Should log but not create draft
            assert result["status"] == "success"
            mock_supabase_connector.create_email_log.assert_called_once()
            mock_gmail_connector.create_draft.assert_not_called()
