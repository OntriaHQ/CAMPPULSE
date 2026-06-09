import type { Coordinates } from "./user";

export interface RouteRequest {
  origin: Coordinates;
  destination: Coordinates;
  avoid_incidents?: boolean;
}

export interface RouteResponse {
  polyline: string;
  distance_meters: number;
  duration_seconds: number;
  waypoints: Coordinates[];
}
