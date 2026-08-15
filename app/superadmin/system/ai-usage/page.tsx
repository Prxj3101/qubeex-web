'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Brain, TrendingUp, Zap,
    ChevronDown, ChevronUp,
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '@/lib/api';
import { formatTokens } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeatureBreakdown { feature: string; requests: number; successRequests: number; failedRequests: number; totalTokens: number; }
interface InstitutionRow { institutionId: string; institutionName: string; requests: number; totalTokens: number; successRate: number; }
interface TrendPoint { period: string; requests: number; totalTokens: number; }
interface PlatformAiUsage {
    summary: { totalTokens: number; totalRequests: number; successRequests: number; failedRequests: number };
    trend: TrendPoint[];
    byFeature: FeatureBreakdown[];
    perInstitution: InstitutionRow[];
}

const AI_FEATURE_LABELS: Record<string, string> = {
    BLACKBOARD_CONTEXT: 'Document Analysis',
    BLACKBOARD_SCAN: 'AI Scan',
    BLACKBOARD_CHAT: 'AI Chat',
    BLACKBOARD_QUIZ: 'Quiz Generation',
    TASK_QUESTION_GENERATION: 'Question Bank',
};

const DATE_FILTERS = ['7D', '1M', '3M', '6M', 'YTD'];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIUsagePage() {
    const [activeFilter, setActiveFilter] = useState('1M');
    const [expandedInst, setExpandedInst] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'tokens' | 'requests'>('tokens');
    const [usage, setUsage] = useState<PlatformAiUsage | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.get('/superadmin/system/ai-usage', { params: { range: activeFilter } })
            .then(res => setUsage(res.data.data))
            .catch(() => setUsage(null))
            .finally(() => setLoading(false));
    }, [activeFilter]);

    const institutionRows = usage?.perInstitution ?? [];
    const sorted = [...institutionRows].sort((a, b) => {
        if (sortBy === 'tokens') return b.totalTokens - a.totalTokens;
        return b.requests - a.requests;
    });
    const maxTokens = Math.max(1, ...institutionRows.map(i => i.totalTokens));

    return (
        <div className="space-y-2">

            {/* ── Page Header ── */}
            <div className="sticky top-0 z-20 bg-background pb-1 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0 px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Brain size={21} />
                            AI Usage & Activity
                        </h1>
                        <p className="text-muted-foreground text-[13px]">Monitor AI consumption across all institutions</p>
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
                <div className="h-px bg-border/60" />
            </div>

            {/* ── Summary Stat Cards ── */}
            {(() => {
                const summaryTiles = [
                    { label: 'Total Tokens Used', value: usage ? formatTokens(usage.summary.totalTokens) : '—', sub: loading ? 'Loading…' : `${usage?.summary.totalRequests ?? 0} requests`, icon: Zap, iconBg: 'bg-violet-100 dark:bg-violet-950', iconColor: 'text-violet-600 dark:text-violet-400' },
                    { label: 'Successful Requests', value: usage ? usage.summary.successRequests.toLocaleString('en-IN') : '—', sub: 'across all institutions', icon: TrendingUp, iconBg: 'bg-emerald-100 dark:bg-emerald-950', iconColor: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Failed Requests', value: usage ? usage.summary.failedRequests.toLocaleString('en-IN') : '—', sub: usage && usage.summary.totalRequests > 0 ? `${Math.round((usage.summary.failedRequests / usage.summary.totalRequests) * 100)}% failure rate` : '—', icon: Brain, iconBg: 'bg-red-100 dark:bg-red-950', iconColor: 'text-red-600 dark:text-red-400' },
                    { label: 'API Requests', value: usage ? usage.summary.totalRequests.toLocaleString('en-IN') : '—', sub: `${usage?.perInstitution.length ?? 0} institutions`, icon: TrendingUp, iconBg: 'bg-sky-100 dark:bg-sky-950', iconColor: 'text-sky-600 dark:text-sky-400' },
                ];
                return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {summaryTiles.map((s, i) => {
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
                                    <p className="text-xs text-muted-foreground mt-1.5">{s.sub}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                )
            })()}

            {/* ── Usage Trend + Feature Split ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Trend Chart */}
                <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold">Usage Trend</p>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Tokens</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Requests</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={usage?.trend ?? []}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                            <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                            <Line yAxisId="left" type="monotone" dataKey="totalTokens" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 4, fill: '#7C3AED', stroke: 'hsl(var(--card))', strokeWidth: 2 }} />
                            <Line yAxisId="right" type="monotone" dataKey="requests" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4, fill: '#F59E0B', stroke: 'hsl(var(--card))', strokeWidth: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Feature Split */}
                <div className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col gap-5">
                    <p className="text-sm font-semibold">Usage by Feature</p>
                    <div className="space-y-4">
                        {(usage?.byFeature ?? []).map((f, i) => {
                            const total = usage?.byFeature.reduce((s, x) => s + x.totalTokens, 0) || 1;
                            const pct = Math.round((f.totalTokens / total) * 100);
                            const palette = ['#7C3AED', '#10B981', '#F59E0B', '#2563EB', '#DB2777'];
                            const color = palette[i % palette.length];
                            return (
                                <div key={f.feature}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-semibold">{AI_FEATURE_LABELS[f.feature] ?? f.feature}</span>
                                        <span className="text-[11px] font-bold" style={{ color }}>{pct}%</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[10px] text-muted-foreground">{formatTokens(f.totalTokens)} tokens</span>
                                        <span className="text-[10px] text-muted-foreground">{f.requests} requests</span>
                                    </div>
                                </div>
                            );
                        })}
                        {usage && usage.byFeature.length === 0 && (
                            <p className="text-xs text-muted-foreground">No AI usage recorded yet.</p>
                        )}
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
                        {(['tokens', 'requests'] as const).map(s => (
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
                        const expanded = expandedInst === inst.institutionId;
                        const barWidth = Math.round((inst.totalTokens / maxTokens) * 100);
                        const initials = inst.institutionName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
                        return (
                            <div key={inst.institutionId}>
                                <button
                                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-all text-left flex-wrap"
                                    onClick={() => setExpandedInst(expanded ? null : inst.institutionId)}
                                >
                                    <span className="text-sm font-bold text-muted-foreground w-5">#{idx + 1}</span>
                                    <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground ring-2 ring-border flex items-center justify-center text-[11px] font-bold shrink-0">
                                        {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{inst.institutionName}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{inst.successRate}% success rate</p>
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
                                            <p className="text-sm font-bold">{formatTokens(inst.totalTokens)}</p>
                                            <p className="text-[10px] text-muted-foreground">tokens</p>
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
                                        {/* Two tiles only (cost tiles were removed) — a
                                            4-column grid left this half empty on desktop. */}
                                        <div className="grid grid-cols-2 gap-3 pt-2">
                                            {[
                                                { label: 'Avg tokens/req', value: inst.requests > 0 ? Math.round(inst.totalTokens / inst.requests).toLocaleString('en-IN') : '—' },
                                                { label: 'Success rate', value: `${inst.successRate}%` },
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
