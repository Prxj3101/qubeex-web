'use client';

import { useState } from 'react';
import { useRemote } from '@/hooks/useRemote';
import { ArrowDown, ArrowUp, Check, Copy, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useCanManageTimetable } from '@/hooks/useTimetableAccess';
import { DAY_NAMES, fmtTime, fromHHMM, toHHMM, ttApi, errMsg, type SessionType, type SetupData, type Slot, type SlotKind } from '@/lib/timetable';

const input = 'rounded-lg border border-border bg-background px-2 py-1 text-sm';
const KINDS: SlotKind[] = ['PERIOD', 'BREAK', 'LUNCH', 'ASSEMBLY', 'ACTIVITY'];
const SESSION_KINDS = ['THEORY', 'PRACTICAL', 'LAB', 'ACTIVITY', 'PE_SPORTS', 'LIBRARY', 'CLASS_TEACHER', 'ASSEMBLY', 'BREAK', 'LUNCH', 'FREE', 'EXAM', 'CUSTOM'];


// ── Visual helpers ─────────────────────────────────────────────────────────────
const KIND_STYLE: Record<SlotKind, string> = {
    PERIOD: 'bg-primary/15 border-primary/40 text-primary',
    BREAK: 'bg-amber-500/15 border-amber-500/40 text-amber-600',
    LUNCH: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600',
    ASSEMBLY: 'bg-sky-500/15 border-sky-500/40 text-sky-600',
    ACTIVITY: 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-600',
};

