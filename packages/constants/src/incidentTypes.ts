export const INCIDENT_TYPES = [
  "flooding",
  "pothole",
  "streetlight",
  "water_leak",
  "trash",
  "security",
  "congestion",
  "other",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_DEPARTMENTS: Record<IncidentType, string> = {
  flooding: "infrastructure",
  pothole: "infrastructure",
  streetlight: "infrastructure",
  water_leak: "infrastructure",
  trash: "sanitation",
  security: "security",
  congestion: "traffic",
  other: "general",
};
