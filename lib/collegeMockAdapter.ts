// Mock backend adapter for College's Department → Year → Division workspace.
//
// The division-workspace UI itself is NOT a rewrite — it's the exact same
// shared components School already uses (DivisionClassPageClient, fees.tsx's
// FeesTab, AttendanceTab, MarksTab). Those files call the real `api` instance
// (lib/api.ts) with real endpoint paths. Since College's Department/Year/
// Division backend doesn't exist yet, this module monkey-patches api.get/
// post/patch/put/delete: when a call's id resolves to something in our
// localStorage mock tree (lib/collegeMock.ts), it's answered locally;
// everything else (real School ids, /admin/teachers, file uploads, auth...)
// passes straight through to the real network call, completely unaffected.
//
// Import this file once, as a side effect, from the College division
// workspace page — School's routes never import it, so School's behavior is
// byte-for-byte unchanged.

import api from './api';
import { assignSubjectColor, colorForSubject } from './subjectColors';
import {
    uid, Assignment, Subject, MockStudent, MockPost, MockCalEvent, PostType, CalEventType,
    FeeDataBlob, FeePaymentRecord,
    findDivisionById, findByYearId, findDivisionByAssignmentId, findDivisionBySubjectId,
    findDivisionByPostId, findDivisionByEventId, updateDivisionByLocation, updateYearSubjects,
    makeMockStudent,
} from './collegeMock';

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

function currentAuthor(): { id: string; name: string; role: string; avatarUrl?: string | null; prefix?: string | null; title?: string | null } {
    try {
        const raw = window.localStorage.getItem('auth-storage');
        const user = raw ? JSON.parse(raw)?.state?.user : null;
        if (user) {
            return { id: user.id ?? 'admin', name: user.name ?? 'Admin', role: user.role ?? 'ADMIN', avatarUrl: user.avatarUrl ?? null, prefix: user.prefix ?? null, title: user.title ?? null };
        }
    } catch { /* ignore */ }
    return { id: 'admin', name: 'Admin', role: 'ADMIN' };
}

function fakeAxiosResponse<T>(data: T, status: number, config?: unknown) {
    const validate = (config as { validateStatus?: (s: number) => boolean } | undefined)?.validateStatus ?? ((s: number) => s >= 200 && s < 300);
    const response = { data: { data }, status, statusText: status === 200 ? 'OK' : 'Not Found', headers: {}, config: (config ?? {}) as never };
    if (validate(status)) return Promise.resolve(response);
    const err = new Error(`Request failed with status code ${status}`) as Error & { response?: unknown; isAxiosError?: boolean };
    err.response = response;
    err.isAxiosError = true;
    return Promise.reject(err);
}

function fakeError(status: number, message: string) {
    const response = { data: { message }, status, statusText: 'Error', headers: {}, config: {} as never };
    const err = new Error(message) as Error & { response?: unknown; isAxiosError?: boolean };
    err.response = response;
    err.isAxiosError = true;
    return Promise.reject(err);
}

function toAssignment(subjectId: string | null, subjects: Subject[], teacher: { id: string; name: string; prefix?: string | null; avatarUrl?: string | null }): Assignment {
    const subject = subjectId ? subjects.find(s => s.id === subjectId) ?? null : null;
    return {
        id: uid(),
        subjectId,
        teacher: { id: teacher.id, prefix: teacher.prefix ?? null, avatarUrl: teacher.avatarUrl ?? null, user: { id: teacher.id, name: teacher.name } },
        subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null,
    };
}

// ── Route matchers ───────────────────────────────────────────────────────────

