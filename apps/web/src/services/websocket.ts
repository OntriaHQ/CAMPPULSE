export type MessageHandler = (data: any) => void;

const WS_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000')
  .replace(/^http/, 'ws');

class WebSocketManager {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private url: string = '';
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;

  connect(endpoint: string, token?: string) {
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.url = `${WS_BASE}${endpoint}`;
    this.token = token ?? null;
    this._connect();
  }

  private _connect() {
    const wsUrl = this.token
      ? `${this.url}?token=${this.token}`
      : this.url;

    try {
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.close();
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`WebSocket connected: ${this.url}`);
        this.reconnectAttempts = 0;
        this._startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const type = msg.type;
          const handlers = this.handlers.get(type) ?? this.handlers.get('*');
          if (handlers) {
            handlers.forEach(h => h(msg));
          }
        } catch {}
      };

      this.ws.onclose = () => {
        this._stopHeartbeat();
        if (!this.intentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`WS reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
          this.reconnectTimeout = window.setTimeout(() => {
            this.reconnectAttempts++;
            this._connect();
          }, delay);
        }
      };

      this.ws.onerror = () => {
        // onclose handles reconnection
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }

  disconnect() {
    this.intentionalClose = true;
    this._stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  private _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get connectionState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

export const wsManager = new WebSocketManager();
export default WebSocketManager;
