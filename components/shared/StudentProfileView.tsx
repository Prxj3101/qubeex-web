'use client';

import { useMemo, useState } from 'react';
import NextImage from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy, Star, BarChart2, Calendar, Flag,
    ChevronRight, ArrowLeft, User, Hash, Copy, X,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, LabelList,
    AreaChart, Area, ReferenceLine,
} from 'recharts';
import { FlagItem } from '@/lib/flags';
import { colorForSubject } from '@/lib/subjectColors';

type MarksMode = 'offline' | 'online' | 'combined';

export interface ProfileViewMarksheetSubject {
    id: string; name: string; code: string; color: string | null;
    total: { scored: number; max: number }; pct: number | null; grade: string;
    onlineTotal?: { scored: number; max: number }; onlinePct?: number | null;
}

export interface ProfileViewMarksheet {
    subjects: ProfileViewMarksheetSubject[];
    grandPct: number | null;
    classRank: number | null;
    offlineClassRank?: number | null;
    onlineClassRank?: number | null;
    combinedClassRank?: number | null;
    classSize: number | null;
}

export interface ProfileViewAttendanceMonth { month: string; pct: number | null }

export interface ProfileViewAttendance {
    overall: { pct: number | null };
    monthly: ProfileViewAttendanceMonth[];
}

const SCHOOL_START_MONTH = 5;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_ORDER = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];

function getAttendanceWindowMonths(date: Date) {
    const currentMonthIdx = date.getMonth();
    let monthsSinceStart = currentMonthIdx - SCHOOL_START_MONTH;
    if (monthsSinceStart < 0) monthsSinceStart += 12;
    const windowStartOffset = monthsSinceStart <= 3 ? 0 : monthsSinceStart - 3;
    return Array.from({ length: 4 }, (_, i) => MONTH_NAMES[(SCHOOL_START_MONTH + windowStartOffset + i) % 12]);
}

const ATTENDANCE_WINDOW_MONTHS = getAttendanceWindowMonths(new Date());

function getPct(v: number) {
    const color = v >= 75 ? '#10B981' : v >= 65 ? '#F59E0B' : '#EF4444';
    return { color };
}

function SectionCard({ title, icon: Icon, iconColor, children, action, titleExtra }: {
    title: string; icon: React.ElementType; iconColor: string;
    children: React.ReactNode; action?: React.ReactNode; titleExtra?: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden h-full">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50 bg-muted/20 flex-wrap gap-2 lg:px-5">
                <div className="flex items-center gap-2 flex-wrap">
                    <Icon size={15} style={{ color: iconColor }} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
                    {titleExtra}
                </div>
                {action}
            </div>
            <div className="p-4 lg:p-5">{children}</div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-none">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs font-medium text-foreground">{value}</span>
        </div>
    );
}

export interface StudentProfileViewProps {
    institutionName?: string;
    institutionLogoUrl?: string | null;
    studentName: string;
    studentIdCode: string;
    standard: string;
    division: string;
    rollNo: string | null;
    admissionYear: string | null;
    dob: string | null;
    email: string;
    photo: string | null;
    status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'WITHDRAWN';
    marksheetData: ProfileViewMarksheet | null;
    attendanceApiData: ProfileViewAttendance | null;
    flags: FlagItem[];
    onBack?: () => void;
    onViewDetail?: () => void;
    onViewReportCard?: () => void;
    onViewAttendanceDetails?: () => void;
    onViewAllFlags?: () => void;
    /** When false, renders just the section cards (no page header / scroll wrapper) so a caller can embed them inside its own layout alongside more sections. Defaults to true. */
    standalone?: boolean;
    /** Rendered side-by-side with Attendance (right column). */
    feesSlot?: React.ReactNode;
    /** Rendered side-by-side with Remarks (right column). */
    projectsSlot?: React.ReactNode;
    /** Rendered full-width below Remarks/Projects — the PTM Notes card. Omit to render nothing. */
    ptmNotesSlot?: React.ReactNode;
}

