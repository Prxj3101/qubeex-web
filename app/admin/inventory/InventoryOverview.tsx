'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Sparkles, RefreshCw, TrendingUp, TrendingDown, ChevronRight, ShoppingCart, ShieldAlert, AlertTriangle, MapPin, UserRound,
    CalendarDays, CheckCircle2, Loader2, Flame, Undo2, PackagePlus, PackageMinus, ArrowRightLeft, SlidersHorizontal, Truck, Package, Boxes, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/authStore';
import { inventoryDateTime } from './inventory-date-time';
import { stockQuantity, stockToday } from './IssueStockDialog';

export type Overview = {
    asOf: string; score: number; scoreFactors: { label: string; points: number }[]; stockValue: number; valuedItems: number; totalItems: number;
    actions: { key: 'REQUESTS' | 'ISSUE_APPROVED' | 'PURCHASE_APPROVAL' | 'READY_TO_ORDER' | 'DELIVERIES' | 'OVERDUE_RETURNS' | 'LOW_STOCK'; tone: 'rose' | 'amber' | 'blue' | 'violet' | 'emerald'; count: number; title: string; detail: string; button: string }[];
    runway: { id: string; name: string; unit: string; unitName: string; stock: number; daily: number; daysLeft: number | null; belowLimit: boolean; suggested: number; urgency: 'critical' | 'soon' }[]; runwayTotal: number;
    locations: { id: string; name: string; items: number; low: number; topItems: string[] }[];
    holders: { name: string; entries: number; overdue: number; nextDue: string | null; itemNames: string[]; moreItems: number }[]; holdersTotal: number; pendingReturns: number;
    heatmap: { date: string; count: number }[];
    anomalies: { id: string; level: 'critical' | 'warning'; title: string; detail: string }[]; anomalyTotal: number;
};
export type Brief = { brief: string; aiGenerated: boolean; generatedAt: string };
export type Summary = { stockItems: number; schoolAssets: number; lowStock: number; locations: number; totalItems: number };
export type Insights = {
    trend: { date: string; received: number; issued: number }[];
    spend30: number; spendPrev30: number;
    topIssued: { id: string; name: string; unit: string; quantity: number; times: number }[];
    activity: { id: string; kind: string; itemName: string; location: string; quantity: number; unit: string; issuedTo: string | null; supplier: string | null; transferTo: string | null; at: string }[];
};
type ActionKey = Overview['actions'][number]['key'];

const scrollStyle = { scrollbarWidth: 'thin' as const, scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' };
const surface = 'relative rounded-3xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)]';
const glass = 'bg-background/40 backdrop-blur-md ring-1 ring-border/50';
const fade = (i: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.06, duration: 0.35 } });
const money = (value: number) => `INR ${Math.round(value).toLocaleString('en-IN')}`;
const shortDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const tone = {
    rose: { chip: 'bg-rose-500/10 text-rose-500', text: 'text-rose-500', stroke: 'stroke-rose-500' },
    amber: { chip: 'bg-amber-500/10 text-amber-500', text: 'text-amber-500', stroke: 'stroke-amber-500' },
    blue: { chip: 'bg-blue-500/10 text-blue-500', text: 'text-blue-500', stroke: 'stroke-blue-500' },
    violet: { chip: 'bg-violet-500/10 text-violet-500', text: 'text-violet-500', stroke: 'stroke-violet-500' },
    emerald: { chip: 'bg-emerald-500/10 text-emerald-500', text: 'text-emerald-500', stroke: 'stroke-emerald-500' },
} as const;

