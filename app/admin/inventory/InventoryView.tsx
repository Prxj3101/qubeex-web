'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { EmptyState, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import { OverviewHero, TodayList, SmartReorder, StockMap, HoldersPanel, PulseCard, type Overview, type Brief, type Summary, type Insights } from './InventoryOverview';

export type InventoryReportPreset = { report: 'stock' | 'movements' | 'returns' | 'lowstock'; returnStatus: 'pending' | 'overdue' };
type Props = { onSetup: () => void; onItems: () => void; onPurchases: () => void; onReports: (preset: InventoryReportPreset) => void };

export default function InventoryView({ onSetup, onItems, onPurchases, onReports }: Props) {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [overview, setOverview] = useState<Overview | null>(null);
    const [insights, setInsights] = useState<Insights | null>(null);
    const [brief, setBrief] = useState<Brief | null>(null);
    const [briefLoading, setBriefLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback((signal?: AbortSignal) => {
        api.get('/admin/inventory/insights', { signal }).then(res => { if (!signal?.aborted) setInsights(res.data.data); }).catch(() => { /* the page still works without the charts */ });
        return Promise.all([api.get('/admin/inventory/summary', { signal }), api.get('/admin/inventory/overview', { signal })]).then(([s, o]) => {
            if (signal?.aborted) return;
            setSummary(s.data.data); setOverview(o.data.data); setError('');
            // The AI brief is a nice extra: it must never block or break the page.
            setBriefLoading(true);
            api.post('/admin/inventory/overview/ai-brief', {}, { signal }).then(r => { if (!signal?.aborted) setBrief(r.data.data); }).catch(() => { /* plain numbers still show */ }).finally(() => { if (!signal?.aborted) setBriefLoading(false); });
        }).catch(err => { if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load inventory view')); });
    }, []);
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

    const refreshBrief = useCallback(() => {
        setBriefLoading(true);
        api.post('/admin/inventory/overview/ai-brief', { refresh: true }).then(r => setBrief(r.data.data)).catch(err => toast.error(getErrorMessage(err, 'Could not refresh the brief'))).finally(() => setBriefLoading(false));
    }, []);
    const onAction = (key: Overview['actions'][number]['key']) => {
        if (key === 'REQUESTS' || key === 'ISSUE_APPROVED') onItems();
        else if (key === 'PURCHASE_APPROVAL' || key === 'READY_TO_ORDER' || key === 'DELIVERIES') onPurchases();
        else if (key === 'OVERDUE_RETURNS') onReports({ report: 'returns', returnStatus: 'overdue' });
        else onReports({ report: 'lowstock', returnStatus: 'pending' });
    };
    const greeting = useMemo(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }, []);

    if (error) return <EmptyState icon={Boxes} title="Could not load inventory view" text={error}><SecondaryButton onClick={() => void load()}>Retry</SecondaryButton></EmptyState>;
    if (!summary || !overview) return <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading inventory...</div>;
    if (!summary.totalItems) return <EmptyState icon={Boxes} title="Set up your inventory" text="Start with categories, units and locations. Then add items and starting stock."><SecondaryButton onClick={onSetup}>Open setup</SecondaryButton></EmptyState>;

    return <div className="space-y-4">
        <OverviewHero overview={overview} summary={summary} insights={insights} brief={brief} briefLoading={briefLoading} onRefresh={refreshBrief} greeting={greeting} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2 xl:h-[340px]"><StockMap overview={overview} onOpen={onItems} /></div>
            <HoldersPanel overview={overview} onOpen={() => onReports({ report: 'returns', returnStatus: 'pending' })} />
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <TodayList overview={overview} onAction={onAction} />
            <SmartReorder overview={overview} onPurchases={onPurchases} onChanged={() => void load()} />
        </div>
        <PulseCard insights={insights} />
    </div>;
}
