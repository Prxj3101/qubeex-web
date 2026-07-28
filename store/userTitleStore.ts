import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserTitleState {
    title: string | null;
    prefix: string | null;
    setTitle: (title: string | null) => void;
    setPrefix: (prefix: string | null) => void;
    clearTitle: () => void;
}

export const useUserTitleStore = create<UserTitleState>()(
    persist(
        (set) => ({
            title: null,
            prefix: null,
            setTitle: (title) => set({ title }),
            setPrefix: (prefix) => set({ prefix }),
            clearTitle: () => set({ title: null, prefix: null }),
        }),
        { name: 'user-title-storage' }
    )
);
