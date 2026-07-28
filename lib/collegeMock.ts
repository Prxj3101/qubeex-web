// Shared localStorage-backed mock data layer for College's Department → Year →
// Division structure, used by:
//   - app/admin/campus/departments/page.tsx (structure CRUD)
//   - lib/collegeMockAdapter.ts (intercepts the real `api` calls made by the
//     REUSED school division-workspace components — DivisionClassPageClient,
//     fees.tsx, AttendanceTab, MarksTab — so those files run completely
//     unmodified against this mock data)
//
// Backend for Department/Year/Division doesn't exist yet — everything here
// lives in localStorage under MOCK_KEY. Shapes intentionally mirror the real
// school API responses so this can be swapped for real `api` calls later.

export function uid(): string {
    try {
        return crypto.randomUUID();
    } catch {
        return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
}

export const MOCK_KEY = 'qubeex:mockDepartments';

export interface Assignment {
    id: string;
    subjectId: string | null;
    teacher: { id: string; prefix: string | null; avatarUrl?: string | null; user: { id: string; name: string | null } };
    subject: { id: string; name: string; color: string | null } | null;
}

export interface Subject {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
    order: number;
}

// ── Division-workspace mock data (View / Manage / Fees / Attendance / Marksheet) ──

export interface MockStudent {
    id: string;
    studentId: string;
    userId: string;
    user: { name: string | null; email: string; mustChangePassword: boolean };
    hasLoggedIn: boolean;
    rollNo: string | null;
    avatarUrl: string | null;
    phone: string | null;
    dob: string | null;
    gender: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country: string | null;
    houseColor: string | null;
    bloodGroup: string | null;
    aadharNo: string | null;
    panNo: string | null;
    emergencyContact: string | null;
    religion: string | null;
    category: string | null;
    nationality: string | null;
    admissionYear: string | null;
    guardians: { name: string; number: string; relation: string }[] | null;
    tempPassword: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED';
}

export function makeMockStudent(name: string, rollNo?: string): MockStudent {
    return {
        id: uid(), studentId: 'STU-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
        userId: uid(),
        user: { name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@student.edu`, mustChangePassword: true },
        hasLoggedIn: false,
        rollNo: rollNo ?? null,
        avatarUrl: null, phone: null, dob: null, gender: null, address: null, city: null, state: null,
        pincode: null, country: null, houseColor: null, bloodGroup: null, aadharNo: null, panNo: null,
        emergencyContact: null, religion: null, category: null, nationality: null, admissionYear: null,
        guardians: null, tempPassword: null, status: 'ACTIVE',
    };
}

export type PostType = 'announcement' | 'notice' | 'material' | 'result';
export interface MockPost {
    id: string;
    type: PostType;
    title: string;
    body: string;
    subject: string | null;
    divisionId: string | null;
    attachmentUrl: string | null;
    attachmentType: string | null;
    attachmentName: string | null;
    createdAt: string;
    author: { id: string; name: string; role: string; avatarUrl?: string | null; prefix?: string | null; title?: string | null };
}

export type CalEventType = 'holiday' | 'event' | 'test' | 'termtest' | 'exam' | 'meeting' | 'submission';
export interface MockCalEvent {
    id: string;
    date: number;
    type: CalEventType;
    label: string;
    year: number;
    month: number;
}

export interface FeeSubItem { id: string; label: string; amount: number; }
export interface FeeItem { id: string; label: string; amount: number; subItems: FeeSubItem[]; }
export interface FeeStructureDef { id: string; name: string; type: 'REGULAR' | 'ADDON' | 'PENALTY' | 'ONE_TIME'; color: string; items: FeeItem[]; }
export interface FeeMonthDef { id: string; month: string; dueDate: string; assignedStructureIds: string[]; }
export interface BankDetailsDef { accountName: string; accountNumber: string; ifsc: string; bankName: string; branch: string; upiId?: string; }
export interface FeeDataBlob {
    feeStructures: FeeStructureDef[];
    feeMonths: FeeMonthDef[];
    bankDetails: BankDetailsDef | null;
    qrImageUrl: string | null;
    extraColumns: { label: string }[];
    studentFields: { id: string; kind: 'default' | 'custom'; defaultKey?: string; label: string; value?: string }[];
    generalRemark: string | null;
    feeCardTheme: string;
    schoolLogoUrl: string | null;
    schoolName: string | null;
}
export interface FeePaymentRecord { studentId: string; feeMonthId: string; status: 'PAID' | 'PENDING'; paidDate: string | null; remark: string | null; }

export interface DivisionRecord {
    id: string;
    name: string;
    capacity: number | null;
    studentCount: number;
    divisionSubjects: { subjectId: string }[];
    assignments: Assignment[];
    students?: MockStudent[];
    posts?: MockPost[];
    events?: MockCalEvent[];
    feeData?: FeeDataBlob | null;
    feePayments?: FeePaymentRecord[];
}

export interface YearRecord {
    id: string;
    name: string;
    order: number;
    subjects: Subject[];
    divisions: DivisionRecord[];
}

export interface DepartmentRecord {
    id: string;
    name: string;
    order: number;
    years: YearRecord[];
}

export function readDepartments(): DepartmentRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(MOCK_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function writeDepartments(depts: DepartmentRecord[]) {
    try { window.localStorage.setItem(MOCK_KEY, JSON.stringify(depts)); } catch { /* ignore */ }
}

export function findDivisionPath(departmentId: string, yearId: string, divisionId: string): {
    depts: DepartmentRecord[]; department: DepartmentRecord; year: YearRecord; division: DivisionRecord;
} | null {
    const depts = readDepartments();
    const department = depts.find(d => d.id === departmentId);
    const year = department?.years.find(y => y.id === yearId);
    const division = year?.divisions.find(dv => dv.id === divisionId);
    if (!department || !year || !division) return null;
    return { depts, department, year, division };
}

// Mutates the division in place (via the found path), then persists the whole tree.
export function updateDivision(
    departmentId: string, yearId: string, divisionId: string,
    updater: (division: DivisionRecord) => DivisionRecord,
): DivisionRecord | null {
    const found = findDivisionPath(departmentId, yearId, divisionId);
    if (!found) return null;
    const { depts, department, year, division } = found;
    const updated = updater(division);
    const newDepts = depts.map(d => d.id !== department.id ? d : {
        ...d,
        years: d.years.map(y => y.id !== year.id ? y : {
            ...y,
            divisions: y.divisions.map(dv => dv.id !== division.id ? dv : updated),
        }),
    });
    writeDepartments(newDepts);
    return updated;
}

// ── Tree-wide lookups (for endpoints that only carry a nested id, e.g.
// assignmentId / subjectId / a division's id alone) ─────────────────────────

export interface TreeLocation {
    depts: DepartmentRecord[]; department: DepartmentRecord; year: YearRecord; division: DivisionRecord;
}

export function findDivisionById(divisionId: string): TreeLocation | null {
    const depts = readDepartments();
    for (const department of depts) {
        for (const year of department.years) {
            const division = year.divisions.find(dv => dv.id === divisionId);
            if (division) return { depts, department, year, division };
        }
    }
    return null;
}

export function findByYearId(yearId: string): { depts: DepartmentRecord[]; department: DepartmentRecord; year: YearRecord } | null {
    const depts = readDepartments();
    for (const department of depts) {
        const year = department.years.find(y => y.id === yearId);
        if (year) return { depts, department, year };
    }
    return null;
}

export function findDivisionByAssignmentId(assignmentId: string): TreeLocation | null {
    const depts = readDepartments();
    for (const department of depts) {
        for (const year of department.years) {
            for (const division of year.divisions) {
                if (division.assignments.some(a => a.id === assignmentId)) return { depts, department, year, division };
            }
        }
    }
    return null;
}

export function findDivisionBySubjectId(subjectId: string): TreeLocation & { yearId: string } | null {
    const depts = readDepartments();
    for (const department of depts) {
        for (const year of department.years) {
            if (year.subjects.some(s => s.id === subjectId)) {
                // Subject lives on the Year — return the first division as an anchor
                // plus yearId so the caller can update the right level.
                const division = year.divisions[0];
                if (division) return { depts, department, year, division, yearId: year.id };
            }
        }
    }
    return null;
}

export function findDivisionByPostId(postId: string): TreeLocation | null {
    const depts = readDepartments();
    for (const department of depts) {
        for (const year of department.years) {
            for (const division of year.divisions) {
                if ((division.posts ?? []).some(p => p.id === postId)) return { depts, department, year, division };
            }
        }
    }
    return null;
}

export function findDivisionByEventId(eventId: string): TreeLocation | null {
    const depts = readDepartments();
    for (const department of depts) {
        for (const year of department.years) {
            for (const division of year.divisions) {
                if ((division.events ?? []).some(e => e.id === eventId)) return { depts, department, year, division };
            }
        }
    }
    return null;
}

export function updateDivisionByLocation(loc: TreeLocation, updater: (d: DivisionRecord) => DivisionRecord): DivisionRecord {
    return updateDivision(loc.department.id, loc.year.id, loc.division.id, updater) as DivisionRecord;
}

// Updates a Year's subjects (id is the year id, mirroring how the school API
// treats division.standard.id as the subjects-owner).
export function updateYearSubjects(yearId: string, updater: (subjects: Subject[]) => Subject[]): Subject[] | null {
    const found = findByYearId(yearId);
    if (!found) return null;
    const { depts, department, year } = found;
    const newSubjects = updater(year.subjects);
    const newDepts = depts.map(d => d.id !== department.id ? d : {
        ...d,
        years: d.years.map(y => y.id !== year.id ? y : { ...y, subjects: newSubjects }),
    });
    writeDepartments(newDepts);
    return newSubjects;
}
