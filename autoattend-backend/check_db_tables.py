import asyncio
import asyncpg
from app.core.config import settings

async def main():
    # settings.DATABASE_URL usually looks like postgresql+asyncpg://...
    # asyncpg just needs postgresql://...
    dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(dsn)
    tables = await conn.fetch('''
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    ''')
    print("TABLES IN DATABASE:")
    for t in tables:
        print(f"- {t['table_name']}")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
