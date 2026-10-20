import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { notificationsService } from "@/features/notifications/services/notifications";
import { subscribeToNotificationStream } from "@/features/notifications/services/notificationStream";

export interface Notification {
  id: number | string;
  notification_id?: number;
  title: string;
  message: string;
  type: "warning" | "error" | "success" | "info" | "maintenance";
  read: boolean;
  created_at: string;
  service?: string;
  scheduled_at?: string;
  model_id?: number;
}

interface NotificationsResponse {
  success: boolean;
  notifications: Notification[];
}

// React Query keys
const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (params?: { last30Days?: boolean }) => [...notificationKeys.lists(), params] as const,
};

export { closeNotificationStream } from "@/features/notifications/services/notificationStream";

export const useNotificationsQuery = (params?: { last30Days?: boolean }) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: async () => {
      return notificationsService.list(params);
    },
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  // Live updates over the tab's shared stream.
  useEffect(
    () => subscribeToNotificationStream({
      onNotification: (ev) => handleIncomingNotification(ev, queryClient),
    }),
    [queryClient],
  );

  return query;
};

// Incoming notification.
function handleIncomingNotification(ev: MessageEvent, queryClient: QueryClient) {
  try {
    const incoming = JSON.parse(ev.data) as Notification;
    updateNotificationsList(incoming, queryClient);
    // Refresh on completion.
    if (incoming.type === "success" || incoming.type === "error") {
      queryClient.invalidateQueries({ queryKey: ["models"] });
    }
  } catch {
    // Ignore parse errors
  }
}

// Prepend the notification.
function updateNotificationsList(incoming: Notification, queryClient: QueryClient) {
  queryClient.setQueriesData<NotificationsResponse>(
    { queryKey: notificationKeys.lists() },
    (old: NotificationsResponse | undefined) => {
      if (!old) return old;

      const exists = old.notifications?.some((n) => n.id === incoming.id);
      if (exists) return old;

      const next = [incoming, ...(old.notifications || [])];
      return { ...old, notifications: next.slice(0, 50) };
    }
  );
}

// Mark one read.
export const useMarkNotificationReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number | string) => {
      return notificationsService.markRead(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });

      const previousData = queryClient.getQueriesData({
        queryKey: notificationKeys.lists(),
      });

      queryClient.setQueriesData<NotificationsResponse>(
        { queryKey: notificationKeys.lists() },
        (old) => {
          if (!old?.notifications) return old;
          return {
            ...old,
            notifications: old.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
          };
        }
      );

      return { previousData };
    },
    onError: (_error, _id, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
};

// Mark all read.
export const useMarkAllNotificationsReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return notificationsService.markAllRead();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });

      const previousData = queryClient.getQueriesData({
        queryKey: notificationKeys.lists(),
      });

      queryClient.setQueriesData<NotificationsResponse>(
        { queryKey: notificationKeys.lists() },
        (old) => {
          if (!old?.notifications) return old;
          return {
            ...old,
            notifications: old.notifications.map((n) => ({ ...n, read: true })),
          };
        }
      );

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
};

// Clear all notifications
export const useClearAllNotificationsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return notificationsService.clearAll();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });

      const previousData = queryClient.getQueriesData({
        queryKey: notificationKeys.lists(),
      });

      queryClient.setQueriesData<NotificationsResponse>(
        { queryKey: notificationKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            notifications: [],
          };
        }
      );

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
};
