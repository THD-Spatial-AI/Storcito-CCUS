import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { syncedListSetting } from '@/features/settings';

interface FavoriteModelsState {
  favoriteIds: number[];
  toggleFavorite: (id: number) => void;
  isFavorite: (id: number) => boolean;
  syncFromBackend: () => Promise<void>;
}

const setting = syncedListSetting<number>('favorite_models');

export const useFavoriteModelsStore = create<FavoriteModelsState>()(
  persist(
    (set, get) => ({
      favoriteIds: [],

      toggleFavorite: (id: number) => {
        const current = get().favoriteIds;
        const favoriteIds = current.includes(id) ? current.filter(fid => fid !== id) : [...current, id];
        set({ favoriteIds });
        void setting.save(favoriteIds);
      },

      isFavorite: (id: number) => get().favoriteIds.includes(id),

      syncFromBackend: async () => {
        const favoriteIds = await setting.load();
        if (favoriteIds) set({ favoriteIds });
      },
    }),
    {
      name: 'favorite-models-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ favoriteIds: state.favoriteIds }),
    }
  )
);
