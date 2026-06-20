import { useEffect, useRef, useCallback, useState } from 'react';
import { wsManager } from '../services/websocket';

interface UseWebSocketOptions {
  url: string;
  token?: string;
  autoConnect?: boolean;
}

export function useWebSocket({ url, token, autoConnect = true }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef<Map<string, Set<Function>>>(new Map());

  useEffect(() => {
    if (!autoConnect) return;

    wsManager.connect(url, token);

    const unsubConnected = wsManager.on('*', () => {
      setConnected(wsManager.connected);
    });

    const interval = setInterval(() => {
      setConnected(wsManager.connected);
    }, 2000);

    return () => {
      unsubConnected();
      clearInterval(interval);
    };
  }, [url, token, autoConnect]);

  const send = useCallback((data: Record<string, unknown>) => {
    wsManager.send(data);
  }, []);

  const subscribe = useCallback((type: string, handler: Function) => {
    return wsManager.on(type, handler as any);
  }, []);

  return { connected, send, subscribe };
}

export function useGuestWebSocket() {
  const wsUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000')
    .replace(/^http/, 'ws') + '/ws/location/guest';

  return useWebSocket({ url: wsUrl });
}

export function useAuthWebSocket(token: string) {
  const wsUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000')
    .replace(/^http/, 'ws') + '/ws/location';

  return useWebSocket({ url: wsUrl, token });
}
