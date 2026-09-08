'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import api from '@/lib/api';
import type { AdminOverview } from '@/types';
import { formatTokens } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, ReferenceLine, AreaChart, Area } from 'recharts';
import {
    Users, GraduationCap, BookOpen, AlertCircle, RefreshCw, BarChart2, Gauge,
    Sparkles, Clock, Layers, Wallet, ChevronRight, ArrowUpRight, Database, Info, X, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import AiSchoolPA from '../AiSchoolPA';

// Fires once, the first time the referenced element scrolls into the
// viewport, and then stays true — used to defer chart-entrance animations
// (the AI forecast graph, the fee pie chart, the health-score gauge needle)
// until the card is actually visible, instead of all of them animating
// immediately on page load while still off-screen below the fold.
function useInViewOnce<T extends HTMLElement>(threshold = 0.15) {
    const ref = useRef<T | null>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        if (inView) return;
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setInView(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [inView, threshold]);
    return { ref, inView };
}

// ── Palette ───────────────────────────────────────────────────────────────────
const VIOLET = '#7C3AED';
const AMBER = '#D97706';
const EMERALD = '#059669';
const SKY = '#0284C7';

// ── Data shapes ───────────────────────────────────────────────────────────────
interface FeeDivision { id: string; name: string; monthPaid: number; monthPending: number; overallPaid: number | null; overallPending: number | null; total: number; }
interface FeeStandard { id: string; name: string; divisions: FeeDivision[]; }
interface FeeForecastPoint { month: string; rate: number; projected?: boolean; }
interface FeePeerBenchmark { percentile: number; peerCount: number; bucketLabel: 'small' | 'medium' | 'large'; }
interface FeeForecastRange { low: number; high: number; }
interface FeeAiInsights {
    healthScore: number;
    healthLabel: string;
    monthlyRate: number;
    overallRate: number;
    forecast: FeeForecastPoint[];
    forecastRange: FeeForecastRange | null;
    forecastInsight: string | null;
    isAiGenerated: boolean;
    peerBenchmark: FeePeerBenchmark | null;
}
interface AttendanceDivision { id: string; name: string; overallPct: number | null; monthPct: number | null; total: number; }
interface AttendanceStandard { id: string; name: string; divisions: AttendanceDivision[]; }
interface AttendanceStreakAlert { studentId: string; name: string; avatarUrl: string | null; standardId: string; divisionId: string; divisionName: string; streakLength: number; }
interface AttendanceAiInsights {
    streaks: AttendanceStreakAlert[];
    aiSummary: string | null;
    isAiGenerated: boolean;
}
interface DisengagedFamily {
    studentId: string;
    studentCode: string;
    name: string;
    avatarUrl: string | null;
    standardId: string;
    divisionId: string;
    divisionName: string;
    daysSinceLastOpen: number | null; // null = never opened Parent Mode
}
type AnalyticsMode = 'overall' | 'monthly';
interface AiFeatureBreakdown { feature: string; requests: number; successRequests: number; failedRequests: number; totalTokens: number; }
interface AiTeacherUsage {
    teacherId: string; name: string; avatarUrl: string | null; used: number; // used = tokens, in millions
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
    SCHOOL_ASSISTANT: 'Jarvis',
    OTHERS: 'Others',
};
// Fixed color per feature (not by sort/render order) so e.g. AI Scan is
// always the same pink everywhere — admin analytics AND superadmin.
const AI_FEATURE_COLORS: Record<string, string> = {
    BLACKBOARD_CONTEXT: '#84CC16',
    BLACKBOARD_SCAN: '#DB2777',
    BLACKBOARD_CHAT: '#DA7756',
    BLACKBOARD_QUIZ: '#059669',
    BLACKBOARD_MINDMAP: '#2563EB',
    TASK_QUESTION_GENERATION: '#0891B2',
    SCHOOL_ASSISTANT: '#F59E0B',
    OTHERS: '#64748B',
};
const AI_FEATURE_COLOR_FALLBACK = '#64748B';
// Features shown as their own bar in "Usage by Feature" — anything else
// (e.g. FEE_FORECAST, and any new small feature added later) gets folded
// into a single "Others" bucket instead of getting its own bar. Keeps the
// card from accumulating a long tail of one-off features over time.
const MAIN_AI_FEATURES = new Set(
    ['BLACKBOARD_CONTEXT', 'BLACKBOARD_SCAN', 'BLACKBOARD_CHAT', 'BLACKBOARD_QUIZ', 'BLACKBOARD_MINDMAP', 'TASK_QUESTION_GENERATION', 'SCHOOL_ASSISTANT']
);
// Friendly names for whatever ends up folded into "Others" — add new small
// features here as they're introduced so the tooltip stays readable instead
// of showing raw backend feature keys.
const OTHER_FEATURE_LABELS: Record<string, string> = {
    FEE_FORECAST: 'AI Fee Analysis',
    ATTENDANCE_SUMMARY: 'AI Attendance Analysis',
};
function featureColor(feature: string) {
    return AI_FEATURE_COLORS[feature] ?? AI_FEATURE_COLOR_FALLBACK;
}
// Image ranking (picking which retrieved images make it into a scan result)
// runs as part of the AI Scan pipeline and is billed under its own AiFeature
// purely for backend cost-tracking — fold it into AI Scan wherever a raw
// byFeature breakdown is rendered, so it never shows up as its own row.
function mergeImageRankIntoScan(byFeature: AiFeatureBreakdown[]): AiFeatureBreakdown[] {
    const merged = new Map<string, AiFeatureBreakdown>();
    byFeature.forEach(f => {
        const key = f.feature === 'BLACKBOARD_IMAGE_RANK' ? 'BLACKBOARD_SCAN' : f.feature;
        const cur = merged.get(key) ?? { feature: key, requests: 0, successRequests: 0, failedRequests: 0, totalTokens: 0 };
        merged.set(key, {
            feature: key,
            requests: cur.requests + f.requests,
            successRequests: cur.successRequests + f.successRequests,
            failedRequests: cur.failedRequests + f.failedRequests,
            totalTokens: cur.totalTokens + f.totalTokens,
        });
    });
    return Array.from(merged.values());
}

// ── CIBIL-style semicircle gauge helpers (used by the AI Fee Health Score) ──
// Angle convention: 0 = 3 o'clock, 90 = 12 o'clock, 180 = 9 o'clock (standard
// math angles), converted to SVG screen coords with y flipped since SVG y
// grows downward. Score 0 sits at the 9 o'clock (180°) end of the dial and
// score 100 sits at the 3 o'clock (0°) end, sweeping across the top.
function gaugeAngleForScore(score: number): number {
    return 180 - (Math.max(0, Math.min(100, score)) / 100) * 180;
}
function gaugePolar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}
// Path for one colored band of the dial, from score p1 to p2, as a filled
// donut-slice between rInner and rOuter.
function gaugeBandPath(cx: number, cy: number, rOuter: number, rInner: number, p1: number, p2: number): string {
    const a1 = gaugeAngleForScore(p1);
    const a2 = gaugeAngleForScore(p2);
    const outerStart = gaugePolar(cx, cy, rOuter, a1);
    const outerEnd = gaugePolar(cx, cy, rOuter, a2);
    const innerEnd = gaugePolar(cx, cy, rInner, a2);
    const innerStart = gaugePolar(cx, cy, rInner, a1);
    return `M ${outerStart.x} ${outerStart.y} A ${rOuter} ${rOuter} 0 0 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${rInner} ${rInner} 0 0 0 ${innerStart.x} ${innerStart.y} Z`;
}
// A single stroke-only arc (no radial sides) at a fixed radius, from score p1
// to p2 — used to draw a crisp dark rim along a band's outer curve and a
// crisp light rim along its inner curve, which reads much more like an
// engraved groove than shading the whole fill does.
function gaugeArcLine(cx: number, cy: number, r: number, p1: number, p2: number): string {
    const a1 = gaugeAngleForScore(p1);
    const a2 = gaugeAngleForScore(p2);
    const start = gaugePolar(cx, cy, r, a1);
    const end = gaugePolar(cx, cy, r, a2);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
}