// Numbers count up and text types itself out, so the page feels alive on load.
function useProgress(ms: number, restart: unknown) {
    const [t, setT] = useState(0);
    useEffect(() => {
        let frame = 0; const start = performance.now();
        const tick = (now: number) => { const p = Math.min(1, (now - start) / ms); setT(p); if (p < 1) frame = requestAnimationFrame(tick); };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [ms, restart]);
    return t;
}
const useCountUp = (target: number, ms = 1000) => Math.round(target * (1 - Math.pow(1 - useProgress(ms, target), 3)));
function useTypewriter(text: string) {
    const p = useProgress(Math.min(2200, 300 + text.length * 16), text);
    return text.slice(0, Math.round(text.length * p));
}

function ScoreRing({ score }: { score: number }) {
    const shown = useCountUp(score), r = 52, c = 2 * Math.PI * r;
    const stroke = score >= 80 ? 'stroke-emerald-500' : score >= 60 ? 'stroke-amber-500' : 'stroke-rose-500';
    return <div className="relative h-32 w-32 shrink-0">
        <div className={`absolute inset-3 rounded-full blur-2xl ${score >= 80 ? 'bg-emerald-500/25' : score >= 60 ? 'bg-amber-500/25' : 'bg-rose-500/25'}`} />
        <svg viewBox="0 0 130 130" className="relative h-full w-full -rotate-90" role="img" aria-label={`Inventory health score ${score} out of 100`}>
            <circle cx="65" cy="65" r={r} fill="none" strokeWidth="8" className="stroke-muted/70" />
            <motion.circle cx="65" cy="65" r={r} fill="none" strokeWidth="8" strokeLinecap="round" className={stroke} initial={{ strokeDasharray: `0 ${c}` }} animate={{ strokeDasharray: `${(score / 100) * c} ${c}` }} transition={{ duration: 1.2, ease: 'easeOut' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold leading-none tabular-nums">{shown}</span><span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Health</span></div>
    </div>;
}

function Figure({ icon: Icon, label, value, sub, subTone }: { icon: typeof Boxes; label: string; value: string; sub?: React.ReactNode; subTone?: string }) {
    return <div className={`${glass} rounded-2xl px-3.5 py-2`}>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Icon size={12} />{label}</p>
        <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight">{value}</p>
        {sub && <p className={`mt-0.5 text-[11px] ${subTone || 'text-muted-foreground'}`}>{sub}</p>}
    </div>;
}

export function OverviewHero({ overview, summary, insights, brief, briefLoading, onRefresh, greeting }: { overview: Overview; summary: Summary; insights: Insights | null; brief: Brief | null; briefLoading: boolean; onRefresh: () => void; greeting: string }) {
    const value = useCountUp(overview.stockValue), typed = useTypewriter(brief?.brief || '');
    const verdict = overview.score >= 80 ? 'Running smoothly' : overview.score >= 60 ? 'Needs a little care' : 'Needs your attention';
    const spendChange = insights && insights.spendPrev30 > 0 ? Math.round(((insights.spend30 - insights.spendPrev30) / insights.spendPrev30) * 100) : null;
    return <motion.div {...fade(0)} data-admin-surface="" className={`${surface} overflow-hidden bg-gradient-to-br from-primary/15 via-card to-card p-4 lg:p-5`}>
        <motion.div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-primary/25 blur-3xl" animate={{ x: [0, 50, 0], y: [0, 24, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="pointer-events-none absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" animate={{ x: [0, -40, 0], y: [0, -20, 0] }} transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] text-foreground" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative grid items-center gap-5 lg:grid-cols-[1fr_auto_minmax(240px,290px)]">
            <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Sparkles size={13} />{greeting}</p>
                <h2 className="mt-0.5 text-xl font-bold tracking-tight">{verdict}</h2>
                <div className={`${glass} mt-3 rounded-2xl p-3.5`}>
                    <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary"><Sparkles size={12} />{brief?.aiGenerated ? 'AI daily brief' : 'Daily brief'}</span>
                        <button type="button" onClick={onRefresh} disabled={briefLoading} aria-label="Refresh brief" title="Refresh brief" className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"><RefreshCw size={13} className={briefLoading ? 'animate-spin' : ''} /></button>
                    </div>
                    {brief ? <p className="mt-1.5 min-h-[2.5rem] text-sm leading-relaxed">{typed}<span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary align-middle" /></p>
                        : <div className="mt-3 space-y-2" aria-label="Writing your brief"><div className="h-3 w-11/12 animate-pulse rounded bg-muted" /><div className="h-3 w-3/5 animate-pulse rounded bg-muted" /></div>}
                </div>
                {overview.scoreFactors.length > 0 && <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">Score is down because of{overview.scoreFactors.map(f => <span key={f.label} className="font-medium text-foreground/80">{f.label} <span className="text-rose-500">-{f.points}</span></span>)}</p>}
            </div>
            <ScoreRing score={overview.score} />
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                <Figure icon={Wallet} label="Stock value" value={overview.stockValue > 0 ? money(value) : 'Not yet'} sub={overview.valuedItems > 0 ? `${overview.valuedItems} of ${overview.totalItems} items priced` : 'Appears after priced purchases'} />
                <Figure icon={Boxes} label="Items and assets" value={`${summary.stockItems} + ${summary.schoolAssets}`} sub={`${summary.locations} locations`} />
                {insights && <div className="col-span-2 lg:col-span-1"><Figure icon={ShoppingCart} label="Spent, last 30 days" value={money(insights.spend30)} sub={spendChange !== null ? <span className="inline-flex items-center gap-1">{spendChange > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(spendChange)}% {spendChange > 0 ? 'more' : 'less'} than before</span> : undefined} subTone={spendChange !== null ? (spendChange > 0 ? 'text-amber-500' : 'text-emerald-500') : undefined} /></div>}
            </div>
        </div>
    </motion.div>;
}

// One list for everything that needs you: jobs to do, plus the odd things the page spotted.
export function TodayList({ overview, onAction }: { overview: Overview; onAction: (key: ActionKey) => void }) {
    const empty = !overview.actions.length && !overview.anomalies.length;
    return <motion.section {...fade(1)} data-admin-surface="" className={`${surface} flex h-[400px] flex-col p-5`}>
        <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Today</h2>{overview.actions.length > 0 && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{overview.actions.length} to do</span>}</div>
        {empty ? <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center"><motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><CheckCircle2 size={28} /></motion.span><p className="text-sm font-semibold">You are all caught up</p><p className="text-xs text-muted-foreground">No requests, returns or orders need you right now.</p></div>
            : <div className="mt-2 min-h-0 flex-1 divide-y divide-border/40 overflow-y-auto pr-1" style={scrollStyle}>
                {overview.actions.map(a => <button key={a.key} type="button" onClick={() => onAction(a.key)} className="group flex w-full items-center gap-3 py-3 text-left">
                    <span className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-bold tabular-nums ${tone[a.tone].chip}`}>{a.count}</span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{a.title}</span><span className="block text-xs text-muted-foreground">{a.detail}</span></span>
                    <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary opacity-70 transition group-hover:opacity-100">{a.button}<ChevronRight size={14} className="transition group-hover:translate-x-0.5" /></span>
                </button>)}
                {overview.anomalies.map(a => { const t = a.level === 'critical' ? tone.rose : tone.amber, Icon = a.level === 'critical' ? ShieldAlert : AlertTriangle;
                    return <div key={a.id} className="flex items-start gap-3 py-3">
                        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.chip}`}><Icon size={16} /></span>
                        <div className="min-w-0 flex-1"><p className="text-sm font-medium break-words">{a.title}</p><p className="text-xs text-muted-foreground">{a.detail}</p></div>
                        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${t.text}`}>Look into</span>
                    </div>; })}
            </div>}
    </motion.section>;
}

function DaysGauge({ days, out, critical }: { days: number | null; out: boolean; critical: boolean }) {
    const r = 18, c = 2 * Math.PI * r, pct = out ? 0 : days === null ? 0.3 : Math.min(1, days / 21);
    return <div className="relative h-12 w-12 shrink-0">
        <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90"><circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-muted" /><motion.circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className={critical ? 'stroke-rose-500' : 'stroke-amber-500'} initial={{ strokeDasharray: `0 ${c}` }} animate={{ strokeDasharray: `${Math.max(0.06, pct) * c} ${c}` }} transition={{ duration: 0.8 }} /></svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">{out ? '0' : days === null ? '!' : days}</span>
    </div>;
}

export function SmartReorder({ overview, onChanged, onPurchases }: { overview: Overview; onChanged: () => void; onPurchases: () => void }) {
    const user = useAuthStore(s => s.user);
    const [busy, setBusy] = useState<string | null>(null);
    const rows = overview.runway;
    const create = async (key: string, lines: Overview['runway']) => {
        if (busy || !lines.length) return;
        setBusy(key);
        try {
            const due = new Date(`${stockToday()}T00:00:00Z`); due.setUTCDate(due.getUTCDate() + 7);
            await api.post('/admin/inventory/purchase-requests', {
                requestId: crypto.randomUUID(), requestedByName: (user?.name || 'Inventory').trim() || 'Inventory', department: 'Inventory', requiredOn: due.toISOString().slice(0, 10),
                reason: `Running low: ${lines.map(l => l.name).join(', ')}`.slice(0, 1000),
                lines: lines.slice(0, 20).map(l => ({ name: l.name, unit: l.unitName, quantity: l.suggested })),
            });
            toast.success(lines.length === 1 ? `Purchase request created for ${lines[0].name}` : `Purchase request created for ${lines.length} items`, { action: { label: 'Open', onClick: onPurchases } });
            onChanged();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not create the purchase request')); }
        finally { setBusy(null); }
    };
    return <motion.section {...fade(2)} data-admin-surface="" className={`${surface} flex h-[400px] flex-col p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-sm font-semibold">Running out soon</h2><p className="text-[11px] text-muted-foreground">Worked out from the last 30 days of use</p></div>
            {rows.length > 1 && <button type="button" disabled={!!busy} onClick={() => void create('all', rows)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">{busy === 'all' ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}Order all {rows.length}</button>}
        </div>
        {rows.length ? <div className="mt-2 min-h-0 flex-1 divide-y divide-border/40 overflow-y-auto pr-1" style={scrollStyle}>{rows.map(r => {
            const out = r.stock <= 0, critical = r.urgency === 'critical';
            return <div key={r.id} className="flex items-center gap-3 py-3">
                <DaysGauge days={r.daysLeft} out={out} critical={critical} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">{out ? 'Out of stock' : `${Number(r.stock.toFixed(2))} ${r.unit} left`}{r.daily > 0 ? ` | uses ${r.daily} a day` : ''}</p>
                </div>
                <button type="button" disabled={!!busy} onClick={() => void create(r.id, [r])} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-semibold transition hover:bg-muted disabled:opacity-60">{busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}Order {r.suggested} {r.unit}</button>
            </div>;
        })}</div> : <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center"><span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><CheckCircle2 size={28} /></span><p className="text-sm font-semibold">Nothing is about to run out</p><p className="text-xs text-muted-foreground">Everything you use regularly has stock for 3+ weeks.</p></div>}
        {overview.runwayTotal > rows.length && <p className="mt-2 text-[11px] text-muted-foreground">Showing the {rows.length} most urgent of {overview.runwayTotal}.</p>}
    </motion.section>;
}

// Locations drawn as tiles sized by how many items they hold.
export function StockMap({ overview, onOpen }: { overview: Overview; onOpen: () => void }) {
    const has = overview.locations.some(l => l.items > 0);
    return <motion.section {...fade(3)} data-admin-surface="" className={`${surface} grid h-full content-start gap-6 p-5 lg:grid-cols-10`}>
        <div className="lg:col-span-7">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><MapPin size={14} className="text-emerald-500" />Stock map</h2>
        <p className="text-[11px] text-muted-foreground">Bigger tile means more items. Amber means something there is running low.</p>
        {has ? <div className="mt-3 flex max-h-[246px] flex-wrap content-start gap-2.5 overflow-y-auto px-1 pb-1 pt-1" style={scrollStyle}>{overview.locations.map((l, i) => <motion.button key={l.id} {...fade(i % 8 + 4)} type="button" onClick={onOpen} style={{ flexGrow: Math.max(1, l.items), flexBasis: 130 }}
            className={`group relative h-28 overflow-hidden rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${l.items === 0 ? 'border-border/50 bg-muted/20 opacity-60' : l.low > 0 ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-amber-500/[0.03]' : 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-emerald-500/[0.03]'}`}>
            <p className="truncate text-xs font-semibold">{l.name}</p>
            <p className="mt-1 text-3xl font-bold leading-none tabular-nums">{l.items}</p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">{l.items === 0 ? 'Empty' : l.topItems.join(', ')}</p>
            {l.low > 0 && <span className="absolute right-2.5 top-2.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">{l.low} low</span>}
        </motion.button>)}</div> : <p className="mt-4 text-sm text-muted-foreground">No stock recorded in any location yet.</p>}
        </div>
        <div className="lg:col-span-3 lg:border-l lg:border-border/40 lg:pl-6">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Flame size={14} className="text-orange-500" />Busy days</h2>
            <p className="mb-4 text-[11px] text-muted-foreground">Stock entries in the last 90 days</p>
            <Heatmap overview={overview} />
        </div>
    </motion.section>;
}

export function HoldersPanel({ overview, onOpen }: { overview: Overview; onOpen: () => void }) {
    return <motion.section {...fade(4)} data-admin-surface="" className={`${surface} flex h-[340px] flex-col p-5`}>
        <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-1.5 text-sm font-semibold"><UserRound size={14} className="text-violet-500" />Who has what</h2>{overview.pendingReturns > 0 && <span className="text-[11px] text-muted-foreground">{overview.pendingReturns} out</span>}</div>
        {overview.holders.length ? <div className="mt-2 min-h-0 flex-1 divide-y divide-border/40 overflow-y-auto pr-1" style={scrollStyle}>{overview.holders.map(h => <div key={h.name} className="flex items-center gap-3 py-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/25 to-violet-500/5 text-xs font-bold text-violet-500">{h.name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{h.name}</p><p className="truncate text-[11px] text-muted-foreground">{h.itemNames.join(', ')}{h.moreItems > 0 ? ` +${h.moreItems} more` : ''}</p></div>
            {h.overdue > 0 ? <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-500">{h.overdue} overdue</span> : h.nextDue ? <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground"><CalendarDays size={11} />{shortDate(h.nextDue)}</span> : null}
        </div>)}</div> : <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center"><span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/10 text-violet-500"><UserRound size={24} /></span><p className="text-sm font-semibold">Nothing is out right now</p><p className="text-xs text-muted-foreground">Items given out with a return date show up here.</p></div>}
        {overview.holdersTotal > overview.holders.length && <button type="button" onClick={onOpen} className="mt-2 self-start text-xs font-semibold text-primary hover:underline">View all {overview.holdersTotal}</button>}
    </motion.section>;
}

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

function TrendChart({ trend }: { trend: Insights['trend'] }) {
    const W = 600, H = 150, pad = 4, max = Math.max(1, ...trend.map(t => Math.max(t.received, t.issued)));
    const slot = (W - pad * 2) / trend.length, bw = Math.max(2, slot / 2 - 1.5);
    const empty = trend.every(t => !t.received && !t.issued);
    const label = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return <div>
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-auto w-full" role="img" aria-label="Stock activity in the last 30 days">
            {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} className="stroke-border/60" strokeDasharray="3 4" />)}
            {trend.map((t, i) => {
                const x = pad + i * slot, hr = (t.received / max) * (H - 8), hi = (t.issued / max) * (H - 8);
                return <g key={t.date}><title>{`${label(t.date)}: ${t.received} added, ${t.issued} given out`}</title>
                    <motion.rect x={x} width={bw} rx="1.5" className="fill-emerald-500" initial={{ height: 0, y: H }} animate={{ height: hr, y: H - hr }} transition={{ duration: 0.5, delay: i * 0.012 }} />
                    <motion.rect x={x + bw + 1.5} width={bw} rx="1.5" className="fill-blue-500" initial={{ height: 0, y: H }} animate={{ height: hi, y: H - hi }} transition={{ duration: 0.5, delay: i * 0.012 }} /></g>;
            })}
            <text x="0" y={H + 14} className="fill-muted-foreground" fontSize="10">{label(trend[0].date)}</text>
            <text x={W} y={H + 14} textAnchor="end" className="fill-muted-foreground" fontSize="10">Today</text>
        </svg>
        {empty && <p className="-mt-2 text-center text-xs text-muted-foreground">No stock activity in the last 30 days yet.</p>}
    </div>;
}

const heatCls = ['bg-muted/60', 'bg-emerald-500/25', 'bg-emerald-500/50', 'bg-emerald-500/75', 'bg-emerald-500'];
function Heatmap({ overview }: { overview: Overview }) {
    const { weeks, total, busiest, active } = useMemo(() => {
        const days = overview.heatmap, max = Math.max(1, ...days.map(d => d.count));
        const first = new Date(`${days[0].date}T00:00:00Z`), lead = (first.getUTCDay() + 6) % 7;
        const cells: ({ date: string; count: number; level: number } | null)[] = [...Array(lead).fill(null), ...days.map(d => ({ ...d, level: d.count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((d.count / max) * 4))) }))];
        const cols: typeof cells[] = []; for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
        const best = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);
        return { weeks: cols, total: days.reduce((s, d) => s + d.count, 0), busiest: best.count > 0 ? best : null, active: days.filter(d => d.count > 0).length };
    }, [overview.heatmap]);
    return <div>
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>{weeks.map((week, wi) => <div key={wi} className="flex flex-col gap-[3px]">{week.map((cell, di) => cell
            ? <motion.i key={cell.date} title={`${shortDate(cell.date)}: ${cell.count} entr${cell.count === 1 ? 'y' : 'ies'}`} className={`block aspect-square w-full rounded-[3px] ${heatCls[cell.level]}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: wi * 0.015 }} />
            : <i key={`e${di}`} className="block aspect-square w-full" />)}</div>)}</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>{total > 0 ? `${total} entries on ${active} days${busiest ? `, busiest ${shortDate(busiest.date)}` : ''}` : 'No entries in the last 90 days yet'}</span>
            <span className="flex items-center gap-1.5">Less{heatCls.map(c => <i key={c} className={`h-3 w-3 rounded-[3px] ${c}`} />)}More</span>
        </div>
    </div>;
}

// The 30 day bars and the live feed share one card.
export function PulseCard({ insights }: { insights: Insights | null }) {
    return <motion.section {...fade(5)} data-admin-surface="" className={`${surface} p-5`}>
        <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Flame size={14} className="text-orange-500" />Activity, last 30 days</h2>
                </div>
                <div className="mt-4">{insights ? <TrendChart trend={insights.trend} /> : null}</div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Added</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-blue-500" />Given out</span></div>
                {insights && insights.topIssued.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Most given out</span>{insights.topIssued.slice(0, 4).map(t => <span key={t.id} className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium">{t.name} <span className="text-muted-foreground">{stockQuantity(t.quantity)} {t.unit}</span></span>)}</div>}
            </div>
            <div className="lg:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest</h3>
                {insights && insights.activity.length ? <div className="mt-3 max-h-[270px] overflow-y-auto pr-1" style={scrollStyle}><ol className="relative space-y-3.5 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-border/60">{insights.activity.map(a => { const d = describe(a); return <li key={a.id} className="relative flex items-start gap-3">
                    <span className={`relative z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${d.tone}`}><d.icon size={13} /></span>
                    <div className="min-w-0"><p className="text-xs font-medium break-words">{d.text}</p><p className="mt-0.5 text-[11px] text-muted-foreground break-words">{d.sub} | {inventoryDateTime(a.at)}</p></div>
                </li>; })}</ol></div> : <p className="mt-3 text-sm text-muted-foreground">Activity shows up here as you add and give out stock.</p>}
            </div>
        </div>
    </motion.section>;
}

