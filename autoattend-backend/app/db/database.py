from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False, # Set to True for debugging SQL queries
    future=True,
    connect_args={"timeout": 2.0} # Fail fast if DB is not running
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Dependency to get DB session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