const RE = {
    division: /^\/admin\/campus\/divisions\/([^/]+)$/,
    students: /^\/admin\/campus\/divisions\/([^/]+)\/students$/,
    studentStats: /^\/admin\/campus\/divisions\/([^/]+)\/students\/([^/]+)\/stats$/,
    studentOne: /^\/admin\/campus\/divisions\/([^/]+)\/students\/([^/]+)$/,
    divSubject: /^\/admin\/campus\/divisions\/([^/]+)\/subjects\/([^/]+)$/,
    leaderboard: /^\/admin\/campus\/divisions\/([^/]+)\/leaderboard$/,
    assign: /^\/admin\/campus\/divisions\/([^/]+)\/assign$/,
    assignment: /^\/admin\/campus\/assignments\/([^/]+)$/,
    standardSubjects: /^\/admin\/campus\/standards\/([^/]+)\/subjects$/,
    subject: /^\/admin\/campus\/subjects\/([^/]+)$/,
    feedPosts: /^\/admin\/campus\/feed\/posts$/,
    feedPost: /^\/admin\/campus\/feed\/posts\/([^/]+)$/,
    feedEvents: /^\/admin\/campus\/feed\/events$/,
    feedEvent: /^\/admin\/campus\/feed\/events\/([^/]+)$/,
    feeStructure: /^\/admin\/campus\/divisions\/([^/]+)\/fee-structure$/,
    feePayments: /^\/admin\/campus\/divisions\/([^/]+)\/fee-payments$/,
    attMonthly: /^\/admin\/campus\/divisions\/([^/]+)\/attendance\/monthly$/,
    attSummary: /^\/admin\/campus\/divisions\/([^/]+)\/attendance\/summary$/,
    attDaily: /^\/admin\/campus\/divisions\/([^/]+)\/attendance\/daily$/,
    attHolidays: /^\/admin\/campus\/divisions\/([^/]+)\/attendance\/holidays$/,
    attStudentRecords: /^\/admin\/campus\/divisions\/([^/]+)\/attendance\/student-records\/([^/]+)$/,
    marksheet: /^\/admin\/marksheet\/division\/([^/]+)$/,
    teacherClassStudents: /^\/teacher\/classes\/([^/]+)\/students$/,
};

const EMPTY_FEE_DATA: FeeDataBlob = {
    feeStructures: [], feeMonths: [], bankDetails: null, qrImageUrl: null, extraColumns: [],
    studentFields: [], generalRemark: null, feeCardTheme: 'yellow', schoolLogoUrl: null, schoolName: null,
};

// ── Core dispatcher ───────────────────────────────────────────────────────────
// Returns a Promise (mock handled) or `null` (not a mock route / not our id —
// caller should pass through to the real network).

