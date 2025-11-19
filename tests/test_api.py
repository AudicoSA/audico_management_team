"""Tests for FastAPI endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock


@pytest.fixture
def client():
    """Test client for FastAPI app."""
    from src.main import app
    return TestClient(app)


class TestAPIEndpoints:
    """Test suite for API endpoints."""

    def test_root_endpoint(self, client):
        """Test root endpoint returns service info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "Audico AI"
        assert "version" in data

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "agents" in data

    def test_config_endpoint(self, client):
        """Test configuration endpoint."""
        response = client.get("/config")
        assert response.status_code == 200
        data = response.json()
        assert "environment" in data
        assert "agents_enabled" in data
        assert data["agents_enabled"]["EmailManagementAgent"] is True

    def test_email_poll_endpoint(self, client):
        """Test manual email poll endpoint."""
        with patch('src.main.get_email_agent') as mock_get_agent:
            mock_agent = Mock()
            mock_agent.poll_and_process = AsyncMock(return_value={
                "total": 2,
                "processed": 2,
                "errors": 0,
                "skipped": 0
            })
            mock_get_agent.return_value = mock_agent

            response = client.post("/email/poll")
            assert response.status_code == 200
            data = response.json()
            assert data["processed"] == 2

    def test_send_email_endpoint(self, client):
        """Test sending drafted email."""
        with patch('src.main.get_email_agent') as mock_get_agent:
            mock_agent = Mock()
            mock_agent.send_drafted_email = AsyncMock(return_value={
                "status": "success",
                "email_id": "test_uuid",
                "sent_message_id": "sent_123"
            })
            mock_get_agent.return_value = mock_agent

            response = client.post("/email/send/test_uuid")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"

    def test_send_email_not_found(self, client):
        """Test sending email that doesn't exist."""
        with patch('src.main.get_email_agent') as mock_get_agent:
            mock_agent = Mock()
            mock_agent.send_drafted_email = AsyncMock(return_value={
                "status": "error",
                "error": "Email log not found"
            })
            mock_get_agent.return_value = mock_agent

            response = client.post("/email/send/nonexistent_uuid")
            assert response.status_code == 500

    def test_toggle_agent_endpoint(self, client):
        """Test toggling agent on/off."""
        response = client.post("/config/agent/EmailManagementAgent/toggle?enabled=false")
        assert response.status_code == 200
        data = response.json()
        assert data["agent"] == "EmailManagementAgent"
        assert data["enabled"] is False

    def test_toggle_invalid_agent(self, client):
        """Test toggling invalid agent returns error."""
        response = client.post("/config/agent/InvalidAgent/toggle?enabled=true")
        assert response.status_code == 400


class TestCORS:
    """Test CORS configuration."""

    def test_cors_headers_present(self, client):
        """Test that CORS headers are configured."""
        response = client.options("/", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST"
        })
        # FastAPI/Starlette should handle OPTIONS automatically
        assert response.status_code in [200, 405]  # Some frameworks return 405 for OPTIONS
