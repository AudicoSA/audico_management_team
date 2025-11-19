"""LLM abstraction layer with retry/backoff and cost tracking."""
from enum import Enum
from typing import Any, Dict, List, Optional

from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from src.utils.config import get_config
from src.utils.logging import AgentLogger

logger = AgentLogger("LLMClient")


class ModelProvider(str, Enum):
    """Supported LLM providers."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class ModelName(str, Enum):
    """Supported model names."""

    # OpenAI models
    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"
    GPT_4_TURBO = "gpt-4-turbo-preview"

    # Anthropic models
    CLAUDE_3_5_SONNET = "claude-3-5-sonnet-20241022"  # Latest Claude 3.5 Sonnet
    CLAUDE_3_5_SONNET_V2 = "claude-3-5-sonnet-20250429"  # Even newer version
    CLAUDE_3_OPUS = "claude-3-opus-20240229"
    CLAUDE_3_HAIKU = "claude-3-haiku-20240307"


# Pricing per 1M tokens (input, output)
MODEL_PRICING = {
    ModelName.GPT_4O: (2.50, 10.00),
    ModelName.GPT_4O_MINI: (0.15, 0.60),
    ModelName.GPT_4_TURBO: (10.00, 30.00),
    ModelName.CLAUDE_3_5_SONNET: (3.00, 15.00),
    ModelName.CLAUDE_3_OPUS: (15.00, 75.00),
    ModelName.CLAUDE_3_HAIKU: (0.25, 1.25),
}


class LLMClient:
    """Unified client for OpenAI and Anthropic with retry logic and cost tracking."""

    def __init__(self, model_name: Optional[str] = None, temperature: float = 0.7):
        """Initialize LLM client.

        Args:
            model_name: Model to use (defaults to config settings)
            temperature: Sampling temperature (0.0-1.0)
        """
        self.config = get_config()
        self.model_name = model_name or ModelName.GPT_4O_MINI
        self.temperature = temperature
        self.total_input_tokens = 0
        self.total_output_tokens = 0

        # Initialize the appropriate model
        self.model = self._create_model()

    def _create_model(self) -> BaseChatModel:
        """Create LangChain model instance based on model name."""
        if "gpt" in self.model_name.lower():
            return ChatOpenAI(
                model=self.model_name,
                temperature=self.temperature,
                openai_api_key=self.config.openai_api_key,
                max_retries=3,
            )
        elif "claude" in self.model_name.lower():
            return ChatAnthropic(
                model=self.model_name,
                temperature=self.temperature,
                anthropic_api_key=self.config.anthropic_api_key,
                max_retries=3,
            )
        else:
            raise ValueError(f"Unsupported model: {self.model_name}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Generate response from LLM.

        Args:
            system_prompt: System instruction for the model
            user_prompt: User input/question
            max_tokens: Maximum tokens to generate (optional)

        Returns:
            Generated text response
        """
        messages: List[BaseMessage] = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]

        try:
            logger.debug(
                "llm_request",
                model=self.model_name,
                system_prompt_len=len(system_prompt),
                user_prompt_len=len(user_prompt),
            )

            # Invoke model
            kwargs = {"max_tokens": max_tokens} if max_tokens else {}
            response = await self.model.ainvoke(messages, **kwargs)

            # Track token usage
            if hasattr(response, "response_metadata"):
                usage = response.response_metadata.get("usage", {})
                input_tokens = usage.get("input_tokens", 0) or usage.get(
                    "prompt_tokens", 0
                )
                output_tokens = usage.get("output_tokens", 0) or usage.get(
                    "completion_tokens", 0
                )

                self.total_input_tokens += input_tokens
                self.total_output_tokens += output_tokens

                logger.info(
                    "llm_response",
                    model=self.model_name,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_cost_usd=self.get_total_cost(),
                )

            return response.content

        except Exception as e:
            logger.error("llm_error", model=self.model_name, error=str(e))
            raise

    def get_total_cost(self) -> float:
        """Calculate total cost in USD based on token usage."""
        if self.model_name not in MODEL_PRICING:
            return 0.0

        input_price, output_price = MODEL_PRICING.get(
            self.model_name, (0.0, 0.0)
        )
        input_cost = (self.total_input_tokens / 1_000_000) * input_price
        output_cost = (self.total_output_tokens / 1_000_000) * output_price
        return input_cost + output_cost

    def reset_tracking(self) -> Dict[str, Any]:
        """Reset token tracking and return stats."""
        stats = {
            "model": self.model_name,
            "input_tokens": self.total_input_tokens,
            "output_tokens": self.total_output_tokens,
            "total_cost_usd": self.get_total_cost(),
        }
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        return stats


