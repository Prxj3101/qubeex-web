'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarX2, Check, Loader2, PartyPopper, Search, Sparkles, Trash2, UserRoundCheck, UserRoundX } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { PrimaryButton, ThemedSelect } from '@/app/admin/payroll/_components/ui';
import { scrollStyle } from '@/app/admin/admissions/admissions.types';
import { Bubble } from './SetupCards';
import { DAY_SHORT, dowOfIso, hhmm, todayIso, type Workspace } from './ttai';

// "Today": the day-to-day side of the timetable. Mark who is absent and the
// app finds a free teacher for every period they had; plan a sports day or a
// holiday for some periods. The year's timetable itself never changes.

interface DayEntry { entryId: string; divisionName: string; slotName: string; startMinute: number; endMinute: number; subjectName: string; substituteTeacherId: string | null; substitutionId: string | null }
interface Candidate { teacherId: string; name: string; free: boolean; reason: string | null }
interface Sub { id: string; date: string; divisionName: string; slotName: string; subjectName: string; originalTeacherName: string | null; substituteTeacherName: string; reason: string | null }
interface Exc { id: string; divisionName: string; date: string; slotName: string; kind: 'OVERRIDE' | 'CANCEL'; title: string | null; subjectName: string | null; reason: string | null }
interface Row extends DayEntry { absentId: string; candidates: Candidate[]; pick: string }

const plusDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nice = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export function TodayPanel({ ws, params, writable }: { ws: Workspace; params: Record<string, string>; writable: boolean }) {
    const [date, setDate] = useState(todayIso());
    const dow = dowOfIso(date);
    const working = ws.workingDays.includes(dow);
    const published = ws.standards.some(s => s.divisions.some(d => d.status === 'PUBLISHED'));

    return (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,70fr)_minmax(0,30fr)]">
            <section data-admin-surface="" className="flex min-h-[480px] min-w-0 flex-col gap-3 overflow-hidden rounded-2xl bg-card p-4 lg:min-h-0">
                <div className="flex flex-wrap items-center gap-2">
                    {[0, 1, 2].map(n => {
                        const d = plusDays(todayIso(), n);
                        return <button key={n} type="button" onClick={() => setDate(d)} aria-pressed={date === d} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${date === d ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:text-foreground'}`}>{n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : nice(d)}</button>;
                    })}
                    <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="h-8 rounded-full bg-muted/50 px-3 text-xs font-semibold text-muted-foreground outline-none" aria-label="Pick a date" />
                    <span className="ml-auto text-xs text-muted-foreground">{nice(date)}</span>
                </div>
                {!published
                    ? <Empty icon={CalendarClock} title="Publish the timetable first" text="Substitutes and day changes work on the published timetable." />
                    : !working
                        ? <Empty icon={CalendarX2} title={`${DAY_SHORT[dow]} is not a school day`} text="Pick another date." />
                        : <Substitutes key={date} ws={ws} params={params} date={date} dow={dow} writable={writable} />}
            </section>
            <section data-admin-surface="" className="flex min-h-[480px] flex-col overflow-hidden rounded-2xl bg-card lg:min-h-0">
                <DayChanges ws={ws} params={params} date={date} writable={writable && published} />
            </section>
        </div>
    );
}

function Empty({ icon: Icon, title, text }: { icon: typeof CalendarClock; title: string; text: string }) {
    return (
        <div className="grid flex-1 place-items-center text-center">
            <div><Icon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" /><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{text}</p></div>
        </div>
    );
}

