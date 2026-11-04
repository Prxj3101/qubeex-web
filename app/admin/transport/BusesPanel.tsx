'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bus as BusIcon, Check, Loader2, Pencil, Phone, Plus, Radio, Search, Trash2, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { EmptyState, Field, PageHeader, PhoneInput, Pill, PrimaryButton, SecondaryButton, SmallButton, ThemedSelect, inputCls, phoneComplete } from '@/app/admin/payroll/_components/ui';
import { clock, isCombinedMidday, plannedTimes, rideMinutes, type Bus, type SchoolPoint, type Shift, type TransportRoute } from './types';
import { TransportArt } from './TransportArt';
import { Avatar } from './WaitingPanel';

interface BusDraft {
    id?: string; name: string; plateNumber: string; trackerId: string; driverName: string; driverPhone: string; capacity: string; routeId: string;
    morningShift: boolean; morningPickup: string; morningDrop: string; afternoonShift: boolean; afternoonPickup: string; afternoonDrop: string;
}
interface Rider { studentId: string; admissionNo: string; name: string; rollNo: string | null; avatarUrl: string | null; className: string; stop: { id: string; name: string } | null; shift: Shift }
interface Found { studentId: string; admissionNo: string; name: string; avatarUrl: string | null; className: string; currentBus: { id: string; name: string } | null }

const card = 'rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)]';
const NO_ROUTE = '__none';
const NO_STOP = '__none';

// One bus as a card, in the same style as the route cards: route-colour strip,
// number plate, the key details in a soft box, and how full the bus is.
function BusCard({ bus: b, onEdit, onDelete, onStudents }: { bus: Bus; onEdit: () => void; onDelete: () => void; onStudents: () => void }) {
    const color = b.route?.color ?? '#9CA3AF';
    const riders = b._count.students;
    const full = b.capacity ? Math.min(100, Math.round((riders / b.capacity) * 100)) : 0;
    const over = !!b.capacity && riders > b.capacity;
    // every row has a fixed height so all cards line up the same, whatever is filled in
    const row = 'flex h-9 items-center gap-2.5 text-xs';
    const label = 'w-16 shrink-0 text-[11px] text-muted-foreground';

    return (
        <div className={`${card} overflow-hidden flex flex-col`} data-admin-surface="">
            <div className="h-1.5 shrink-0" style={{ background: color }} />
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start gap-3">
                    <TransportArt kind="bus" size={64} />
                    <div className="min-w-0 flex-1 pt-1">
                        <h3 className="font-semibold text-[15px] leading-tight truncate">{b.name}</h3>
                        <div className="mt-2 flex h-[26px] items-center">{b.plateNumber
                            // Indian-style number plate (same as the parent app): white plate, black bold letters, blue "IND" strip
                            ? <span className="inline-flex items-stretch overflow-hidden rounded-[5px] border-[1.5px] border-[#111] bg-white">
                                <span className="flex items-center bg-[#1D4ED8] px-[3px] text-[7px] font-bold leading-none text-white">IND</span>
                                <span className="px-[7px] py-[3px] text-[13px] font-bold leading-[17px] tracking-[1.2px] text-[#111] uppercase">{b.plateNumber}</span>
                            </span>
                            : <span className="text-[11px] text-muted-foreground">No number plate</span>}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <SmallButton onClick={onEdit} aria-label={`Edit ${b.name}`}><Pencil size={12} />Edit</SmallButton>
                        <SmallButton onClick={onDelete} aria-label={`Delete ${b.name}`} className="text-red-600"><Trash2 size={12} /></SmallButton>
                    </div>
                </div>

                <div className="mt-4 rounded-xl bg-muted/30 px-3 py-1.5 divide-y divide-border/40">
                    <div className={row}>
                        <span className={label}>Route</span>
                        {b.route
                            ? <span className="flex min-w-0 items-center gap-1.5 font-medium"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} /><span className="truncate">{b.route.name}</span></span>
                            : <span className="text-muted-foreground">Not set</span>}
                    </div>
                    <div className={row}>
                        <span className={label}>Tracker</span>
                        {b.trackerId
                            ? <span className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] font-semibold"><Radio size={12} className="shrink-0 text-red-500" /><span className="truncate">{b.trackerId}</span></span>
                            : <Pill tone="amber">Not fitted yet</Pill>}
                    </div>
                    <div className={row}>
                        <span className={label}>Driver</span>
                        {b.driverName || b.driverPhone
                            ? <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                                {b.driverName && <span className="truncate font-medium">{b.driverName}</span>}
                                {b.driverPhone && <a href={`tel:${b.driverPhone.replace(/\s+/g, '')}`} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-card px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"><Phone size={11} />{b.driverPhone}</a>}
                            </span>
                            : <span className="text-muted-foreground">Not added</span>}
                    </div>
                    <div className="flex h-14 items-center gap-2.5 text-xs">
                        <span className={label}>Timings</span>
                        {/* always two lines (morning + afternoon) so every card is the same height */}
                        <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate tabular-nums"><span className="font-medium">Morning</span> <span className="text-muted-foreground">{!b.morningShift ? 'Off' : b.morningPickup ? `${clock(b.morningPickup)} → ${clock(b.morningDrop)}` : 'times not set'}</span></span>
                            <span className="truncate tabular-nums"><span className="font-medium">Afternoon</span> <span className="text-muted-foreground">{!b.afternoonShift ? 'Off' : b.afternoonPickup ? `${clock(b.afternoonPickup)} → ${clock(b.afternoonDrop)}` : 'times not set'}</span></span>
                        </span>
                    </div>
                </div>

                <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold">{riders} {riders === 1 ? 'student' : 'students'}</span>
                        <span className={over ? 'font-semibold text-red-600' : 'text-muted-foreground'}>{b.capacity ? (over ? `${riders - b.capacity} over ${b.capacity} seats` : `${b.capacity - riders} of ${b.capacity} seats free`) : 'Seats not set'}</span>
                    </div>
                    {/* bar always drawn (empty when seats aren't set) so the cards keep the same height */}
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        {!!b.capacity && <div className="h-full rounded-full transition-all" style={{ width: `${full}%`, background: over ? '#DC2626' : color }} />}
                    </div>
                </div>

                {/* spacer pushes the button to the bottom of every card */}
                <div className="min-h-3 flex-1" />
                <SecondaryButton className="w-full" onClick={onStudents}><Users size={13} />Students on this bus</SecondaryButton>
            </div>
        </div>
    );
}