/** The school day as proportional blocks, so gaps, breaks and uneven period lengths are obvious at a glance. */
function PeriodTimeline({ slots }: { slots: { id?: string; name: string; startMinute: number; endMinute: number; kind: SlotKind }[] }) {
    if (!slots.length) return null;
    const start = slots[0].startMinute;
    const end = slots[slots.length - 1].endMinute;
    return (
        <div className="space-y-1">
            <div className="flex w-full gap-0.5 overflow-x-auto">
                {slots.map((s, i) => (
                    <div key={s.id ?? i} title={`${s.name}: ${fmtTime(s.startMinute)} – ${fmtTime(s.endMinute)}`}
                        className={`min-w-[44px] rounded-md border px-1.5 py-1.5 text-center ${KIND_STYLE[s.kind]}`}
                        style={{ flex: `${Math.max(s.endMinute - s.startMinute, 10)} 1 0` }}>
                        <div className="truncate text-[11px] font-semibold">{s.kind === 'PERIOD' ? s.name.replace(/^Period\s*/i, 'P') : s.name}</div>
                        <div className="truncate text-[9px] opacity-80">{fmtTime(s.startMinute)}</div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>{fmtTime(start)}</span><span>{Math.round((end - start) / 60 * 10) / 10} h school day</span><span>{fmtTime(end)}</span></div>
        </div>
    );
}

interface Template { firstBell: string; periodLen: number; count: number; breakAfter: number; breakLen: number; lunchAfter: number; lunchLen: number }
function buildSchedule(t: Template) {
    const out: { name: string; startMinute: number; endMinute: number; kind: SlotKind }[] = [];
    let at = fromHHMM(t.firstBell);
    for (let i = 1; i <= t.count; i++) {
        out.push({ name: `Period ${i}`, startMinute: at, endMinute: at + t.periodLen, kind: 'PERIOD' });
        at += t.periodLen;
        if (t.breakAfter === i && t.breakLen > 0) { out.push({ name: 'Break', startMinute: at, endMinute: at + t.breakLen, kind: 'BREAK' }); at += t.breakLen; }
        if (t.lunchAfter === i && t.lunchLen > 0) { out.push({ name: 'Lunch', startMinute: at, endMinute: at + t.lunchLen, kind: 'LUNCH' }); at += t.lunchLen; }
    }
    return out;
}

/** Create a whole day's periods and breaks in one go instead of adding them one at a time. */
function QuickBuilder({ yearId, onDone }: { yearId: string | null; onDone: () => void }) {
    const [t, setT] = useState<Template>({ firstBell: '08:00', periodLen: 40, count: 7, breakAfter: 3, breakLen: 20, lunchAfter: 5, lunchLen: 30 });
    const [busy, setBusy] = useState(false);
    const preview = buildSchedule(t);
    const num = (k: keyof Template, label: string, min = 0, max = 240) => (
        <label className="text-[11px] font-medium text-muted-foreground">{label}
            <input type="number" min={min} max={max} className={`${input} mt-1 w-full`} value={t[k] as number} onChange={e => setT({ ...t, [k]: Math.max(min, Math.min(max, Number(e.target.value) || 0)) })} />
        </label>
    );
    const create = async () => {
        if (preview[preview.length - 1].endMinute > 24 * 60) { toast.error('The day runs past midnight — shorten the periods.'); return; }
        setBusy(true);
        try {
            for (const s of preview) await ttApi.post('/slots', yearId, { name: s.name, startMinute: s.startMinute, endMinute: s.endMinute, kind: s.kind });
            toast.success(`${preview.length} slots created`);
            onDone();
        } catch (e) { toast.error(errMsg(e)); onDone(); } finally { setBusy(false); }
    };
    return (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
            <div><h3 className="text-sm font-semibold">Quick setup: build the school day</h3><p className="text-xs text-muted-foreground">Fill this in and every period and break is created for you. You can edit or add to them afterwards.</p></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="text-[11px] font-medium text-muted-foreground">First bell<input type="time" className={`${input} mt-1 w-full`} value={t.firstBell} onChange={e => setT({ ...t, firstBell: e.target.value })} /></label>
                {num('periodLen', 'Period length (min)', 10, 120)}
                {num('count', 'Number of periods', 1, 14)}
                <span />
                {num('breakAfter', 'Break after period # (0 = none)', 0, 14)}
                {num('breakLen', 'Break length (min)', 0, 90)}
                {num('lunchAfter', 'Lunch after period # (0 = none)', 0, 14)}
                {num('lunchLen', 'Lunch length (min)', 0, 120)}
            </div>
            <PeriodTimeline slots={preview} />
            <button type="button" disabled={busy} onClick={() => void create()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create {preview.length} slots
            </button>
        </div>
    );
}

/** Where the school is in the setup, with the next thing to do. */
function SetupGuide({ data }: { data: SetupData }) {
    const steps = [
        { label: 'Working days', done: data.workingDays.length > 0, hint: 'Pick the days the school runs.' },
        { label: 'Periods & breaks', done: data.slots.some(s => s.kind === 'PERIOD'), hint: 'Use Quick setup below, or add them one by one.' },
        { label: 'Rooms (optional)', done: data.rooms.length > 0, optional: true, hint: 'Add labs, library and ground in the Rooms & teachers tab.' },
    ];
    const next = steps.findIndex(s => !s.done && !s.optional);
    return (
        <section className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
                {steps.map((s, i) => (
                    <div key={s.label} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${s.done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600' : i === next ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground'}`}>
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-current/10 text-[10px]">{s.done ? <Check className="w-3 h-3" /> : i + 1}</span>{s.label}
                    </div>
                ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
                {next === -1 ? 'Setup is complete. Open a class and add its weekly requirements, then generate.' : `Next: ${steps[next].hint}`}
            </p>
        </section>
    );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div><h2 className="font-semibold text-foreground">{title}</h2>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
            {children}
        </section>
    );
}

export function SetupClient() {
    const { selectedYearId, years, loading: yl } = useAcademicYear();
    const canManage = useCanManageTimetable();
    const [busy, setBusy] = useState(false);
    const [edit, setEdit] = useState<{ id: string | null; name: string; start: string; end: string; kind: SlotKind } | null>(null);
    const [copyFrom, setCopyFrom] = useState('');

    const q = useRemote(selectedYearId ? `setup:${selectedYearId}` : null, () => ttApi.setup(selectedYearId), e => toast.error(errMsg(e, 'Could not load setup')));
    const data = q.data;
    const load = q.reload;

    const writable = !!data?.writable && canManage;
    const act = async (fn: () => Promise<unknown>, ok?: string) => {
        setBusy(true);
        try { await fn(); if (ok) toast.success(ok); load(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };

    if (yl || !data) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

    const toggleDay = (d: number) => {
        const next = data.workingDays.includes(d) ? data.workingDays.filter(x => x !== d) : [...data.workingDays, d];
        if (!next.length) { toast.error('Keep at least one working day'); return; }
        void act(() => ttApi.put('/settings', selectedYearId, { workingDays: next }), 'Working days saved');
    };

    const saveSlot = () => {
        if (!edit) return;
        const body = { name: edit.name.trim(), startMinute: fromHHMM(edit.start), endMinute: fromHHMM(edit.end), kind: edit.kind };
        if (!body.name) { toast.error('Give the period a name'); return; }
        void act(async () => {
            if (edit.id) await ttApi.patch(`/slots/${edit.id}`, selectedYearId, body);
            else await ttApi.post('/slots', selectedYearId, body);
            setEdit(null);
        }, 'Period saved');
    };

    const move = (i: number, dir: -1 | 1) => {
        const ids = data.slots.map(s => s.id);
        const j = i + dir;
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        void act(() => ttApi.patch('/slots/reorder', selectedYearId, { orderedIds: ids }));
    };

    const newSlot = () => {
        const last = data.slots[data.slots.length - 1];
        const start = last ? last.endMinute : 8 * 60;
        setEdit({ id: null, name: `Period ${data.slots.filter(s => s.kind === 'PERIOD').length + 1}`, start: toHHMM(start), end: toHHMM(start + 40), kind: 'PERIOD' });
    };

    return (
        <div className="space-y-4">
            {!data.writable && <p className="text-sm text-amber-600">This academic year is closed. Its setup is read-only.</p>}
            <SetupGuide data={data} />

            <Section title="Working days" hint="Days the school runs. Timetables only use these days.">
                <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                        <button key={d} type="button" disabled={!writable || busy} onClick={() => toggleDay(d)}
                            className={`rounded-lg border px-3 py-1.5 text-sm ${data.workingDays.includes(d) ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground'} disabled:opacity-60`}>
                            {DAY_NAMES[d]}
                        </button>
                    ))}
                </div>
                {!data.workingDays.length && <p className="text-xs text-amber-600">No working days selected yet.</p>}
            </Section>

            <Section title="Periods & breaks" hint="Any number of periods, any length. Breaks, lunch, assembly and activity slots never receive normal classes.">
                <PeriodTimeline slots={data.slots} />
                {writable && data.slots.length === 0 && <QuickBuilder yearId={selectedYearId} onDone={load} />}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[520px]">
                        <thead className="text-xs text-muted-foreground text-left"><tr><th className="py-1">#</th><th>Name</th><th>Time</th><th>Type</th><th /></tr></thead>
                        <tbody>
                            {data.slots.map((s: Slot, i) => (
                                <tr key={s.id} className="border-t border-border/40">
                                    <td className="py-1.5 text-muted-foreground">{i + 1}</td>
                                    <td className="font-medium">{s.name}</td>
                                    <td>{fmtTime(s.startMinute)} – {fmtTime(s.endMinute)} <span className="text-xs text-muted-foreground">({s.endMinute - s.startMinute} min)</span></td>
                                    <td><span className={`rounded-full px-2 py-0.5 text-[11px] ${s.kind === 'PERIOD' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{s.kind.toLowerCase()}</span></td>
                                    <td className="text-right whitespace-nowrap">
                                        {writable && (<>
                                            <button className="p-1 text-muted-foreground hover:text-foreground" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                                            <button className="p-1 text-muted-foreground hover:text-foreground" disabled={busy || i === data.slots.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                                            <button className="p-1 text-muted-foreground hover:text-foreground" onClick={() => setEdit({ id: s.id, name: s.name, start: toHHMM(s.startMinute), end: toHHMM(s.endMinute), kind: s.kind })} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button className="p-1 text-muted-foreground hover:text-red-600" disabled={busy} onClick={() => { if (confirm(`Delete ${s.name}?`)) void act(() => ttApi.del(`/slots/${s.id}`, selectedYearId), 'Period deleted'); }} aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </>)}
                                    </td>
                                </tr>
                            ))}
                            {edit && (
                                <tr className="border-t border-primary/40 bg-primary/5">
                                    <td />
                                    <td><input className={`${input} w-28`} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></td>
                                    <td className="whitespace-nowrap"><input type="time" className={input} value={edit.start} onChange={e => setEdit({ ...edit, start: e.target.value })} /> – <input type="time" className={input} value={edit.end} onChange={e => setEdit({ ...edit, end: e.target.value })} /></td>
                                    <td><select className={input} value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value as SlotKind })}>{KINDS.map(k => <option key={k} value={k}>{k.toLowerCase()}</option>)}</select></td>
                                    <td className="text-right whitespace-nowrap">
                                        <button className="p-1 text-emerald-600" disabled={busy} onClick={saveSlot} aria-label="Save"><Check className="w-4 h-4" /></button>
                                        <button className="p-1 text-muted-foreground" onClick={() => setEdit(null)} aria-label="Cancel"><X className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {writable && !edit && <button type="button" onClick={newSlot} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"><Plus className="w-3.5 h-3.5" /> Add period or break</button>}

                {writable && data.slots.length === 0 && years.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm">
                        <Copy className="w-4 h-4 text-muted-foreground" /> Start from another year&apos;s schedule:
                        <select className={input} value={copyFrom} onChange={e => setCopyFrom(e.target.value)}>
                            <option value="">Choose year…</option>
                            {years.filter(y => y.id !== selectedYearId).map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
                        </select>
                        <button disabled={!copyFrom || busy} className="rounded-lg bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                            onClick={() => void act(() => ttApi.post('/slots/copy-from-year', selectedYearId, { fromAcademicYearId: copyFrom }), 'Schedule copied')}>Copy</button>
                    </div>
                )}
            </Section>

            <SessionTypesSection types={data.sessionTypes} writable={writable} yearId={selectedYearId} reload={load} />
        </div>
    );
}

function SessionTypesSection({ types, writable, yearId, reload }: { types: SessionType[]; writable: boolean; yearId: string | null; reload: () => void }) {
    const [draft, setDraft] = useState<(Partial<SessionType> & { name: string; kind: string }) | null>(null);
    const [busy, setBusy] = useState(false);
    const save = async () => {
        if (!draft || !draft.name.trim()) return;
        setBusy(true);
        const body = {
            name: draft.name.trim(), kind: draft.kind, requiresTeacher: draft.requiresTeacher ?? true, requiresRoom: draft.requiresRoom ?? false,
            roomType: draft.roomType || null, defaultSpan: draft.defaultSpan ?? 1, color: draft.color ?? null, isActive: draft.isActive ?? true,
        };
        try {
            if (draft.id) await ttApi.patch(`/session-types/${draft.id}`, yearId, body);
            else await ttApi.post('/session-types', yearId, body);
            toast.success('Session type saved'); setDraft(null); reload();
        } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };
    const remove = async (t: SessionType) => {
        if (!confirm(`Delete "${t.name}"?`)) return;
        try { await ttApi.del(`/session-types/${t.id}`, yearId); toast.success('Deleted'); reload(); } catch (e) { toast.error(errMsg(e)); }
    };
    return (
        <Section title="Session types" hint="What can be scheduled: theory, practicals, labs, activities, PT, library, assembly… Add your own — no code change needed.">
            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                    <thead className="text-xs text-muted-foreground text-left"><tr><th className="py-1">Name</th><th>Kind</th><th>Teacher</th><th>Room</th><th>Periods</th><th /></tr></thead>
                    <tbody>
                        {types.map(t => (
                            <tr key={t.id} className={`border-t border-border/40 ${t.isActive ? '' : 'opacity-50'}`}>
                                <td className="py-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: t.color ?? '#94a3b8' }} />{t.name}</td>
                                <td className="text-xs text-muted-foreground">{t.kind.replace('_', ' ').toLowerCase()}</td>
                                <td>{t.requiresTeacher ? 'Required' : '—'}</td>
                                <td>{t.requiresRoom ? (t.roomType ? t.roomType.toLowerCase() : 'Required') : '—'}</td>
                                <td>{t.defaultSpan}</td>
                                <td className="text-right whitespace-nowrap">
                                    {writable && (<>
                                        <button className="p-1 text-muted-foreground hover:text-foreground" onClick={() => setDraft({ ...t })} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                        <button className="p-1 text-muted-foreground hover:text-red-600" onClick={() => void remove(t)} aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </>)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {writable && !draft && <button type="button" onClick={() => setDraft({ name: '', kind: 'CUSTOM', requiresTeacher: true, requiresRoom: false, defaultSpan: 1, color: '#7C3AED', isActive: true })} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"><Plus className="w-3.5 h-3.5" /> Add session type</button>}
            {draft && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 grid gap-2 sm:grid-cols-3 text-sm">
                    <input className={input} placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                    <select className={input} value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value })}>{SESSION_KINDS.map(k => <option key={k} value={k}>{k.replace('_', ' ').toLowerCase()}</option>)}</select>
                    <input className={input} placeholder="Room type (e.g. LAB, GROUND)" value={draft.roomType ?? ''} onChange={e => setDraft({ ...draft, roomType: e.target.value.toUpperCase() })} />
                    <label className="flex items-center gap-2"><input type="checkbox" checked={draft.requiresTeacher ?? true} onChange={e => setDraft({ ...draft, requiresTeacher: e.target.checked })} /> Needs a teacher</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={draft.requiresRoom ?? false} onChange={e => setDraft({ ...draft, requiresRoom: e.target.checked })} /> Needs a room</label>
                    <label className="flex items-center gap-2">Consecutive periods <input type="number" min={1} max={6} className={`${input} w-16`} value={draft.defaultSpan ?? 1} onChange={e => setDraft({ ...draft, defaultSpan: Number(e.target.value) || 1 })} /></label>
                    <label className="flex items-center gap-2">Color <input type="color" value={draft.color ?? '#7C3AED'} onChange={e => setDraft({ ...draft, color: e.target.value })} /></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isActive ?? true} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} /> Active</label>
                    <div className="flex gap-2 sm:justify-end sm:col-span-3">
                        <button className="rounded-lg border border-border px-3 py-1 hover:bg-muted" onClick={() => setDraft(null)}>Cancel</button>
                        <button className="rounded-lg bg-primary px-4 py-1 font-semibold text-primary-foreground disabled:opacity-50" disabled={busy} onClick={() => void save()}>Save</button>
                    </div>
                </div>
            )}
        </Section>
    );
}
