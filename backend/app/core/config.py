from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Telegram
    BOT_TOKEN: str = ""
    BOT_WEBHOOK_SECRET: str = ""

    # JWT
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # Admin
    FIRST_ADMIN_EMAIL: str = "admin@easybuy.com"
    FIRST_ADMIN_PASSWORD: str = "changeme123"

    # Database
    DATABASE_URL: str = "sqlite:///./easybuy.db"

    # Storage
    UPLOAD_DIR: str = "uploads"
    BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "https://easybuydaler.netlify.app"

    # App
    APP_NAME: str = "EasyBuy"
    SECRET_KEY: str = "change-me-secret"
    ENVIRONMENT: str = "development"

    # Order settings
    PAYMENT_DEADLINE_HOURS: int = 24
    SERVICE_FEE_PERCENT: float = 10.0
    DISPLAY_CURRENCY: str = "USD"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
