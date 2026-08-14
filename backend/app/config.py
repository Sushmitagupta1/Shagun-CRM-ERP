from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://shagun:shagun123@localhost:5432/shagun_erp"
    JWT_SECRET_KEY: str = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = '["http://localhost:5173"]'
    ENVIRONMENT: str = "development"
    UPLOAD_DIR: str = "/app/uploads"
    TEMPLATES_DIR: str = "/app/templates"
    MAX_UPLOAD_SIZE: int = 20 * 1024 * 1024  # 20 MB
    MAX_CALL_RECORDING_SIZE: int = 100 * 1024 * 1024  # 100 MB
    ALLOWED_EXTENSIONS: list[str] = [
        ".pdf", ".docx", ".xlsx", ".pptx", ".ppt",
        ".jpg", ".jpeg", ".png", ".webp", ".txt", ".csv",
        ".mp3", ".wav", ".m4a", ".ogg", ".aac", ".amr",
    ]

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
