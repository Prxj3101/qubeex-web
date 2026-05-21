'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
    Users, GraduationCap, BookOpen, Wallet,
    Zap, TrendingUp, TrendingDown, AlertTriangle,
    CheckCircle2, XCircle, Download, Receipt,
    ChevronRight, Sparkles, Shield, Database,
    ArrowUpRight, Crown, Building2,
    LineChart
} from 'lucide-react';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const enrollmentData = [
    { month: 'Jul', students: 420 },
    { month: 'Aug', students: 445 },
    { month: 'Sep', students: 460 },
    { month: 'Oct', students: 458 },
    { month: 'Nov', students: 471 },
    { month: 'Dec', students: 465 },
    { month: 'Jan', students: 482 },
    { month: 'Feb', students: 490 },
    { month: 'Mar', students: 510 },
    { month: 'Apr', students: 518 },
    { month: 'May', students: 524 },
];

const attendanceData = [
    { class: 'Class 6', rate: 91 },
    { class: 'Class 7', rate: 88 },
    { class: 'Class 8', rate: 94 },
    { class: 'Class 9', rate: 86 },
    { class: 'Class 10', rate: 92 },
];

const feeData = [
    { name: 'Collected', value: 78, color: '#7C3AED' },
    { name: 'Pending', value: 14, color: '#DA7756' },
    { name: 'Overdue', value: 8, color: '#EF4444' },
];

const aiUsageData = [
    { name: 'Priya Sharma', used: 2.1, limit: 5, role: 'Class Teacher' },
    { name: 'Rahul Mehta', used: 3.8, limit: 5, role: 'Math Teacher' },
    { name: 'Anita Desai', used: 1.2, limit: 5, role: 'Science Teacher' },
    { name: 'Suresh Patil', used: 4.6, limit: 5, role: 'English Teacher' },
    { name: 'Meena Joshi', used: 0.8, limit: 5, role: 'History Teacher' },
];

const invoices = [
    { month: 'May 2025', plan: 'Pro', amount: '₹4,999', status: 'paid' },
    { month: 'Apr 2025', plan: 'Pro', amount: '₹4,999', status: 'paid' },
    { month: 'Mar 2025', plan: 'Pro', amount: '₹4,999', status: 'paid' },
    { month: 'Feb 2025', plan: 'Basic', amount: '₹2,499', status: 'paid' },
    { month: 'Jan 2025', plan: 'Basic', amount: '₹2,499', status: 'paid' },
];

const planFeatures = [
    { name: 'Student management', enabled: true },
    { name: 'Teacher management', enabled: true },
    { name: 'Attendance tracking', enabled: true },
    { name: 'Fee management', enabled: true },
    { name: 'AI assistant', enabled: true },
    { name: 'Custom reports', enabled: true },
    { name: 'Parent portal', enabled: false },
    { name: 'Advanced analytics', enabled: false },
    { name: 'Multi-branch', enabled: false },
    { name: 'API access', enabled: false },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 },
};

