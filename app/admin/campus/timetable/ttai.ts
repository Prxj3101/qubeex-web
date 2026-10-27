import type { Slot, TimetableStatus } from '@/lib/timetable';

// Shapes of the AI Timetable endpoints (/admin/timetable/ai/*) and small helpers.

export interface WsDivision { id: string; name: string; label: string; status: TimetableStatus }
export interface WsStandard { id: string; name: string; order: number; divisions: WsDivision[] }
export interface WsEntry { id: string; divisionId: string; dayOfWeek: number; slotId: string; sessionTypeId: string; subjectId: string | null; title: string | null; teacherId: string | null; roomId: string | null; isLocked: boolean; configId?: string | null; groupId?: string | null }
export interface WsConfig { id: string; divisionId: string; subjectId: string | null; sessionTypeId: string; title: string | null; periodsPerWeek: number; teacherId: string | null; ownTeacher: boolean; span: number; roomType: string | null }
export interface WsRoom { id: string; name: string; type: string; isActive: boolean }
export interface Workspace {
    year: { id: string; label: string; writable: boolean };
    workingDays: number[];
    slots: Slot[];
    sessionTypes: { id: string; name: string; kind: string; color: string | null; requiresTeacher: boolean }[];
    rooms: WsRoom[];
    teachers: { id: string; name: string }[];
    standards: WsStandard[];
    subjects: { id: string; name: string; standardId: string; color: string | null; order: number }[];
    divisionSubjects: { divisionId: string; subjectId: string }[];
    assignments: { divisionId: string; subjectId: string | null; teacherId: string }[];
    configs: WsConfig[];
    entries: WsEntry[];
    unavailable: { teacherId: string; dayOfWeek: number; slotId: string }[];
    teacherPrefs: { teacherId: string; maxPeriodsPerDay: number | null; maxConsecutive: number | null; maxPeriodsPerWeek: number | null }[];
    conflicts: { type: string; message: string }[];
    conflictCount: number;
}

export interface Suggestion {
    periodsPerWeek: number;
    standards: {
        standardId: string; name: string; saved: boolean;
        items: { subjectId: string; name: string; periodsPerWeek: number; doubles: number; lab: SubjectLab | null }[];
        activities: Activity[];
    }[];
}

/** Some periods of a subject in a lab (the rest are in the class's own room). */
export interface SubjectLab { roomType: string; periodsPerWeek: number; doubles: number }
export interface Activity { title: string; periodsPerWeek: number; teacherId: string | null; roomType: string | null }

export interface GenResult { divisionId: string; divisionName: string; complete: boolean; placed: number; unplaced: number; problems: string[] }

/** A confirmed AI step, sent back as it came (the server checks it again). */
export type PlanAction = Record<string, unknown> & { type: string };
export interface ChatTurn {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    steps?: string[];
    actions?: PlanAction[];
    state?: 'open' | 'applying' | 'applied' | 'undone' | 'skipped';
    undo?: Snapshot;
    /** When it was said (ms). */
    at?: number;
}
export type Snapshot = { divisionId: string; entries: WsEntry[] }[];

