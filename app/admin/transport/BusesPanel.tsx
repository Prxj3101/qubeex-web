'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bus as BusIcon, Loader2, Pencil, Phone, Plus, Radio, Search, Trash2, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { EmptyState, Field, Pill, PrimaryButton, SecondaryButton, SmallButton, ThemedSelect, inputCls } from '@/app/admin/payroll/_components/ui';
import type { Bus, TransportRoute } from './types';

interface BusDraft { id?: string; name: string; plateNumber: string; trackerId: string; driverName: string; driverPhone: string; capacity: string; routeId: string }
interface Rider { studentId: string; admissionNo: string; name: string; rollNo: string | null; className: string; stop: { id: string; name: string } | null }
interface Found { studentId: string; admissionNo: string; name: string; className: string; currentBus: { id: string; name: string } | null }

const card = 'rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)]';
const NO_ROUTE = '__none';
const NO_STOP = '__none';

export default function BusesPanel({ buses, routes, onChanged, addSignal, onAddHandled }: { buses: Bus[]; routes: TransportRoute[]; onChanged: () => void; addSignal: number; onAddHandled: () => void }) {
    const [draft, setDraft] = useState<BusDraft | null>(null);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<Bus | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [ridersFor, setRidersFor] = useState<Bus | null>(null);

    const open = useCallback((b?: Bus) => setDraft(b
        ? { id: b.id, name: b.name, plateNumber: b.plateNumber, trackerId: b.trackerId ?? '', driverName: b.driverName, driverPhone: b.driverPhone, capacity: b.capacity ? String(b.capacity) : '', routeId: b.routeId ?? NO_ROUTE }
        : { name: '', plateNumber: '', trackerId: '', driverName: '', driverPhone: '', capacity: '', routeId: NO_ROUTE }), []);

    // "Add a bus" from the Live tab
    useEffect(() => { if (addSignal) { open(); onAddHandled(); } }, [addSignal, open, onAddHandled]);

    const save = async () => {
        if (!draft || saving) return;
        if (!draft.name.trim()) { toast.error('Give the bus a name, like "Bus 1"'); return; }
        const cap = draft.capacity.trim() ? Number(draft.capacity) : null;
        if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 200)) { toast.error('Seats should be a number between 1 and 200'); return; }
        setSaving(true);
        try {
            const payload = {
                name: draft.name, plateNumber: draft.plateNumber.toUpperCase(), trackerId: draft.trackerId.trim() || null,
                driverName: draft.driverName, driverPhone: draft.driverPhone, capacity: cap,
                routeId: draft.routeId === NO_ROUTE ? null : draft.routeId,
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
        <div className="flex-1 min-h-0 overflow-y-auto visible-scrollbar">
            <div className="flex justify-end mb-3"><PrimaryButton onClick={() => open()}><Plus size={14} />Add bus</PrimaryButton></div>
            {!buses.length
                ? <EmptyState icon={BusIcon} title="No buses yet" text="Add each school bus with the id of the GPS tracker fitted in it." />
                : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {buses.map(b => (
                        <div key={b.id} className={`${card} p-4`} data-admin-surface="">
                            <div className="flex items-center gap-2">
                                <span className="grid h-9 w-9 place-items-center rounded-xl text-white shrink-0" style={{ background: b.route?.color ?? '#9CA3AF' }}><BusIcon size={17} /></span>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-sm truncate">{b.name}</h3>
                                    <p className="text-[11px] text-muted-foreground truncate">{b.plateNumber || 'No number plate'} · {b.route?.name ?? 'No route'}</p>
                                </div>
                                <div className="ml-auto flex gap-1">
                                    <SmallButton onClick={() => open(b)}><Pencil size={12} /></SmallButton>
                                    <SmallButton onClick={() => setToDelete(b)} className="text-red-600"><Trash2 size={12} /></SmallButton>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {b.trackerId ? <Pill tone="blue"><Radio size={10} />{b.trackerId}</Pill> : <Pill tone="amber">No tracker</Pill>}
                                <Pill><Users size={10} />{b._count.students}{b.capacity ? ` / ${b.capacity}` : ''} students</Pill>
                            </div>
                            {(b.driverName || b.driverPhone) && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Phone size={12} />{b.driverName}{b.driverName && b.driverPhone ? ' · ' : ''}{b.driverPhone}</p>}
                            <SecondaryButton className="mt-3 w-full" onClick={() => setRidersFor(b)}><Users size={13} />Students on this bus</SecondaryButton>
                        </div>
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
                    <Field label="Number plate"><input className={inputCls} value={draft.plateNumber} maxLength={20} placeholder="MH 48 AB 1234" onChange={e => setDraft({ ...draft, plateNumber: e.target.value })} /></Field>
                    <div className="sm:col-span-2"><Field label="GPS tracker id" hint="Leave empty if the tracker is not fitted yet. For testing with the Traccar Client app, use the app's device identifier.">
                        <input className={inputCls} value={draft.trackerId} maxLength={64} placeholder="e.g. 358657100123456" onChange={e => setDraft({ ...draft, trackerId: e.target.value })} />
                    </Field></div>
                    <Field label="Route"><ThemedSelect value={draft.routeId} onChange={v => setDraft({ ...draft, routeId: v })} options={[{ value: NO_ROUTE, label: 'No route yet' }, ...routes.map(r => ({ value: r.id, label: r.name }))]} /></Field>
                    <Field label="Seats"><input className={inputCls} inputMode="numeric" value={draft.capacity} placeholder="40" onChange={e => setDraft({ ...draft, capacity: e.target.value.replace(/\D/g, '') })} /></Field>
                    <Field label="Driver name"><input className={inputCls} value={draft.driverName} maxLength={60} onChange={e => setDraft({ ...draft, driverName: e.target.value })} /></Field>
                    <Field label="Driver phone"><input className={inputCls} value={draft.driverPhone} maxLength={20} inputMode="tel" onChange={e => setDraft({ ...draft, driverPhone: e.target.value })} /></Field>
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
            description="Students on this bus are taken off it. Their parents will no longer see a bus."
            loading={deleting}
            onConfirm={remove}
        />

        {ridersFor && <RidersDialog bus={ridersFor} route={routes.find(r => r.id === ridersFor.routeId) ?? null} onClose={() => { setRidersFor(null); onChanged(); }} />}
    </>;
}

// Students on one bus: list, change stop, remove, and add by searching.
function RidersDialog({ bus, route, onClose }: { bus: Bus; route: TransportRoute | null; onClose: () => void }) {
    const [riders, setRiders] = useState<Rider[] | null>(null);
    const [q, setQ] = useState('');
    const [found, setFound] = useState<Found[]>([]);
    const [searching, setSearching] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const stopOptions = [{ value: NO_STOP, label: 'No stop' }, ...(route?.stops ?? []).map((s, i) => ({ value: s.id as string, label: `${i + 1}. ${s.name}` }))];

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

    const assign = async (studentId: string, stopId: string | null) => {
        setBusy(studentId);
        try {
            await api.put(`/admin/transport/students/${studentId}`, { busId: bus.id, stopId });
            await load();
            setFound(f => f.filter(x => x.studentId !== studentId));
        } catch (err) { toast.error(getErrorMessage(err, 'Could not save')); }
        finally { setBusy(null); }
    };
    const unassign = async (studentId: string) => {
        setBusy(studentId);
        try { await api.delete(`/admin/transport/students/${studentId}`); await load(); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not remove')); }
        finally { setBusy(null); }
    };

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-2xl bg-card">
                <DialogHeader>
                    <DialogTitle>Students on {bus.name}</DialogTitle>
                    <DialogDescription>{route ? `Route: ${route.name}. Pick each student's stop so parents get the right arrival time.` : 'Give this bus a route first to choose stops.'}</DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input className={`${inputCls} pl-8`} value={q} placeholder="Add a student: search by name or admission no." onChange={e => setQ(e.target.value)} />
                    {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
                {found.length > 0 && <div className="max-h-48 overflow-y-auto visible-scrollbar rounded-xl border border-border/60 divide-y divide-border/50">
                    {found.map(f => (
                        <div key={f.studentId} className="flex items-center gap-2 px-3 py-2 text-sm">
                            <div className="min-w-0">
                                <p className="font-medium truncate">{f.name || f.admissionNo}</p>
                                <p className="text-[11px] text-muted-foreground">{f.className || 'No class'} · {f.admissionNo}{f.currentBus ? ` · now on ${f.currentBus.name}` : ''}</p>
                            </div>
                            <SmallButton className="ml-auto" disabled={busy === f.studentId || f.currentBus?.id === bus.id} onClick={() => assign(f.studentId, null)}>
                                {f.currentBus?.id === bus.id ? 'Added' : f.currentBus ? 'Move here' : <><Plus size={11} />Add</>}
                            </SmallButton>
                        </div>
                    ))}
                </div>}

                <div className="max-h-[50vh] overflow-y-auto visible-scrollbar">
                    {!riders ? <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
                        : !riders.length ? <p className="py-8 text-center text-sm text-muted-foreground">No students on this bus yet.</p>
                            : <table className="w-full text-sm">
                                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="py-2 font-semibold">Student</th><th className="font-semibold">Stop</th><th /></tr></thead>
                                <tbody className="divide-y divide-border/50">
                                    {riders.map(r => (
                                        <tr key={r.studentId}>
                                            <td className="py-2 pr-2"><p className="font-medium">{r.name || r.admissionNo}</p><p className="text-[11px] text-muted-foreground">{r.className}{r.rollNo ? ` · Roll ${r.rollNo}` : ''}</p></td>
                                            <td className="py-2 pr-2 w-56">{route
                                                ? <ThemedSelect value={r.stop?.id ?? NO_STOP} options={stopOptions} onChange={v => assign(r.studentId, v === NO_STOP ? null : v)} />
                                                : <span className="text-xs text-muted-foreground">-</span>}</td>
                                            <td className="py-2 text-right"><SmallButton disabled={busy === r.studentId} onClick={() => unassign(r.studentId)} className="text-red-600"><UserMinus size={12} /></SmallButton></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>}
                </div>
            </DialogContent>
        </Dialog>
    );
}
