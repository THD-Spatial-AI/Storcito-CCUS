import { config } from "@/configuration/app";
import { useAuthStore } from "@/store/auth-store";

// One SSE connection per tab, shared by every notification hook. Browsers allow
// only six HTTP/1.1 connections per host, so each extra stream starves the API.

export interface NotificationStreamListener {
  onNotification: (event: MessageEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

const RECONNECT_DELAY_MS = 5000;

const listeners = new Set<NotificationStreamListener>();
let eventSource: EventSource | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

function buildStreamUrl(): string {
  const base = config.api.baseUrl || "/api";
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/notifications/stream`;
}

function clearReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

function disconnect() {
  clearReconnect();
  if (!eventSource) return;
  try {
    eventSource.close();
  } catch {
    // Ignore close errors
  }
  eventSource = null;
  for (const listener of listeners) listener.onClose?.();
}

function dispatch(event: MessageEvent) {
  for (const listener of listeners) listener.onNotification(event);
}

// Open the stream if anyone listens and a user is signed in.
function connect() {
  if (eventSource || listeners.size === 0 || !useAuthStore.getState().user) return;
  clearReconnect();

  try {
    const source = new EventSource(buildStreamUrl(), { withCredentials: true });
    source.onopen = () => {
      for (const listener of listeners) listener.onOpen?.();
    };
    source.addEventListener("notification", dispatch as EventListener);
    source.onerror = () => {
      disconnect();
      reconnectTimeout = setTimeout(connect, RECONNECT_DELAY_MS);
    };
    eventSource = source;
  } catch {
    // Ignore connection errors
  }
}

// Follow sign-in and sign-out.
useAuthStore.subscribe((state, previous) => {
  if (state.user === previous.user) return;
  if (state.user) connect();
  else disconnect();
});

export function subscribeToNotificationStream(listener: NotificationStreamListener): () => void {
  listeners.add(listener);
  if (eventSource?.readyState === EventSource.OPEN) listener.onOpen?.();
  connect();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) disconnect();
  };
}

// Close on logout.
export function closeNotificationStream() {
  disconnect();
}
