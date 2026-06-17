import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    name?: string | null;
    email: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'SUB_ADMIN' | 'TEACHER' | 'STUDENT';
    institutionId?: string | null;
    institutionType?: 'SCHOOL' | 'COLLEGE' | 'COACHING' | null;
    permissions?: string[] | null;
}

interface AuthStore {
    user: User | null;
    token: string | null;
    setAuth: (user: User, token: string) => void;
    setUser: (user: User) => void;
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
            setUser: (user) => set({ user }),
            clearAuth: () => {
                localStorage.removeItem('token');
                set({ user: null, token: null });
            },
        }),
        { name: 'auth-storage' }
    )
);
