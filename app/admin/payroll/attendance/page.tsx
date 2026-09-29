'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import { ChevronLeft, ChevronRight, CalendarCheck, BarChart2, Upload, Fingerprint, Hand, Loader2, CheckCheck, RefreshCw, X, FileSpreadsheet, AlertTriangle, CalendarOff, Save, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, PrimaryButton, SecondaryButton, EmptyState, ThemedSelect, TERRACOTTA } from '../_components/ui';

// ── types ────────────────────────────────────────────────────────────────
type Status = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'PAID_LEAVE' | 'UNPAID_LEAVE';
type DayType = 'WORKING' | 'WEEKLY_OFF' | 'HOLIDAY';
interface DayRecord { status: Status; checkIn: string | null; checkOut: string | null; source: string; note: string | null }
interface DayStaff { id: string; name: string; designation: string | null; staffType: string; employeeCode: string | null; machineId: string | null; avatarUrl: string | null; joinedAt?: string | null; exitDate?: string | null; record: DayRecord | null }
interface DayData { date: string; dayType: DayType; holidayName: string | null; staff: DayStaff[] }
interface Summary { workingDays: number; present: number; late: number; halfDay: number; absent: number; paidLeave: number; unpaidLeave: number; unmarked: number }
interface MonthStaff { id: string; name: string; designation: string | null; employeeCode: string | null; machineId: string | null; avatarUrl: string | null; joinedAt: string | null; exitDate: string | null; days: Record<string, { s: Status; in: string | null; out: string | null; src: string }>; summary: Summary | null; lopDays: number }
interface MonthData { month: string; days: { date: string; type: DayType; holidayName: string | null }[]; staff: MonthStaff[]; rules: { lopEnabled: boolean; lateRuleEnabled: boolean; lateRuleCount: number } }

const STATUS: Record<Status, { code: string; label: string; cls: string }> = {
    PRESENT: { code: 'P', label: 'Present', cls: 'bg-emerald-500 text-white' },
    LATE: { code: 'L', label: 'Late', cls: 'bg-amber-500 text-white' },
    HALF_DAY: { code: 'H', label: 'Half day', cls: 'bg-orange-500 text-white' },
    ABSENT: { code: 'A', label: 'Absent', cls: 'bg-red-500 text-white' },
    PAID_LEAVE: { code: 'PL', label: 'Paid leave', cls: 'bg-sky-500 text-white' },
    UNPAID_LEAVE: { code: 'UL', label: 'Unpaid leave', cls: 'bg-rose-600 text-white' },
};
const ORDER: Status[] = ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'PAID_LEAVE', 'UNPAID_LEAVE'];
const CELL_TEXT: Record<Status, string> = {
    PRESENT: 'text-emerald-600 dark:text-emerald-400', LATE: 'text-amber-600 dark:text-amber-400', HALF_DAY: 'text-orange-600 dark:text-orange-400',
    ABSENT: 'text-red-600 dark:text-red-400', PAID_LEAVE: 'text-sky-600 dark:text-sky-400', UNPAID_LEAVE: 'text-rose-600 dark:text-rose-400',
};

// ── date helpers ─────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const shiftDate = (iso: string, days: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + days); return toISO(d); };
const shiftMonth = (month: string, n: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthName = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };
const minutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const workedLabel = (a?: string | null, b?: string | null) => {
    if (!a || !b) return null;
    const diff = minutes(b) - minutes(a);
    return diff > 0 ? `${Math.floor(diff / 60)}h ${pad(diff % 60)}m` : null;
};

const d10 = (v?: string | null) => (v ? v.slice(0, 10) : null);
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
/** "Joins 16 Oct" / "Left 3 Sep" when the date is outside this person's time on staff, else null. */
function notOnStaff(date: string, joinedAt?: string | null, exitDate?: string | null): string | null {
    const j = d10(joinedAt), x = d10(exitDate);
    if (j && date < j) return `Joins ${shortDay(j)}`;
    if (x && date > x) return `Left ${shortDay(x)}`;
    return null;
}

