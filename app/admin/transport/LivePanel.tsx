'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bus as BusIcon, Clock, Gauge, Loader2, MapPin, Navigation, Play, Radio, RefreshCw, School, Square, WifiOff } from 'lucide-react';
import { getErrorMessage } from '@/lib/error';
import { toast } from 'sonner';
import api from '@/lib/api';
import { EmptyState, Pill, PrimaryButton } from '@/app/admin/payroll/_components/ui';
import { ago, tripLine, type LiveBus, type Overview } from './types';
import { TransportArt } from './TransportArt';

const BusMap = dynamic(() => import('./BusMap'), {
    ssr: false,
    loading: () => <div className="h-full grid place-items-center text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>,
});

const POLL_MS = 5000;

export default function LivePanel({ overview, onAddBus, onRefresh }: { overview: Overview; onAddBus: () => void; onRefresh?: () => Promise<void> | void }) {
    const [live, setLive] = useState<LiveBus[] | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());
    const [refreshing, setRefreshing] = useState(false);
    // set by the poller; calling it fetches now and restarts the 5 s timer
    const pollNow = useRef<() => Promise<boolean>>(async () => false);

    // poll live positions while the tab is visible
    useEffect(() => {
        let stop = false;
        let timer: ReturnType<typeof setTimeout>;
        const fetchLive = async () => {
            try {
                const res = await api.get('/admin/transport/live');
                if (!stop) { setLive(res.data.data); setNow(Date.now()); }
                return true;
            } catch { return false; /* keep the last positions; try again next tick */ }
        };
        const tick = async () => {
            if (!document.hidden) await fetchLive();
            if (!stop) timer = setTimeout(tick, POLL_MS);
        };
        pollNow.current = async () => {
            clearTimeout(timer);
            const ok = await fetchLive();
            if (!stop) timer = setTimeout(tick, POLL_MS);
            return ok;
        };
        void tick();
        return () => { stop = true; clearTimeout(timer); };
    }, []);

    const refresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        // spin for at least one full turn so the click is visible even when the reply is instant
        const [ok] = await Promise.all([
            pollNow.current(),
            Promise.resolve(onRefresh?.()).catch(() => undefined),
            new Promise(r => setTimeout(r, 700)),
        ]);
        setRefreshing(false);
        if (ok) toast.success('Live map refreshed');
        else toast.error('Could not refresh. Check your connection and try again.');
    };

    // refresh "x s ago" labels between polls
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // ── demo buses: only buses with a "sim-" tracker id, driven by the server ──
    const hasDemoBuses = overview.buses.some(b => b.trackerId?.startsWith('sim-'));
    const [demo, setDemo] = useState<{ running: boolean; endsAt?: string } | null>(null);
    const [demoBusy, setDemoBusy] = useState(false);
    useEffect(() => {
        if (!hasDemoBuses) return;
        api.get('/admin/transport/demo').then(r => setDemo(r.data.data)).catch(() => undefined);
    }, [hasDemoBuses]);
    // it stops by itself after a while: notice that
    useEffect(() => { if (demo?.running && demo.endsAt && Date.parse(demo.endsAt) <= now) setDemo({ running: false }); }, [demo, now]);
    const toggleDemo = async () => {
        if (demoBusy) return;
        setDemoBusy(true);
        try {
            const r = await api.post(`/admin/transport/demo/${demo?.running ? 'stop' : 'start'}`);
            setDemo(r.data.data);
            toast.success(r.data.data.running ? 'Sim started: the buses leave school in a moment' : 'Sim stopped');
            void pollNow.current();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not change the sim')); }
        finally { setDemoBusy(false); }
    };
    const demoLeft = demo?.running && demo.endsAt ? Math.max(0, Math.ceil((Date.parse(demo.endsAt) - now) / 60000)) : 0;

    const counts = useMemo(() => ({
        online: live?.filter(b => b.online).length ?? 0,
        total: live?.length ?? 0,
    }), [live]);

    if (!overview.buses.length) {
        return <EmptyState icon={BusIcon} title="No buses yet" text="Add a bus and its GPS tracker id, and it will show up here live.">
            <PrimaryButton onClick={onAddBus}>Add a bus</PrimaryButton>
        </EmptyState>;
    }

    return (
        <div className="flex-1 min-h-0 mt-2 flex flex-col lg:flex-row gap-3">
            <div className="flex-1 min-h-[360px] rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] p-1.5" data-admin-surface="">
                <BusMap routes={overview.routes} school={overview.school} live={live ?? []} selectedBusId={selected} onSelectBus={setSelected} />
            </div>

            <aside className="lg:w-80 shrink-0 flex flex-col min-h-0 rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] overflow-hidden" data-admin-surface="">
                <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border/50">
                    <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden>
                        {counts.online > 0 && <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />}
                        <Radio size={15} className={`relative ${counts.online > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                    </span>
                    <h2 className="text-sm font-semibold">Buses</h2>
                    <span className="ml-auto text-xs text-muted-foreground">{counts.online} of {counts.total} live</span>
                    {hasDemoBuses && (
                        <button
                            type="button"
                            onClick={toggleDemo}
                            disabled={demoBusy || !demo}
                            title={demo?.running ? `Sim running, stops by itself in ${demoLeft} min` : 'Drive the demo buses (tracker ids starting with "sim-") along their routes'}
                            className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors disabled:opacity-60 ${demo?.running ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                        >
                            {demoBusy ? <Loader2 size={11} className="animate-spin" /> : demo?.running ? <Square size={10} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
                            {demo?.running ? `Stop sim · ${demoLeft}m` : 'Start sim'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={refreshing}
                        aria-label="Refresh live map"
                        title="Refresh"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors disabled:opacity-60"
                    >
                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto visible-scrollbar p-2.5 space-y-2">
                    {!live && <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin" />Finding buses...</div>}
                    {live?.map(b => <LiveBusCard key={b.busId} bus={b} now={now} selected={selected === b.busId} onSelect={() => setSelected(b.busId)} />)}
                </div>
            </aside>
        </div>
    );
}

// One bus in the live list: a soft route-coloured header with the bus, then
// where it is right now, a stop-by-stop timeline of the trip, and speed / last update.
function LiveBusCard({ bus: b, now, selected, onSelect }: { bus: LiveBus; now: number; selected: boolean; onSelect: () => void }) {
    const color = b.route?.color ?? '#9CA3AF';
    const t = b.online ? b.trip ?? null : null;
    const line = t ? tripLine(t) : null;
    const StatusIcon = !t ? null : t.phase === 'AT_SCHOOL' ? School : t.standingAt ? MapPin : Navigation;
    const toneBox = line?.tone === 'green' ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20'
        : line?.tone === 'blue' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/20'
            : 'bg-muted/60 text-muted-foreground ring-border/40';
    const onTrip = !!t && t.phase === 'ON_TRIP' && !!t.trip;
    const speed = b.position && b.online ? Math.round(b.position.speedKmh) : null;

    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={!b.position}
            className={`w-full overflow-hidden text-left rounded-2xl border bg-card transition-all disabled:cursor-default ${selected ? 'shadow-lg -translate-y-px' : 'border-border/60 hover:-translate-y-px hover:shadow-md'}`}
            style={selected ? { borderColor: color, boxShadow: `0 0 0 1.5px ${color}, 0 8px 20px -8px ${color}66` } : undefined}
        >
            {/* header: soft route-colour wash behind the bus */}
            <div className="relative flex items-center gap-2.5 px-3 pt-2.5 pb-2" style={{ background: `linear-gradient(120deg, ${color}26, ${color}08 60%, transparent)` }}>
                <span className={`shrink-0 drop-shadow-sm ${b.online ? '' : 'grayscale opacity-60'}`}><TransportArt kind="bus" size={50} /></span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-bold leading-tight">{b.name}</span>
                        <span className="ml-auto shrink-0">
                            {!b.hasTracker ? <Pill>No tracker</Pill>
                                : b.online ? <Pill tone="green"><span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />Live</Pill>
                                    : <Pill tone="amber"><WifiOff size={10} />Offline</Pill>}
                        </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                        <span className="truncate text-[11px] font-medium text-muted-foreground">{b.route?.name ?? 'No route'}</span>
                        {b.plateNumber && (
                            <span className="ml-auto inline-flex shrink-0 items-stretch overflow-hidden rounded-[4px] border border-[#111] bg-white">
                                <span className="flex items-center bg-[#1D4ED8] px-[2px] text-[5.5px] font-bold leading-none text-white">IND</span>
                                <span className="px-1 text-[9.5px] font-bold leading-[14px] tracking-[0.6px] text-[#111] uppercase">{b.plateNumber}</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-3 pb-2.5 pt-1.5 space-y-2">
                {/* where it is right now */}
                {line && StatusIcon && (
                    <div className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ring-1 ${toneBox}`}>
                        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background/70">
                            {t?.standingAt && <span className="absolute inset-0 rounded-full bg-current opacity-20 animate-ping" />}
                            <StatusIcon size={12} />
                        </span>
                        <span className="truncate text-[13px] font-semibold">{line.text}</span>
                        {t?.trip && <span className="ml-auto shrink-0 rounded-md bg-background/80 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider">{t.trip === 'PICKUP' ? 'Pickup' : 'Drop'}</span>}
                    </div>
                )}

                {/* trip timeline: a dot per stop, joined by a line; done stops filled, the next one ringed */}
                {onTrip && t && (
                    <div className="flex items-center gap-2">
                        <div className="relative flex flex-1 items-center justify-between">
                            <span className="absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-muted" />
                            <span className="absolute left-1 top-1/2 h-[2px] -translate-y-1/2 rounded-full transition-all" style={{ background: color, width: t.total > 1 ? `calc(${(Math.min(t.done, t.total - 1) / (t.total - 1)) * 100}% - 0.5rem)` : 0 }} />
                            {Array.from({ length: t.total }).map((_, i) => (
                                <span
                                    key={i}
                                    className={`relative h-2.5 w-2.5 rounded-full border-2 ${i === t.done ? 'animate-pulse' : ''}`}
                                    style={{ borderColor: i <= t.done ? color : 'var(--muted)', background: i < t.done ? color : 'var(--card)' }}
                                />
                            ))}
                        </div>
                        <span className="shrink-0 text-[10.5px] font-semibold tabular-nums text-muted-foreground">{t.done}/{t.total}</span>
                    </div>
                )}

                {b.hasTracker && (
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        {speed != null && <span className="flex items-center gap-1 font-medium"><Gauge size={11} />{speed} km/h</span>}
                        <span className="ml-auto flex items-center gap-1"><Clock size={11} />{b.position ? ago(b.position.receivedAt, now) : 'No signal yet'}</span>
                    </div>
                )}
            </div>
        </button>
    );
}
