import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { wsManager } from '../services/websocket';

interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export function useLocation(options?: { sendPings?: boolean; token?: string }) {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);

        if (status !== 'granted') {
          setError('Location permission denied');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          timestamp: loc.timestamp,
        });

        subscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 10,
            timeInterval: 30000,
          },
          (newLoc) => {
            setLocation({
              latitude: newLoc.coords.latitude,
              longitude: newLoc.coords.longitude,
              accuracy: newLoc.coords.accuracy,
              timestamp: newLoc.timestamp,
            });
          }
        );
      } catch (e: any) {
        setError(e.message);
      }
    })();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!options?.sendPings || !location || !options?.token) return;

    pingIntervalRef.current = setInterval(() => {
      if (wsManager.connected) {
        wsManager.send({
          type: 'location_ping',
          payload: {
            lat: location.latitude,
            lon: location.longitude,
            accuracy: location.accuracy,
            timestamp: Math.floor(Date.now() / 1000),
          },
        });
      }
    }, 30000);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [options?.sendPings, location, options?.token]);

  return { location, permissionStatus, error };
}
