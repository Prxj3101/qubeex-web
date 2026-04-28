'use client';

import {
    Building2, Users, TicketIcon, Mail, ArrowUpRight, ArrowDownRight,
    Activity, Zap, Clock, RefreshCw,
} from 'lucide-react';
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Line,
} from 'recharts';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '@/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type OverviewStats = {
    totalInstitutions: number;
    newInstitutionsThisMonth: number;
    pendingInvites: number;
    activeStudents: number;
    newStudentsThisWeek: number;
};

type GrowthPoint = { month: string; active: number; trial: number };
type PlanDist = { plan: string; count: number };
type RecentInst = {
    id: string; name: string; status: string;
    institutionCode?: string;
    users?: { role: string }[];
    teacherCount?: number; studentCount?: number;
    subscription?: { plan?: { name: string } } | null;
};
type RecentLog = {
    id: string; action: string; details?: string | null;
    createdAt: string;
    institution?: { name: string } | null;
};

type OverviewData = {
    stats: OverviewStats;
    institutionGrowth: GrowthPoint[];
    planDistribution: PlanDist[];
    recentInstitutions: RecentInst[];
    recentAuditLogs: RecentLog[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHARACTERS = [
    '/images/superadmin1.png',
    '/images/superadmin2.png',
    '/images/superadmin3.png',
];

const statusStyle: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    TRIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
};

const ACTION_DOT: Record<string, string> = {
    INSTITUTION_CREATED: 'bg-violet-500',
    INSTITUTION_SUSPENDED: 'bg-red-500',
    INSTITUTION_ACTIVATED: 'bg-sky-500',
    INVITE_SENT: 'bg-violet-400',
    INVITE_ACCEPTED: 'bg-emerald-500',
    PLAN_ASSIGNED: 'bg-amber-500',
    LOGIN_SUCCESS: 'bg-teal-500',
    LOGIN_FAILED: 'bg-rose-500',
    NOTIFICATION_SENT: 'bg-purple-500',
};

function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} days ago`;
}

function planColor(plan: string) {
    if (plan === 'PRO') return 'bg-violet-500';
    if (plan === 'TRIAL') return 'bg-amber-400';
    return 'bg-emerald-500';
}

const PLAN_ORDER = ['PRO', 'BASIC', 'TRIAL'];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse bg-muted rounded-lg ${className}`} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminOverview() {
    const { user } = useAuthStore();
    const [currentChar, setCurrentChar] = useState(0);
    const [data, setData] = useState<OverviewData | null>(null);
    const [loading, setLoading] = useState(true);

    // Rotating character animation
    useEffect(() => {
        const iv = setInterval(() => setCurrentChar(p => (p + 1) % CHARACTERS.length), 7000);
        return () => clearInterval(iv);
    }, []);

    // Greeting
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const dateStr = now.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
    const displayName = user?.name ?? user?.email?.split('@')[0] ?? 'Boss';

    const fetchOverview = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/overview');
            setData(res.data.data);
        } catch {
            toast.error('Failed to load overview');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchOverview(); }, [fetchOverview]);

    // Build stat cards from live data
    const stats = data?.stats;
    const STAT_CARDS = [
        {
            label: 'Total Institutions',
            value: stats ? stats.totalInstitutions.toLocaleString('en-IN') : '—',
            sub: stats ? `+${stats.newInstitutionsThisMonth} this month` : '…',
            trend: 'up' as const,
            icon: Building2,
            iconBg: 'bg-violet-100 dark:bg-violet-950',
            iconColor: 'text-violet-600 dark:text-violet-400',
        },
        {
            label: 'Total Users',
            value: stats ? stats.activeStudents.toLocaleString('en-IN') : '—',
            sub: stats ? `+${stats.newStudentsThisWeek} this week` : '…',
            trend: 'up' as const,
            icon: Users,
            iconBg: 'bg-emerald-100 dark:bg-emerald-950',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            label: 'Pending Invites',
            value: stats ? String(stats.pendingInvites) : '—',
            sub: stats?.pendingInvites === 0 ? 'All clear' : 'Awaiting acceptance',
            trend: stats?.pendingInvites === 0 ? 'up' as const : 'down' as const,
            icon: Mail,
            iconBg: 'bg-amber-100 dark:bg-amber-950',
            iconColor: 'text-amber-600 dark:text-amber-400',
        },
        {
            label: 'Tickets Open',
            value: '—',
            sub: 'Support queue',
            trend: 'down' as const,
            icon: TicketIcon,
            iconBg: 'bg-red-100 dark:bg-red-950',
            iconColor: 'text-red-600 dark:text-red-400',
        },
    ];

    // Plan distribution sorted
    const planDist = (data?.planDistribution ?? [])
        .filter(p => p.count > 0)
        .sort((a, b) => PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan));
    const planTotal = planDist.reduce((s, p) => s + p.count, 0) || 1;

    return (
        <div className="space-y-3">

            {/* ── Header ── */}
            <div className="-mx-4 relative overflow-visible rounded-b-[65px] bg-[#7C3AED] dark:bg-[#4C1D95] px-13 py-5 flex items-center justify-between min-h-[160px]">
                {/* Orbs */}
                <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
                <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />
                {/* Stars */}
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-27 left-36 animate-pulse delay-300" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-22 left-5 animate-pulse delay-600" />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-4 left-52 animate-pulse delay-700" />

                <div className="space-y-1 z-10">
                    <p className="text-white/70 text-base">{greeting}👋, Boss</p>
                    <p className="text-white text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                        {displayName}
                    </p>
                    <p className="text-white/60 text-sm">Here's what's happening across your platform today.</p>
                    <p className="text-white/50 text-xs mt-2">{dateStr}</p>
                </div>

                {/* Refresh */}
                <button
                    onClick={fetchOverview}
                    disabled={loading}
                    className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>

                {/* Character */}
                <div className="z-10 relative w-[200px] h-[200px] hidden sm:block self-end mb-[-40px]">
                    <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>
                        <AnimatePresence mode="wait">
                            <motion.img
                                key={currentChar}
                                src={CHARACTERS[currentChar]}
                                alt="superadmin character"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                transition={{ duration: 1.2 }}
                                className="w-[188px] h-[187px] object-contain"
                                style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' }}
                            />
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {STAT_CARDS.map((s) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="bg-white dark:bg-muted/50 rounded-xl p-4 relative shadow-sm border border-border/50">
                            <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                                <Icon size={15} className={s.iconColor} />
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                            {loading
                                ? <Skeleton className="h-8 w-20 mb-2" />
                                : <p className="text-3xl font-semibold tracking-tight">{s.value}</p>
                            }
                            <div className="flex items-center gap-1 mt-1.5">
                                {s.trend === 'up'
                                    ? <ArrowUpRight size={13} className="text-emerald-600 dark:text-emerald-400" />
                                    : <ArrowDownRight size={13} className="text-red-500" />}
                                <span className={`text-xs ${s.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                    {loading ? '…' : s.sub}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Chart + Plan Distribution ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                {/* Growth Chart */}
                <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium">Software growth</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" />Active
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-6 h-0.5 bg-amber-400 inline-block rounded-full" />Trial
                            </span>
                        </div>
                    </div>
                    {loading ? (
                        <Skeleton className="h-[180px] w-full" />
                    ) : (
                        <ResponsiveContainer width="100%" height={180}>
                            <ComposedChart data={data?.institutionGrowth ?? []} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                                />
                                <Bar dataKey="active" fill="#7C3AED" radius={[6, 6, 0, 0]} maxBarSize={28} opacity={0.9} />
                                <Line
                                    type="monotone" dataKey="trial" stroke="#F59E0B" strokeWidth={2.5}
                                    dot={{ r: 4, fill: '#F59E0B', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                                    activeDot={{ r: 6, fill: '#F59E0B', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Plan Distribution + Health */}
                <div className="bg-card border border-border/50 rounded-xl p-5 flex flex-col gap-5">
                    <div>
                        <p className="text-sm font-medium mb-4">Plan distribution</p>
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-4 w-full" />)}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {planDist.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No subscriptions yet</p>
                                ) : planDist.map((p) => (
                                    <div key={p.plan} className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-10 capitalize">{p.plan}</span>
                                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${planColor(p.plan)}`}
                                                style={{ width: `${Math.round((p.count / planTotal) * 100)}%` }} />
                                        </div>
                                        <span className="text-xs font-medium w-5 text-right">{p.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-border/50 pt-4">
                        <p className="text-sm font-medium mb-3">Platform health</p>
                        <div className="space-y-2.5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity size={13} />API uptime</div>
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">99.9%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Zap size={13} />Avg response</div>
                                <span className="text-xs font-medium">—</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock size={13} />Active sessions</div>
                                <span className="text-xs font-medium">—</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Bottom: Recent Institutions + Audit Logs ── */}
            <div className="flex flex-col gap-3">

                {/* Recent Institutions */}
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium">Recent institutions</p>
                        <a href="/superadmin/institutions" className="text-xs text-primary hover:underline">View all</a>
                    </div>
                    <div className="space-y-0.5">
                        {loading ? (
                            [...Array(4)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-none">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="w-8 h-8 rounded-lg" />
                                        <div className="space-y-1">
                                            <Skeleton className="h-3 w-32" />
                                            <Skeleton className="h-2.5 w-24" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                </div>
                            ))
                        ) : data?.recentInstitutions.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center">No institutions yet</p>
                        ) : (
                            data?.recentInstitutions.map((inst) => {
                                const abbr = inst.name.split(' ').slice(0, 3).map(w => w[0]).join('').toUpperCase();
                                const plan = inst.subscription?.plan?.name ?? '';
                                const AVATAR_COLORS = [
                                    'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
                                    'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
                                    'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
                                    'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
                                    'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300',
                                ];
                                const colorClass = AVATAR_COLORS[inst.name.charCodeAt(0) % AVATAR_COLORS.length];
                                const studentCount = inst.users?.filter(u => u.role === 'STUDENT').length ?? 0;
                                const teacherCount = inst.users?.filter(u => u.role === 'TEACHER').length ?? 0;

                                return (
                                    <div key={inst.id} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-none">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-semibold ${colorClass}`}>
                                                {abbr}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-tight">{inst.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {studentCount} students · {teacherCount} teachers
                                                    {plan && ` · ${plan}`}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${statusStyle[inst.status] ?? statusStyle['PENDING']}`}>
                                            {inst.status === 'ACTIVE' ? 'Active' : inst.status === 'SUSPENDED' ? 'Suspended' : 'Pending'}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Recent Audit Logs */}
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium">Recent audit logs</p>
                        <a href="/superadmin/audit-logs" className="text-xs text-primary hover:underline">View all</a>
                    </div>
                    <div className="space-y-0.5">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
                                    <Skeleton className="w-2 h-2 rounded-full mt-1.5 shrink-0" />
                                    <div className="flex-1 space-y-1">
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-2.5 w-16" />
                                    </div>
                                </div>
                            ))
                        ) : data?.recentAuditLogs.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center">No activity yet</p>
                        ) : (
                            data?.recentAuditLogs.map((log) => {
                                const dot = ACTION_DOT[log.action] ?? 'bg-muted-foreground';
                                const instName = log.institution?.name ? ` · ${log.institution.name}` : '';
                                return (
                                    <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
                                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dot}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-foreground leading-relaxed">
                                                {log.details ?? log.action.replace(/_/g, ' ')}
                                                {instName && <span className="text-muted-foreground">{instName}</span>}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(log.createdAt)}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}