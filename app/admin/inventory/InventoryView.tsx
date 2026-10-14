'use client';
import { inventoryDateTime } from './inventory-date-time';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Boxes, Loader2, Package, Armchair, AlertTriangle, MapPin, Undo2, Clock, ShoppingCart, ClipboardList, Settings2,
    TrendingUp, TrendingDown, ArrowRightLeft, PackagePlus, PackageMinus, SlidersHorizontal, Wallet, Sparkles, Truck,
} from 'lucide-react';
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
interface Insights {
    trend: { date: string; received: number; issued: number }[];
    spend30: number; spendPrev30: number;
    topIssued: { id: string; name: string; unit: string; quantity: number; times: number }[];
    health: { out: number; low: number; healthy: number; total: number };
    byCategory: { name: string; count: number }[];
    byLocation: { id: string; name: string; items: number }[];
    activity: { id: string; kind: string; itemName: string; location: string; quantity: number; unit: string; issuedTo: string | null; supplier: string | null; transferTo: string | null; at: string }[];
}
export type InventoryReportPreset = { report: 'stock' | 'movements' | 'returns' | 'lowstock'; returnStatus: 'pending' | 'overdue' };
type Props = { onSetup: () => void; onItems: () => void; onPurchases: () => void; onReports: (preset: InventoryReportPreset) => void };

const money = (value: number) => `INR ${Math.round(value).toLocaleString('en-IN')}`;
const fade = (i: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05, duration: 0.3 } });
const card = 'rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)]';

function describe(a: Insights['activity'][number]) {
    const qty = `${stockQuantity(a.quantity)} ${a.unit}`;
    switch (a.kind) {
        case 'RECEIPT': return { icon: PackagePlus, tone: 'text-emerald-500 bg-emerald-500/10', text: `Added ${qty} of ${a.itemName}`, sub: a.supplier ? `From ${a.supplier} to ${a.location}` : a.location };
        case 'ISSUE': return { icon: PackageMinus, tone: 'text-blue-500 bg-blue-500/10', text: `Gave out ${qty} of ${a.itemName}`, sub: a.issuedTo ? `To ${a.issuedTo} from ${a.location}` : a.location };
        case 'RETURN': return { icon: Undo2, tone: 'text-violet-500 bg-violet-500/10', text: `${qty} of ${a.itemName} came back`, sub: a.location };
        case 'TRANSFER_OUT': return { icon: ArrowRightLeft, tone: 'text-amber-500 bg-amber-500/10', text: `Moved ${qty} of ${a.itemName}`, sub: a.transferTo ? `From ${a.location} to ${a.transferTo}` : `From ${a.location}` };
        case 'TRANSFER_IN': return { icon: ArrowRightLeft, tone: 'text-amber-500 bg-amber-500/10', text: `Received ${qty} of ${a.itemName} by move`, sub: a.location };
        case 'ADJUSTMENT': return { icon: SlidersHorizontal, tone: 'text-slate-500 bg-slate-500/10', text: `Stock count corrected for ${a.itemName}`, sub: a.location };
        case 'SUPPLIER_RETURN': return { icon: Truck, tone: 'text-rose-500 bg-rose-500/10', text: `Sent ${qty} of ${a.itemName} back to supplier`, sub: a.supplier || a.location };
        case 'ISSUE_DAMAGED': return { icon: AlertTriangle, tone: 'text-rose-500 bg-rose-500/10', text: `${a.itemName} marked damaged`, sub: a.issuedTo || a.location };
        case 'ISSUE_LOST': return { icon: AlertTriangle, tone: 'text-rose-500 bg-rose-500/10', text: `${a.itemName} marked lost`, sub: a.issuedTo || a.location };
        default: return { icon: Package, tone: 'text-slate-500 bg-slate-500/10', text: `Starting stock set for ${a.itemName}`, sub: a.location };
    }
}

function StatTile({ index, icon: Icon, label, value, tone, onClick, hint }: { index: number; icon: typeof Boxes; label: string; value: number; tone: string; onClick?: () => void; hint?: string }) {
    const body = <>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></span>
        <p className="mt-3 text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </>;
    return <motion.div {...fade(index)}>{onClick
        ? <button type="button" onClick={onClick} className={`${card} w-full p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md`}>{body}</button>
        : <div className={`${card} p-4`}>{body}</div>}</motion.div>;
}

