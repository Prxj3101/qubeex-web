'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import type { AdminOverview } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useMockInstType } from '@/context/MockInstTypeContext';
import {
    Users, GraduationCap, BookOpen, AlertCircle, RefreshCw, BarChart2, Gauge,
    Sparkles, Clock, Layers, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';


// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }: {
    icon: React.ElementType; label: string; value: string | number;
    sub?: string; iconBg: string; iconColor: string;
}) {
    return (
        <div className="bg-white dark:bg-muted/50 rounded-xl p-4 relative shadow-sm border border-border/50">
            <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
                <Icon size={15} className={iconColor} />
            </div>
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            <p className="text-2xl font-semibold tracking-tight">
                {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
            </p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
        </div>
    );
}

// ── Placeholder ───────────────────────────────────────────────────────────────
function ComingSoonSection({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
                <Icon size={15} className="text-muted-foreground" />
                <p className="text-sm font-semibold">{title}</p>
                <span className="ml-auto text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">Coming soon</span>
            </div>
            <div className="flex items-center justify-center h-32 text-muted-foreground/30 text-sm">
                Real-time data will appear here
            </div>
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
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Skeleton className="h-64 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
                <Skeleton className="h-96 rounded-2xl" />
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
                    <RefreshCw size={13} /> Retry
                </Button>
            </div>
        );
    }

    const { stats, plan } = overview;
    const activeTeachers = teachers.filter(t => t.status === 'ACTIVE').length;
    const inactiveTeachers = teachers.filter(t => t.status === 'INACTIVE').length;

    const institutionTokensUsed = plan.usage.aiTokens.used;
    const institutionTokensLimit = plan.usage.aiTokens.limit;
    const tokenPct = institutionTokensLimit > 0
        ? Math.min(100, Math.round((institutionTokensUsed / institutionTokensLimit) * 100))
        : 0;

    return (
        <div className="space-y-3 pb-4">

            {/* ── Header ── */}
            <div className="sticky top-0 z-20 bg-background pb-0 pt-0">
                <div className="flex items-center justify-between px-0">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <BarChart2 size={21} />
                            Analytics
                        </h1>
                        <p className="text-[13px] text-muted-foreground">
                            {overview.institution.name}
                        </p>
                    </div>
                    <Button variant="outline" size="icon"
                        onClick={() => { fetchedRef.current = false; fetchAll(); }} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard icon={Users} label="Total Users" value={stats.totalUsers}
                    iconBg="bg-violet-100 dark:bg-violet-950" iconColor="text-violet-600 dark:text-violet-400"
                    sub={`${plan.usage.users.limit.toLocaleString('en-IN')} limit`} />
                <StatCard icon={GraduationCap} label="Students" value={stats.totalStudents}
                    iconBg="bg-emerald-100 dark:bg-emerald-950" iconColor="text-emerald-600 dark:text-emerald-400"
                    sub="Enrolled students" />
                <StatCard icon={BookOpen} label="Teachers" value={stats.totalTeachers}
                    iconBg="bg-amber-100 dark:bg-amber-950" iconColor="text-amber-600 dark:text-amber-400"
                    sub={`${activeTeachers} active · ${inactiveTeachers} inactive`} />
                <StatCard icon={Layers} label="Classes" value={stats.totalClasses}
                    iconBg="bg-sky-100 dark:bg-sky-950" iconColor="text-sky-600 dark:text-sky-400"
                    sub="Configured in campus" />
                <StatCard icon={Wallet} label="Plan" value={plan.name.toUpperCase()}
                    iconBg="bg-rose-100 dark:bg-rose-950" iconColor="text-rose-600 dark:text-rose-400"
                    sub={`${plan.usage.users.used} users used`} />
            </div>

            {/* ── Plan Usage + AI Usage side by side ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* Plan Usage */}
                <div className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-1">
                        < Gauge size={15} className="text-muted-foreground" />
                        <p className="text-sm font-semibold">Plan Usage</p>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Current plan</p>
                            <p className="text-lg font-semibold">{plan.name}</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                            {plan.name.toUpperCase()}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {[
                            { label: 'Users', used: plan.usage.users.used, limit: plan.usage.users.limit },
                            { label: 'Storage (MB)', used: plan.usage.storage.used, limit: plan.usage.storage.limit },
                            { label: 'Tests', used: plan.usage.tests.used, limit: plan.usage.tests.limit },
                        ].map((b) => {
                            const pct = Math.min(100, Math.round((b.used / b.limit) * 100));
                            const overLimit = b.used >= b.limit;
                            return (
                                <div key={b.label}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs text-muted-foreground">{b.label}</span>
                                        <span className="text-xs font-medium">
                                            {b.used.toLocaleString('en-IN')} <span className="text-muted-foreground">/ {b.limit.toLocaleString('en-IN')}</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-700 ${overLimit ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                            style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* AI Usage */}
                <div className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles size={15} className="text-muted-foreground" />
                        <p className="text-sm font-semibold">AI Usage</p>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Institution token pool</p>
                            <p className="text-lg font-semibold">
                                {institutionTokensUsed}
                                <span className="text-sm font-normal text-muted-foreground"> / {institutionTokensLimit} tokens</span>
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                            <Sparkles size={15} className="text-violet-600 dark:text-violet-400" />
                        </div>
                    </div>

                    {/* Pool bar */}
                    <div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${tokenPct}%`,
                                    background: 'linear-gradient(90deg, #DA7756, #C06040)',
                                }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">{tokenPct}% used</p>
                    </div>

                    {/* Per teacher */}
                    <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Per teacher</p>
                        <div className="flex items-center justify-center h-16 text-muted-foreground/30 text-xs">
                            Per-teacher breakdown coming soon
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Fee Analysis ── */}
            <ComingSoonSection icon={Wallet} title="Fee Analysis" />

            {/* ── Attendance Analysis ── */}
            <ComingSoonSection icon={Users} title="Attendance Analysis" />

            {/* ── Open tickets ── */}
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
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ticket.status === 'OPEN' ? 'bg-blue-100 dark:bg-blue-950/40' : 'bg-amber-100 dark:bg-amber-950/40'}`}>
                                    {ticket.status === 'OPEN'
                                        ? <AlertCircle size={13} className="text-blue-600" />
                                        : <Clock size={13} className="text-amber-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{ticket.title}</p>
                                    <p className="text-[10px] text-muted-foreground">{ticket.category} · {ticket.priority}</p>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ticket.status === 'OPEN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                    {ticket.status}
                                </span>
                                <p className="text-[10px] text-muted-foreground shrink-0">{ticket.createdAt}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}