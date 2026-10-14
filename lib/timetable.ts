import api from '@/lib/api';

// ── Types (mirror the backend payloads) ───────────────────────────────────────

export type SlotKind = 'PERIOD' | 'BREAK' | 'LUNCH' | 'ASSEMBLY' | 'ACTIVITY';
export type TimetableStatus = 'DRAFT' | 'GENERATED' | 'UNDER_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface Slot { id: string; name: string; order: number; startMinute: number; endMinute: number; kind: SlotKind }
export interface SessionType {
    id: string; name: string; kind: string; requiresTeacher: boolean; requiresRoom: boolean;
    roomType: string | null; defaultSpan: number; color: string | null; isActive: boolean;
}
export interface Room { id: string; name: string; type: string; isActive: boolean; capacity: number | null }
export interface TeacherLite { id: string; name: string }
export interface SubjectLite { id: string; name: string; color: string | null; defaultTeacherId: string | null }

export interface Entry {
    id: string; divisionId: string; dayOfWeek: number; slotId: string;
    sessionTypeId: string; sessionTypeName: string; sessionKind: string; color: string | null;
    subjectId: string | null; subjectName: string | null; title: string | null;
    teacherId: string | null; teacherName: string | null; roomId: string | null; roomName: string | null;
    configId: string | null; groupId: string | null; isLocked: boolean;
    divisionName?: string; timetableStatus?: TimetableStatus | null;
}

/** A re-creatable description of a session — used by the server for undo (restore) and returned by clear/bulk-delete. */
export interface EntrySnapshot {
    dayOfWeek: number; slotId: string; sessionTypeId: string; subjectId: string | null; title: string | null;
    teacherId: string | null; roomId: string | null; configId: string | null; groupKey: string | null; isLocked: boolean;
}

export const snapshotOf = (e: Entry): EntrySnapshot => ({
    dayOfWeek: e.dayOfWeek, slotId: e.slotId, sessionTypeId: e.sessionTypeId, subjectId: e.subjectId, title: e.title,
    teacherId: e.teacherId, roomId: e.roomId, configId: e.configId, groupKey: e.groupId, isLocked: e.isLocked,
});

/** One reversible editing step; the Studio keeps a stack of these for the Undo button. */
export interface UndoAction { label: string; run: () => Promise<void> }

export interface Conflict {
    type: string; severity: 'ERROR' | 'WARNING'; message: string; divisionId?: string;
    entryIds: string[]; cells: { divisionId: string; dayOfWeek: number; slotId: string }[];
    teacherId?: string; roomId?: string; configId?: string;
}

export interface Requirement { configId: string; label: string; required: number; scheduled: number; status: 'COMPLETE' | 'INCOMPLETE' | 'EXCEEDED' }

export interface ConfigRow {
    id?: string; subjectId: string | null; sessionTypeId: string; title: string | null;
    periodsPerWeek: number; span: number; maxPerDay: number;
    teacherId: string | null; roomId: string | null; roomType: string | null;
    subjectName?: string | null; resolvedTeacherId?: string | null; resolvedTeacherName?: string | null; label?: string;
}

export interface StudioData {
    academicYear: { id: string; label: string; status: string; isCurrent: boolean };
    writable: boolean;
    division: { id: string; name: string; standardId: string; standardName: string; classTeacherId: string | null };
    siblings: { id: string; label: string }[];   // the other sections of this class
    timetable: { id: string; status: TimetableStatus; generatedAt: string | null; publishedAt: string | null } | null;
    workingDays: number[]; slots: Slot[]; entries: Entry[]; configs: ConfigRow[]; requirements: Requirement[]; conflicts: Conflict[];
    subjects: SubjectLite[]; sessionTypes: SessionType[]; rooms: Room[]; teachers: TeacherLite[];
    lastGeneration: { complete: boolean; placed: number; unplaced: number; problems: string[]; createdAt: string } | null;
}

export interface SetupData {
    academicYear: { id: string; label: string; status: string; isCurrent: boolean };
    writable: boolean; configured: boolean; workingDays: number[]; slots: Slot[];
    sessionTypes: SessionType[]; rooms: Room[]; teachers: TeacherLite[]; subjects: { id: string; name: string }[];
    teacherPrefs: { teacherId: string; maxPeriodsPerDay: number | null; maxConsecutive: number | null; maxPeriodsPerWeek: number | null }[];
}

/** A session of another, still-unpublished section that was moved so the section being generated could be filled. */
export interface RearrangedItem { divisionId: string; divisionName: string; subject: string; from: string; to: string }

export interface GeneratePublishResult {
    divisionId: string; divisionName: string; outcome: 'PUBLISHED' | 'NEEDS_ATTENTION' | 'SKIPPED'; reasons: string[]; placed: number; unplaced: number;
    rearranged?: RearrangedItem[];
}
export interface CopyConfigsResult { divisionId: string; divisionName: string; added: number; updated: number }

export interface OverviewRow {
    divisionId: string; divisionName: string; standardId: string; standardName: string;
    status: TimetableStatus | null; publishedAt: string | null; generatedAt: string | null; entryCount: number;
}

export type SessionStatus = 'NORMAL' | 'CANCELLED' | 'CHANGED' | 'SUBSTITUTED' | 'COVERING' | 'REASSIGNED';
export interface WeekSession {
    date: string; dayOfWeek: number; slotId: string; slotName: string; startMinute: number; endMinute: number;
    divisionId: string; divisionName: string; sessionTypeName: string; sessionKind: string; color: string | null;
    subjectName: string | null; title: string | null; teacherId: string | null; teacherName: string | null; roomName: string | null;
    status: SessionStatus; note: string | null; originalTeacherName: string | null; originalSubjectName: string | null;
}
export interface WeekData {
    published: boolean; academicYear: { id: string; label: string; isCurrent: boolean; status: string };
    weekStart: string; today: string; workingDays: number[]; slots: Slot[];
    days: { date: string; dayOfWeek: number; isWorkingDay: boolean; sessions: WeekSession[] }[];
    current: WeekSession | null; next: WeekSession | null; division?: string;
}

