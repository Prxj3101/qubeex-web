'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Activity, Server, Database, Layers, HardDrive,
    AlertTriangle, XCircle, Clock,
    RefreshCw, TrendingUp, Zap, Wifi, CheckCircle2, MinusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';

// ─── Types (mirrors GET /superadmin/system/health) ─────────────────────────────

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unconfigured';

interface ServiceRow {
    key: string;
    name: string;
    status: ServiceStatus;
    uptimePct: number | null;
    latencyMs: number | null;
    avgLatencyMs: number | null;
    detail: string | null;
}

interface ResponseTimePoint { time: string; api: number | null; db: number | null; ai: number | null }
interface ErrorRatePoint { time: string; rate: number | null }
interface RecentError { id: string; endpoint: string; message: string; time: string }
interface BackgroundJob { name: string; lastRunAt: string; ok: boolean; error?: string }

interface HealthData {
    services: ServiceRow[];
    responseTime: ResponseTimePoint[];
    errorRate: ErrorRatePoint[];
    recentErrors: RecentError[];
    backgroundJobs: BackgroundJob[];
    storageQueue: { pending: number };
}

// ─── Presentation config ────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, typeof Server> = {
    api: Server, database: Database, redis: Layers, storage: HardDrive, ai: Zap, email: Wifi,
};

const STATUS_CFG: Record<ServiceStatus, { label: string; bg: string; text: string; dot: string }> = {
    operational: { label: 'Operational', bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    degraded: { label: 'Degraded', bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
    down: { label: 'Down', bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
    unconfigured: { label: 'Not Configured', bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
};

const JOB_LABELS: Record<string, string> = {
    'billing-monthly-bills': 'Monthly Bill Generation',
    'billing-overdue-deactivation': 'Overdue Auto-Deactivation',
    'billing-payment-reminder': 'Payment Reminder',
    'trial-daily-notifications': 'Trial Notifications',
    'trial-auto-lock': 'Trial Auto-Lock',
    'addon-smartboard-expiry': 'Smart Board Free-Expiry Alerts',
    'audit-retention': 'Audit Log Retention',
    'storage-cleanup': 'Storage Cleanup (R2)',
    'health-monitor': 'Health Monitor',
};

function relativeTime(iso: string): string {
    if (!iso) return 'Never run';
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchHealth = useCallback(async (isRefresh: boolean) => {
        if (isRefresh) setRefreshing(true);
        try {
            const res = await api.get('/superadmin/system/health');
            setData(res.data.data);
            setLastUpdated(new Date());
        } catch {
            toast.error('Failed to load system health');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth(false);
        const interval = setInterval(() => fetchHealth(false), 30000);
        return () => clearInterval(interval);
    }, [fetchHealth]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                Loading system health…
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                Unable to load system health.
            </div>
        );
    }

    const monitoredServices = data.services.filter(s => s.status !== 'unconfigured');
    const allOperational = monitoredServices.every(s => s.status === 'operational');
    const degradedCount = monitoredServices.filter(s => s.status !== 'operational').length;
    const errorCount = data.recentErrors.length;
    const avgErrorRate = data.errorRate.filter(e => e.rate !== null);
    const avgErrorRatePct = avgErrorRate.length > 0
        ? (avgErrorRate.reduce((s, e) => s + (e.rate ?? 0), 0) / avgErrorRate.length).toFixed(2)
        : null;

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
                            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString('en-IN')} · Auto-refreshes every 30s` : ''}
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => fetchHealth(true)} disabled={refreshing} className="flex items-center gap-2">
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
                        {allOperational ? 'All monitored services are running normally.' : `${degradedCount} service(s) experiencing issues.`}
                    </p>
                </div>
            </motion.div>

            {/* ── Services Status ── */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 bg-muted/20">
                    <Server size={14} className="text-violet-500" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</p>
                    <span className="ml-auto text-[11px] text-muted-foreground">{data.services.length} services monitored</span>
                </div>
                <div className="divide-y divide-border/40">
                    {data.services.map((svc, i) => {
                        const cfg = STATUS_CFG[svc.status];
                        const Icon = SERVICE_ICONS[svc.key] ?? Server;
                        return (
                            <motion.div
                                key={svc.key}
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
                                    {svc.detail && <p className="text-[11px] text-muted-foreground">{svc.detail}</p>}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                                    {svc.latencyMs !== null && (
                                        <span className="flex items-center gap-1"><Clock size={11} />{svc.latencyMs}ms</span>
                                    )}
                                    {svc.uptimePct !== null && (
                                        <span className="flex items-center gap-1"><TrendingUp size={11} />{svc.uptimePct}% (24h)</span>
                                    )}
                                </div>
                                <span className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${svc.status !== 'unconfigured' ? 'animate-pulse' : ''} ${cfg.dot}`} />
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
                        <p className="text-sm font-semibold">Response Time <span className="text-[10px] text-muted-foreground font-normal">(last 12h)</span></p>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />API</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />DB</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />AI</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={data.responseTime}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} unit="ms" />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                            <Line type="monotone" dataKey="api" stroke="#7C3AED" strokeWidth={2} dot={false} connectNulls />
                            <Line type="monotone" dataKey="db" stroke="#10B981" strokeWidth={2} dot={false} connectNulls />
                            <Line type="monotone" dataKey="ai" stroke="#F59E0B" strokeWidth={2} dot={false} connectNulls />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold">Error Rate <span className="text-[10px] text-muted-foreground font-normal">(last 12h)</span></p>
                        {avgErrorRatePct !== null && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-medium">
                                Avg {avgErrorRatePct}%
                            </span>
                        )}
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={data.errorRate}>
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
                            <Area type="monotone" dataKey="rate" stroke="#EF4444" strokeWidth={2} fill="url(#errorGrad)" dot={false} connectNulls />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Background Jobs ── */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 bg-muted/20">
                    <Layers size={14} className="text-amber-500" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Background Jobs</p>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                        {data.storageQueue.pending} file(s) pending cleanup
                    </span>
                </div>
                <div className="divide-y divide-border/40">
                    {data.backgroundJobs.map((job, i) => {
                        const neverRun = !job.lastRunAt;
                        const Icon = neverRun ? MinusCircle : job.ok ? CheckCircle2 : XCircle;
                        const color = neverRun ? 'text-muted-foreground' : job.ok ? 'text-emerald-500' : 'text-red-500';
                        return (
                            <motion.div
                                key={job.name}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center gap-3 px-5 py-3"
                            >
                                <Icon size={15} className={`${color} shrink-0`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold">{JOB_LABELS[job.name] ?? job.name}</p>
                                    {job.error && <p className="text-[11px] text-red-500/80 truncate">{job.error}</p>}
                                </div>
                                <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(job.lastRunAt)}</span>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* ── Recent Errors ── */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 bg-muted/20">
                    <AlertTriangle size={14} className="text-red-500" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Errors</p>
                    <div className="ml-auto flex gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 font-medium">
                            {errorCount} in log
                        </span>
                    </div>
                </div>
                {data.recentErrors.length === 0 ? (
                    <div className="px-5 py-8 text-center text-xs text-muted-foreground">No server errors recorded 🎉</div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {data.recentErrors.map((err, i) => (
                            <motion.div
                                key={err.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-start gap-3 px-5 py-3.5 bg-red-50 dark:bg-red-950/30"
                            >
                                <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                        <code className="text-[11px] font-mono font-semibold text-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                            {err.endpoint}
                                        </code>
                                    </div>
                                    <p className="text-xs text-foreground/80">{err.message}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{relativeTime(err.time)}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
