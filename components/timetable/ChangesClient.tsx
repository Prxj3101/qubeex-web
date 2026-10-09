'use client';

import { useState } from 'react';
import { useRemote } from '@/hooks/useRemote';
import { Loader2, Trash2, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useCanManageTimetable } from '@/hooks/useTimetableAccess';
import { ConflictList } from './ConflictList';
import { classLabel, fmtTime, ttApi, conflictsFromError, errMsg, type Conflict, type OverviewRow, type SetupData } from '@/lib/timetable';

const input = 'rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm';
const todayStr = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

interface DayEntry { entryId: string; divisionName: string; slotName: string; startMinute: number; endMinute: number; subjectName: string; substituteTeacherId: string | null; substitutionId: string | null }
interface Candidate { teacherId: string; name: string; free: boolean; reason: string | null }
interface Sub { id: string; date: string; divisionName: string; slotName: string; subjectName: string; originalTeacherName: string | null; substituteTeacherName: string; reason: string | null }
interface Exc { id: string; divisionName: string; date: string; slotName: string; kind: 'OVERRIDE' | 'CANCEL'; sessionTypeName: string | null; subjectName: string | null; title: string | null; teacherName: string | null; roomName: string | null; reason: string | null }

export function ChangesClient() {
    const { selectedYearId, loading: yl } = useAcademicYear();
    const [tab, setTab] = useState<'subs' | 'changes'>('subs');
    const setupQ = useRemote(selectedYearId ? `setup:${selectedYearId}` : null, () => ttApi.setup(selectedYearId), e => toast.error(errMsg(e)));
    const overviewQ = useRemote(selectedYearId ? `ov:${selectedYearId}` : null, () => ttApi.overview(selectedYearId), e => toast.error(errMsg(e)));
    const setup = setupQ.data;
    const overview = overviewQ.data;
    if (yl || !setup || !overview) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    return (
        <div className="space-y-4">
            <div className="flex gap-1 rounded-xl bg-muted/60 p-1 w-fit text-sm">
                <button onClick={() => setTab('subs')} className={`rounded-lg px-4 py-1.5 font-medium ${tab === 'subs' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Substitutions</button>
                <button onClick={() => setTab('changes')} className={`rounded-lg px-4 py-1.5 font-medium ${tab === 'changes' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>One-day changes</button>
            </div>
            {!setup.writable && <p className="text-sm text-amber-600">This academic year is closed — read-only.</p>}
            {tab === 'subs' ? <Substitutions setup={setup} yearId={selectedYearId} /> : <Changes setup={setup} overview={overview} yearId={selectedYearId} />}
        </div>
    );
}

function Substitutions({ setup, yearId }: { setup: SetupData; yearId: string | null }) {
    const canManage = useCanManageTimetable();
    const writable = setup.writable && canManage;
    const [teacherId, setTeacherId] = useState('');
    const [date, setDate] = useState(todayStr());
    const [entries, setEntries] = useState<DayEntry[] | null>(null);
    const [open, setOpen] = useState<string | null>(null);
    const [cands, setCands] = useState<Candidate[]>([]);
    const [pick, setPick] = useState('');
    const [reason, setReason] = useState('');
    const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
    const [busy, setBusy] = useState(false);

    const subsQ = useRemote(`subs:${yearId}`, () => ttApi.get<Sub[]>('/substitutions', yearId, { from: todayStr(), to: plusDays(45) }), e => toast.error(errMsg(e)));
    const subs = subsQ.data ?? [];
    const loadSubs = subsQ.reload;

    const find = async () => {
        if (!teacherId || !date) return;
        setBusy(true);
        try { setEntries(await ttApi.get<DayEntry[]>('/substitutions/teacher-day', yearId, { teacherId, date })); setOpen(null); }
        catch (e) { setEntries(null); toast.error(errMsg(e)); } finally { setBusy(false); }
    };

    const openRow = async (id: string) => {
        setOpen(id); setPick(''); setReason(''); setConflicts(null);
        try { setCands(await ttApi.get<Candidate[]>('/substitutions/candidates', yearId, { entryId: id, date })); } catch (e) { toast.error(errMsg(e)); }
    };

    const assign = async (entryId: string, force = false) => {
        setBusy(true);
        try {
            await ttApi.post('/substitutions', yearId, { entryId, date, substituteTeacherId: pick, reason: reason || null, force });
            toast.success('Substitute assigned'); setOpen(null); setConflicts(null); loadSubs(); await find();
        } catch (e) { const c = conflictsFromError(e); if (c) setConflicts(c); else toast.error(errMsg(e)); } finally { setBusy(false); }
    };
    const remove = async (id: string) => {
        try { await ttApi.del(`/substitutions/${id}`, yearId); toast.success('Substitution removed'); loadSubs(); if (entries) await find(); } catch (e) { toast.error(errMsg(e)); }
    };

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <h2 className="font-semibold">Arrange a substitute</h2>
                <p className="text-xs text-muted-foreground">Pick the absent teacher and the date. Only published timetables can be substituted. The permanent timetable stays unchanged.</p>
                <div className="flex flex-wrap gap-2">
                    <select className={input} value={teacherId} onChange={e => { setTeacherId(e.target.value); setEntries(null); }}>
                        <option value="">Absent teacher…</option>
                        {setup.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <input type="date" className={input} value={date} onChange={e => { setDate(e.target.value); setEntries(null); }} />
                    <button disabled={!teacherId || !date || busy} onClick={() => void find()} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Find sessions</button>
                </div>
                {entries && !entries.length && <p className="text-sm text-muted-foreground">No published sessions for this teacher on that day.</p>}
                <ul className="space-y-2">
                    {entries?.map(e => (
                        <li key={e.entryId} className="rounded-xl border border-border/60 p-3 text-sm space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div><div className="font-semibold">{e.subjectName} · {e.divisionName}</div>
                                    <div className="text-xs text-muted-foreground">{e.slotName} · {fmtTime(e.startMinute)} – {fmtTime(e.endMinute)}</div></div>
                                {e.substitutionId ? (
                                    <div className="text-right text-xs">
                                        <span className="text-emerald-600 font-semibold inline-flex items-center gap-1"><UserRoundCheck className="w-3.5 h-3.5" /> {setup.teachers.find(t => t.id === e.substituteTeacherId)?.name}</span>
                                        {writable && <button className="ml-2 text-muted-foreground hover:text-red-600" onClick={() => void remove(e.substitutionId!)} aria-label="Remove"><Trash2 className="w-3.5 h-3.5 inline" /></button>}
                                    </div>
                                ) : writable && <button onClick={() => void openRow(e.entryId)} className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted">Assign substitute</button>}
                            </div>
                            {open === e.entryId && (
                                <div className="space-y-2 border-t border-border/40 pt-2">
                                    <select className={`${input} w-full`} value={pick} onChange={ev => { setPick(ev.target.value); setConflicts(null); }}>
                                        <option value="">Choose substitute…</option>
                                        {cands.map(c => <option key={c.teacherId} value={c.teacherId}>{c.name}{c.free ? ' — free' : ` — busy: ${c.reason}`}</option>)}
                                    </select>
                                    <input className={`${input} w-full`} placeholder="Reason (optional)" value={reason} onChange={ev => setReason(ev.target.value)} />
                                    {conflicts && <ConflictList conflicts={conflicts} />}
                                    <div className="flex justify-end gap-2">
                                        <button className="rounded-lg border border-border px-3 py-1 text-xs" onClick={() => setOpen(null)}>Cancel</button>
                                        {conflicts && <button className="rounded-lg border border-red-500/50 px-3 py-1 text-xs text-red-600" disabled={busy} onClick={() => void assign(e.entryId, true)}>Assign anyway</button>}
                                        <button disabled={!pick || busy} className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50" onClick={() => void assign(e.entryId)}>Assign</button>
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <h2 className="font-semibold">Upcoming substitutions</h2>
                {!subs.length && <p className="text-sm text-muted-foreground">None in the next 45 days.</p>}
                <ul className="divide-y divide-border/40">
                    {subs.map(s => (
                        <li key={s.id} className="py-2 text-sm flex items-start justify-between gap-2">
                            <div><div className="font-medium">{s.date} · {s.slotName} · {s.divisionName}</div>
                                <div className="text-xs text-muted-foreground">{s.subjectName}: {s.originalTeacherName ?? '—'} → <b className="text-foreground">{s.substituteTeacherName}</b>{s.reason ? ` · ${s.reason}` : ''}</div></div>
                            {writable && <button className="p-1 text-muted-foreground hover:text-red-600" onClick={() => void remove(s.id)} aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

function Changes({ setup, overview, yearId }: { setup: SetupData; overview: OverviewRow[]; yearId: string | null }) {
    const canManage = useCanManageTimetable();
    const writable = setup.writable && canManage;
    const [divisionId, setDivisionId] = useState(overview[0]?.divisionId ?? '');
    const [f, setF] = useState({ date: todayStr(), slotId: '', kind: 'OVERRIDE' as 'OVERRIDE' | 'CANCEL', sessionTypeId: '', subjectId: '', title: '', teacherId: '', roomId: '', reason: '' });
    const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
    const [busy, setBusy] = useState(false);
    const listQ = useRemote(`exc:${yearId}`, () => ttApi.get<Exc[]>('/exceptions', yearId, { from: todayStr(), to: plusDays(60) }), e => toast.error(errMsg(e)));
    const list = listQ.data ?? [];
    const loadList = listQ.reload;
    const studioQ = useRemote(divisionId ? `st:${yearId}:${divisionId}` : null, () => ttApi.studio(yearId, divisionId), e => toast.error(errMsg(e)));
    const studio = studioQ.data;
    const slotId = f.slotId || (studio?.slots.find(x => x.kind === 'PERIOD')?.id ?? '');

    const submit = async (force = false) => {
        setBusy(true);
        try {
            await ttApi.post('/exceptions', yearId, {
                divisionId, date: f.date, slotId, kind: f.kind, force,
                sessionTypeId: f.sessionTypeId || null, subjectId: f.subjectId || null, title: f.title || null,
                teacherId: f.teacherId || null, roomId: f.roomId || null, reason: f.reason || null,
            });
            toast.success('Change saved. Affected teachers and students are notified.'); setConflicts(null); loadList();
        } catch (e) { const c = conflictsFromError(e); if (c) setConflicts(c); else toast.error(errMsg(e)); } finally { setBusy(false); }
    };
    const remove = async (id: string) => { try { await ttApi.del(`/exceptions/${id}`, yearId); toast.success('Change removed'); loadList(); } catch (e) { toast.error(errMsg(e)); } };

    const set = (patch: Partial<typeof f>) => { setF(p => ({ ...p, ...patch })); setConflicts(null); };
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <h2 className="font-semibold">Change a single day</h2>
                <p className="text-xs text-muted-foreground">Events, sports day, exams, guest lectures, holidays or a room outage — for one date only. The permanent timetable is not modified.</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <label className="col-span-2">Class & section
                        <select className={`${input} w-full mt-1`} value={divisionId} onChange={e => setDivisionId(e.target.value)}>
                            {overview.map(o => <option key={o.divisionId} value={o.divisionId}>{classLabel(o.standardName, o.divisionName)}</option>)}
                        </select></label>
                    <label>Date<input type="date" className={`${input} w-full mt-1`} value={f.date} onChange={e => set({ date: e.target.value })} /></label>
                    <label>Period
                        <select className={`${input} w-full mt-1`} value={slotId} onChange={e => set({ slotId: e.target.value })}>
                            {studio?.slots.map(s => <option key={s.id} value={s.id}>{s.name} ({fmtTime(s.startMinute)})</option>)}
                        </select></label>
                    <label className="col-span-2">What happens
                        <select className={`${input} w-full mt-1`} value={f.kind} onChange={e => set({ kind: e.target.value as 'OVERRIDE' | 'CANCEL' })}>
                            <option value="OVERRIDE">Replace the session</option><option value="CANCEL">Cancel the session (free period / holiday)</option>
                        </select></label>
                    {f.kind === 'OVERRIDE' && studio && (<>
                        <label>Session type<select className={`${input} w-full mt-1`} value={f.sessionTypeId} onChange={e => set({ sessionTypeId: e.target.value })}><option value="">—</option>{studio.sessionTypes.filter(t => t.isActive).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                        <label>Subject<select className={`${input} w-full mt-1`} value={f.subjectId} onChange={e => set({ subjectId: e.target.value })}><option value="">—</option>{studio.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                        <label className="col-span-2">Title<input className={`${input} w-full mt-1`} placeholder="e.g. Annual Sports Day, Guest lecture" value={f.title} onChange={e => set({ title: e.target.value })} /></label>
                        <label>Teacher<select className={`${input} w-full mt-1`} value={f.teacherId} onChange={e => set({ teacherId: e.target.value })}><option value="">—</option>{studio.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                        <label>Room<select className={`${input} w-full mt-1`} value={f.roomId} onChange={e => set({ roomId: e.target.value })}><option value="">—</option>{studio.rooms.filter(r => r.isActive).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
                    </>)}
                    <label className="col-span-2">Reason<input className={`${input} w-full mt-1`} value={f.reason} onChange={e => set({ reason: e.target.value })} /></label>
                </div>
                {conflicts && <ConflictList conflicts={conflicts} />}
                {writable && (
                    <div className="flex justify-end gap-2">
                        {conflicts && <button className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-red-600" disabled={busy} onClick={() => void submit(true)}>Save anyway</button>}
                        <button disabled={busy || !divisionId || !slotId || !f.date} onClick={() => void submit(false)} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save change</button>
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <h2 className="font-semibold">Upcoming one-day changes</h2>
                {!list.length && <p className="text-sm text-muted-foreground">None in the next 60 days.</p>}
                <ul className="divide-y divide-border/40">
                    {list.map(x => (
                        <li key={x.id} className="py-2 text-sm flex items-start justify-between gap-2">
                            <div><div className="font-medium">{x.date} · {x.slotName} · {x.divisionName}</div>
                                <div className="text-xs text-muted-foreground">
                                    {x.kind === 'CANCEL' ? 'Cancelled' : [x.title ?? x.subjectName ?? x.sessionTypeName, x.teacherName, x.roomName].filter(Boolean).join(' · ')}{x.reason ? ` — ${x.reason}` : ''}
                                </div></div>
                            {writable && <button className="p-1 text-muted-foreground hover:text-red-600" onClick={() => void remove(x.id)} aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
