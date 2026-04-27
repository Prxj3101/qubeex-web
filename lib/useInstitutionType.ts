import { useAuthStore } from '@/store/authStore';

export type InstitutionType = 'SCHOOL' | 'COLLEGE' | 'COACHING';

export function useInstitutionType(): InstitutionType {
    const user = useAuthStore((s) => s.user);
    return user?.institutionType ?? 'SCHOOL';
}