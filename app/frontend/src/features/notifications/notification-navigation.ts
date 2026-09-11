import type { Notification } from "./hooks/useNotificationsQuery";

/** Completions open results. */
export function getNotificationResultPath(notification: Notification): string | null {
  if (notification.type !== "success") return null;
  if (!Number.isInteger(notification.model_id) || (notification.model_id ?? 0) <= 0) return null;
  return `/app/model-results/${notification.model_id}`;
}
