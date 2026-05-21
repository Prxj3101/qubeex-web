'use client';

import { motion } from 'framer-motion';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
    Users, GraduationCap, BookOpen, Wallet,
    LineChart, TrendingUp, TrendingDown, Sparkles,
} from 'lucide-react';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const enrollmentData = [
    { month: 'Jul', students: 420 }, { month: 'Aug', students: 445 },
    { month: 'Sep', students: 460 }, { month: 'Oct', students: 458 },
    { month: 'Nov', students: 471 }, { month: 'Dec', students: 465 },
    { month: 'Jan', students: 482 }, { month: 'Feb', students: 490 },
    { month: 'Mar', students: 510 }, { month: 'Apr', students: 518 },
    { month: 'May', students: 524 },
];

const attendanceData = [
    { class: 'Class 6', rate: 91 }, { class: 'Class 7', rate: 88 },
    { class: 'Class 8', rate: 94 }, { class: 'Class 9', rate: 86 },
    { class: 'Class 10', rate: 92 },
];

const feeData = [
    { name: 'Collected', value: 78, color: '#7C3AED' },
    { name: 'Pending', value: 14, color: '#DA7756' },
    { name: 'Overdue', value: 8, color: '#EF4444' },
];

const aiUsageData = [
    { name: 'Priya Sharma', used: 2.1, limit: 5 },
    { name: 'Rahul Mehta', used: 3.8, limit: 5 },
    { name: 'Anita Desai', used: 1.2, limit: 5 },
    { name: 'Suresh Patil', used: 4.6, limit: 5 },
    { name: 'Meena Joshi', used: 0.8, limit: 5 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } };

function StatCard({ icon: Icon, label, value, sub, trend, trendUp }: {
    icon: React.ElementType; label: string; value: string;
    sub?: string; trend?: string; trendUp?: boolean;
}) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm shadow-black/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-violet-400" />
                </div>
            </div>
            <div>
                <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-xs font-medium ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trendUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {trend}
                </div>
            )}
        </div>
    );
}

function SectionHeader({ icon: Icon, title, subtitle }: {
    icon: React.ElementType; title: string; subtitle?: string;
}) {
    return (
        <div className="flex items-start gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <div>
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
                {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-card border border-border/50 rounded-xl px-3 py-2 shadow-lg text-xs">
            <p className="text-muted-foreground mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} className="font-semibold text-foreground">{p.value}{p.name === 'rate' ? '%' : ''}</p>
            ))}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
    const institutionTokensUsed = 14.5;
    const institutionTokensTotal = 50;
    const tokenPct = (institutionTokensUsed / institutionTokensTotal) * 100;

    return (
        <div className="min-h-screen bg-background">

            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-background pb-0 pt-0">
                <div className="flex items-center justify-between px-0">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <LineChart size={21} />
                            Analytics
                        </h1>
                        <p className="text-muted-foreground text-[13px]">School performance & AI usage overview</p>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <div className="py-3 space-y-5">

                {/* Stat Cards */}
                <motion.div {...fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard icon={GraduationCap} label="Total students" value="524" sub="Active enrollments" trend="+14 this month" trendUp />
                    <StatCard icon={Users} label="Total teachers" value="38" sub="Including admin staff" trend="+2 this month" trendUp />
                    <StatCard icon={BookOpen} label="Active classes" value="22" sub="Across 5 standards" />
                    <StatCard icon={Wallet} label="Fee collection" value="78%" sub="₹18.4L of ₹23.6L" trend="-3% vs last month" trendUp={false} />
                </motion.div>

                {/* School Analytics */}
                <motion.section {...fadeUp} transition={{ delay: 0.08 }}>
                    <SectionHeader icon={TrendingUp} title="School analytics" subtitle="Enrollment trends, attendance & fee collection" />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                        {/* Enrollment */}
                        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5">
                            <p className="text-sm font-medium text-foreground mb-4">Student enrollment — this academic year</p>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={enrollmentData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={[400, 540]} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Area type="monotone" dataKey="students" stroke="#7C3AED" strokeWidth={2} fill="url(#enrollGrad)" dot={false} activeDot={{ r: 4, fill: '#7C3AED' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Fee donut */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5">
                            <p className="text-sm font-medium text-foreground mb-4">Fee collection status</p>
                            <div className="flex flex-col items-center gap-4">
                                <ResponsiveContainer width="100%" height={140}>
                                    <PieChart>
                                        <Pie data={feeData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                                            {feeData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="w-full space-y-2">
                                    {feeData.map((d) => (
                                        <div key={d.name} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                                                <span className="text-muted-foreground">{d.name}</span>
                                            </div>
                                            <span className="font-semibold text-foreground">{d.value}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Attendance bar */}
                        <div className="lg:col-span-3 bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5">
                            <p className="text-sm font-medium text-foreground mb-4">Attendance rate by class — this month</p>
                            <ResponsiveContainer width="100%" height={160}>
                                <BarChart data={attendanceData} margin={{ top: 0, right: 5, left: -20, bottom: 0 }} barSize={36}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} vertical={false} />
                                    <XAxis dataKey="class" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={[70, 100]} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                                        {attendanceData.map((entry, i) => (
                                            <Cell key={i} fill={entry.rate >= 90 ? '#7C3AED' : entry.rate >= 85 ? '#9D5CF6' : '#DA7756'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </motion.section>

                {/* AI Usage */}
                <motion.section {...fadeUp} transition={{ delay: 0.14 }}>
                    <SectionHeader icon={Sparkles} title="AI usage breakdown" subtitle="Institution token pool and per-teacher consumption" />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                        {/* Pool summary */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 flex flex-col gap-4">
                            <p className="text-sm font-medium text-foreground">Institution token pool</p>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold text-foreground">{institutionTokensUsed}M</span>
                                <span className="text-sm text-muted-foreground mb-1">/ {institutionTokensTotal}M used</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${tokenPct}%`, background: 'linear-gradient(90deg, #7C3AED, #DA7756)' }} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted/40 rounded-xl p-3">
                                    <p className="text-xs text-muted-foreground">Remaining</p>
                                    <p className="text-lg font-bold text-foreground mt-0.5">{institutionTokensTotal - institutionTokensUsed}M</p>
                                </div>
                                <div className="bg-muted/40 rounded-xl p-3">
                                    <p className="text-xs text-muted-foreground">Teachers using AI</p>
                                    <p className="text-lg font-bold text-foreground mt-0.5">{aiUsageData.length}</p>
                                </div>
                            </div>
                        </div>

                        {/* Per-teacher */}
                        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5">
                            <p className="text-sm font-medium text-foreground mb-4">Per-teacher breakdown</p>
                            <div className="space-y-3.5">
                                {[...aiUsageData].sort((a, b) => b.used - a.used).map((t) => {
                                    const pct = (t.used / t.limit) * 100;
                                    const isCritical = pct >= 90;
                                    return (
                                        <div key={t.name} className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-violet-400">
                                                    {t.name.split(' ').map(n => n[0]).join('')}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-medium text-foreground truncate">{t.name}</span>
                                                    <span className={`text-[11px] font-semibold shrink-0 ml-2 ${isCritical ? 'text-[#DA7756]' : 'text-muted-foreground'}`}>
                                                        {t.used}M / {t.limit}M
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-500" style={{
                                                        width: `${pct}%`,
                                                        background: isCritical
                                                            ? 'linear-gradient(90deg, #DA7756, #C06040)'
                                                            : 'linear-gradient(90deg, #7C3AED, #9D5CF6)',
                                                    }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </motion.section>

                <div className="h-6" />
            </div>
        </div>
    );
}