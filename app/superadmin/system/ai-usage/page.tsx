'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Brain, TrendingUp, IndianRupee, Zap,
    ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SUMMARY = [
    { label: 'Total Tokens Used', value: '4.2M', sub: '+18% this month', trend: 'up', icon: Zap, iconBg: 'bg-violet-100 dark:bg-violet-950', iconColor: 'text-violet-600 dark:text-violet-400' },
    { label: 'Total Cost (MTD)', value: '₹12,840', sub: '+12% vs last month', trend: 'up', icon: IndianRupee, iconBg: 'bg-amber-100 dark:bg-amber-950', iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Avg Cost/Institution', value: '₹267', sub: '48 institutions', trend: 'down', icon: Brain, iconBg: 'bg-emerald-100 dark:bg-emerald-950', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'API Requests', value: '18,420', sub: '+5% today', trend: 'up', icon: TrendingUp, iconBg: 'bg-sky-100 dark:bg-sky-950', iconColor: 'text-sky-600 dark:text-sky-400' },
];

const INSTITUTIONS = [
    { name: 'Aakash Coaching', abbr: 'AKC', type: 'COACHING', tokens: 842000, cost: 2240, requests: 3840, model: 'claude-sonnet-4-6', plan: 'Pro' },
    { name: 'Delhi Public School', abbr: 'DPS', type: 'SCHOOL', tokens: 621000, cost: 1650, requests: 2810, model: 'claude-sonnet-4-6', plan: 'Pro' },
    { name: 'Shree Vidya College', abbr: 'SVC', type: 'COLLEGE', tokens: 480000, cost: 1280, requests: 2180, model: 'claude-haiku-4-5', plan: 'Basic' },
    { name: 'Modern High School', abbr: 'MHS', type: 'SCHOOL', tokens: 320000, cost: 850, requests: 1450, model: 'claude-haiku-4-5', plan: 'Basic' },
    { name: 'Ryan International', abbr: 'RIS', type: 'SCHOOL', tokens: 290000, cost: 770, requests: 1320, model: 'claude-sonnet-4-6', plan: 'Pro' },
    { name: 'Sunrise Academy', abbr: 'SUA', type: 'COACHING', tokens: 210000, cost: 560, requests: 950, model: 'claude-haiku-4-5', plan: 'Basic' },
];

const TREND_DATA = [
    { month: 'Nov', tokens: 2100, cost: 5600 },
    { month: 'Dec', tokens: 2800, cost: 7450 },
    { month: 'Jan', tokens: 3100, cost: 8240 },
    { month: 'Feb', tokens: 3600, cost: 9580 },
    { month: 'Mar', tokens: 3900, cost: 10380 },
    { month: 'Apr', tokens: 4200, cost: 12840 },
];

const MODEL_DATA = [
    { model: 'claude-sonnet-4-6', tokens: 2800000, cost: 8960, color: '#7C3AED' },
    { model: 'claude-haiku-4-5', tokens: 1400000, cost: 3880, color: '#10B981' },
];

const DATE_FILTERS = ['7D', '1M', '3M', '6M', 'YTD'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
}

const TYPE_COLORS: Record<string, string> = {
    SCHOOL: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    COLLEGE: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    COACHING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIUsagePage() {
    const [activeFilter, setActiveFilter] = useState('1M');
    const [expandedInst, setExpandedInst] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'tokens' | 'cost' | 'requests'>('tokens');

    const sorted = [...INSTITUTIONS].sort((a, b) => b[sortBy] - a[sortBy]);
    const maxTokens = Math.max(...INSTITUTIONS.map(i => i.tokens));

    return (
        <div className="space-y-5 pt-3">

            {/* ── Page Header ── */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Brain size={26} />
                        AI Usage & Cost
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Monitor AI consumption across all institutions</p>
                </div>
                {/* Date filter pills */}
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50">
                    {DATE_FILTERS.map(f => (
                        <button key={f} onClick={() => setActiveFilter(f)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeFilter === f
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}>
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Summary Stat Cards ── */}
            <div className="grid grid-cols-4 gap-3">
                {SUMMARY.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <motion.div
                            key={s.label}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="bg-muted/50 rounded-2xl p-4 relative"
                        >
                            <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                                <Icon size={15} className={s.iconColor} />
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                            <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                            <div className="flex items-center gap-1 mt-1.5">
                                {s.trend === 'up'
                                    ? <ArrowUpRight size={12} className="text-emerald-500" />
                                    : <ArrowDownRight size={12} className="text-red-500" />
                                }
                                <span className={`text-xs ${s.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                    {s.sub}
                                </span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Usage Trend + Model Split ── */}
            <div className="grid grid-cols-3 gap-4">

                {/* Trend Chart */}
                <div className="col-span-2 bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold">Usage Trend</p>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Tokens (K)</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Cost (₹)</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={TREND_DATA}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                            <Line yAxisId="left" type="monotone" dataKey="tokens" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 4, fill: '#7C3AED', stroke: 'hsl(var(--card))', strokeWidth: 2 }} />
                            <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4, fill: '#F59E0B', stroke: 'hsl(var(--card))', strokeWidth: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Model Split */}
                <div className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col gap-5">
                    <p className="text-sm font-semibold">Model Usage</p>
                    <div className="space-y-4">
                        {MODEL_DATA.map(m => {
                            const total = MODEL_DATA.reduce((s, x) => s + x.tokens, 0);
                            const pct = Math.round((m.tokens / total) * 100);
                            return (
                                <div key={m.model}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <code className="text-[11px] font-mono font-semibold">{m.model}</code>
                                        <span className="text-[11px] font-bold" style={{ color: m.color }}>{pct}%</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[10px] text-muted-foreground">{formatTokens(m.tokens)} tokens</span>
                                        <span className="text-[10px] text-muted-foreground">₹{m.cost.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="border-t border-border/50 pt-3 space-y-2.5">
                        <p className="text-xs font-semibold text-muted-foreground">By Institution Type</p>
                        {[
                            { name: 'Coaching', tokens: 1052000, color: '#F59E0B' },
                            { name: 'School', tokens: 1231000, color: '#7C3AED' },
                            { name: 'College', tokens: 480000, color: '#2563EB' },
                        ].map(t => (
                            <div key={t.name} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                                <span className="text-xs text-muted-foreground flex-1">{t.name}</span>
                                <span className="text-xs font-semibold">{formatTokens(t.tokens)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Per Institution Table ── */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 bg-muted/20">
                    <Brain size={14} className="text-violet-500" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Per Institution Usage</p>
                    {/* Sort buttons */}
                    <div className="ml-auto flex gap-1">
                        {(['tokens', 'cost', 'requests'] as const).map(s => (
                            <button key={s} onClick={() => setSortBy(s)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${sortBy === s
                                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-border/40">
                    {sorted.map((inst, idx) => {
                        const expanded = expandedInst === inst.abbr;
                        const barWidth = Math.round((inst.tokens / maxTokens) * 100);
                        const initials = inst.abbr;
                        return (
                            <div key={inst.abbr}>
                                <button
                                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-all text-left"
                                    onClick={() => setExpandedInst(expanded ? null : inst.abbr)}
                                >
                                    <span className="text-sm font-bold text-muted-foreground w-5">#{idx + 1}</span>
                                    <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground ring-2 ring-border flex items-center justify-center text-[11px] font-bold shrink-0">
                                        {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{inst.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_COLORS[inst.type]}`}>
                                                {inst.type}
                                            </span>
                                            <code className="text-[10px] text-muted-foreground font-mono">{inst.model}</code>
                                        </div>
                                    </div>
                                    {/* Bar */}
                                    <div className="w-24 hidden lg:block">
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-primary" style={{ width: `${barWidth}%` }} />
                                        </div>
                                    </div>
                                    {/* Stats */}
                                    <div className="flex gap-5 text-right">
                                        <div>
                                            <p className="text-sm font-bold">{formatTokens(inst.tokens)}</p>
                                            <p className="text-[10px] text-muted-foreground">tokens</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">₹{inst.cost.toLocaleString('en-IN')}</p>
                                            <p className="text-[10px] text-muted-foreground">cost</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{inst.requests.toLocaleString('en-IN')}</p>
                                            <p className="text-[10px] text-muted-foreground">requests</p>
                                        </div>
                                    </div>
                                    {expanded
                                        ? <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                                        : <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                                    }
                                </button>

                                {/* Expanded detail */}
                                {expanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="px-5 pb-4 bg-muted/10"
                                    >
                                        <div className="grid grid-cols-4 gap-3 pt-2">
                                            {[
                                                { label: 'Avg tokens/req', value: Math.round(inst.tokens / inst.requests).toLocaleString('en-IN') },
                                                { label: 'Cost per 1K tokens', value: `₹${(inst.cost / (inst.tokens / 1000)).toFixed(3)}` },
                                                { label: 'Plan', value: inst.plan },
                                                { label: 'Model tier', value: inst.model.includes('sonnet') ? 'Sonnet' : 'Haiku' },
                                            ].map(({ label, value }) => (
                                                <div key={label} className="p-3 bg-card rounded-xl border border-border/50">
                                                    <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                                                    <p className="text-sm font-bold">{value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}