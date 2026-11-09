import { useAuthStore } from "@/store/auth-store";
import { settingsService } from "./settings";

/** Synced user list. */
export const syncedListSetting = <T>(key: string) => {
  const signedIn = () => !!useAuthStore.getState().user;

  return {
    /** Save, signed in only. */
    save: async (items: T[]): Promise<void> => {
      if (!signedIn()) return;
      try {
        await settingsService.setSetting(key, JSON.stringify(items));
      } catch (err) {
        if (import.meta.env.DEV) console.error(`Failed to save ${key}:`, err);
      }
    },
    /** Stored list, or null. */
    load: async (): Promise<T[] | null> => {
      if (!signedIn()) return null;
      try {
        const raw = await settingsService.getSetting(key);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? (parsed as T[]) : null;
      } catch (err) {
        if (import.meta.env.DEV) console.error(`Failed to sync ${key}:`, err);
        return null;
      }
    },
  };
};
