import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';
    institutionId?: string;
}

interface AuthStore {
    user: User | null;
    token: string | null;
    setAuth: (user: User, token: string) => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            setAuth: (user, token) => {
                localStorage.setItem('token', token);
                set({ user, token });
            },
            clearAuth: () => {
                localStorage.removeItem('token');
                set({ user: null, token: null });
            },
        }),
        { name: 'auth-storage' }
    )
);