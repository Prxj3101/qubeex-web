'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bus as BusIcon, Gauge, Loader2, MapPinned, Radio, RefreshCw, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { EmptyState, Pill, PrimaryButton } from '@/app/admin/payroll/_components/ui';
import { ago, type LiveBus, type Overview } from './types';
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
                <div className="flex-1 min-h-0 overflow-y-auto visible-scrollbar p-2 space-y-1.5">
                    {!live && <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin" />Finding buses...</div>}
                    {live?.map(b => (
                        <button
                            key={b.busId}
                            type="button"
                            onClick={() => setSelected(b.busId)}
                            disabled={!b.position}
                            className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${selected === b.busId ? 'border-primary/50 bg-primary/5' : 'border-border/60 hover:bg-muted/40'} disabled:cursor-default`}
                        >
                            <div className="flex items-center gap-3">
                            <span className={b.online ? '' : 'grayscale opacity-70'}><TransportArt kind="bus" size={52} /></span>
                            <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold truncate">{b.name}</span>
                                <span className="ml-auto">
                                    {!b.hasTracker ? <Pill>No tracker</Pill>
                                        : b.online ? <Pill tone="green"><span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />Live</Pill>
                                            : <Pill tone="amber"><WifiOff size={10} />Offline</Pill>}
                                </span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: b.route?.color ?? '#9CA3AF' }} />
                                <span className="truncate">{b.route?.name ?? 'No route'}{b.plateNumber ? ` · ${b.plateNumber}` : ''}</span>
                                {b.position && <span className="ml-auto flex items-center gap-1 shrink-0"><Gauge size={11} />{Math.round(b.position.speedKmh)} km/h</span>}
                            </div>
                            {b.hasTracker && <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPinned size={11} />Last update {ago(b.position?.receivedAt, now)}</div>}
                            </div>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>
        </div>
    );
}
