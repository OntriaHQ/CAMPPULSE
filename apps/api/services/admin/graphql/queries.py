import strawberry
from typing import List, Optional
from strawberry.types import Info
from sqlalchemy import text

from core.db.queries.admin import (
    dashboard_summary_sql,
    equity_metrics_sql,
    hotspots_sql,
    list_users_sql,
)
from services.admin.graphql.types import (
    DashboardSummaryType,
    EquityMetricType,
    HotspotType,
    IncidentLocation,
    IncidentType,
    UserType,
)


@strawberry.type
class Query:
    @strawberry.field
    async def dashboard_summary(self, info: Info) -> DashboardSummaryType:
        session = info.context["session"]
        redis = info.context["redis"]

        counts = await dashboard_summary_sql(session)

        congestion_count = 0
        async for _ in redis.scan_iter(match="congestion:state:*"):
            congestion_count += 1

        return DashboardSummaryType(
            total_incidents=counts["total_incidents"],
            open_incidents=counts["open_incidents"],
            in_progress_incidents=counts["in_progress_incidents"],
            active_zones=counts["active_zones"],
            congestion_zones_count=congestion_count,
        )

    @strawberry.field
    async def incidents(
        self,
        info: Info,
        status: Optional[str] = None,
        zone: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[IncidentType]:
        session = info.context["session"]
        
        conditions = []
        params = {"limit": limit, "offset": offset}
        
        if status:
            conditions.append("i.status = :status")
            params["status"] = status
        if zone:
            conditions.append("i.zone = :zone")
            params["zone"] = zone
            
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
            
        result = await session.execute(
            text(f"""
                SELECT
                    i.id, i.type, i.severity, i.status, i.zone,
                    i.description, i.photo_url, i.address_label,
                    i.upvote_count, i.department, i.created_at,
                    i.updated_at, i.resolved_at,
                    ST_Y(i.location::geometry) AS lat,
                    ST_X(i.location::geometry) AS lon,
                    u.full_name AS reporter_name,
                    a.full_name AS assignee_name
                FROM incidents i
                LEFT JOIN users u ON u.id = i.reporter_id
                LEFT JOIN users a ON a.id = i.assigned_to
                {where_clause}
                ORDER BY i.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            params
        )
        
        rows = result.fetchall()
        return [
            IncidentType(
                id=str(r[0]),
                type=r[1],
                severity=r[2],
                status=r[3],
                zone=r[4],
                description=r[5],
                photo_url=r[6],
                address_label=r[7],
                upvote_count=r[8],
                department=r[9],
                created_at=r[10],
                updated_at=r[11],
                resolved_at=r[12],
                location=IncidentLocation(lat=float(r[13]), lon=float(r[14])),
                reporter_name=r[15],
                assignee_name=r[16]
            )
            for r in rows
        ]

    @strawberry.field
    async def incident_hotspots(self, info: Info) -> List[HotspotType]:
        session = info.context["session"]
        rows = await hotspots_sql(session)
        return [
            HotspotType(
                zone=r[0],
                incident_count=r[1],
                lat=float(r[2]),
                lon=float(r[3])
            )
            for r in rows
        ]

    @strawberry.field
    async def users(
        self,
        info: Info,
        role: Optional[str] = None,
        zone: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[UserType]:
        session = info.context["session"]
        rows = await list_users_sql(session, role, zone, limit, offset)
        return [
            UserType(
                id=str(r[0]),
                email=r[1],
                full_name=r[2],
                role=r[3],
                zone=r[4],
            )
            for r in rows
        ]

    @strawberry.field
    async def equity_metrics(self, info: Info) -> List[EquityMetricType]:
        session = info.context["session"]
        rows = await equity_metrics_sql(session)
        return [
            EquityMetricType(
                zone=r[0],
                total_incidents=r[1],
                avg_resolution_time_minutes=float(r[2]) if r[2] else 0.0
            )
            for r in rows
        ]
