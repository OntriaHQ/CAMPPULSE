"""Database seeding script — seeds zones, events, users, incidents, road segments, and sample data."""

import asyncio
import os
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://camppulse:camppulse@localhost:5432/camppulse")

# Password hash for "password123" (bcrypt cost 12)
SAMPLE_PASSWORD_HASH = "$2b$12$Em1EYFZ693l5xW.iP6WNSeLMLkxkc6d5YRoC/Ka/ZxG.DygJXEk1K"

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

CAMP_ZONES = [
    {"name": "Zone A", "zone_type": "residential", "wkt": "POLYGON((3.3900 6.9250, 3.3950 6.9250, 3.3950 6.9300, 3.3900 6.9300, 3.3900 6.9250))"},
    {"name": "Zone B", "zone_type": "residential", "wkt": "POLYGON((3.3950 6.9250, 3.4000 6.9250, 3.4000 6.9300, 3.3950 6.9300, 3.3950 6.9250))"},
    {"name": "Zone C", "zone_type": "commercial", "wkt": "POLYGON((3.3880 6.9220, 3.3930 6.9220, 3.3930 6.9270, 3.3880 6.9270, 3.3880 6.9220))"},
]

ROAD_SEGMENTS = [
    {"road_id": "main-avenue", "name": "Main Avenue", "zone": "Zone A", "speed_limit": 20, "wkt": "LINESTRING(3.3900 6.9270, 3.3920 6.9275, 3.3950 6.9280, 3.3980 6.9275, 3.4000 6.9270)"},
    {"road_id": "north-gate-road", "name": "North Gate Road", "zone": "Zone B", "speed_limit": 15, "wkt": "LINESTRING(3.3930 6.9280, 3.3930 6.9300, 3.3930 6.9320)"},
    {"road_id": "festival-access", "name": "Festival Access", "zone": "Zone B", "speed_limit": 10, "wkt": "LINESTRING(3.3950 6.9280, 3.3970 6.9270, 3.3980 6.9260)"},
    {"road_id": "south-link", "name": "South Link", "zone": "Zone A", "speed_limit": 15, "wkt": "LINESTRING(3.3900 6.9270, 3.3920 6.9250, 3.3950 6.9240, 3.3980 6.9250)"},
    {"road_id": "crescent-road", "name": "Crescent Road", "zone": "Zone A", "speed_limit": 10, "wkt": "LINESTRING(3.3920 6.9275, 3.3920 6.9260, 3.3940 6.9255, 3.3950 6.9260)"},
    {"road_id": "market-strip", "name": "Market Strip", "zone": "Zone C", "speed_limit": 5, "wkt": "LINESTRING(3.3890 6.9240, 3.3910 6.9245, 3.3930 6.9250)"},
]

SAMPLE_USERS = [
    {"id": str(uuid.uuid4()), "email": "admin@camppulse.ng", "full_name": "Camp Admin", "role": "admin", "password_hash": SAMPLE_PASSWORD_HASH},
    {"id": str(uuid.uuid4()), "email": "driver1@camppulse.ng", "full_name": "Driver Kofi", "role": "driver", "password_hash": SAMPLE_PASSWORD_HASH},
    {"id": str(uuid.uuid4()), "email": "driver2@camppulse.ng", "full_name": "Driver Ama", "role": "driver", "password_hash": SAMPLE_PASSWORD_HASH},
    {"id": str(uuid.uuid4()), "email": "resident1@camppulse.ng", "full_name": "Chidi Okonkwo", "role": "resident", "password_hash": SAMPLE_PASSWORD_HASH},
    {"id": str(uuid.uuid4()), "email": "resident2@camppulse.ng", "full_name": "Ngozi Eze", "role": "resident", "password_hash": SAMPLE_PASSWORD_HASH},
]

SAMPLE_INCIDENTS = [
    {"type": "flooding", "description": "Water accumulation near Main Avenue after heavy rain", "lat": 6.9275, "lon": 3.3930, "zone": "Zone A", "severity": "high", "status": "submitted", "department": "infrastructure"},
    {"type": "congestion", "description": "Heavy traffic buildup at North Gate entrance", "lat": 6.9300, "lon": 3.3930, "zone": "Zone B", "severity": "medium", "status": "assigned", "department": "infrastructure"},
    {"type": "security", "description": "Suspicious activity reported near Festival Arena", "lat": 6.9260, "lon": 3.3980, "zone": "Zone B", "severity": "critical", "status": "in_progress", "department": "security"},
    {"type": "streetlight", "description": "Streetlight out on Crescent Road", "lat": 6.9255, "lon": 3.3940, "zone": "Zone A", "severity": "low", "status": "resolved", "department": "utilities"},
    {"type": "trash", "description": "Overflowing bins near South Link", "lat": 6.9240, "lon": 3.3950, "zone": "Zone A", "severity": "low", "status": "submitted", "department": "sanitation"},
    {"type": "water_leak", "description": "Burst pipe on Market Strip affecting stalls", "lat": 6.9245, "lon": 3.3910, "zone": "Zone C", "severity": "medium", "status": "submitted", "department": "utilities"},
    {"type": "pothole", "description": "Large pothole blocking southbound lane on Main Avenue", "lat": 6.9270, "lon": 3.3950, "zone": "Zone A", "severity": "medium", "status": "assigned", "department": "infrastructure"},
]