function handle(method: Method, url: string, body: unknown, params: Record<string, unknown> | undefined, config: unknown): Promise<unknown> | null {
    let m: RegExpMatchArray | null;

    // GET /admin/campus/divisions/:id
    if (method === 'get' && (m = url.match(RE.division))) {
        const loc = findDivisionById(m[1]);
        if (!loc) return null;
        const { department, year, division } = loc;
        return fakeAxiosResponse({
            id: division.id, name: division.name, capacity: division.capacity,
            standard: { id: year.id, name: `${department.name} · ${year.name}`, subjects: year.subjects },
            divisionSubjects: division.divisionSubjects, assignments: division.assignments,
        }, 200, config);
    }

    // GET /admin/campus/divisions/:id/students
    if (method === 'get' && (m = url.match(RE.students))) {
        const loc = findDivisionById(m[1]);
        if (!loc) return null;
        return fakeAxiosResponse(loc.division.students ?? [], 200, config);
    }

    // GET .../students/:studentId/stats
    if (method === 'get' && (m = url.match(RE.studentStats))) {
        const loc = findDivisionById(m[1]);
        if (!loc) return null;
        return fakeAxiosResponse({ attendance: { present: 0, total: 0, pct: null }, score: { pct: null }, classRank: null }, 200, config);
    }

    // PATCH .../students/:studentId
    if (method === 'patch' && (m = url.match(RE.studentOne)) && !RE.studentStats.test(url)) {
        const loc = findDivisionById(m[1]);
        if (!loc) return null;
        const studentId = m[2];
        const patch = (body ?? {}) as Partial<MockStudent>;
        let updatedStudent: MockStudent | undefined;
        updateDivisionByLocation(loc, d => {
            const students = (d.students ?? []).map(s => {
                if (s.id !== studentId) return s;
                updatedStudent = { ...s, ...patch };
                return updatedStudent;
            });
            return { ...d, students };
        });
        return fakeAxiosResponse(updatedStudent ?? {}, 200, config);
    }

    // POST/DELETE .../subjects/:subId  (toggle division subject membership)
    if ((m = url.match(RE.divSubject))) {
        const loc = findDivisionById(m[1]);
        if (!loc) return null;
        const subjectId = m[2];
        if (method === 'post') {
            updateDivisionByLocation(loc, d => ({ ...d, divisionSubjects: [...d.divisionSubjects.filter(ds => ds.subjectId !== subjectId), { subjectId }] }));
            return fakeAxiosResponse({}, 200, config);
        }
        if (method === 'delete') {
            updateDivisionByLocation(loc, d => ({
                ...d,
                divisionSubjects: d.divisionSubjects.filter(ds => ds.subjectId !== subjectId),
                assignments: d.assignments.filter(a => a.subjectId !== subjectId),
            }));
            return fakeAxiosResponse({}, 200, config);
        }
    }

    // GET .../leaderboard
    if (method === 'get' && (m = url.match(RE.leaderboard))) {
        const loc = findDivisionById(m[1]);
        if (!loc) return null;
        return fakeAxiosResponse([], 200, config);
    }

    // POST .../assign
    if (method === 'post' && (m = url.match(RE.assign))) {
        const loc = findDivisionById(m[1]);
        if (!loc) return null;
        const { teacherId, subjectId } = (body ?? {}) as { teacherId: string; subjectId: string | null };
        return api.get('/admin/teachers').then(res => {
            const teachers: { id: string; name: string; prefix?: string | null; avatarUrl?: string | null }[] = res.data?.data ?? [];
            const teacher = teachers.find(t => t.id === teacherId);
            if (!teacher) return fakeError(400, 'Teacher not found');
            const assignment = toAssignment(subjectId, loc.year.subjects, teacher);
            updateDivisionByLocation(loc, d => ({
                ...d,
                assignments: [...d.assignments.filter(a => (subjectId !== null ? a.subjectId !== subjectId : a.subjectId !== null)), assignment],
            }));
            return fakeAxiosResponse(assignment, 200, config);
        });
    }

    // DELETE /admin/campus/assignments/:id
    if (method === 'delete' && (m = url.match(RE.assignment))) {
        const loc = findDivisionByAssignmentId(m[1]);
        if (!loc) return null;
        updateDivisionByLocation(loc, d => ({ ...d, assignments: d.assignments.filter(a => a.id !== m![1]) }));
        return fakeAxiosResponse({}, 200, config);
    }

    // POST /admin/campus/standards/:id/subjects  (id = our Year id)
    if (method === 'post' && (m = url.match(RE.standardSubjects))) {
        const found = findByYearId(m[1]);
        if (!found) return null;
        const { name } = (body ?? {}) as { name: string };
        let newSubject: Subject | undefined;
        updateYearSubjects(m[1], subjects => {
            newSubject = { id: uid(), name, code: null, color: assignSubjectColor(subjects.length), order: subjects.length };
            return [...subjects, newSubject];
        });
        return fakeAxiosResponse(newSubject, 200, config);
    }

    // DELETE /admin/campus/subjects/:id
    if (method === 'delete' && (m = url.match(RE.subject))) {
        const found = findDivisionBySubjectId(m[1]);
        if (!found) return null;
        const subjectId = m[1];
        updateYearSubjects(found.year.id, subjects => subjects.filter(s => s.id !== subjectId));
        // Also strip it out of every division under this year (real backend cascades this too).
        found.year.divisions.forEach(dv => {
            updateDivisionByLocation({ ...found, division: dv }, d => ({
                ...d,
                divisionSubjects: d.divisionSubjects.filter(ds => ds.subjectId !== subjectId),
                assignments: d.assignments.filter(a => a.subjectId !== subjectId),
            }));
        });
        return fakeAxiosResponse({}, 200, config);
    }

    // GET /admin/campus/feed/posts?divisionId=
    if (method === 'get' && url === '/admin/campus/feed/posts') {
        const divisionId = params?.divisionId as string | undefined;
        if (!divisionId) return null;
        const loc = findDivisionById(divisionId);
        if (!loc) return null;
        return fakeAxiosResponse(loc.division.posts ?? [], 200, config);
    }

    // POST /admin/campus/feed/posts
    if (method === 'post' && url === '/admin/campus/feed/posts') {
        const b = (body ?? {}) as { type: string; title: string; body: string; subject?: string; divisionId: string; attachmentUrl?: string; attachmentType?: string; attachmentName?: string };
        const loc = findDivisionById(b.divisionId);
        if (!loc) return null;
        const post: MockPost = {
            id: uid(), type: (b.type ?? 'ANNOUNCEMENT').toLowerCase() as PostType, title: b.title, body: b.body ?? '',
            subject: b.subject ?? null, divisionId: b.divisionId,
            attachmentUrl: b.attachmentUrl ?? null, attachmentType: b.attachmentType ?? null, attachmentName: b.attachmentName ?? null,
            createdAt: new Date().toISOString(), author: currentAuthor(),
        };
        updateDivisionByLocation(loc, d => ({ ...d, posts: [post, ...(d.posts ?? [])] }));
        return fakeAxiosResponse(post, 200, config);
    }

    // DELETE /admin/campus/feed/posts/:id
    if (method === 'delete' && (m = url.match(RE.feedPost))) {
        const loc = findDivisionByPostId(m[1]);
        if (!loc) return null;
        updateDivisionByLocation(loc, d => ({ ...d, posts: (d.posts ?? []).filter(p => p.id !== m![1]) }));
        return fakeAxiosResponse({}, 200, config);
    }

    // GET /admin/campus/feed/events?year&month&divisionId
    if (method === 'get' && url === '/admin/campus/feed/events') {
        const divisionId = params?.divisionId as string | undefined;
        if (!divisionId) return null;
        const loc = findDivisionById(divisionId);
        if (!loc) return null;
        const year = Number(params?.year);
        const month = Number(params?.month);
        const events = (loc.division.events ?? []).filter(e => e.year === year && e.month === month);
        return fakeAxiosResponse(events, 200, config);
    }

    // POST /admin/campus/feed/events
    if (method === 'post' && url === '/admin/campus/feed/events') {
        const b = (body ?? {}) as { type: string; label: string; date: string; divisionId: string };
        const loc = findDivisionById(b.divisionId);
        if (!loc) return null;
        const d = new Date(b.date);
        const ev: MockCalEvent = { id: uid(), date: d.getUTCDate(), year: d.getUTCFullYear(), month: d.getUTCMonth(), type: (b.type ?? 'EVENT').toLowerCase() as CalEventType, label: b.label };
        updateDivisionByLocation(loc, div => ({ ...div, events: [...(div.events ?? []), ev] }));
        return fakeAxiosResponse(ev, 200, config);
    }

    // DELETE /admin/campus/feed/events/:id
    if (method === 'delete' && (m = url.match(RE.feedEvent))) {
        const loc = findDivisionByEventId(m[1]);
        if (!loc) return null;
        updateDivisionByLocation(loc, d => ({ ...d, events: (d.events ?? []).filter(e => e.id !== m![1]) }));
        return fakeAxiosResponse({}, 200, config);
    }

    // GET/PUT .../fee-structure
    if ((m = url.match(RE.feeStructure))) {
        const loc = findDivisionById(m[1]);
        if (!loc) return null;
        if (method === 'get') return fakeAxiosResponse(loc.division.feeData ?? EMPTY_FEE_DATA, 200, config);
        if (method === 'put') {
            const b = (body ?? {}) as Partial<FeeDataBlob>;
            updateDivisionByLocation(loc, d => ({ ...d, feeData: { ...EMPTY_FEE_DATA, ...(d.feeData ?? {}), ...b } as FeeDataBlob }));
            return fakeAxiosResponse({}, 200, config);
        }
    }

    // GET/PATCH .../fee-payments
    if ((m = url.match(RE.feePayments))) {
        const loc = findDivisionById(m[1]);
        if (!loc) return null;
        if (method === 'get') return fakeAxiosResponse(loc.division.feePayments ?? [], 200, config);
        if (method === 'patch') {
            const b = (body ?? {}) as FeePaymentRecord;
            let saved: FeePaymentRecord = b;
            updateDivisionByLocation(loc, d => {
                const existing = d.feePayments ?? [];
                const idx = existing.findIndex(p => p.studentId === b.studentId && p.feeMonthId === b.feeMonthId);
                saved = { studentId: b.studentId, feeMonthId: b.feeMonthId, status: b.status, paidDate: b.paidDate ?? null, remark: b.remark ?? null };
                const next = idx === -1 ? [...existing, saved] : existing.map((p, i) => i === idx ? saved : p);
                return { ...d, feePayments: next };
            });
            return fakeAxiosResponse(saved, 200, config);
        }
    }

    // Attendance — admin view is read-only (no writes happen from this UI), so
    // every endpoint just needs to answer with a valid, empty/zeroed shape.
    if (method === 'get' && (m = url.match(RE.attMonthly))) {
        if (!findDivisionById(m[1])) return null;
        return fakeAxiosResponse({ records: [] }, 200, config);
    }
    if (method === 'get' && (m = url.match(RE.attSummary))) {
        if (!findDivisionById(m[1])) return null;
        return fakeAxiosResponse({ students: [], classStats: { overallPct: null, currentMonthPct: null, monthlyStats: [] } }, 200, config);
    }
    if (method === 'get' && (m = url.match(RE.attDaily))) {
        if (!findDivisionById(m[1])) return null;
        return fakeAxiosResponse({ records: [], dateNote: null }, 200, config);
    }
    if (method === 'get' && (m = url.match(RE.attHolidays))) {
        if (!findDivisionById(m[1])) return null;
        return fakeAxiosResponse([], 200, config);
    }
    if (method === 'get' && (m = url.match(RE.attStudentRecords))) {
        if (!findDivisionById(m[1])) return null;
        return fakeAxiosResponse({ records: [] }, 200, config);
    }

    // GET /admin/marksheet/division/:id — nothing published yet for any
    // College division, so this always 404s (the real "not initialised" state).
    if (method === 'get' && (m = url.match(RE.marksheet))) {
        if (!findDivisionById(m[1])) return null;
        return fakeAxiosResponse(null, 404, config);
    }

    // GET /teacher/classes/:id/students — marksheet's fallback student list
    // when no marksheet exists yet.
    if (method === 'get' && (m = url.match(RE.teacherClassStudents))) {
        const loc = findDivisionById(m[1]);
        if (!loc) return null;
        const students = (loc.division.students ?? []).map(s => ({ id: s.id, rollNo: s.rollNo ?? '', user: { name: s.user.name } }));
        return fakeAxiosResponse(students, 200, config);
    }

    return null;
}

