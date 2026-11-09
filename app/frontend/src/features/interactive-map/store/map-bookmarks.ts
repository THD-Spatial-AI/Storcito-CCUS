import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { syncedListSetting } from '@/features/settings';

export interface MapBookmark {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  zoom: number;
}

interface MapBookmarksState {
  bookmarks: MapBookmark[];
  addBookmark: (bookmark: Omit<MapBookmark, 'id'>) => void;
  removeBookmark: (id: string) => void;
  syncFromBackend: () => Promise<void>;
}

const setting = syncedListSetting<MapBookmark>('map_bookmarks');

export const useMapBookmarksStore = create<MapBookmarksState>()(
  persist(
    (set, get) => {
      const save = (bookmarks: MapBookmark[]) => {
        set({ bookmarks });
        void setting.save(bookmarks);
      };
      return {
        bookmarks: [],

        addBookmark: (bookmark) =>
          save([
            ...get().bookmarks,
            { ...bookmark, id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
          ]),

        removeBookmark: (id) => save(get().bookmarks.filter(b => b.id !== id)),

        syncFromBackend: async () => {
          const bookmarks = await setting.load();
          if (bookmarks) set({ bookmarks });
        },
      };
    },
    {
      name: 'map-bookmarks-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ bookmarks: state.bookmarks }),
    }
  )
);
