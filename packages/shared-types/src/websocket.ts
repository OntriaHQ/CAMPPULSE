export type WebSocketChannel =
  | "location.ping"
  | "incident.created"
  | "incident.updated"
  | "congestion.flagged"
  | "congestion.cleared"
  | "route.updated"
  | "notification.push";

export interface WebSocketMessage<T = unknown> {
  channel: WebSocketChannel;
  payload: T;
  timestamp: number;
}