/**
 * Indian number plate, formatted while typing: "mh48ab1234" -> "MH 48 AB 1234".
 * State (2 letters) · district (1-2 digits) · series (0-3 letters) · number (1-4 digits).
 */
function formatPlate(raw: string): string {
    const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const m = /^([A-Z]{0,2})(\d{0,2})([A-Z]{0,3})(\d{0,4})/.exec(s);
    return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ') : '';
}
const PLATE_OK = /^[A-Z]{2} \d{1,2}( [A-Z]{1,3})? \d{1,4}$/;

export default function BusesPanel({ buses, routes, school, onChanged, addSignal, onAddHandled }: { buses: Bus[]; routes: TransportRoute[]; school: SchoolPoint | null; onChanged: () => void; addSignal: number; onAddHandled: () => void }) {
    const [draft, setDraft] = useState<BusDraft | null>(null);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<Bus | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [ridersFor, setRidersFor] = useState<Bus | null>(null);

    const open = useCallback((b?: Bus) => setDraft(b
        ? {
            id: b.id, name: b.name, plateNumber: formatPlate(b.plateNumber), trackerId: b.trackerId ?? '', driverName: b.driverName, driverPhone: b.driverPhone, capacity: b.capacity ? String(b.capacity) : '', routeId: b.routeId ?? NO_ROUTE,
            morningShift: b.morningShift, morningPickup: b.morningPickup, morningDrop: b.morningDrop, afternoonShift: b.afternoonShift, afternoonPickup: b.afternoonPickup, afternoonDrop: b.afternoonDrop,
        }
        : {
            name: '', plateNumber: '', trackerId: '', driverName: '', driverPhone: '', capacity: '', routeId: NO_ROUTE,
            morningShift: true, morningPickup: '', morningDrop: '', afternoonShift: false, afternoonPickup: '', afternoonDrop: '',
        }), []);

    // "Add a bus" from the Live tab
    useEffect(() => { if (addSignal) { open(); onAddHandled(); } }, [addSignal, open, onAddHandled]);

    // Two trips of this bus that start too close together: the bus can't be
    // back from one before the next leaves. Only a warning (times are rough).
    const clash = (() => {
        if (!draft) return null;
        const route = routes.find(r => r.id === draft.routeId);
        const trip = route ? rideMinutes(route.stops, school).roundTrip : null;
        if (!trip) return null;
        const mins = (t: string) => { const m = /^(\d{2}):(\d{2})$/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
        const trips = [
            ...(draft.morningShift ? [{ label: 'Morning pickup', at: draft.morningPickup }, { label: 'Morning drop', at: draft.morningDrop }] : []),
            ...(draft.afternoonShift ? [{ label: 'Afternoon pickup', at: draft.afternoonPickup }, { label: 'Afternoon drop', at: draft.afternoonDrop }] : []),
        ].map(t => ({ ...t, m: mins(t.at) })).filter((t): t is { label: string; at: string; m: number } => t.m != null).sort((a, b) => a.m - b.m);
        // same time for morning drop + afternoon pickup is the combined midday trip: count it once
        const combined = isCombinedMidday(draft);
        const list = combined ? trips.filter(t => t.label !== 'Afternoon pickup') : trips;
        for (let i = 1; i < list.length; i++) {
            const prev = list[i - 1], next = list[i];
            if (next.m - prev.m < trip) {
                const back = prev.m + trip;
                const backAt = `${String(Math.floor(back / 60) % 24).padStart(2, '0')}:${String(back % 60).padStart(2, '0')}`;
                return `${prev.label} takes about ${trip} min, so the bus is back around ${clock(backAt)}. ${next.label} at ${clock(next.at)} may be too early.`;
            }
        }
        return null;
    })();

    const save = async () => {
        if (!draft || saving) return;
        if (!draft.name.trim()) { toast.error('Give the bus a name, like "Bus 1"'); return; }
        if (draft.plateNumber && !PLATE_OK.test(draft.plateNumber)) { toast.error('Number plate should look like MH 48 AB 1234'); return; }
        if (draft.driverPhone && !phoneComplete(draft.driverPhone)) { toast.error('Driver phone number is not complete'); return; }
        const cap = draft.capacity.trim() ? Number(draft.capacity) : null;
        if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 200)) { toast.error('Seats should be a number between 1 and 200'); return; }
        if (!draft.morningShift && !draft.afternoonShift) { toast.error('Tick at least one shift this bus runs'); return; }
        if (draft.morningShift && (!draft.morningPickup || !draft.morningDrop)) { toast.error('Add the morning pickup and drop times'); return; }
        if (draft.afternoonShift && (!draft.afternoonPickup || !draft.afternoonDrop)) { toast.error('Add the afternoon pickup and drop times'); return; }
        setSaving(true);
        try {
            const payload = {
                name: draft.name, plateNumber: draft.plateNumber.toUpperCase(), trackerId: draft.trackerId.trim() || null,
                driverName: draft.driverName, driverPhone: draft.driverPhone, capacity: cap,
                routeId: draft.routeId === NO_ROUTE ? null : draft.routeId,
                morningShift: draft.morningShift, morningPickup: draft.morningPickup, morningDrop: draft.morningDrop,
                afternoonShift: draft.afternoonShift, afternoonPickup: draft.afternoonPickup, afternoonDrop: draft.afternoonDrop,
            };
            if (draft.id) await api.put(`/admin/transport/buses/${draft.id}`, payload);
            else await api.post('/admin/transport/buses', payload);
            toast.success(draft.id ? 'Bus saved' : 'Bus added');
            setDraft(null);
            onChanged();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not save the bus')); }
        finally { setSaving(false); }
    };

    const remove = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/transport/buses/${toDelete.id}`);
            toast.success('Bus deleted');
            setToDelete(null);
            onChanged();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not delete the bus')); }
        finally { setDeleting(false); }
    };

    return <>
        <div className="flex-1 min-h-0 overflow-y-auto visible-scrollbar px-1 pb-6 space-y-3">
            <PageHeader title="Buses" subtitle="Each school bus, its GPS tracker, driver and the students who ride it">
                <PrimaryButton onClick={() => open()}><Plus size={14} />Add bus</PrimaryButton>
            </PageHeader>
            {!buses.length
                ? <EmptyState icon={BusIcon} title="No buses yet" text="Add each school bus with the id of the GPS tracker fitted in it." />
                : <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {buses.map(b => (
                        <BusCard key={b.id} bus={b} onEdit={() => open(b)} onDelete={() => setToDelete(b)} onStudents={() => setRidersFor(b)} />
                    ))}
                </div>}
        </div>

        <Dialog open={!!draft} onOpenChange={o => { if (!o && !saving) setDraft(null); }}>
            <DialogContent className="sm:max-w-lg bg-card">
                <DialogHeader>
                    <DialogTitle>{draft?.id ? 'Edit bus' : 'Add bus'}</DialogTitle>
                    <DialogDescription>The tracker id is the IMEI / device id of the GPS tracker in this bus.</DialogDescription>
                </DialogHeader>
                {draft && <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Bus name"><input className={inputCls} value={draft.name} maxLength={40} placeholder="Bus 1" onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
                    <Field label="Number plate"><input className={`${inputCls} uppercase tracking-wide`} value={draft.plateNumber} maxLength={13} placeholder="MH 48 AB 1234" onChange={e => setDraft({ ...draft, plateNumber: formatPlate(e.target.value) })} /></Field>
                    <div className="sm:col-span-2"><Field label="GPS tracker id" hint="Leave empty if the tracker is not fitted yet. For testing with the Traccar Client app, use the app's device identifier.">
                        <input className={inputCls} value={draft.trackerId} maxLength={64} placeholder="e.g. 358657100123456" onChange={e => setDraft({ ...draft, trackerId: e.target.value })} />
                    </Field></div>
                    <Field label="Route"><ThemedSelect value={draft.routeId} onChange={v => setDraft({ ...draft, routeId: v })} options={[{ value: NO_ROUTE, label: 'No route yet' }, ...routes.map(r => ({ value: r.id, label: r.name }))]} /></Field>
                    <Field label="Seats"><input className={inputCls} inputMode="numeric" value={draft.capacity} placeholder="40" onChange={e => setDraft({ ...draft, capacity: e.target.value.replace(/\D/g, '') })} /></Field>
                    <Field label="Driver name"><input className={inputCls} value={draft.driverName} maxLength={60} onChange={e => setDraft({ ...draft, driverName: e.target.value })} /></Field>
                    <Field label="Driver phone"><PhoneInput value={draft.driverPhone} onChange={driverPhone => setDraft({ ...draft, driverPhone })} /></Field>
                    <div className="sm:col-span-2 space-y-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">Timings</span>
                        <div className="rounded-xl border border-border/60 divide-y divide-border/50">
                            {([['morning', 'Morning shift'], ['afternoon', 'Afternoon shift']] as const).map(([key, label]) => {
                                const on = draft[`${key}Shift`];
                                return (
                                    <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                                        <label className="flex w-36 cursor-pointer items-center gap-2 text-sm font-medium">
                                            <input type="checkbox" className="h-4 w-4 accent-[#DA7756]" checked={on} onChange={e => setDraft({ ...draft, ...({ [`${key}Shift`]: e.target.checked } as Partial<BusDraft>) })} />
                                            {label}
                                        </label>
                                        <label className={`flex items-center gap-1.5 text-xs ${on ? '' : 'opacity-40'}`}>
                                            <span className="text-muted-foreground">Pickup</span>
                                            <input type="time" disabled={!on} className={`${inputCls} h-8 w-[7rem] text-xs`} value={draft[`${key}Pickup`]} onChange={e => setDraft({ ...draft, ...({ [`${key}Pickup`]: e.target.value } as Partial<BusDraft>) })} />
                                        </label>
                                        <label className={`flex items-center gap-1.5 text-xs ${on ? '' : 'opacity-40'}`}>
                                            <span className="text-muted-foreground">Drop</span>
                                            <input type="time" disabled={!on} className={`${inputCls} h-8 w-[7rem] text-xs`} value={draft[`${key}Drop`]} onChange={e => setDraft({ ...draft, ...({ [`${key}Drop`]: e.target.value } as Partial<BusDraft>) })} />
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                        <span className="block text-[11px] text-muted-foreground/80">Both times are when the bus leaves school. Pickup: leaves to collect children. Drop: leaves to take them home. Each stop&apos;s time is worked out from this.</span>
                        {clash && <span className="block rounded-lg bg-amber-100 px-2 py-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">{clash}</span>}
                        {isCombinedMidday(draft) && <span className="block text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Morning drop and afternoon pickup leave together: one midday trip, children get off and on at each stop.</span>}
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                        <SecondaryButton onClick={() => setDraft(null)} disabled={saving}>Cancel</SecondaryButton>
                        <PrimaryButton onClick={save} disabled={saving}>{saving && <Loader2 size={13} className="animate-spin" />}Save</PrimaryButton>
                    </div>
                </div>}
            </DialogContent>
        </Dialog>

        <DeleteConfirmDialog
            open={!!toDelete}
            onOpenChange={o => { if (!o) setToDelete(null); }}
            label="bus"
            name={toDelete?.name ?? ''}
            description="Students on this bus are taken off it: parents stop seeing a bus, and their bus fee stops from the next due month (months already due or paid keep it)."
            loading={deleting}
            onConfirm={remove}
        />

        {ridersFor && <RidersDialog bus={ridersFor} route={routes.find(r => r.id === ridersFor.routeId) ?? null} school={school} onClose={() => { setRidersFor(null); onChanged(); }} />}
    </>;
}

// Students on one bus: list, change stop, remove, and add by searching.
function RidersDialog({ bus, route, school, onClose }: { bus: Bus; route: TransportRoute | null; school: SchoolPoint | null; onClose: () => void }) {
    const [riders, setRiders] = useState<Rider[] | null>(null);
    const [q, setQ] = useState('');
    const [found, setFound] = useState<Found[]>([]);
    const [searching, setSearching] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const stopOptions = [{ value: NO_STOP, label: 'No stop' }, ...(route?.stops ?? []).map((s, i) => ({ value: s.id as string, label: `${i + 1}. ${s.name}` }))];
    const bothShifts = bus.morningShift && bus.afternoonShift;
    const shiftOptions = [{ value: 'MORNING', label: 'Morning' }, { value: 'AFTERNOON', label: 'Afternoon' }];
    // planned pickup / drop time at each stop, per shift
    const stopsList = route?.stops ?? [];
    const times = (shift: Shift) => ({
        pickup: plannedTimes(stopsList, school, shift === 'AFTERNOON' ? bus.afternoonPickup : bus.morningPickup, 'PICKUP'),
        drop: plannedTimes(stopsList, school, shift === 'AFTERNOON' ? bus.afternoonDrop : bus.morningDrop, 'DROP', shift === 'MORNING' && isCombinedMidday(bus)),
    });
    const plan = { MORNING: times('MORNING'), AFTERNOON: times('AFTERNOON') };
    const riderTimes = (r: Rider) => {
        const i = r.stop ? stopsList.findIndex(s => s.id === r.stop!.id) : -1;
        if (i < 0) return '';
        const p = plan[r.shift].pickup[i], d = plan[r.shift].drop[i];
        return [p && `Pickup ~${clock(p)}`, d && `Drop ~${clock(d)}`].filter(Boolean).join(' · ');
    };

    const load = useCallback(async () => {
        try { setRiders((await api.get(`/admin/transport/buses/${bus.id}/students`)).data.data); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not load students')); setRiders([]); }
    }, [bus.id]);
    useEffect(() => { void load(); }, [load]);

    // search as you type (small delay so we don't call on every key)
    useEffect(() => {
        const term = q.trim();
        if (term.length < 2) { setFound([]); return; }
        const t = setTimeout(async () => {
            setSearching(true);
            try { setFound((await api.get('/admin/transport/students/search', { params: { q: term } })).data.data); }
            catch { setFound([]); }
            finally { setSearching(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    const assign = async (studentId: string, stopId: string | null, shift?: Shift) => {
        setBusy(studentId);
        try {
            await api.put(`/admin/transport/students/${studentId}`, { busId: bus.id, stopId, ...(shift ? { shift } : {}) });
            await load();
            setFound(f => f.filter(x => x.studentId !== studentId));
        } catch (err) { toast.error(getErrorMessage(err, 'Could not save')); }
        finally { setBusy(null); }
    };
    // Adding (or moving) a student: pick stop, shift and the fee months first.
    const [adding, setAdding] = useState<Found | null>(null);
    const [addStop, setAddStop] = useState('');
    const [addShift, setAddShift] = useState<Shift>('MORNING');
    const [feeMonths, setFeeMonths] = useState<{ id: string; month: string; due: boolean; paid: boolean }[] | null>(null);
    const [months, setMonths] = useState<string[]>([]);
    const [monthsNote, setMonthsNote] = useState('');
    const openAdd = (f: Found) => {
        setAdding(f);
        setAddStop('');
        setAddShift(bus.morningShift ? 'MORNING' : 'AFTERNOON');
        setFeeMonths(null);
        setMonths([]);
        setMonthsNote('');
        api.get(`/admin/transport/students/${f.studentId}/fee-months`)
            .then(res => {
                const d = res.data.data as { months: { id: string; month: string; due: boolean; paid: boolean }[]; selected: string[] };
                setFeeMonths(d.months);
                setMonths(d.selected);
                if (!d.months.length) setMonthsNote('No fee months set up for this class yet. The bus fee can be set later in the fee card.');
            })
            .catch(() => setMonthsNote('Could not load the fee months. The bus fee starts from the next due month.'));
    };
    const confirmAdd = async () => {
        if (!adding) return;
        const id = adding.studentId;
        setBusy(id);
        try {
            await api.put(`/admin/transport/students/${id}`, { busId: bus.id, stopId: addStop || null, ...(bothShifts ? { shift: addShift } : {}), ...(feeMonths?.length ? { months } : {}) });
            await load();
            setFound(f => f.filter(x => x.studentId !== id));
            setAdding(null);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not save')); }
        finally { setBusy(null); }
    };

    const [toRemove, setToRemove] = useState<Rider | null>(null);
    const unassign = async () => {
        if (!toRemove) return;
        const studentId = toRemove.studentId;
        setBusy(studentId);
        try { await api.delete(`/admin/transport/students/${studentId}`); setToRemove(null); await load(); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not remove')); }
        finally { setBusy(null); }
    };

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-2xl bg-card">
                <DialogHeader>
                    <DialogTitle>Students on {bus.name}</DialogTitle>
                    <DialogDescription>{route ? `Route: ${route.name}. Pick each student's stop so parents get the right arrival time. Adding a student here also turns on the bus fee on their fee card (filled from the stop's fee).` : 'Give this bus a route first to choose stops.'}</DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input className={`${inputCls} pl-8`} value={q} placeholder="Add a student: search by name or admission no." onChange={e => setQ(e.target.value)} />
                    {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
                {found.length > 0 && <div className="max-h-48 overflow-y-auto visible-scrollbar rounded-xl border border-border/60 divide-y divide-border/50">
                    {found.map(f => (
                        <div key={f.studentId} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                            <Avatar name={f.name || f.admissionNo} url={f.avatarUrl} size={36} />
                            <div className="min-w-0">
                                <p className="font-medium truncate">{f.name || f.admissionNo}</p>
                                <p className="text-[11px] text-muted-foreground">{f.className || 'No class'} · {f.admissionNo}{f.currentBus ? ` · now on ${f.currentBus.name}` : ''}</p>
                            </div>
                            <SmallButton className="ml-auto" disabled={busy === f.studentId || f.currentBus?.id === bus.id} onClick={() => openAdd(f)}>
                                {f.currentBus?.id === bus.id ? 'Added' : f.currentBus ? 'Move here' : <><Plus size={11} />Add</>}
                            </SmallButton>
                        </div>
                    ))}
                </div>}

                <div className="max-h-[50vh] overflow-y-auto visible-scrollbar">
                    {!riders ? <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
                        : !riders.length ? <p className="py-8 text-center text-sm text-muted-foreground">No students on this bus yet.</p>
                            : <table className="w-full text-sm">
                                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="py-2 font-semibold">Student</th>{bothShifts && <th className="font-semibold">Shift</th>}<th className="font-semibold">Stop</th><th /></tr></thead>
                                <tbody className="divide-y divide-border/50">
                                    {riders.map(r => (
                                        <tr key={r.studentId}>
                                            <td className="py-2 pr-2"><div className="flex items-center gap-2.5">
                                                <Avatar name={r.name || r.admissionNo} url={r.avatarUrl} size={36} />
                                                <div className="min-w-0"><p className="font-medium">{r.name || r.admissionNo}</p><p className="text-[11px] text-muted-foreground">{r.className}{r.rollNo ? ` · Roll ${r.rollNo}` : ''}</p></div>
                                            </div></td>
                                            {bothShifts && <td className="py-2 pr-2 w-32"><ThemedSelect value={r.shift} options={shiftOptions} onChange={v => assign(r.studentId, r.stop?.id ?? null, v as Shift)} /></td>}
                                            <td className="py-2 pr-2 w-56">{route
                                                ? <>
                                                    <ThemedSelect value={r.stop?.id ?? NO_STOP} options={stopOptions} onChange={v => assign(r.studentId, v === NO_STOP ? null : v)} />
                                                    {riderTimes(r) && <p className="mt-1 text-[11px] text-muted-foreground">{riderTimes(r)}</p>}
                                                </>
                                                : <span className="text-xs text-muted-foreground">-</span>}</td>
                                            <td className="py-2 text-right"><SmallButton disabled={busy === r.studentId} onClick={() => setToRemove(r)} aria-label={`Remove ${r.name || r.admissionNo} from this bus`} className="text-red-600"><UserMinus size={12} /></SmallButton></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>}
                </div>
                <Dialog open={!!adding} onOpenChange={o => { if (!o && !busy) setAdding(null); }}>
                    <DialogContent className="sm:max-w-md bg-card">
                        <DialogHeader>
                            <DialogTitle>{adding?.currentBus ? `Move ${adding.name || adding.admissionNo} to ${bus.name}` : `Add ${adding?.name || adding?.admissionNo || ''} to ${bus.name}`}</DialogTitle>
                            <DialogDescription>Their fee card gets the bus too, with the stop&apos;s monthly fee.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-muted-foreground">Stop</span>
                                {stopsList.length
                                    ? <ThemedSelect value={addStop} placeholder="Pick the stop"
                                        options={stopsList.map((s, i) => ({ value: s.id as string, label: `${i + 1}. ${s.name}${s.monthlyFee != null ? ` · ₹${s.monthlyFee.toLocaleString('en-IN')}/month` : ''}` }))}
                                        onChange={setAddStop} />
                                    : <p className="text-xs text-muted-foreground">This bus has no route or stops yet. You can pick the stop later.</p>}
                            </div>
                            {bothShifts && (
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-muted-foreground">Shift</span>
                                    <div className="flex gap-1.5">
                                        {(['MORNING', 'AFTERNOON'] as const).map(sh => (
                                            <button key={sh} type="button" onClick={() => setAddShift(sh)}
                                                className={`flex-1 h-8 rounded-xl border-2 text-xs font-semibold transition-all ${addShift === sh ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                                                {sh === 'MORNING' ? '🌅 Morning' : '☀️ Afternoon'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">Bus fee months</span>
                                    {!!feeMonths?.length && <button type="button" className="text-[11px] font-semibold text-primary hover:underline"
                                        onClick={() => setMonths(months.length === feeMonths.length ? [] : feeMonths.map(m => m.id))}>
                                        {months.length === feeMonths.length ? 'Deselect all' : 'Select all'}
                                    </button>}
                                </div>
                                {monthsNote ? <p className="text-[11px] text-muted-foreground">{monthsNote}</p>
                                    : !feeMonths ? <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 size={12} className="animate-spin" />Loading months...</div>
                                        : <>
                                            <div className="flex flex-wrap gap-1.5">
                                                {feeMonths.map(m => {
                                                    const on = months.includes(m.id);
                                                    return (
                                                        <button key={m.id} type="button" onClick={() => setMonths(on ? months.filter(x => x !== m.id) : [...months, m.id])}
                                                            title={m.paid ? 'Already paid' : m.due ? 'Already due' : undefined}
                                                            className={`flex h-7 items-center gap-1 rounded-xl border-2 px-2.5 text-[11px] font-semibold transition-all ${on ? 'border-[#0891B2] bg-[#0891B2]/10 text-[#0891B2]' : 'border-border text-muted-foreground'}`}>
                                                            {on && <Check size={10} />}{m.month}{(m.paid || m.due) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">Months still to come are ticked. <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" /> already due or paid.</p>
                                        </>}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <SecondaryButton onClick={() => setAdding(null)} disabled={!!busy}>Cancel</SecondaryButton>
                            <PrimaryButton onClick={confirmAdd} disabled={!!busy}>{busy && <Loader2 size={13} className="animate-spin" />}{adding?.currentBus ? 'Move here' : 'Add to bus'}</PrimaryButton>
                        </div>
                    </DialogContent>
                </Dialog>

                <DeleteConfirmDialog
                    open={!!toRemove}
                    onOpenChange={o => { if (!o && !busy) setToRemove(null); }}
                    confirmLabel="Remove"
                    label="student"
                    name={toRemove ? (toRemove.name || toRemove.admissionNo) : ''}
                    description={`They come off ${bus.name}: parents stop seeing the bus, and the bus fee on their fee card stops from the next due month (months already due or paid keep it).`}
                    loading={!!busy}
                    onConfirm={unassign}
                />
            </DialogContent>
        </Dialog>
    );
}
