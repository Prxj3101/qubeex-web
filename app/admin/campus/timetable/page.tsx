'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, Bot, Copy, Wrench, RotateCcw, Settings, CalendarDays, Eye, History, Check, CheckCircle2, ChevronRight, DoorOpen, Download, GraduationCap, LayoutGrid, Loader2, Rocket, Shuffle, Sparkles, Sun, Send, Undo2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { conflictsFromError, ttApi } from '@/lib/timetable';
import { useYearParams } from '@/context/AcademicYearContext';
import { useCanManageTimetable } from '@/hooks/useTimetableAccess';
import { scrollStyle } from '@/app/admin/admissions/admissions.types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SchoolDayView, TimetableCanvas, type CellHit } from './TimetableCanvas';
import { PeriodPopover } from './PeriodPopover';
import { DayCard, LabsCard, StepPending, SubjectsCard } from './SetupCards';
import { TodayPanel } from './TodayPanel';
import { health, type ChatTurn, type GenResult, type PlanAction, type Snapshot, type Workspace, type WsEntry } from './ttai';

// AI Timetable: everything about the school's timetable on one page.
// "Year timetable": the week grid on the left (click a period to change it,
// drag to move), the assistant on the right (two quick questions, one Build
// button, then plain-language changes). "Today": absent teachers and special days.

const STEPS = ['Understand', 'Build', 'Improve', 'Publish'] as const;
// Questions that work for any school (no class or teacher names).
const IDEAS = [
    'Which subjects did not get all their periods?',
    'Who has the most periods in a week?',
    'Which teacher has the fewest periods?',
    'Is any teacher overloaded?',
    'No teacher should have more than 4 periods in a row',
    'Keep every teacher to at most 6 periods a day',
    'Which teacher has the busiest day?',
    'How many empty periods does each class have?',
    'Which teachers have free time set?',
    'Is the timetable ready to publish?',
];
const uid = () => Math.random().toString(36).slice(2);
type Mode = 'class' | 'teacher' | 'room' | 'school';
type Tab = 'year' | 'today';
interface Ask { title: string; lines: string[]; confirm: string; danger?: boolean; run: () => void }

/** The school's accent preset (data-theme on <html>), so the always-dark assistant keeps the school's colour. */
const watchTheme = (cb: () => void) => { const o = new MutationObserver(cb); o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); return () => o.disconnect(); };
const readTheme = () => document.documentElement.getAttribute('data-theme') ?? '';

/** A message from the assistant: its avatar on the left, then text and any cards it shows. */
function Agent({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-2.5">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white/85 ring-1 ring-white/[0.08]"><Bot size={14} /></span>
            <div className="min-w-0 flex-1 space-y-2.5">{children}</div>
        </div>
    );
}
const Say = ({ children }: { children: React.ReactNode }) => <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">{children}</p>;

const chip = (on: boolean) => `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:text-foreground'}`;

interface VersionRow { id: string; number: number; label: string; periods: number; createdAt: string }
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function timeAgo(ts: number, now: number): string {
    const sec = Math.max(0, Math.floor((now - ts) / 1000));
    if (sec < 30) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
}

/** Under each chat message, like Jarvis: how long ago, send again (your messages) and copy. */
function MsgMeta({ at, text, onRetry }: { at?: number; text: string; onRetry?: () => void }) {
    const [copied, setCopied] = useState(false);
    // "2m ago" keeps itself current.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(t); }, []);
    const copy = () => { void navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }); };
    return (
        <div className="mt-1 flex items-center gap-1.5 px-1">
            <span className="text-[10px] text-white/30">{timeAgo(at ?? now, now)}</span>
            {onRetry && <button type="button" onClick={onRetry} title="Send again" aria-label="Send again" className="text-white/40 transition-colors hover:text-white/80"><RotateCcw size={12} /></button>}
            <button type="button" onClick={copy} title="Copy" aria-label="Copy" className="text-white/40 transition-colors hover:text-white/80">{copied ? <Check size={12} /> : <Copy size={12} />}</button>
        </div>
    );
}

const urlParam = (k: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(k));

