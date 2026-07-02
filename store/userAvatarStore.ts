import { create } from 'zustand';

interface UserAvatarState {
    avatarUrl: string | null;
    setAvatarUrl: (url: string | null) => void;
    clearAvatarUrl: () => void;
}

export const useUserAvatarStore = create<UserAvatarState>((set) => ({
    avatarUrl: null,
    setAvatarUrl: (url) => set({ avatarUrl: url }),
    clearAvatarUrl: () => set({ avatarUrl: null }),
}));
