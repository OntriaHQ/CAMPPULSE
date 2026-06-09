import type { IncidentType } from "@camppulse/constants";
import type { Coordinates } from "./user";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus =
  | "reported"
  | "acknowledged"
  | "dispatched"
  | "in_progress"
  | "resolved"
  | "closed";

export interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  location: Coordinates;
  description?: string;
  zone?: string;
  reporter_id?: string;
  created_at: string;
  updated_at: string;
}