function SectionHeader({ icon: Icon, title, subtitle }: {
    icon: React.ElementType;
    title: string;
    subtitle?: string;
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

function StatCard({ icon: Icon, label, value, sub, trend, trendUp }: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
    trend?: string;
    trendUp?: boolean;
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

function UsageBar({ label, used, total, unit = '', warn = false }: {
    label: string;
    used: number;
    total: number;
    unit?: string;
    warn?: boolean;
}) {
    const pct = Math.min((used / total) * 100, 100);
    const critical = pct >= 90;
    const warning = pct >= 70;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-medium ${critical ? 'text-red-400' : warning ? 'text-[#DA7756]' : 'text-foreground'}`}>
                    {used}{unit} / {total}{unit}
                </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                        width: `${pct}%`,
                        background: critical
                            ? '#EF4444'
                            : warning
                                ? 'linear-gradient(90deg, #DA7756, #C06040)'
                                : 'linear-gradient(90deg, #7C3AED, #9D5CF6)',
                    }}
                />
            </div>
            {critical && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Nearing limit — consider upgrading
                </p>
            )}
        </div>
    );
}

// Custom tooltip for charts
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
    const [billingTab, setBillingTab] = useState<'invoices' | 'history'>('invoices');

    // TODO: replace with real plan from authStore / API
    const currentPlan = 'PRO'; // 'PRO' | 'BASIC'

    const institutionTokensUsed = 14.5;
    const institutionTokensTotal = 50;
    const tokenPct = (institutionTokensUsed / institutionTokensTotal) * 100;

    return (
        <div className="min-h-screen bg-background">
            {/* Page header */}
            <div className="sticky top-0 z-20 bg-background pb-3 pt-1 space-y-3">
                <div className="flex items-center justify-between px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <LineChart size={21} />
                            Insights
                        </h1>
                        <p className="text-muted-foreground text-[13px]">School performance, plan usage & billing</p>
                    </div>
                    {currentPlan === 'PRO' ? (
                        <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-1.5">
                            <Crown className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-xs font-semibold text-violet-400">Pro Plan</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 bg-[#DA7756]/10 border border-[#DA7756]/20 rounded-xl px-3 py-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#DA7756]" />
                            <span className="text-xs font-semibold text-[#DA7756]">Basic Plan</span>
                        </div>
                    )}
                </div>
                <div className="h-px bg-border/60" />
            </div>

            <div className="px-6 py-6 space-y-10 max-w-6xl mx-auto">

                {/* ── SECTION 1: Stat Cards ── */}
                <motion.div {...fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={GraduationCap} label="Total students" value="524" sub="Active enrollments" trend="+14 this month" trendUp />
                    <StatCard icon={Users} label="Total teachers" value="38" sub="Including admin staff" trend="+2 this month" trendUp />
                    <StatCard icon={BookOpen} label="Active classes" value="22" sub="Across 5 standards" />
                    <StatCard icon={Wallet} label="Fee collection" value="78%" sub="₹18.4L of ₹23.6L" trend="-3% vs last month" trendUp={false} />
                </motion.div>

                {/* ── SECTION 2: School Analytics ── */}
                <motion.section {...fadeUp} transition={{ delay: 0.1 }}>
                    <SectionHeader
                        icon={TrendingUp}
                        title="School analytics"
                        subtitle="Enrollment trends, attendance & fee collection overview"
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                        {/* Enrollment trend */}
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

                        {/* Fee collection donut */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5">
                            <p className="text-sm font-medium text-foreground mb-4">Fee collection status</p>
                            <div className="flex flex-col items-center gap-4">
                                <ResponsiveContainer width="100%" height={140}>
                                    <PieChart>
                                        <Pie data={feeData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                                            {feeData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} strokeWidth={0} />
                                            ))}
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

                        {/* Attendance by class */}
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

                {/* ── SECTION 3: Plan Monitoring ── */}
                <motion.section {...fadeUp} transition={{ delay: 0.15 }}>
                    <SectionHeader
                        icon={Shield}
                        title="Plan monitoring"
                        subtitle="Current usage against plan limits and feature access"
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                        {/* Usage limits */}
                        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 space-y-5">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">Usage limits</p>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span>Resets</span>
                                    <span className="font-medium text-foreground">Jun 1, 2025</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <UsageBar label="Students enrolled" used={524} total={600} />
                                <UsageBar label="Teachers / staff" used={38} total={50} />
                                <UsageBar label="Storage" used={3.8} total={5} unit=" GB" warn />
                                <UsageBar label="AI tokens" used={institutionTokensUsed} total={institutionTokensTotal} unit=" M" />
                                <UsageBar label="Support tickets / month" used={9} total={10} warn />
                            </div>

                            {/* Upgrade nudge */}
                            <div className="flex items-center justify-between bg-[#DA7756]/10 border border-[#DA7756]/20 rounded-xl px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-[#DA7756]" />
                                    <p className="text-xs text-[#DA7756] font-medium">Storage & tickets nearing limit</p>
                                </div>
                                <button className="text-xs font-semibold text-[#DA7756] flex items-center gap-1 hover:gap-2 transition-all">
                                    Upgrade <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Feature access */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5">
                            <p className="text-sm font-medium text-foreground mb-4">Feature access</p>
                            <div className="space-y-2.5">
                                {planFeatures.map((f) => (
                                    <div key={f.name} className="flex items-center justify-between">
                                        <span className={`text-xs ${f.enabled ? 'text-foreground' : 'text-muted-foreground/50'}`}>{f.name}</span>
                                        {f.enabled
                                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            : <XCircle className="w-4 h-4 text-muted-foreground/30" />
                                        }
                                    </div>
                                ))}
                            </div>
                            <button
                                className="mt-5 w-full text-xs font-semibold text-violet-400 border border-violet-500/30 rounded-xl py-2.5 hover:bg-violet-500/10 transition-colors flex items-center justify-center gap-2"
                            >
                                <ArrowUpRight className="w-3.5 h-3.5" /> Unlock all features
                            </button>
                        </div>
                    </div>
                </motion.section>

                {/* ── SECTION 4: AI Usage ── */}
                <motion.section {...fadeUp} transition={{ delay: 0.2 }}>
                    <SectionHeader
                        icon={Sparkles}
                        title="AI usage breakdown"
                        subtitle="Institution token pool and per-teacher consumption"
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                        {/* Token pool summary */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 flex flex-col gap-4">
                            <p className="text-sm font-medium text-foreground">Institution token pool</p>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold text-foreground">{institutionTokensUsed}M</span>
                                <span className="text-sm text-muted-foreground mb-1">/ {institutionTokensTotal}M used</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${tokenPct}%`,
                                        background: 'linear-gradient(90deg, #7C3AED, #DA7756)',
                                    }}
                                />
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

                        {/* Per-teacher breakdown */}
                        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5">
                            <p className="text-sm font-medium text-foreground mb-4">Per-teacher breakdown</p>
                            <div className="space-y-3.5">
                                {aiUsageData.sort((a, b) => b.used - a.used).map((t, i) => {
                                    const pct = (t.used / t.limit) * 100;
                                    const isCritical = pct >= 90;
                                    return (
                                        <div key={t.name} className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-violet-400">{t.name.split(' ').map(n => n[0]).join('')}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-medium text-foreground truncate">{t.name}</span>
                                                    <span className={`text-[11px] font-semibold shrink-0 ml-2 ${isCritical ? 'text-[#DA7756]' : 'text-muted-foreground'}`}>
                                                        {t.used}M / {t.limit}M
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${pct}%`,
                                                            background: isCritical
                                                                ? 'linear-gradient(90deg, #DA7756, #C06040)'
                                                                : 'linear-gradient(90deg, #7C3AED, #9D5CF6)',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── SECTION 5: Billing ── */}
                <motion.section {...fadeUp} transition={{ delay: 0.25 }}>
                    <SectionHeader
                        icon={Receipt}
                        title="Billing"
                        subtitle="Your plan, invoices and payment history"
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                        {/* Plan card */}
                        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm shadow-black/5 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">Current plan</p>
                                <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2.5 py-1">
                                    <Crown className="w-3 h-3 text-violet-400" />
                                    <span className="text-xs font-semibold text-violet-400">Pro</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-foreground">₹4,999<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                                <p className="text-xs text-muted-foreground mt-1">Next billing on Jun 1, 2025</p>
                            </div>
                            <div className="pt-1 border-t border-border/50 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Payment method</span>
                                    <span className="font-medium text-foreground">•••• 4242</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Billing cycle</span>
                                    <span className="font-medium text-foreground">Monthly</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Member since</span>
                                    <span className="font-medium text-foreground">Jan 2025</span>
                                </div>
                            </div>
                            <div className="space-y-2 pt-1">
                                <button
                                    className="w-full text-xs font-semibold py-2.5 rounded-xl text-white"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                >
                                    Upgrade to Enterprise
                                </button>
                                <button className="w-full text-xs font-medium py-2 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                                    Cancel subscription
                                </button>
                            </div>
                        </div>

                        {/* Invoice table */}
                        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                            {/* Tabs */}
                            <div className="flex items-center gap-1 p-4 border-b border-border/50">
                                {(['invoices', 'history'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setBillingTab(tab)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${billingTab === tab
                                            ? 'bg-violet-500/15 text-violet-400'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {tab === 'invoices' ? 'Invoice history' : 'Plan changes'}
                                    </button>
                                ))}
                            </div>

                            {billingTab === 'invoices' && (
                                <div className="divide-y divide-border/30">
                                    {invoices.map((inv, i) => (
                                        <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center">
                                                    <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-foreground">{inv.month}</p>
                                                    <p className="text-[11px] text-muted-foreground">{inv.plan} plan</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-semibold text-foreground">{inv.amount}</span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                                    {inv.status}
                                                </span>
                                                <button className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors">
                                                    <Download className="w-3 h-3 text-muted-foreground" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {billingTab === 'history' && (
                                <div className="divide-y divide-border/30">
                                    {[
                                        { date: 'Feb 1, 2025', from: 'Basic', to: 'Pro', type: 'upgrade' },
                                        { date: 'Jan 1, 2025', from: 'Starter', to: 'Basic', type: 'upgrade' },
                                    ].map((h, i) => (
                                        <div key={i} className="flex items-center justify-between px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${h.type === 'upgrade' ? 'bg-violet-500/10' : 'bg-[#DA7756]/10'}`}>
                                                    <ArrowUpRight className={`w-3.5 h-3.5 ${h.type === 'upgrade' ? 'text-violet-400' : 'text-[#DA7756]'}`} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-foreground capitalize">{h.type}</p>
                                                    <p className="text-[11px] text-muted-foreground">{h.from} → {h.to}</p>
                                                </div>
                                            </div>
                                            <span className="text-[11px] text-muted-foreground">{h.date}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.section>

                {/* Bottom padding */}
                <div className="h-8" />
            </div>
        </div>
    );
}