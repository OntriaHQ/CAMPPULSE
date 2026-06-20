import { useEffect, useRef, useCallback, useState } from 'react';
import { wsManager, type MessageHandler } from '../services/websocket';

interface UseWebSocketOptions {
  endpoint: string;
  token?: string;
  autoConnect?: boolean;
}

export function useWebSocket({ endpoint, token, autoConnect = true }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    wsManager.connect(endpoint, token);

    const interval = setInterval(() => {
      setIsConnected(wsManager.isConnected);
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [endpoint, token, autoConnect]);

  const send = useCallback((data: Record<string, unknown>) => {
    wsManager.send(data);
  }, []);

  const subscribe = useCallback(<T = any>(type: string, handler: (data: T) => void) => {
    return wsManager.on(type, handler as MessageHandler);
  }, []);

  const disconnect = useCallback(() => {
    wsManager.disconnect();
    setIsConnected(false);
  }, []);

  return { isConnected, send, subscribe, disconnect };
}

export function useGuestWebSocket() {
  return useWebSocket({ endpoint: '/ws/location/guest' });
}
