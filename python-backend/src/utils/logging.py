"""Structured logging with trace IDs for the Audico AI system."""
import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Any, Dict, Optional

import structlog

# Context variable for trace ID (survives async context switches)
trace_id_context: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)


def get_trace_id() -> str:
    """Get current trace ID or generate a new one."""
    trace_id = trace_id_context.get()
    if trace_id is None:
        trace_id = str(uuid.uuid4())
        trace_id_context.set(trace_id)
    return trace_id


def set_trace_id(trace_id: str) -> None:
    """Set the trace ID for the current context."""
    trace_id_context.set(trace_id)


def clear_trace_id() -> None:
    """Clear the trace ID from the current context."""
    trace_id_context.set(None)


def add_trace_id(
    logger: Any, method_name: str, event_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """Add trace ID to log event."""
    trace_id = trace_id_context.get()
    if trace_id:
        event_dict["trace_id"] = trace_id
    return event_dict


def setup_logging(log_level: str = "INFO") -> None:
    """Configure structured logging for the application."""

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            add_trace_id,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(name)


# Convenience functions for agent logging
class AgentLogger:
    """Logger wrapper with agent context."""

    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.logger = get_logger(agent_name)

    def debug(self, event: str, **kwargs: Any) -> None:
        """Log debug message."""
        self.logger.debug(event, agent=self.agent_name, **kwargs)

    def info(self, event: str, **kwargs: Any) -> None:
        """Log info message."""
        self.logger.info(event, agent=self.agent_name, **kwargs)

    def warning(self, event: str, **kwargs: Any) -> None:
        """Log warning message."""
        self.logger.warning(event, agent=self.agent_name, **kwargs)

    def error(self, event: str, **kwargs: Any) -> None:
        """Log error message."""
        self.logger.error(event, agent=self.agent_name, **kwargs)

    def critical(self, event: str, **kwargs: Any) -> None:
        """Log critical message."""
        self.logger.critical(event, agent=self.agent_name, **kwargs)


def mask_pii(data: Dict[str, Any], fields: list[str] = None) -> Dict[str, Any]:
    """Mask PII fields in a dictionary before logging.

    Args:
        data: Dictionary potentially containing PII
        fields: List of field names to mask (defaults to common PII fields)

    Returns:
        Dictionary with masked PII fields
    """
    if fields is None:
        fields = [
            "email",
            "phone",
            "phone_number",
            "address",
            "password",
            "api_key",
            "token",
            "refresh_token",
            "credit_card",
            "ssn",
            "id_number",
        ]

    masked_data = data.copy()
    for field in fields:
        if field in masked_data:
            value = masked_data[field]
            if isinstance(value, str) and len(value) > 4:
                # Show first 2 and last 2 characters
                masked_data[field] = f"{value[:2]}***{value[-2:]}"
            else:
                masked_data[field] = "***"

    return masked_data
