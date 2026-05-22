'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import type { AdminOverview } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMockInstType } from '@/context/MockInstTypeContext';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
    TrendingUp, Users, GraduationCap, Building2,
    BookOpen, AlertCircle, RefreshCw, BarChart2,
    Sparkles, Clock, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Palette ───────────────────────────────────────────────────────────────────
const VIOLET = '#7C3AED';
const AMBER = '#D97706';
const EMERALD = '#059669';
const SKY = '#0284C7';
const ROSE = '#E11D48';

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({
    icon: Icon, label, value, sub, color,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
}) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                    <Icon size={15} style={{ color }} />
                </div>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>
                {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
            </p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
    );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
    active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-card border border-border/50 rounded-xl px-3 py-2 shadow-lg text-xs">
            <p className="font-semibold text-foreground mb-1">{label}</p>
            {payload.map((p) => (
                <p key={p.name} style={{ color: p.color }}>
                    {p.name}: <span className="font-bold">{p.value}</span>
                </p>
            ))}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [teachers, setTeachers] = useState<{ status: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const { instType } = useMockInstType();
    const fetchedRef = useRef(false);

    const fetchAll = async () => {
        setLoading(true);
        setError(false);
        try {
            const [ovRes, teachRes] = await Promise.allSettled([
                api.get('/admin/overview'),
                api.get('/admin/teachers'),
            ]);
            if (ovRes.status === 'fulfilled') setOverview(ovRes.value.data.data);
            else setError(true);
            if (teachRes.status === 'fulfilled') setTeachers(teachRes.value.data.data ?? []);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchAll();
    }, []);

    if (loading) {
        return (
            <div className="space-y-4 py-4">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Skeleton className="h-64 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
                <Skeleton className="h-56 rounded-2xl" />
            </div>
        );
    }

    if (error || !overview) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                <AlertCircle size={28} className="text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Could not load analytics</p>
                <Button variant="outline" size="sm" onClick={() => { fetchedRef.current = false; fetchAll(); }}
                    className="gap-1.5 mt-1">
                    <RefreshCw size={13} />
                    Retry
                </Button>
            </div>
        );
    }

    const { stats, enrollmentGrowth, plan } = overview;
    const activeTeachers = teachers.filter(t => t.status === 'ACTIVE').length;
    const inactiveTeachers = teachers.filter(t => t.status === 'INACTIVE').length;

    // Teacher status pie data
    const teacherPie = [
        { name: 'Active', value: activeTeachers, color: EMERALD },
        { name: 'Inactive', value: inactiveTeachers, color: '#d1d5db' },
    ].filter(d => d.value > 0);

    // Plan usage bars
    const usageData = [
        { name: 'Users', used: plan.usage.users.used, limit: plan.usage.users.limit, color: VIOLET },
        { name: 'Storage', used: plan.usage.storage.used, limit: plan.usage.storage.limit, color: SKY },
        { name: 'Tests', used: plan.usage.tests.used, limit: plan.usage.tests.limit, color: AMBER },
    ];

    // Ticket status breakdown (derived from recent tickets on overview)
    const instLabel = instType === 'SCHOOL' ? 'School' : instType === 'COLLEGE' ? 'College' : 'Coaching';

    return (
        <div className="space-y-3 py-0 pb-2">

            {/* ── Header ──────────────────────────────────────────── */}
            <div className="sticky top-0 z-20 bg-background pb-0 pt-0">
                <div className="flex items-center justify-between px-0">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <BarChart2 size={21} />
                            Analytics
                        </h1>
                        <p className="text-[13px] text-muted-foreground">
                            {overview.institution.name} · {instLabel}
                        </p>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => { fetchedRef.current = false; fetchAll(); }} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>

                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* ── Stat cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color={VIOLET} sub={`${plan.usage.users.limit.toLocaleString('en-IN')} limit`} />
                <StatCard icon={GraduationCap} label="Teachers" value={stats.totalTeachers} color={EMERALD} sub={`${activeTeachers} active · ${inactiveTeachers} inactive`} />
                <StatCard icon={Building2} label="Standards" value={stats.totalClasses} color={SKY} sub="Configured in campus" />
                <StatCard icon={BookOpen} label="Plan" value={plan.name.toUpperCase()} color={AMBER} sub={`${plan.usage.users.used} users used`} />
            </div>

            {/* ── Charts row ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

                {/* Enrollment growth area chart — 3 cols */}
                <div className="lg:col-span-3 bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={15} className="text-muted-foreground" />
                        <p className="text-sm font-semibold">Teacher Growth</p>
                        <span className="ml-auto text-[10px] text-muted-foreground/60 uppercase tracking-wide">Last 6 months</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={enrollmentGrowth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="teacherGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={VIOLET} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={VIOLET} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area
                                type="monotone" dataKey="teachers" name="Teachers"
                                stroke={VIOLET} strokeWidth={2}
                                fill="url(#teacherGrad)" dot={{ fill: VIOLET, strokeWidth: 2, r: 3 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Teacher status pie — 2 cols */}
                <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Users size={15} className="text-muted-foreground" />
                        <p className="text-sm font-semibold">Teacher Status</p>
                    </div>
                    {teacherPie.length === 0 ? (
                        <div className="flex items-center justify-center h-48 text-xs text-muted-foreground/50">
                            No teacher data yet
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={teacherPie}
                                    cx="50%" cy="45%"
                                    innerRadius={50} outerRadius={75}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {teacherPie.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Legend
                                    iconType="circle" iconSize={8}
                                    formatter={(value) => (
                                        <span className="text-[11px] text-muted-foreground">{value}</span>
                                    )}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0];
                                        return (
                                            <div className="bg-card border border-border/50 rounded-xl px-3 py-2 shadow-lg text-xs">
                                                <p style={{ color: (d.payload as { color: string }).color }} className="font-bold">
                                                    {d.name}: {d.value}
                                                </p>
                                            </div>
                                        );
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Plan usage bar chart ─────────────────────────────── */}
            <div className="bg-card border border-border/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={15} className="text-muted-foreground" />
                    <p className="text-sm font-semibold">Plan Usage</p>
                    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                        {plan.name.toUpperCase()}
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {usageData.map(({ name, used, limit, color }) => {
                        const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                        return (
                            <div key={name} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-muted-foreground">{name}</p>
                                    <p className="text-xs font-bold" style={{ color }}>
                                        {used.toLocaleString('en-IN')} <span className="text-muted-foreground font-normal">/ {limit.toLocaleString('en-IN')}</span>
                                    </p>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${pct}%`, background: color }}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground">{pct}% used</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Monthly growth bar chart ─────────────────────────── */}
            <div className="bg-card border border-border/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart2 size={15} className="text-muted-foreground" />
                    <p className="text-sm font-semibold">Monthly Teacher Additions</p>
                    <span className="ml-auto text-[10px] text-muted-foreground/60 uppercase tracking-wide">Cumulative</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={enrollmentGrowth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={22}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="teachers" name="Teachers" fill={VIOLET} radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ── Ticket summary ───────────────────────────────────── */}
            {overview.tickets.length > 0 && (
                <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle size={15} className="text-muted-foreground" />
                        <p className="text-sm font-semibold">Open Support Tickets</p>
                        <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            {overview.tickets.length} active
                        </span>
                    </div>
                    <div className="space-y-2">
                        {overview.tickets.map(ticket => (
                            <div key={ticket.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ticket.status === 'OPEN'
                                    ? 'bg-blue-100 dark:bg-blue-950/40'
                                    : 'bg-amber-100 dark:bg-amber-950/40'
                                    }`}>
                                    {ticket.status === 'OPEN'
                                        ? <AlertCircle size={13} className="text-blue-600" />
                                        : <Clock size={13} className="text-amber-600" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{ticket.title}</p>
                                    <p className="text-[10px] text-muted-foreground">{ticket.category} · {ticket.priority}</p>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ticket.status === 'OPEN'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                    }`}>{ticket.status}</span>
                                <p className="text-[10px] text-muted-foreground shrink-0">{ticket.createdAt}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Coming soon: AI token analytics ─────────────────── */}
            <div className="bg-card border border-border/50 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
                    <Sparkles size={18} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold">AI Token Analytics</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Real-time per-teacher token usage, quota alerts, and cost breakdowns — coming soon.
                    </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                    Coming soon
                </span>
            </div>

        </div>
    );
}
