'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, CheckCircle2, ClipboardCheck, Truck, PackageCheck, ChevronRight, AlertTriangle, CalendarClock, Wallet } from 'lucide-react';
import api from '@/lib/api';

interface Stats { requests: Record<string, number>; orders: Record<string, number>; readyToOrder: number; openValue: number; overdueDeliveries: number; dueThisWeek: number }

// Shows where every purchase is right now, from request to delivery. Each stage opens the matching list.
export default function PurchasePipeline({ onRequests, onOrders }: { onRequests: () => void; onOrders: () => void }) {
    const [stats, setStats] = useState<Stats | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        api.get('/admin/inventory/purchase-stats', { signal: controller.signal }).then(res => { if (!controller.signal.aborted) setStats(res.data.data); }).catch(() => { /* the lists below still work */ });
        return () => controller.abort();
    }, []);
    if (!stats) return null;
    const stages = [
        { label: 'Requests to review', value: stats.requests.PENDING || 0, icon: FileText, tone: 'text-amber-500 bg-amber-500/10', run: onRequests, hint: 'Waiting for approval' },
        { label: 'Ready to order', value: stats.readyToOrder, icon: CheckCircle2, tone: 'text-emerald-500 bg-emerald-500/10', run: onRequests, hint: 'Approved, no order yet' },
        { label: 'Orders to approve', value: stats.orders.PENDING || 0, icon: ClipboardCheck, tone: 'text-violet-500 bg-violet-500/10', run: onOrders, hint: 'Waiting for approval' },
        { label: 'On the way', value: (stats.orders.APPROVED || 0) + (stats.orders.PARTIALLY_RECEIVED || 0), icon: Truck, tone: 'text-blue-500 bg-blue-500/10', run: onOrders, hint: 'Waiting for delivery' },
        { label: 'Completed', value: stats.orders.COMPLETED || 0, icon: PackageCheck, tone: 'text-slate-500 bg-slate-500/10', run: onOrders, hint: 'Fully received' },
    ];
    return <div className="shrink-0 -mx-3 -my-3 px-3 py-3 max-h-[calc(30vh+24px)] overflow-y-auto overscroll-contain visible-scrollbar space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">{stages.map((s, i) => <motion.button key={s.label} type="button" onClick={s.run}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.25 }}
            className="group relative flex items-center gap-3 rounded-2xl bg-card p-3 text-left transition hover:-translate-y-0.5 shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)]">
            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.tone}`}><s.icon size={17} /></span>
            <span className="min-w-0"><span className="block text-xl font-bold leading-none">{s.value}</span><span className="mt-1 block truncate text-[11px] font-semibold text-foreground">{s.label}</span><span className="block truncate text-[10px] text-muted-foreground">{s.hint}</span></span>
            {i < stages.length - 1 && <ChevronRight size={14} className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background text-muted-foreground md:block" />}
        </motion.button>)}</div>
        {(stats.overdueDeliveries > 0 || stats.dueThisWeek > 0 || stats.openValue > 0) && <div className="flex flex-wrap gap-2 text-xs">
            {stats.overdueDeliveries > 0 && <span className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 font-medium text-rose-500"><AlertTriangle size={13} />{stats.overdueDeliveries} late {stats.overdueDeliveries === 1 ? 'delivery' : 'deliveries'}</span>}
            {stats.dueThisWeek > 0 && <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 font-medium text-amber-500"><CalendarClock size={13} />{stats.dueThisWeek} due in the next 7 days</span>}
            {stats.openValue > 0 && <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground"><Wallet size={13} />INR {Math.round(stats.openValue).toLocaleString('en-IN')} still to be delivered</span>}
        </div>}
    </div>;
}