# Convenience functions for common tasks
async def classify_email(email_body: str, subject: str) -> Dict[str, Any]:
    """Classify email into category with confidence score.

    Returns:
        {
            "category": str,
            "confidence": float,
            "reasoning": str
        }
    """
    client = LLMClient(model_name=get_config().classification_model, temperature=0.3)

    # Get list of known suppliers from database
    from src.connectors.supabase import get_supabase_connector
    supabase = get_supabase_connector()
    supplier_names = supabase.get_supplier_names()
    suppliers_list = ", ".join(supplier_names) if supplier_names else "N/A"

    system_prompt = f"""You are an email classifier for an e-commerce store (Audico Online).

KNOWN SUPPLIERS: {suppliers_list}

Classify emails into these categories:

CUSTOMER EMAILS (respond to these):
- ORDER_STATUS_QUERY: Customer asking "where is my order?"
- PRODUCT_QUESTION: Questions about products, specs, compatibility
- QUOTE_REQUEST: Customer requesting a quote
- INVOICE_REQUEST: Customer requesting invoice/receipt
- COMPLAINT: Customer complaint or negative feedback

INTERNAL/BUSINESS EMAILS (do NOT draft responses):
- INTERNAL_STAFF: Emails between Audico staff (lucky@audico.co.za, kenny@audico.co.za, wade@audico.co.za, etc.)
- SUPPLIER_COMMUNICATION: Emails from any of the suppliers listed above, OR emails discussing orders with distributors
- SUPPLIER_INVOICE: Invoice or order confirmation from supplier
- SUPPLIER_PRICELIST: Pricelist, specials, or catalog from supplier
- NEW_ORDER_NOTIFICATION: Notification from OpenCart about a new order

IMPORTANT: If the email is from or mentions any supplier in the list above, classify as SUPPLIER_COMMUNICATION

OTHER:
- SPAM: Obvious spam or marketing emails
- GENERAL_OTHER: Everything else

Return JSON with: category, confidence (0.0-1.0), reasoning (1 sentence).
"""

    user_prompt = f"""Subject: {subject}

Body:
{email_body[:1000]}  # Limit to first 1000 chars for classification

Classify this email."""

    try:
        response = await client.generate(system_prompt, user_prompt, max_tokens=200)

        # Parse JSON response
        import json
        import re

        # Try to extract JSON from response (LLM might add text before/after)
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            json_str = json_match.group()
            result = json.loads(json_str)
        else:
            # If no JSON found, try parsing the whole response
            result = json.loads(response)

        logger.info("email_classified", category=result.get("category"))
        return result

    except Exception as e:
        logger.error("email_classification_error", error=str(e), response_preview=response[:200] if 'response' in locals() else 'N/A')
        # Return fallback
        return {
            "category": "GENERAL_OTHER",
            "confidence": 0.5,
            "reasoning": "Classification failed, defaulting to GENERAL_OTHER",
        }


async def draft_email_response(
    email_body: str,
    subject: str,
    category: str,
    context: Optional[Dict[str, Any]] = None,
) -> str:
    """Draft email response based on category and context.

    Args:
        email_body: Original email body
        subject: Original email subject
        category: Classified category
        context: Additional context (order info, product info, etc.)

    Returns:
        Drafted email response
    """
    client = LLMClient(model_name=get_config().email_draft_model, temperature=0.7)

    system_prompt = f"""You are a helpful customer service representative for Audico Online, an audio-visual e-commerce store in South Africa.

Email category: {category}

COMPANY INFORMATION:
- Business hours: Monday-Friday, 8:00 AM - 5:00 PM (South African time)
- Contact: support@audicoonline.co.za or call during business hours
- We sell audio-visual equipment (headsets, speakers, conferencing equipment, etc.)

RESPONSE GUIDELINES:
- Be friendly, professional, and concise (2-3 short paragraphs max)
- Use South African English spelling (e.g., "favour" not "favor")
- For order queries: Reference order numbers if available in context
- For product questions: Be helpful but NEVER fabricate specifications - if unsure, offer to check
- For complaints: Be empathetic, apologize sincerely, and offer specific help
- If you don't have information, say so honestly and offer to investigate
- Always end with "Kind regards" or "Best regards"
- Sign off as "Audico Online Support Team"

TONE EXAMPLES:
Good: "Thank you for your enquiry! We'd be happy to help with that."
Bad: "Thank you so much for reaching out to us! We're absolutely thrilled to assist!"

Context available: {context or "No additional context available"}

Draft a response to the customer email below. Return ONLY the email body (no subject line).
"""

    user_prompt = f"""Subject: {subject}

From Customer:
{email_body}

Draft response:"""

    try:
        response = await client.generate(system_prompt, user_prompt, max_tokens=500)
        logger.info("email_drafted", category=category)
        return response

    except Exception as e:
        logger.error("email_drafting_error", error=str(e))
        raise
