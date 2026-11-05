'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Gauge, History, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Pill, inputCls } from '@/app/admin/payroll/_components/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TransportArt } from './TransportArt';
import type { Bus } from './types';

// Trip history: every trip of a day, recorded from the buses' GPS as it happened.
// Each trip shows when it left / got back, and for every stop the planned time
// (from the bus timings) next to when the bus really got there.

type TripStop = { stopId: string; name: string; plannedAt: string | null; reachedAt: string | null };
type Trip = {
    id: string; busId: string; kind: 'PICKUP' | 'DROP' | 'UNKNOWN';
    startedAt: string; endedAt: string | null; stops: TripStop[]; maxSpeedKmh: number;
    bus: { name: string; plateNumber: string; route: { name: string; color: string } | null };
};

const card = 'rounded-2xl border border-border/60 bg-card';

// India time helpers (trips are stored in UTC)
const istDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const istTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).toLowerCase();
const istMinutes = (iso: string) => { const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)).split(':').map(Number); return h * 60 + m; };
const hhmmMin = (s: string) => { const m = /^(\d{2}):(\d{2})$/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const clock12 = (s: string) => { const v = hhmmMin(s); if (v == null) return s; const h = Math.floor(v / 60), m = v % 60; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const shiftDay = (day: string, by: number) => { const d = new Date(`${day}T12:00:00+05:30`); d.setDate(d.getDate() + by); return istDay(d); };
const prettyDay = (day: string) => new Date(`${day}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

/** How late (+) or early (-) the bus was at a stop, in minutes; null when we can't tell. */
function lateBy(s: TripStop): number | null {
    if (!s.plannedAt || !s.reachedAt) return null;
    const p = hhmmMin(s.plannedAt);
    return p == null ? null : istMinutes(s.reachedAt) - p;
}

type Mark = { label: string; tone: 'green' | 'amber' | 'red' | 'gray'; dot: string };
function stopMark(s: TripStop, finished: boolean): Mark {
    if (!s.reachedAt) return finished ? { label: 'Not stopped', tone: 'gray', dot: '#9CA3AF' } : { label: 'Not yet', tone: 'gray', dot: 'transparent' };
    const late = lateBy(s);
    if (late == null) return { label: 'Reached', tone: 'green', dot: '#10B981' };
    if (late <= 2 && late >= -2) return { label: 'On time', tone: 'green', dot: '#10B981' };
    if (late < -2) return { label: `${-late} min early`, tone: 'green', dot: '#10B981' };
    if (late <= 5) return { label: `${late} min late`, tone: 'amber', dot: '#F59E0B' };
    return { label: `${late} min late`, tone: 'red', dot: '#EF4444' };
}

/** One bus's trips, day by day (opened from the bus card in Buses). */
export default function BusHistoryDialog({ bus, onClose }: { bus: Bus; onClose: () => void }) {
    const today = istDay(new Date());
    const [day, setDay] = useState(today);
    const [trips, setTrips] = useState<Trip[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setTrips(null);
        setError(null);
        try {
            const res = await api.get('/admin/transport/trips', { params: { day, busId: bus.id } });
            setTrips(res.data.data);
        } catch (err) { setError(getErrorMessage(err, 'Could not load the trips')); setTrips([]); }
    }, [day, bus.id]);
    useEffect(() => { void load(); }, [load]);

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-xl bg-card">
                <DialogHeader>
                    <DialogTitle>Trip history · {bus.name}</DialogTitle>
                    <DialogDescription>From the bus GPS: when it left, when it reached each stop (vs the plan) and when it got back.</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setDay(d => shiftDay(d, -1))} aria-label="Previous day" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"><ChevronLeft size={15} /></button>
                    <input type="date" className={`${inputCls} h-9 w-[150px]`} value={day} max={today} onChange={e => e.target.value && setDay(e.target.value)} />
                    <button type="button" onClick={() => setDay(d => shiftDay(d, 1))} disabled={day >= today} aria-label="Next day" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-40"><ChevronRight size={15} /></button>
                    <span className="ml-1 text-xs font-semibold text-muted-foreground">{day === today ? 'Today' : prettyDay(day)}</span>
                </div>
                {/* fixed height: the popup stays the same size whatever the day has (loading, empty, many trips) */}
                <div className="h-[60vh] overflow-y-auto visible-scrollbar -mx-1 px-1 space-y-3">
                    {!trips ? <div className="flex h-full items-center justify-center"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
                        : error ? <p className="flex h-full items-center justify-center text-center text-sm text-red-600">{error}</p>
                            : !trips.length ? <div className="flex h-full flex-col items-center justify-center gap-2 text-center"><History size={22} className="text-muted-foreground" /><p className="text-sm font-semibold">No trips on this day</p><p className="text-xs text-muted-foreground">Trips show up here on their own as the bus drives, from its GPS tracker.</p></div>
                                : trips.map(t => <TripCard key={t.id} trip={t} />)}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function TripCard({ trip: t }: { trip: Trip }) {
    const color = t.bus.route?.color ?? '#9CA3AF';
    const finished = !!t.endedAt;
    const mins = t.endedAt ? Math.max(1, Math.round((Date.parse(t.endedAt) - Date.parse(t.startedAt)) / 60000)) : null;
    const marks = t.stops.map(s => stopMark(s, finished));
    const count = (tone: Mark['tone']) => marks.filter(m => m.tone === tone).length;
    const late = count('amber') + count('red');
    const skipped = marks.filter(m => m.label === 'Not stopped').length;
    const onTime = t.stops.length - late - skipped - marks.filter(m => m.label === 'Not yet').length;

    return (
        <div className={`${card} overflow-hidden`}>
            <div className="flex items-center gap-3 px-4 pt-3.5 pb-3" style={{ background: `linear-gradient(120deg, ${color}22, transparent 70%)` }}>
                <TransportArt kind="bus" size={44} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-bold">{t.bus.name}</span>
                        <Pill tone={t.kind === 'PICKUP' ? 'green' : t.kind === 'DROP' ? 'blue' : 'muted'}>{t.kind === 'PICKUP' ? 'Pickup' : t.kind === 'DROP' ? 'Drop' : 'Trip'}</Pill>
                        {!finished && <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400"><span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />In progress</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-foreground/80"><Clock size={12} />{istTime(t.startedAt)} → {t.endedAt ? istTime(t.endedAt) : '…'}{mins != null && <span className="text-muted-foreground"> · {mins} min</span>}</span>
                        {t.maxSpeedKmh > 0 && <span className={`flex items-center gap-1 ${t.maxSpeedKmh > 50 ? 'font-semibold text-red-600' : ''}`}><Gauge size={12} />Top {t.maxSpeedKmh} km/h</span>}
                    </div>
                </div>
            </div>

            {/* quick summary */}
            {t.kind !== 'UNKNOWN' && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                    {onTime > 0 && <Pill tone="green">{onTime} on time</Pill>}
                    {late > 0 && <Pill tone="amber">{late} late</Pill>}
                    {skipped > 0 && <Pill>{skipped} not stopped</Pill>}
                </div>
            )}

            {/* stops, in the order the bus drove them */}
            {t.kind === 'UNKNOWN'
                ? <p className="px-4 pb-4 text-xs text-muted-foreground">The bus hadn&apos;t reached its first stop, so we couldn&apos;t tell if this was a pickup or a drop.</p>
                : <ol className="px-4 pb-3.5">
                    {t.stops.map((s, i) => {
                        const m = marks[i];
                        const toneText = m.tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : m.tone === 'amber' ? 'text-amber-600' : m.tone === 'red' ? 'text-red-600' : 'text-muted-foreground';
                        return (
                            <li key={s.stopId} className="relative flex items-center gap-3 py-1.5">
                                {/* timeline line + dot */}
                                {i < t.stops.length - 1 && <span className="absolute left-[5px] top-[22px] h-[calc(100%-10px)] w-[2px] bg-border/70" />}
                                <span className="relative h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: m.dot === 'transparent' ? 'var(--border)' : m.dot, background: s.reachedAt ? m.dot : 'var(--card)' }} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-medium">{i + 1}. {s.name}</p>
                                    <p className="text-[11px] text-muted-foreground tabular-nums">
                                        {s.plannedAt ? `Plan ${clock12(s.plannedAt)}` : 'No plan'}
                                        {s.reachedAt && <> · <span className="font-semibold text-foreground/80">Reached {istTime(s.reachedAt)}</span></>}
                                    </p>
                                </div>
                                <span className={`shrink-0 text-[11px] font-semibold ${toneText}`}>{m.label}</span>
                            </li>
                        );
                    })}
                </ol>}
        </div>
    );
}