export const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const hhmm = (m: number) => {
    const h = Math.floor(m / 60), mm = m % 60;
    return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

// Soft, distinct colours per subject (same subject name = same colour across classes).
const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#06B6D4', '#D946EF', '#0EA5E9', '#A855F7'];
export function colorFor(name: string, own?: string | null): string {
    if (own && /^#[0-9a-f]{6}$/i.test(own)) return own;
    let h = 0;
    for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
}

/** How healthy the timetable is (0-100) and why. Simple rules a school understands. */
/**
 * How healthy the timetable is (0-100) and exactly why, in plain words:
 * missing periods and clashes cost the most; a teacher with more than 4 periods in a row (-3 each)
 * or with a very busy and a very light day (-2 each) costs a little.
 */
export function health(ws: Workspace): { score: number; notes: string[]; placed: number; required: number } {
    const notes: string[] = [];
    const required = ws.configs.reduce((n, c) => n + c.periodsPerWeek, 0);
    const placed = ws.entries.filter(e => ws.slots.find(s => s.id === e.slotId)?.kind === 'PERIOD').length;
    let score = 100;
    if (required > 0 && placed < required) {
        const miss = required - Math.min(placed, required);
        const cost = Math.min(40, Math.round((miss / required) * 100));
        score -= cost;
        notes.push(`${miss} period${miss === 1 ? '' : 's'} could not be placed (-${cost})`);
    }
    if (ws.conflictCount) { const cost = Math.min(30, ws.conflictCount * 5); score -= cost; notes.push(`${ws.conflictCount} clash${ws.conflictCount === 1 ? '' : 'es'} to fix (-${cost})`); }
    const periodOrder = new Map(ws.slots.filter(s => s.kind === 'PERIOD').map((s, i) => [s.id, i]));
    let runCost = 0, unevenCost = 0;
    for (const t of ws.teachers) {
        const mine = ws.entries.filter(e => e.teacherId === t.id);
        if (!mine.length) continue;
        const perDay = ws.workingDays.map(d => ({ d, list: mine.filter(e => e.dayOfWeek === d).map(e => periodOrder.get(e.slotId) ?? -9).sort((a, b) => a - b) }));
        // Longest run of periods in a row, and on which day.
        let worst = { run: 0, d: 0 };
        for (const { d, list } of perDay) {
            let run = list.length ? 1 : 0;
            for (let i = 1; i < list.length; i++) { run = list[i] === list[i - 1] + 1 ? run + 1 : 1; if (run > worst.run) worst = { run, d }; }
            if (run > worst.run) worst = { run, d };
        }
        if (worst.run > 4 && runCost < 15) { runCost += 3; notes.push(`${t.name} teaches ${worst.run} periods in a row on ${DAY_SHORT[worst.d]} (-3)`); }
        const busiest = perDay.reduce((a, b) => (b.list.length > a.list.length ? b : a));
        const lightest = perDay.reduce((a, b) => (b.list.length < a.list.length ? b : a));
        if (busiest.list.length - lightest.list.length >= 4 && unevenCost < 10) {
            unevenCost += 2;
            notes.push(`${t.name} has ${busiest.list.length} periods on ${DAY_SHORT[busiest.d]} but ${lightest.list.length} on ${DAY_SHORT[lightest.d]} (-2)`);
        }
    }
    score -= runCost + unevenCost;
    if (!notes.length && placed) notes.push('Every period is placed, no clashes, teachers well spread');
    return { score: Math.max(0, Math.min(100, score)), notes, placed, required };
}

/** Room kinds a school can add (stored as the room's type). */
export const ROOM_KINDS = ['Science lab', 'Computer lab', 'Library', 'Ground', 'Music room', 'Art room'] as const;
export const roomTypeOf = (label: string) => label.trim().toUpperCase();
export const roomKindLabel = (type: string) => type.charAt(0) + type.slice(1).toLowerCase();

/** Name shown for a period (subject, else its title, else the session type). */
export function entryName(ws: Workspace, e: WsEntry): string {
    const sub = e.subjectId ? ws.subjects.find(s => s.id === e.subjectId) : undefined;
    return sub?.name ?? e.title ?? ws.sessionTypes.find(t => t.id === e.sessionTypeId)?.name ?? 'Period';
}
export function entryColor(ws: Workspace, e: WsEntry): string {
    const sub = e.subjectId ? ws.subjects.find(s => s.id === e.subjectId) : undefined;
    return colorFor(entryName(ws, e), sub?.color);
}
export const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** 1 = Monday ... 7 = Sunday, for a yyyy-mm-dd date. */
export const dowOfIso = (iso: string) => { const d = new Date(`${iso}T00:00:00`).getDay(); return d === 0 ? 7 : d; };
