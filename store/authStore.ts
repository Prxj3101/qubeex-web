import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useUserAvatarStore } from './userAvatarStore';
import { isInstType, writeCachedInstType, clearCachedInstType, rememberInstTypeForInstitution, lookupInstTypeForInstitution } from '@/lib/instTypeCache';

interface User {
    id: string;
    name?: string | null;
    email: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'SUB_ADMIN' | 'TEACHER' | 'STUDENT';
    institutionId?: string | null;
    institutionType?: 'SCHOOL' | 'COLLEGE' | 'COACHING' | null;
    permissions?: string[] | null;
    mustChangePassword?: boolean;
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
        (set, get) => ({
            user: null,
            token: null,
            setAuth: (user, token) => {
                localStorage.setItem('token', token);
                if (get().user?.id !== user.id) {
                    useUserAvatarStore.getState().clearAvatarUrl();
                }
                // Write the instType cache immediately at login using the
                // value already present on the user object, instead of
                // waiting for MockInstTypeContext's separate /admin/me fetch
                // to resolve after navigation. That delay is what caused the
                // previous account's theme color to flash on the first paint
                // after switching accounts.
                if (isInstType(user.institutionType)) {
                    writeCachedInstType(user.institutionType);
                    // Remember it against this institutionId so a teacher
                    // login for the SAME institution (whose responses never
                    // include institution type at all — verified against
                    // /auth/login, /teacher/me, /teacher/overview) can reuse
                    // it below, instead of always falling back to School.
                    rememberInstTypeForInstitution(user.institutionId, user.institutionType);
                } else {
                    // This role's login response didn't tell us the type
                    // (true for TEACHER today). Fall back to whatever we
                    // remembered for this institution from a previous
                    // admin session on this browser, if any.
                    const remembered = lookupInstTypeForInstitution(user.institutionId);
                    if (remembered) writeCachedInstType(remembered);
                }
                set({ user, token });
            },
            setUser: (user) => set({ user }),
            clearAuth: () => {
                localStorage.removeItem('token');
                set({ user: null, token: null });
                useUserAvatarStore.getState().clearAvatarUrl();
                // Clear the instType cache so a fresh login never briefly
                // inherits the previous account's theme on first paint.
                clearCachedInstType();
            },
        }),
        { name: 'auth-storage' }
    )
);
