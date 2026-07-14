'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Activity, Server, Database, Layers, HardDrive,
    AlertTriangle, CheckCircle2, XCircle, Clock,
    RefreshCw, TrendingUp, Zap, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SERVICES = [
    { name: 'API Server', icon: Server, status: 'operational', uptime: '99.98%', latency: '142ms', region: 'Mumbai' },
    { name: 'Database', icon: Database, status: 'operational', uptime: '99.99%', latency: '8ms', region: 'Mumbai' },
    { name: 'Queue (Redis)', icon: Layers, status: 'degraded', uptime: '98.20%', latency: '340ms', region: 'Mumbai' },
    { name: 'Storage (S3)', icon: HardDrive, status: 'operational', uptime: '99.95%', latency: '210ms', region: 'Global' },
    { name: 'AI (Claude)', icon: Zap, status: 'operational', uptime: '99.90%', latency: '890ms', region: 'Global' },
    { name: 'Email (Resend)', icon: Wifi, status: 'operational', uptime: '99.85%', latency: '320ms', region: 'Global' },
];

const ERRORS = [
    { id: 'e1', severity: 'error', endpoint: 'POST /admin/tests/submit', message: 'Timeout after 30s — queue backlog', time: '2 min ago', count: 12 },
    { id: 'e2', severity: 'warning', endpoint: 'GET /student/results', message: 'Slow query detected — 4.2s response', time: '15 min ago', count: 3 },
    { id: 'e3', severity: 'error', endpoint: 'POST /auth/login', message: 'Rate limit exceeded — 429 Too Many Requests', time: '32 min ago', count: 47 },
    { id: 'e4', severity: 'info', endpoint: 'GET /admin/structure', message: 'Cache miss — fallback to DB', time: '1 hr ago', count: 8 },
    { id: 'e5', severity: 'warning', endpoint: 'POST /superadmin/institutions', message: 'Email delivery delayed — Resend queue lag', time: '2 hr ago', count: 2 },
];

const QUEUE = [
    { name: 'Email Queue', pending: 24, processing: 3, failed: 1, color: '#7C3AED' },
    { name: 'Test Evaluation', pending: 142, processing: 8, failed: 5, color: '#F59E0B' },
    { name: 'Report Generation', pending: 7, processing: 2, failed: 0, color: '#10B981' },
    { name: 'AI Processing', pending: 38, processing: 4, failed: 2, color: '#2563EB' },
];

const RESPONSE_DATA = [
    { time: '12:00', api: 138, db: 7, ai: 820 },
    { time: '12:10', api: 145, db: 8, ai: 910 },
    { time: '12:20', api: 132, db: 6, ai: 870 },
    { time: '12:30', api: 189, db: 12, ai: 950 },
    { time: '12:40', api: 142, db: 8, ai: 890 },
    { time: '12:50', api: 156, db: 9, ai: 920 },
    { time: '13:00', api: 141, db: 7, ai: 880 },
    { time: '13:10', api: 168, db: 11, ai: 1020 },
    { time: '13:20', api: 143, db: 8, ai: 895 },
];

