import { apiFetch } from '../lib/api';

export interface RoutePoint {
  lat: number;
  lon: number;
}

export interface RouteInstruction {
  distance: number;
  instruction: string;
}

export async function calculateRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: 'walking' | 'tricycle' = 'walking',
): Promise<{
  polyline: string;
  distance_metres: number;
  duration_seconds: number;
  instructions: RouteInstruction[];
}> {
  try {
    const profile = mode === 'walking' ? 'foot' : 'driving';
    // OSRM expects coordinates in lon,lat format
    const res = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=polyline&steps=true`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const steps = route.legs?.[0]?.steps || [];
      const instructions = steps.map((s: any) => {
        const type = s.maneuver?.type || 'continue';
        const modifier = s.maneuver?.modifier || '';
        const name = s.name ? `onto ${s.name}` : '';
        let text = '';
        if (type === 'depart') text = `Head ${modifier} ${name}`;
        else if (type === 'arrive') text = `You will arrive at your destination`;
        else text = `In ${Math.round(s.distance)}m, ${type} ${modifier} ${name}`;
        return { distance: s.distance, instruction: text.trim().replace(/\s+/g, ' ') };
      });

      return {
        polyline: route.geometry,
        distance_metres: route.distance,
        duration_seconds: route.duration,
        instructions,
      };
    }
  } catch (e) {
    console.warn("OSRM routing failed", e);
  }
  return { polyline: '', distance_metres: 0, duration_seconds: 0, instructions: [] };
}
