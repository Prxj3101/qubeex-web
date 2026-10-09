'use client';
import { useCallback, useEffect, useState } from 'react';
import { Boxes, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { EmptyState, SecondaryButton, SmallButton, Pill } from '@/app/admin/payroll/_components/ui';
import { stockQuantity, stockToday } from './IssueStockDialog';

interface Summary { stockItems: number; schoolAssets: number; lowStock: number; locations: number; totalItems: number }
interface Alerts {
    lowStock: { id: string; name: string; code: string; quantity: number; limit: number; unit: string }[];
    lowStockTotal: number;
    pendingReturns: { id: string; itemName: string; itemCode: string; recipient: string; location: string; quantity: number; unit: string; dueOn: string | null; overdue: boolean }[];
    pendingTotal: number; overdueTotal: number;
}
export type InventoryReportPreset = { report: 'stock' | 'movements' | 'returns' | 'lowstock'; returnStatus: 'pending' | 'overdue' };
export default function InventoryView({ onSetup, onItems, onReports }: { onSetup: () => void; onItems: () => void; onReports: (preset: InventoryReportPreset) => void }) {
    const [data, setData] = useState<{ summary: Summary; alerts: Alerts } | null>(null);
    const [error, setError] = useState('');
    const load = useCallback((signal?: AbortSignal) => Promise.all([
        api.get('/admin/inventory/summary', { signal }), api.get('/admin/inventory/alerts', { signal, params: { asOf: stockToday() } }),
    ]).then(([summary,alerts]) => {
        if (!signal?.aborted) { setData({ summary: summary.data.data, alerts: alerts.data.data }); setError(''); }
    }).catch(err => { if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load inventory view')); }), []);
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
    if (error) return <EmptyState icon={Boxes} title="Could not load inventory view" text={error}><SecondaryButton onClick={() => void load()}>Retry</SecondaryButton></EmptyState>;
    if (!data) return <div role="status" className="flex justify-center items-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading inventory...</div>;
    const { summary, alerts } = data;
    return <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[['Stock items', summary.stockItems], ['School assets', summary.schoolAssets], ['Low stock', alerts.lowStockTotal], ['Locations', summary.locations]].map(([label,value]) => <div key={label} className="rounded-2xl border border-border/60 bg-card px-4 py-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p><p className="text-xl font-bold mt-1">{value}</p></div>)}
        </div>
        {!summary.totalItems ? <EmptyState icon={Boxes} title="Set up your inventory" text="Start with categories, units and locations. Then add items and opening stock."><SecondaryButton onClick={onSetup}>Open setup</SecondaryButton></EmptyState> : <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/50"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Low-stock items</h2><Pill tone={alerts.lowStockTotal ? 'amber' : 'muted'}>{alerts.lowStockTotal}</Pill></div><SmallButton onClick={() => onReports({ report:'lowstock',returnStatus:'pending' })}>View report</SmallButton></div>
                    {alerts.lowStock.length ? <div className="divide-y divide-border/50">{alerts.lowStock.map(item => <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3"><div><p className="text-sm font-medium break-words">{item.name}</p><p className="text-xs text-muted-foreground mt-1">{item.code} | Alert limit: {stockQuantity(item.limit)}</p></div><p className="text-sm font-semibold whitespace-nowrap">{stockQuantity(item.quantity)} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span></p></div>)}</div> : <p className="px-4 py-8 text-sm text-muted-foreground">No low-stock items.</p>}
                    {alerts.lowStockTotal > 5 && <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border/50">Showing 5 of {alerts.lowStockTotal} items. View the report for all items.</p>}
                </section>
                <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/50"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">Pending returns</h2><Pill tone={alerts.pendingTotal ? 'amber' : 'muted'}>{alerts.pendingTotal}</Pill>{alerts.overdueTotal > 0 && <button type="button" title="View overdue returns" onClick={() => onReports({ report:'returns',returnStatus:'overdue' })}><Pill tone="red">{alerts.overdueTotal} overdue</Pill></button>}</div><SmallButton onClick={() => onReports({ report:'returns',returnStatus:'pending' })}>View report</SmallButton></div>
                    {alerts.pendingReturns.length ? <div className="divide-y divide-border/50">{alerts.pendingReturns.map(entry => <div key={entry.id} className="px-4 py-3 space-y-1"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium break-words">{entry.itemName}</p><p className="text-sm font-semibold whitespace-nowrap">{stockQuantity(entry.quantity)} <span className="text-xs font-normal text-muted-foreground">{entry.unit} pending</span></p></div><p className="text-xs text-muted-foreground break-words">{entry.recipient} | {entry.location}</p><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{entry.dueOn ? `Return due: ${new Date(`${entry.dueOn}T00:00:00Z`).toLocaleDateString('en-IN', {timeZone:'UTC'})}` : 'No return due date'}</span>{entry.overdue && <Pill tone="red">Overdue</Pill>}</div></div>)}</div> : <p className="px-4 py-8 text-sm text-muted-foreground">No pending returns.</p>}
                    {alerts.pendingTotal > 5 && <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border/50">Showing 5 of {alerts.pendingTotal} entries. Overdue returns appear first.</p>}
                </section>
            </div>
            <div className="flex flex-wrap gap-2"><SecondaryButton onClick={onItems}>View stock & assets</SecondaryButton><SmallButton onClick={onSetup}>Open setup</SmallButton></div>
        </>}
    </>;
}
