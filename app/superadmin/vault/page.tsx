'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye, EyeOff, ShieldCheck, TrendingUp, IndianRupee, Users, BarChart3,
    ArrowUpRight, ArrowDownRight, AlertTriangle, CreditCard, Zap, Clock,
    CheckCircle, XCircle, AlertCircle, KeyRound, Lock, ArrowUp,
    Download, Calendar, Trophy, RefreshCw, Timer,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────
const VAULT_PASSWORD = 'qubeex@vault';
const AUTO_LOCK_SECS = 300; // 5 minutes

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ALL_MONTHLY = [
    { month: 'Jul', revenue: 312000, subscriptions: 34, churned: 1 },
    { month: 'Aug', revenue: 378000, subscriptions: 38, churned: 2 },
    { month: 'Sep', revenue: 402000, subscriptions: 40, churned: 1 },
    { month: 'Oct', revenue: 445000, subscriptions: 43, churned: 0 },
    { month: 'Nov', revenue: 498000, subscriptions: 45, churned: 2 },
    { month: 'Dec', revenue: 521000, subscriptions: 46, churned: 1 },
    { month: 'Jan', revenue: 564000, subscriptions: 48, churned: 1 },
    { month: 'Feb', revenue: 598000, subscriptions: 49, churned: 2 },
    { month: 'Mar', revenue: 632000, subscriptions: 51, churned: 1 },
    { month: 'Apr', revenue: 680000, subscriptions: 53, churned: 0 },
    { month: 'May', revenue: 724000, subscriptions: 55, churned: 1 },
    { month: 'Jun', revenue: 758000, subscriptions: 57, churned: 1 },
    // Forecast (dotted)
    { month: 'Jul*', revenue: null, forecast: 798000, subscriptions: null, churned: null },
    { month: 'Aug*', revenue: null, forecast: 841000, subscriptions: null, churned: null },
    { month: 'Sep*', revenue: null, forecast: 887000, subscriptions: null, churned: null },
];

const TYPE_REVENUE = [
    { type: 'School', revenue: 287000, color: '#7C3AED', institutions: 23, icon: '🏫' },
    { type: 'College', revenue: 341000, color: '#DA7756', institutions: 19, icon: '🎓' },
    { type: 'Coaching', revenue: 130000, color: '#10B981', institutions: 15, icon: '📚' },
];

const PLAN_SPLIT = [
    { name: 'Pro', value: 29, color: '#DA7756', revenue: 29 * 24999 },
    { name: 'Basic', value: 28, color: '#7C3AED', revenue: 28 * 11999 },
];

const TOP_INSTITUTIONS = [
    { name: 'Aakash Institute', revenue: 24999, type: 'College', plan: 'Pro' },
    { name: 'DY Patil Engineering', revenue: 24999, type: 'College', plan: 'Pro' },
    { name: 'Fergusson College', revenue: 24999, type: 'College', plan: 'Pro' },
    { name: 'Ryan International School', revenue: 24999, type: 'School', plan: 'Pro' },
    { name: 'Delhi Public School', revenue: 11999, type: 'School', plan: 'Basic' },
];

const UPGRADE_HISTORY = [
    { inst: 'Aakash Institute', from: 'Basic', to: 'Pro', date: '10 Apr 2026', amount: 13000 },
    { inst: 'Fergusson College', from: 'Basic', to: 'Pro', date: '28 Mar 2026', amount: 13000 },
    { inst: 'DAV Public School', from: 'Basic', to: 'Pro', date: '15 Mar 2026', amount: 13000 },
    { inst: 'Hansraj College', from: 'Basic', to: 'Pro', date: '02 Mar 2026', amount: 13000 },
];

