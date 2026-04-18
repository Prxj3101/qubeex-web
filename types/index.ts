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
    logoUrl?: string;
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

export interface Plan {
    id: string;
    name: 'BASIC' | 'PRO';
    limits: {
        users: number;
        storageMb: number;
        tests: number;
    };
}

export interface AdminOverview {
    institution: {
        id: string;
        name: string;
        type: InstitutionType;
        status: InstitutionStatus;
        logoUrl?: string;
    };
    stats: {
        totalUsers: number;
        totalStudents: number;
        totalTeachers: number;
        totalClasses: number;
    };
    enrollmentGrowth: { month: string; students: number; teachers: number }[];
    plan: {
        name: string;
        usage: {
            users: { used: number; limit: number };
            storage: { used: number; limit: number };
            tests: { used: number; limit: number };
        };
    };
    recentActivity: { id: string; dot: string; text: string; time: string }[];
    notifications: { id: string; title: string; body: string; time: string }[];
}