// ── Monkey-patch api.get/post/patch/put/delete ────────────────────────────────
// Only patches once even if this module is imported from multiple places.

interface PatchableApi {
    get: typeof api.get; post: typeof api.post; patch: typeof api.patch; put: typeof api.put; delete: typeof api.delete;
    __collegeMockPatched?: boolean;
}
const apiAny = api as unknown as PatchableApi;

if (typeof window !== 'undefined' && !apiAny.__collegeMockPatched) {
    apiAny.__collegeMockPatched = true;
    const originalGet = api.get.bind(api);
    const originalPost = api.post.bind(api);
    const originalPatch = api.patch.bind(api);
    const originalPut = api.put.bind(api);
    const originalDelete = api.delete.bind(api);

    apiAny.get = ((url: string, config?: { params?: Record<string, unknown> }) => {
        const mocked = handle('get', url, undefined, config?.params, config);
        return mocked ?? originalGet(url, config);
    }) as typeof api.get;

    apiAny.post = ((url: string, body?: unknown, config?: unknown) => {
        // FormData (file uploads) never come from our mock tree — always real.
        if (typeof FormData !== 'undefined' && body instanceof FormData) return originalPost(url, body, config);
        const mocked = handle('post', url, body, undefined, config);
        return mocked ?? originalPost(url, body, config);
    }) as typeof api.post;

    apiAny.patch = ((url: string, body?: unknown, config?: unknown) => {
        const mocked = handle('patch', url, body, undefined, config);
        return mocked ?? originalPatch(url, body, config);
    }) as typeof api.patch;

    apiAny.put = ((url: string, body?: unknown, config?: unknown) => {
        const mocked = handle('put', url, body, undefined, config);
        return mocked ?? originalPut(url, body, config);
    }) as typeof api.put;

    apiAny.delete = ((url: string, config?: unknown) => {
        const mocked = handle('delete', url, undefined, undefined, config);
        return mocked ?? originalDelete(url, config);
    }) as typeof api.delete;
}

// Re-exported so pages that need to seed demo students can reuse the same helper.
export { makeMockStudent, colorForSubject };
