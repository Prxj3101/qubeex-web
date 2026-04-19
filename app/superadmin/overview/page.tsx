'use client';

import { Building2, Users, BookOpen, Mail, ArrowUpRight, ArrowDownRight, Activity, Zap, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const CHARACTERS = [
    '/images/superadmin1.png',
    '/images/superadmin2.png',
    '/images/superadmin3.png',
];

const STATS = [
    {
        label: 'Total institutions',
        value: '48',
        sub: '+3 this month',
        trend: 'up',
        icon: Building2,
        iconBg: 'bg-violet-100 dark:bg-violet-950',
        iconColor: 'text-violet-600 dark:text-violet-400',
    },
    {
        label: 'Active students',
        value: '3,241',
        sub: '+124 this week',
        trend: 'up',
        icon: Users,
        iconBg: 'bg-emerald-100 dark:bg-emerald-950',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
        label: 'Tests conducted',
        value: '1,892',
        sub: '+87 today',
        trend: 'up',
        icon: BookOpen,
        iconBg: 'bg-amber-100 dark:bg-amber-950',
        iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
        label: 'Pending Invites',
        value: '6',
        sub: '2 expiring soon',
        trend: 'down',
        icon: Mail,
        iconBg: 'bg-sky-100 dark:bg-sky-950',
        iconColor: 'text-sky-600 dark:text-sky-400',
    },
];

const GROWTH_DATA = [
    { month: 'Nov', active: 28, trial: 4 },
    { month: 'Dec', active: 31, trial: 3 },
    { month: 'Jan', active: 35, trial: 5 },
    { month: 'Feb', active: 38, trial: 4 },
    { month: 'Mar', active: 42, trial: 3 },
    { month: 'Apr', active: 46, trial: 2 },
];

const PLAN_DATA = [
    { label: 'Pro', count: 29, total: 48, color: 'bg-violet-500' },
    { label: 'Basic', count: 17, total: 48, color: 'bg-emerald-500' },
    { label: 'Trial', count: 2, total: 48, color: 'bg-amber-400' },
];

const INSTITUTIONS = [
    { abbr: 'DPS', name: 'Delhi Public School', meta: '42 students · 3 teachers', status: 'Active', avatarBg: 'bg-violet-100 dark:bg-violet-950', avatarColor: 'text-violet-700 dark:text-violet-300' },
    { abbr: 'AKC', name: 'Aakash Coaching', meta: '210 students · 8 teachers', status: 'Active', avatarBg: 'bg-emerald-100 dark:bg-emerald-950', avatarColor: 'text-emerald-700 dark:text-emerald-300' },
    { abbr: 'SVC', name: 'Shree Vidya College', meta: '89 students · 5 teachers', status: 'Trial', avatarBg: 'bg-amber-100 dark:bg-amber-950', avatarColor: 'text-amber-700 dark:text-amber-300' },
    { abbr: 'MHS', name: 'Modern High School', meta: '0 students · 0 teachers', status: 'Suspended', avatarBg: 'bg-red-100 dark:bg-red-950', avatarColor: 'text-red-700 dark:text-red-300' },
];

const LOGS = [
    { dot: 'bg-violet-500', text: 'New institution Ryan International created', time: '2 min ago' },
    { dot: 'bg-emerald-500', text: 'Admin invite accepted by rohit@aakash.com', time: '18 min ago' },
    { dot: 'bg-amber-500', text: 'Sunrise Academy upgraded to Pro plan', time: '1 hr ago' },
    { dot: 'bg-red-500', text: 'Login failed (5×) for admin@mhs.edu', time: '2 hr ago' },
    { dot: 'bg-violet-500', text: 'Super admin logged in from new device', time: '3 hr ago' },
];

const statusStyle: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    Trial: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    Suspended: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
};

