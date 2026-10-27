'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Clock, Copy, FlaskConical, Minus, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { PrimaryButton, SecondaryButton, ThemedSelect } from '@/app/admin/payroll/_components/ui';
import { hhmm, ROOM_KINDS, roomKindLabel, roomTypeOf, type Activity, type Suggestion, type Workspace } from './ttai';

// The short questions before the first build: the school day, how many periods
// each subject gets in a week (with double periods, labs and activities), and
// the labs or grounds the school has. Chips and +/- only, no forms.

const Chip = ({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) => (
    <button type="button" onClick={onClick} aria-pressed={on} title={title}
        className={`h-8 rounded-full px-3 text-xs font-semibold transition ${on ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/60 text-muted-foreground hover:text-foreground'}`}>{children}</button>
);

export function Bubble({ children, tone = 'ai' }: { children: React.ReactNode; tone?: 'ai' | 'done' }) {
    return (
        <div className={`rounded-2xl p-4 text-sm ${tone === 'done' ? 'bg-emerald-500/10 dark:bg-white/[0.04]' : 'bg-muted/40 dark:bg-white/[0.04]'} dark:ring-1 dark:ring-white/[0.06]`}>{children}</div>
    );
}

/** One part of the Setup box in the assistant panel (the box draws the background and dividers). */
const Frame = ({ children }: { children: React.ReactNode }) => <div className="p-3.5 text-sm">{children}</div>;

/** The round marker on the left of each setup step: a tick when done, else its number. */
function StepDot({ n, done }: { n: number; done: boolean }) {
    return done
        ? <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"><Check size={13} strokeWidth={3} /></span>
        : <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-bold text-muted-foreground ring-1 ring-white/10">{n}</span>;
}
const StepLabel = ({ n }: { n: number }) => <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Step {n}</p>;

/** A step that opens once the one before it is done. */
export function StepPending({ n, title, text }: { n: number; title: string; text: string }) {
    return (
        <Frame>
            <div className="flex items-start gap-3 opacity-60">
                <StepDot n={n} done={false} />
                <div className="min-w-0 flex-1"><StepLabel n={n} /><p className="text-[13px] font-semibold">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div>
            </div>
        </Frame>
    );
}

function Done({ step, title, text, onEdit, extra }: { step: number; title: string; text: string; onEdit?: () => void; extra?: React.ReactNode }) {
    return (
        <Frame>
            <div className="flex items-start gap-3">
                <StepDot n={step} done />
                <div className="min-w-0 flex-1">
                    <StepLabel n={step} />
                    <p className="text-[13px] font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{text}</p>
                    {extra}
                </div>
                {onEdit && <button type="button" onClick={onEdit} className="text-xs font-semibold text-primary hover:underline">Change</button>}
            </div>
        </Frame>
    );
}

// ── 1. School day ─────────────────────────────────────────────────────────────
export function DayCard({ ws, params, onSaved, collapsed, onEdit, onCancel }: { ws: Workspace; params: Record<string, string>; onSaved: () => void; collapsed: boolean; onEdit: () => void; onCancel?: () => void }) {
    const { years } = useAcademicYear();
    const periods0 = ws.slots.filter(s => s.kind === 'PERIOD');
    const [days, setDays] = useState<number[]>(ws.workingDays.length ? ws.workingDays : [1, 2, 3, 4, 5, 6]);
    const [start, setStart] = useState(periods0[0]?.startMinute ?? 8 * 60);
    const [length, setLength] = useState(periods0[0] ? periods0[0].endMinute - periods0[0].startMinute : 40);
    const [count, setCount] = useState(periods0.length || 8);
    const breakAfter = (kind: 'BREAK' | 'LUNCH') => {
        const i = ws.slots.findIndex(s => s.kind === kind);
        return i < 0 ? 0 : ws.slots.slice(0, i).filter(s => s.kind === 'PERIOD').length;
    };
    const [shortAfter, setShortAfter] = useState(ws.slots.length ? breakAfter('BREAK') : 3);
    const [lunchAfter, setLunchAfter] = useState(ws.slots.length ? breakAfter('LUNCH') : 5);
    const [lunchMin, setLunchMin] = useState(() => { const l = ws.slots.find(s => s.kind === 'LUNCH'); return l ? l.endMinute - l.startMinute : 30; });
    const [shortMin, setShortMin] = useState(() => { const b = ws.slots.find(s => s.kind === 'BREAK'); return b ? b.endMinute - b.startMinute : 15; });
    const [saving, setSaving] = useState(false);
    const [tune, setTune] = useState(false);
    const ends = start + count * length + (shortAfter && shortAfter < count ? shortMin : 0) + (lunchAfter && lunchAfter < count ? lunchMin : 0);
    const lastYear = years.filter(y => y.id !== ws.year.id).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

    const save = async (force = false) => {
        setSaving(true);
        try {
            const breaks = [
                ...(shortAfter && shortAfter < count ? [{ afterPeriod: shortAfter, minutes: shortMin, kind: 'BREAK' as const }] : []),
                ...(lunchAfter && lunchAfter < count ? [{ afterPeriod: lunchAfter, minutes: lunchMin, kind: 'LUNCH' as const }] : []),
            ];
            await api.post('/admin/timetable/ai/quick-setup', { workingDays: days, startMinute: start, periodMinutes: length, periods: count, breaks, ...(force ? { force: true } : {}) }, { params });
            toast.success('School day saved');
            onSaved();
        } catch (err) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 409 && !force && window.confirm('Changing the school day clears the timetable that is already built. Continue?')) { setSaving(false); return save(true); }
            toast.error(getErrorMessage(err, 'Could not save the school day'));
        } finally { setSaving(false); }
    };

    const copyLast = async () => {
        if (!lastYear) return;
        setSaving(true);
        try {
            await api.post('/admin/timetable/slots/copy-from-year', { fromAcademicYearId: lastYear.id }, { params });
            toast.success(`Timings copied from ${lastYear.label}`);
            onSaved();
        } catch (err) { toast.error(getErrorMessage(err, `Could not copy from ${lastYear.label}`)); }
        finally { setSaving(false); }
    };

    if (collapsed) {
        if (tune) return <TimingsCard ws={ws} params={params} onClose={() => setTune(false)} onSaved={() => { setTune(false); onSaved(); }} />;
        return (
            <Done step={1} title="School day" onEdit={onEdit}
                text={`${periods0.length} periods, ${hhmm(ws.slots[0]?.startMinute ?? 0)} to ${hhmm(ws.slots[ws.slots.length - 1]?.endMinute ?? 0)}, ${ws.workingDays.length} days a week`}
                extra={<button type="button" onClick={() => setTune(true)} className="mt-1 text-[11px] font-semibold text-primary hover:underline">Adjust each period&apos;s time</button>} />
        );
    }
    const times = Array.from({ length: 21 }, (_, i) => 6 * 60 + 30 + i * 15);
    return (
        <Frame>
            <div className="flex items-center justify-between gap-2">
                <div><StepLabel n={1} /><p className="flex items-center gap-2 font-semibold"><Clock size={15} className="text-primary" />When is school?</p></div>
                {onCancel && <button type="button" aria-label="Close" onClick={onCancel} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X size={14} /></button>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Tap to choose. I will make the periods and breaks.</p>
            {!ws.slots.length && lastYear && (
                <button type="button" disabled={saving} onClick={() => void copyLast()} className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-primary/5" data-admin-surface="">
                    <Copy size={12} />Same as {lastYear.label}
                </button>
            )}
            <div className="mt-3 space-y-3">
                <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Days</p>
                    <div className="flex flex-wrap gap-1.5">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                            <Chip key={d} on={days.includes(i + 1)} onClick={() => setDays(v => (v.includes(i + 1) ? v.filter(x => x !== i + 1) : [...v, i + 1].sort()))}>{d}</Chip>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Starts at</p>
                        <ThemedSelect value={String(start)} onChange={v => setStart(Number(v))} options={times.map(t => ({ value: String(t), label: hhmm(t) }))} />
                    </div>
                    <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Periods a day</p>
                        <Stepper value={count} min={4} max={12} onChange={setCount} />
                    </div>
                </div>
                <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Each period</p>
                    <div className="flex flex-wrap gap-1.5">{[30, 35, 40, 45, 50, 60].map(m => <Chip key={m} on={length === m} onClick={() => setLength(m)}>{m} min</Chip>)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Short break after</p>
                        <ThemedSelect value={String(shortAfter)} onChange={v => setShortAfter(Number(v))} options={[{ value: '0', label: 'No break' }, ...Array.from({ length: count - 1 }, (_, i) => ({ value: String(i + 1), label: `Period ${i + 1}` }))]} />
                    </div>
                    <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Lunch after</p>
                        <ThemedSelect value={String(lunchAfter)} onChange={v => setLunchAfter(Number(v))} options={[{ value: '0', label: 'No lunch' }, ...Array.from({ length: count - 1 }, (_, i) => ({ value: String(i + 1), label: `Period ${i + 1}` }))]} />
                    </div>
                </div>
                {shortAfter > 0 && (
                    <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Short break length</p>
                        <div className="flex flex-wrap gap-1.5">{[10, 15, 20, 25, 30].map(m => <Chip key={m} on={shortMin === m} onClick={() => setShortMin(m)}>{m} min</Chip>)}</div>
                    </div>
                )}
                {lunchAfter > 0 && (
                    <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Lunch length</p>
                        <div className="flex flex-wrap gap-1.5">{[20, 25, 30, 40, 45].map(m => <Chip key={m} on={lunchMin === m} onClick={() => setLunchMin(m)}>{m} min</Chip>)}</div>
                    </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">School ends at <span className="font-semibold text-foreground">{hhmm(ends)}</span></p>
                    <div className="flex items-center gap-2">
                        {onCancel && <SecondaryButton type="button" disabled={saving} onClick={onCancel}>Cancel</SecondaryButton>}
                        <PrimaryButton type="button" disabled={saving || !days.length} onClick={() => void save()}>{saving ? 'Saving...' : 'Looks good'}</PrimaryButton>
                    </div>
                </div>
            </div>
        </Frame>
    );
}

/** Each period's length (e.g. a longer first period). The timetable stays as it is. */
function TimingsCard({ ws, params, onClose, onSaved }: { ws: Workspace; params: Record<string, string>; onClose: () => void; onSaved: () => void }) {
    const [lens, setLens] = useState(() => ws.slots.map(s => s.endMinute - s.startMinute));
    const [saving, setSaving] = useState(false);
    const first = ws.slots[0]?.startMinute ?? 0;
    const next = lens.reduce<{ start: number; end: number }[]>((out, l, i) => { const s = i ? out[i - 1].end : first; out.push({ start: s, end: s + l }); return out; }, []);

    const save = async () => {
        setSaving(true);
        try {
            // Move slots one at a time so two never overlap on the way.
            const cur = ws.slots.map(s => ({ id: s.id, start: s.startMinute, end: s.endMinute }));
            const todo = new Set(cur.map((_, i) => i).filter(i => cur[i].start !== next[i].start || cur[i].end !== next[i].end));
            for (let pass = 0; todo.size && pass < cur.length + 2; pass++) {
                for (const i of [...todo]) {
                    const free = cur.every((c, j) => j === i || next[i].end <= c.start || next[i].start >= c.end);
                    if (!free) continue;
                    await api.patch(`/admin/timetable/slots/${cur[i].id}`, { startMinute: next[i].start, endMinute: next[i].end }, { params });
                    cur[i] = { ...cur[i], start: next[i].start, end: next[i].end };
                    todo.delete(i);
                }
            }
            toast.success('Timings saved');
            onSaved();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not save the timings')); }
        finally { setSaving(false); }
    };

    return (
        <Frame>
            <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 font-semibold"><Clock size={15} className="text-primary" />Period timings</p>
                <button type="button" aria-label="Close" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X size={14} /></button>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Make any period longer or shorter. The timetable stays as it is.</p>
            <div className="mt-2.5 space-y-1">
                {ws.slots.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className={`min-w-0 flex-1 truncate text-[13px] ${s.kind === 'PERIOD' ? '' : 'text-muted-foreground'}`}>{s.name}</span>
                        <span className="w-28 text-right text-[11px] tabular-nums text-muted-foreground">{hhmm(next[i].start)} - {hhmm(next[i].end)}</span>
                        <Stepper small value={lens[i]} min={5} max={120} step={5} onChange={v => setLens(l => l.map((x, j) => (j === i ? v : x)))} />
                    </div>
                ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Ends at <span className="font-semibold text-foreground">{hhmm(next[next.length - 1]?.end ?? 0)}</span></p>
                <PrimaryButton type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save timings'}</PrimaryButton>
            </div>
        </Frame>
    );
}

export function Stepper({ value, min, max, onChange, small, step = 1 }: { value: number; min: number; max: number; onChange: (v: number) => void; small?: boolean; step?: number }) {
    const btn = `grid ${small ? 'h-6 w-6' : 'h-9 w-9'} place-items-center rounded-lg bg-muted/60 text-muted-foreground hover:text-foreground disabled:opacity-40`;
    return (
        <div className="inline-flex items-center gap-1.5">
            <button type="button" aria-label="Less" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}><Minus size={small ? 12 : 14} /></button>
            <span className={`${small ? 'w-6 text-xs' : 'w-7 text-sm'} text-center font-bold tabular-nums`}>{value}</span>
            <button type="button" aria-label="More" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}><Plus size={small ? 12 : 14} /></button>
        </div>
    );
}

/** "2x": how many double periods (two in a row) a week; the rest stay single. Tap 2x to start, then - / + to change. */
function DoubleBtn({ value, total, onChange }: { value: number; total: number; onChange: (n: number) => void }) {
    const max = Math.floor(total / 2);
    const v = Math.min(value, max);
    if (!v) {
        return (
            <button type="button" disabled={max < 1} onClick={() => onChange(1)} title="Make one double period (two in a row) a week"
                className="h-6 shrink-0 rounded-md bg-muted/60 px-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-30">2x</button>
        );
    }
    const step = 'grid h-6 w-5 place-items-center text-primary-foreground/80 hover:text-primary-foreground disabled:opacity-40';
    return (
        <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-primary text-[11px] font-bold tabular-nums text-primary-foreground" title={`${v} double period${v === 1 ? '' : 's'} a week, the rest single`}>
            <button type="button" aria-label="One double period less" className={step} onClick={() => onChange(v - 1)}><Minus size={10} /></button>
            <span className="px-0.5">2x × {v}</span>
            <button type="button" aria-label="One double period more" className={step} disabled={v >= max} onClick={() => onChange(v + 1)}><Plus size={10} /></button>
        </span>
    );
}

// ── 2. Periods a week per subject ─────────────────────────────────────────────
const ACTIVITY_IDEAS = ['Library', 'PT / Games', 'Music', 'Art & Craft', 'Dance', 'Moral Science', 'Club'];
const CLASSROOM = '__class__';

export function SubjectsCard({ ws, params, onSaved, collapsed, onEdit, onCancel }: { ws: Workspace; params: Record<string, string>; onSaved: () => void; collapsed: boolean; onEdit: () => void; onCancel?: () => void }) {
    const [data, setData] = useState<Suggestion | null>(null);
    const [open, setOpen] = useState<string | null>(null);
    const [picks, setPicks] = useState<Record<string, string>>({});
    const [other, setOther] = useState('');
    const [saving, setSaving] = useState(false);
    const roomTypes = useMemo(() => [...new Set(ws.rooms.filter(r => r.isActive && r.type !== 'CLASSROOM').map(r => r.type))], [ws.rooms]);

    useEffect(() => {
        if (collapsed) return;
        let live = true;
        api.get('/admin/timetable/ai/requirements', { params }).then(res => { if (live) { setData(res.data.data); setOpen(res.data.data.standards[0]?.standardId ?? null); } })
            .catch(err => toast.error(getErrorMessage(err, 'Could not load the subjects')));
        return () => { live = false; };
    }, [collapsed, params]);

    // Sections where a subject has periods but nobody to teach it: ask once.
    const missing = useMemo(() => {
        if (!data) return [];
        const out: { divisionId: string; label: string; subjectId: string; subject: string }[] = [];
        for (const st of data.standards) {
            const std = ws.standards.find(s => s.id === st.standardId);
            for (const d of std?.divisions ?? []) {
                for (const it of st.items.filter(i => i.periodsPerWeek > 0 || i.lab)) {
                    const has = ws.configs.some(c => c.divisionId === d.id && c.subjectId === it.subjectId && c.teacherId)
                        || ws.assignments.some(a => a.divisionId === d.id && a.subjectId === it.subjectId);
                    if (!has) out.push({ divisionId: d.id, label: d.label, subjectId: it.subjectId, subject: it.name });
                }
            }
        }
        return out;
    }, [data, ws]);

    type Std = Suggestion['standards'][number];
    const patchStd = (standardId: string, fn: (s: Std) => Std) => setData(d => d && ({ ...d, standards: d.standards.map(s => (s.standardId === standardId ? fn(s) : s)) }));
    const setItem = (standardId: string, subjectId: string, patch: Partial<Std['items'][number]>) => patchStd(standardId, s => ({ ...s, items: s.items.map(i => (i.subjectId === subjectId ? { ...i, ...patch } : i)) }));
    const setAct = (standardId: string, idx: number, patch: Partial<Activity> | null) => patchStd(standardId, s => ({ ...s, activities: patch ? s.activities.map((a, i) => (i === idx ? { ...a, ...patch } : a)) : s.activities.filter((_, i) => i !== idx) }));
    const addAct = (standardId: string, title: string) => {
        const t = title.trim();
        if (!t) return;
        const room = roomTypes.find(r => r === roomTypeOf(t) || (t === 'PT / Games' && r === 'GROUND') || r === roomTypeOf(t.split(' ')[0]));
        patchStd(standardId, s => (s.activities.some(a => a.title.toLowerCase() === t.toLowerCase()) ? s : { ...s, activities: [...s.activities, { title: t, periodsPerWeek: 1, teacherId: null, roomType: room ?? null }] }));
    };
    const totalOf = (s: Std) => s.items.reduce((n, i) => n + i.periodsPerWeek + (i.lab?.periodsPerWeek ?? 0), 0) + s.activities.reduce((n, a) => n + a.periodsPerWeek, 0);

    const save = async () => {
        if (!data) return;
        setSaving(true);
        try {
            await api.put('/admin/timetable/ai/requirements', {
                standards: data.standards.map(s => ({
                    standardId: s.standardId,
                    items: s.items.map(i => ({ subjectId: i.subjectId, periodsPerWeek: i.periodsPerWeek, doubles: i.doubles, lab: i.lab })),
                    activities: s.activities.map(a => ({ title: a.title, periodsPerWeek: a.periodsPerWeek, teacherId: a.teacherId, roomType: a.roomType })),
                })),
                teachers: Object.entries(picks).filter(([, t]) => t).map(([k, teacherId]) => { const [divisionId, subjectId] = k.split('|'); return { divisionId, subjectId, teacherId }; }),
            }, { params });
            toast.success('Subjects saved');
            onSaved();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not save the subjects')); }
        finally { setSaving(false); }
    };

    if (collapsed) {
        const classes = new Set(ws.configs.map(c => c.divisionId)).size;
        const doubles = new Set(ws.configs.filter(c => c.span > 1).map(c => c.subjectId)).size;
        const acts = new Set(ws.configs.filter(c => !c.subjectId && c.title).map(c => c.title)).size;
        return <Done step={3} title="Subjects per week" onEdit={onEdit} text={`Set for ${classes} section${classes === 1 ? '' : 's'}${doubles ? `, ${doubles} with double periods` : ''}${acts ? `, ${acts} activit${acts === 1 ? 'y' : 'ies'}` : ''}`} />;
    }
    if (!data) return <Frame><p className="text-xs text-muted-foreground">Looking at your subjects...</p></Frame>;
    if (!data.standards.length) return <Frame><p className="font-semibold">No classes yet</p><p className="text-xs text-muted-foreground">Add classes, sections and subjects in Campus first.</p></Frame>;

    const unpicked = missing.filter(m => !picks[`${m.divisionId}|${m.subjectId}`]).length;
    const roomOptions = [{ value: CLASSROOM, label: 'Own class' }, ...roomTypes.map(t => ({ value: t, label: roomKindLabel(t) }))];
    return (
        <Frame>
            <div className="flex items-center justify-between gap-2">
                <div><StepLabel n={3} /><p className="font-semibold">How many periods a week for each subject?</p></div>
                {onCancel && <button type="button" aria-label="Close" onClick={onCancel} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X size={14} /></button>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">I filled a usual week ({data.periodsPerWeek} periods). Change any number with + and -. Every section of a class gets the same. <b>2x</b> = how many double periods (two in a row), the rest stay single. <b>+ Lab</b> = some periods of that subject in a lab.</p>
            <div className="mt-3 space-y-2">
                {data.standards.map(st => {
                    const total = totalOf(st);
                    const over = total > data.periodsPerWeek;
                    const isOpen = open === st.standardId;
                    return (
                        <div key={st.standardId} className="rounded-xl bg-card" data-admin-surface="">
                            <button type="button" onClick={() => setOpen(isOpen ? null : st.standardId)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                                <span className="flex-1 text-sm font-semibold">{/^\d/.test(st.name) ? `Class ${st.name}` : st.name}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${over ? 'bg-red-500/10 text-red-600 dark:text-red-400' : total === data.periodsPerWeek ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{total}/{data.periodsPerWeek}</span>
                                <ChevronDown size={15} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isOpen && (
                                <div className="space-y-1 px-3 pb-3">
                                    {st.items.length === 0 && <p className="text-xs text-muted-foreground">No subjects for this class. Add them in Campus.</p>}
                                    {st.items.map(i => (
                                        <div key={i.subjectId} className="py-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`min-w-0 flex-1 truncate text-[13px] ${i.periodsPerWeek || i.lab ? '' : 'text-muted-foreground line-through'}`}>{i.name}</span>
                                                {roomTypes.length > 0 && !i.lab && (
                                                    <button type="button" onClick={() => setItem(st.standardId, i.subjectId, { lab: { roomType: roomTypes[0], periodsPerWeek: 2, doubles: 0 } })} title="Some periods of this subject in a lab"
                                                        className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-muted/60 px-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"><FlaskConical size={11} />+ Lab</button>
                                                )}
                                                <DoubleBtn value={i.doubles} total={i.periodsPerWeek} onChange={n => setItem(st.standardId, i.subjectId, { doubles: n })} />
                                                <Stepper small value={i.periodsPerWeek} min={0} max={20} onChange={n => setItem(st.standardId, i.subjectId, { periodsPerWeek: n, doubles: Math.min(i.doubles, Math.floor(n / 2)) })} />
                                            </div>
                                            {i.lab && (
                                                <div className="mt-1 flex items-center gap-1.5 pl-3">
                                                    <span className="flex min-w-0 flex-1 items-center gap-1 text-[12px] text-muted-foreground" title="Lab periods"><FlaskConical size={12} className="shrink-0" /></span>
                                                    <div className="w-[118px] shrink-0"><ThemedSelect triggerClassName="!h-7 text-xs px-2" value={i.lab.roomType} onChange={v => setItem(st.standardId, i.subjectId, { lab: { ...i.lab!, roomType: v } })} options={roomTypes.map(t => ({ value: t, label: roomKindLabel(t) }))} /></div>
                                                    <DoubleBtn value={i.lab.doubles} total={i.lab.periodsPerWeek} onChange={n => setItem(st.standardId, i.subjectId, { lab: { ...i.lab!, doubles: n } })} />
                                                    <Stepper small value={i.lab.periodsPerWeek} min={1} max={10} onChange={n => setItem(st.standardId, i.subjectId, { lab: { ...i.lab!, periodsPerWeek: n, doubles: Math.min(i.lab!.doubles, Math.floor(n / 2)) } })} />
                                                    <button type="button" aria-label={`No lab for ${i.name}`} onClick={() => setItem(st.standardId, i.subjectId, { lab: null })} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600"><X size={12} /></button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {roomTypes.length === 0 && <p className="pt-1 text-[11px] text-muted-foreground">Add a lab in Labs and grounds to give a subject some lab periods.</p>}

                                    <div className="mt-2 pt-1">
                                        <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Activities</p>
                                        {st.activities.map((a, idx) => (
                                            <div key={a.title} className="py-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="min-w-0 flex-1 truncate text-[13px]">{a.title}</span>
                                                    <Stepper small value={a.periodsPerWeek} min={1} max={10} onChange={n => setAct(st.standardId, idx, { periodsPerWeek: n })} />
                                                    <button type="button" aria-label={`Remove ${a.title}`} onClick={() => setAct(st.standardId, idx, null)} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600"><X size={12} /></button>
                                                </div>
                                                <div className="mt-1 flex items-center gap-1.5 pl-3">
                                                    <div className="min-w-0 flex-1"><ThemedSelect triggerClassName="!h-7 text-xs px-2" value={a.teacherId ?? '__none__'} onChange={v => setAct(st.standardId, idx, { teacherId: v === '__none__' ? null : v })} options={[{ value: '__none__', label: 'No teacher' }, ...ws.teachers.map(t => ({ value: t.id, label: t.name }))]} /></div>
                                                    {roomTypes.length > 0 && <div className="w-[118px] shrink-0"><ThemedSelect triggerClassName="!h-7 text-xs px-2" value={a.roomType ?? CLASSROOM} onChange={v => setAct(st.standardId, idx, { roomType: v === CLASSROOM ? null : v })} options={roomOptions} /></div>}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {ACTIVITY_IDEAS.filter(t => !st.activities.some(a => a.title === t)).map(t => (
                                                <button key={t} type="button" onClick={() => addAct(st.standardId, t)} className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">+ {t}</button>
                                            ))}
                                            <form className="inline-flex items-center gap-1" onSubmit={ev => { ev.preventDefault(); addAct(st.standardId, other); setOther(''); }}>
                                                <input value={other} onChange={ev => setOther(ev.target.value)} maxLength={60} placeholder="+ Other (type a name)" className="h-[22px] w-36 rounded-full bg-muted/60 px-2.5 text-[11px] outline-none placeholder:text-muted-foreground focus:bg-card focus:ring-1 focus:ring-border" />
                                                {other.trim() && <button type="submit" className="h-[22px] rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground">Add</button>}
                                            </form>
                                        </div>
                                    </div>
                                    {over && <p className="text-[11px] font-medium text-red-600 dark:text-red-400">That is more than the {data.periodsPerWeek} periods in a week. Take out {total - data.periodsPerWeek}.</p>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {missing.length > 0 && (
                <div className="mt-3 rounded-xl bg-amber-500/10 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"><UserRound size={13} />Who teaches these? ({missing.length})</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">No teacher is assigned for these. Without one they cannot be placed.</p>
                    <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                        {missing.map(m => (
                            <div key={`${m.divisionId}|${m.subjectId}`} className="flex items-center gap-2">
                                <span className="w-28 shrink-0 truncate text-[12px]"><span className="font-semibold">{m.label}</span> {m.subject}</span>
                                <div className="min-w-0 flex-1"><ThemedSelect value={picks[`${m.divisionId}|${m.subjectId}`] ?? ''} placeholder="Choose teacher" onChange={v => setPicks(p => ({ ...p, [`${m.divisionId}|${m.subjectId}`]: v }))} options={ws.teachers.map(t => ({ value: t.id, label: t.name }))} /></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">{unpicked ? `${unpicked} without a teacher will be left out` : 'All set'}</p>
                <div className="flex items-center gap-2">
                    {onCancel && <SecondaryButton type="button" disabled={saving} onClick={onCancel}>Cancel</SecondaryButton>}
                    <PrimaryButton type="button" disabled={saving || data.standards.some(s => totalOf(s) > data.periodsPerWeek)} onClick={() => void save()}>{saving ? 'Saving...' : 'Use these'}</PrimaryButton>
                </div>
            </div>
        </Frame>
    );
}

// ── 3. Labs and grounds (optional) ────────────────────────────────────────────
export function LabsCard({ ws, params, onSaved, writable }: { ws: Workspace; params: Record<string, string>; onSaved: () => void; writable: boolean }) {
    const rooms = ws.rooms.filter(r => r.type !== 'CLASSROOM');
    const [open, setOpen] = useState(false);
    const [kind, setKind] = useState<string>(ROOM_KINDS[0]);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [sure, setSure] = useState<string | null>(null);
    const [edit, setEdit] = useState<{ id: string; name: string; type: string } | null>(null);
    // A kind already linked to subjects or activities keeps its type (only the name can change).
    const usedTypes = new Set(ws.configs.map(c => c.roomType).filter((t): t is string => !!t));

    const saveEdit = async () => {
        if (!edit || !edit.name.trim()) return;
        setBusy(true);
        try {
            await api.patch(`/admin/timetable/rooms/${edit.id}`, { name: edit.name.trim(), type: edit.type }, { params });
            toast.success('Saved');
            setEdit(null);
            onSaved();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not save it')); }
        finally { setBusy(false); }
    };

    const add = async () => {
        setBusy(true);
        try {
            await api.post('/admin/timetable/rooms', { name: name.trim() || kind, type: roomTypeOf(kind) }, { params });
            toast.success(`${name.trim() || kind} added`);
            setName('');
            onSaved();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not add it')); }
        finally { setBusy(false); }
    };
    const remove = async (id: string) => {
        setBusy(true);
        try { await api.delete(`/admin/timetable/rooms/${id}`, { params }); toast.success('Removed'); setSure(null); onSaved(); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not remove it')); }
        finally { setBusy(false); }
    };

    if (!open) {
        return (
            <Frame>
                <div className="flex items-start gap-3">
                    <StepDot n={2} done={rooms.length > 0} />
                    <div className="min-w-0 flex-1">
                        <StepLabel n={2} />
                        <p className="text-[13px] font-semibold">Labs and grounds <span className="font-normal text-muted-foreground">(optional)</span></p>
                        <p className="text-xs text-muted-foreground">{rooms.length ? rooms.map(r => r.name).join(', ') : 'Only if two classes cannot use the same lab at once.'}</p>
                    </div>
                    {writable && <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-primary hover:underline">{rooms.length ? 'Change' : 'Add'}</button>}
                </div>
            </Frame>
        );
    }
    return (
        <Frame>
            <div className="flex items-center justify-between">
                <div><StepLabel n={2} /><p className="flex items-center gap-2 font-semibold"><FlaskConical size={15} className="text-primary" />Labs and grounds</p></div>
                <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X size={14} /></button>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Add them here, then in Subjects pick which subject uses which. Only one class gets a lab at a time.</p>
            <ul className="mt-2.5 space-y-1">
                {rooms.map(r => edit?.id === r.id ? (
                    <li key={r.id} className="space-y-2 rounded-lg bg-card p-2.5" data-admin-surface="">
                        <input autoFocus value={edit.name} maxLength={60} onChange={e => setEdit({ ...edit, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') void saveEdit(); if (e.key === 'Escape') setEdit(null); }}
                            className="h-8 w-full rounded-lg bg-background px-2.5 text-[13px] outline-none ring-1 ring-border/60 focus:ring-foreground/30" />
                        {usedTypes.has(r.type)
                            ? <p className="text-[11px] text-muted-foreground">Kind: {roomKindLabel(r.type)} (used by subjects, so only the name can change)</p>
                            : <div className="flex flex-wrap gap-1">{ROOM_KINDS.map(k => <Chip key={k} on={edit.type === roomTypeOf(k)} onClick={() => setEdit({ ...edit, type: roomTypeOf(k) })}>{k}</Chip>)}</div>}
                        <div className="flex justify-end gap-2">
                            <SecondaryButton type="button" disabled={busy} onClick={() => setEdit(null)}>Cancel</SecondaryButton>
                            <PrimaryButton type="button" disabled={busy || !edit.name.trim()} onClick={() => void saveEdit()}>Save</PrimaryButton>
                        </div>
                    </li>
                ) : (
                    <li key={r.id} className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-1.5" data-admin-surface="">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{r.name}</span>
                        <span className="text-[11px] text-muted-foreground">{roomKindLabel(r.type)}</span>
                        <button type="button" aria-label={`Edit ${r.name}`} onClick={() => { setSure(null); setEdit({ id: r.id, name: r.name, type: r.type }); }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={12} /></button>
                        {sure === r.id
                            ? <button type="button" disabled={busy} onClick={() => void remove(r.id)} className="h-6 rounded-md bg-red-600 px-2 text-[11px] font-semibold text-white">Yes, remove</button>
                            : <button type="button" aria-label={`Remove ${r.name}`} onClick={() => setSure(r.id)} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600"><Trash2 size={12} /></button>}
                    </li>
                ))}
            </ul>
            <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">{ROOM_KINDS.map(k => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{k}</Chip>)}</div>
                <div className="flex gap-2">
                    <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder={`Name (e.g. ${kind} 1)`} className="h-9 min-w-0 flex-1 rounded-lg bg-card px-3 text-sm outline-none ring-1 ring-border/60 focus:ring-foreground/30" />
                    <PrimaryButton type="button" disabled={busy} onClick={() => void add()}>Add</PrimaryButton>
                </div>
            </div>
        </Frame>
    );
}
