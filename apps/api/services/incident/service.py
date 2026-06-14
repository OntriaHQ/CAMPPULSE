import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from core.db.queries.incidents import (
    count_incidents_by_zone,
    count_nearby_incidents,
    get_incident_comments,
    get_incident_detail,
    get_incident_for_upvote,
    get_incident_status,
    get_user_exists_sql,
    increment_upvote_count,
    insert_comment,
    insert_incident,
    insert_upvote,
    select_incidents_by_zone,
    select_nearby_incidents,
    update_assignment_sql,
    update_status_sql,
)
from core.db.queries.zones import check_boundary as check_boundary_sql
from core.db.queries.zones import determine_zone as determine_zone_sql
from core.exceptions import AppError, ConflictError, NotFoundError
from services.incident.duplicate import (
    find_duplicate,
    increment_parent_upvote,
    link_reporter_to_parent,
)
from services.incident.publisher import publish_incident_created, publish_incident_status_changed
from services.incident.routing import (
    estimate_response_window,
    is_valid_transition,
    resolve_department,
)
from services.incident.schemas import (
    CommentCreate,
    IncidentCreate,
    IncidentCreateResponse,
    IncidentDetail,
    IncidentNearbyItem,
    PaginatedResponse,
    UpvoteResponse,
)
from services.incident.storage import upload_photo


async def check_boundary(lat: float, lon: float) -> bool:
    return await check_boundary_sql(lon, lat)


async def determine_zone(lat: float, lon: float) -> str | None:
    return await determine_zone_sql(lon, lat)


async def create_incident(
    data: IncidentCreate,
    photo_bytes: bytes | None,
    photo_filename: str | None,
    reporter_id: uuid.UUID | None,
    session: AsyncSession,
) -> IncidentCreateResponse:
    in_bounds = await check_boundary(data.lat, data.lon)
    if not in_bounds:
        raise AppError(
            code="LOCATION_OUTSIDE_BOUNDARY",
            message="Coordinates are outside the camp boundary.",
            status_code=422,
        )

    if reporter_id is not None:
        duplicate = await find_duplicate(
            data.type,
            data.lat,
            data.lon,
            session,
        )
        if duplicate is not None:
            parent_id = uuid.UUID(duplicate["id"])
            await increment_parent_upvote(parent_id, session)
            await link_reporter_to_parent(parent_id, reporter_id, session)
            await session.commit()
            return IncidentCreateResponse(
                incident_id=None,
                is_duplicate=True,
                parent_incident_id=duplicate["id"],
                parent_upvote_count=duplicate["upvote_count"] + 1,
                status=duplicate["status"],
                message="This issue has already been reported and is being addressed.",
            )

    zone = await determine_zone(data.lat, data.lon)
    department = resolve_department(data.type)

    photo_url = None
    if photo_bytes is not None and photo_filename is not None:
        photo_url = await upload_photo(photo_bytes, photo_filename)

    row = await insert_incident(
        reporter_id=reporter_id,
        type=data.type,
        description=data.description,
        photo_url=photo_url,
        lon=data.lon,
        lat=data.lat,
        zone=zone,
        severity=data.severity,
        department=department,
        session=session,
    )
    await session.commit()

    incident_id = str(row["id"])

    await publish_incident_created(
        incident_id=incident_id,
        incident_type=data.type,
        location={"lat": data.lat, "lon": data.lon},
        severity=data.severity,
        zone=zone,
    )

    window = estimate_response_window(data.severity, department)

    return IncidentCreateResponse(
        incident_id=incident_id,
        is_duplicate=False,
        status=row["status"],
        department=row["department"],
        photo_url=photo_url,
        estimated_response_window=window,
    )


async def get_incident(incident_id: uuid.UUID, session: AsyncSession) -> IncidentDetail:
    incident_row = await get_incident_detail(incident_id, session)
    if incident_row is None:
        raise NotFoundError("INCIDENT_NOT_FOUND", f"No incident found with ID {incident_id}.")

    comments_rows = await get_incident_comments(incident_id, session)
    comments = [
        {
            "id": str(r[0]),
            "body": r[1],
            "author_name": r[2],
            "created_at": r[3].isoformat() if r[3] else None,
        }
        for r in comments_rows
    ]

    return IncidentDetail(
        id=str(incident_row[0]),
        type=incident_row[1],
        description=incident_row[2],
        photo_url=incident_row[3],
        location={"lat": float(incident_row[4]), "lon": float(incident_row[5])},
        address_label=incident_row[6],
        zone=incident_row[7],
        severity=incident_row[8],
        status=incident_row[9],
        department=incident_row[10],
        upvote_count=incident_row[11],
        is_duplicate=incident_row[12],
        reporter_name=incident_row[16],
        assignee_name=incident_row[17],
        comments=comments,
        created_at=incident_row[13],
        updated_at=incident_row[14],
        resolved_at=incident_row[15],
    )