export default function AiTimetablePage() {
    const yp = useYearParams();
    const yearId = yp.academicYearId;
    const params = useMemo(() => {
        const p: Record<string, string> = {};
        if (yearId) p.academicYearId = yearId;
        return p;
    }, [yearId]);
    const canManage = useCanManageTimetable();
    const themeId = useSyncExternalStore(watchTheme, readTheme, () => '');
    const [ws, setWs] = useState<Workspace | null>(null);
    const [error, setError] = useState('');
    const [tab, setTabState] = useState<Tab>(() => (urlParam('tab') === 'today' ? 'today' : 'year'));
    const [mode, setMode] = useState<Mode>('class');
    // Opened from a class page (?division=...) - start on that class.
    const [divisionId, setDivisionId] = useState<string | null>(() => urlParam('division'));
    const [teacherId, setTeacherId] = useState<string | null>(null);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [schoolDay, setSchoolDay] = useState(1);
    const [glow, setGlow] = useState<Set<string>>(new Set());
    const [build, setBuild] = useState<{ done: number; total: number; label: string } | null>(null);
    const [results, setResults] = useState<GenResult[] | null>(null);
    const [editDay, setEditDay] = useState(false);
    const [editSubjects, setEditSubjects] = useState(false);
    const [turns, setTurns] = useState<ChatTurn[]>([]);
    const [draft, setDraft] = useState('');
    const [thinking, setThinking] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [hit, setHit] = useState<CellHit | null>(null);
    const [ask, setAsk] = useState<Ask | null>(null);
    const [clashesOpen, setClashesOpen] = useState(false);
    const [healthOpen, setHealthOpen] = useState(false);
    const [versions, setVersions] = useState<VersionRow[]>([]);
    const [versionsError, setVersionsError] = useState(false);
    const [preview, setPreview] = useState<{ id: string; number: number; label: string; createdAt: string; entries: WsEntry[] } | null>(null);
    const [clearSure, setClearSure] = useState(false);
    /** Where the Setup box sits: null = at the top, a number = after that chat message (the gear moved it there). */
    const [setupAt, setSetupAt] = useState<number | null>(null);
    const setupRef = useRef<HTMLDivElement>(null);
    const bringSetup = () => {
        setEditDay(false); setEditSubjects(false);
        setSetupAt(turns.length ? turns.length - 1 : null);
        window.setTimeout(() => (setupRef.current ?? feed.current)?.scrollIntoView({ behavior: 'smooth', block: turns.length ? 'start' : 'start' }), 60);
    };
    /** Where Build and Publish sit: null = after Setup at the top, a number = after that chat message. */
    const [actionsAt, setActionsAt] = useState<number | null>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const bringActions = () => {
        setActionsAt(turns.length ? turns.length - 1 : null);
        window.setTimeout(() => (actionsRef.current ?? feed.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    };
    const feed = useRef<HTMLDivElement>(null);

    // ── Saved chat and versions (kept on the server for this academic year) ──
    const saveMsg = useCallback(async (role: 'user' | 'assistant', text: string, data?: Record<string, unknown>) => {
        try { return (await api.post('/admin/timetable/ai/messages', { role, text: text.slice(0, 4000), data: data ?? null }, { params })).data.data.id as string; }
        catch { return uid(); }
    }, [params]);
    const patchMsg = (id: string, data: Record<string, unknown>) => { void api.patch(`/admin/timetable/ai/messages/${id}`, { data }, { params }).catch(() => undefined); };
    /** A note from the assistant, saved with the chat. */
    const say = async (text: string) => { const id = await saveMsg('assistant', text); setTurns(t => [...t, { id, role: 'assistant', text, at: Date.now() }]); };
    const loadVersions = useCallback(async () => {
        try { setVersions((await api.get('/admin/timetable/ai/versions', { params })).data.data); setVersionsError(false); } catch { setVersionsError(true); }
    }, [params]);
    /** Saves the timetable as it is now (the server skips it if nothing changed). */
    const snapshot = useCallback(async (label: string) => {
        try { await api.post('/admin/timetable/ai/versions', { label }, { params }); await loadVersions(); } catch { /* never block the work */ }
    }, [params, loadVersions]);
    useEffect(() => {
        const t = window.setTimeout(async () => {
            try {
                const rows = (await api.get('/admin/timetable/ai/messages', { params })).data.data as { id: string; role: 'user' | 'assistant'; text: string; data: Partial<ChatTurn> | null; createdAt: string }[];
                setTurns(rows.map(m => ({ ...(m.data ?? {}), id: m.id, role: m.role, text: m.text, at: Date.parse(m.createdAt) || Date.now(), ...(m.data?.state === 'applying' ? { state: 'open' as const } : {}) })));
            } catch { /* start with an empty chat */ }
            void loadVersions();
        }, 0);
        return () => window.clearTimeout(t);
    }, [params, loadVersions]);

    const clearChat = async () => {
        try { await api.delete('/admin/timetable/ai/messages', { params }); setTurns([]); setClearSure(false); setSetupAt(null); setActionsAt(null); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not clear the chat')); }
    };

    const openVersion = async (id: string) => {
        try {
            const v = (await api.get(`/admin/timetable/ai/versions/${id}`, { params })).data.data as { id: string; number: number; label: string; createdAt: string; entries: Omit<WsEntry, 'id'>[] };
            setHit(null);
            setPreview({ ...v, entries: v.entries.map((e, i) => ({ ...e, id: `v${v.number}-${i}` })) });
        } catch (err) { toast.error(getErrorMessage(err, 'Could not open that version')); }
    };
    const applyVersion = () => {
        if (!preview) return;
        const v = preview;
        setAsk({
            title: `Go back to version ${v.number}?`,
            lines: ['The timetable will be exactly like this version again.', 'The current one is saved as a version first, so you can come back to it.', ...(withConfigs.some(d => d.status === 'PUBLISHED') ? ['Published sections go back to draft until you publish again.'] : [])],
            confirm: 'Use this version',
            run: async () => {
                try {
                    await snapshot('Before going back');
                    const out = (await api.post(`/admin/timetable/ai/versions/${v.id}/restore`, {}, { params })).data.data as { skipped: number };
                    setPreview(null);
                    await load();
                    await loadVersions();
                    toast.success(`Back to version ${v.number}${out.skipped ? ` (${out.skipped} periods no longer fit and were left out)` : ''}`);
                    void say(`The timetable is back to version ${v.number} (${v.label}).`);
                } catch (err) { toast.error(getErrorMessage(err, 'Could not go back to that version')); }
            },
        });
    };

    const setTab = (t: Tab) => {
        setTabState(t);
        const u = new URL(window.location.href);
        if (t === 'today') u.searchParams.set('tab', 'today'); else u.searchParams.delete('tab');
        u.searchParams.delete('division');
        window.history.replaceState(null, '', u.toString());
    };

    const load = useCallback(async () => {
        try {
            const res = await api.get('/admin/timetable/ai/workspace', { params });
            const data = res.data.data as Workspace;
            setWs(data);
            setError('');
            const first = data.standards[0]?.divisions[0]?.id ?? null;
            setDivisionId(d => (d && data.standards.some(s => s.divisions.some(x => x.id === d)) ? d : first));
            setTeacherId(t => t ?? data.teachers[0]?.id ?? null);
            setRoomId(r => (r && data.rooms.some(x => x.id === r) ? r : data.rooms.find(x => x.type !== 'CLASSROOM')?.id ?? null));
            setSchoolDay(d => (data.workingDays.includes(d) ? d : data.workingDays[0] ?? 1));
            return data;
        } catch (err) { setError(getErrorMessage(err, 'Could not open the timetable')); return null; }
    }, [params]);
    useEffect(() => { void load(); }, [load]);
    // The builder always opens at the latest message: jump there when the page (or the Year tab) appears,
    // then glide down as new messages come in.
    const wsReady = !!ws;
    const firstScroll = useRef(true);
    useEffect(() => {
        if (!wsReady || tab !== 'year') { firstScroll.current = true; return; }
        const behavior: ScrollBehavior = firstScroll.current ? 'auto' : 'smooth';
        firstScroll.current = false;
        const id = window.requestAnimationFrame(() => feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior }));
        return () => window.cancelAnimationFrame(id);
    }, [turns, thinking, build, results, wsReady, tab]);

    const sections = useMemo(() => ws?.standards.flatMap(s => s.divisions) ?? [], [ws]);
    const labs = useMemo(() => ws?.rooms.filter(r => r.type !== 'CLASSROOM') ?? [], [ws]);
    const hasDay = !!ws && ws.workingDays.length > 0 && ws.slots.some(s => s.kind === 'PERIOD');
    const hasSubjects = !!ws && ws.configs.length > 0;
    const built = !!ws && ws.entries.length > 0;
    const withConfigs = useMemo(() => sections.filter(d => ws?.configs.some(c => c.divisionId === d.id)), [sections, ws]);
    const published = built && withConfigs.length > 0 && withConfigs.every(d => d.status === 'PUBLISHED');
    const step = !hasDay || !hasSubjects ? 0 : !built ? 1 : published ? 4 : 2; // 4 = all four done (published)
    const h = ws ? health(ws) : null;
    const readOnly = !canManage || (ws ? !ws.year.writable : true);

    /** Builds sections one by one, showing each on the left as it fills. */
    const buildSections = async (ids: string[], variation?: number): Promise<GenResult[]> => {
        const out: GenResult[] = [];
        setMode('class');
        for (const [i, id] of ids.entries()) {
            const label = sections.find(d => d.id === id)?.label ?? '';
            setDivisionId(id);
            setBuild({ done: i, total: ids.length, label });
            try {
                const res = await api.post(`/admin/timetable/divisions/${id}/generate`, { keepLocked: true, ...(variation ? { variation } : {}) }, { params });
                out.push(res.data.data);
            } catch (err) {
                out.push({ divisionId: id, divisionName: label, complete: false, placed: 0, unplaced: 0, problems: [getErrorMessage(err, 'Could not build')] });
            }
            try {
                const res = await api.get('/admin/timetable/ai/entries', { params });
                const { entries, statuses } = res.data.data as { entries: WsEntry[]; statuses: { divisionId: string; status: string }[] };
                setWs(w => w && ({ ...w, entries, standards: w.standards.map(s => ({ ...s, divisions: s.divisions.map(d => ({ ...d, status: (statuses.find(x => x.divisionId === d.id)?.status ?? d.status) as typeof d.status })) })) }));
            } catch { /* the full reload below catches up */ }
        }
        setBuild(null);
        await load();
        return out;
    };

    const runBuild = async (variation?: number) => {
        const live = withConfigs.filter(d => d.status === 'PUBLISHED').map(d => d.id);
        if (live.length) {
            try { await api.post('/admin/timetable/status-bulk', { status: 'DRAFT', divisionIds: live, force: true }, { params }); }
            catch (err) { toast.error(getErrorMessage(err, 'Could not unpublish')); return; }
        }
        const wasBuilt = built;
        if (wasBuilt) await snapshot('Before the new version');
        setResults(null);
        setGlow(new Set());
        setPreview(null);
        const ids = withConfigs.map(d => d.id);
        // Start from empty sections (fixed periods stay), so the new build is not shaped by the old one.
        if (wasBuilt) {
            setBuild({ done: 0, total: ids.length, label: 'clearing the old timetable' });
            for (const id of ids) { try { await api.post(`/admin/timetable/divisions/${id}/clear`, { keepLocked: true }, { params }); } catch { /* the build replaces it anyway */ } }
        }
        setResults(await buildSections(ids, variation));
        await snapshot(wasBuilt ? 'New version' : 'First build');
    };
    const buildAll = (variation?: number) => {
        if (!ws) return;
        const locked = ws.entries.filter(e => e.isLocked).length;
        if (withConfigs.some(d => d.status === 'PUBLISHED')) {
            setAsk({ title: 'Make a new version?', lines: ['The timetable is published. A new version goes back to draft until you publish again. The current one stays in Versions.', ...(locked ? [`${locked} fixed period${locked === 1 ? '' : 's'} will stay where they are.`] : [])], confirm: 'Make a new version', run: () => void runBuild(variation) });
            return;
        }
        void runBuild(variation);
    };

    const publish = async () => {
        setPublishing(true);
        try {
            await api.post('/admin/timetable/status-bulk', { status: 'PUBLISHED', divisionIds: withConfigs.filter(d => d.status !== 'PUBLISHED').map(d => d.id) }, { params });
            toast.success('Timetable published. Teachers and students can see it in the app.');
            await load();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not publish. Fix the clashes first.')); }
        finally { setPublishing(false); }
    };

    const send = async (text: string) => {
        const message = text.trim();
        if (!message || thinking) return;
        setDraft('');
        const history = turns.slice(-8).map(t => ({ role: t.role, text: t.text.slice(0, 1500) }));
        const tmp = uid();
        setTurns(t => [...t, { id: tmp, role: 'user', text: message, at: Date.now() }]);
        void saveMsg('user', message).then(id => setTurns(t => t.map(x => (x.id === tmp ? { ...x, id } : x))));
        setThinking(true);
        try {
            const res = await api.post('/admin/timetable/ai/chat', { message, history, focus: mode === 'teacher' ? { teacherId: teacherId ?? undefined } : { divisionId: divisionId ?? undefined }, ...(h ? { health: `${h.score}% - ${h.notes.join('; ')}`.slice(0, 900) } : {}) }, { params });
            const d = res.data.data as { reply: string; actions: PlanAction[]; steps: string[]; show: { divisionId?: string; teacherId?: string } | null };
            if (d.show?.teacherId) { setMode('teacher'); setTeacherId(d.show.teacherId); }
            else if (d.show?.divisionId) { setMode('class'); setDivisionId(d.show.divisionId); }
            const data = { steps: d.steps, actions: d.actions, state: d.actions.length ? 'open' as const : undefined };
            const id = await saveMsg('assistant', d.reply, data);
            setTurns(t => [...t, { id, role: 'assistant', text: d.reply, ...data, at: Date.now() }]);
        } catch (err) {
            setTurns(t => [...t, { id: uid(), role: 'assistant', text: getErrorMessage(err, 'Sorry, I could not answer that. Please try again.'), at: Date.now() }]);
        } finally { setThinking(false); }
    };

    const setTurn = (id: string, patch: Partial<ChatTurn>) => {
        setTurns(t => t.map(x => (x.id === id ? { ...x, ...patch } : x)));
        // Keep the saved chat in step (Apply / Undo / Not now), but not the moment in between.
        if (patch.state && patch.state !== 'applying') patchMsg(id, { state: patch.state, ...(patch.undo ? { undo: patch.undo } : {}) });
    };

    const apply = async (turn: ChatTurn) => {
        if (!ws || !turn.actions?.length) return;
        setTurn(turn.id, { state: 'applying' });
        const before = ws.entries;
        await snapshot('Before AI change');
        try {
            const res = await api.post('/admin/timetable/ai/apply', { actions: turn.actions }, { params });
            const { rebuild } = res.data.data as { rebuild: string[] };
            let after = (await load())?.entries ?? before;
            if (rebuild.length) { await buildSections(rebuild); after = (await api.get('/admin/timetable/ai/entries', { params })).data.data.entries; }
            // What changed: periods that are new or moved.
            const sig = (e: WsEntry) => `${e.divisionId}|${e.dayOfWeek}|${e.slotId}|${e.subjectId}|${e.teacherId}`;
            const old = new Set(before.map(sig));
            const changed = after.filter(e => !old.has(sig(e)));
            const touched = [...new Set([...rebuild, ...changed.map(e => e.divisionId)])];
            const undo: Snapshot = touched.map(d => ({ divisionId: d, entries: before.filter(e => e.divisionId === d) }));
            setGlow(new Set(changed.map(e => e.id)));
            if (changed[0] && mode === 'class' && !changed.some(e => e.divisionId === divisionId)) setDivisionId(changed[0].divisionId);
            setTurn(turn.id, { state: 'applied', undo });
            void say(changed.length ? `Done. ${changed.length} period${changed.length === 1 ? '' : 's'} changed${touched.length > 1 ? ` in ${touched.length} sections` : ''} - they are glowing on the left.` : 'Done. The rule is saved; the timetable already followed it, so nothing had to move.');
            void snapshot('AI change');
            window.setTimeout(() => setGlow(new Set()), 9000);
        } catch (err) {
            setTurn(turn.id, { state: 'open' });
            toast.error(getErrorMessage(err, 'Could not make that change'));
        }
    };

    /** Places every missing period without clashes (no AI needed): free slots first, then small swaps, then a rebuild. */
    const [fixing, setFixing] = useState(false);
    const fixMissing = async () => {
        if (!ws) return;
        setFixing(true);
        const before = ws.entries.length;
        try {
            await snapshot('Before fixing missing periods');
            const res = await api.post('/admin/timetable/ai/apply', { actions: [{ type: 'fix', divisionIds: withConfigs.map(d => d.id) }] }, { params });
            const { rebuild } = res.data.data as { rebuild: string[] };
            if (rebuild.length) await buildSections(rebuild); else await load();
            const after = (await api.get('/admin/timetable/ai/entries', { params })).data.data.entries as WsEntry[];
            const gained = after.length - before;
            await snapshot('Fixed missing periods');
            void say(gained > 0 ? `I placed ${gained} missing period${gained === 1 ? '' : 's'} without any clash.` : 'I could not place the missing periods without a clash. Try Make a new version, give that subject one period less, or let another teacher take it.');
            toast.success(gained > 0 ? `${gained} period${gained === 1 ? '' : 's'} placed` : 'Nothing could be placed without a clash');
        } catch (err) { toast.error(getErrorMessage(err, 'Could not fix it')); }
        finally { setFixing(false); }
    };

    const undo = async (turn: ChatTurn) => {
        if (!turn.undo) return;
        setTurn(turn.id, { state: 'applying' });
        try {
            for (const s of turn.undo) {
                await api.post(`/admin/timetable/divisions/${s.divisionId}/clear`, { keepLocked: false }, { params });
                if (s.entries.length) {
                    await api.post(`/admin/timetable/divisions/${s.divisionId}/restore`, {
                        entries: s.entries.map(e => ({ dayOfWeek: e.dayOfWeek, slotId: e.slotId, sessionTypeId: e.sessionTypeId, subjectId: e.subjectId, title: e.title, teacherId: e.teacherId, roomId: e.roomId, isLocked: e.isLocked })),
                    }, { params });
                }
            }
            await load();
            setTurn(turn.id, { state: 'undone' });
            void say('The timetable is back as it was. (The rule itself is still saved; tell me if you want it removed.)');
            void snapshot('Undo AI change');
        } catch (err) { setTurn(turn.id, { state: 'applied' }); toast.error(getErrorMessage(err, 'Could not undo')); }
    };

    // ── Hands-on changes on the grid ──────────────────────────────────────────
    const flash = (ids: string[]) => { setGlow(new Set(ids)); window.setTimeout(() => setGlow(new Set()), 4000); };

    const moveOrSwap = async (from: WsEntry, day: number, slotId: string, onto: WsEntry | null, force = false, quiet = false) => {
        try {
            if (onto) await api.post('/admin/timetable/entries/swap', { entryAId: from.id, entryBId: onto.id, force }, { params });
            else await api.post('/admin/timetable/entries/move', { entryId: from.id, toDayOfWeek: day, toSlotId: slotId, force }, { params });
            await load();
            flash(onto ? [from.id, onto.id] : [from.id]);
            if (!quiet) {
                toast.success(onto ? 'Swapped' : 'Moved', {
                    action: { label: 'Undo', onClick: () => void (onto ? moveOrSwap(from, from.dayOfWeek, from.slotId, onto, true, true) : moveOrSwap({ ...from, dayOfWeek: day, slotId }, from.dayOfWeek, from.slotId, null, true, true)) },
                });
            }
        } catch (err) {
            const c = conflictsFromError(err);
            if (c) setAsk({ title: 'This makes a clash', lines: c.slice(0, 4).map(x => x.message), confirm: 'Do it anyway', danger: true, run: () => void moveOrSwap(from, day, slotId, onto, true) });
            else toast.error(getErrorMessage(err, 'Could not move it'));
        }
    };

    /** Teacher view: tap a free period to mark the teacher not free then (and back). */
    const toggleNotFree = async (tId: string, day: number, slotId: string) => {
        try {
            const cur = (await api.get(`/admin/timetable/teachers/${tId}/availability`, { params })).data.data as { unavailable: { dayOfWeek: number; slotId: string }[]; preferred: { dayOfWeek: number; slotId: string }[] };
            const has = cur.unavailable.some(c => c.dayOfWeek === day && c.slotId === slotId);
            const unavailable = has ? cur.unavailable.filter(c => !(c.dayOfWeek === day && c.slotId === slotId)) : [...cur.unavailable, { dayOfWeek: day, slotId }];
            await api.put(`/admin/timetable/teachers/${tId}/availability`, { unavailable, preferred: cur.preferred.filter(c => !(c.dayOfWeek === day && c.slotId === slotId)) }, { params });
            await load();
            toast.success(has ? 'Free again' : 'Marked not free. Building again keeps this period free.');
        } catch (err) { toast.error(getErrorMessage(err, 'Could not save')); }
    };

    const onCell = (c: CellHit) => {
        if (mode === 'teacher' && !c.entry) {
            if (!readOnly && teacherId) void toggleNotFree(teacherId, c.day, c.slotId);
            return;
        }
        setHit(c);
    };

    const openClass = (id: string) => { setMode('class'); setDivisionId(id); };

    const download = async (format: 'pdf' | 'xlsx') => {
        const kind = mode === 'school' ? 'master' : mode;
        const id = mode === 'class' ? divisionId : mode === 'teacher' ? teacherId : mode === 'room' ? roomId : null;
        try { await ttApi.exportFile(yearId ?? null, kind, format, id ?? undefined); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not download')); }
    };

    if (error) return <div className="p-10 text-center text-sm text-red-600">{error}</div>;
    if (!ws) {
        return (
            <div className="grid h-full place-items-center">
                <div className="text-center"><Sparkles className="mx-auto mb-3 h-8 w-8 animate-pulse text-primary" /><p className="text-sm text-muted-foreground">Reading your school...</p></div>
            </div>
        );
    }

    // While looking at an old version, the grid shows that version's periods.
    const shown: Workspace = preview ? { ...ws, entries: preview.entries } : ws;
    const teacherCount = ws.teachers.length;
    const subjectCount = new Set(ws.subjects.map(s => s.name.trim().toLowerCase())).size;
    const currentLabel = mode === 'class' ? sections.find(d => d.id === divisionId)?.label : mode === 'teacher' ? ws.teachers.find(t => t.id === teacherId)?.name : mode === 'room' ? labs.find(r => r.id === roomId)?.name : null;
    const targetId = mode === 'class' ? divisionId : mode === 'teacher' ? teacherId : roomId;
    const VIEWS: [Mode, string, typeof GraduationCap][] = [['class', 'Class', GraduationCap], ['teacher', 'Teacher', UserRound], ...(labs.length ? [['room', 'Lab', DoorOpen] as [Mode, string, typeof GraduationCap]] : []), ['school', 'Whole school', LayoutGrid]];

    // The Setup box (school day, labs, subjects). The gear in the builder's header brings it down to the end of the chat.
    const setupBlock = (
        <div>
                                    <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">Setup</p>
                                    <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]">
                                        <DayCard key={editDay ? 'day-edit' : 'day'} ws={ws} params={params} collapsed={hasDay && !editDay} onEdit={() => setEditDay(true)} onCancel={hasDay ? () => setEditDay(false) : undefined} onSaved={() => { setEditDay(false); void load(); }} />
                                        {!hasDay && <>
                                            <StepPending n={2} title="Labs and grounds" text="Opens after the school day. Optional." />
                                            <StepPending n={3} title="Subjects per week" text="Opens after the school day." />
                                        </>}
                                        {hasDay && <LabsCard ws={ws} params={params} writable={!readOnly} onSaved={() => void load()} />}
                                        {hasDay && <SubjectsCard key={editSubjects ? 'sub-edit' : 'sub'} ws={ws} params={params} collapsed={hasSubjects && !editSubjects} onEdit={() => setEditSubjects(true)} onCancel={hasSubjects ? () => setEditSubjects(false) : undefined} onSaved={() => { setEditSubjects(false); void load(); }} />}
                                    </div>
                                </div>
    );
    // Build (make a new version) and Publish. The rocket in the builder's header brings them down to the end of the chat.
    const actionsBlock = (
        <>
                                {hasDay && hasSubjects && !editDay && !editSubjects && (
                                    <Agent>
                                        {!built && !build && <Say>All set! Shall I build the timetable? {withConfigs.length === 1 ? 'I will build the 1 section that has subjects set.' : `I will do all ${withConfigs.length} sections together, so no teacher is ever in two classes at once.`} It takes about a minute.</Say>}
                                        {build && <Say><span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin text-[#EC9B7E]" />Building {build.label} ({build.done + 1} of {build.total})...</span></Say>}
                                        {built && !build && results && (() => {
                                            const bad = results.filter(r => !r.complete);
                                            return <>
                                                <Say>{bad.length ? `Done. I built ${results.length - bad.length} of ${results.length} sections fully. These need a look:` : `Done! All ${results.length} sections are built. Click any period on the left to change it, or just tell me what you want.`}</Say>
                                                {bad.length > 0 && (
                                                    <ul className="space-y-2 text-[12px] text-white/60">
                                                        {bad.slice(0, 5).map(r => {
                                                            const label = sections.find(d => d.id === r.divisionId)?.label ?? r.divisionName;
                                                            const problem = r.problems[0] ?? `${r.unplaced} periods left out`;
                                                            return (
                                                                <li key={r.divisionId} className="rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]">
                                                                    <span className="font-semibold text-white/85">{label}:</span> {problem}
                                                                    {!readOnly && <button type="button" disabled={thinking} onClick={() => void send(`${label}: ${problem} Please fix it.`)} className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#EC9B7E] hover:underline disabled:opacity-50"><Sparkles size={11} />Ask AI to fix this</button>}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                                {bad.length > 0 && <Say>You can also press <b className="text-white">Make a new version</b>: a different arrangement often fits everything.</Say>}
                                            </>;
                                        })()}
                                        {built && !build && !results && <Say>Your timetable is ready. Click any period on the left to change it, or just tell me what you want.</Say>}
                                        {!build && (
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <button type="button" onClick={() => buildAll(built ? 1 + Math.floor(Math.random() * 99999) : undefined)}
                                                    className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-[13px] font-semibold text-white transition hover:opacity-95 active:scale-[0.99]"
                                                    style={{ background: 'linear-gradient(135deg, #EC9B7E 0%, #DA7756 100%)' }}>
                                                    {built ? <><Shuffle size={14} />Make a new version</> : <><Sparkles size={14} />Yes, build it</>}
                                                </button>
                                                {built && <span className="text-[11px] text-white/45">The current one is kept in Versions.</span>}
                                            </div>
                                        )}
                                    </Agent>
                                )}

                                {built && !build && (
                                    <Agent>
                                        {published
                                            ? <Say><span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" />It is published. Teachers and students see it in the app.</span></Say>
                                            : <>
                                                <Say>{ws.conflictCount ? `There ${ws.conflictCount === 1 ? 'is 1 clash' : `are ${ws.conflictCount} clashes`} to fix before you can publish. Tap the clashes count on the left to see them.` : 'Happy with it? When you publish, every teacher and student sees it in the app.'}</Say>
                                                <button type="button" disabled={publishing || ws.conflictCount > 0} onClick={() => void publish()} className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Rocket size={14} />{publishing ? 'Publishing...' : 'Publish for the year'}</button>
                                            </>}
                                    </Agent>
                                )}
        </>
    );
    const renderTurn = (t: ChatTurn) => (
                                    t.role === 'user'
                                        ? (
                                            <div key={t.id} className="flex flex-col items-end">
                                                <div className="w-fit max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px] text-[#3A322C]" style={{ background: '#E8CBB5' }}>{t.text}</div>
                                                <MsgMeta at={t.at} text={t.text} onRetry={readOnly || thinking ? undefined : () => void send(t.text)} />
                                            </div>
                                        )
                                        : (
                                            <Agent key={t.id}>
                                                <Say>{t.text}</Say>
                                                {!!t.steps?.length && (
                                                    <ul className="space-y-1 border-l-2 border-white/10 pl-2.5 text-[12px] text-white/70">
                                                        {t.steps.map((s, i) => <li key={i} className="flex gap-1.5"><ChevronRight size={13} className="mt-0.5 shrink-0 text-[#EC9B7E]" />{s}</li>)}
                                                    </ul>
                                                )}
                                                {t.state === 'open' && (
                                                    <div className="flex gap-2">
                                                        <button type="button" onClick={() => void apply(t)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #EC9B7E, #DA7756)' }}><Check size={13} />Apply</button>
                                                        <button type="button" onClick={() => setTurn(t.id, { state: 'skipped' })} className="h-8 rounded-lg px-3 text-xs font-semibold text-white/55 hover:bg-white/[0.06] hover:text-white">Not now</button>
                                                    </div>
                                                )}
                                                {t.state === 'applying' && <p className="flex items-center gap-1.5 text-xs text-white/55"><Loader2 size={13} className="animate-spin" />Working on it...</p>}
                                                {t.state === 'applied' && t.undo && <button type="button" onClick={() => void undo(t)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EC9B7E] hover:underline"><Undo2 size={13} />Undo</button>}
                                                {t.state === 'skipped' && <p className="text-xs text-white/45">Left as it is.</p>}
                                                {t.state === 'undone' && <p className="text-xs text-white/45">Undone.</p>}
                                                <MsgMeta at={t.at} text={[t.text, ...(t.steps ?? [])].join('\n')} />
                                            </Agent>
                                        )
    );

    return (
        <div className="flex h-full min-h-0 flex-col px-1 pb-3">
            {/* Header - same as the Feed and Classes tabs; steps in the middle */}
            <div className="shrink-0 pb-3">
                <div className="grid grid-cols-1 items-center gap-2 lg:grid-cols-[1fr_auto_1fr]">
                    <div>
                        <h1 className="flex items-center gap-2 text-xl font-bold"><CalendarDays size={21} />AI Timetable Scheduling</h1>
                        <p className="text-[13px] text-muted-foreground">{tab === 'year' ? `The whole school's timetable for ${ws.year.label}` : 'Absent teachers and special days'}</p>
                    </div>
                    <div className="lg:justify-self-center">
                        {tab === 'year' && (
                            <ol className="flex items-center gap-1 rounded-full bg-muted/50 p-1" aria-label="Steps">
                                {STEPS.map((s, i) => (
                                    <li key={s} aria-current={i === step ? 'step' : undefined}
                                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${i === step ? 'bg-card text-foreground shadow-sm' : i < step ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                        {i < step ? <Check size={13} /> : <span className="grid h-4 w-4 place-items-center rounded-full bg-muted text-[10px]">{i + 1}</span>}{s}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                    {/* Same switch as Daily Attendance / Overall on the class page */}
                    <div className="flex w-fit rounded-xl border border-border/50 bg-muted/50 p-0.5 lg:justify-self-end" role="tablist">
                        {([['year', 'Year timetable', CalendarDays], ['today', 'Today', Sun]] as const).map(([k, l, Icon]) => (
                            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${tab === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                <Icon size={14} />{l}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-2 h-px bg-border/60" />
            </div>

            {tab === 'today' ? <TodayPanel ws={ws} params={params} writable={!readOnly} /> : (
                <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,70fr)_minmax(0,30fr)]">
                    {/* Left: the timetable */}
                    <section data-admin-surface="" className="flex min-h-[480px] min-w-0 flex-col gap-3 rounded-2xl bg-card p-4 lg:min-h-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex rounded-full bg-muted/50 p-0.5">
                                {VIEWS.map(([k, l, Icon]) => (
                                    <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k}
                                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${mode === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><Icon size={13} />{l}</button>
                                ))}
                            </div>
                            {h && built && (
                                <div className="ml-auto flex items-center gap-2.5 text-xs">
                                    <span className="text-muted-foreground"><span className="font-bold tabular-nums text-foreground">{Math.min(h.placed, h.required)}</span>/{h.required} placed</span>
                                    {h.placed < h.required && !readOnly && !build && (
                                        <button type="button" disabled={fixing} onClick={() => void fixMissing()} title="Place the missing periods without any clash"
                                            className="inline-flex h-7 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 font-semibold text-amber-700 hover:bg-amber-500/25 disabled:opacity-60 dark:text-amber-300">
                                            {fixing ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}Fix {h.required - h.placed} missing
                                        </button>
                                    )}
                                    <button type="button" disabled={!ws.conflictCount} onClick={() => setClashesOpen(true)} className={ws.conflictCount ? 'inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-400' : 'text-muted-foreground'}>
                                        {ws.conflictCount > 0 && <AlertTriangle size={12} />}{ws.conflictCount} clash{ws.conflictCount === 1 ? '' : 'es'}
                                    </button>
                                    <button type="button" onClick={() => setHealthOpen(true)} title="Why this score?" className={`rounded-full px-2.5 py-1 font-bold hover:opacity-80 ${h.score >= 85 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : h.score >= 60 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>Health {h.score}%</button>
                                    {(
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button type="button" className="inline-flex h-7 items-center gap-1 rounded-full bg-muted/50 px-2.5 font-semibold text-muted-foreground hover:text-foreground"><History size={13} />Versions</button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto" style={scrollStyle}>
                                                {!versions.length && <p className="px-2.5 py-3 text-xs text-muted-foreground">{versionsError ? 'Versions could not be loaded. The server may need the latest update (database push and restart).' : 'Every time you build, the timetable is saved here so you can go back to it.'}</p>}
                                                {versions.map((v, i) => (
                                                    <DropdownMenuItem key={v.id} onClick={() => (i === 0 ? setPreview(null) : void openVersion(v.id))} className="flex items-start gap-2 py-2">
                                                        <span className="mt-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-muted px-1 text-[10px] font-bold tabular-nums">{v.number}</span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-[13px] font-medium">{v.label}</span>
                                                            <span className="block text-[11px] text-muted-foreground">{when(v.createdAt)} - {v.periods} periods</span>
                                                        </span>
                                                        {i === 0 && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Current</span>}
                                                        {preview?.id === v.id && <Eye size={13} className="mt-0.5 text-primary" />}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button type="button" aria-label="Download" className="inline-flex h-7 items-center gap-1 rounded-full bg-muted/50 px-2.5 font-semibold text-muted-foreground hover:text-foreground"><Download size={13} />Download</button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52">
                                            <DropdownMenuItem onClick={() => void download('pdf')}>PDF - {mode === 'school' ? 'whole school' : currentLabel}</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => void download('xlsx')}>Excel - {mode === 'school' ? 'whole school' : currentLabel}</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                        {/* The same chip row for classes, teachers and labs, so nothing jumps when switching. */}
                        {mode !== 'school' && (
                            <div className="flex min-h-[34px] gap-1.5 overflow-x-auto pb-1" style={scrollStyle}>
                                {mode === 'class' && sections.map(d => {
                                    const has = ws.entries.some(e => e.divisionId === d.id);
                                    const now = build?.label === d.label;
                                    return (
                                        <button key={d.id} type="button" onClick={() => setDivisionId(d.id)} aria-pressed={divisionId === d.id} className={chip(divisionId === d.id)}>
                                            {now ? <Loader2 size={11} className="animate-spin" /> : <span className={`h-1.5 w-1.5 rounded-full ${d.status === 'PUBLISHED' ? 'bg-blue-500' : has ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />}
                                            {d.label}
                                        </button>
                                    );
                                })}
                                {mode === 'teacher' && ws.teachers.map(t => (
                                    <button key={t.id} type="button" onClick={() => setTeacherId(t.id)} aria-pressed={teacherId === t.id} className={chip(teacherId === t.id)}>
                                        {t.name}<span className="tabular-nums opacity-60">{ws.entries.filter(e => e.teacherId === t.id).length}</span>
                                    </button>
                                ))}
                                {mode === 'room' && labs.map(r => (
                                    <button key={r.id} type="button" onClick={() => setRoomId(r.id)} aria-pressed={roomId === r.id} className={chip(roomId === r.id)}>{r.name}</button>
                                ))}
                            </div>
                        )}
                        {build && (
                            <div className="rounded-xl bg-primary/5 px-3 py-2">
                                <div className="flex items-center justify-between text-xs"><span className="font-semibold">Building {build.label}...</span><span className="tabular-nums text-muted-foreground">{build.done + 1} of {build.total}</span></div>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${((build.done + 0.5) / build.total) * 100}%`, background: 'linear-gradient(90deg, #EC9B7E, #DA7756)' }} /></div>
                            </div>
                        )}
                        {preview && (
                            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs">
                                <Eye size={14} className="text-primary" />
                                <span className="min-w-0 flex-1"><span className="font-semibold">Looking at version {preview.number}</span> <span className="text-muted-foreground">- {preview.label}, {when(preview.createdAt)}. Nothing has changed yet.</span></span>
                                <button type="button" onClick={() => setPreview(null)} className="h-7 rounded-lg px-3 font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Back to current</button>
                                {!readOnly && <button type="button" onClick={applyVersion} className="h-7 rounded-lg bg-primary px-3 font-semibold text-primary-foreground hover:opacity-90">Use this version</button>}
                            </div>
                        )}
                        <div className="flex min-h-0 flex-1 flex-col">
                            {mode === 'school'
                                ? <SchoolDayView ws={shown} day={schoolDay} onDay={setSchoolDay} onOpenClass={openClass} />
                                : <>
                                    {currentLabel && hasDay && (
                                        <p className="mb-1 flex items-center gap-2 text-sm font-bold">{currentLabel}
                                            {built && !readOnly && <span className="text-[11px] font-normal text-muted-foreground">{mode === 'class' ? 'Click a period to change it, drag to move.' : mode === 'teacher' ? 'Tap a free period to mark the teacher not free.' : ''}</span>}
                                        </p>
                                    )}
                                    <TimetableCanvas ws={shown} mode={mode} targetId={targetId} glow={preview ? new Set() : glow} building={!!build} editable={!readOnly && !preview} onCell={built && !preview ? onCell : undefined} onDrop={(f, d, s, o) => void moveOrSwap(f, d, s, o)} />
                                </>}
                        </div>
                    </section>

                    {/* Right: the assistant */}
                    {/* Same look as Jarvis: always dark, black header, the animated AI icon. */}
                    <section data-theme={themeId || undefined} className="dark flex min-h-[520px] flex-col overflow-hidden rounded-3xl text-white lg:min-h-0"
                        style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px -12px rgba(0,0,0,0.6)' }}>
                        <div className="flex shrink-0 items-center gap-2.5 px-4 py-3" style={{ background: '#000000', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <Bot size={21} className="shrink-0 text-white" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-semibold leading-none text-white">AI Timetable Builder</p>
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/40">Ask in English or Hinglish<Sparkles size={11} /></p>
                            </div>
                            {turns.length > 0 && !readOnly && (clearSure
                                ? <span className="flex items-center gap-1 text-[10px]"><span className="mr-0.5 text-white/50">Clear chat?</span>
                                    <button type="button" onClick={() => void clearChat()} className="rounded-md px-1.5 py-0.5 font-medium text-red-400 hover:bg-white/10 hover:text-red-300">Yes</button>
                                    <button type="button" onClick={() => setClearSure(false)} className="rounded-md px-1.5 py-0.5 text-white/50 hover:bg-white/10 hover:text-white">No</button>
                                </span>
                                : <button type="button" onClick={() => setClearSure(true)} title="Clear chat" className="rounded-md px-2 py-0.5 text-[10px] text-white/50 transition-colors hover:bg-white/10 hover:text-red-400">Clear</button>)}
                        </div>
                        <div ref={feed} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
                            <Agent>
                                <Say>Hi! I am your timetable builder. I looked at your school: <b className="text-white">{ws.standards.length} classes, {sections.length} sections, {teacherCount} teachers and {subjectCount} subjects</b>.</Say>
                                {!sections.length && <Say>Add classes and sections in Campus first, then come back and I will build the timetable.</Say>}
                                {readOnly && <Say>{ws.year.writable ? 'You can look at the timetable. Ask your admin for timetable access to change it.' : `${ws.year.label} is closed, so its timetable can only be viewed.`}</Say>}
                            </Agent>

                            {!readOnly && sections.length > 0 && <>
                                {setupAt === null && setupBlock}

                                {actionsAt === null && actionsBlock}

                                {turns.map((t, i) => (
                                    <Fragment key={t.id}>
                                        {renderTurn(t)}
                                        {setupAt === i && <div ref={setupRef} className="scroll-mt-2">{setupBlock}</div>}
                                        {actionsAt === i && <div ref={actionsRef} className="scroll-mt-2 space-y-4">{actionsBlock}</div>}
                                    </Fragment>
                                ))}
                                {thinking && <Agent><div className="flex h-5 items-center gap-1">{[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" style={{ animationDelay: `${i * 120}ms` }} />)}</div></Agent>}
                            </>}
                        </div>
                        {built && !build && !readOnly && (
                            <div className="flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-1.5 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
                                {IDEAS.map(i => <button key={i} type="button" onClick={() => void send(i)} className="shrink-0 whitespace-nowrap rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] text-white/70 ring-1 ring-white/[0.08] hover:bg-white/[0.1] hover:text-white">{i}</button>)}
                            </div>
                        )}
                        <form className="shrink-0 p-3" style={{ borderTop: built && !build && !readOnly ? undefined : '1px solid rgba(255,255,255,0.08)' }} onSubmit={e => { e.preventDefault(); void send(draft); }}>
                            <div className="flex items-end gap-1 rounded-2xl p-1.5" style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.14)' }}>
                                {/* Bring Setup, or Build / Publish, down to where the chat is. */}
                                {!readOnly && sections.length > 0 && (
                                    <button type="button" onClick={bringSetup} aria-label="Setup" title="Setup: school day, labs and subjects"
                                        className="grid h-9 w-8 shrink-0 place-items-center rounded-xl text-white/55 transition-colors hover:bg-white/10 hover:text-white"><Settings size={16} /></button>
                                )}
                                {!readOnly && hasDay && hasSubjects && (
                                    <button type="button" onClick={bringActions} aria-label="Build and publish" title="Make a new version or publish"
                                        className="grid h-9 w-8 shrink-0 place-items-center rounded-xl text-white/55 transition-colors hover:bg-white/10 hover:text-white"><Rocket size={16} /></button>
                                )}
                                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={1} maxLength={1000} disabled={!built || !!build || readOnly}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
                                    placeholder={built ? 'Tell me what to change...' : 'Build first, then ask me anything'}
                                    className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent px-1.5 py-2 text-[13px] text-white outline-none placeholder:text-white/35 disabled:opacity-60" />
                                <button type="submit" aria-label="Send" disabled={!draft.trim() || thinking || !built || !!build || readOnly}
                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white transition-opacity disabled:opacity-30" style={{ background: 'linear-gradient(135deg, #EC9B7E 0%, #DA7756 100%)' }}><Send size={13} /></button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {hit && <PeriodPopover ws={ws} hit={hit} mode={mode === 'school' ? 'class' : mode} divisionId={divisionId} editable={!readOnly} params={params} onClose={() => setHit(null)} onChanged={() => { void load().then(() => hit.entry && flash([hit.entry.id])); }} onOpenClass={openClass} />}

            <Dialog open={!!ask} onOpenChange={o => { if (!o) setAsk(null); }}>
                <DialogContent className="bg-card sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">{ask?.danger && <AlertTriangle size={17} className="text-red-500" />}{ask?.title}</DialogTitle>
                        <DialogDescription asChild><div className="space-y-1 text-sm">{ask?.lines.map((l, i) => <p key={i}>{l}</p>)}</div></DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button type="button" onClick={() => setAsk(null)} className="h-9 rounded-lg px-4 text-sm font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                        <button type="button" onClick={() => { const a = ask; setAsk(null); a?.run(); }} className={`h-9 rounded-lg px-4 text-sm font-semibold text-white ${ask?.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:opacity-90'}`}>{ask?.confirm}</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={healthOpen} onOpenChange={setHealthOpen}>
                <DialogContent className="bg-card sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Health {h?.score ?? 0}%</DialogTitle>
                        <DialogDescription>100% means every period is placed, there are no clashes, no teacher has more than 4 periods in a row and every teacher&apos;s days are about even.</DialogDescription>
                    </DialogHeader>
                    <ul className="space-y-1.5">
                        {(h?.notes ?? []).map((n, i) => <li key={i} className={`rounded-xl px-3 py-2 text-[13px] ${h && h.score < 100 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>{n}</li>)}
                    </ul>
                    {h && h.score < 100 && <p className="text-xs text-muted-foreground">Try <b>Make a new version</b>, or ask the assistant, for example: &quot;No teacher should have more than 4 periods in a row&quot;.</p>}
                </DialogContent>
            </Dialog>

            <Dialog open={clashesOpen} onOpenChange={setClashesOpen}>
                <DialogContent className="bg-card sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{ws.conflictCount} clash{ws.conflictCount === 1 ? '' : 'es'} to fix</DialogTitle>
                        <DialogDescription>Fix them by moving a period, or tell the assistant. Building again also fixes most.</DialogDescription>
                    </DialogHeader>
                    <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1" style={scrollStyle}>
                        {ws.conflicts.map((c, i) => <li key={i} className="flex gap-2 rounded-xl bg-red-500/5 px-3 py-2 text-[13px]"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />{c.message}</li>)}
                    </ul>
                    {ws.conflictCount > ws.conflicts.length && <p className="text-xs text-muted-foreground">Showing the first {ws.conflicts.length}.</p>}
                </DialogContent>
            </Dialog>
        </div>
    );
}
