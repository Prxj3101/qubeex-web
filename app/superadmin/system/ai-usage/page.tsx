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
interface MonthlyUsagePoint { month: string; totalTokens: number; limit: number; }
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
    BLACKBOARD_MINDMAP: 'Mindmap Generation',
    TASK_QUESTION_GENERATION: 'Question Bank',
    FEE_FORECAST: 'AI Forecast',
    ATTENDANCE_SUMMARY: 'AI Attendance Insight',
    SCHOOL_ASSISTANT: 'Jarvis',
};
// Fixed color per feature (not by sort/render order) so e.g. AI Scan is
// always the same pink everywhere — superadmin AND admin analytics.
const AI_FEATURE_COLORS: Record<string, string> = {
    BLACKBOARD_CONTEXT: '#84CC16',
    BLACKBOARD_SCAN: '#DB2777',
    BLACKBOARD_CHAT: '#DA7756',
    BLACKBOARD_QUIZ: '#059669',
    BLACKBOARD_MINDMAP: '#2563EB',
    TASK_QUESTION_GENERATION: '#0891B2',
    FEE_FORECAST: '#DA7756',
    ATTENDANCE_SUMMARY: '#DC2626',
    SCHOOL_ASSISTANT: '#F59E0B',
};
const AI_FEATURE_COLOR_FALLBACK = '#64748B';

// Image ranking (picking which retrieved images make it into a scan result)
// runs as part of the AI Scan pipeline and is billed under its own AiFeature
// on the backend purely for cost-tracking — merge it back into AI Scan here
// so it doesn't show up as a confusing extra row in "Usage by Feature".
function normalizeAiFeature(feature: string): string {
    return feature === 'BLACKBOARD_IMAGE_RANK' ? 'BLACKBOARD_SCAN' : feature;
}
function mergeFeatureBreakdown(map: Map<string, FeatureBreakdown>, f: FeatureBreakdown) {
    const key = normalizeAiFeature(f.feature);
    const cur = map.get(key) ?? { feature: key, requests: 0, successRequests: 0, failedRequests: 0, totalTokens: 0 };
    map.set(key, {
        feature: key,
        requests: cur.requests + f.requests,
        successRequests: cur.successRequests + f.successRequests,
        failedRequests: cur.failedRequests + f.failedRequests,
        totalTokens: cur.totalTokens + f.totalTokens,
    });
}

