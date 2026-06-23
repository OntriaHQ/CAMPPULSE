import { apiFetch } from '../lib/api';

export interface Ride {
  id: string;
  status: 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  vehicle_type: string;
  rider_id: string;
  rider_name: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_vehicle_type: string | null;
  pickup_lat: number;
  pickup_lon: number;
  pickup_label: string | null;
  dropoff_lat: number;
  dropoff_lon: number;
  dropoff_label: string | null;
  distance_metres: number | null;
  fare_estimate: string | null;
  eta_seconds: number | null;
  candidate_driver_count: number | null;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface RideRequestInput {
  pickup_lat: number;
  pickup_lon: number;
  pickup_label?: string;
  dropoff_lat: number;
  dropoff_lon: number;
  dropoff_label?: string;
  vehicle_type?: string;
}

// In-memory state to mock a dynamic ride hailing process for the demo
let mockRideState: Ride | null = null;

export async function requestRide(data: RideRequestInput): Promise<Ride> {
  const id = "demo-ride-" + Date.now();
  mockRideState = {
    id,
    status: 'requested',
    vehicle_type: data.vehicle_type || 'tricycle',
    rider_id: 'demo-user',
    rider_name: 'Guest User',
    driver_id: null,
    driver_name: null,
    driver_vehicle_type: null,
    pickup_lat: data.pickup_lat,
    pickup_lon: data.pickup_lon,
    pickup_label: data.pickup_label || 'Pickup',
    dropoff_lat: data.dropoff_lat,
    dropoff_lon: data.dropoff_lon,
    dropoff_label: data.dropoff_label || 'Dropoff',
    distance_metres: 1200,
    fare_estimate: '850',
    eta_seconds: null,
    candidate_driver_count: Math.floor(Math.random() * 5) + 2, // fake dynamic drivers
    requested_at: new Date().toISOString(),
    accepted_at: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
  };
  
  // Simulate the ride hailing algorithm picking a driver after 4 seconds
  setTimeout(() => {
    if (mockRideState && mockRideState.id === id) {
      mockRideState.status = 'accepted';
      mockRideState.driver_name = 'Samuel (City Shuttle)';
      mockRideState.driver_vehicle_type = data.vehicle_type === 'tricycle' ? 'Tricycle (Keke)' : 'Toyota Corolla';
      mockRideState.eta_seconds = 180;
    }
  }, 4000);

  // Simulate ride starting after 8 seconds
  setTimeout(() => {
    if (mockRideState && mockRideState.id === id) {
      mockRideState.status = 'in_progress';
    }
  }, 8000);

  // Simulate ride completion after 12 seconds
  setTimeout(() => {
    if (mockRideState && mockRideState.id === id) {
      mockRideState.status = 'completed';
    }
  }, 14000);

  return mockRideState;
}

export async function getRide(rideId: string): Promise<Ride> {
  if (mockRideState && mockRideState.id === rideId) {
    return mockRideState;
  }
  // Fallback to real API if not our mock
  const res = await apiFetch<{ success: boolean; data: Ride }>(`/api/v1/rides/${rideId}`);
  return res.data;
}

export async function getMyRides(asDriver = false): Promise<Ride[]> {
  const res = await apiFetch<{ success: boolean; data: { items: Ride[] } }>(
    `/api/v1/rides/mine?as_driver=${asDriver}`,
  );
  return res.data.items;
}

let mockDriverRideState: Ride | null = null;

export async function acceptRide(rideId: string): Promise<Ride> {
  mockDriverRideState = {
    id: rideId,
    status: 'accepted',
    vehicle_type: 'standard',
    rider_id: 'passenger-1',
    rider_name: 'John Doe',
    driver_id: 'demo-driver',
    driver_name: 'Demo Driver',
    driver_vehicle_type: 'Toyota Corolla',
    pickup_lat: 6.8005,
    pickup_lon: 3.4447,
    pickup_label: 'The Arena (Main Auditorium)',
    dropoff_lat: 6.8060,
    dropoff_lon: 3.4400,
    dropoff_label: 'Haggai Estate 3',
    distance_metres: 1200,
    fare_estimate: '1,500',
    eta_seconds: 180,
    candidate_driver_count: 1,
    requested_at: new Date().toISOString(),
    accepted_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
  };
  return mockDriverRideState;
}

export async function startRide(rideId: string): Promise<Ride> {
  if (mockDriverRideState) {
    mockDriverRideState.status = 'in_progress';
    mockDriverRideState.started_at = new Date().toISOString();
  }
  return mockDriverRideState!;
}

export async function completeRide(rideId: string): Promise<Ride> {
  if (mockDriverRideState) {
    mockDriverRideState.status = 'completed';
    mockDriverRideState.completed_at = new Date().toISOString();
  }
  return mockDriverRideState!;
}

export async function cancelRide(rideId: string, reason?: string): Promise<Ride> {
  const res = await apiFetch<{ success: boolean; data: Ride }>(`/api/v1/rides/${rideId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
  return res.data;
}
