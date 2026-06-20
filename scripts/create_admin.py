import asyncio
import os
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://camppulse:devpassword@localhost:5432/camppulse")
SAMPLE_PASSWORD_HASH = "$2b$12$Em1EYFZ693l5xW.iP6WNSeLMLkxkc6d5YRoC/Ka/ZxG.DygJXEk1K" # password123

async def create_admin(email="admin@camppulse.ng", full_name="Camp Admin"):
    engine = create_async_engine(DATABASE_URL)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        print(f"Creating admin user: {email}...")
        await session.execute(
            text("""
                INSERT INTO users (id, email, full_name, role, password_hash, is_active)
                VALUES (:id, :email, :full_name, 'admin', :password_hash, TRUE)
                ON CONFLICT (email) DO UPDATE SET role = 'admin', is_active = TRUE
            """),
            {
                "id": str(uuid.uuid4()),
                "email": email,
                "full_name": full_name,
                "password_hash": SAMPLE_PASSWORD_HASH
            }
        )
        await session.commit()
    await engine.dispose()
    print("Admin user created/updated successfully.")

if __name__ == "__main__":
    asyncio.run(create_admin())
