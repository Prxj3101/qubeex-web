'use client';

import { useEffect, useState } from 'react';
import { useRemote } from '@/hooks/useRemote';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useCanManageTimetable } from '@/hooks/useTimetableAccess';
import { DAY_SHORT, fmtTime, ttApi, errMsg, type Room, type SetupData, type Slot } from '@/lib/timetable';

const input = 'rounded-lg border border-border bg-background px-2 py-1 text-sm';
type Mark = 'U' | 'P';
type Cell = { dayOfWeek: number; slotId: string };
const key = (d: number, s: string) => `${d}|${s}`;

/** Click a cell to cycle: free → unavailable → (preferred, teachers only) → free. */
function AvailabilityGrid({ slots, days, marks, onChange, disabled, allowPreferred }: {
    slots: Slot[]; days: number[]; marks: Map<string, Mark>; onChange: (m: Map<string, Mark>) => void; disabled: boolean; allowPreferred: boolean;
}) {
    const periods = slots.filter(s => s.kind === 'PERIOD');
    const cycle = (k: string) => {
        const next = new Map(marks);
        const cur = next.get(k);
        if (!cur) next.set(k, 'U');
        else if (cur === 'U' && allowPreferred) next.set(k, 'P');
        else next.delete(k);
        onChange(next);
    };
    return (
        <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
                <thead><tr><th className="p-1" />{days.map(d => <th key={d} className="p-1 font-medium text-muted-foreground">{DAY_SHORT[d]}</th>)}</tr></thead>
                <tbody>
                    {periods.map(s => (
                        <tr key={s.id}>
                            <td className="pr-2 py-0.5 whitespace-nowrap text-muted-foreground">{s.name} <span className="text-[10px]">{fmtTime(s.startMinute)}</span></td>
                            {days.map(d => {
                                const m = marks.get(key(d, s.id));
                                return (
                                    <td key={d} className="p-0.5">
                                        <button type="button" disabled={disabled} onClick={() => cycle(key(d, s.id))}
                                            className={`w-12 h-7 rounded-md border text-[10px] font-semibold ${m === 'U' ? 'bg-red-500/15 border-red-500/50 text-red-600' : m === 'P' ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600' : 'border-border text-transparent hover:bg-muted'}`}>
                                            {m === 'U' ? 'Busy' : m === 'P' ? 'Prefer' : '·'}
                                        </button>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function ResourcesClient() {
    const { selectedYearId, loading: yl } = useAcademicYear();
    const canManage = useCanManageTimetable();
    const [tab, setTab] = useState<'rooms' | 'teachers'>('rooms');

    const q = useRemote(selectedYearId ? `setup:${selectedYearId}` : null, () => ttApi.setup(selectedYearId), e => toast.error(errMsg(e, 'Could not load')));
    const data = q.data;
    const load = q.reload;

    if (yl || !data) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    const writable = data.writable && canManage;

    return (
        <div className="space-y-4">
            <div className="flex gap-1 rounded-xl bg-muted/60 p-1 w-fit text-sm">
                {(['rooms', 'teachers'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 font-medium ${tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>{t === 'rooms' ? 'Rooms & labs' : 'Teachers'}</button>
                ))}
            </div>
            {!data.slots.some(s => s.kind === 'PERIOD') && <p className="text-sm text-amber-600">Add periods in Setup first — availability is set per period.</p>}
            {tab === 'rooms' ? <Rooms data={data} writable={writable} yearId={selectedYearId} reload={load} /> : <Teachers data={data} writable={writable} yearId={selectedYearId} reload={load} />}
        </div>
    );
}

function Rooms({ data, writable, yearId, reload }: { data: SetupData; writable: boolean; yearId: string | null; reload: () => void }) {
    const [sel, setSel] = useState<string | null>(null);
    const [marks, setMarks] = useState<Map<string, Mark>>(new Map());
    const [form, setForm] = useState({ name: '', type: 'CLASSROOM', capacity: '' });
    const [busy, setBusy] = useState(false);
    const room: Room | undefined = data.rooms.find(r => r.id === sel);

    useEffect(() => {
        if (!sel) return;
        ttApi.get<Cell[]>(`/rooms/${sel}/unavailability`, yearId)
            .then(rows => setMarks(new Map(rows.map(r => [key(r.dayOfWeek, r.slotId), 'U' as Mark]))))
            .catch(e => toast.error(errMsg(e)));
    }, [sel, yearId]);

    const run = async (fn: () => Promise<unknown>, ok: string) => {
        setBusy(true);
        try { await fn(); toast.success(ok); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };

    return (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-3">
                <ul className="divide-y divide-border/40">
                    {data.rooms.map(r => (
                        <li key={r.id} className={`flex items-center justify-between py-2 px-1 cursor-pointer rounded ${sel === r.id ? 'bg-primary/10' : 'hover:bg-muted/50'}`} onClick={() => setSel(r.id)}>
                            <div><div className={`text-sm font-medium ${r.isActive ? '' : 'line-through text-muted-foreground'}`}>{r.name}</div>
                                <div className="text-xs text-muted-foreground">{r.type.toLowerCase()}{r.capacity ? ` · ${r.capacity} seats` : ''}</div></div>
                            {writable && <button className="p-1 text-muted-foreground hover:text-red-600" aria-label="Delete" onClick={e => { e.stopPropagation(); if (confirm(`Delete ${r.name}?`)) void run(async () => { await ttApi.del(`/rooms/${r.id}`, yearId); if (sel === r.id) setSel(null); }, 'Room deleted'); }}><Trash2 className="w-3.5 h-3.5" /></button>}
                        </li>
                    ))}
                    {!data.rooms.length && <li className="py-4 text-sm text-muted-foreground">No rooms yet.</li>}
                </ul>
                {writable && (
                    <div className="space-y-2 border-t border-border/40 pt-3">
                        <input className={`${input} w-full`} placeholder="Name (e.g. Science Lab)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        <div className="flex gap-2">
                            <input className={`${input} flex-1`} placeholder="Type: CLASSROOM, LAB, LIBRARY, GROUND…" value={form.type} onChange={e => setForm({ ...form, type: e.target.value.toUpperCase() })} />
                            <input className={`${input} w-20`} placeholder="Seats" inputMode="numeric" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value.replace(/\D/g, '') })} />
                        </div>
                        <button disabled={busy || !form.name.trim()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                            onClick={() => void run(async () => { await ttApi.post('/rooms', yearId, { name: form.name.trim(), type: form.type || 'CLASSROOM', capacity: form.capacity ? Number(form.capacity) : null }); setForm({ name: '', type: form.type, capacity: '' }); }, 'Room added')}><Plus className="w-3.5 h-3.5" /> Add room</button>
                        <p className="text-[11px] text-muted-foreground">The room type links rooms to sessions: a Practical that needs a LAB will only be placed in rooms of type LAB.</p>
                    </div>
                )}
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                {!room ? <p className="text-sm text-muted-foreground">Select a room to set when it is unavailable.</p> : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold">{room.name} — availability</h3>
                            {writable && (
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={room.isActive} onChange={e => void run(() => ttApi.patch(`/rooms/${room.id}`, yearId, { isActive: e.target.checked }), 'Room updated')} /> Active</label>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">Click a period to mark the room unavailable (maintenance, exams…).</p>
                        <AvailabilityGrid slots={data.slots} days={data.workingDays} marks={marks} onChange={setMarks} disabled={!writable} allowPreferred={false} />
                        {writable && <button disabled={busy} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                            onClick={() => void run(() => ttApi.put(`/rooms/${room.id}/unavailability`, yearId, { cells: [...marks.keys()].map(k => { const [d, s] = k.split('|'); return { dayOfWeek: Number(d), slotId: s }; }) }), 'Availability saved')}>Save availability</button>}
                    </>
                )}
            </div>
        </div>
    );
}

function Teachers({ data, writable, yearId, reload }: { data: SetupData; writable: boolean; yearId: string | null; reload: () => void }) {
    const [sel, setSel] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [marks, setMarks] = useState<Map<string, Mark>>(new Map());
    const [prefs, setPrefs] = useState({ maxPeriodsPerDay: '', maxConsecutive: '', maxPeriodsPerWeek: '' });
    const [busy, setBusy] = useState(false);
    const teacher = data.teachers.find(t => t.id === sel);

    useEffect(() => {
        if (!sel) return;
        ttApi.get<{ unavailable: Cell[]; preferred: Cell[]; prefs: { maxPeriodsPerDay: number | null; maxConsecutive: number | null; maxPeriodsPerWeek: number | null } }>(`/teachers/${sel}/availability`, yearId)
            .then(r => {
                const m = new Map<string, Mark>();
                r.preferred.forEach(c => m.set(key(c.dayOfWeek, c.slotId), 'P'));
                r.unavailable.forEach(c => m.set(key(c.dayOfWeek, c.slotId), 'U'));
                setMarks(m);
                setPrefs({ maxPeriodsPerDay: r.prefs.maxPeriodsPerDay?.toString() ?? '', maxConsecutive: r.prefs.maxConsecutive?.toString() ?? '', maxPeriodsPerWeek: r.prefs.maxPeriodsPerWeek?.toString() ?? '' });
            })
            .catch(e => toast.error(errMsg(e)));
    }, [sel, yearId]);

    const save = async () => {
        setBusy(true);
        try {
            const toCells = (m: Mark) => [...marks.entries()].filter(([, v]) => v === m).map(([k]) => { const [d, s] = k.split('|'); return { dayOfWeek: Number(d), slotId: s }; });
            const n = (v: string) => (v ? Number(v) : null);
            await ttApi.put(`/teachers/${sel}/availability`, yearId, { unavailable: toCells('U'), preferred: toCells('P') });
            await ttApi.put(`/teachers/${sel}/prefs`, yearId, { maxPeriodsPerDay: n(prefs.maxPeriodsPerDay), maxConsecutive: n(prefs.maxConsecutive), maxPeriodsPerWeek: n(prefs.maxPeriodsPerWeek) });
            toast.success('Saved'); reload();
        } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };

    const list = data.teachers.filter(t => t.name.toLowerCase().includes(q.toLowerCase()));
    const num = (k: keyof typeof prefs, label: string) => (
        <label className="text-xs text-muted-foreground">{label}
            <input className={`${input} w-full mt-1`} inputMode="numeric" placeholder="No limit" disabled={!writable} value={prefs[k]} onChange={e => setPrefs({ ...prefs, [k]: e.target.value.replace(/\D/g, '') })} />
        </label>
    );

    return (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-2">
                <input className={`${input} w-full`} placeholder="Search teachers" value={q} onChange={e => setQ(e.target.value)} />
                <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border/40">
                    {list.map(t => (
                        <li key={t.id} onClick={() => setSel(t.id)} className={`py-2 px-2 text-sm cursor-pointer rounded ${sel === t.id ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/50'}`}>{t.name}</li>
                    ))}
                    {!list.length && <li className="py-4 text-sm text-muted-foreground">No teachers found.</li>}
                </ul>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
                {!teacher ? <p className="text-sm text-muted-foreground">Select a teacher to set availability and workload limits.</p> : (
                    <>
                        <h3 className="font-semibold">{teacher.name}</h3>
                        <p className="text-xs text-muted-foreground">Click a period: once = unavailable, twice = preferred, thrice = clear. The generator never schedules this teacher in unavailable periods.</p>
                        <AvailabilityGrid slots={data.slots} days={data.workingDays} marks={marks} onChange={setMarks} disabled={!writable} allowPreferred />
                        <div className="grid gap-3 sm:grid-cols-3 max-w-xl">
                            {num('maxPeriodsPerDay', 'Max periods / day')}
                            {num('maxConsecutive', 'Max consecutive periods')}
                            {num('maxPeriodsPerWeek', 'Max periods / week')}
                        </div>
                        {writable && <button disabled={busy} onClick={() => void save()} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save</button>}
                    </>
                )}
            </div>
        </div>
    );
}