DRIVER_PROFILES = [
    {"vehicle_type": "tricycle", "is_available": True},
    {"vehicle_type": "ambulance", "is_available": True},
]


async def seed() -> None:
    engine = create_async_engine(DATABASE_URL)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        await session.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))

        # 1. Seed camp_zones
        result = await session.execute(text("SELECT COUNT(*) FROM camp_zones"))
        if result.scalar() == 0:
            for zone in CAMP_ZONES:
                await session.execute(
                    text("""
                        INSERT INTO camp_zones (name, boundary, zone_type)
                        VALUES (:name, ST_GeomFromText(:wkt, 4326), :zone_type)
                        ON CONFLICT (name) DO NOTHING
                    """),
                    zone,
                )
            print(f"Seeded {len(CAMP_ZONES)} camp zones.")
        else:
            print("Camp zones already seeded. Skipping.")

        # 2. Seed road_segments
        result = await session.execute(text("SELECT COUNT(*) FROM road_segments"))
        if result.scalar() == 0:
            for seg in ROAD_SEGMENTS:
                await session.execute(
                    text("""
                        INSERT INTO road_segments (road_id, name, zone, speed_limit, geom)
                        VALUES (:road_id, :name, :zone, :speed_limit, ST_GeomFromText(:wkt, 4326))
                        ON CONFLICT (road_id) DO NOTHING
                    """),
                    seg,
                )
            print(f"Seeded {len(ROAD_SEGMENTS)} road segments.")
        else:
            print("Road segments already seeded. Skipping.")

        # 3. Seed users
        result = await session.execute(text("SELECT COUNT(*) FROM users"))
        if result.scalar() <= 1:
            for user in SAMPLE_USERS:
                await session.execute(
                    text("""
                        INSERT INTO users (id, email, full_name, role, password_hash, is_active)
                        VALUES (:id, :email, :full_name, :role, :password_hash, TRUE)
                        ON CONFLICT (email) DO NOTHING
                    """),
                    user,
                )
            print(f"Seeded {len(SAMPLE_USERS)} users.")
        else:
            print("Users already seeded. Skipping.")

        # 4. Fetch driver user IDs for profiles
        driver_users_result = await session.execute(
            text("SELECT id FROM users WHERE role = 'driver' ORDER BY email LIMIT 2")
        )
        driver_ids = [row[0] for row in driver_users_result.fetchall()]

        # 5. Seed driver_profiles
        result = await session.execute(text("SELECT COUNT(*) FROM driver_profiles"))
        if result.scalar() == 0 and len(driver_ids) >= 2:
            for i, dp in enumerate(DRIVER_PROFILES):
                await session.execute(
                    text("""
                        INSERT INTO driver_profiles (user_id, vehicle_type, is_available)
                        VALUES (:user_id, :vehicle_type, :is_available)
                    """),
                    {"user_id": str(driver_ids[i]), "vehicle_type": dp["vehicle_type"], "is_available": dp["is_available"]},
                )
            print(f"Seeded {len(DRIVER_PROFILES)} driver profiles.")
        else:
            print("Driver profiles already seeded or not enough drivers. Skipping.")

        # 6. Seed incidents
        result = await session.execute(text("SELECT COUNT(*) FROM incidents"))
        if result.scalar() == 0:
            for inc in SAMPLE_INCIDENTS:
                await session.execute(
                    text("""
                        INSERT INTO incidents (type, description, location, zone, severity, status, department)
                        VALUES (:type, :description, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :zone, :severity, :status, :department)
                    """),
                    inc,
                )
            print(f"Seeded {len(SAMPLE_INCIDENTS)} incidents.")
        else:
            print("Incidents already seeded. Skipping.")

        # 7. Seed events (existing logic)
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
            print(f"Seeded {len(EVENTS)} events.")

        await session.commit()

    await engine.dispose()
    print("Done.")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