function HealthRing({ health }: { health: Insights['health'] }) {
    const r = 42, c = 2 * Math.PI * r, total = Math.max(1, health.total);
    const parts = [{ v: health.healthy, cls: 'stroke-emerald-500' }, { v: health.low, cls: 'stroke-amber-500' }, { v: health.out, cls: 'stroke-rose-500' }];
    let offset = 0;
    return <svg viewBox="0 0 110 110" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label="Stock health">
        <circle cx="55" cy="55" r={r} fill="none" strokeWidth="11" className="stroke-muted" />
        {health.total > 0 && parts.map((p, i) => {
            const len = (p.v / total) * c; const el = p.v > 0 ? <motion.circle key={i} cx="55" cy="55" r={r} fill="none" strokeWidth="11" strokeLinecap="butt" className={p.cls}
                initial={{ strokeDasharray: `0 ${c}` }} animate={{ strokeDasharray: `${Math.max(0, len - 1.5)} ${c}` }} transition={{ duration: 0.8, delay: 0.1 * i }} strokeDashoffset={-offset} /> : null;
            offset += len; return el;
        })}
    </svg>;
}

function TrendChart({ trend }: { trend: Insights['trend'] }) {
    const W = 600, H = 150, pad = 4, max = Math.max(1, ...trend.map(t => Math.max(t.received, t.issued)));
    const slot = (W - pad * 2) / trend.length, bw = Math.max(2, slot / 2 - 1.5);
    const empty = trend.every(t => !t.received && !t.issued);
    const label = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return <div>
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-auto" role="img" aria-label="Stock activity in the last 30 days">
            {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} className="stroke-border/60" strokeDasharray="3 4" />)}
            {trend.map((t, i) => {
                const x = pad + i * slot, hr = (t.received / max) * (H - 8), hi = (t.issued / max) * (H - 8);
                return <g key={t.date}>
                    <title>{`${label(t.date)}: ${t.received} added, ${t.issued} given out`}</title>
                    <motion.rect x={x} width={bw} rx="1.5" className="fill-emerald-500" initial={{ height: 0, y: H }} animate={{ height: hr, y: H - hr }} transition={{ duration: 0.5, delay: i * 0.012 }} />
                    <motion.rect x={x + bw + 1.5} width={bw} rx="1.5" className="fill-blue-500" initial={{ height: 0, y: H }} animate={{ height: hi, y: H - hi }} transition={{ duration: 0.5, delay: i * 0.012 }} />
                </g>;
            })}
            <text x="0" y={H + 14} className="fill-muted-foreground" fontSize="10">{label(trend[0].date)}</text>
            <text x={W / 2} y={H + 14} textAnchor="middle" className="fill-muted-foreground" fontSize="10">{label(trend[Math.floor(trend.length / 2)].date)}</text>
            <text x={W} y={H + 14} textAnchor="end" className="fill-muted-foreground" fontSize="10">Today</text>
        </svg>
        {empty && <p className="-mt-2 text-center text-xs text-muted-foreground">No stock activity in the last 30 days yet. Add or give out stock and it will show up here.</p>}
    </div>;
}

function Bars({ rows, color }: { rows: { key: string; label: string; value: number; right: string }[]; color: string }) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return <div className="space-y-3">{rows.map((r, i) => <div key={r.key}>
        <div className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-medium">{r.label}</span><span className="shrink-0 text-muted-foreground">{r.right}</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ duration: 0.6, delay: 0.05 * i }} /></div>
    </div>)}</div>;
}

