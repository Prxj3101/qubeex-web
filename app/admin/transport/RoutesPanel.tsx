'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ArrowDown, ArrowUp, BusFront, Clock, Loader2, MapPin, Pencil, Plus, Route as RouteIcon, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { EmptyState, Field, PageHeader, PrimaryButton, SecondaryButton, SmallButton, inputCls } from '@/app/admin/payroll/_components/ui';
import { ROUTE_COLORS, rideMinutes, type SchoolPoint, type Stop, type TransportRoute } from './types';
import SchoolCard from './SchoolCard';
import { TransportArt } from './TransportArt';

const StopPickerMap = dynamic(() => import('./StopPickerMap'), {
    ssr: false,
    loading: () => <div className="h-full grid place-items-center text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>,
});

interface Draft { id?: string; name: string; color: string; stops: Stop[] }

const card = 'rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)]';

// One route as a card: the stops drawn as a little journey, numbered dots
// joined by a dotted line in the route's colour, ending at the school.
type Row = { kind: 'stop'; n: number; name: string; mins: number; fee: number | null } | { kind: 'more'; count: number } | { kind: 'school'; name: string };

function RouteCard({ route: r, school, onEdit, onDelete }: { route: TransportRoute; school: SchoolPoint | null; onEdit: () => void; onDelete: () => void }) {
    // minutes after the bus leaves school (each bus has its own leaving time)
    const ride = rideMinutes(r.stops, school);
    const stops = r.stops.map((s, i) => ({ kind: 'stop' as const, n: i + 1, name: s.name, mins: ride.atStop[i], fee: s.monthlyFee }));
    // long routes: first 3 stops, "N more", then the last stop
    const rows: Row[] = stops.length > 5 ? [...stops.slice(0, 3), { kind: 'more', count: stops.length - 4 }, stops[stops.length - 1]] : [...stops];
    if (school && stops.length) rows.push({ kind: 'school', name: school.name || 'School' });
    const buses = r._count?.buses ?? 0;

    return (
        <div className={`${card} overflow-hidden flex flex-col`} data-admin-surface="">
            <div className="h-1.5 shrink-0" style={{ background: r.color }} />
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start gap-3">
                    <TransportArt kind="route" size={64} />
                    <div className="min-w-0 flex-1 pt-1">
                        <h3 className="font-semibold text-[15px] leading-tight truncate">{r.name}</h3>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${r.color}1F`, color: r.color }}><MapPin size={11} />{r.stops.length} {r.stops.length === 1 ? 'stop' : 'stops'}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"><BusFront size={11} />{buses} {buses === 1 ? 'bus' : 'buses'}</span>
                            {ride.roundTrip != null && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground" title="Rough time from leaving school, round all the stops and back to school"><Clock size={11} />~{ride.roundTrip} min round trip</span>}
                        </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <SmallButton onClick={onEdit} aria-label={`Edit ${r.name}`}><Pencil size={12} />Edit</SmallButton>
                        <SmallButton onClick={onDelete} aria-label={`Delete ${r.name}`} className="text-red-600"><Trash2 size={12} /></SmallButton>
                    </div>
                </div>

                {!rows.length
                    ? <p className="mt-4 rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">No stops yet. Click Edit to add them on the map.</p>
                    : <ol className="mt-4 rounded-xl bg-muted/30 px-3 py-2.5">
                        {rows.map((row, i) => {
                            const last = i === rows.length - 1;
                            return (
                                <li key={i} className="relative flex items-center gap-2.5 py-1.5 text-xs">
                                    {/* dotted line down to the next stop */}
                                    {!last && <span aria-hidden className="absolute left-[10px] top-[calc(50%+11px)] h-[calc(100%-10px)] border-l-2 border-dotted" style={{ borderColor: r.color }} />}
                                    {row.kind === 'stop' && <>
                                        <span className="relative grid h-[22px] w-[22px] place-items-center rounded-full text-[10px] font-bold text-white shrink-0 ring-2 ring-card" style={{ background: r.color }}>{row.n}</span>
                                        <span className="truncate font-medium">{row.name}</span>
                                        <span className="ml-auto flex shrink-0 items-center gap-1">
                                            {row.fee != null && <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: `${r.color}1F`, color: r.color }} title="Monthly bus fee">₹{row.fee.toLocaleString('en-IN')}</span>}
                                            <span className="rounded-md bg-card px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground" title={school ? 'Minutes after the bus leaves school' : 'Minutes after the first stop (set the school location to count from school)'}>{row.mins === 0 && !school ? 'Start' : `+${row.mins} min`}</span>
                                        </span>
                                    </>}
                                    {row.kind === 'more' && <>
                                        <span className="relative grid h-[22px] w-[22px] place-items-center shrink-0"><span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} /></span>
                                        <span className="text-[11px] text-muted-foreground">+{row.count} more {row.count === 1 ? 'stop' : 'stops'}</span>
                                    </>}
                                    {row.kind === 'school' && <>
                                        <span className="relative -ml-[3px] -my-1"><TransportArt kind="school" size={28} /></span>
                                        <span className="truncate font-semibold">{row.name}</span>
                                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">End</span>
                                    </>}
                                </li>
                            );
                        })}
                    </ol>}
            </div>
        </div>
    );
}

export default function RoutesPanel({ routes, school, onChanged }: { routes: TransportRoute[]; school: SchoolPoint | null; onChanged: () => void }) {
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [active, setActive] = useState<number | null>(null);
    const [toDelete, setToDelete] = useState<TransportRoute | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [stopToRemove, setStopToRemove] = useState<number | null>(null);

    const open = (r?: TransportRoute) => {
        setActive(null);
        setDraft(r
            ? { id: r.id, name: r.name, color: r.color, stops: r.stops.map(s => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, pickupTime: s.pickupTime, monthlyFee: s.monthlyFee ?? null })) }
            : { name: '', color: ROUTE_COLORS[routes.length % ROUTE_COLORS.length], stops: [] });
    };
    const setStops = (fn: (s: Stop[]) => Stop[]) => setDraft(d => d && { ...d, stops: fn(d.stops) });
    const draftRide = rideMinutes(draft?.stops ?? [], school);
    const move = (i: number, dir: -1 | 1) => setStops(s => {
        const j = i + dir;
        if (j < 0 || j >= s.length) return s;
        const n = [...s];
        [n[i], n[j]] = [n[j], n[i]];
        setActive(j);
        return n;
    });

    const save = async () => {
        if (!draft || saving) return;
        if (!draft.name.trim()) { toast.error('Give the route a name'); return; }
        if (draft.stops.some(s => !s.name.trim())) { toast.error('Every stop needs a name'); return; }
        setSaving(true);
        try {
            const payload = { name: draft.name, color: draft.color, stops: draft.stops.map(s => ({ ...(s.id ? { id: s.id } : {}), name: s.name, lat: s.lat, lng: s.lng, pickupTime: s.pickupTime, monthlyFee: s.monthlyFee })) };
            if (draft.id) await api.put(`/admin/transport/routes/${draft.id}`, payload);
            else await api.post('/admin/transport/routes', payload);
            toast.success(draft.id ? 'Route saved' : 'Route added');
            setDraft(null);
            onChanged();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not save the route')); }
        finally { setSaving(false); }
    };

    const remove = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/transport/routes/${toDelete.id}`);
            toast.success('Route deleted');
            setToDelete(null);
            onChanged();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not delete the route')); }
        finally { setDeleting(false); }
    };

    return <>
        <div className="flex-1 min-h-0 overflow-y-auto visible-scrollbar px-1 pb-6 space-y-3">
            <PageHeader title="Routes & stops" subtitle="The path each bus takes, its stops in order, and the school where every trip starts and ends">
                <PrimaryButton onClick={() => open()}><Plus size={14} />Add route</PrimaryButton>
            </PageHeader>
            <SchoolCard school={school} onChanged={onChanged} />
            {!routes.length
                ? <EmptyState icon={RouteIcon} title="No routes yet" text="A route is the path a bus takes, with its stops in order. Add one and put stops on the map." />
                : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {routes.map(r => (
                        <RouteCard key={r.id} route={r} school={school} onEdit={() => open(r)} onDelete={() => setToDelete(r)} />
                    ))}
                </div>}
        </div>

        <Dialog open={!!draft} onOpenChange={o => { if (!o && !saving) setDraft(null); }}>
            <DialogContent className="sm:max-w-[96vw] w-[96vw] h-[92vh] grid-rows-[auto_minmax(0,1fr)] bg-card">
                <DialogHeader>
                    <DialogTitle>{draft?.id ? 'Edit route' : 'New route'}</DialogTitle>
                    <DialogDescription>Add stops in the order the bus picks children up: <b className="text-foreground">usually the farthest stop first</b>, and last the stop the bus passes just before reaching school. Click on the map to add a stop, drag a pin to move it.</DialogDescription>
                </DialogHeader>
                {draft && <div className="grid gap-4 min-h-0 h-full overflow-y-auto lg:overflow-visible lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="h-[55vh] lg:h-full min-h-0">
                        <StopPickerMap
                            stops={draft.stops}
                            school={school}
                            color={draft.color}
                            active={active}
                            onPick={setActive}
                            onAdd={(lat, lng) => { setStops(s => [...s, { name: `Stop ${s.length + 1}`, lat, lng, pickupTime: '', monthlyFee: s.length ? s[s.length - 1].monthlyFee : null }]); setActive(draft.stops.length); }}
                            onMove={(i, lat, lng) => setStops(s => s.map((x, k) => k === i ? { ...x, lat, lng } : x))}
                        />
                    </div>
                    <div className="flex flex-col min-h-0 gap-3">
                        <Field label="Route name"><input className={inputCls} value={draft.name} maxLength={60} placeholder="e.g. Route 1 - Station side" onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
                        <div>
                            <span className="text-xs font-semibold text-muted-foreground">Colour</span>
                            <div className="mt-1 flex gap-1.5">
                                {ROUTE_COLORS.map(c => <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setDraft({ ...draft, color: c })} className={`h-6 w-6 rounded-full border-2 ${draft.color === c ? 'border-foreground' : 'border-transparent'}`} style={{ background: c }} />)}
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto visible-scrollbar space-y-1.5 pr-1">
                            {!draft.stops.length && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin size={13} />No stops yet. Click on the map at the bus&apos;s <b className="text-foreground">first pickup</b> (usually the farthest stop).</p>}
                            {draft.stops.length > 0 && <p className="flex items-center gap-1 pl-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><ArrowDown size={11} />First pickup (usually the farthest)</p>}
                            {draft.stops.map((s, i) => (
                                <div key={s.id ?? `new-${i}`} onClick={() => setActive(i)} className={`rounded-xl border p-2 ${active === i ? 'border-primary/50 bg-primary/5' : 'border-border/60'}`}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white shrink-0" style={{ background: draft.color }}>{i + 1}</span>
                                        <input className={`${inputCls} h-8`} value={s.name} maxLength={80} onChange={e => setStops(st => st.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} />
                                        <button type="button" aria-label="Remove stop" onClick={e => { e.stopPropagation(); setStopToRemove(i); }} className="p-1 text-muted-foreground hover:text-red-600"><X size={14} /></button>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-1.5 pl-6">
                                        <span className="w-14 text-[11px] font-semibold tabular-nums text-muted-foreground" title={school ? 'Minutes after the bus leaves school. Each bus sets its own leaving time.' : 'Minutes after the first stop (set the school location to count from school)'}>{draftRide.atStop[i] === 0 && !school ? 'Start' : `+${draftRide.atStop[i]} min`}</span>
                                        <span className="text-[11px] text-muted-foreground">Fee ₹</span>
                                        <input aria-label="Monthly bus fee" title="Monthly bus fee for students picked up here" inputMode="numeric" placeholder="/month" className={`${inputCls} h-7 w-[4.5rem] text-xs`} value={s.monthlyFee ?? ''} onClick={e => e.stopPropagation()} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setStops(st => st.map((x, k) => k === i ? { ...x, monthlyFee: v ? Number(v) : null } : x)); }} />
                                        <div className="ml-auto flex">
                                            <button type="button" aria-label="Move up" disabled={i === 0} onClick={e => { e.stopPropagation(); move(i, -1); }} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowUp size={13} /></button>
                                            <button type="button" aria-label="Move down" disabled={i === draft.stops.length - 1} onClick={e => { e.stopPropagation(); move(i, 1); }} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowDown size={13} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {draft.stops.length > 0 && school && <p className="flex items-center gap-1.5 pl-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><TransportArt kind="school" size={18} />Last pickup, then the bus reaches school</p>}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <SecondaryButton onClick={() => setDraft(null)} disabled={saving}>Cancel</SecondaryButton>
                            <PrimaryButton onClick={save} disabled={saving}>{saving && <Loader2 size={13} className="animate-spin" />}Save route</PrimaryButton>
                        </div>
                    </div>
                </div>}
            </DialogContent>
        </Dialog>

        <DeleteConfirmDialog
            open={stopToRemove !== null}
            onOpenChange={o => { if (!o) setStopToRemove(null); }}
            confirmLabel="Remove"
            label="stop"
            name={stopToRemove !== null ? (draft?.stops[stopToRemove]?.name || `Stop ${stopToRemove + 1}`) : ''}
            description="Students picked up at this stop will have no stop once you save the route."
            onConfirm={() => {
                const i = stopToRemove;
                if (i !== null) { setStops(st => st.filter((_, k) => k !== i)); setActive(null); }
                setStopToRemove(null);
            }}
        />

        <DeleteConfirmDialog
            open={!!toDelete}
            onOpenChange={o => { if (!o) setToDelete(null); }}
            label="route"
            name={toDelete?.name ?? ''}
            description="Its stops are removed too. Buses on this route stay, but without a route."
            loading={deleting}
            onConfirm={remove}
        />
    </>;
}
