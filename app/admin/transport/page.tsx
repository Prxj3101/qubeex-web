'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bus as BusIcon, Loader2, Radio, Route as RouteIcon, Shield } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/authStore';
import { EmptyState, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import LivePanel from './LivePanel';
import BusesPanel from './BusesPanel';
import RoutesPanel from './RoutesPanel';
import type { Overview } from './types';

const tabs = [
    { key: 'live', label: 'Live map', icon: Radio },
    { key: 'buses', label: 'Buses', icon: BusIcon },
    { key: 'routes', label: 'Routes & stops', icon: RouteIcon },
] as const;
type Tab = typeof tabs[number]['key'];

export default function TransportPage() {
    const user = useAuthStore(s => s.user);
    const [tab, setTab] = useState<Tab>('live');
    const [overview, setOverview] = useState<Overview | null>(null);
    const [error, setError] = useState('');
    const [addSignal, setAddSignal] = useState(0);

    const load = useCallback(async () => {
        try {
            setOverview((await api.get('/admin/transport/overview')).data.data);
            setError('');
        } catch (err) { setError(getErrorMessage(err, 'Could not load transport')); }
    }, []);
    useEffect(() => { void load(); }, [load]);
    const clearAdd = useCallback(() => setAddSignal(0), []);

    if (!user) return null;
    if (user.role === 'SUB_ADMIN' && !user.permissions?.includes('TRANSPORT')) {
        return <EmptyState icon={Shield} title="Transport access restricted" text="Contact your admin to request transport access." />;
    }

    return (
        <div className="h-full min-h-0 flex flex-col px-1 gap-3">
            <div className="shrink-0 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                    {tabs.map(({ key, label, icon: Icon }) => (
                        <button key={key} type="button" onClick={() => setTab(key)} className="relative" aria-pressed={tab === key}>
                            {tab === key && <motion.div layoutId="transportTab" className="absolute inset-0 bg-primary rounded-4xl" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
                            <span className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl whitespace-nowrap ${tab === key ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                <Icon size={14} />{label}
                            </span>
                        </button>
                    ))}
                </div>
                {overview && <p className="ml-auto text-xs text-muted-foreground">{overview.buses.length} buses · {overview.routes.length} routes</p>}
            </div>

            {error ? <EmptyState icon={BusIcon} title="Could not load transport" text={error}><SecondaryButton onClick={() => void load()}>Retry</SecondaryButton></EmptyState>
                : !overview ? <div className="flex-1 grid place-items-center text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>
                    : tab === 'live' ? <LivePanel overview={overview} onAddBus={() => { setTab('buses'); setAddSignal(n => n + 1); }} />
                        : tab === 'buses' ? <BusesPanel buses={overview.buses} routes={overview.routes} onChanged={load} addSignal={addSignal} onAddHandled={clearAdd} />
                            : <RoutesPanel routes={overview.routes} onChanged={load} />}
        </div>
    );
}