async def get_incidents_nearby(
    lat: float,
    lon: float,
    radius: int,
    page: int,
    page_size: int,
    session: AsyncSession,
) -> PaginatedResponse:
    offset = (page - 1) * page_size
    total = await count_nearby_incidents(lat, lon, radius, session)
    rows = await select_nearby_incidents(lat, lon, radius, page_size, offset, session)

    items = [
        IncidentNearbyItem(
            id=str(r[0]),
            type=r[1],
            severity=r[2],
            status=r[3],
            address_label=r[4],
            upvote_count=r[5],
            distance_metres=float(r[6]),
        ).model_dump()
        for r in rows
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


async def get_incidents_by_zone(
    zone: str,
    status: str | None,
    incident_type: str | None,
    page: int,
    page_size: int,
    session: AsyncSession,
) -> PaginatedResponse:
    offset = (page - 1) * page_size
    conditions = ["zone = :zone"]
    params = {"zone": zone, "limit": page_size, "offset": offset}

    if status:
        conditions.append("status = :status")
        params["status"] = status
    if incident_type:
        conditions.append("type = :type")
        params["type"] = incident_type

    where_clause = " AND ".join(conditions)

    total = await count_incidents_by_zone(where_clause, params, session)
    rows = await select_incidents_by_zone(where_clause, params, session)

    items = [
        {
            "id": str(r[0]),
            "type": r[1],
            "severity": r[2],
            "status": r[3],
            "address_label": r[4],
            "upvote_count": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
        }
        for r in rows
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


async def upvote_incident(
    incident_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession,
) -> UpvoteResponse:
    row = await get_incident_for_upvote(incident_id, session)
    if row is None:
        raise NotFoundError("INCIDENT_NOT_FOUND", f"No incident found with ID {incident_id}.")
    if row[2] == "closed":
        raise AppError("INCIDENT_CLOSED", "Cannot upvote a closed incident.", status_code=422)

    try:
        await insert_upvote(incident_id, user_id, session)
    except Exception:
        raise ConflictError("ALREADY_UPVOTED", "You have already upvoted this incident.")

    new_count = await increment_upvote_count(incident_id, session)
    await session.commit()

    return UpvoteResponse(incident_id=str(incident_id), upvote_count=new_count)


async def add_comment(
    incident_id: uuid.UUID,
    user_id: uuid.UUID,
    data: CommentCreate,
    session: AsyncSession,
) -> dict:
    row = await get_incident_status(incident_id, session)
    if row is None:
        raise NotFoundError("INCIDENT_NOT_FOUND", f"No incident found with ID {incident_id}.")

    res = await insert_comment(incident_id, user_id, data.body, session)
    await session.commit()

    return {
        "comment_id": str(res["id"]),
        "body": data.body,
        "created_at": res["created_at"].isoformat() if res["created_at"] else None,
    }


async def update_incident_status(
    incident_id: uuid.UUID,
    new_status: str,
    note: str | None,
    session: AsyncSession,
) -> dict:
    row = await get_incident_status(incident_id, session)
    if row is None:
        raise NotFoundError("INCIDENT_NOT_FOUND", f"No incident found with ID {incident_id}.")

    current_status = row[1]
    if not is_valid_transition(current_status, new_status):
        raise AppError(
            "INVALID_STATUS_TRANSITION",
            f"Cannot transition from '{current_status}' to '{new_status}'.",
            status_code=422,
        )

    await update_status_sql(incident_id, new_status, session)
    await session.commit()

    await publish_incident_status_changed(
        incident_id=str(incident_id),
        status=new_status,
        note=note,
    )

    return {
        "incident_id": str(incident_id),
        "status": new_status,
        "note": note,
    }


async def assign_incident(
    incident_id: uuid.UUID,
    assigned_to: uuid.UUID,
    department: str | None,
    session: AsyncSession,
) -> dict:
    incident = await get_incident_status(incident_id, session)
    if incident is None:
        raise NotFoundError("INCIDENT_NOT_FOUND", f"No incident found with ID {incident_id}.")

    assignee_exists = await get_user_exists_sql(assigned_to, session)
    if not assignee_exists:
        raise NotFoundError("USER_NOT_FOUND", f"No user found with ID {assigned_to}.")

    await update_assignment_sql(incident_id, assigned_to, department, session)
    await session.commit()

    return {
        "incident_id": str(incident_id),
        "assigned_to": str(assigned_to),
        "department": department,
    }