// CIBIL-style speedometer for the AI Fee Health Score — a Poor→Excellent
// colored dial with a needle that sweeps in from zero to the current score
// on mount, instead of snapping straight to its final position.
const FEE_GAUGE_ZONES = [
    { from: 0, to: 20, color: '#F04E37' },
    { from: 20, to: 40, color: '#F7931E' },
    { from: 40, to: 60, color: '#FDC70C' },
    { from: 60, to: 80, color: '#8DC63F' },
    { from: 80, to: 100, color: '#39B54A' },
];
function FeeHealthGauge({ score }: { score: number }) {
    const [displayScore, setDisplayScore] = useState(0);
    useEffect(() => {
        // rAF (not a same-tick setState) so the browser paints the needle at 0
        // first, then transitions to the real score — otherwise the very first
        // render already shows the final angle and there's nothing to animate.
        const id = requestAnimationFrame(() => setDisplayScore(score));
        return () => cancelAnimationFrame(id);
    }, [score]);

    const cx = 100, cy = 92, rOuter = 85, rInner = 62;
    // Needle geometry is built once at the "score 0" angle (pointing at the
    // dial's left end) and then rotated with a CSS transition — rotating a
    // fixed shape animates far more smoothly than recomputing new points
    // every frame.
    const baseAngle = 180;
    const needleTip = gaugePolar(cx, cy, rInner - 4, baseAngle);
    const baseR = 7;
    const base1 = gaugePolar(cx, cy, baseR, baseAngle + 90);
    const base2 = gaugePolar(cx, cy, baseR, baseAngle - 90);
    const rotation = 180 - gaugeAngleForScore(displayScore);

    return (
        <div className="relative w-[190px] h-[128px]">
            <svg viewBox="0 0 200 128" className="w-full h-full overflow-visible">
                <defs>
                    {/* Same "dug into the surface" recipe as the landing page's
                        pill labels (see Modules.tsx: inset dark shadow on one
                        side + a thin bright rim on the other) — just built as a
                        linear gradient running from the band's outer edge (dark,
                        like the inset shadow) to its inner edge (light, like the
                        rim catching light), since a real inset box-shadow can't
                        be applied to an SVG path. The gradient direction is
                        computed per band along that band's own radial line, so
                        it stays "outer→inner" no matter where on the dial the
                        band sits. */}
                    {FEE_GAUGE_ZONES.map((z, i) => {
                        const gapPad = 1.4;
                        const from = i === 0 ? z.from : z.from + gapPad;
                        const to = i === FEE_GAUGE_ZONES.length - 1 ? z.to : z.to - gapPad;
                        const midAngle = gaugeAngleForScore((from + to) / 2);
                        const outerPt = gaugePolar(cx, cy, rOuter, midAngle);
                        const innerPt = gaugePolar(cx, cy, rInner, midAngle);
                        return (
                            <linearGradient key={i} id={`gaugeZoneGrad-${i}`} gradientUnits="userSpaceOnUse"
                                x1={outerPt.x} y1={outerPt.y} x2={innerPt.x} y2={innerPt.y}>
                                <stop offset="0%" stopColor={shadeColor(z.color, -22)} />
                                <stop offset="22%" stopColor={z.color} />
                                <stop offset="80%" stopColor={z.color} />
                                <stop offset="100%" stopColor={shadeColor(z.color, 16)} />
                            </linearGradient>
                        );
                    })}
                </defs>
                {FEE_GAUGE_ZONES.map((z, i) => {
                    // Small angular gap between bands (skip at the two outer
                    // ends of the dial, so the arc still spans the full 180°).
                    const gapPad = 1.4;
                    const from = i === 0 ? z.from : z.from + gapPad;
                    const to = i === FEE_GAUGE_ZONES.length - 1 ? z.to : z.to - gapPad;
                    // Same recipe as the landing-page pill (Modules.tsx), adapted
                    // to a closed 4-sided shape: a slightly larger dark "shadow"
                    // copy sits behind the pill so a rim peeks out on all four
                    // sides (both arcs and both cut ends, not just outer/inner),
                    // then a slightly smaller light stroke sits on top near the
                    // inner edge — engraved on every side, not just top/bottom.
                    const angleGrow = 0.5;
                    const shadowFrom = Math.max(0, from - angleGrow);
                    const shadowTo = Math.min(100, to + angleGrow);
                    return (
                        <g key={i}>
                            <path d={gaugeBandPath(cx, cy, rOuter + 1, rInner - 1, shadowFrom, shadowTo)} fill={shadeColor(z.color, -55)} opacity={0.35} />
                            <path d={gaugeBandPath(cx, cy, rOuter, rInner, from, to)} fill={`url(#gaugeZoneGrad-${i})`} />
                            <path d={gaugeBandPath(cx, cy, rOuter - 3, rInner + 3, from + 0.6, to - 0.6)} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={0.75} />
                        </g>
                    );
                })}
                <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }}>
                    <polygon points={`${base1.x},${base1.y} ${base2.x},${base2.y} ${needleTip.x},${needleTip.y}`} fill="var(--gauge-ink)" />
                </g>
                <circle cx={cx} cy={cy} r={9} fill="var(--gauge-ink)" stroke="var(--card)" strokeWidth={2.5} />
                <text x={cx} y={cy + 30} textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--gauge-ink)">
                    {Math.round(displayScore)}
                </text>
            </svg>
        </div>
    );
}

