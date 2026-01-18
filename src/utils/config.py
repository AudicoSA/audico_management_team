"""Configuration management for Audico AI system."""
import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


# Find .env file in parent directory (where it actually is)
def find_env_file() -> str:
    """Locate the .env file (in parent directory)."""
    current_dir = Path(__file__).parent.parent.parent  # Go up to audico-ai/
    parent_dir = current_dir.parent  # Go up to "Audico Management Team"

    env_paths = [
        parent_dir / ".env",  # D:\AudicoAI\Audico Management Team\.env
        current_dir / ".env",  # D:\AudicoAI\Audico Management Team\audico-ai\.env
        Path(".env"),  # Current working directory
    ]

    for env_path in env_paths:
        if env_path.exists():
            return str(env_path)

    # Return default, will try to load from environment variables
    return ".env"


class Config(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=find_env_file(),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # LLM APIs
    openai_api_key: str
    anthropic_api_key: str

    # Gmail Configuration
    gmail_client_id: str = "261944794374-odd129phrcv8l0k4nd5l9c3qokukesj9.apps.googleusercontent.com"
    gmail_client_secret: Optional[str] = None  # LOADED FROM ENV or File
    gmail_refresh_token: Optional[str] = None

    # Supabase Configuration
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: Optional[str] = None

    # OpenCart Configuration
    opencart_base_url: Optional[str] = None
    opencart_client_id: Optional[str] = None
    opencart_client_secret: Optional[str] = None
    opencart_admin_username: Optional[str] = None
    opencart_admin_password: Optional[str] = None

    # OpenCart Database (Direct Access)
    opencart_db_host: Optional[str] = None
    opencart_db_port: int = 3306
    opencart_db_user: Optional[str] = None
    opencart_db_password: Optional[str] = None
    opencart_db_name: Optional[str] = None
    opencart_table_prefix: str = "oc_"

    # Shiplogic API
    shiplogic_api_key: Optional[str] = None
    ship_logic_api_key: Optional[str] = None

    # Twilio (Optional - for future call center integration)
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_phone_number: Optional[str] = None

    # ElevenLabs (Optional - for future voice synthesis)
    elevenlabs_api_key: Optional[str] = None

    # Application Settings
    environment: str = "development"
    port: int = 8000
    log_level: str = "INFO"

    # Agent Configuration
    email_draft_mode: bool = True  # Stage 1: all emails are drafts
    gmail_polling_interval_seconds: int = 60
    email_classification_threshold: float = 0.85

    # Agent Enable/Disable (Stage 1: only EmailManagementAgent)
    agent_enabled: dict[str, bool] = {
        "EmailManagementAgent": True,
        "OrdersLogisticsAgent": False,
        "StockListingsAgent": False,
        "CustomerServiceAgent": False,
        "SocialMediaAgent": False,
    }

    # Model Routing
    classification_model: str = "gpt-4o-mini"
    email_draft_model: str = "gpt-4o-mini"  # Use GPT-4o-mini for drafts (fast and cheap)
    cs_reply_model: str = "gpt-4o-mini"  # Use GPT-4o-mini for replies

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() == "production"

    @property
    def gmail_client_secret_file(self) -> Path:
        """Path to Gmail OAuth client secret JSON file."""
        return Path("client_secret_2_261944794374-odd129phrcv8l0k4nd5l9c3qokukesj9.apps.googleusercontent.com.json")


# Global config instance
_config: Optional[Config] = None


def get_config() -> Config:
    """Get or create the global configuration instance."""
    global _config
    if _config is None:
        _config = Config()
    return _config


def reload_config() -> Config:
    """Reload configuration from environment."""
    global _config
    _config = Config()
    return _config