export default function StudentProfileView({
    institutionName, institutionLogoUrl, studentName, studentIdCode, standard, division, rollNo, admissionYear,
    dob, email, photo, status = 'ACTIVE', marksheetData, attendanceApiData, flags,
    onBack, onViewDetail, onViewReportCard, onViewAttendanceDetails, onViewAllFlags, standalone = true,
    feesSlot, projectsSlot, ptmNotesSlot,
}: StudentProfileViewProps) {
    const [photoExpanded, setPhotoExpanded] = useState(false);
    // Default to offline — matches what the student's own dashboard "Overall
    // Score" tile shows (that card has no toggle at all, it's always the
    // offline pooled %). Defaulting this to 'combined' made the teacher/admin
    // number disagree with the student's own view before either of them
    // touched the toggle.
    const [marksMode, setMarksMode] = useState<MarksMode>('offline');
    const [copied, setCopied] = useState(false);

    const dobDate = dob ? new Date(dob) : null;
    const age = dobDate ? new Date().getFullYear() - dobDate.getFullYear() : null;
    const dobDisplay = dobDate ? dobDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

    // All 12 months always stay on the x-axis (same layout as before) — but a
    // month with no attendance marked yet comes back as pct: null from the
    // backend, and we keep it null here (not 0) so the line/area simply stops
    // after the last real month instead of dropping to a fake 0% and running
    // flat across every unmarked future month.
    const attendanceTrendData = useMemo(() =>
        MONTHS_ORDER.map(m => {
            const found = attendanceApiData?.monthly.find(x => x.month === m);
            return { month: m, value: found?.pct ?? null };
        }),
    [attendanceApiData]);

    const overallAttendancePct = attendanceApiData?.overall.pct ?? null;

    const attendanceWindow = useMemo(() =>
        ATTENDANCE_WINDOW_MONTHS.map(month => {
            const found = attendanceApiData?.monthly.find(x => x.month === month);
            return { month, value: found?.pct ?? 0 };
        }),
    [attendanceApiData]);

    const chartData = (marksheetData?.subjects ?? []).map((s) => {
        const offline = s.pct ?? 0;
        const online = s.onlinePct ?? 0;
        const offMax = s.total?.max ?? 0;
        const onMax = s.onlineTotal?.max ?? 0;
        const combMax = offMax + onMax;
        const combinedPct = combMax > 0
            ? Math.round((((s.total?.scored ?? 0) + (s.onlineTotal?.scored ?? 0)) / combMax) * 100)
            : offline;
        const pct = marksMode === 'offline' ? offline : marksMode === 'online' ? online : combinedPct;
        return { name: s.name, code: s.code, color: colorForSubject(s), pct };
    });
    // "Overall Score" — pooled scored/max across every subject for the active
    // mode, not a naive average of each subject's own %. A plain average
    // weighs a subject with 1 recorded mark the same as one with a full
    // published set, which skews it badly (e.g. mostly-empty subjects
    // dragging a real ~75% down to something like 7%).
    const avg = (() => {
        const subjects = marksheetData?.subjects ?? [];
        let scored = 0, max = 0;
        for (const s of subjects) {
            if (marksMode === 'offline' || marksMode === 'combined') {
                scored += s.total?.scored ?? 0;
                max += s.total?.max ?? 0;
            }
            if (marksMode === 'online' || marksMode === 'combined') {
                scored += s.onlineTotal?.scored ?? 0;
                max += s.onlineTotal?.max ?? 0;
            }
        }
        return max > 0 ? Math.round((scored / max) * 100) : 0;
    })();
    const overallRank: number | null = marksMode === 'offline'
        ? (marksheetData?.offlineClassRank ?? marksheetData?.classRank ?? null)
        : marksMode === 'online'
            ? (marksheetData?.onlineClassRank ?? null)
            : (marksheetData?.combinedClassRank ?? null);

    const yellowFlags = flags.filter(f => f.type === 'yellow');
    const redFlags = flags.filter(f => f.type === 'red');

    const handleCopy = () => {
        navigator.clipboard.writeText(studentIdCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const sections = (
        <>
                {/* ── ID Card ── */}
                <div className="rounded-2xl overflow-hidden border border-border/50 shadow-lg">
                    <div className="px-4 py-4 flex items-center justify-between gap-2 lg:px-6 dark:[background:linear-gradient(135deg,#4C1D95,#2D1F50)]"
                        style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                            {institutionLogoUrl && (
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/15 shrink-0 flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={institutionLogoUrl} alt="" className="w-full h-full object-contain" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-white font-bold text-base truncate" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    {institutionName || 'School'}
                                </p>
                                <p className="text-white/70 text-xs">Student ID Card</p>
                            </div>
                        </div>
                        {onViewDetail && (
                            <button
                                onClick={onViewDetail}
                                className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-all">
                                <span className="leading-none" style={{ position: 'relative', top: '-1px' }}>View</span>
                                <ChevronRight size={13} style={{ position: 'relative', top: '0px' }} />
                            </button>
                        )}
                    </div>

                    <div className="bg-card p-4 lg:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
                        <div className="shrink-0">
                            <div className="relative w-20 h-20">
                                <div
                                    className={`relative w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white overflow-hidden${photo ? ' cursor-pointer' : ''}`}
                                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}
                                    onClick={() => photo && setPhotoExpanded(true)}
                                >
                                    {photo
                                        ? <NextImage src={photo} alt="profile" fill sizes="160px" quality={100} className="object-cover" unoptimized={photo.startsWith('data:')} />
                                        : studentName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)
                                    }
                                </div>
                                <div className={`absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-4 h-4 rounded-full border-2 border-card ${status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`} />
                            </div>

                            <AnimatePresence>
                                {photoExpanded && photo && (
                                    <motion.div
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                                        onClick={() => setPhotoExpanded(false)}
                                    >
                                        <motion.div
                                            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                            className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <img src={photo} alt="profile" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => setPhotoExpanded(false)}
                                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all"
                                            >
                                                <X size={14} className="text-white" />
                                            </button>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div className="mt-2 text-center">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-semibold">
                                    {standard}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-lg font-bold leading-tight">{studentName}</p>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/50'}`} />
                                    <span className={`text-[11px] font-semibold ${status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                        {status === 'ACTIVE' ? 'Active' : status.charAt(0) + status.slice(1).toLowerCase()}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold mt-0.5">
                                {standard} · Division {division.split('-').pop() ?? division}
                            </p>
                            <div className="h-px bg-border/50 my-3" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                <InfoRow label="Roll No" value={rollNo ?? '—'} />
                                <InfoRow label="Division" value={division.split('-').pop() ?? division} />
                                <InfoRow label="Admission Year" value={admissionYear ?? '—'} />
                                <InfoRow label="Date of Birth" value={dobDisplay ? `${dobDisplay}${age !== null ? ` (${age} yrs)` : ''}` : '—'} />
                                <InfoRow label="Email" value={email || '—'} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-5 py-2.5 bg-violet-50 dark:bg-violet-950/30 border-t border-violet-200/50 dark:border-violet-900/50">
                        <Hash size={14} className="text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm font-semibold tracking-wider flex-1" style={{ color: '#DA7756' }}>{studentIdCode}</span>
                        <button onClick={handleCopy}
                            className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-all">
                            <Copy size={11} />
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>

                {/* ── Rank + Score + Subject Performance ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-card border border-border/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Trophy size={14} className="text-amber-500" />
                                <p className="text-xs font-semibold text-muted-foreground">Overall Rank</p>
                            </div>
                            <p className="text-4xl font-black" style={{
                                color: overallRank === null ? 'var(--muted-foreground)' :
                                    overallRank === 1 ? '#F59E0B' :
                                        overallRank <= 3 ? '#7C3AED' :
                                            overallRank <= 10 ? 'var(--blue)' :
                                                'var(--muted-foreground)'
                            }}>
                                {overallRank === null ? '—' : `#${overallRank}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Overall rank</p>
                        </div>
                        <div className="bg-card border border-border/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Star size={14} className="text-amber-500 fill-amber-500" />
                                <p className="text-xs font-semibold text-muted-foreground">Overall Score</p>
                            </div>
                            <p className="text-4xl font-black text-violet-600 dark:text-violet-400">{avg}%</p>
                            <p className="text-xs text-muted-foreground mt-1">across all subjects</p>
                        </div>
                    </div>

                    <div className="col-span-1 lg:col-span-2 h-full">
                        <SectionCard title="Subject Performance" icon={BarChart2} iconColor="#7C3AED"
                            titleExtra={
                                <div className="flex flex-wrap bg-muted/50 rounded-xl p-0.5 border border-border/50 ml-1">
                                    {([
                                        { key: 'offline' as MarksMode, label: 'Offline' },
                                        { key: 'online' as MarksMode, label: 'Online' },
                                        { key: 'combined' as MarksMode, label: 'Combined' },
                                    ]).map(({ key, label }) => {
                                        const isActive = marksMode === key;
                                        return (
                                            <button key={key} onClick={() => setMarksMode(key)}
                                                className={`relative px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all
                                                ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            }
                            action={onViewReportCard && (
                                <button onClick={onViewReportCard} className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all">
                                    <span className="leading-none">View Report Card</span>
                                    <ChevronRight size={12} />
                                </button>
                            )}>
                            {chartData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                                    <BarChart2 size={32} className="mb-2 opacity-30" />
                                    <p className="text-sm font-medium">No results published yet</p>
                                </div>
                            ) : (
                                <>
                                    <ResponsiveContainer width="100%" height={190}>
                                        <BarChart data={chartData} margin={{ top: 16, bottom: 4, left: 0, right: 8 }} barCategoryGap="30%">
                                            <defs>
                                                {chartData.map((d, i) => (
                                                    <linearGradient key={i} id={`staffSubjBarGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                                                        <stop offset="100%" stopColor={d.color} stopOpacity={0.45} />
                                                    </linearGradient>
                                                ))}
                                            </defs>
                                            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval={0} axisLine={false} tickLine={false} height={24} />
                                            <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={[0, 100]} width={32} />
                                            <Tooltip
                                                cursor={false}
                                                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                                                labelStyle={{ color: 'var(--card-foreground)', fontWeight: 600 }}
                                                itemStyle={{ color: 'var(--card-foreground)' }}
                                                formatter={(value: unknown) => [`${value}%`, 'Score']}
                                            />
                                            <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={44}>
                                                <LabelList dataKey="pct" position="top" formatter={(v: unknown) => `${v}%`}
                                                    style={{ fontSize: 10, fontWeight: 600, fill: 'var(--foreground)' }} />
                                                {chartData.map((d, i) => <Cell key={i} fill={`url(#staffSubjBarGrad-${i})`} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex-1 border-t-2 border-dashed border-violet-500/50" />
                                        <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">Avg {avg}%</span>
                                    </div>
                                </>
                            )}
                        </SectionCard>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ── Attendance ── */}
                <SectionCard title="Attendance" icon={Calendar} iconColor="#10B981"
                    action={onViewAttendanceDetails && (
                        <button onClick={onViewAttendanceDetails} className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all">
                            <span className="leading-none">View Details</span>
                            <ChevronRight size={12} />
                        </button>
                    )}>
                    <div className="space-y-3 mb-4">
                        {attendanceWindow.map(({ month, value }) => {
                            const p = getPct(value);
                            return (
                                <div key={month} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">{month}</span>
                                        <span className="text-xs font-semibold" style={{ color: p.color }}>{value}%</span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden relative">
                                        <div className="absolute left-[75%] top-0 bottom-0 w-px bg-muted-foreground/30 z-10" />
                                        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: p.color }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/50 flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Overall Attendance</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                            {overallAttendancePct !== null ? `${overallAttendancePct}%` : '—'}
                        </span>
                    </div>

                    <p className="text-xs font-semibold mb-2">Overall Attendance Trend</p>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={attendanceTrendData} margin={{ top: 28, right: 8, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="staffAttendTrendGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                            {attendanceTrendData.map((d) => (
                                <ReferenceLine key={d.month} x={d.month} stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                            ))}
                            <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} unit="%" />
                            <Tooltip
                                contentStyle={{ background: '#141414', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 11 }}
                                labelStyle={{ color: '#F1F5F9' }}
                                formatter={(val: unknown) => [`${val}%`, 'Attendance']}
                                itemStyle={{ color: '#10B981' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#10B981"
                                strokeWidth={2}
                                fill="url(#staffAttendTrendGrad)"
                                connectNulls={false}
                                dot={(dotProps: unknown) => {
                                    const { cx, cy, payload } = dotProps as { cx: number; cy: number; payload: { value: number | null } };
                                    const value = payload.value;
                                    if (value == null) return <g key={`${cx}-${cy}`} />;
                                    const vals = attendanceTrendData.map((d) => d.value).filter((v): v is number => v != null);
                                    const isMax = value === Math.max(...vals);
                                    const isMin = value === Math.min(...vals);
                                    const labelColor = isMin ? '#EF4444' : '#10B981';
                                    return (
                                        <g style={{ overflow: 'visible' }}>
                                            <circle cx={cx} cy={cy} r={4} fill="#10B981" />
                                            {(isMax || isMin) && (
                                                <>
                                                    <rect x={cx - 14} y={cy - 21} width={28} height={14} rx={3} fill={labelColor} />
                                                    <text x={cx} y={cy - 10} textAnchor="middle" fill="white" fontSize={9} fontWeight="600">{value}%</text>
                                                </>
                                            )}
                                        </g>
                                    );
                                }}
                                activeDot={{ r: 6 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>

                    <div className="flex gap-4 mt-2">
                        {[
                            { label: 'Good ≥75%', color: '#10B981' },
                            { label: 'Condonation 65–74%', color: '#F59E0B' },
                            { label: 'Defaulter <65%', color: '#EF4444' },
                        ].map(l => (
                            <div key={l.label} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                                <span className="text-[10px] text-muted-foreground">{l.label}</span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
                {feesSlot}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ── Flags ── */}
                <SectionCard title="Remarks: Flags & Warnings" icon={Flag} iconColor="#EF4444"
                    action={onViewAllFlags && (
                        <button onClick={onViewAllFlags} className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all">
                            <span className="leading-none">View All</span>
                            <ChevronRight size={12} />
                        </button>
                    )}>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20">
                            <div className="shrink-0" style={{ width: 15, height: 20, borderRadius: 2, backgroundColor: '#FCFF38', transform: 'rotate(-5deg)', boxShadow: '1px 2px 0px rgba(0,0,0,0.35)' }} />
                            <div>
                                <p className="text-lg font-extrabold text-amber-500">{yellowFlags.length}</p>
                                <p className="text-[10px] text-amber-500">Yellow Cards</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/20">
                            <div className="shrink-0" style={{ width: 15, height: 20, borderRadius: 2, backgroundColor: '#DC2626', transform: 'rotate(-5deg)', boxShadow: '1px 2px 0px rgba(0,0,0,0.35)' }} />
                            <div>
                                <p className="text-lg font-extrabold text-red-500">{redFlags.length}</p>
                                <p className="text-[10px] text-red-500">Red Cards</p>
                            </div>
                        </div>
                    </div>

                    {flags.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-2xl mb-1">✅</p>
                            <p className="text-xs text-muted-foreground">No flags! Keep it up.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {[
                                [...flags].filter(f => f.type === 'yellow').sort((a, b) => new Date(a.date).getTime() < new Date(b.date).getTime() ? 1 : -1)[0],
                                [...flags].filter(f => f.type === 'red').sort((a, b) => new Date(a.date).getTime() < new Date(b.date).getTime() ? 1 : -1)[0],
                            ]
                                .filter((f): f is FlagItem => f !== undefined)
                                .map((flag, i) => (
                                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border-l-[3px] ${flag.type === 'yellow' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-400' : 'bg-red-50 dark:bg-red-950/20 border-red-500'}`}>
                                        <div className="shrink-0 mt-0.5" style={{ width: 17, height: 24, borderRadius: 2, backgroundColor: flag.type === 'yellow' ? '#fcff38' : '#DC2626', transform: 'rotate(-5deg)', boxShadow: '1px 2px 0px rgba(0,0,0,0.35)' }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-foreground">{flag.title}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">{flag.date}</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </SectionCard>
                {projectsSlot}
                </div>

                {ptmNotesSlot && (
                    <div className="grid grid-cols-1 gap-4">
                        {ptmNotesSlot}
                    </div>
                )}
        </>
    );

    if (!standalone) return sections;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Page Header */}
            <div className="shrink-0 px-1 pb-3">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0"
                        >
                            <ArrowLeft size={15} className="text-foreground" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <User size={21} /> {studentName}&apos;s Profile
                        </h1>
                        <p className="text-[13px] text-muted-foreground">{studentName.split(' ')[0]}&apos;s Personal &amp; academic details</p>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto space-y-5 pb-8 px-1">
                {sections}
            </div>
        </div>
    );
}
