// Shared localStorage-backed mock data layer for College's Course → Department →
// Year → Semester → Division structure, used by:
//   - app/admin/campus/courses/page.tsx (structure CRUD)
//   - lib/collegeMockAdapter.ts (intercepts the real `api` calls made by the
//     REUSED school division-workspace components — DivisionClassPageClient,
//     fees.tsx, AttendanceTab, MarksTab — so those files run completely
//     unmodified against this mock data)
//
// Backend for Course/Department/Year/Semester/Division doesn't exist yet —
// everything here lives in localStorage under MOCK_KEY. Shapes intentionally
// mirror the real school API responses so this can be swapped for real `api`
// calls later. Subjects live on Semester (the level immediately above
// Division) — same spot School's Standard held them, since the reused
// division-workspace components only know "the level one above Division",
// not our specific level names.

export function uid(): string {
    try {
        return crypto.randomUUID();
    } catch {
        return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
}

export const MOCK_KEY = 'qubeex:mockCourses';

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

export interface SemesterRecord {
    id: string;
    name: string;
    order: number;
    subjects: Subject[];
    divisions: DivisionRecord[];
}

export interface YearRecord {
    id: string;
    name: string;
    order: number;
    semesters: SemesterRecord[];
}

export interface DepartmentRecord {
    id: string;
    name: string;
    order: number;
    years: YearRecord[];
}

export interface CourseRecord {
    id: string;
    name: string;
    order: number;
    departments: DepartmentRecord[];
}

export function readCourses(): CourseRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(MOCK_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function writeCourses(courses: CourseRecord[]) {
    try { window.localStorage.setItem(MOCK_KEY, JSON.stringify(courses)); } catch { /* ignore */ }
}

export interface TreeLocation {
    courses: CourseRecord[];
    course: CourseRecord;
    department: DepartmentRecord;
    year: YearRecord;
    semester: SemesterRecord;
    division: DivisionRecord;
}

export function findDivisionPath(courseId: string, departmentId: string, yearId: string, semesterId: string, divisionId: string): TreeLocation | null {
    const courses = readCourses();
    const course = courses.find(c => c.id === courseId);
    const department = course?.departments.find(d => d.id === departmentId);
    const year = department?.years.find(y => y.id === yearId);
    const semester = year?.semesters.find(s => s.id === semesterId);
    const division = semester?.divisions.find(dv => dv.id === divisionId);
    if (!course || !department || !year || !semester || !division) return null;
    return { courses, course, department, year, semester, division };
}

// Mutates the division in place (via the found path), then persists the whole tree.
export function updateDivision(
    courseId: string, departmentId: string, yearId: string, semesterId: string, divisionId: string,
    updater: (division: DivisionRecord) => DivisionRecord,
): DivisionRecord | null {
    const found = findDivisionPath(courseId, departmentId, yearId, semesterId, divisionId);
    if (!found) return null;
    const updated = updater(found.division);
    writeCourses(applyDivisionUpdate(found, updated));
    return updated;
}

function applyDivisionUpdate(loc: TreeLocation, updated: DivisionRecord): CourseRecord[] {
    return loc.courses.map(c => c.id !== loc.course.id ? c : {
        ...c,
        departments: c.departments.map(d => d.id !== loc.department.id ? d : {
            ...d,
            years: d.years.map(y => y.id !== loc.year.id ? y : {
                ...y,
                semesters: y.semesters.map(s => s.id !== loc.semester.id ? s : {
                    ...s,
                    divisions: s.divisions.map(dv => dv.id !== loc.division.id ? dv : updated),
                }),
            }),
        }),
    });
}

// ── Tree-wide lookups (for endpoints that only carry a nested id, e.g.
// assignmentId / subjectId / a division's id alone) ─────────────────────────

export function findDivisionById(divisionId: string): TreeLocation | null {
    const courses = readCourses();
    for (const course of courses) {
        for (const department of course.departments) {
            for (const year of department.years) {
                for (const semester of year.semesters) {
                    const division = semester.divisions.find(dv => dv.id === divisionId);
                    if (division) return { courses, course, department, year, semester, division };
                }
            }
        }
    }
    return null;
}

export interface SemesterLocation {
    courses: CourseRecord[]; course: CourseRecord; department: DepartmentRecord; year: YearRecord; semester: SemesterRecord;
}

export function findBySemesterId(semesterId: string): SemesterLocation | null {
    const courses = readCourses();
    for (const course of courses) {
        for (const department of course.departments) {
            for (const year of department.years) {
                const semester = year.semesters.find(s => s.id === semesterId);
                if (semester) return { courses, course, department, year, semester };
            }
        }
    }
    return null;
}

export function findDivisionByAssignmentId(assignmentId: string): TreeLocation | null {
    const courses = readCourses();
    for (const course of courses) {
        for (const department of course.departments) {
            for (const year of department.years) {
                for (const semester of year.semesters) {
                    for (const division of semester.divisions) {
                        if (division.assignments.some(a => a.id === assignmentId)) return { courses, course, department, year, semester, division };
                    }
                }
            }
        }
    }
    return null;
}

export function findDivisionBySubjectId(subjectId: string): TreeLocation | null {
    const courses = readCourses();
    for (const course of courses) {
        for (const department of course.departments) {
            for (const year of department.years) {
                for (const semester of year.semesters) {
                    if (semester.subjects.some(s => s.id === subjectId)) {
                        // Subject lives on the Semester — return the first division as an
                        // anchor so the caller has a valid TreeLocation to work from.
                        const division = semester.divisions[0];
                        if (division) return { courses, course, department, year, semester, division };
                    }
                }
            }
        }
    }
    return null;
}

export function findDivisionByPostId(postId: string): TreeLocation | null {
    const courses = readCourses();
    for (const course of courses) {
        for (const department of course.departments) {
            for (const year of department.years) {
                for (const semester of year.semesters) {
                    for (const division of semester.divisions) {
                        if ((division.posts ?? []).some(p => p.id === postId)) return { courses, course, department, year, semester, division };
                    }
                }
            }
        }
    }
    return null;
}

export function findDivisionByEventId(eventId: string): TreeLocation | null {
    const courses = readCourses();
    for (const course of courses) {
        for (const department of course.departments) {
            for (const year of department.years) {
                for (const semester of year.semesters) {
                    for (const division of semester.divisions) {
                        if ((division.events ?? []).some(e => e.id === eventId)) return { courses, course, department, year, semester, division };
                    }
                }
            }
        }
    }
    return null;
}

export function updateDivisionByLocation(loc: TreeLocation, updater: (d: DivisionRecord) => DivisionRecord): DivisionRecord {
    const updated = updater(loc.division);
    writeCourses(applyDivisionUpdate(loc, updated));
    return updated;
}

// Updates a Semester's subjects (id is the semester id, mirroring how the
// school API treats division.standard.id as the subjects-owner).
export function updateSemesterSubjects(semesterId: string, updater: (subjects: Subject[]) => Subject[]): Subject[] | null {
    const found = findBySemesterId(semesterId);
    if (!found) return null;
    const { courses, course, department, year, semester } = found;
    const newSubjects = updater(semester.subjects);
    const newCourses = courses.map(c => c.id !== course.id ? c : {
        ...c,
        departments: c.departments.map(d => d.id !== department.id ? d : {
            ...d,
            years: d.years.map(y => y.id !== year.id ? y : {
                ...y,
                semesters: y.semesters.map(s => s.id !== semester.id ? s : { ...s, subjects: newSubjects }),
            }),
        }),
    });
    writeCourses(newCourses);
    return newSubjects;
}