export default function InventoryView({ onSetup, onItems, onPurchases, onReports }: Props) {
    const [data, setData] = useState<{ summary: Summary; alerts: Alerts } | null>(null);
    const [insights, setInsights] = useState<Insights | null>(null);
    const [error, setError] = useState('');
    const load = useCallback((signal?: AbortSignal) => {
        api.get('/admin/inventory/insights', { signal }).then(res => { if (!signal?.aborted) setInsights(res.data.data); }).catch(() => { /* the cards below still work without insights */ });
        return Promise.all([
            api.get('/admin/inventory/summary', { signal }), api.get('/admin/inventory/alerts', { signal, params: { asOf: stockToday() } }),
        ]).then(([summary, alerts]) => {
            if (!signal?.aborted) { setData({ summary: summary.data.data, alerts: alerts.data.data }); setError(''); }
        }).catch(err => { if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load inventory view')); });
    }, []);
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
    const greeting = useMemo(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }, []);

    if (error) return <EmptyState icon={Boxes} title="Could not load inventory view" text={error}><SecondaryButton onClick={() => void load()}>Retry</SecondaryButton></EmptyState>;
    if (!data) return <div role="status" className="flex justify-center items-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading inventory...</div>;
    const { summary, alerts } = data;
    if (!summary.totalItems) return <EmptyState icon={Boxes} title="Set up your inventory" text="Start with categories, units and locations. Then add items and starting stock."><SecondaryButton onClick={onSetup}>Open setup</SecondaryButton></EmptyState>;

    const spendChange = insights && insights.spendPrev30 > 0 ? Math.round(((insights.spend30 - insights.spendPrev30) / insights.spendPrev30) * 100) : null;
    const needsAttention = alerts.lowStockTotal + alerts.overdueTotal + (insights?.health.out || 0);
    const quick = [
        { label: 'Stock & Assets', sub: 'Add, give out, move', icon: Boxes, tone: 'text-emerald-500 bg-emerald-500/10', run: onItems },
        { label: 'Purchases', sub: 'Requests and orders', icon: ShoppingCart, tone: 'text-blue-500 bg-blue-500/10', run: onPurchases },
        { label: 'Reports', sub: 'Stock, movements, returns', icon: ClipboardList, tone: 'text-violet-500 bg-violet-500/10', run: () => onReports({ report: 'stock', returnStatus: 'pending' }) },
        { label: 'Setup', sub: 'Categories, units, places', icon: Settings2, tone: 'text-slate-500 bg-slate-500/10', run: onSetup },
    ];

    return <div className="space-y-3">
        <motion.div {...fade(0)} className="relative overflow-hidden rounded-2xl shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] bg-gradient-to-br from-primary/10 via-card to-card p-5" data-admin-surface="">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Sparkles size={13} />{greeting}</p>
                    <h2 className="mt-1 text-lg font-bold">{needsAttention > 0 ? `${needsAttention} thing${needsAttention === 1 ? '' : 's'} need your attention` : 'Everything looks good'}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{needsAttention > 0
                        ? [alerts.lowStockTotal > 0 && `${alerts.lowStockTotal} low on stock`, (insights?.health.out || 0) > 0 && `${insights?.health.out} out of stock`, alerts.overdueTotal > 0 && `${alerts.overdueTotal} overdue return${alerts.overdueTotal === 1 ? '' : 's'}`].filter(Boolean).join(', ')
                        : 'Stock levels are healthy and no returns are overdue.'}</p>
                </div>
                {insights && <div className="rounded-xl shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] bg-card/80 px-4 py-3" data-admin-surface="">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Wallet size={13} />Spent on stock, last 30 days</p>
                    <p className="mt-1 text-xl font-bold">{money(insights.spend30)}</p>
                    {spendChange !== null && <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${spendChange > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{spendChange > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(spendChange)}% {spendChange > 0 ? 'more' : 'less'} than the 30 days before</p>}
                </div>}
            </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile index={1} icon={Package} label="Stock items" value={summary.stockItems} tone="text-emerald-500 bg-emerald-500/10" onClick={onItems} />
            <StatTile index={2} icon={Armchair} label="School assets" value={summary.schoolAssets} tone="text-blue-500 bg-blue-500/10" onClick={onItems} />
            <StatTile index={3} icon={AlertTriangle} label="Low stock" value={alerts.lowStockTotal} tone="text-amber-500 bg-amber-500/10" onClick={() => onReports({ report: 'lowstock', returnStatus: 'pending' })} hint={alerts.lowStockTotal ? 'Tap to see which' : 'All good'} />
            <StatTile index={4} icon={Undo2} label="Pending returns" value={alerts.pendingTotal} tone="text-violet-500 bg-violet-500/10" onClick={() => onReports({ report: 'returns', returnStatus: 'pending' })} />
            <StatTile index={5} icon={Clock} label="Overdue" value={alerts.overdueTotal} tone="text-rose-500 bg-rose-500/10" onClick={() => onReports({ report: 'returns', returnStatus: 'overdue' })} hint={alerts.overdueTotal ? 'Needs follow-up' : 'None'} />
            <StatTile index={6} icon={MapPin} label="Locations" value={summary.locations} tone="text-slate-500 bg-slate-500/10" onClick={onSetup} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{quick.map((q, i) => <motion.button key={q.label} {...fade(i + 7)} type="button" onClick={q.run} className={`${card} group flex items-center gap-3 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md`}>
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${q.tone}`}><q.icon size={18} /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold">{q.label}</span><span className="block truncate text-xs text-muted-foreground">{q.sub}</span></span>
        </motion.button>)}</div>

        {insights && <>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <motion.section {...fade(11)} className={`${card} p-4 xl:col-span-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Stock activity, last 30 days</h2>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Stock added</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-blue-500" />Given out</span></div></div>
                    <div className="mt-3"><TrendChart trend={insights.trend} /></div>
                </motion.section>
                <motion.section {...fade(12)} className={`${card} p-4`}>
                    <h2 className="text-sm font-semibold">Stock health</h2>
                    {insights.health.total > 0 ? <div className="mt-3 flex items-center gap-4">
                        <div className="relative"><HealthRing health={insights.health} /><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-bold">{Math.round((insights.health.healthy / insights.health.total) * 100)}%</span><span className="text-[10px] text-muted-foreground">healthy</span></div></div>
                        <div className="space-y-2 text-xs">
                            <p className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{insights.health.healthy} in stock</p>
                            <p className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />{insights.health.low} running low</p>
                            <p className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" />{insights.health.out} out of stock</p>
                        </div>
                    </div> : <p className="mt-4 text-sm text-muted-foreground">Add consumable items to see how healthy your stock is.</p>}
                </motion.section>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <motion.section {...fade(13)} className={`${card} p-4`}>
                    <h2 className="text-sm font-semibold">Most given out, last 30 days</h2>
                    <div className="mt-3">{insights.topIssued.length
                        ? <Bars color="bg-blue-500" rows={insights.topIssued.map(t => ({ key: t.id, label: t.name, value: t.quantity, right: `${stockQuantity(t.quantity)} ${t.unit}` }))} />
                        : <p className="text-sm text-muted-foreground">Nothing has been given out in the last 30 days.</p>}</div>
                </motion.section>
                <motion.section {...fade(14)} className={`${card} p-4`}>
                    <h2 className="text-sm font-semibold">Where your items are</h2>
                    <div className="mt-3">{insights.byLocation.some(l => l.items > 0)
                        ? <Bars color="bg-emerald-500" rows={insights.byLocation.map(l => ({ key: l.id, label: l.name, value: l.items, right: `${l.items} item${l.items === 1 ? '' : 's'}` }))} />
                        : <p className="text-sm text-muted-foreground">No stock recorded in any location yet.</p>}</div>
                    {insights.byCategory.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{insights.byCategory.map(c => <span key={c.name} className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium">{c.name} <span className="text-muted-foreground">{c.count}</span></span>)}</div>}
                </motion.section>
                <motion.section {...fade(15)} className={`${card} p-4`}>
                    <h2 className="text-sm font-semibold">Recent activity</h2>
                    {insights.activity.length ? <ol className="mt-3 space-y-3">{insights.activity.map(a => { const d = describe(a); return <li key={a.id} className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${d.tone}`}><d.icon size={14} /></span>
                        <div className="min-w-0"><p className="text-xs font-medium break-words">{d.text}</p><p className="mt-0.5 text-[11px] text-muted-foreground break-words">{d.sub} | {inventoryDateTime(a.at)}</p></div>
                    </li>; })}</ol> : <p className="mt-3 text-sm text-muted-foreground">Activity will appear here as you add and give out stock.</p>}
                </motion.section>
            </div>
        </>}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <motion.section {...fade(16)} className={`${card} overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/50"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Low-stock items</h2><Pill tone={alerts.lowStockTotal ? 'amber' : 'muted'}>{alerts.lowStockTotal}</Pill></div><SmallButton onClick={() => onReports({ report: 'lowstock', returnStatus: 'pending' })}>View report</SmallButton></div>
                {alerts.lowStock.length ? <div className="divide-y divide-border/50">{alerts.lowStock.map(item => <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3"><div><p className="text-sm font-medium break-words">{item.name}</p><p className="text-xs text-muted-foreground mt-1">{item.code} | Alert limit: {stockQuantity(item.limit)}</p></div><p className="text-sm font-semibold whitespace-nowrap">{stockQuantity(item.quantity)} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span></p></div>)}</div> : <p className="px-4 py-8 text-sm text-muted-foreground">No low-stock items.</p>}
                {alerts.lowStockTotal > 5 && <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border/50">Showing 5 of {alerts.lowStockTotal} items. View the report for all items.</p>}
            </motion.section>
            <motion.section {...fade(17)} className={`${card} overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/50"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">Pending returns</h2><Pill tone={alerts.pendingTotal ? 'amber' : 'muted'}>{alerts.pendingTotal}</Pill>{alerts.overdueTotal > 0 && <button type="button" title="View overdue returns" onClick={() => onReports({ report: 'returns', returnStatus: 'overdue' })}><Pill tone="red">{alerts.overdueTotal} overdue</Pill></button>}</div><SmallButton onClick={() => onReports({ report: 'returns', returnStatus: 'pending' })}>View report</SmallButton></div>
                {alerts.pendingReturns.length ? <div className="divide-y divide-border/50">{alerts.pendingReturns.map(entry => <div key={entry.id} className="px-4 py-3 space-y-1"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium break-words">{entry.itemName}</p><p className="text-sm font-semibold whitespace-nowrap">{stockQuantity(entry.quantity)} <span className="text-xs font-normal text-muted-foreground">{entry.unit} pending</span></p></div><p className="text-xs text-muted-foreground break-words">{entry.recipient} | {entry.location}</p><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{entry.dueOn ? `Return due: ${new Date(`${entry.dueOn}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC' })}` : 'No return due date'}</span>{entry.overdue && <Pill tone="red">Overdue</Pill>}</div></div>)}</div> : <p className="px-4 py-8 text-sm text-muted-foreground">No pending returns.</p>}
                {alerts.pendingTotal > 5 && <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border/50">Showing 5 of {alerts.pendingTotal} entries. Overdue returns appear first.</p>}
            </motion.section>
        </div>
    </div>;
}