const now = new Date();
const hour = now.getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function SuperAdminOverview() {
    const [currentChar, setCurrentChar] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentChar(prev => (prev + 1) % CHARACTERS.length);
        }, 8000);
        return () => clearInterval(interval);
    }, []);
    return (

        <div className="space-y-6">

            {/* Header */}
            <div className="-mx-4 relative overflow-visible rounded-b-[65px] bg-[#7C3AED] dark:bg-[#4C1D95] px-13 py-5 flex items-center justify-between min-h-[160px]">                {/* Orbs */}
                <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
                <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />

                {/* Twinkling stars */}
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-27 left-36 animate-pulse delay-300" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-22 left-5 animate-pulse delay-600" />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-4 left-52 animate-pulse delay-700" />

                {/* Left — Greeting */}
                <div className="space-y-1 z-10">
                    <p className="text-white/70 text-base">{greeting}👋, Boss</p>
                    <p className="text-white text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                        Prajwal Kotian
                    </p>
                    <p className="text-white/60 text-sm">Here's what's happening across your platform today.</p>
                    <p className="text-white/50 text-xs mt-2">{dateStr}</p>
                </div>

                {/* Right — Rotating 3D Characters */}
                <div className="z-10 relative w-[200px] h-[200px] hidden sm:block self-end mb-[-40px]">
                    <motion.div
                        animate={{ y: [0, -12, 0] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.img
                                key={currentChar}
                                src={CHARACTERS[currentChar]}
                                alt="superadmin character"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1.2 }}
                                className="w-[188px] h-[187px] object-contain"
                                style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' }}
                            />
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {STATS.map((s) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="bg-muted/50 rounded-xl p-4 relative">
                            <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                                <Icon size={15} className={s.iconColor} />
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                            <p className="text-3xl font-semibold tracking-tight">{s.value}</p>
                            <div className="flex items-center gap-1 mt-1.5">
                                {s.trend === 'up'
                                    ? <ArrowUpRight size={13} className="text-emerald-600 dark:text-emerald-400" />
                                    : <ArrowDownRight size={13} className="text-red-500" />
                                }
                                <span className={`text-xs ${s.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{s.sub}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Mid: Chart + Plan Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                {/* Growth Chart */}
                <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium">Institution growth</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" />Active</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-border inline-block" />Trial</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={GROWTH_DATA} barGap={4}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                                cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
                            />
                            <Bar dataKey="active" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={32} />
                            <Bar dataKey="trial" fill="hsl(var(--border))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Plan Distribution + Health */}
                <div className="bg-card border border-border/50 rounded-xl p-5 flex flex-col gap-5">
                    <div>
                        <p className="text-sm font-medium mb-4">Plan distribution</p>
                        <div className="space-y-3">
                            {PLAN_DATA.map((p) => (
                                <div key={p.label} className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-8">{p.label}</span>
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${p.color}`} style={{ width: `${Math.round((p.count / p.total) * 100)}%` }} />
                                    </div>
                                    <span className="text-xs font-medium w-5 text-right">{p.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-border/50 pt-4">
                        <p className="text-sm font-medium mb-3">Platform health</p>
                        <div className="space-y-2.5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Activity size={13} />API uptime
                                </div>
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">99.9%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Zap size={13} />Avg response
                                </div>
                                <span className="text-xs font-medium">142ms</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock size={13} />Active sessions
                                </div>
                                <span className="text-xs font-medium">318</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom: Institutions + Audit Logs */}
            <div className="flex flex-col gap-3">
                {/* Recent Institutions */}
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium">Recent institutions</p>
                        <a href="/superadmin/institutions" className="text-xs text-primary hover:underline">View all</a>
                    </div>
                    <div className="space-y-0.5">
                        {INSTITUTIONS.map((inst, i) => (
                            <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-none">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg ${inst.avatarBg} flex items-center justify-center text-[11px] font-semibold ${inst.avatarColor}`}>
                                        {inst.abbr}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium leading-tight">{inst.name}</p>
                                        <p className="text-xs text-muted-foreground">{inst.meta}</p>
                                    </div>
                                </div>
                                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${statusStyle[inst.status]}`}>
                                    {inst.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Audit Logs */}
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium">Recent audit logs</p>
                        <a href="/superadmin/audit-logs" className="text-xs text-primary hover:underline">View all</a>
                    </div>
                    <div className="space-y-0.5">
                        {LOGS.map((log, i) => (
                            <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${log.dot}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-foreground leading-relaxed">{log.text}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{log.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}