export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';
export type InstitutionType = 'SCHOOL' | 'COLLEGE' | 'COACHING';
export type InstitutionStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';

export interface User {
    id: string;
    email: string;
    role: Role;
    institutionId?: string;
    createdAt: string;
}

export interface Institution {
    id: string;
    name: string;
    email: string;
    type: InstitutionType;
    status: InstitutionStatus;
    createdAt: string;
    updatedAt: string;
    users?: User[];
    phone?: string;
    city?: string;
}

export interface AuditLog {
    id: string;
    action: string;
    userId: string;
    institutionId?: string;
    createdAt: string;
    user?: User;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}