import { useAuthStore } from '@/store/authStore';

/** Admins can always manage; sub-admins need TIMETABLE_MANAGE. The backend enforces the same rule. */
export function useCanManageTimetable(): boolean {
    const user = useAuthStore(s => s.user);
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
    return !!user.permissions?.includes('TIMETABLE_MANAGE');
}
