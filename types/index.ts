export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';
export type InstitutionType = 'SCHOOL' | 'COLLEGE' | 'COACHING';
export type InstitutionStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';

export interface User {
    id: string;
    name?: string;
    email: string;
    role: Role;
    institutionId?: string;
    createdAt: string;
}

export interface Institution {
    id: string;
    institutionCode?: string;
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
    subscription?: {
        plan?: { name: string };
        status?: string;
    };
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
            aiTokens: { used: number; limit: number };  // ← add karo
        };
    };
    auditLogs: {
        id: string;
        dot: 'violet' | 'emerald' | 'amber' | 'red' | 'sky';
        action: string;
        actor: string;
        detail: string;
        time: string;
    }[];
    tickets: {
        id: string;
        title: string;
        category: 'BUG' | 'FEATURE' | 'BILLING' | 'OTHER';
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
        createdAt: string;
    }[];
}

// ── Phase 2: Institution Structure ──

export interface StructureLevel3 {
    id: string;
    name: string;
    code?: string;
    capacity?: number;
    teacherCount: number;
    studentCount: number;
}

export interface StructureLevel2 {
    id: string;
    name: string;
    code?: string;
    order: number;
    children: StructureLevel3[];
}

export interface StructureLevel1 {
    id: string;
    name: string;
    code?: string;
    order: number;
    children: StructureLevel2[];
}

export interface InstitutionStructure {
    institutionType: InstitutionType;
    levels: StructureLevel1[];
}

// ── Phase 3A: Teacher Management ──

export type TeacherStatus = 'ACTIVE' | 'INACTIVE';
export type TeacherRole = 'SUBJECT_TEACHER' | 'CLASS_TEACHER';

export interface TeacherAssignment {
    id: string;
    level1Id: string;
    level1Name: string;
    level2Id: string;
    level2Name: string;
    level3Id: string;
    level3Name: string;
    role: TeacherRole;
}

export interface Teacher {
    id: string;
    teacherId?: string;
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    status: TeacherStatus;
    invitePending?: boolean;
    joinedAt: string;
    assignments: TeacherAssignment[];
    experience?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    qualification?: string;
    dob?: string;
    gender?: string;
    address?: string;
}

