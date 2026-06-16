import uuid
from typing import List, Optional

import strawberry
from strawberry.types import Info

from core.db.queries.admin import bulk_update_status_sql, get_incidents_statuses_sql
from core.events import Event
from core.exceptions import AppError
from services.admin.graphql.types import MutationResponse
from services.incident.routing import is_valid_transition
from services.incident.service import assign_incident as assign
from services.incident.service import update_incident_status as update_status


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def update_incident_status(
        self,
        info: Info,
        id: str,
        status: str,
        note: Optional[str] = None,
    ) -> MutationResponse:
        session = info.context["session"]
        try:
            await update_status(
                incident_id=uuid.UUID(id),
                new_status=status,
                note=note,
                session=session,
            )
            return MutationResponse(
                success=True,
                message=f"Incident {id} status updated to {status}",
                id=id,
            )
        except AppError as e:
            return MutationResponse(success=False, message=e.message)
        except Exception as e:
            return MutationResponse(success=False, message=str(e))

    @strawberry.mutation
    async def assign_incident(
        self,
        info: Info,
        id: str,
        user_id: str,
        department: Optional[str] = None,
    ) -> MutationResponse:
        session = info.context["session"]
        try:
            await assign(
                incident_id=uuid.UUID(id),
                assigned_to=uuid.UUID(user_id),
                department=department,
                session=session,
            )
            return MutationResponse(
                success=True,
                message=f"Incident {id} assigned to {user_id}",
                id=id,
            )
        except AppError as e:
            return MutationResponse(success=False, message=e.message)
        except Exception as e:
            return MutationResponse(success=False, message=str(e))

    @strawberry.mutation
    async def bulk_update_incident_status(
        self,
        info: Info,
        ids: List[str],
        status: str,
    ) -> MutationResponse:
        session = info.context["session"]
        try:
            uuid_ids = [uuid.UUID(id) for id in ids]

            current_rows = await get_incidents_statuses_sql(uuid_ids, session)
            current_statuses = {str(r[0]): r[1] for r in current_rows}

            valid_ids = []
            skipped: list[str] = []
            for id_str in ids:
                cur = current_statuses.get(id_str)
                if cur is None:
                    skipped.append(f"{id_str} (not found)")
                elif not is_valid_transition(cur, status):
                    skipped.append(f"{id_str} ({cur} → {status})")
                else:
                    valid_ids.append(uuid.UUID(id_str))

            if valid_ids:
                await bulk_update_status_sql(valid_ids, status, session)
                await session.commit()

            message = f"Bulk updated {len(valid_ids)} incidents to {status}"
            if skipped:
                message += f". Skipped: {', '.join(skipped)}"

            return MutationResponse(success=True, message=message)
        except Exception as e:
            return MutationResponse(success=False, message=str(e))

    @strawberry.mutation
    async def send_zone_broadcast(
        self,
        info: Info,
        zone: str,
        title: str,
        body: str
    ) -> MutationResponse:
        redis = info.context["redis"]
        try:
            event = Event(
                event_type="notification.broadcast",
                payload={"zone": zone, "title": title, "body": body},
                source_service="admin"
            )
            await redis.publish("notification.broadcast", event.to_json())
            return MutationResponse(success=True, message=f"Broadcast sent to zone {zone}")
        except Exception as e:
            return MutationResponse(success=False, message=str(e))
