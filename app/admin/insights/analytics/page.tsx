'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { AdminOverview } from '@/types';
import { formatTokens } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';
import {
    Users, GraduationCap, BookOpen, AlertCircle, RefreshCw, BarChart2, Gauge,
    Sparkles, Clock, Layers, Wallet, ChevronRight, ArrowUpRight, Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// ── Palette ───────────────────────────────────────────────────────────────────
const VIOLET = '#7C3AED';
const AMBER = '#D97706';
const EMERALD = '#059669';
const SKY = '#0284C7';

// ── Data shapes ───────────────────────────────────────────────────────────────
interface FeeDivision { id: string; name: string; monthPaid: number; monthPending: number; overallPaid: number | null; overallPending: number | null; total: number; }
interface FeeStandard { id: string; name: string; divisions: FeeDivision[]; }
interface AttendanceDivision { id: string; name: string; overallPct: number | null; monthPct: number | null; total: number; }
interface AttendanceStandard { id: string; name: string; divisions: AttendanceDivision[]; }
type AnalyticsMode = 'overall' | 'monthly';
interface AiFeatureBreakdown { feature: string; requests: number; successRequests: number; failedRequests: number; totalTokens: number; }
interface AiTeacherUsage {
    teacherId: string; name: string; used: number; // used = tokens, in millions
    totalTokens: number; // raw, unscaled token count
    totalRequests: number; successRequests: number; failedRequests: number;
    byFeature: AiFeatureBreakdown[];
    isOverSoftLimit: boolean;
}

const AI_FEATURE_LABELS: Record<string, string> = {
    BLACKBOARD_CONTEXT: 'Document Analysis',
    BLACKBOARD_SCAN: 'AI Scan',
    BLACKBOARD_CHAT: 'AI Chat',
    BLACKBOARD_QUIZ: 'Quiz Generation',
    BLACKBOARD_MINDMAP: 'Mindmap Generation',
    TASK_QUESTION_GENERATION: 'Question Bank',
};
// Fixed color per feature (not by sort/render order) so e.g. AI Scan is
// always the same pink everywhere — admin analytics AND superadmin.
const AI_FEATURE_COLORS: Record<string, string> = {
    BLACKBOARD_CONTEXT: '#84CC16',
    BLACKBOARD_SCAN: '#DB2777',
    BLACKBOARD_CHAT: '#059669',
    BLACKBOARD_QUIZ: '#F59E0B',
    BLACKBOARD_MINDMAP: '#2563EB',
    TASK_QUESTION_GENERATION: '#0891B2',
};
const AI_FEATURE_COLOR_FALLBACK = '#64748B';
function featureColor(feature: string) {
    return AI_FEATURE_COLORS[feature] ?? AI_FEATURE_COLOR_FALLBACK;
}

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

// ── Attendance Accordion ──────────────────────────────────────────────────────
function getAttendanceColor(pct: number) {
    if (pct >= 75) return {
        bar: 'linear-gradient(90deg, #10B981, #34D399)',
        text: 'text-emerald-500',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
        dot: '#10B981',
        card: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/30',
    };
    if (pct >= 65) return {
        bar: 'linear-gradient(90deg, #F59E0B, #FBBF24)',
        text: 'text-amber-500',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
        dot: '#F59E0B',
        card: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/30',
    };
    return {
        bar: 'linear-gradient(90deg, #EF4444, #F87171)',
        text: 'text-red-500',
        badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
        dot: '#EF4444',
        card: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/30',
    };
}

function AttendanceAccordion({ data }: { data: AttendanceStandard[] }) {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<string | null>(data[0]?.id ?? null);
    const [mode, setMode] = useState<AnalyticsMode>('overall');

    if (data.length === 0) {
        return (
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden p-8 flex flex-col items-center justify-center text-center gap-2">
                <Users size={22} className="text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No classes set up yet</p>
            </div>
        );
    }

    const pctOf = (d: AttendanceDivision) => (mode === 'overall' ? d.overallPct : d.monthPct) ?? 0;

    const activeClass = data.find(s => s.id === expandedId) ?? data[0];

    const chartData = activeClass.divisions.map(d => ({
        name: d.name,
        attendance: pctOf(d),
    }));

    const divisionsWithData = data.flatMap(s => s.divisions).filter(d => (mode === 'overall' ? d.overallPct : d.monthPct) !== null);
    const overallPct = divisionsWithData.length > 0
        ? Math.round(divisionsWithData.reduce((a, d) => a + pctOf(d), 0) / divisionsWithData.length)
        : 0;
    const overallColor = getAttendanceColor(overallPct);

    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2 flex-wrap">
                <Users size={15} className="text-muted-foreground" />
                <p className="text-sm font-semibold">Attendance Analysis</p>
                <div className="ml-auto flex items-center gap-3">
                    <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
                        {(['overall', 'monthly'] as AnalyticsMode[]).map(m => (
                            <button key={m} onClick={() => setMode(m)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all ${mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                {m === 'overall' ? 'Overall' : 'This Month'}
                            </button>
                        ))}
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${overallColor.badge}`}>
                        {overallPct}% {mode === 'overall' ? 'overall' : 'this month'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 min-h-[360px]">

                {/* Left — Accordion */}
                <div className="lg:col-span-2 divide-y divide-border/30 overflow-y-auto max-h-[400px] border-b lg:border-b-0 lg:border-r border-border/40">
                    {data.map((std) => {
                        const isOpen = expandedId === std.id;
                        const stdDivisionsWithData = std.divisions.filter(d => (mode === 'overall' ? d.overallPct : d.monthPct) !== null);
                        const stdPct = stdDivisionsWithData.length > 0
                            ? Math.round(stdDivisionsWithData.reduce((a, d) => a + pctOf(d), 0) / stdDivisionsWithData.length)
                            : 0;
                        const stdColor = getAttendanceColor(stdPct);

                        return (
                            <div key={std.id}>
                                <button
                                    onClick={() => setExpandedId(isOpen ? null : std.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isOpen ? 'bg-muted/30' : 'hover:bg-muted/20'}`}>
                                    <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                                        <ChevronRight size={14} className="text-muted-foreground" />
                                    </div>
                                    <span className="text-sm font-semibold flex-1">{std.name}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${stdPct}%`, background: stdColor.bar }} />
                                        </div>
                                        <span className={`text-[11px] font-bold w-8 text-right ${stdColor.text}`}>
                                            {stdPct}%
                                        </span>
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                            {std.divisions.map((div) => {
                                                const rawPct = mode === 'overall' ? div.overallPct : div.monthPct;
                                                const divPct = rawPct ?? 0;
                                                const divColor = getAttendanceColor(divPct);
                                                return (
                                                    <div key={div.id}
                                                        className="flex items-center gap-3 px-8 py-2 bg-muted/20 border-t border-border/20 hover:bg-muted/40 transition-colors">
                                                        <span className="text-xs text-muted-foreground font-medium w-10 shrink-0">{div.name}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full transition-all duration-500"
                                                                    style={{ width: `${divPct}%`, background: divColor.bar }} />
                                                            </div>
                                                        </div>
                                                        <span className={`text-[11px] font-bold shrink-0 w-10 text-right ${divColor.text}`}>
                                                            {rawPct !== null ? `${divPct}%` : '—'}
                                                        </span>
                                                        <button
                                                            onClick={() => router.push(`/admin/campus/classes/${std.id}/${div.id}?tab=attendance`)}
                                                            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 hover:opacity-80 transition-all"
                                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                            <ArrowUpRight size={12} className="text-white" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>

                {/* Right — Line graph */}
                <div className="lg:col-span-3 p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-foreground">{activeClass.name}</p>
                            <p className="text-[11px] text-muted-foreground">Division-wise attendance · {mode === 'overall' ? 'Overall (session to date)' : 'This month'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0 border-t-2 border-dashed border-amber-400" />
                                <span className="text-[11px] text-muted-foreground">65%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0 border-t-2 border-dashed border-emerald-500" />
                                <span className="text-[11px] text-muted-foreground">75%</span>
                            </div>
                        </div>
                    </div>

                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted-foreground)', fontWeight: 500 }}
                                axisLine={false} tickLine={false} dy={8}
                                padding={{ left: 30, right: 30 }}
                            />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                axisLine={false} tickLine={false} domain={[50, 100]} unit="%" tickCount={6} />
                            <Tooltip
                                formatter={(v) => [`${v}%`, 'Attendance']}
                                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                                cursor={{ stroke: 'var(--border)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                            />
                            <ReferenceLine y={75} stroke="#10B981" strokeDasharray="5 4" strokeWidth={1.5} />
                            <ReferenceLine y={65} stroke="#F59E0B" strokeDasharray="5 4" strokeWidth={1.5} />
                            <Line
                                type="monotone" dataKey="attendance" name="Attendance"
                                stroke="#7C3AED" strokeWidth={2.5}
                                dot={(props: any) => {
                                    const { cx, cy } = props;
                                    return (
                                        <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={6}
                                            fill="#7C3AED" stroke="var(--card)" strokeWidth={2.5} />
                                    );
                                }}
                                activeDot={{ r: 8, stroke: 'var(--card)', strokeWidth: 2.5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    {/* Division summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {chartData.map((d) => {
                            const color = getAttendanceColor(d.attendance);
                            return (
                                <div key={d.name} className={`rounded-xl px-3 py-2 flex items-center justify-between border ${color.card}`}>
                                    <span className="text-xs font-semibold text-foreground">{d.name}</span>
                                    <span className={`text-xs font-bold ${color.text}`}>{d.attendance}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Fee Accordion ─────────────────────────────────────────────────────────────
function FeeAccordion({ data }: { data: FeeStandard[] }) {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<string | null>(data[0]?.id ?? null);
    const [mode, setMode] = useState<AnalyticsMode>('overall');

    if (data.length === 0) {
        return (
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden p-8 flex flex-col items-center justify-center text-center gap-2">
                <Wallet size={22} className="text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No fee structures set up yet</p>
            </div>
        );
    }

    const paidOf = (d: FeeDivision) => (mode === 'overall' ? d.overallPaid : d.monthPaid) ?? 0;
    const pendingOf = (d: FeeDivision) => (mode === 'overall' ? d.overallPending : d.monthPending) ?? 0;
    const hasData = (d: FeeDivision) => (mode === 'overall' ? d.overallPaid !== null : true);

    const divisionsWithData = data.flatMap(s => s.divisions).filter(hasData);
    const totalPaid = divisionsWithData.reduce((s, d) => s + paidOf(d), 0);
    const totalPending = divisionsWithData.reduce((s, d) => s + pendingOf(d), 0);
    const totalFees = totalPaid + totalPending;
    const collectedPct = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0;

    const donutData = [
        { name: 'Paid', value: totalPaid, color: '#10B981' },
        { name: 'Pending', value: totalPending, color: '#F59E0B' },
    ];

    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2 flex-wrap">
                <Wallet size={15} className="text-muted-foreground" />
                <p className="text-sm font-semibold">Fee Analysis</p>
                <div className="ml-auto flex items-center gap-3">
                    <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
                        {(['overall', 'monthly'] as AnalyticsMode[]).map(m => (
                            <button key={m} onClick={() => setMode(m)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all ${mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                {m === 'overall' ? 'Overall' : 'This Month'}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            {collectedPct}% paid
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            {100 - collectedPct}% pending
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5">
                {/* Donut */}
                <div className="lg:col-span-2 p-5 flex flex-col items-center justify-center gap-4 border-b lg:border-b-0 lg:border-r border-border/40">
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68}
                                dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                            </Pie>
                            <Tooltip
                                formatter={(v) => `${v as number} students`}
                                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full space-y-2">
                        {donutData.map((d) => (
                            <div key={d.name} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                                    <span className="text-muted-foreground">{d.name}</span>
                                </div>
                                <span className="font-semibold text-foreground">{d.value} students</span>
                            </div>
                        ))}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                            <span className="text-muted-foreground font-medium">Total</span>
                            <span className="font-bold text-foreground">{totalFees} students</span>
                        </div>
                    </div>
                </div>

                {/* Accordion */}
                <div className="lg:col-span-3 divide-y divide-border/30 max-h-[280px] overflow-y-auto">
                    {data.map((std) => {
                        const isOpen = expandedId === std.id;
                        const stdDivisionsWithData = std.divisions.filter(hasData);
                        const stdPaid = stdDivisionsWithData.reduce((s, d) => s + paidOf(d), 0);
                        const stdPending = stdDivisionsWithData.reduce((s, d) => s + pendingOf(d), 0);
                        const stdPct = (stdPaid + stdPending) > 0 ? Math.round((stdPaid / (stdPaid + stdPending)) * 100) : 0;

                        return (
                            <div key={std.id}>
                                <button onClick={() => setExpandedId(isOpen ? null : std.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
                                    <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                                        <ChevronRight size={14} className="text-muted-foreground" />
                                    </div>
                                    <span className="text-sm font-semibold flex-1">{std.name}</span>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-[11px] text-emerald-500 font-medium">{stdPaid} paid</span>
                                        <span className="text-muted-foreground/40 text-[10px]">·</span>
                                        <span className="text-[11px] text-amber-500 font-medium">{stdPending} pending</span>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${stdPct >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                            {stdPct}%
                                        </span>
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                            {std.divisions.map((div) => {
                                                const noData = !hasData(div);
                                                const paid = paidOf(div);
                                                const pending = pendingOf(div);
                                                const divPct = (paid + pending) > 0 ? Math.round((paid / (paid + pending)) * 100) : 0;
                                                return (
                                                    <div key={div.id} className="flex items-center gap-3 px-8 py-2.5 bg-muted/20 border-t border-border/20 hover:bg-muted/40 transition-colors">
                                                        <span className="text-xs text-muted-foreground font-medium w-10 shrink-0">{div.name}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full transition-all duration-500"
                                                                    style={{
                                                                        width: `${divPct}%`,
                                                                        background: divPct >= 80
                                                                            ? 'linear-gradient(90deg, #10B981, #34D399)'
                                                                            : 'linear-gradient(90deg, #F59E0B, #FBBF24)',
                                                                    }} />
                                                            </div>
                                                        </div>
                                                        {noData ? (
                                                            <span className="text-[11px] text-muted-foreground/60 italic shrink-0">No months due yet</span>
                                                        ) : (
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-[11px] text-emerald-500 font-medium">{paid} paid</span>
                                                                <span className="text-muted-foreground/40 text-[10px]">·</span>
                                                                <span className="text-[11px] text-amber-500 font-medium">{pending} pending</span>
                                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${divPct >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                                                    {divPct}%
                                                                </span>
                                                            </div>
                                                        )}
                                                        <button onClick={() => router.push(`/admin/campus/classes/${std.id}/${div.id}?tab=fees`)}
                                                            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 hover:opacity-80 transition-all"
                                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                            <ArrowUpRight size={12} className="text-white" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [teachers, setTeachers] = useState<{ status: string }[]>([]);
    const [attendanceData, setAttendanceData] = useState<AttendanceStandard[]>([]);
    const [feeData, setFeeData] = useState<FeeStandard[]>([]);
    const [aiTeachers, setAiTeachers] = useState<AiTeacherUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const { instType } = useMockInstType();
    const router = useRouter();
    const fetchedRef = useRef(false);

    const fetchAll = async () => {
        setLoading(true);
        setError(false);
        try {
            const [ovRes, teachRes, attRes, feeRes, aiRes] = await Promise.allSettled([
                api.get('/admin/overview'),
                api.get('/admin/teachers'),
                api.get('/admin/insights/attendance'),
                api.get('/admin/insights/fees'),
                api.get('/admin/insights/ai-usage'),
            ]);
            if (ovRes.status === 'fulfilled') setOverview(ovRes.value.data.data);
            else setError(true);
            if (teachRes.status === 'fulfilled') setTeachers(teachRes.value.data.data ?? []);
            if (attRes.status === 'fulfilled') setAttendanceData(attRes.value.data.data ?? []);
            if (feeRes.status === 'fulfilled') setFeeData(feeRes.value.data.data ?? []);
            if (aiRes.status === 'fulfilled') {
                const raw: (Omit<AiTeacherUsage, 'used'> & { used: number })[] = aiRes.value.data.data ?? [];
                setAiTeachers(raw.map(t => ({ ...t, used: t.used / 1_000_000 })));
            }
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                    </div>
                    <Skeleton className="h-full min-h-[240px] rounded-2xl" />
                </div>
                <Skeleton className="h-64 rounded-2xl" />
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
    const instLabel = instType === 'SCHOOL' ? 'School' : instType === 'COLLEGE' ? 'College' : 'Coaching';

    const institutionTokensUsed = plan.usage.aiTokens.used;
    const institutionTokensLimit = plan.usage.aiTokens.limit || 1;
    // Raw (unrounded) — the bar's width can round fine, but on a multi-million
    // token pool actual usage is often under 1%, and whole-percent rounding
    // collapsed that down to a misleading "0% used" (same issue the per-teacher
    // bars had before switching to decimal precision below 1%).
    const tokenPctRaw = Math.min(100, (institutionTokensUsed / institutionTokensLimit) * 100);
    const tokenPct = Math.round(tokenPctRaw);
    const tokenPctLabel = tokenPctRaw === 0 ? '0%' : tokenPctRaw < 1 ? `${tokenPctRaw.toFixed(2)}%` : `${tokenPct}%`;
    // aiTeachers now lists every teacher (zero-usage ones included, so the
    // "Per teacher" card always shows the full staff list with a 0% bar
    // instead of hiding anyone) — adoption must count only the ones who
    // actually made a request, not the list length.
    const activeAiTeachers = aiTeachers.filter(t => t.totalRequests > 0);
    const aiAdoptionPct = stats.totalTeachers > 0 ? Math.round((activeAiTeachers.length / stats.totalTeachers) * 100) : 0;

    // Institution-scoped feature breakdown — aggregated from this institution's
    // own teachers only (unlike superadmin's system/ai-usage page, which sums
    // this across every institution on the platform). Seeded with every known
    // feature at zero first so the "Usage by Feature" card always lists all
    // of them, not just whichever ones happen to have usage this month.
    const featureTotals = new Map<string, { totalTokens: number; requests: number }>(
        Object.keys(AI_FEATURE_LABELS).map(f => [f, { totalTokens: 0, requests: 0 }])
    );
    aiTeachers.forEach(t => t.byFeature.forEach(f => {
        const cur = featureTotals.get(f.feature) ?? { totalTokens: 0, requests: 0 };
        cur.totalTokens += f.totalTokens;
        cur.requests += f.requests;
        featureTotals.set(f.feature, cur);
    }));
    const featureBreakdown = Array.from(featureTotals.entries())
        .map(([feature, v]) => ({ feature, ...v }))
        .sort((a, b) => b.totalTokens - a.totalTokens);
    const featureGrandTotal = featureBreakdown.reduce((s, f) => s + f.totalTokens, 0) || 1;

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

            {/* ── Stat cards (2x3) + Plan Usage side card ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">

                {/* Stat cards, 3-up, 2 rows */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    <StatCard icon={Users} label="Total Users" value={stats.totalUsers}
                        iconBg="bg-violet-100 dark:bg-violet-950" iconColor="text-violet-600 dark:text-violet-400"
                        sub="∞ limit" />
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
                    <StatCard icon={Sparkles} label="AI Adoption" value={`${aiAdoptionPct}%`}
                        iconBg="bg-fuchsia-100 dark:bg-fuchsia-950" iconColor="text-fuchsia-600 dark:text-fuchsia-400"
                        sub={`${activeAiTeachers.length} of ${stats.totalTeachers} teachers used AI`} />
                </div>

                {/* Plan Usage — stretches to match the stat-card block's height */}
                <div className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col gap-4 h-full">
                    <div className="flex items-center gap-2 mb-1">
                        < Gauge size={15} className="text-muted-foreground" />
                        <p className="text-sm font-semibold">Plan Usage</p>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Current plan</p>
                            <p className="text-lg font-semibold">{plan.name}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${plan.isTrial ? 'bg-[#F59E0B]/15 text-[#F59E0B]' : plan.name.toUpperCase() === 'PRO' ? 'bg-[#DA7756]/15 text-[#DA7756]' : 'bg-violet-500/15 text-violet-500'}`}>
                            {plan.isTrial ? 'TRIAL' : plan.name.toUpperCase()}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {[
                            { label: 'Users', icon: Users, used: plan.usage.users.used, limit: plan.usage.users.limit },
                            { label: 'Storage (GB)', icon: Database, used: Math.round(plan.usage.storage.used / 1024 * 10) / 10, limit: plan.name.toUpperCase() === 'PRO' ? 1024 : 500 },
                        ].map((b) => {
                            const pct = Math.min(100, Math.round((b.used / b.limit) * 100));
                            const overLimit = b.used >= b.limit;
                            return (
                                <div key={b.label}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <b.icon size={13} className="text-muted-foreground shrink-0" />
                                            <span className="text-xs text-muted-foreground">{b.label}</span>
                                            {b.label === 'Users' && (
                                                <button
                                                    onClick={() => router.push('/admin/insights/users?from=analytics')}
                                                    className="w-5 h-5 rounded-md flex items-center justify-center hover:opacity-80 transition-all shrink-0"
                                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                    <ArrowUpRight size={11} className="text-white" />
                                                </button>
                                            )}
                                        </div>
                                        <span className="text-xs font-medium">
                                            {b.used.toLocaleString('en-IN')} <span className="text-muted-foreground">/ {b.label === 'Users' ? '∞' : b.limit.toLocaleString('en-IN')}</span>
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
            </div>

            {/* ── AI Usage — full width, split 60/40 with a separator ── */}
            <div className="bg-card border border-border/50 rounded-2xl p-5">
                <div className="flex flex-col lg:flex-row gap-5">

                    {/* Left 60% — all existing content */}
                    <div className="lg:w-[60%] flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles size={15} className="text-muted-foreground" />
                            <p className="text-sm font-semibold">AI Usage</p>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Institution token pool</p>
                                <p className="text-lg font-semibold">
                                    {formatTokens(institutionTokensUsed)}
                                    <span className="text-sm font-normal text-muted-foreground"> / {formatTokens(institutionTokensLimit)} tokens</span>
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
                                        width: `${tokenPctRaw}%`,
                                        minWidth: tokenPctRaw > 0 ? '3px' : 0,
                                        background: 'linear-gradient(90deg, #DA7756, #C06040)',
                                    }} />
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] text-muted-foreground">{tokenPctLabel} used</p>
                                <p className="text-[10px] text-muted-foreground">Shared institution pool</p>
                            </div>
                        </div>

                        {/* Per teacher — total bar + full feature breakdown.
                            Fixed height so this card doesn't keep growing as
                            more teachers/features get added — the list itself
                            scrolls instead. */}
                        <div className="flex flex-col min-h-0">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Per teacher <span className="normal-case font-normal">(this month)</span></p>
                            <div className="space-y-3 h-[250px] overflow-y-auto pr-1"
                                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                            {aiTeachers.length === 0 && (
                                <p className="text-[11px] text-muted-foreground/60 italic">No AI usage recorded yet</p>
                            )}
                            {aiTeachers.length > 0 && (() => {
                                // Bars are this teacher's share of the actual
                                // institution token pool (same denominator as
                                // the pool bar above) — previously this was
                                // relative to the heaviest user, which made
                                // whoever used the most always show a full bar
                                // regardless of how much of the pool was
                                // actually used.
                                // Same order as the "Usage by Feature" card on the right
                                // (institution-wide, sorted by tokens desc), so a feature
                                // sits in the same position in every teacher's list too.
                                const featureOrder = featureBreakdown.map(f => f.feature);
                                return aiTeachers.map((t) => {
                                    // Real, unrounded share of the pool — with a big pool
                                    // and modest per-teacher usage this is often well under
                                    // 1%, so rounding to a whole number (or worse, flooring
                                    // to a fixed minimum like "2%") made every light user
                                    // look identical. Bar width uses the exact value with a
                                    // pixel minWidth (not a % floor) just so a real sliver
                                    // of usage isn't literally invisible; the label shows
                                    // decimals when the value is small so teachers with
                                    // different usage still read as different.
                                    const usagePct = institutionTokensLimit > 0
                                        ? Math.min(100, (t.totalTokens / institutionTokensLimit) * 100)
                                        : 0;
                                    const usagePctLabel = usagePct === 0
                                        ? '0%'
                                        : usagePct < 1
                                            ? `${usagePct.toFixed(2)}%`
                                            : `${Math.round(usagePct)}%`;
                                    const orderedFeatures = [...t.byFeature].sort(
                                        (a, b) => featureOrder.indexOf(a.feature) - featureOrder.indexOf(b.feature)
                                    );
                                    return (
                                        <div key={t.teacherId} className="rounded-xl border border-border/40 bg-muted/10 p-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                                                    <span className="text-[10px] font-bold text-violet-500">
                                                        {t.name.split(' ').map(n => n[0]).join('')}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                                    <span className="text-[12px] font-semibold text-foreground truncate">{t.name}</span>
                                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{t.successRequests} ok</span>
                                                    {t.failedRequests > 0 && (
                                                        <span className="text-[10px] text-red-500">{t.failedRequests} failed</span>
                                                    )}
                                                    {t.isOverSoftLimit && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                                            Over limit
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[13px] font-bold text-foreground leading-none">{formatTokens(t.totalTokens)}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.totalRequests} requests</p>
                                                </div>
                                            </div>

                                            {/* Total usage bar — this teacher's share of the institution pool */}
                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2.5">
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{
                                                        width: `${usagePct}%`,
                                                        minWidth: usagePct > 0 ? '3px' : 0,
                                                        background: 'linear-gradient(90deg, #7C3AED, #A78BFA)',
                                                    }} />
                                            </div>
                                            <p className="text-[9.5px] text-muted-foreground mt-1">{usagePctLabel} of institution pool</p>

                                            {/* Feature-wise breakdown */}
                                            <div className="mt-2.5 pt-2.5 border-t border-border/30 space-y-1.5">
                                                {orderedFeatures.map((f) => {
                                                    const share = t.totalTokens > 0 ? Math.round((f.totalTokens / t.totalTokens) * 100) : 0;
                                                    const color = featureColor(f.feature);
                                                    return (
                                                        <div key={f.feature} className="flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                                                            <span className="text-[10.5px] text-foreground/80 w-[104px] shrink-0 truncate">
                                                                {AI_FEATURE_LABELS[f.feature] ?? f.feature}
                                                            </span>
                                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[24px]">
                                                                <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
                                                            </div>
                                                            <span className="text-[10px] font-medium text-foreground shrink-0 w-14 text-right">
                                                                {formatTokens(f.totalTokens)}
                                                            </span>
                                                            <span className="text-[9.5px] text-muted-foreground shrink-0 w-16 text-right">
                                                                {f.requests} req
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                            </div>
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="hidden lg:block w-px bg-border/60 self-stretch" />
                    <div className="lg:hidden h-px bg-border/60 w-full" />

                    {/* Right 40% — Usage by Feature, this institution only.
                        Same max-height + internal scroll as "Per teacher" on
                        the left, so a long feature list can't stretch the
                        whole card taller — it scrolls in place instead. */}
                    <div className="lg:w-[40%] flex flex-col gap-5 min-h-0">
                        <p className="text-sm font-semibold">Usage by Feature <span className="text-xs font-normal text-muted-foreground">(this month)</span></p>
                        {/* flex-1 instead of a fixed height — the left column has
                            extra header/pool-bar content above its own list, so
                            matching this to a fixed px value left the two boxes
                            starting at the same height but ending at different
                            points. Stretching this to fill the remaining column
                            height (set by the row's flex stretch) makes both
                            columns' bottoms land in the same place instead. */}
                        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                            {featureBreakdown.map((f) => {
                                const pct = Math.round((f.totalTokens / featureGrandTotal) * 100);
                                const color = featureColor(f.feature);
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
                            {featureBreakdown.length === 0 && (
                                <p className="text-xs text-muted-foreground">No AI usage recorded yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Fee Analysis ── */}
            <FeeAccordion data={feeData} />

            {/* ── Attendance Analysis ── */}
            <AttendanceAccordion data={attendanceData} />

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