'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, MapPin, Pencil, Plus, Route as RouteIcon, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { EmptyState, Field, PrimaryButton, SecondaryButton, SmallButton, inputCls } from '@/app/admin/payroll/_components/ui';
import { ROUTE_COLORS, type Stop, type TransportRoute } from './types';

const StopPickerMap = dynamic(() => import('./StopPickerMap'), {
    ssr: false,
    loading: () => <div className="h-full grid place-items-center text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>,
});

interface Draft { id?: string; name: string; color: string; stops: Stop[] }

const card = 'rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)]';

export default function RoutesPanel({ routes, onChanged }: { routes: TransportRoute[]; onChanged: () => void }) {
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [active, setActive] = useState<number | null>(null);
    const [toDelete, setToDelete] = useState<TransportRoute | null>(null);
    const [deleting, setDeleting] = useState(false);

    const open = (r?: TransportRoute) => {
        setActive(null);
        setDraft(r
            ? { id: r.id, name: r.name, color: r.color, stops: r.stops.map(s => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, pickupTime: s.pickupTime })) }
            : { name: '', color: ROUTE_COLORS[routes.length % ROUTE_COLORS.length], stops: [] });
    };
    const setStops = (fn: (s: Stop[]) => Stop[]) => setDraft(d => d && { ...d, stops: fn(d.stops) });
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
            const payload = { name: draft.name, color: draft.color, stops: draft.stops.map(s => ({ ...(s.id ? { id: s.id } : {}), name: s.name, lat: s.lat, lng: s.lng, pickupTime: s.pickupTime })) };
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
        <div className="flex-1 min-h-0 overflow-y-auto visible-scrollbar">
            <div className="flex justify-end mb-3"><PrimaryButton onClick={() => open()}><Plus size={14} />Add route</PrimaryButton></div>
            {!routes.length
                ? <EmptyState icon={RouteIcon} title="No routes yet" text="A route is the path a bus takes, with its stops in order. Add one and put stops on the map." />
                : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {routes.map(r => (
                        <div key={r.id} className={`${card} p-4`} data-admin-surface="">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full" style={{ background: r.color }} />
                                <h3 className="font-semibold text-sm truncate">{r.name}</h3>
                                <div className="ml-auto flex gap-1">
                                    <SmallButton onClick={() => open(r)}><Pencil size={12} />Edit</SmallButton>
                                    <SmallButton onClick={() => setToDelete(r)} className="text-red-600"><Trash2 size={12} /></SmallButton>
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{r.stops.length} stops · {r._count?.buses ?? 0} buses</p>
                            <ol className="mt-3 space-y-1">
                                {r.stops.slice(0, 5).map((s, i) => (
                                    <li key={s.id} className="flex items-center gap-2 text-xs">
                                        <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white shrink-0" style={{ background: r.color }}>{i + 1}</span>
                                        <span className="truncate">{s.name}</span>
                                        {s.pickupTime && <span className="ml-auto text-muted-foreground">{s.pickupTime}</span>}
                                    </li>
                                ))}
                                {r.stops.length > 5 && <li className="text-[11px] text-muted-foreground pl-7">+{r.stops.length - 5} more</li>}
                            </ol>
                        </div>
                    ))}
                </div>}
        </div>

        <Dialog open={!!draft} onOpenChange={o => { if (!o && !saving) setDraft(null); }}>
            <DialogContent className="sm:max-w-5xl bg-card">
                <DialogHeader>
                    <DialogTitle>{draft?.id ? 'Edit route' : 'New route'}</DialogTitle>
                    <DialogDescription>Click on the map to add a stop. Drag a pin to move it. Stops are in the order the bus reaches them.</DialogDescription>
                </DialogHeader>
                {draft && <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                    <div className="h-[340px] lg:h-[460px]">
                        <StopPickerMap
                            stops={draft.stops}
                            color={draft.color}
                            active={active}
                            onPick={setActive}
                            onAdd={(lat, lng) => { setStops(s => [...s, { name: `Stop ${s.length + 1}`, lat, lng, pickupTime: '' }]); setActive(draft.stops.length); }}
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
                        <div className="flex-1 min-h-0 lg:max-h-[300px] overflow-y-auto visible-scrollbar space-y-1.5 pr-1">
                            {!draft.stops.length && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin size={13} />No stops yet. Click on the map to add the first one.</p>}
                            {draft.stops.map((s, i) => (
                                <div key={s.id ?? `new-${i}`} onClick={() => setActive(i)} className={`rounded-xl border p-2 ${active === i ? 'border-primary/50 bg-primary/5' : 'border-border/60'}`}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white shrink-0" style={{ background: draft.color }}>{i + 1}</span>
                                        <input className={`${inputCls} h-8`} value={s.name} maxLength={80} onChange={e => setStops(st => st.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} />
                                        <button type="button" aria-label="Remove stop" onClick={e => { e.stopPropagation(); setStops(st => st.filter((_, k) => k !== i)); setActive(null); }} className="p-1 text-muted-foreground hover:text-red-600"><X size={14} /></button>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-1.5 pl-6">
                                        <span className="text-[11px] text-muted-foreground">Pickup</span>
                                        <input type="time" className={`${inputCls} h-7 w-28 text-xs`} value={s.pickupTime} onChange={e => setStops(st => st.map((x, k) => k === i ? { ...x, pickupTime: e.target.value } : x))} />
                                        <div className="ml-auto flex">
                                            <button type="button" aria-label="Move up" disabled={i === 0} onClick={e => { e.stopPropagation(); move(i, -1); }} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowUp size={13} /></button>
                                            <button type="button" aria-label="Move down" disabled={i === draft.stops.length - 1} onClick={e => { e.stopPropagation(); move(i, 1); }} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowDown size={13} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