// ── Absent teachers and their substitutes ─────────────────────────────────────
function Substitutes({ ws, params, date, dow, writable }: { ws: Workspace; params: Record<string, string>; date: string; dow: number; writable: boolean }) {
    const [absent, setAbsent] = useState<string[]>([]);
    const [q, setQ] = useState('');
    const [rows, setRows] = useState<Row[] | null>(null);
    const [finding, setFinding] = useState(false);
    const [saving, setSaving] = useState(false);
    const [subs, setSubs] = useState<Sub[]>([]);
    const [sure, setSure] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/admin/timetable/substitutions', { params: { ...params, from: todayIso(), to: plusDays(todayIso(), 45) } });
            setSubs(res.data.data);
        } catch { /* list is a nice-to-have */ }
    }, [params]);
    useEffect(() => { const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [load]);

    const periodsToday = useMemo(() => {
        const m = new Map<string, number>();
        for (const e of ws.entries) if (e.dayOfWeek === dow && e.teacherId) m.set(e.teacherId, (m.get(e.teacherId) ?? 0) + 1);
        return m;
    }, [ws.entries, dow]);
    const name = (id: string) => ws.teachers.find(t => t.id === id)?.name ?? 'Teacher';
    const list = ws.teachers.filter(t => !absent.includes(t.id) && t.name.toLowerCase().includes(q.trim().toLowerCase()));

    /** Finds every period of the absent teachers and picks the best free teacher for each. */
    const find = async () => {
        setFinding(true);
        try {
            const day = await Promise.all(absent.map(async id => ({ id, entries: (await api.get('/admin/timetable/substitutions/teacher-day', { params: { ...params, teacherId: id, date } })).data.data as DayEntry[] })));
            const flat = day.flatMap(d => d.entries.map(e => ({ ...e, absentId: d.id }))).sort((a, b) => a.startMinute - b.startMinute);
            const cands = await Promise.all(flat.map(async e => (e.substitutionId ? [] : ((await api.get('/admin/timetable/substitutions/candidates', { params: { ...params, entryId: e.entryId, date } })).data.data as Candidate[]))));
            // Fair picks: free, not absent, not used twice in one period, fewest periods today first.
            const load = new Map(periodsToday);
            const usedAt = new Set<string>();
            const out: Row[] = flat.map((e, i) => {
                const options = cands[i].filter(c => !absent.includes(c.teacherId));
                const best = options.filter(c => c.free && !usedAt.has(`${c.teacherId}|${e.slotName}`))
                    .sort((a, b) => (load.get(a.teacherId) ?? 0) - (load.get(b.teacherId) ?? 0))[0];
                if (best) { usedAt.add(`${best.teacherId}|${e.slotName}`); load.set(best.teacherId, (load.get(best.teacherId) ?? 0) + 1); }
                return { ...e, candidates: options, pick: best?.teacherId ?? '' };
            });
            setRows(out);
            if (!out.length) toast.message('They have no periods that day.');
        } catch (err) { toast.error(getErrorMessage(err, 'Could not find the periods')); }
        finally { setFinding(false); }
    };

    const assignAll = async () => {
        if (!rows) return;
        setSaving(true);
        let ok = 0;
        const failed: string[] = [];
        for (const r of rows.filter(x => !x.substitutionId && x.pick)) {
            try {
                await api.post('/admin/timetable/substitutions', { entryId: r.entryId, date, substituteTeacherId: r.pick, reason: `${name(r.absentId)} absent` }, { params });
                ok++;
            } catch (err) { failed.push(`${r.divisionName} ${r.slotName}: ${getErrorMessage(err, 'not saved')}`); }
        }
        setSaving(false);
        if (ok) toast.success(`${ok} substitute${ok === 1 ? '' : 's'} assigned. They are told in the app.`);
        if (failed.length) toast.error(failed.slice(0, 3).join('\n'));
        void load();
        await find();
    };

    const removeSub = async (id: string) => {
        try { await api.delete(`/admin/timetable/substitutions/${id}`, { params }); toast.success('Substitute removed'); setSure(null); void load(); if (rows) await find(); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not remove')); }
    };

    const open = rows?.filter(r => !r.substitutionId) ?? [];
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1" style={scrollStyle}>
            <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><UserRoundX size={15} className="text-primary" />Who is absent?</p>
                <p className="text-xs text-muted-foreground">Tap the teachers. I will find a free teacher for each of their periods.</p>
                {absent.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {absent.map(id => <button key={id} type="button" onClick={() => { setAbsent(a => a.filter(x => x !== id)); setRows(null); }} className="rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400">{name(id)} ×</button>)}
                    </div>
                )}
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-muted/40 px-3">
                    <Search size={14} className="text-muted-foreground" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a teacher" className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                </div>
                <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto" style={scrollStyle}>
                    {list.map(t => (
                        <button key={t.id} type="button" disabled={!writable} onClick={() => { setAbsent(a => [...a, t.id]); setRows(null); setQ(''); }}
                            className="rounded-full bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
                            {t.name} <span className="tabular-nums opacity-70">{periodsToday.get(t.id) ?? 0}</span>
                        </button>
                    ))}
                </div>
                {writable && absent.length > 0 && !rows && (
                    <button type="button" disabled={finding} onClick={() => void find()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #EC9B7E 0%, #DA7756 100%)' }}>
                        {finding ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}Find substitutes
                    </button>
                )}
            </div>

            {rows && rows.length > 0 && (
                <div className="space-y-1.5">
                    {rows.map(r => (
                        <div key={r.entryId} className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 ${r.substitutionId ? 'bg-emerald-500/10' : 'bg-muted/30'}`}>
                            <div className="w-24 shrink-0"><p className="text-xs font-semibold">{r.slotName}</p><p className="text-[10.5px] text-muted-foreground">{hhmm(r.startMinute)}</p></div>
                            <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{r.divisionName} - {r.subjectName}</p><p className="truncate text-[11px] text-muted-foreground">{name(r.absentId)} absent</p></div>
                            {r.substitutionId
                                ? <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><UserRoundCheck size={14} />{r.substituteTeacherId ? name(r.substituteTeacherId) : 'Covered'}</span>
                                : <div className="w-52"><ThemedSelect value={r.pick} placeholder={r.candidates.some(c => c.free) ? 'Choose' : 'Nobody is free'} onChange={v => setRows(rs => rs && rs.map(x => (x.entryId === r.entryId ? { ...x, pick: v } : x)))}
                                    options={r.candidates.map(c => ({ value: c.teacherId, label: <span className={c.free ? '' : 'text-muted-foreground'}>{c.name}{c.free ? '' : ` - busy`}</span> }))} /></div>}
                        </div>
                    ))}
                    {writable && open.length > 0 && (
                        <div className="flex items-center justify-between gap-2 pt-1">
                            <p className="text-xs text-muted-foreground">{open.filter(r => r.pick).length} of {open.length} have a substitute</p>
                            <PrimaryButton type="button" disabled={saving || !open.some(r => r.pick)} onClick={() => void assignAll()}>{saving ? 'Saving...' : <><Check size={14} />Assign all</>}</PrimaryButton>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-auto pt-2">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Coming up</p>
                {!subs.length && <p className="text-xs text-muted-foreground">No substitutes in the next 45 days.</p>}
                <ul className="space-y-1">
                    {subs.map(s => (
                        <li key={s.id} className="flex items-center gap-2 rounded-lg px-1 py-1 text-[12px]">
                            <span className="w-24 shrink-0 font-semibold">{nice(s.date)}</span>
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.slotName}, {s.divisionName} {s.subjectName}: <span className="text-foreground">{s.substituteTeacherName}</span> for {s.originalTeacherName ?? 'teacher'}</span>
                            {writable && (sure === s.id
                                ? <button type="button" onClick={() => void removeSub(s.id)} className="h-6 rounded-md bg-red-600 px-2 text-[11px] font-semibold text-white">Remove</button>
                                : <button type="button" aria-label="Remove substitute" onClick={() => setSure(s.id)} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600"><Trash2 size={12} /></button>)}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// ── Sports day, exams, holidays for some periods ──────────────────────────────
const IDEAS = ['Sports day', 'Annual function', 'Exam', 'Holiday', 'Guest lecture', 'Assembly'];

function DayChanges({ ws, params, date, writable }: { ws: Workspace; params: Record<string, string>; date: string; writable: boolean }) {
    const periods = ws.slots.filter(s => s.kind === 'PERIOD');
    const sections = ws.standards.flatMap(s => s.divisions);
    const [title, setTitle] = useState('');
    const [cancel, setCancel] = useState(true);
    const [slotIds, setSlotIds] = useState<string[]>(periods.map(p => p.id));
    const [divIds, setDivIds] = useState<string[]>(sections.map(d => d.id));
    const [busy, setBusy] = useState<string | null>(null);
    const [list, setList] = useState<Exc[]>([]);
    const [sure, setSure] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/admin/timetable/exceptions', { params: { ...params, from: todayIso(), to: plusDays(todayIso(), 60) } });
            setList(res.data.data);
        } catch { /* list is a nice-to-have */ }
    }, [params]);
    useEffect(() => { const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [load]);

    const groups = useMemo(() => {
        const m = new Map<string, { key: string; date: string; label: string; ids: string[]; classes: Set<string>; periods: Set<string> }>();
        for (const x of list) {
            const label = x.kind === 'CANCEL' ? (x.reason || 'No classes') : (x.title ?? x.subjectName ?? 'Change');
            const key = `${x.date.slice(0, 10)}|${x.kind}|${label}`;
            const g = m.get(key) ?? { key, date: x.date, label, ids: [], classes: new Set<string>(), periods: new Set<string>() };
            g.ids.push(x.id); g.classes.add(x.divisionName); g.periods.add(x.slotName);
            m.set(key, g);
        }
        return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
    }, [list]);

    const save = async () => {
        const name = title.trim() || (cancel ? 'Holiday' : '');
        if (!name) { toast.error('Give it a name, like Sports day'); return; }
        const jobs = divIds.flatMap(d => slotIds.map(s => ({ d, s })));
        let done = 0, failed = 0;
        for (const j of jobs) {
            setBusy(`${done + failed + 1} of ${jobs.length}`);
            try {
                await api.post('/admin/timetable/exceptions', { divisionId: j.d, date, slotId: j.s, kind: cancel ? 'CANCEL' : 'OVERRIDE', title: cancel ? null : name, reason: name, force: true }, { params });
                done++;
            } catch { failed++; }
        }
        setBusy(null);
        if (done) toast.success(`${name} saved for ${nice(date)}. Teachers and students are told in the app.`);
        if (failed) toast.error(`${failed} could not be saved`);
        setTitle('');
        void load();
    };
    const removeGroup = async (ids: string[]) => {
        setBusy('Removing...');
        for (const id of ids) { try { await api.delete(`/admin/timetable/exceptions/${id}`, { params }); } catch { /* keep going */ } }
        setBusy(null); setSure(null);
        toast.success('Removed');
        void load();
    };
    const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
    const pill = (on: boolean) => `rounded-full px-2.5 py-1 text-[11px] font-semibold ${on ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:text-foreground'}`;

    return (
        <>
            <div className="px-4 pb-2 pt-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold"><PartyPopper size={15} className="text-primary" />Special day</p>
                <p className="text-[11px] text-muted-foreground">Sports day, exams or a holiday on {nice(date)}. Only that day changes.</p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4" style={scrollStyle}>
                {writable ? (
                    <Bubble>
                        <div className="flex flex-wrap gap-1">{IDEAS.map(i => <button key={i} type="button" onClick={() => { setTitle(i); setCancel(i === 'Holiday'); }} className={pill(title === i)}>{i}</button>)}</div>
                        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder="Name (e.g. Sports day)" className="mt-2 h-9 w-full rounded-lg bg-card px-3 text-sm outline-none ring-1 ring-border/60 focus:ring-foreground/30" />
                        <div className="mt-2 flex gap-1.5">
                            <button type="button" onClick={() => setCancel(true)} className={pill(cancel)}>No classes</button>
                            <button type="button" onClick={() => setCancel(false)} className={pill(!cancel)}>Show it in the timetable</button>
                        </div>
                        <p className="mb-1 mt-3 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">Periods <button type="button" className="text-primary" onClick={() => setSlotIds(slotIds.length === periods.length ? [] : periods.map(p => p.id))}>{slotIds.length === periods.length ? 'None' : 'All day'}</button></p>
                        <div className="flex flex-wrap gap-1">{periods.map(p => <button key={p.id} type="button" onClick={() => setSlotIds(v => toggle(v, p.id))} className={pill(slotIds.includes(p.id))}>{p.name.replace(/^Period\s*/i, 'P')}</button>)}</div>
                        <p className="mb-1 mt-3 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">Classes <button type="button" className="text-primary" onClick={() => setDivIds(divIds.length === sections.length ? [] : sections.map(d => d.id))}>{divIds.length === sections.length ? 'None' : 'Whole school'}</button></p>
                        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto" style={scrollStyle}>{sections.map(d => <button key={d.id} type="button" onClick={() => setDivIds(v => toggle(v, d.id))} className={pill(divIds.includes(d.id))}>{d.label}</button>)}</div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                            <p className="text-[11px] text-muted-foreground">{busy ?? `${divIds.length} classes, ${slotIds.length} periods`}</p>
                            <PrimaryButton type="button" disabled={!!busy || !slotIds.length || !divIds.length} onClick={() => void save()}>Save</PrimaryButton>
                        </div>
                    </Bubble>
                ) : <p className="text-xs text-muted-foreground">Publish the timetable to plan special days.</p>}

                <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Coming up</p>
                    {!groups.length && <p className="text-xs text-muted-foreground">Nothing planned in the next 60 days.</p>}
                    <ul className="space-y-1.5">
                        {groups.map(g => (
                            <li key={g.key} className="flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-semibold">{g.label} <span className="font-normal text-muted-foreground">- {nice(g.date)}</span></p>
                                    <p className="truncate text-[11px] text-muted-foreground">{g.classes.size === sections.length ? 'Whole school' : [...g.classes].join(', ')} - {g.periods.size === periods.length ? 'all day' : [...g.periods].join(', ')}</p>
                                </div>
                                {writable && (sure === g.key
                                    ? <button type="button" disabled={!!busy} onClick={() => void removeGroup(g.ids)} className="h-7 shrink-0 rounded-md bg-red-600 px-2 text-[11px] font-semibold text-white">Remove</button>
                                    : <button type="button" aria-label="Remove" onClick={() => setSure(g.key)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600"><Trash2 size={13} /></button>)}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );
}
