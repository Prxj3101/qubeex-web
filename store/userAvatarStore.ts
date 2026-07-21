import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserAvatarState {
    avatarUrl: string | null;
    setAvatarUrl: (url: string | null) => void;
    clearAvatarUrl: () => void;
}

export const useUserAvatarStore = create<UserAvatarState>()(
    persist(
        (set) => ({
            avatarUrl: null,
            setAvatarUrl: (url) => set({ avatarUrl: url }),
            clearAvatarUrl: () => set({ avatarUrl: null }),
        }),
        { name: 'user-avatar-storage' }
    )
);