const ERROR_RATE_DATA = [
    { time: '12:00', rate: 0.2 },
    { time: '12:10', rate: 0.4 },
    { time: '12:20', rate: 0.1 },
    { time: '12:30', rate: 1.8 },
    { time: '12:40', rate: 0.3 },
    { time: '12:50', rate: 0.2 },
    { time: '13:00', rate: 0.1 },
    { time: '13:10', rate: 0.5 },
    { time: '13:20', rate: 0.2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
    operational: { label: 'Operational', bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    degraded: { label: 'Degraded', bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
    down: { label: 'Down', bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
};

const SEVERITY_CFG = {
    error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-900/50', label: 'Error' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900/50', label: 'Warning' },
    info: { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-900/50', label: 'Info' },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => { setLastUpdated(new Date()); setRefreshing(false); }, 1000);
    };

    useEffect(() => {
        const interval = setInterval(() => setLastUpdated(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    const allOperational = SERVICES.every(s => s.status === 'operational');

    return (
        <div className="space-y-2">

            {/* ── Page Header ── */}
            <div className="sticky top-0 z-20 bg-background pb-1 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0 px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Activity size={21} />
                            System Health
                        </h1>
                        <p className="text-muted-foreground text-[13px]">
                            Last updated: {lastUpdated.toLocaleTimeString('en-IN')} · Auto-refreshes every 30s
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2">
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </Button>
                </div>
                <div className="h-px bg-border/60" />
            </div>

            {/* ── Overall Status Banner ── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 p-4 rounded-2xl border ${allOperational
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
                    }`}>
                <div className={`w-3 h-3 rounded-full animate-pulse ${allOperational ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <div>
                    <p className={`text-sm font-semibold ${allOperational ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {allOperational ? '✅ All Systems Operational' : '⚠️ Some Systems Degraded'}
                    </p>
                    <p className={`text-xs mt-0.5 ${allOperational ? 'text-emerald-600/70 dark:text-emerald-500/70' : 'text-amber-600/70 dark:text-amber-500/70'}`}>
                        {allOperational
                            ? 'All services are running normally.'
                            : `${SERVICES.filter(s => s.status !== 'operational').length} service(s) experiencing issues.`
                        }
                    </p>
                </div>
            </motion.div>

            {/* ── Services Status ── */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 bg-muted/20">
                    <Server size={14} className="text-violet-500" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</p>
                    <span className="ml-auto text-[11px] text-muted-foreground">{SERVICES.length} services monitored</span>
                </div>
                <div className="divide-y divide-border/40">
                    {SERVICES.map((svc, i) => {
                        const cfg = STATUS_CFG[svc.status as keyof typeof STATUS_CFG];
                        const Icon = svc.icon;
                        return (
                            <motion.div
                                key={svc.name}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors flex-wrap"
                            >
                                <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                                    <Icon size={15} className="text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold">{svc.name}</p>
                                    <p className="text-[11px] text-muted-foreground">{svc.region}</p>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                                    <span className="flex items-center gap-1"><Clock size={11} />{svc.latency}</span>
                                    <span className="flex items-center gap-1"><TrendingUp size={11} />{svc.uptime}</span>
                                </div>
                                <span className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${cfg.dot}`} />
                                    {cfg.label}
                                </span>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* ── Response Time + Error Rate ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold">Response Time</p>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />API</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />DB</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />AI</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={RESPONSE_DATA}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} unit="ms" />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                            <Line type="monotone" dataKey="api" stroke="#7C3AED" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="db" stroke="#10B981" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="ai" stroke="#F59E0B" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold">Error Rate</p>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-medium">
                            Avg 0.3%
                        </span>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={ERROR_RATE_DATA}>
                            <defs>
                                <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} unit="%" />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                            <Area type="monotone" dataKey="rate" stroke="#EF4444" strokeWidth={2} fill="url(#errorGrad)" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Queue Status ── */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 bg-muted/20">
                    <Layers size={14} className="text-amber-500" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Queue Status</p>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                        {QUEUE.reduce((s, q) => s + q.pending, 0)} total pending
                    </span>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {QUEUE.map((q, i) => (
                        <motion.div
                            key={q.name}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="p-4 bg-muted/30 rounded-xl space-y-3 border border-border/40"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold">{q.name}</p>
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: q.color }} />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1 text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{q.pending}</p>
                                    <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70">Pending</p>
                                </div>
                                <div className="flex-1 text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{q.processing}</p>
                                    <p className="text-[10px] text-blue-600/70 dark:text-blue-500/70">Processing</p>
                                </div>
                                <div className="flex-1 text-center p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{q.failed}</p>
                                    <p className="text-[10px] text-red-600/70 dark:text-red-500/70">Failed</p>
                                </div>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                    style={{ width: `${Math.round((q.processing / (q.pending + q.processing)) * 100)}%`, backgroundColor: q.color }} />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* ── Error Logs ── */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 bg-muted/20">
                    <AlertTriangle size={14} className="text-red-500" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Errors & Warnings</p>
                    <div className="ml-auto flex gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 font-medium">
                            {ERRORS.filter(e => e.severity === 'error').length} errors
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-medium">
                            {ERRORS.filter(e => e.severity === 'warning').length} warnings
                        </span>
                    </div>
                </div>
                <div className="divide-y divide-border/40">
                    {ERRORS.map((err, i) => {
                        const cfg = SEVERITY_CFG[err.severity as keyof typeof SEVERITY_CFG];
                        const Icon = cfg.icon;
                        return (
                            <motion.div
                                key={err.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className={`flex items-start gap-3 px-5 py-3.5 ${cfg.bg}`}
                            >
                                <Icon size={14} className={`${cfg.color} mt-0.5 shrink-0`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                        <code className="text-[11px] font-mono font-semibold text-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                            {err.endpoint}
                                        </code>
                                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-foreground/80">{err.message}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{err.time} · {err.count}× occurrences</p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}