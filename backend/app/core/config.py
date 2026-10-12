from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    API_PREFIX: str = "/api"
    DEBUG: bool = False

    DATABASE_URL: str # required

    # If we didn’t give a default, and it was missing:
    # Pydantic would throw an error before the validator runs, hence we make it optional
    ALLOWED_ORIGINS: str = "" # optional

    OPENAI_API_KEY: str # required
    FINNHUB_API_KEY: str # required
    SECRET_KEY: str # required
    FMP_API_KEY: str # required
    
    # Password reset / email
    FRONTEND_URL: str = "http://localhost:5173"
    SMTP_HOST:     str = "smtp.gmail.com"
    SMTP_PORT:     int = 587
    SMTP_TLS:      bool = True
    SMTP_USER:     str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM:     str = ""

    # eg. 
    # ALLOWED_ORIGINS=http://localhost:3000,http://example.com
    # But we don’t want a string in the app — we want a list.
    # That’s where the validator comes in.
    # Why cls instead of self?
    # Because:
    # This function runs before an instance exists
    # There is no self yet
    # It belongs to the class, not the object
    # So:
    # cls = the class (Settings)
    # v = the raw value from the environment
    # You can think of it as:
    # “Hey Settings class, before creating an object, clean this value.”
    @field_validator("ALLOWED_ORIGINS")
    def parse_allowed_origins(cls, v: str) -> List[str]:
        return v.split(",") if v else []  

    # This tells Pydantic:
    # Read environment variables from .env
    # Use UTF-8 encoding
    # Don’t auto-lowercase variable names
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()
