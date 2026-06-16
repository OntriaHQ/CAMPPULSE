"""Database seeding script — seeds zones, events, and sample data."""

import asyncio
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://camppulse:camppulse@localhost:5432/camppulse")

EVENTS = [
    {
        "title": "Holy Ghost Service",
        "description": "Monthly all-night service with Pastor E.A. Adeboye. Expect large congregation from all zones.",
        "date": "Fri, 27 Jun 2025",
        "time": "7:00 PM — All night",
        "area": "Main Auditorium",
        "category": "service",
        "status": "upcoming",
        "attendance": "500,000+",
    },
    {
        "title": "Workers In Training (WIT)",
        "description": "Monthly training and capacity building for RCCG workers and ministers across all provinces.",
        "date": "Sat, 21 Jun 2025",
        "time": "9:00 AM — 4:00 PM",
        "area": "Festival Arena",
        "category": "conference",
        "status": "upcoming",
        "attendance": "50,000+",
    },
    {
        "title": "Youth Sunday",
        "description": "Redemption City youth fellowship, praise and worship session. High foot traffic near Auditorium Annex.",
        "date": "Sun, 22 Jun 2025",
        "time": "8:00 AM — 12:00 PM",
        "area": "Auditorium Annex",
        "category": "youth",
        "status": "upcoming",
        "attendance": "20,000+",
    },
    {
        "title": "Special Thanksgiving Service",
        "description": "Praise and thanksgiving service for blessings received this season.",
        "date": "Sun, 15 Jun 2025",
        "time": "8:00 AM — 1:00 PM",
        "area": "Main Auditorium",
        "category": "special",
        "status": "past",
        "attendance": "200,000+",
    },
    {
        "title": "Pastors & Workers Convention",
        "description": "Annual ministers gathering and leadership summit. Multi-venue, expect high congestion on Camp Road and North Gate.",
        "date": "Mon 7 — Fri 11 Jul 2025",
        "time": "All day",
        "area": "Main Auditorium, Festival Arena",
        "category": "conference",
        "status": "upcoming",
        "attendance": "1,000,000+",
    },
    {
        "title": "RCCG Youth Congress",
        "description": "Annual congress for the youth arm of the RCCG. Multi-day event at Festival Arena with overflow into Camp Road.",
        "date": "Fri 1 — Sun 3 Aug 2025",
        "time": "Multi-day",
        "area": "Festival Arena",
        "category": "youth",
        "status": "upcoming",
        "attendance": "300,000+",
    },
    {
        "title": "Holy Ghost Congress",
        "description": "Annual five-day congress — one of the largest Christian gatherings in the world.",
        "date": "Tue 2 — Sat 6 Dec 2025",
        "time": "Multi-day",
        "area": "Main Auditorium, All Zones",
        "category": "service",
        "status": "upcoming",
        "attendance": "5,000,000+",
    },
]


async def seed() -> None:
    engine = create_async_engine(DATABASE_URL)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        # Check if events already exist
        result = await session.execute(text("SELECT COUNT(*) FROM camp_events"))
        count = result.scalar()

        if count > 0:
            print(f"Events already seeded ({count} found). Skipping.")
        else:
            for event in EVENTS:
                await session.execute(
                    text("""
                        INSERT INTO camp_events (title, description, date, time, area, category, status, attendance)
                        VALUES (:title, :description, :date, :time, :area, :category, :status, :attendance)
                    """),
                    event,
                )
            await session.commit()
            print(f"Seeded {len(EVENTS)} events.")

    await engine.dispose()
    print("Done.")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