// ── Constants & helpers ───────────────────────────────────────────────────────

/** "10" + "A" → "10-A"; division names that already include the class ("10-A") are not prefixed twice. */
export const classLabel = (standardName: string, divisionName: string): string => {
    const num = standardName.replace(/^class\s*/i, '').trim() || standardName;
    const d = divisionName.trim();
    const low = d.toLowerCase();
    if (low.startsWith(`${num.toLowerCase()}-`) || low.startsWith(`${standardName.toLowerCase()}-`)) return d;
    return `${num}-${d}`;
};

export const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function fmtTime(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
export const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export function fromHHMM(v: string): number {
    const [h, m] = v.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

export const STATUS_LABEL: Record<TimetableStatus, string> = {
    DRAFT: 'Draft', GENERATED: 'Generated', UNDER_REVIEW: 'Under review', PUBLISHED: 'Published', ARCHIVED: 'Archived',
};
export const STATUS_CLASS: Record<TimetableStatus, string> = {
    DRAFT: 'bg-muted text-muted-foreground border-border',
    GENERATED: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
    UNDER_REVIEW: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    PUBLISHED: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    ARCHIVED: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

export const CONFLICT_LABEL: Record<string, string> = {
    TEACHER_CLASH: 'Teacher conflict', ROOM_CLASH: 'Room conflict', TEACHER_UNAVAILABLE: 'Teacher unavailable',
    ROOM_UNAVAILABLE: 'Room unavailable', ROOM_INCOMPATIBLE: 'Wrong room type', NON_TEACHING_SLOT: 'Break/non-teaching slot',
    OUTSIDE_WORKING_DAY: 'Non-working day', PRACTICAL_NOT_CONSECUTIVE: 'Not consecutive', MISSING_TEACHER: 'No teacher',
    MISSING_ROOM: 'No room', TEACHER_OVERLOAD: 'Teacher overload', REQUIREMENT_SHORTFALL: 'Periods missing',
};

export function errMsg(e: unknown, fallback = 'Something went wrong'): string {
    const r = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
    return r?.error ?? r?.message ?? fallback;
}
export function conflictsFromError(e: unknown): Conflict[] | null {
    const r = (e as { response?: { status?: number; data?: { conflicts?: Conflict[] } } })?.response;
    return r?.status === 409 && r.data?.conflicts?.length ? r.data.conflicts : null;
}

export const yearParams = (academicYearId: string | null | undefined) => (academicYearId ? { academicYearId } : {});

// ── API ───────────────────────────────────────────────────────────────────────

const A = '/admin/timetable';
type Y = string | null | undefined;
const unwrap = <T,>(p: Promise<{ data: { data: T } }>) => p.then(r => r.data.data);

export const ttApi = {
    setup: (y: Y) => unwrap<SetupData>(api.get(`${A}/setup`, { params: yearParams(y) })),
    overview: (y: Y) => unwrap<OverviewRow[]>(api.get(`${A}/overview`, { params: yearParams(y) })),
    studio: (y: Y, divisionId: string) => unwrap<StudioData>(api.get(`${A}/divisions/${divisionId}`, { params: yearParams(y) })),
    conflicts: (y: Y, divisionId?: string) => unwrap<Conflict[]>(api.get(`${A}/conflicts`, { params: { ...yearParams(y), divisionId } })),
    view: (y: Y, kind: 'teacher' | 'room' | 'subject' | 'master', id?: string, standardId?: string) =>
        unwrap<{ title: string; kind: string; workingDays: number[]; slots: Slot[]; entries: Entry[]; summary: { totalPeriods: number; perDay: { dayOfWeek: number; count: number }[]; divisions: number } }>(
            api.get(`${A}/views/${kind}${id ? `/${id}` : ''}`, { params: { ...yearParams(y), standardId } })),
    post: <T,>(path: string, y: Y, body?: unknown) => unwrap<T>(api.post(`${A}${path}`, body ?? {}, { params: yearParams(y) })),
    put: <T,>(path: string, y: Y, body?: unknown) => unwrap<T>(api.put(`${A}${path}`, body ?? {}, { params: yearParams(y) })),
    patch: <T,>(path: string, y: Y, body?: unknown) => unwrap<T>(api.patch(`${A}${path}`, body ?? {}, { params: yearParams(y) })),
    del: <T,>(path: string, y: Y) => unwrap<T>(api.delete(`${A}${path}`, { params: yearParams(y) })),
    get: <T,>(path: string, y: Y, params?: Record<string, unknown>) => unwrap<T>(api.get(`${A}${path}`, { params: { ...yearParams(y), ...params } })),
    exportFile: async (y: Y, kind: 'class' | 'teacher' | 'room' | 'master', format: 'pdf' | 'xlsx', id?: string) => {
        const res = await api.get(`${A}/export/${kind}/${format}`, { params: { ...yearParams(y), id }, responseType: 'blob' });
        const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        const cd = String(res.headers['content-disposition'] ?? '');
        a.href = url;
        a.download = /filename="([^"]+)"/.exec(cd)?.[1] ?? `timetable.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },
};

export const selfApi = {
    week: (role: 'teacher' | 'student', y: Y, date?: string) =>
        unwrap<WeekData>(api.get(`/${role}/timetable/me`, { params: { ...yearParams(y), date } })),
};