const TRANSACTIONS = [
    { inst: 'DY Patil College', plan: 'Pro', amount: 24999, date: '14 Apr 2026', status: 'SUCCESS' },
    { inst: 'Delhi Public School', plan: 'Basic', amount: 11999, date: '13 Apr 2026', status: 'SUCCESS' },
    { inst: 'Aakash Institute', plan: 'Pro', amount: 24999, date: '12 Apr 2026', status: 'SUCCESS' },
    { inst: 'Modern High School', plan: 'Basic', amount: 11999, date: '11 Apr 2026', status: 'FAILED' },
    { inst: 'Fergusson College', plan: 'Pro', amount: 24999, date: '10 Apr 2026', status: 'SUCCESS' },
    { inst: 'Shree Vidya College', plan: 'Basic', amount: 11999, date: '09 Apr 2026', status: 'REFUNDED' },
    { inst: 'Ryan International', plan: 'Pro', amount: 24999, date: '08 Apr 2026', status: 'SUCCESS' },
    { inst: 'MES College of Arts', plan: 'Basic', amount: 11999, date: '07 Apr 2026', status: 'FAILED' },
];

const RENEWAL_CALENDAR = [
    { day: 18, inst: 'Kendriya Vidyalaya', plan: 'Basic', urgent: true },
    { day: 21, inst: "St. Xavier's School", plan: 'Pro', urgent: false },
    { day: 24, inst: 'Presidency College', plan: 'Basic', urgent: false },
    { day: 27, inst: 'Symbiosis College', plan: 'Pro', urgent: false },
    { day: 29, inst: 'Bal Bharati School', plan: 'Basic', urgent: false },
];

const OVERDUE = [
    { inst: 'Modern High School', plan: 'Basic', overdueDays: 12, amount: 11999 },
    { inst: 'MES College of Arts', plan: 'Basic', overdueDays: 7, amount: 11999 },
];

const REFUNDS = [
    { inst: 'Shree Vidya College', amount: 11999, date: '09 Apr 2026', reason: 'Duplicate payment' },
];

const txStatusCfg: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    SUCCESS: { label: 'Success', icon: CheckCircle, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400' },
    FAILED: { label: 'Failed', icon: XCircle, cls: 'text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400' },
    REFUNDED: { label: 'Refunded', icon: AlertCircle, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400' },
};

const DATE_RANGES = ['3M', '6M', '1Y'] as const;
type DateRange = typeof DATE_RANGES[number];

function fmt(n: number) {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n}`;
}

function filterByRange(range: DateRange) {
    const count = range === '3M' ? 3 : range === '6M' ? 6 : 12;
    return ALL_MONTHLY.filter(m => !m.month.includes('*')).slice(-count);
}

// ─── Password Gate ────────────────────────────────────────────────────────────

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [shake, setShake] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleUnlock = () => {
        if (password === VAULT_PASSWORD) {
            sessionStorage.setItem('vault_unlocked', '1');
            sessionStorage.setItem('vault_ts', Date.now().toString());
            onUnlock();
        } else {
            const next = attempts + 1;
            setAttempts(next);
            setError(next >= 3 ? `${next} failed attempts.` : 'Incorrect password.');
            setShake(true);
            setPassword('');
            setTimeout(() => setShake(false), 500);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[70vh]">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }} className="w-full max-w-sm">
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <KeyRound size={36} className="text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                            <Lock size={10} className="text-white" />
                        </div>
                    </div>
                </div>
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-poppins)' }}>My Vault</h2>
                    <p className="text-sm text-muted-foreground mt-1">Enter your vault password to continue</p>
                </div>
                <motion.div animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }} className="relative mb-3">
                    <input ref={inputRef} type={showPw ? 'text' : 'password'} value={password}
                        onChange={e => { setPassword(e.target.value); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                        placeholder="Vault password"
                        className="w-full h-11 px-4 pr-11 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-[#DA7756]/60 focus:bg-background transition-all" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </motion.div>
                {error && <p className="text-xs text-red-500 mb-3 flex items-center gap-1.5"><AlertTriangle size={12} />{error}</p>}
                <button onClick={handleUnlock}
                    className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-all duration-100 shadow-[0_4px_0_#9E4A2E] hover:shadow-[0_2px_0_#9E4A2E] active:shadow-none active:translate-y-[2px]"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                    Unlock Vault
                </button>
                <p className="text-center text-[11px] text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                    <ShieldCheck size={12} /> Session-restricted · Auto-locks after 5 min inactivity
                </p>
            </motion.div>
        </div>
    );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, trend, icon: Icon, iconBg, iconColor }: {
    label: string; value: string; sub: string; trend: 'up' | 'down';
    icon: React.ElementType; iconBg: string; iconColor: string;
}) {
    return (
        <div className="bg-muted/50 rounded-xl p-4 relative">
            <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
                <Icon size={15} className={iconColor} />
            </div>
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <div className="flex items-center gap-1 mt-1.5">
                {trend === 'up' ? <ArrowUpRight size={13} className="text-emerald-500" /> : <ArrowDownRight size={13} className="text-red-500" />}
                <span className={`text-xs ${trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{sub}</span>
            </div>
        </div>
    );
}

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
    return (
        <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                <Icon size={14} className="text-white" />
            </div>
            <div>
                <p className="text-sm font-semibold">{title}</p>
                {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Auto Lock Hook ───────────────────────────────────────────────────────────

function useAutoLock(onLock: () => void, seconds: number) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [remaining, setRemaining] = useState(seconds);

    const reset = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        setRemaining(seconds);
        timer.current = setTimeout(() => { onLock(); }, seconds * 1000);
    }, [onLock, seconds]);

    useEffect(() => {
        reset();
        const events = ['mousemove', 'keydown', 'click', 'scroll'];
        events.forEach(e => window.addEventListener(e, reset));

        // Countdown
        const interval = setInterval(() => {
            setRemaining(r => Math.max(0, r - 1));
        }, 1000);

        return () => {
            if (timer.current) clearTimeout(timer.current);
            clearInterval(interval);
            events.forEach(e => window.removeEventListener(e, reset));
        };
    }, [reset]);

    return remaining;
}