const DATE_FILTERS = ['7D', '1M', '3M', '6M', 'YTD'];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIUsagePage() {
    const [activeFilter, setActiveFilter] = useState('1M');
    const [expandedInst, setExpandedInst] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'tokens' | 'requests'>('tokens');
    const [usage, setUsage] = useState<PlatformAiUsage | null>(null);
    const [loading, setLoading] = useState(true);
    // Fetched lazily per-institution on first expand, not up front for every
    // row — this reuses the same per-institution ai-usage endpoint the
    // institution detail page already calls, which returns `monthly` (last
    // 5 calendar months, independent of the page's own date filter).
    const [monthlyByInst, setMonthlyByInst] = useState<Record<string, MonthlyUsagePoint[]>>({});
    const [loadingMonthly, setLoadingMonthly] = useState<Record<string, boolean>>({});
    // This-month "Usage by Feature" per institution — comes from the same
    // fetch as `monthly` above (range: '1M'), so `byFeature` here is already
    // scoped to the current calendar month, not the page's own date filter.
    const [byFeatureByInst, setByFeatureByInst] = useState<Record<string, FeatureBreakdown[]>>({});

    useEffect(() => {
        setLoading(true);
        api.get('/superadmin/system/ai-usage', { params: { range: activeFilter } })
            .then(res => setUsage(res.data.data))
            .catch(() => setUsage(null))
            .finally(() => setLoading(false));
    }, [activeFilter]);

    const toggleExpand = (institutionId: string) => {
        const next = expandedInst === institutionId ? null : institutionId;
        setExpandedInst(next);
        if (next && !monthlyByInst[next] && !loadingMonthly[next]) {
            setLoadingMonthly(prev => ({ ...prev, [next]: true }));
            api.get(`/superadmin/institutions/${next}/ai-usage`, { params: { range: '1M' } })
                .then(res => {
                    setMonthlyByInst(prev => ({ ...prev, [next]: res.data.data?.monthly ?? [] }));
                    setByFeatureByInst(prev => ({ ...prev, [next]: res.data.data?.byFeature ?? [] }));
                })
                .catch(() => {
                    setMonthlyByInst(prev => ({ ...prev, [next]: [] }));
                    setByFeatureByInst(prev => ({ ...prev, [next]: [] }));
                })
                .finally(() => setLoadingMonthly(prev => ({ ...prev, [next]: false })));
        }
    };

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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

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

                {/* Feature Split — every known feature is always listed (0% when
                    unused this range) rather than only ones with actual usage,
                    so the card reads as a fixed menu of features, not a list
                    that disappears when nothing's been used yet. */}
                <div className="lg:col-span-3 bg-card border border-border/50 rounded-2xl p-5 flex flex-col gap-5">
                    <p className="text-sm font-semibold">Usage by Feature</p>
                    {(() => {
                        const byFeatureMap = new Map(Object.keys(AI_FEATURE_LABELS).map(f => [f, { feature: f, requests: 0, successRequests: 0, failedRequests: 0, totalTokens: 0 }]));
                        (usage?.byFeature ?? []).forEach(f => mergeFeatureBreakdown(byFeatureMap, f));
                        const rows = Array.from(byFeatureMap.values()).sort((a, b) => b.totalTokens - a.totalTokens);
                        const total = rows.reduce((s, x) => s + x.totalTokens, 0) || 1;
                        // Split into two columns — first half left, second half
                        // right — so as new features get added to the feature
                        // list over time, they land in the right column and the
                        // left stays roughly where it is instead of the whole
                        // list just growing taller as one long stack.
                        const half = Math.ceil(rows.length / 2);
                        const columns = [rows.slice(0, half), rows.slice(half)];
                        const renderRow = (f: typeof rows[number]) => {
                            const pct = Math.round((f.totalTokens / total) * 100);
                            const color = AI_FEATURE_COLORS[f.feature] ?? AI_FEATURE_COLOR_FALLBACK;
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
                                        <span className="text-[10px] text-muted-foreground">
                                            {f.requests > 0 ? formatTokens(Math.round(f.totalTokens / f.requests)) : '0'} avg/req
                                        </span>
                                    </div>
                                </div>
                            );
                        };
                        return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-4">{columns[0].map(renderRow)}</div>
                                <div className="space-y-4">{columns[1].map(renderRow)}</div>
                            </div>
                        );
                    })()}
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
                                    onClick={() => toggleExpand(inst.institutionId)}
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

                                        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                                            {/* Monthly usage — last 5 calendar months, independent of
                                                the page's date filter above (that filter only affects
                                                the platform-wide summary/trend, not this). */}
                                            <div className="p-3 bg-card rounded-xl border border-border/50">
                                                <p className="text-[10px] text-muted-foreground mb-2">Monthly usage (last 5 months)</p>
                                                {loadingMonthly[inst.institutionId] && (
                                                    <p className="text-[11px] text-muted-foreground italic">Loading…</p>
                                                )}
                                                {!loadingMonthly[inst.institutionId] && (monthlyByInst[inst.institutionId]?.length ?? 0) === 0 && (
                                                    <p className="text-[11px] text-muted-foreground italic">No usage recorded yet</p>
                                                )}
                                                {!loadingMonthly[inst.institutionId] && (monthlyByInst[inst.institutionId]?.length ?? 0) > 0 && (
                                                    <div className="space-y-2">
                                                        {monthlyByInst[inst.institutionId].map((m) => {
                                                            const pct = m.limit > 0 ? Math.min(100, Math.round((m.totalTokens / m.limit) * 100)) : 0;
                                                            const label = new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                                                            return (
                                                                <div key={m.month}>
                                                                    <div className="flex items-center justify-between text-[11px] mb-1">
                                                                        <span className="text-muted-foreground">{label}</span>
                                                                        <span className="font-semibold">
                                                                            {formatTokens(m.totalTokens)} / {formatTokens(m.limit)} ({pct}%)
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full rounded-full"
                                                                            style={{
                                                                                width: `${pct}%`,
                                                                                background: pct > 85 ? '#ef4444' : pct > 70 ? '#f59e0b' : 'var(--primary)',
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Usage by Feature — this calendar month for this
                                                institution only (same fetch, range '1M'). Every
                                                known feature is listed even at 0%, matching the
                                                platform-wide panel above. */}
                                            <div className="p-3 bg-card rounded-xl border border-border/50">
                                                <p className="text-[10px] text-muted-foreground mb-2">Usage by feature (this month)</p>
                                                {loadingMonthly[inst.institutionId] && (
                                                    <p className="text-[11px] text-muted-foreground italic">Loading…</p>
                                                )}
                                                {!loadingMonthly[inst.institutionId] && (() => {
                                                    const byFeatureMap = new Map(Object.keys(AI_FEATURE_LABELS).map(f => [f, { feature: f, requests: 0, successRequests: 0, failedRequests: 0, totalTokens: 0 }]));
                                                    (byFeatureByInst[inst.institutionId] ?? []).forEach(f => mergeFeatureBreakdown(byFeatureMap, f));
                                                    const rows = Array.from(byFeatureMap.values()).sort((a, b) => b.totalTokens - a.totalTokens);
                                                    const total = rows.reduce((s, x) => s + x.totalTokens, 0) || 1;
                                                    return (
                                                        <div className="space-y-2">
                                                            {rows.map((f) => {
                                                                const pct = Math.round((f.totalTokens / total) * 100);
                                                                const color = AI_FEATURE_COLORS[f.feature] ?? AI_FEATURE_COLOR_FALLBACK;
                                                                return (
                                                                    <div key={f.feature}>
                                                                        <div className="flex items-center justify-between text-[11px] mb-1">
                                                                            <span className="text-muted-foreground truncate">{AI_FEATURE_LABELS[f.feature] ?? f.feature}</span>
                                                                            <span className="font-semibold" style={{ color }}>{formatTokens(f.totalTokens)} ({pct}%)</span>
                                                                        </div>
                                                                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
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