// Lightens (positive percent) or darkens (negative percent) a hex color —
// used to fake a 3D/glossy look on the fee-status donut (a lit highlight on
// top of each slice, a darker "extruded base" layer underneath) without
// pulling in a real 3D charting library.
function shadeColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    const R = clamp((num >> 16) + amt);
    const G = clamp(((num >> 8) & 0x00ff) + amt);
    const B = clamp((num & 0x0000ff) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
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
// Small avatar helpers for the streak-alert cards — same idea as the
// initials/color helpers used on the teacher division page, kept local here
// since this file doesn't otherwise import from that page.
const STREAK_AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB'];
function streakInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function streakAvatarColor(name: string) {
    return STREAK_AVATAR_COLORS[name.charCodeAt(0) % STREAK_AVATAR_COLORS.length];
}

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

function AttendanceAccordion({ data, ai }: { data: AttendanceStandard[]; ai: AttendanceAiInsights | null }) {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<string | null>(data[0]?.id ?? null);
    const [mode, setMode] = useState<AnalyticsMode>('monthly');

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

            <div className="mx-5 mt-3 mb-3 flex flex-col lg:flex-row gap-6 items-stretch">
                <div className="rounded-2xl p-2.5 lg:flex-1 bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles size={16} style={{ color: '#DA7756' }} />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Attendance Insight</p>
                    </div>
                    {ai?.aiSummary ? (
                        <p className="text-xs font-medium text-foreground leading-snug">{ai.aiSummary}</p>
                    ) : (
                        <p className="text-xs text-muted-foreground/70 leading-snug">Nothing to flag right now — check back after more attendance is marked.</p>
                    )}
                </div>

                <div className="min-w-0 flex-1 rounded-2xl p-2.5 bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles size={16} className="text-red-500" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Absence Detection</p>
                    </div>
                    {ai && ai.streaks.length > 0 ? (
                        <>
                            <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                </span>
                                Needs attention · {ai.streaks.length} student{ai.streaks.length === 1 ? '' : 's'} on an absence streak
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(239,68,68,0.2) transparent', WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}>
                                {ai.streaks.map((s) => (
                                    <button key={s.studentId}
                                        onClick={() => router.push(`/admin/campus/classes/${s.standardId}/${s.divisionId}?tab=attendance`)}
                                        className="shrink-0 flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-xl border border-red-200/70 dark:border-red-900/40 bg-card hover:border-red-300 transition-colors text-left"
                                        style={{ minWidth: 172, willChange: 'scroll-position' }}>
                                        <div className="relative shrink-0">
                                            {s.avatarUrl ? (
                                                <div className="relative w-8 h-8 rounded-full overflow-hidden">
                                                    <NextImage src={s.avatarUrl} alt={s.name} fill sizes="64px" quality={100} className="object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                                    style={{ background: streakAvatarColor(s.name) }}>
                                                    {streakInitials(s.name)}
                                                </div>
                                            )}
                                            <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2"
                                                style={{ borderColor: 'var(--card)' }}>
                                                {s.streakLength}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11.5px] font-semibold truncate">{s.name}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{s.divisionName} · {s.streakLength}d absent</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground/70 leading-snug">No students currently on an absence streak — all clear.</p>
                    )}
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
function FeeAccordion({ data, ai }: { data: FeeStandard[]; ai: FeeAiInsights | null }) {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<string | null>(data[0]?.id ?? null);
    const [mode, setMode] = useState<AnalyticsMode>('monthly');
    const { ref: cardRef, inView } = useInViewOnce<HTMLDivElement>(0.15);

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
    // Both "Overall" and "This Month" are per-student classifications now
    // (backend: getFeeInsights in insights.controller.ts) — "Overall" counts
    // a student as paid only if they've cleared every previous due month, so
    // the total always matches the division's student count either way.
    const feeUnitLabel = 'students';

    return (
        <div ref={cardRef} className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2 flex-wrap">
                <Wallet size={15} className="text-muted-foreground" />
                <p className="text-sm font-semibold">Fee Analysis</p>
                <div className="ml-auto flex items-center gap-3">
                    <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
                        {(['overall', 'monthly'] as AnalyticsMode[]).map(m => (
                            <button key={m} onClick={() => setMode(m)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all ${mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                {m === 'overall' ? 'Previous Months' : 'This Month'}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {ai?.peerBenchmark && (
                            <span
                                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                                style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
                                title={`Compared against ${ai.peerBenchmark.peerCount} similar-size schools on QubeEx`}
                            >
                                <Sparkles size={10} />
                                Top {100 - ai.peerBenchmark.percentile}% of similar schools
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-20 lg:h-[380px]">
                {/* Column 1 (35%): Forecast graph (Health Score moved to column 2, above the pie chart) */}
                <div className="lg:col-span-7 p-5 flex flex-col items-center gap-3 border-b lg:border-b-0 lg:border-r border-border/40 lg:overflow-y-auto">
                    {ai ? (
                        <>
                            {/* AI Collection Forecast — actual trend (solid) with one
                                projected next-month point (dashed) extrapolated from the
                                recent month-over-month trend. */}
                            {ai.forecast.length >= 2 && (() => {
                                // The band around the projected point comes from the AI's own
                                // low/high range when it actually generated one (isAiGenerated) —
                                // a real model call reasoning about how volatile the trend looks.
                                // Only falls back to a fixed ±3% when the AI call wasn't available
                                // (see generateAiFeeForecast in feeInsights.service.ts).
                                const lastActualIdx = ai.forecast.findLastIndex(p => !p.projected);
                                const actualPoints = ai.forecast.filter(p => !p.projected);
                                const avgRate = actualPoints.length > 0
                                    ? actualPoints.reduce((s, p) => s + p.rate, 0) / actualPoints.length
                                    : null;
                                const chartData = ai.forecast.map((p, i) => {
                                    const isLastActual = i === lastActualIdx;
                                    const band = p.projected
                                        ? (ai.forecastRange
                                            ? [ai.forecastRange.low, ai.forecastRange.high]
                                            : [Math.max(0, p.rate - 3), Math.min(100, p.rate + 3)])
                                        : isLastActual ? [p.rate, p.rate] : null;
                                    return {
                                        month: p.month,
                                        actual: p.projected ? null : p.rate,
                                        projected: p.projected || isLastActual ? p.rate : null,
                                        // Explicit flag — separate from the "projected" Y-value field above,
                                        // which is truthy at the last-actual point too (needed to draw the
                                        // connecting line segment) and would otherwise be mistaken for the
                                        // forecasted point itself.
                                        isForecastPoint: !!p.projected,
                                        band,
                                    };
                                });

                                const valueLabel = (props: any) => {
                                    const { x, y, value, index } = props;
                                    if (value === null || value === undefined || x === undefined || y === undefined) return <g key={index} />;
                                    return (
                                        <text key={index} x={x} y={y - 10} textAnchor="middle" fontSize={9} fontWeight={700} fill="#0D9488">
                                            {Math.round(value)}%
                                        </text>
                                    );
                                };

                                const projectedDot = (props: any) => {
                                    const { cx, cy, payload, index } = props;
                                    if (cx === undefined || cy === undefined) return <g key={index} />;
                                    if (!payload?.isForecastPoint) {
                                        return <circle key={index} cx={cx} cy={cy} r={3} fill="#0D9488" />;
                                    }
                                    // The forecasted month is shown as a range (low–high), not a single
                                    // number — a single figure overstates how precise a projection can be.
                                    // Cyan (a lighter cousin of the teal theme) picks the prediction out
                                    // without leaving the teal palette.
                                    const band = Array.isArray(payload.band) ? payload.band : null;
                                    const rangeLabel = band ? `${Math.round(band[0])}-${Math.round(band[1])}%` : null;
                                    return (
                                        <g key={index}>
                                            <circle cx={cx} cy={cy} r={6} fill="#06B6D4" opacity={0.3}>
                                                <animate attributeName="r" values="6;13;6" dur="1.8s" repeatCount="indefinite" />
                                                <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite" />
                                            </circle>
                                            <circle cx={cx} cy={cy} r={4.5} fill="#fff" stroke="#06B6D4" strokeWidth={2.5} />
                                            {rangeLabel !== null && (
                                                <text x={cx} y={cy - 12} textAnchor="middle" fontSize={9} fontWeight={700} fill="#0E7490">{rangeLabel}</text>
                                            )}
                                            <rect x={cx + 7} y={cy + 6} width={15} height={11} rx={3} fill="#06B6D4" />
                                            <text x={cx + 14.5} y={cy + 14.5} textAnchor="middle" fontSize={7} fontWeight={700} fill="#fff">AI</text>
                                        </g>
                                    );
                                };

                                return (
                                    <div className="w-full">
                                        <div className="flex items-center gap-1.5 mb-5 -mt-2">
                                            <Sparkles size={16} className="text-teal-500" />
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Forecast</p>
                                        </div>
                                        {inView ? (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <AreaChart data={chartData} margin={{ top: 22, right: 6, left: -28, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="feeForecastActualFill" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.35} />
                                                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                                                    </linearGradient>
                                                    {/* Cyan spotlight on the projected segment, still within the
                                                        teal family, so the whole graph reads as one cohesive theme. */}
                                                    <linearGradient id="feeForecastProjectedFill" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                                                <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickFormatter={(m: string) => m.slice(0, 3)} />
                                                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `${v}%`} />
                                                {avgRate !== null && (
                                                    <ReferenceLine
                                                        y={avgRate}
                                                        stroke="var(--muted-foreground)"
                                                        strokeDasharray="4 3"
                                                        strokeOpacity={0.6}
                                                        label={{ value: `Avg ${Math.round(avgRate)}%`, position: 'insideTopRight', fontSize: 9, fill: 'var(--muted-foreground)' }}
                                                    />
                                                )}
                                                <Tooltip
                                                    content={({ active, payload, label }: any) => {
                                                        if (!active || !payload?.length) return null;
                                                        const entry = payload.find((p: any) => (p.dataKey === 'actual' || p.dataKey === 'projected') && p.value !== null);
                                                        if (!entry) return null;
                                                        const row = entry.payload;
                                                        const band = row?.isForecastPoint && Array.isArray(row.band) ? row.band : null;
                                                        return (
                                                            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, padding: '6px 10px' }}>
                                                                <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
                                                                <p style={{ margin: 0, color: band ? '#0E7490' : '#0D9488' }}>
                                                                    {band
                                                                        ? `${Math.round(band[0])}-${Math.round(band[1])}% (projected range)`
                                                                        : `${Math.round(entry.value)}%`}
                                                                </p>
                                                            </div>
                                                        );
                                                    }}
                                                />
                                                <Area dataKey="band" stroke="none" fill="#06B6D4" fillOpacity={0.15} connectNulls isAnimationActive={false} legendType="none" />
                                                <Area type="monotone" dataKey="actual" stroke="#0D9488" strokeWidth={2.5} fill="url(#feeForecastActualFill)" dot={{ r: 3, fill: '#0D9488', strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls={false} label={valueLabel} />
                                                <Area type="monotone" dataKey="projected" stroke="#06B6D4" strokeWidth={2.25} strokeDasharray="5 4" fill="url(#feeForecastProjectedFill)" dot={projectedDot} activeDot={{ r: 5 }} connectNulls />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                        ) : (
                                            <div style={{ height: 280 }} />
                                        )}
                                        <p className="text-[9px] text-muted-foreground/70 mt-1 text-center leading-tight">
                                            {ai.forecastInsight
                                                ? ai.forecastInsight
                                                : `${ai.forecast[ai.forecast.length - 1].month} (dashed, glowing "AI" point) is a statistical estimate — the AI model wasn't available for this prediction.`}
                                        </p>
                                    </div>
                                );
                            })()}
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground/60 italic py-8">AI insights unavailable</p>
                    )}
                </div>

                {/* Column 2 (25%): AI Health Score (moved here from column 1) + Pie chart */}
                <div className="lg:col-span-5 pl-2 pr-5 pt-2 pb-5 flex flex-col items-center gap-4 border-b lg:border-b-0 lg:border-r border-border/40 lg:overflow-y-auto">
                    {ai && (
                        <div className="w-full flex flex-col items-center gap-1">
                            {inView ? <FeeHealthGauge score={ai.healthScore} /> : <div className="w-[190px] h-[128px]" />}
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                <Sparkles size={11} className="text-muted-foreground" />
                                AI Fee Health Score
                                <span className="relative inline-flex group">
                                    <Info size={11} className="text-muted-foreground/60" />
                                    <span
                                        className="pointer-events-none absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-48 whitespace-normal z-20 px-2 py-1.5 rounded-lg text-[10px] font-medium normal-case leading-snug shadow-lg"
                                        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                                    >
                                        A 0-100 score blending this month&apos;s collection rate, overall pending dues, and the recent trend
                                    </span>
                                </span>
                            </p>
                            <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    ai.healthScore >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                    : ai.healthScore >= 60 ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400'
                                    : ai.healthScore >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                }`}
                            >
                                {ai.healthLabel}
                            </span>
                        </div>
                    )}
                    <div className="w-full flex flex-row items-center justify-center gap-4">
                    {/* CSS drop-shadow on the wrapper (not an SVG <filter> prop on
                        <Pie>, which recharts doesn't forward to the sectors) —
                        this is what actually renders reliably, and stays glued
                        to the shape since it's a real CSS filter on its box.
                        The chart itself only mounts once the card has scrolled
                        into view (see useInViewOnce) — recharts plays its
                        entrance animation on mount, so mounting it immediately
                        meant it had already finished animating by the time a
                        user scrolled down far enough to actually see it. */}
                    {inView ? (
                    <ResponsiveContainer width="55%" height={160}>
                        <PieChart>
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68}
                                dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                            </Pie>
                            <Tooltip
                                formatter={(v) => `${v as number} ${feeUnitLabel}`}
                                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    ) : (
                        <div style={{ width: '55%', height: 160 }} />
                    )}
                    <div className="flex-1 space-y-3 min-w-0">
                        {donutData.map((d) => {
                            const pct = d.name === 'Paid' ? collectedPct : 100 - collectedPct;
                            return (
                                <div key={d.name} className="flex items-start justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2 shrink-0 -mt-px">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                                        <span className="text-muted-foreground whitespace-nowrap">{d.name}</span>
                                    </div>
                                    <div className="flex flex-col items-end leading-tight">
                                        <span className="font-semibold text-foreground whitespace-nowrap">{d.value} {feeUnitLabel}</span>
                                        <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">({pct}%)</span>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                            <span className="text-muted-foreground font-medium">Total</span>
                            <span className="font-bold text-foreground">{totalFees} {feeUnitLabel}</span>
                        </div>
                    </div>
                    </div>
                </div>

                {/* Column 3 (40%): Class-wise accordion */}

                <div className="lg:col-span-8 divide-y divide-border/30 lg:overflow-y-auto">
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
    const [attendanceAi, setAttendanceAi] = useState<AttendanceAiInsights | null>(null);
    const [disengagedFamilies, setDisengagedFamilies] = useState<DisengagedFamily[]>([]);
    const [parentEngagementSearch, setParentEngagementSearch] = useState('');
    const [feeData, setFeeData] = useState<FeeStandard[]>([]);
    const [feeAi, setFeeAi] = useState<FeeAiInsights | null>(null);
    const [aiTeachers, setAiTeachers] = useState<AiTeacherUsage[]>([]);
    // Institution-wide feature totals (includes admin-triggered features like
    // FEE_FORECAST, which have no teacherId and so never show up inside
    // aiTeachers' per-teacher byFeature breakdown).
    const [aiByFeature, setAiByFeature] = useState<{ feature: string; totalTokens: number; requests: number }[]>([]);
    // Today's (IST calendar day) token usage — resets to 0 at 12am, separate
    // from the monthly pool figure above it.
    const [todayTokensUsed, setTodayTokensUsed] = useState(0);
    const [expandedAiTeachers, setExpandedAiTeachers] = useState<Set<string>>(new Set());
    // Click-to-enlarge for the "Per teacher" avatar photos — null when no
    // preview is open.
    const [enlargedAvatar, setEnlargedAvatar] = useState<{ url: string; name: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const { instType } = useMockInstType();
    const router = useRouter();
    const fetchedRef = useRef(false);

    const fetchAll = async () => {
        setLoading(true);
        setError(false);
        try {
            const [ovRes, teachRes, attRes, feeRes, feeAiRes, aiRes, parentEngRes] = await Promise.allSettled([
                api.get('/admin/overview'),
                api.get('/admin/teachers'),
                api.get('/admin/insights/attendance'),
                api.get('/admin/insights/fees'),
                api.get('/admin/insights/fees/ai'),
                api.get('/admin/insights/ai-usage'),
                api.get('/admin/insights/parent-engagement'),
            ]);
            if (ovRes.status === 'fulfilled') setOverview(ovRes.value.data.data);
            else setError(true);
            if (teachRes.status === 'fulfilled') setTeachers(teachRes.value.data.data ?? []);
            if (attRes.status === 'fulfilled') {
                setAttendanceData(attRes.value.data.data?.standards ?? []);
                setAttendanceAi({
                    streaks: attRes.value.data.data?.streaks ?? [],
                    aiSummary: attRes.value.data.data?.aiSummary ?? null,
                    isAiGenerated: attRes.value.data.data?.isAiGenerated ?? false,
                });
            }
            if (parentEngRes.status === 'fulfilled') setDisengagedFamilies(parentEngRes.value.data.data?.disengaged ?? []);
            if (feeRes.status === 'fulfilled') setFeeData(feeRes.value.data.data ?? []);
            if (feeAiRes.status === 'fulfilled') setFeeAi(feeAiRes.value.data.data ?? null);
            if (aiRes.status === 'fulfilled') {
                const raw: (Omit<AiTeacherUsage, 'used'> & { used: number })[] = aiRes.value.data.data ?? [];
                setAiTeachers(raw.map(t => ({ ...t, used: t.used / 1_000_000 })));
                setAiByFeature(aiRes.value.data.institutionByFeature ?? []);
                setTodayTokensUsed(aiRes.value.data.todayTokensUsed ?? 0);
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

    // Institution-scoped feature breakdown — sourced from the backend's
    // institution-wide tally (institutionByFeature), not derived from
    // aiTeachers' per-teacher byFeature. Admin-triggered features (e.g.
    // FEE_FORECAST) have no teacherId, so summing only the per-teacher
    // breakdown silently dropped them. Seeded with every known feature at
    // zero first so the "Usage by Feature" card always lists all of them,
    // not just whichever ones happen to have usage this month.
    const featureTotals = new Map<string, { totalTokens: number; requests: number }>(
        Object.keys(AI_FEATURE_LABELS).map(f => [f, { totalTokens: 0, requests: 0 }])
    );
    // Names of whatever actually got folded into "Others" this month, for the
    // info-tooltip — only features with nonzero usage, not the whole known set.
    const othersIncluded: string[] = [];
    aiByFeature.forEach(f => {
        // Image ranking (picking which retrieved images make it into a scan
        // result) runs as part of the AI Scan pipeline and is billed under its
        // own AiFeature purely for backend cost-tracking — fold it into the
        // AI Scan bar instead of letting it fall through to "Others".
        const normalizedFeature = f.feature === 'BLACKBOARD_IMAGE_RANK' ? 'BLACKBOARD_SCAN' : f.feature;
        // Anything outside the main known set (e.g. FEE_FORECAST) rolls up
        // into "Others" rather than getting its own bar.
        const key = MAIN_AI_FEATURES.has(normalizedFeature) ? normalizedFeature : 'OTHERS';
        if (key === 'OTHERS' && f.totalTokens > 0) {
            othersIncluded.push(OTHER_FEATURE_LABELS[f.feature] ?? f.feature);
        }
        const cur = featureTotals.get(key) ?? { totalTokens: 0, requests: 0 };
        cur.totalTokens += f.totalTokens;
        cur.requests += f.requests;
        featureTotals.set(key, cur);
    });
    const featureBreakdown = Array.from(featureTotals.entries())
        .map(([feature, v]) => ({ feature, ...v }))
        .sort((a, b) => b.totalTokens - a.totalTokens);
    const featureGrandTotal = featureBreakdown.reduce((s, f) => s + f.totalTokens, 0) || 1;

    return (
        <>
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
                    <AiSchoolPA />
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
                        <div className="flex items-center justify-between -mt-2">
                            <div className="max-w-[55%]">
                                <p className="text-xs text-muted-foreground">Institution token pool</p>
                                <p className="text-lg font-semibold">
                                    {formatTokens(institutionTokensUsed)}
                                    <span className="text-sm font-normal text-muted-foreground"> / {formatTokens(institutionTokensLimit)} tokens</span>
                                </p>
                            </div>
                            <div className="pl-3 border-l border-border/50">
                                <p className="text-xs text-muted-foreground">Today</p>
                                <p className="text-lg font-semibold">
                                    {formatTokens(todayTokensUsed)}
                                    <span className="text-sm font-normal text-muted-foreground"> tokens</span>
                                </p>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                                <Sparkles size={15} className="text-violet-600 dark:text-violet-400" />
                            </div>
                        </div>

                        {/* Pool bar */}
                        <div className="-mt-2">
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

                        {/* Usage by Feature — now sits directly under the
                            pool bar in the left column, per request. */}
                        <div className="flex flex-col gap-3">
                            <p className="text-sm font-semibold">Usage by Feature <span className="text-xs font-normal text-muted-foreground">(this month)</span></p>
                            <div className="h-[222px] overflow-y-auto pr-1"
                                style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                                {featureBreakdown.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No AI usage recorded yet.</p>
                                ) : (() => {
                                    // Split into two columns — first half left,
                                    // second half right — same fixed card height,
                                    // just fits more before it needs to scroll,
                                    // and new features land in the right column.
                                    const half = Math.ceil(featureBreakdown.length / 2);
                                    const columns = [featureBreakdown.slice(0, half), featureBreakdown.slice(half)];
                                    const renderRow = (f: typeof featureBreakdown[number]) => {
                                        const pct = Math.round((f.totalTokens / featureGrandTotal) * 100);
                                        const color = featureColor(f.feature);
                                        return (
                                            <div key={f.feature}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[11px] font-semibold flex items-center gap-1">
                                                        {AI_FEATURE_LABELS[f.feature] ?? f.feature}
                                                        {f.feature === 'OTHERS' && othersIncluded.length > 0 && (
                                                            <span className="relative inline-flex group">
                                                                <Info size={11} className="text-muted-foreground/60" />
                                                                <span
                                                                    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-1.5 hidden group-hover:block whitespace-nowrap z-20 px-2 py-1 rounded-lg text-[10px] font-medium shadow-lg"
                                                                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                                                                >
                                                                    Includes: {othersIncluded.join(', ')}
                                                                </span>
                                                            </span>
                                                        )}
                                                    </span>
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
                                    };
                                    return (
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                            <div className="space-y-4">{columns[0].map(renderRow)}</div>
                                            <div className="space-y-4">{columns[1].map(renderRow)}</div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="hidden lg:block w-px bg-border/60 self-stretch" />
                    <div className="lg:hidden h-px bg-border/60 w-full" />

                    {/* Right 40% — Per teacher, moved here per request. Fixed
                        height so this card doesn't keep growing as more
                        teachers/features get added — the list itself scrolls
                        instead. */}
                    <div className="lg:w-[40%] flex flex-col min-h-0">
                        <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-3">Per teacher <span className="normal-case font-normal text-muted-foreground">(this month)</span></p>
                        <div className="space-y-3 h-[350px] overflow-y-auto pr-1"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
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
                            // Same order as the "Usage by Feature" card on the left
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
                                const orderedFeatures = mergeImageRankIntoScan(t.byFeature).sort(
                                    (a, b) => featureOrder.indexOf(a.feature) - featureOrder.indexOf(b.feature)
                                );
                                const isExpanded = expandedAiTeachers.has(t.teacherId);
                                const toggleExpanded = () => {
                                    setExpandedAiTeachers(prev => {
                                        const next = new Set(prev);
                                        if (next.has(t.teacherId)) next.delete(t.teacherId); else next.add(t.teacherId);
                                        return next;
                                    });
                                };
                                return (
                                    <div key={t.teacherId} className="rounded-xl border border-border/40 bg-muted/10 p-3">
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={toggleExpanded}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpanded(); }}
                                            className="w-full flex items-center gap-2.5 text-left cursor-pointer"
                                        >
                                            {t.avatarUrl ? (
                                                <div
                                                    role="button"
                                                    aria-label={`View ${t.name}'s photo`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEnlargedAvatar({ url: t.avatarUrl!, name: t.name });
                                                    }}
                                                    className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 cursor-zoom-in hover:opacity-85 transition-opacity"
                                                >
                                                    <NextImage src={t.avatarUrl} alt={t.name} fill sizes="72px" quality={100} className="object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                                                    <span className="text-[10px] font-bold text-violet-500">
                                                        {t.name.split(' ').map(n => n[0]).join('')}
                                                    </span>
                                                </div>
                                            )}
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
                                            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
                                                <ChevronRight size={14} className="text-muted-foreground" />
                                            </motion.div>
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

                                        {/* Feature-wise breakdown — collapsed by default, opens on row click */}
                                        <AnimatePresence initial={false}>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
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
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            });
                        })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Fee Analysis ── */}
            <FeeAccordion data={feeData} ai={feeAi} />

            {/* ── Attendance Analysis ── */}
            <AttendanceAccordion data={attendanceData} ai={attendanceAi} />

            {/* ── Parent Engagement — families who haven't opened Parent Mode
                recently, cross-checked with the app whenever it's switched on
                (see ParentModeEvent). Always shown, same "always visible, even
                when empty" rule as the AI Attendance boxes. ── */}
            <div className="bg-card border border-border/50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Users size={15} className="text-muted-foreground" />
                        <p className="text-sm font-semibold flex items-center gap-1">
                            Parent Engagement
                            <span className="relative inline-flex group">
                                <Info size={11} className="text-muted-foreground/60" />
                                <span
                                    className="pointer-events-none absolute left-0 top-full mt-1.5 hidden group-hover:block w-64 whitespace-normal z-20 px-2 py-1.5 rounded-lg text-[10px] font-medium normal-case leading-snug shadow-lg"
                                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                                >
                                    Flags students whose family hasn&apos;t opened Parent Mode on the app in 15+ days, or never at all. Use it to spot parents who aren&apos;t checking their child&apos;s attendance, marks, or fee status, and reach out before it becomes a bigger problem.
                                </span>
                            </span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {disengagedFamilies.length > 0 && (
                            <div className="relative">
                                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                                <input
                                    type="text"
                                    value={parentEngagementSearch}
                                    onChange={(e) => setParentEngagementSearch(e.target.value)}
                                    placeholder="Search name/ID"
                                    className="h-7 w-44 pl-6 pr-2 rounded-md text-[11px] bg-muted/30 border border-border/50 focus:outline-none focus:border-amber-400/60 placeholder:text-muted-foreground/50"
                                />
                            </div>
                        )}
                        {disengagedFamilies.length > 0 && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 whitespace-nowrap">
                                {disengagedFamilies.length} disengaged
                            </span>
                        )}
                    </div>
                </div>
                {disengagedFamilies.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 leading-snug">No disengaged families right now — everyone's checked in recently.</p>
                ) : (() => {
                    const query = parentEngagementSearch.trim().toLowerCase();
                    const filtered = query
                        ? disengagedFamilies.filter((f) =>
                            (f.name ?? '').toLowerCase().includes(query) || (f.studentCode ?? '').toLowerCase().includes(query)
                        )
                        : disengagedFamilies;
                    // Without a search, only the top 15 (already sorted worst-first)
                    // show by default — the search box exists precisely so a large
                    // roster doesn't force everyone into one giant scroll.
                    const visible = query ? filtered : filtered.slice(0, 15);
                    return (
                        <div className="flex flex-col gap-2">
                            {visible.length === 0 ? (
                                <p className="text-xs text-muted-foreground/70 leading-snug py-1">No disengaged student matches &quot;{parentEngagementSearch}&quot;.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2 overflow-y-auto pb-1 max-h-[170px]" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                                    {visible.map((f) => (
                                        <button key={f.studentId}
                                            onClick={() => router.push(`/admin/campus/classes/${f.standardId}/${f.divisionId}?tab=attendance`)}
                                            className="shrink-0 flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-muted/30 hover:border-amber-300 transition-colors text-left"
                                            style={{ minWidth: 180, willChange: 'scroll-position' }}>
                                            <div className="relative shrink-0">
                                                {f.avatarUrl ? (
                                                    <div className="relative w-8 h-8 rounded-full overflow-hidden">
                                                        <NextImage src={f.avatarUrl} alt={f.name} fill sizes="64px" quality={100} className="object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                                        style={{ background: streakAvatarColor(f.name) }}>
                                                        {streakInitials(f.name)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11.5px] font-semibold truncate">{f.name}</p>
                                                <p className="text-[10px] text-muted-foreground truncate">
                                                    {f.divisionName} · {f.daysSinceLastOpen === null ? 'Never opened' : `${f.daysSinceLastOpen}d since check-in`}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

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

        {/* Click-to-enlarge preview for a teacher's avatar photo in the
            "Per teacher" list, above — same pattern as the student/teacher
            profile photo modal (StudentProfileView.tsx / TeacherDetailPageClient.tsx). */}
        <AnimatePresence>
            {enlargedAvatar && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={() => setEnlargedAvatar(null)}
                >
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.85, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <img src={enlargedAvatar.url} alt={enlargedAvatar.name} className="w-full h-full object-cover" />
                        <button
                            onClick={() => setEnlargedAvatar(null)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all"
                        >
                            <X size={14} className="text-white" />
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        </>
    );
}