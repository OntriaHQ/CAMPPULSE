export type CongestionSeverity = "low" | "medium" | "high" | "critical";

export interface CongestionZone {
  zone_id: string;
  zone_name: string;
  severity: CongestionSeverity;
  ping_count: number;
  detected_at: string;
  cleared_at?: string;
}
