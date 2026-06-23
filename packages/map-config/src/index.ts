import boundary from "./boundary.json";
import zones from "./zones.json";
import roads from "./roads.json";
import hotspots from "./hotspots.json";
import mapboxStyle from "./mapbox-style.json";

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: unknown[];
}

export interface HotspotRegistry {
  hotspots: Array<{
    id: string;
    name: string;
    zone_id: string;
    coordinates: { lat: number; lon: number };
    schedule: unknown[];
  }>;
}

export const campBoundary = boundary as GeoJsonFeatureCollection;
export const campZones = zones as GeoJsonFeatureCollection;
export const campRoads = roads as GeoJsonFeatureCollection;
export const hotspotRegistry = hotspots as HotspotRegistry;
export const mapboxStyleConfig = mapboxStyle;

export const REDEMPTION_CITY_CENTER = {
  lat: 6.8005,
  lon: 3.4447,
} as const;

export {
  boundary,
  zones,
  roads,
  hotspots,
  mapboxStyle,
};
