from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "AutoAttender API"
    API_V1_STR: str = "/api/v1"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:8080"]
    
    # Security
    SECRET_KEY: str = "supersecretkey-please-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "autoattender"
    POSTGRES_PORT: str = "5433"
    
    @property
    def DATABASE_URL(self) -> str:
        # Asyncpg uses postgresql+asyncpg://
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

settings = Settings()