// ─── Vault Dashboard ──────────────────────────────────────────────────────────

function VaultDashboard({ onLock }: { onLock: () => void }) {
    const [dateRange, setDateRange] = useState<DateRange>('1Y');
    const remaining = useAutoLock(onLock, AUTO_LOCK_SECS);

    const monthlyData = filterByRange(dateRange);
    const forecastData = [...monthlyData, ...ALL_MONTHLY.filter(m => m.month.includes('*'))];

    const totalRevenue = ALL_MONTHLY.filter(m => !m.month.includes('*')).reduce((s, m) => s + (m.revenue ?? 0), 0);
    const thisMonth = ALL_MONTHLY.filter(m => !m.month.includes('*')).at(-1)!.revenue!;
    const lastMonth = ALL_MONTHLY.filter(m => !m.month.includes('*')).at(-2)!.revenue!;
    const momGrowth = (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1);
    const mrr = thisMonth;
    const arr = mrr * 12;
    const totalChurned = ALL_MONTHLY.filter(m => !m.month.includes('*')).reduce((s, m) => s + (m.churned ?? 0), 0);
    const churnRate = ((totalChurned / 57) * 100).toFixed(1);
    const nrr = 108.4;
    const ltv = Math.round(mrr / 57 * 18);
    const cac = 4200;

    // Today's snapshot
    const todayRevenue = TRANSACTIONS.filter(t => t.date === '14 Apr 2026' && t.status === 'SUCCESS').reduce((s, t) => s + t.amount, 0);
    const todayTx = TRANSACTIONS.filter(t => t.date === '14 Apr 2026').length;
    const totalRefunds = REFUNDS.reduce((s, r) => s + r.amount, 0);
    const refundRate = ((REFUNDS.length / TRANSACTIONS.length) * 100).toFixed(1);

    const lockMins = Math.floor(remaining / 60);
    const lockSecs = remaining % 60;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
            className="space-y-6 pb-10">

            {/* ── Banner ── */}
            <div className="-mx-4 relative overflow-hidden rounded-b-[50px] px-10 py-8 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg, #C06040 0%, #DA7756 50%, #E8876A 100%)' }}>
                <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
                <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-20 left-36 animate-pulse delay-300" />

                <div className="z-10">
                    <p className="text-white/70 text-sm flex items-center gap-2 mb-1">
                        <ShieldCheck size={14} /> Vault Unlocked · Session Active
                    </p>
                    <p className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-poppins)' }}>My Vault</p>
                    <p className="text-white/60 text-sm">Financial overview — confidential</p>
                </div>

                <div className="z-10 flex flex-col items-end gap-2">
                    <div className="text-right">
                        <p className="text-white/60 text-xs mb-0.5">Lifetime Revenue</p>
                        <p className="text-white text-3xl font-bold">{fmt(totalRevenue)}</p>
                        <p className="text-white/60 text-xs mt-0.5">across all institutions</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Auto lock countdown */}
                        <div className="flex items-center gap-1.5 text-white/60 text-xs border border-white/20 px-2.5 py-1 rounded-full">
                            <Timer size={11} />
                            Auto-lock: {lockMins}:{lockSecs.toString().padStart(2, '0')}
                        </div>
                        <button onClick={onLock}
                            className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-full transition-all">
                            <Lock size={11} /> Lock
                        </button>
                        <button
                            onClick={() => alert('Export coming soon!')}
                            className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-full transition-all">
                            <Download size={11} /> Export
                        </button>
                    </div>
                </div>
            </div>

            {/* ── 8. Today's Snapshot ── */}
            <div className="bg-card border border-border/50 rounded-xl p-5">
                <SectionHeader icon={Zap} title="Today's Snapshot" sub="17 Apr 2026" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: "Today's Revenue", value: fmt(todayRevenue), sub: `${todayTx} transactions`, icon: IndianRupee, color: 'text-[#DA7756]', bg: 'bg-[#DA7756]/10' },
                        { label: 'New Signups', value: '2', sub: 'institutions today', icon: Users, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-950' },
                        { label: 'Pending Renewals', value: '4', sub: 'this month', icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950' },
                        { label: 'Active Sessions', value: '12', sub: 'institutions online now', icon: Zap, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950' },
                    ].map(({ label, value, sub, icon: Icon, color, bg }) => (
                        <div key={label} className="bg-muted/40 rounded-xl p-3.5">
                            <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                                <Icon size={14} className={color} />
                            </div>
                            <p className="text-lg font-bold">{value}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Key Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="MRR" value={fmt(mrr)} sub={`+${momGrowth}% vs last month`} trend="up"
                    icon={IndianRupee} iconBg="bg-[#DA7756]/10" iconColor="text-[#DA7756]" />
                <StatCard label="ARR (projected)" value={fmt(arr)} sub="Based on current MRR" trend="up"
                    icon={TrendingUp} iconBg="bg-emerald-100 dark:bg-emerald-950" iconColor="text-emerald-600 dark:text-emerald-400" />
                <StatCard label="Active Subscriptions" value="57" sub="+2 new this month" trend="up"
                    icon={Users} iconBg="bg-violet-100 dark:bg-violet-950" iconColor="text-violet-600 dark:text-violet-400" />
                <StatCard label="Churn Rate" value={`${churnRate}%`} sub="-0.4% vs last month" trend="up"
                    icon={BarChart3} iconBg="bg-sky-100 dark:bg-sky-950" iconColor="text-sky-600 dark:text-sky-400" />
            </div>

            {/* ── Revenue + Forecast + Plan Split ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-1">
                        <SectionHeader icon={TrendingUp} title="Revenue Trend + Forecast" sub="Dotted = projected" />
                        {/* ── Date Range Filter ── */}
                        <div className="flex gap-1 bg-muted/60 rounded-lg p-0.5 border border-border/50 mb-4">
                            {DATE_RANGES.map(r => (
                                <button key={r} onClick={() => setDateRange(r)}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all
                                        ${dateRange === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={210}>
                        <LineChart data={forecastData}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={v => `₹${Number(v) / 1000}K`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                            <ReferenceLine x="Jun" stroke="hsl(var(--border))" strokeDasharray="4 4" label={{ value: 'Now', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                            <Line type="monotone" dataKey="revenue" stroke="#DA7756" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#DA7756' }} connectNulls={false} />
                            <Line type="monotone" dataKey="forecast" stroke="#DA7756" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4, fill: '#DA7756' }} connectNulls={true} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-card border border-border/50 rounded-xl p-5 flex flex-col gap-4">
                    <div>
                        <SectionHeader icon={CreditCard} title="Plan Distribution" />
                        <div className="flex items-center justify-center gap-4">
                            <PieChart width={110} height={110}>
                                <Pie data={PLAN_SPLIT} cx={50} cy={50} innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={0}>
                                    {PLAN_SPLIT.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                </Pie>
                            </PieChart>
                            <div className="space-y-3">
                                {PLAN_SPLIT.map(p => (
                                    <div key={p.name}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                                            <span className="text-xs text-muted-foreground">{p.name}</span>
                                            <span className="text-xs font-bold ml-1">{p.value}</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground ml-4">{fmt(p.revenue)}/mo</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-border/50 pt-3 space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Growth Metrics</p>
                        {[
                            { icon: Zap, label: 'NRR', value: `${nrr}%`, good: true },
                            { icon: TrendingUp, label: 'MoM Growth', value: `+${momGrowth}%`, good: true },
                            { icon: Clock, label: 'Avg LTV', value: fmt(ltv), good: true },
                            { icon: IndianRupee, label: 'CAC', value: fmt(cac), good: false },
                            { icon: Users, label: 'Total Churned', value: totalChurned, good: false },
                        ].map(({ icon: Icon, label, value, good }) => (
                            <div key={label} className="flex justify-between items-center">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon size={12} />{label}</div>
                                <span className={`text-xs font-semibold ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Revenue by Type ── */}
            <div className="bg-card border border-border/50 rounded-xl p-5">
                <SectionHeader icon={BarChart3} title="Revenue by Institution Type" sub="Current month breakdown" />
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {TYPE_REVENUE.map(({ type, revenue, color, institutions, icon }) => (
                        <div key={type} className="rounded-xl p-4 border border-border/50 bg-muted/30">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">{icon}</span>
                                <span className="text-xs font-medium">{type}</span>
                            </div>
                            <p className="text-xl font-bold">{fmt(revenue)}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{institutions} institutions</p>
                            <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${(revenue / 341000) * 100}%`, background: color }} />
                            </div>
                        </div>
                    ))}
                </div>
                <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={TYPE_REVENUE} barGap={8}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                        <XAxis dataKey="type" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `₹${Number(v) / 1000}K`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={60}>
                            {TYPE_REVENUE.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ── Top Institutions + Upgrade History ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* Top performing */}
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <SectionHeader icon={Trophy} title="Top Performing Institutions" sub="By monthly revenue" />
                    <div className="space-y-3">
                        {TOP_INSTITUTIONS.map((inst, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                                    ${i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400' :
                                        i === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' :
                                            i === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400' :
                                                'bg-muted text-muted-foreground'}`}>
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{inst.name}</p>
                                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full"
                                            style={{ width: `${(inst.revenue / 24999) * 100}%`, background: inst.plan === 'Pro' ? '#DA7756' : '#7C3AED' }} />
                                    </div>
                                </div>
                                <p className="text-xs font-semibold shrink-0">{fmt(inst.revenue)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Upgrade history */}
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <SectionHeader icon={ArrowUp} title="Upgrade History" sub="Basic → Pro conversions" />
                    <div className="space-y-0.5">
                        {UPGRADE_HISTORY.map((u, i) => (
                            <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-none">
                                <div>
                                    <p className="text-xs font-medium">{u.inst}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">{u.from}</span>
                                        <ArrowUpRight size={10} className="text-muted-foreground" />
                                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#DA775620', color: '#DA7756' }}>{u.to}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-semibold text-emerald-600">+{fmt(u.amount)}</p>
                                    <p className="text-[11px] text-muted-foreground">{u.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/50">
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                            4 upgrades this quarter · {fmt(4 * 13000)} additional revenue
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Subscription Analytics ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <SectionHeader icon={Users} title="Subscription Analytics" sub="Active vs Churned per month" />
                    <ResponsiveContainer width="100%" height={170}>
                        <BarChart data={monthlyData} barGap={4}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="subscriptions" fill="#DA7756" radius={[4, 4, 0, 0]} maxBarSize={24} name="Active" />
                            <Bar dataKey="churned" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={24} name="Churned" />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-[#DA7756] inline-block" />Active</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />Churned</span>
                    </div>
                </div>

                {/* Renewal Calendar */}
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <SectionHeader icon={Calendar} title="Renewal Calendar" sub="April 2026 upcoming renewals" />
                    <div className="space-y-2.5">
                        {RENEWAL_CALENDAR.map((r, i) => (
                            <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border ${r.urgent ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20' : 'border-border/50 bg-muted/30'}`}>
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0
                                    ${r.urgent ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-muted text-muted-foreground'}`}>
                                    {r.day}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{r.inst}</p>
                                    <p className="text-[11px] text-muted-foreground">{r.plan} plan renewal</p>
                                </div>
                                {r.urgent && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 shrink-0">Urgent</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Transactions + Refunds ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-5">
                    <SectionHeader icon={IndianRupee} title="Recent Transactions" />
                    <div className="space-y-0.5">
                        {TRANSACTIONS.map((tx, i) => {
                            const cfg = txStatusCfg[tx.status];
                            const Icon = cfg.icon;
                            return (
                                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-none">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                                            {tx.inst.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium">{tx.inst}</p>
                                            <p className="text-[11px] text-muted-foreground">{tx.date} · {tx.plan}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="text-sm font-semibold">₹{tx.amount.toLocaleString()}</p>
                                        <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
                                            <Icon size={10} />{cfg.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Refunds + Overdue */}
                <div className="flex flex-col gap-3">
                    <div className="bg-card border border-border/50 rounded-xl p-5">
                        <SectionHeader icon={AlertCircle} title="Refund Analytics" />
                        <div className="space-y-2 mb-3">
                            {[
                                { label: 'Total refunds', value: REFUNDS.length.toString() },
                                { label: 'Refund amount', value: fmt(totalRefunds) },
                                { label: 'Refund rate', value: `${refundRate}%` },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex justify-between">
                                    <span className="text-xs text-muted-foreground">{label}</span>
                                    <span className="text-xs font-semibold">{value}</span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-border/50 pt-3 space-y-2">
                            {REFUNDS.map((r, i) => (
                                <div key={i} className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30">
                                    <p className="text-xs font-medium">{r.inst}</p>
                                    <p className="text-[11px] text-muted-foreground">{r.reason}</p>
                                    <p className="text-xs font-semibold text-amber-600 mt-0.5">₹{r.amount.toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-card border border-border/50 rounded-xl p-5">
                        <SectionHeader icon={AlertTriangle} title="Overdue Payments" />
                        {OVERDUE.map((o, i) => (
                            <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 mb-2 last:mb-0">
                                <div>
                                    <p className="text-xs font-medium">{o.inst}</p>
                                    <p className="text-[11px] text-muted-foreground">{o.overdueDays}d overdue</p>
                                </div>
                                <p className="text-sm font-bold text-red-600">₹{o.amount.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VaultPage() {
    const [unlocked, setUnlocked] = useState(() => {
        if (typeof window !== 'undefined') {
            const ts = sessionStorage.getItem('vault_ts');
            if (ts && Date.now() - parseInt(ts) < AUTO_LOCK_SECS * 1000) {
                return sessionStorage.getItem('vault_unlocked') === '1';
            }
        }
        return false;
    });

    const handleLock = useCallback(() => {
        sessionStorage.removeItem('vault_unlocked');
        sessionStorage.removeItem('vault_ts');
        setUnlocked(false);
    }, []);

    return (
        <AnimatePresence mode="wait">
            {!unlocked ? (
                <motion.div key="gate" exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }}>
                    <PasswordGate onUnlock={() => setUnlocked(true)} />
                </motion.div>
            ) : (
                <motion.div key="vault" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                    <VaultDashboard onLock={handleLock} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}