function Avatar({ url, name }: { url: string | null; name: string }) {
    return (
        <div className="relative w-9 h-9 rounded-lg bg-muted ring-1 ring-border shrink-0 overflow-hidden flex items-center justify-center">
            {url ? <NextImage src={url} alt={name} fill sizes="72px" quality={90} className="object-cover" />
                : <span className="text-[11px] font-bold text-muted-foreground">{name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>}
        </div>
    );
}

// Same toggle look as Attendance -> Daily / Overall.
function ViewToggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; Icon: React.ElementType }[] }) {
    return (
        <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
            {options.map(({ key, label, Icon }) => (
                <button key={key} onClick={() => onChange(key)}
                    className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${value === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Icon size={14} /> {label}
                </button>
            ))}
        </div>
    );
}

export default function StaffAttendancePage() {
    const [view, setView] = useState<'DAILY' | 'MONTHLY'>('DAILY');
    const [importOpen, setImportOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    return (
        <div className="flex flex-col gap-3 h-[calc(100%+0.75rem)] -mb-6 min-h-0">
            <PageHeader title="Staff Attendance" subtitle="Mark by hand or import from your fingerprint / RFID machine. LOP days flow into payroll.">
                <ViewToggle value={view} onChange={setView} options={[{ key: 'DAILY', label: 'Daily', Icon: CalendarCheck }, { key: 'MONTHLY', label: 'Monthly', Icon: BarChart2 }]} />
                <PrimaryButton onClick={() => setImportOpen(true)}><Upload size={14} /> Import from machine</PrimaryButton>
            </PageHeader>

            <div className="flex-1 min-h-0">
                {view === 'DAILY' ? <DailyView key={`d${refreshKey}`} /> : <MonthlyView key={`m${refreshKey}`} />}
            </div>

            {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onDone={() => setRefreshKey(k => k + 1)} />}
        </div>
    );
}

// ── Daily ────────────────────────────────────────────────────────────────
type Draft = { status: Status | null; checkIn: string | null; checkOut: string | null };

function DailyView() {
    const [date, setDate] = useState(todayISO());
    const [data, setData] = useState<DayData | null>(null);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const load = useCallback((d: string) => {
        setLoading(true);
        api.get('/admin/payroll/attendance/day', { params: { date: d } })
            .then(r => { setData(r.data.data); setDrafts({}); })
            .catch(err => toast.error(getErrorMessage(err, 'Could not load attendance')))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(date); }, [date, load]);

    const current = (s: DayStaff): Draft => drafts[s.id] ?? { status: s.record?.status ?? null, checkIn: s.record?.checkIn ?? null, checkOut: s.record?.checkOut ?? null };
    const setDraft = (s: DayStaff, patch: Partial<Draft>) => setDrafts(d => ({ ...d, [s.id]: { ...current(s), ...patch } }));
    const dirtyIds = Object.keys(drafts);

    const counts = useMemo(() => {
        const c: Record<string, number> = { none: 0 };
        for (const s of data?.staff ?? []) { const st = current(s).status; c[st ?? 'none'] = (c[st ?? 'none'] ?? 0) + 1; }
        return c;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, drafts]);

    const allPresent = () => {
        const next = { ...drafts };
        for (const s of data?.staff ?? []) if (!current(s).status) next[s.id] = { ...current(s), status: 'PRESENT' };
        setDrafts(next);
    };

    // Same as the class attendance: saves by itself 2s after the last change; the button saves right away.
    const save = async () => {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        if (!data || !Object.keys(drafts).length) return;
        const snapshot = drafts;
        setSaveStatus('saving');
        try {
            await api.put('/admin/payroll/attendance/day', {
                date,
                items: Object.keys(snapshot).map(id => ({ staffId: id, status: snapshot[id].status, checkIn: snapshot[id].checkIn || null, checkOut: snapshot[id].checkOut || null })),
            });
            // Keep what's on screen: fold the saved marks into the loaded day (now hand-marked)
            // and drop only the drafts that didn't change again while saving.
            setData(prev => prev && ({
                ...prev,
                staff: prev.staff.map(st => {
                    const d = snapshot[st.id];
                    if (!d) return st;
                    return { ...st, record: d.status ? { status: d.status, checkIn: d.checkIn, checkOut: d.checkOut, source: 'MANUAL', note: st.record?.note ?? null } : null };
                }),
            }));
            setDrafts(cur => Object.fromEntries(Object.entries(cur).filter(([id, d]) => d !== snapshot[id])));
            setSaveStatus('saved');
            if (savedTimer.current) clearTimeout(savedTimer.current);
            savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not save attendance'));
            setSaveStatus('idle');
        }
    };

    // Leaving the day with unsaved marks: save them first (they belong to the current date).
    const goTo = async (next: string) => {
        if (Object.keys(drafts).length) await save();
        setDate(next);
    };

    useEffect(() => {
        if (!Object.keys(drafts).length) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => { save(); }, 2000);
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drafts]);

    return (
        <div className="h-full flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden">
            {/* date bar */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-1.5">
                    <button onClick={() => goTo(shiftDate(date, -1))} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/60"><ChevronLeft size={16} /></button>
                    <input type="date" value={date} max={todayISO()} onChange={e => e.target.value && goTo(e.target.value)}
                        className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:border-foreground/30" />
                    <button onClick={() => goTo(shiftDate(date, 1))} disabled={date >= todayISO()} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/60 disabled:opacity-30"><ChevronRight size={16} /></button>
                    {date !== todayISO() && <button onClick={() => goTo(todayISO())} className="h-8 px-2.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60">Today</button>}
                    <span className="ml-1 text-sm font-semibold hidden sm:inline">{longDate(date)}</span>
                </div>
                <SecondaryButton onClick={allPresent} disabled={!counts.none}><CheckCheck size={13} /> All present</SecondaryButton>
            </div>

            {data && data.dayType !== 'WORKING' && (
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 text-xs bg-sky-500/10 text-sky-700 dark:text-sky-300 border-b border-border/50">
                    <CalendarOff size={14} />
                    {data.dayType === 'HOLIDAY' ? `Holiday: ${data.holidayName ?? 'School holiday'}` : 'Weekly off'}. Nothing is needed today; anything you mark still counts.
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
            {loading ? (
                <div className="p-4 space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />)}</div>
            ) : !data || data.staff.length === 0 ? (
                <div className="p-4"><EmptyState icon={CalendarCheck} title="No staff yet" text="Add people in Payroll → Staff first. Their attendance shows up here." /></div>
            ) : (
                <div className="divide-y divide-border/40">
                    {data.staff.map(s => {
                        const d = current(s);
                        const dirty = !!drafts[s.id];
                        const worked = workedLabel(d.checkIn, d.checkOut);
                        return (
                            <div key={s.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5`}>
                                <Avatar url={s.avatarUrl} name={s.name} />
                                <div className="min-w-0 flex-1 basis-40">
                                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                                        {s.name}
                                        {s.record && !dirty && (s.record.source === 'MANUAL'
                                            ? <span title="Marked by hand"><Hand size={12} className="text-muted-foreground" /></span>
                                            : <span title="From the attendance machine"><Fingerprint size={12} className="text-emerald-600" /></span>)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        {[s.designation, s.machineId ? `Machine ID ${s.machineId}` : 'No machine ID'].filter(Boolean).join(' · ')}
                                    </p>
                                    {notOnStaff(date, s.joinedAt, s.exitDate) && (
                                        <p className="text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">{notOnStaff(date, s.joinedAt, s.exitDate)} · this day is not counted for salary</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px]">
                                    <label className="flex items-center gap-1 text-muted-foreground">In
                                        <input type="time" value={d.checkIn ?? ''} onChange={e => setDraft(s, { checkIn: e.target.value || null })}
                                            className="h-8 w-[88px] px-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:border-foreground/30" />
                                    </label>
                                    <label className="flex items-center gap-1 text-muted-foreground">Out
                                        <input type="time" value={d.checkOut ?? ''} onChange={e => setDraft(s, { checkOut: e.target.value || null })}
                                            className="h-8 w-[88px] px-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:border-foreground/30" />
                                    </label>
                                    <span className="w-14 text-right tabular-nums text-muted-foreground">{worked ?? ''}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {ORDER.map(st => {
                                        const on = d.status === st;
                                        return (
                                            <button key={st} title={STATUS[st].label} onClick={() => setDraft(s, { status: on ? null : st })}
                                                className={`h-8 min-w-8 px-2 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${on ? `${STATUS[st].cls} border-transparent shadow-sm` : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                                                {STATUS[st].code}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            </div>

            {/* footer: counts + save (same as the class attendance) */}
            {data && data.staff.length > 0 && (
                <div className="shrink-0 px-4 py-2.5 border-t border-border/60 bg-card space-y-1">
                    <div className="relative flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground/60">Total: {data.staff.length}</span>
                        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
                            {[
                                { label: 'P', count: counts.PRESENT ?? 0, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
                                { label: 'L', count: counts.LATE ?? 0, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
                                { label: 'H', count: counts.HALF_DAY ?? 0, cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' },
                                { label: 'A', count: counts.ABSENT ?? 0, cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
                                { label: 'PL', count: counts.PAID_LEAVE ?? 0, cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400' },
                                { label: 'UL', count: counts.UNPAID_LEAVE ?? 0, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' },
                                { label: '—', count: counts.none ?? 0, cls: 'bg-muted text-muted-foreground' },
                            ].map(c => <span key={c.label} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}: {c.count}</span>)}
                        </div>
                        <button onClick={save} disabled={saveStatus === 'saving' || !Object.keys(drafts).length && saveStatus !== 'saved'}
                            className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                            style={{ background: saveStatus === 'saved' ? '#10b981' : TERRACOTTA }}>
                            {saveStatus === 'saving'
                                ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                : saveStatus === 'saved' ? <CheckCircle2 size={12} /> : <Save size={12} />}
                            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save Attendance'}
                        </button>
                    </div>
                    <p className="text-[11px]">
                        {data.dayType === 'HOLIDAY' ? <span className="text-red-500 font-semibold">Holiday — no attendance needed</span>
                            : data.dayType === 'WEEKLY_OFF' ? <span className="text-red-500 font-semibold">Weekly off — no attendance needed</span>
                                : counts.none ? <span className="text-amber-500 font-semibold">{counts.none} staff unmarked</span>
                                    : <span className="text-emerald-500 font-semibold">All staff marked ✓</span>}
                        <span className="text-muted-foreground/60"> · saves automatically</span>
                    </p>
                </div>
            )}
        </div>
    );
}

// ── Monthly: same look as the class Attendance Sheet (teacher / admin) ──
const SHEET = { paper: '#F5F8EE', head: '#ECF3D0', line: 'border-[#BACE85]/50', ink: '#2A3A10' };
const HAND_COLOR: Record<Status, string> = { PRESENT: '#16a34a', LATE: '#d97706', HALF_DAY: '#ea580c', ABSENT: '#dc2626', PAID_LEAVE: '#0284c7', UNPAID_LEAVE: '#be123c' };
const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const AV_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];

function MonthlyView() {
    const now = new Date();
    const [fyStart, setFyStart] = useState(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1);
    const [month, setMonth] = useState(todayISO().slice(0, 7));
    const [data, setData] = useState<MonthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [rebuilding, setRebuilding] = useState(false);
    const monthIdx = (m: string) => { const mm = +m.slice(5, 7); return mm >= 4 ? mm - 4 : mm + 8; }; // position in Apr..Mar
    const [offset, setOffset] = useState(() => Math.max(0, Math.min(9, monthIdx(todayISO().slice(0, 7)) - 1)));
    const fyMonthKey = (i: number) => { const mm = i < 9 ? i + 4 : i - 8; return `${i < 9 ? fyStart : fyStart + 1}-${pad(mm)}`; };

    const load = useCallback((m: string) => {
        setLoading(true);
        api.get('/admin/payroll/attendance/month', { params: { month: m } })
            .then(r => setData(r.data.data))
            .catch(err => toast.error(getErrorMessage(err, 'Could not load the month')))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(month); }, [month, load]);

    const rebuild = async () => {
        setRebuilding(true);
        try {
            const r = await api.post('/admin/payroll/attendance/rebuild', { month });
            toast.success(`Machine data applied again (${r.data.data.daysUpdated} days)`);
            load(month);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not apply machine data'));
        } finally {
            setRebuilding(false);
        }
    };

    const exportSheet = () => {
        if (!data) return;
        const headers = ['Emp ID', 'Name', 'Machine ID', ...data.days.map(d => String(+d.date.slice(8))), 'P', 'L', 'H', 'A', 'PL', 'UL', 'Not marked', 'Working days', 'LOP'];
        const rows = data.staff.map(s => [
            s.employeeCode ?? '', s.name, s.machineId ?? '',
            ...data.days.map(d => d.type === 'HOLIDAY' ? 'Holiday' : s.days[d.date] ? STATUS[s.days[d.date].s].code : d.type === 'WEEKLY_OFF' ? 'Off' : '—'),
            s.summary?.present ?? 0, s.summary?.late ?? 0, s.summary?.halfDay ?? 0, s.summary?.absent ?? 0, s.summary?.paidLeave ?? 0, s.summary?.unpaidLeave ?? 0, s.summary?.unmarked ?? 0, s.summary?.workingDays ?? 0, s.lopDays,
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${monthName(month)}`.slice(0, 31));
        XLSX.writeFile(wb, `Staff_Attendance_${month}.xlsx`);
    };

    const fyLabel = `${fyStart}–${String(fyStart + 1).slice(2)}`;
    const th = `border ${SHEET.line} px-1 py-1 text-center font-semibold whitespace-nowrap`;
    const hand = (st: Status) => (
        <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: STATUS[st].code.length > 1 ? '13px' : '16px', fontWeight: 700, lineHeight: 1, color: HAND_COLOR[st], display: 'block' }}>{STATUS[st].code}</span>
    );

    return (
        <div className="h-full flex flex-col gap-3 min-h-0">
            {data && !data.rules.lopEnabled && (
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    <AlertTriangle size={14} /> LOP from attendance is off. Turn it on in Payroll → Settings → General → Attendance to use these numbers in payroll.
                </div>
            )}
            <div className="w-full flex-1 flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl shadow-sm shadow-black/5">
                {/* Header: title + month chips + actions (same as the class sheet) */}
                <div className="px-4 py-2.5 border-b border-border/40 shrink-0 flex flex-wrap items-center gap-3">
                    <div className="shrink-0">
                        <p className="text-[14px] font-bold flex items-center gap-2"><CalendarCheck size={14} /> Staff Attendance Sheet</p>
                        <p className="px-6 text-[10.5px] text-muted-foreground">Financial Year {fyLabel} · {monthName(month).split(' ')[0]}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => { if (offset === 0) { setFyStart(y => y - 1); setOffset(9); } else setOffset(v => v - 1); }} title={offset === 0 ? 'Previous financial year' : undefined}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all"><ChevronLeft size={13} /></button>
                        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-border/40">
                            {FY_MONTHS.slice(offset, offset + 3).map((short, i) => {
                                const key = fyMonthKey(offset + i);
                                const active = key === month;
                                return (
                                    <button key={key} onClick={() => setMonth(key)}
                                        className={`relative px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                        {short}
                                        {key === todayISO().slice(0, 7) && !active && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#DA7756]" />}
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => { if (offset >= 9) { setFyStart(y => y + 1); setOffset(0); } else setOffset(v => v + 1); }} title={offset >= 9 ? 'Next financial year' : undefined}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all"><ChevronRight size={13} /></button>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={rebuild} disabled={rebuilding} title="After adding machine IDs, apply the imported punches again"
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-50">
                            {rebuilding ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Re-apply machine data
                        </button>
                        <button onClick={exportSheet} disabled={!data}
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50"
                            style={{ background: TERRACOTTA }}>⬇ Export</button>
                    </div>
                </div>

                {/* Sheet */}
                {loading || !data ? (
                    <div className="flex-1 p-4"><div className="h-full rounded-xl bg-muted/40 animate-pulse" /></div>
                ) : data.staff.length === 0 ? (
                    <div className="flex-1 p-4"><EmptyState icon={BarChart2} title="No staff yet" text="Add people in Payroll → Staff first." /></div>
                ) : (
                    <div style={{ flex: 1, minHeight: 0, overflowX: 'scroll', overflowY: 'auto', background: SHEET.paper, scrollbarWidth: 'thin', scrollbarColor: `#BACE85 ${SHEET.paper}` }}>
                        <table className="text-[10px] border-separate border-spacing-0" style={{ tableLayout: 'fixed' }}>
                            <thead className="sticky top-0 z-30">
                                <tr className="text-[11.5px]" style={{ color: SHEET.ink }}>
                                    <th className={`sticky left-0 z-20 bg-[#ECF3D0] ${th} text-left px-2 text-[11px] w-[68px] min-w-[68px]`}>Emp ID</th>
                                    <th className={`sticky left-[68px] z-20 bg-[#ECF3D0] ${th} text-left px-2 text-[11px] w-[150px] min-w-[150px]`}>Name</th>
                                    <th className={`bg-[#ECF3D0] ${th} text-left px-2 text-[11px] w-[82px] min-w-[82px]`}>Machine ID</th>
                                    {data.days.map(d => {
                                        const off = d.type !== 'WORKING';
                                        const isToday = d.date === todayISO();
                                        return (
                                            <th key={d.date} title={d.holidayName ?? (d.type === 'WEEKLY_OFF' ? 'Weekly off' : undefined)}
                                                className={`${th} py-2 w-[30px] min-w-[30px] ${off ? 'bg-[#FFF0F0] text-red-500' : isToday ? 'bg-[#EEF4FF] text-[#4A6FA5]' : 'bg-[#ECF3D0]'}`}>
                                                {+d.date.slice(8)}
                                            </th>
                                        );
                                    })}
                                    <th title="Present" className={`sticky right-[298px] z-20 bg-[#ECF3D0] ${th} text-emerald-700 w-[36px] min-w-[36px]`}>P</th>
                                    <th title="Late" className={`sticky right-[262px] z-20 bg-[#ECF3D0] ${th} text-amber-600 w-[36px] min-w-[36px]`}>L</th>
                                    <th title="Half day" className={`sticky right-[226px] z-20 bg-[#ECF3D0] ${th} text-orange-600 w-[36px] min-w-[36px]`}>H</th>
                                    <th title="Absent" className={`sticky right-[190px] z-20 bg-[#ECF3D0] ${th} text-red-500 w-[36px] min-w-[36px]`}>A</th>
                                    <th title="Paid / unpaid leave" className={`sticky right-[144px] z-20 bg-[#ECF3D0] ${th} text-sky-600 w-[46px] min-w-[46px]`}>PL/UL</th>
                                    <th title="Working days with nothing marked (counted as present)" className={`sticky right-[104px] z-20 bg-[#ECF3D0] ${th} text-muted-foreground w-[40px] min-w-[40px]`}>NM</th>
                                    <th title="Working days" className={`sticky right-[58px] z-20 bg-[#ECF3D0] ${th} w-[46px] min-w-[46px]`}>T</th>
                                    <th title="Loss of pay days" className={`sticky right-0 z-20 bg-[#ECF3D0] ${th} w-[58px] min-w-[58px]`}>LOP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.staff.map((s, si) => (
                                    <tr key={s.id} className="bg-[#F5F8EE] hover:bg-[#E0E8C8] transition-colors" style={{ color: SHEET.ink }}>
                                        <td className={`sticky left-0 z-10 border ${SHEET.line} px-2 py-2 text-[11px] font-semibold text-center bg-[#F5F8EE] w-[68px]`}>{s.employeeCode ?? '—'}</td>
                                        <td className={`sticky left-[68px] z-10 border ${SHEET.line} px-2 py-1.5 text-[11px] font-medium whitespace-nowrap bg-[#F5F8EE] w-[150px] overflow-hidden`}>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-[9px] font-bold text-white shrink-0 relative"
                                                    style={{ background: s.avatarUrl ? 'transparent' : AV_COLORS[s.name.charCodeAt(0) % AV_COLORS.length] }}>
                                                    {s.avatarUrl ? <NextImage src={s.avatarUrl} alt={s.name} fill sizes="20px" className="object-cover" />
                                                        : s.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="block truncate">{s.name}</span>
                                                    {(() => { const j = d10(s.joinedAt), x = d10(s.exitDate); const last = data.days[data.days.length - 1].date, first = data.days[0].date;
                                                        const t = j && j > first ? `Joins ${shortDay(j)}` : x && x < last ? `Left ${shortDay(x)}` : null;
                                                        return t ? <span className="block text-[9px] font-semibold text-amber-600">{t}</span> : null; })()}
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`border ${SHEET.line} px-2 py-2 font-mono text-[12px] whitespace-nowrap bg-[#F5F8EE]`} style={{ color: '#DA7756' }}>{s.machineId ?? '—'}</td>
                                        {data.days.map(d => {
                                            if (d.type === 'HOLIDAY') {
                                                if (si !== 0) return null;
                                                return (
                                                    <td key={d.date} rowSpan={data.staff.length} className="border border-red-200 text-center align-middle relative" style={{ background: '#FEF2F2', minWidth: 30 }}>
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none"><line x1="50%" y1="0" x2="50%" y2="100%" stroke="#FCA5A5" strokeWidth="1" /></svg>
                                                            <span style={{ color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap', writingMode: 'vertical-rl', transform: 'rotate(180deg)', background: '#FEF2F2', padding: '2px 0', position: 'relative', zIndex: 1, fontFamily: 'Arial, "Segoe UI", sans-serif', letterSpacing: '0.5px', fontSize: 11 }}>
                                                                {d.holidayName ? `Holiday — ${d.holidayName}` : 'Holiday'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            const c = s.days[d.date];
                                            const off = d.type === 'WEEKLY_OFF';
                                            const outside = notOnStaff(d.date, s.joinedAt, s.exitDate);
                                            return (
                                                <td key={d.date} title={outside ? `${outside} · not counted` : c ? `${STATUS[c.s].label}${c.in ? ` · in ${c.in}` : ''}${c.out ? ` · out ${c.out}` : ''}${c.src !== 'MANUAL' ? ' · from machine' : ''}` : off ? 'Weekly off' : 'Not marked'}
                                                    className={`border ${SHEET.line} px-1 py-2 text-center relative ${outside ? 'bg-[repeating-linear-gradient(135deg,#E9EDDC_0_4px,#F5F8EE_4px_8px)] opacity-60' : off ? 'bg-[#FFF5F5]' : d.date === todayISO() ? 'bg-[#EEF4FF]' : ''}`}>
                                                    {c ? hand(c.s) : <span className="text-[#BACE85]">—</span>}
                                                    {c && c.src !== 'MANUAL' && <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-emerald-500" />}
                                                </td>
                                            );
                                        })}
                                        <td className={`sticky right-[298px] z-10 border ${SHEET.line} px-1 py-2 text-center text-[11.5px] font-bold text-emerald-700 bg-[#F5F8EE]`}>{s.summary?.present || '—'}</td>
                                        <td className={`sticky right-[262px] z-10 border ${SHEET.line} px-1 py-2 text-center text-[11.5px] font-bold text-amber-600 bg-[#F5F8EE]`}>{s.summary?.late || '—'}</td>
                                        <td className={`sticky right-[226px] z-10 border ${SHEET.line} px-1 py-2 text-center text-[11.5px] font-bold text-orange-600 bg-[#F5F8EE]`}>{s.summary?.halfDay || '—'}</td>
                                        <td className={`sticky right-[190px] z-10 border ${SHEET.line} px-1 py-2 text-center text-[11.5px] font-bold text-red-500 bg-[#F5F8EE]`}>{s.summary?.absent || '—'}</td>
                                        <td className={`sticky right-[144px] z-10 border ${SHEET.line} px-1 py-2 text-center text-[11.5px] font-bold text-sky-600 bg-[#F5F8EE]`}>{s.summary && (s.summary.paidLeave || s.summary.unpaidLeave) ? `${s.summary.paidLeave}/${s.summary.unpaidLeave}` : '—'}</td>
                                        <td title="Not marked (counted as present)" className={`sticky right-[104px] z-10 border ${SHEET.line} px-1 py-2 text-center text-[11.5px] font-bold text-slate-500 bg-[#F5F8EE]`}>{s.summary?.unmarked || '—'}</td>
                                        <td className={`sticky right-[58px] z-10 border ${SHEET.line} px-1 py-2 text-center text-[11.5px] font-bold bg-[#F5F8EE]`}>{s.summary?.workingDays || '—'}</td>
                                        <td className={`sticky right-0 z-10 border ${SHEET.line} px-2 py-2 text-center text-[11.5px] font-black bg-[#F5F8EE] ${s.lopDays ? 'text-red-500' : 'text-emerald-600'}`}>{s.lopDays}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer legend */}
                <div className="px-4 py-2 border-t border-border/40 shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 bg-card">
                    {ORDER.map(st => (
                        <div key={st} className="flex items-center gap-1.5">
                            <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: STATUS[st].code.length > 1 ? 13 : 16, fontWeight: 700, lineHeight: 1, color: HAND_COLOR[st] }}>{STATUS[st].code}</span>
                            <span className="text-[10px] text-muted-foreground">{STATUS[st].label}</span>
                        </div>
                    ))}
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 italic"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> from machine</span>
                    <span className="text-[10px] text-muted-foreground/60 italic">NM = not marked</span>
                    <span className="text-[10px] text-muted-foreground/50 ml-auto italic">
                        LOP = A + UL + H × 0.5{data?.rules.lateRuleEnabled ? ` + every ${data.rules.lateRuleCount} L × 0.5` : ''} · not marked = present
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── Import from machine ──────────────────────────────────────────────────
type Punch = { machineId: string; date: string; time: string };
const MAP_KEY = 'qx-staff-attendance-import-map';
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function parseDate(v: string, order: 'DMY' | 'MDY' | 'YMD'): string | null {
    const s = v.trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ,]+(\d{2,4})/);
    if (m && MONTHS[m[2].toLowerCase()]) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return `${y}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}`; }
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
        const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
        const [dd, mm] = order === 'MDY' ? [+m[2], +m[1]] : [+m[1], +m[2]];
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
        return `${y}-${pad(mm)}-${pad(dd)}`;
    }
    return null;
}
function parseTime(v: string): string | null {
    const m = v.trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
    if (!m) return null;
    let h = +m[1];
    if (m[4]) { const pm = m[4].toLowerCase() === 'pm'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
    if (h > 23 || +m[2] > 59) return null;
    return `${pad(h)}:${m[2]}:${m[3] ?? '00'}`;
}
const guess = (headers: string[], re: RegExp, not?: RegExp) => { const i = headers.findIndex(h => re.test(h) && !(not && not.test(h))); return i >= 0 ? String(i) : ''; };

function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const [fileName, setFileName] = useState('');
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<string[][]>([]);
    const [idCol, setIdCol] = useState('');
    const [dateCol, setDateCol] = useState('');
    const [timeCol, setTimeCol] = useState(''); // "" + combined = date column holds the time too
    const [combined, setCombined] = useState(false);
    const [order, setOrder] = useState<'DMY' | 'MDY' | 'YMD'>('DMY');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ received: number; added: number; from: string; to: string; matchedIds: number; unknownIds: string[]; daysUpdated: number } | null>(null);

    const readFile = async (f: File) => {
        try {
            const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const all = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' }).map(r => r.map(c => String(c ?? '').trim()));
            const hi = all.findIndex(r => r.filter(Boolean).length >= 2); // first real row = header
            if (hi < 0) { toast.error('This file looks empty'); return; }
            const hdr = all[hi].map((h, i) => h || `Column ${i + 1}`);
            const body = all.slice(hi + 1).filter(r => r.some(Boolean));
            setFileName(f.name); setHeaders(hdr); setRows(body); setResult(null);
            // Remember the last mapping (same machine = same file layout), else guess from the headers.
            let saved: { id: string; date: string; time: string; combined: boolean; order: 'DMY' | 'MDY' | 'YMD'; headers: string[] } | null = null;
            try { saved = JSON.parse(localStorage.getItem(MAP_KEY) ?? 'null'); } catch { /* ignore */ }
            if (saved && JSON.stringify(saved.headers) === JSON.stringify(hdr)) {
                setIdCol(saved.id); setDateCol(saved.date); setTimeCol(saved.time); setCombined(saved.combined); setOrder(saved.order);
            } else {
                const low = hdr.map(h => h.toLowerCase());
                setIdCol(guess(low, /(user|emp|enroll|badge|card|machine|ac.?no|pin|code|\bid\b)/, /name|date|time/));
                const dt = guess(low, /(date.*time|datetime|punch|log|check)/);
                const d = guess(low, /date/, /time/);
                const t = guess(low, /time/, /date/);
                if (d && t) { setDateCol(d); setTimeCol(t); setCombined(false); }
                // one column holds both (e.g. ZKTeco "Time" = "29/09/2026 07:55 AM")
                else { setDateCol(dt || d || t); setTimeCol(''); setCombined(true); }
                setOrder('DMY');
            }
        } catch {
            toast.error('Could not read this file. Use the CSV or Excel export from the machine software.');
        }
    };

    const parsed = useMemo(() => {
        const ok: Punch[] = []; let bad = 0;
        if (idCol === '' || dateCol === '' || (!combined && timeCol === '')) return { ok, bad };
        for (const r of rows) {
            const id = (r[+idCol] ?? '').replace(/\.0+$/, '').trim();
            const dv = r[+dateCol] ?? '';
            const date = parseDate(dv, order);
            const time = parseTime(combined ? dv.replace(/^\S+\s*/, '') || dv : (r[+timeCol] ?? ''));
            if (!id || !date || !time) { bad++; continue; }
            ok.push({ machineId: id, date, time });
        }
        return { ok, bad };
    }, [rows, idCol, dateCol, timeCol, combined, order]);

    const doImport = async () => {
        if (!parsed.ok.length) return;
        setBusy(true);
        try {
            try { localStorage.setItem(MAP_KEY, JSON.stringify({ id: idCol, date: dateCol, time: timeCol, combined, order, headers })); } catch { /* ignore */ }
            const agg = { received: 0, added: 0, from: '', to: '', matchedIds: 0, unknownIds: [] as string[], daysUpdated: 0 };
            for (let i = 0; i < parsed.ok.length; i += 15000) {
                const r = await api.post('/admin/payroll/attendance/import', { punches: parsed.ok.slice(i, i + 15000) });
                const d = r.data.data;
                agg.received += d.received; agg.added += d.added; agg.daysUpdated += d.daysUpdated;
                agg.from = !agg.from || d.from < agg.from ? d.from : agg.from; agg.to = d.to > agg.to ? d.to : agg.to;
                agg.matchedIds = Math.max(agg.matchedIds, d.matchedIds);
                agg.unknownIds = [...new Set([...agg.unknownIds, ...d.unknownIds])];
            }
            setResult(agg);
            onDone();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Import failed'));
        } finally {
            setBusy(false);
        }
    };

    const colOptions = headers.map((h, i) => ({ value: String(i), label: h }));

    return (
        <Dialog open onOpenChange={o => !o && !busy && onClose()}>
            <DialogContent className="sm:max-w-2xl bg-card max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden" onOpenAutoFocus={e => e.preventDefault()}>
                <DialogHeader className="shrink-0 px-5 pt-5 pb-4 border-b border-border/50">
                    <DialogTitle>Import from attendance machine</DialogTitle>
                    <DialogDescription>Export the punch / attendance log from your machine software (eSSL, ZKTeco, Matrix, Realtime…) as Excel or CSV and upload it here.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 text-xs">
                    {result ? (
                        <div className="space-y-3">
                            <div className="rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 p-3 font-semibold text-sm">
                                Imported {result.received} punches ({result.added} new) · {result.daysUpdated} staff-days updated
                            </div>
                            <p className="text-muted-foreground">Dates: {result.from} to {result.to}. {result.matchedIds} machine ID{result.matchedIds === 1 ? '' : 's'} matched to staff.</p>
                            {result.unknownIds.length > 0 && (
                                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5">
                                    <p className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><AlertTriangle size={13} /> {result.unknownIds.length} machine ID{result.unknownIds.length === 1 ? '' : 's'} not linked to anyone</p>
                                    <p className="text-muted-foreground">Add these in Payroll → Staff → Edit → Machine ID, then press <b>Re-apply machine data</b> on the Monthly view. The punches are already saved.</p>
                                    <p className="font-mono">{result.unknownIds.slice(0, 40).join(', ')}{result.unknownIds.length > 40 ? ' …' : ''}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-[#DA7756]/60 p-6 cursor-pointer text-center">
                                <FileSpreadsheet size={26} className="text-muted-foreground" />
                                <span className="font-semibold text-sm">{fileName || 'Choose the machine export file'}</span>
                                <span className="text-muted-foreground">.xlsx, .xls or .csv{rows.length ? ` · ${rows.length} rows` : ''}</span>
                                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
                            </label>

                            {headers.length > 0 && (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="space-y-1"><span className="font-semibold text-muted-foreground">Machine ID / Employee code column</span>
                                            <ThemedSelect value={idCol} options={colOptions} onChange={setIdCol} /></label>
                                        <label className="space-y-1"><span className="font-semibold text-muted-foreground">{combined ? 'Date & time column' : 'Date column'}</span>
                                            <ThemedSelect value={dateCol} options={colOptions} onChange={setDateCol} /></label>
                                        {!combined && (
                                            <label className="space-y-1"><span className="font-semibold text-muted-foreground">Time column</span>
                                                <ThemedSelect value={timeCol} options={colOptions} onChange={setTimeCol} /></label>
                                        )}
                                        <label className="space-y-1"><span className="font-semibold text-muted-foreground">Date format in the file</span>
                                            <ThemedSelect value={order} onChange={setOrder} options={[{ value: 'DMY', label: 'Day / Month / Year (29-09-2026)' }, { value: 'MDY', label: 'Month / Day / Year (09-29-2026)' }, { value: 'YMD', label: 'Year-Month-Day (2026-09-29)' }]} /></label>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer w-fit">
                                        <input type="checkbox" checked={combined} onChange={e => setCombined(e.target.checked)} className="accent-[#DA7756]" />
                                        Date and time are in the same column
                                    </label>

                                    <div className="rounded-xl border border-border/60 overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-2 bg-muted/40 font-semibold">
                                            <span>Preview</span>
                                            <span className="text-muted-foreground font-normal">{parsed.ok.length} punches read{parsed.bad ? ` · ${parsed.bad} rows skipped` : ''}</span>
                                        </div>
                                        <table className="w-full">
                                            <thead><tr className="text-muted-foreground"><th className="text-left px-3 py-1.5">Machine ID</th><th className="text-left px-3 py-1.5">Date</th><th className="text-left px-3 py-1.5">Time</th></tr></thead>
                                            <tbody>
                                                {parsed.ok.slice(0, 6).map((p, i) => (
                                                    <tr key={i} className="border-t border-border/40 font-mono"><td className="px-3 py-1">{p.machineId}</td><td className="px-3 py-1">{p.date}</td><td className="px-3 py-1">{p.time}</td></tr>
                                                ))}
                                                {!parsed.ok.length && <tr><td colSpan={3} className="px-3 py-3 text-center text-muted-foreground">Pick the right columns above to see the punches.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-muted-foreground">First punch of the day is check-in, last is check-out. Importing the same file again adds nothing new. Days you marked by hand are kept.</p>
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-border/50 bg-muted/20">
                    {result ? <PrimaryButton onClick={onClose}>Done</PrimaryButton> : (
                        <>
                            <SecondaryButton onClick={onClose} disabled={busy}><X size={13} /> Cancel</SecondaryButton>
                            <button type="button" onClick={doImport} disabled={busy || !parsed.ok.length}
                                className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50" style={{ background: TERRACOTTA }}>
                                {busy ? <><Loader2 size={13} className="animate-spin" /> Importing…</> : <><Upload size={13} /> Import {parsed.ok.length || ''} punches</>}
                            </button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
