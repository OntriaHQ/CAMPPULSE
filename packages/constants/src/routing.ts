import routingJson from "../routing.json";

export const ROUTE_CACHE_TTL_SECONDS = routingJson.routeCacheTtlSeconds as number;
export const PROXIMITY_RADIUS_METERS = routingJson.proximityRadiusMeters as number;
export const OFFLINE_ROUTE_MAX_AGE_HOURS = routingJson.offlineRouteMaxAgeHours as number;

export { routingJson };
