'use client';

import { useState, useEffect, useMemo } from 'react';
import NextImage from 'next/image';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useStudentStore } from '@/store/studentStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy, Star, BarChart2, Calendar, Flag, IndianRupee,
    Award, ChevronRight, ArrowUpRight, Bell, Settings,
    LogOut, CheckCircle2, Clock, AlertTriangle, User,
    Mail, Hash, BookOpen, MapPin, Phone, Copy, X,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line, Cell, LabelList,
    AreaChart, Area, ReferenceLine,
} from 'recharts';
import { FLAGS } from '@/lib/flags';

type MarksMode = 'offline' | 'online' | 'combined';

interface MarksheetSubject {
    id: string; name: string; code: string; color: string | null;
    total: { scored: number; max: number }; pct: number | null; grade: string;
}

const SUBJECT_COLORS = ['#DA7756','#EC4899','#0891B2','#7C3AED','#059669','#0EA5E9','#6366F1','#D97706','#16A34A','#E11D48','#7C3AED','#0284C7'];

const ATTENDANCE_TREND = [
    { month: 'Jun', value: 62 },
    { month: 'Jul', value: 70 },
    { month: 'Aug', value: 88 },
    { month: 'Sep', value: 95 },
    { month: 'Oct', value: 82 },
    { month: 'Nov', value: 80 },
    { month: 'Dec', value: 65 },
    { month: 'Jan', value: 72 },
    { month: 'Feb', value: 82 },
    { month: 'Mar', value: 90 },
    { month: 'Apr', value: 76 },
    { month: 'May', value: 84 },
];

// School attendance tracking starts in June (0-indexed month 5). The card
// shows a rolling 4-month window: it stays pinned at [Jun, Jul, Aug, Sep]
// until the school year is more than 3 months in, then slides forward one
// month at a time (current month + previous 3) — e.g. Oct -> [Jul..Oct],
// Nov -> [Aug..Nov].
const SCHOOL_START_MONTH = 5;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getAttendanceWindowMonths(date: Date) {
    const currentMonthIdx = date.getMonth();
    let monthsSinceStart = currentMonthIdx - SCHOOL_START_MONTH;
    if (monthsSinceStart < 0) monthsSinceStart += 12;
    const windowStartOffset = monthsSinceStart <= 3 ? 0 : monthsSinceStart - 3;
    return Array.from({ length: 4 }, (_, i) => MONTH_NAMES[(SCHOOL_START_MONTH + windowStartOffset + i) % 12]);
}

const ATTENDANCE_WINDOW = getAttendanceWindowMonths(new Date()).map((month) => {
    const found = ATTENDANCE_TREND.find((t) => t.month === month);
    return { month, value: found ? found.value : 0 };
});


const FEE_MONTHS_PROFILE = [
    { month: 'June', dueDate: '10 Jun 2025', amount: 6700, status: 'PAID' as const, paidDate: '8 Jun 2025' },
    { month: 'July', dueDate: '10 Jul 2025', amount: 6700, status: 'PAID' as const, paidDate: '9 Jul 2025' },
    { month: 'August', dueDate: '10 Aug 2025', amount: 6700, status: 'PAID' as const, paidDate: '7 Aug 2025' },
    { month: 'September', dueDate: '10 Sep 2025', amount: 6700, status: 'PAID' as const, paidDate: '9 Sep 2025' },
    { month: 'October', dueDate: '10 Oct 2025', amount: 6700, status: 'PAID' as const, paidDate: '8 Oct 2025' },
    { month: 'November', dueDate: '10 Nov 2025', amount: 6700, status: 'PAID' as const, paidDate: '10 Nov 2025' },
    { month: 'December', dueDate: '10 Dec 2025', amount: 6700, status: 'PAID' as const, paidDate: '9 Dec 2025' },
    { month: 'January', dueDate: '10 Jan 2026', amount: 6700, status: 'PENDING' as const, paidDate: undefined },
    { month: 'February', dueDate: '10 Feb 2026', amount: 6700, status: 'PENDING' as const, paidDate: undefined },
    { month: 'March', dueDate: '10 Mar 2026', amount: 6700, status: 'PENDING' as const, paidDate: undefined },
    { month: 'April', dueDate: '10 Apr 2026', amount: 6700, status: 'PENDING' as const, paidDate: undefined },
    { month: 'May', dueDate: '10 May 2026', amount: 6700, status: 'PENDING' as const, paidDate: undefined },
];
const TERM1_MONTHS = ['June', 'July', 'August', 'September', 'October'];
const TERM2_MONTHS = ['November', 'December', 'January', 'February', 'March', 'April', 'May'];
const term1 = FEE_MONTHS_PROFILE.filter(m => TERM1_MONTHS.includes(m.month));
const term2 = FEE_MONTHS_PROFILE.filter(m => TERM2_MONTHS.includes(m.month));
const termData = [
    { label: 'Term 1', range: 'June – October', months: term1 },
    { label: 'Term 2', range: 'November – May', months: term2 },
];

const ACHIEVEMENTS = [
    { icon: '🏆', title: 'Top 5 Overall', desc: 'Ranked 4th in batch', date: 'Mar 2025' },
    { icon: '🎯', title: 'Perfect Score', desc: '100% in DBMS Quiz 1', date: 'Jan 2025' },
    { icon: '📜', title: 'Hackathon Winner', desc: 'Smart India Hackathon 2024', date: 'Dec 2024' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPct(v: number) {
    const color = v >= 75 ? '#10B981' : v >= 65 ? '#F59E0B' : '#EF4444';
    const label = v >= 75 ? 'Safe' : v >= 65 ? 'Condonation' : 'Defaulter';
    const cls = v >= 75
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
        : v >= 65
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
    return { color, label, cls };
}


// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, iconColor, children, action, titleExtra }: {
    title: string; icon: React.ElementType; iconColor: string;
    children: React.ReactNode; action?: React.ReactNode; titleExtra?: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden h-full">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/20">
                <div className="flex items-center gap-2">
                    <Icon size={15} style={{ color: iconColor }} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
                    {titleExtra}
                </div>
                {action}
            </div>
            <div className="p-5">{children}</div>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentProfile() {
    const router = useRouter();
    const student = useStudentStore();

    useEffect(() => {
        student.fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const dobDate = new Date(student.dob);
    const age = new Date().getFullYear() - dobDate.getFullYear();
    const dobDisplay = dobDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const [photoExpanded, setPhotoExpanded] = useState(false);
    const [marksMode, setMarksMode] = useState<MarksMode>('combined');
    const [copied, setCopied] = useState(false);

    // ── Real marksheet / subject performance data ──
    const [marksheetData, setMarksheetData] = useState<{
        subjects: MarksheetSubject[];
        grandPct: number | null;
        classRank: number | null;
        classSize: number | null;
    } | null>(null);

    useEffect(() => {
        api.get('/student/marksheet').then(r => setMarksheetData(r.data.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Real attendance data ──
    interface AttendanceMonth { month: string; key: number; pct: number | null; }
    const [attendanceApiData, setAttendanceApiData] = useState<{
        overall: { pct: number | null };
        monthly: AttendanceMonth[];
    } | null>(null);

    useEffect(() => {
        api.get('/student/attendance').then(r => setAttendanceApiData(r.data.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const MONTHS_ORDER = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];
    const attendanceTrendData = useMemo(() =>
        MONTHS_ORDER.map(m => {
            const found = attendanceApiData?.monthly.find(x => x.month === m);
            return { month: m, value: found?.pct ?? 0 };
        }),
    [attendanceApiData]);

    const overallAttendancePct = attendanceApiData?.overall.pct ?? null;

    const attendanceWindow = useMemo(() =>
        ATTENDANCE_WINDOW.map(({ month }) => {
            const found = attendanceApiData?.monthly.find(x => x.month === month);
            return { month, value: found?.pct ?? 0 };
        }),
    [attendanceApiData]);

    const chartData = (marksheetData?.subjects ?? []).map((s, i) => {
        const offline = s.pct ?? 0;
        const online = 0; // online marks not yet implemented
        const pct = marksMode === 'offline' ? offline : marksMode === 'online' ? online : Math.round((offline + online) / 2);
        return { name: s.name, code: s.code, color: s.color ?? SUBJECT_COLORS[i % SUBJECT_COLORS.length], pct };
    });
    const avg = chartData.length > 0
        ? Math.round(chartData.reduce((a, b) => a + b.pct, 0) / chartData.length)
        : 0;
    const overallRank: number | null = marksheetData?.classRank ?? null;

    const yellowFlags = FLAGS.filter(f => f.type === 'yellow');
    const redFlags = FLAGS.filter(f => f.type === 'red');

    const handleCopy = () => {
        navigator.clipboard.writeText(student.studentId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Page Header */}
            <div className="shrink-0 px-1 pb-3">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <User size={21} /> Profile
                </h1>
                <p className="text-[13px] text-muted-foreground">Your personal &amp; academic details</p>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto space-y-5 pb-8 px-1">

                {/* ── ID Card ── */}
                <div className="rounded-2xl overflow-hidden border border-border/50 shadow-lg">
                    {/* Purple header strip */}
                    <div className="px-6 py-4 flex items-center justify-between dark:[background:linear-gradient(135deg,#4C1D95,#2D1F50)]"
                        style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>
                        <div>
                            <p className="text-white font-bold text-base" style={{ fontFamily: 'var(--font-poppins)' }}>
                                {student.institutionName || 'School'}
                            </p>
                            <p className="text-white/70 text-xs">Student ID Card</p>
                        </div>
                        <button
                            onClick={() => router.push('/student/detail')}
                            className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-all">
                            <span className="leading-none" style={{ position: 'relative', top: '-1px' }}>View</span>
                            <ChevronRight size={13} style={{ position: 'relative', top: '0px' }} />
                        </button>
                    </div>

                    {/* Card body */}
                    <div className="bg-card p-5 flex items-start gap-5">
                        {/* Avatar */}
                        <div className="shrink-0">
                            <div className="relative w-20 h-20">
                                <div
                                    className={`relative w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white overflow-hidden${student.photo ? ' cursor-pointer' : ''}`}
                                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}
                                    onClick={() => student.photo && setPhotoExpanded(true)}
                                >
                                    {student.photo
                                        ? <NextImage src={student.photo} alt="profile" fill sizes="160px" quality={100} className="object-cover" unoptimized={student.photo.startsWith('data:')} />
                                        : student.name.split(' ').map(n => n[0]).join('').slice(0, 2)
                                    }
                                </div>
                                <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-4 h-4 rounded-full bg-emerald-400 border-2 border-card" />
                            </div>

                            <AnimatePresence>
                                {photoExpanded && student.photo && (
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
                                            <img src={student.photo} alt="profile" className="w-full h-full object-cover" />
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
                                    {student.standard}
                                </span>
                            </div>
                        </div>
                        {/* console.log(student.photo); */}
                        

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-lg font-bold leading-tight">{student.name}</p>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
                                </div>
                            </div>
                            <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold mt-0.5">
                                {student.standard} · {student.division}
                            </p>
                            <div className="h-px bg-border/50 my-3" />
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                                <InfoRow label="Roll No" value={student.rollNo} />
                                <InfoRow label="Class" value={`${student.standard} · ${student.division}`} />
                                <InfoRow label="Admission Year" value={student.admissionYear} />
                                <InfoRow label="Date of Birth" value={student.dob ? `${dobDisplay} (${age} yrs)` : '—'} />
                                <InfoRow label="Email" value={student.email} />
                            </div>
                        </div>
                    </div>

                    {/* UID strip */}
                    <div className="flex items-center gap-1.5 px-5 py-2.5 bg-violet-50 dark:bg-violet-950/30 border-t border-violet-200/50 dark:border-violet-900/50">
                        <Hash size={14} className="text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm font-semibold tracking-wider flex-1" style={{ color: '#DA7756' }}>{student.studentId}</span>
                        <button onClick={handleCopy}
                            className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-all">
                            <Copy size={11} />
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>

                {/* ── Rank + Score + Subject Performance ── */}
                <div className="grid grid-cols-3 gap-3 items-stretch">
                    {/* ── Rank + Score ── */}
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

                    {/* ── Subject Performance ── */}
                    <div className="col-span-2 h-full">
                        <SectionCard title="Subject Performance" icon={BarChart2} iconColor="#7C3AED"
                            titleExtra={
                                <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50 ml-1">
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
                            action={
                                <button onClick={() => router.push('/student/reportcard')} className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all">
                                    <span className="leading-none">View Report Card</span>
                                    <ChevronRight size={12} />
                                </button>
                            }>
                            {chartData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                                    <BarChart2 size={32} className="mb-2 opacity-30" />
                                    <p className="text-sm font-medium">No results published yet</p>
                                </div>
                            ) : (() => {
                                const AngledTick = (props: unknown) => {
                                    const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
                                    return (
                                        <g transform={`translate(${x},${y})`}>
                                            <text x={0} y={0} dy={8} textAnchor="end" fill="var(--muted-foreground)" fontSize={10} transform="rotate(-35)">{payload?.value}</text>
                                        </g>
                                    );
                                };
                                return (
                                    <>
                                        <ResponsiveContainer width="100%" height={240}>
                                            <BarChart data={chartData} margin={{ top: 16, bottom: 56, left: 0, right: 8 }}>
                                                <defs>
                                                    {chartData.map((d, i) => (
                                                        <linearGradient key={i} id={`subjBarGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                                                            <stop offset="100%" stopColor={d.color} stopOpacity={0.45} />
                                                        </linearGradient>
                                                    ))}
                                                </defs>
                                                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                                                <XAxis dataKey="name" tick={AngledTick} interval={0} axisLine={false} tickLine={false} height={70} />
                                                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={[0, 100]} width={32} />
                                                <Tooltip
                                                    cursor={false}
                                                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                                                    labelStyle={{ color: 'var(--card-foreground)', fontWeight: 600 }}
                                                    itemStyle={{ color: 'var(--card-foreground)' }}
                                                    formatter={(value: unknown) => [`${value}%`, 'Score']}
                                                />
                                                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                                                    <LabelList dataKey="pct" position="top" formatter={(v: unknown) => `${v}%`}
                                                        style={{ fontSize: 10, fontWeight: 600, fill: 'var(--foreground)' }} />
                                                    {chartData.map((d, i) => <Cell key={i} fill={`url(#subjBarGrad-${i})`} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 border-t-2 border-dashed border-violet-500/50" />
                                            <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">Avg {avg}%</span>
                                        </div>
                                    </>
                                );
                            })()}
                        </SectionCard>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-stretch">
                    {/* ── Attendance ── */}
                    <SectionCard title="Attendance" icon={Calendar} iconColor="#10B981"
                        action={
                            <button onClick={() => router.push('/student/attendance')} className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all">
                                <span className="leading-none">View Details</span>
                                <ChevronRight size={12} />
                            </button>
                        }>

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

                        {/* Overall */}
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/50 flex items-center justify-between mb-4">
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Overall Attendance</span>
                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                {overallAttendancePct !== null ? `${overallAttendancePct}%` : '—'}
                            </span>
                        </div>

                        {/* Trend chart */}
                        <p className="text-xs font-semibold mb-2">Overall Attendance Trend</p>
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={attendanceTrendData} margin={{ top: 28, right: 8, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="attendTrendGrad" x1="0" y1="0" x2="0" y2="1">
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
                                    contentStyle={{ background: '#1A1030', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 11 }}
                                    labelStyle={{ color: '#F1F5F9' }}
                                    formatter={(val: any) => [`${val}%`, 'Attendance']}
                                    itemStyle={{ color: '#10B981' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#10B981"
                                    strokeWidth={2}
                                    fill="url(#attendTrendGrad)"
                                    dot={(dotProps: any) => {
                                        const { cx, cy, payload } = dotProps;
                                        const value = payload.value;
                                        const vals = attendanceTrendData.map((d) => d.value);
                                        const isMax = value === Math.max(...vals);
                                        const isMin = value === Math.min(...vals);
                                        const labelColor = isMin ? '#EF4444' : '#10B981';
                                        return (
                                            <g style={{ overflow: 'visible' }}>
                                                <circle cx={cx} cy={cy} r={4} fill="#10B981" />
                                                {(isMax || isMin) && (
                                                    <>
                                                        <rect x={cx - 14} y={isMin ? cy + 7 : cy - 21} width={28} height={14} rx={3} fill={labelColor} />
                                                        <text x={cx} y={isMin ? cy + 17 : cy - 10} textAnchor="middle" fill="white" fontSize={9} fontWeight="600">{value}%</text>
                                                    </>
                                                )}
                                            </g>
                                        );
                                    }}
                                    activeDot={{ r: 6 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>

                        {/* Legend */}
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

                    {/* ── Fees ── */}
                    <SectionCard title="Fees" icon={IndianRupee} iconColor="#10B981"
                        action={
                            <button onClick={() => router.push('/student/fees')} className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all">
                                <span className="leading-none">Pay Fees</span>
                                <ChevronRight size={12} />
                            </button>
                        }>

                        {/* Term progress bars */}
                        <div className="space-y-2.5 mb-4">
                            {termData.map((term) => {
                                const paid = term.months.filter(m => m.status === 'PAID').length;
                                const total = term.months.length;
                                const pct = Math.round((paid / total) * 100);
                                const cleared = paid === total;
                                const paidAmt = term.months.filter(m => m.status === 'PAID').reduce((n, m) => n + m.amount, 0);
                                const totalAmt = term.months.reduce((n, m) => n + m.amount, 0);
                                return (
                                    <div key={term.label} className="p-3 bg-muted/40 rounded-xl space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-semibold">{term.label}</span>
                                                <span className="text-[10px] text-muted-foreground ml-1.5">{term.range}</span>
                                            </div>
                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cleared ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : paid === 0 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                                {cleared ? '✅ Paid' : `${paid}/${total} paid`}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%`, backgroundColor: cleared ? '#10B981' : '#F59E0B' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Monthly payment schedule table */}
                        <div className="rounded-xl border border-border/40 overflow-hidden">
                            {/* Fixed header */}
                            <table className="text-xs w-full" style={{ tableLayout: 'fixed' }}>
                                <colgroup>
                                    <col style={{ width: '18%' }} />
                                    <col style={{ width: '16%' }} />
                                    <col style={{ width: '22%' }} />
                                    <col style={{ width: '22%' }} />
                                    <col style={{ width: '22%' }} />
                                </colgroup>
                                <thead>
                                    <tr className="bg-card border-b border-border/30">
                                        {['Month', 'Amount', 'Due Date', 'Paid Date', 'Status'].map((col, i) => (
                                            <th key={i} className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                            </table>
                            {/* Scrollable body */}
                            <div className="overflow-y-auto max-h-[344px]" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent', willChange: 'transform', transform: 'translateZ(0)' }}>
                                <table className="text-xs w-full" style={{ tableLayout: 'fixed' }}>
                                    <colgroup>
                                        <col style={{ width: '18%' }} />
                                        <col style={{ width: '16%' }} />
                                        <col style={{ width: '22%' }} />
                                        <col style={{ width: '22%' }} />
                                        <col style={{ width: '22%' }} />
                                    </colgroup>
                                    <tbody className="divide-y divide-border/20">
                                        {FEE_MONTHS_PROFILE.map((m, i) => (
                                            <tr key={i}>
                                                <td className="px-3 py-2 font-semibold text-[11px]">{m.month}</td>
                                                <td className="px-3 py-2 text-[11px]">₹{m.amount.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.dueDate}</td>
                                                <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.paidDate ?? '—'}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                                        {m.status === 'PAID' ? '✓ Paid' : '⏳ Pending'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                <div className="grid grid-cols-2 gap-3 items-stretch">
                    {/* ── Flags ── */}
                    <SectionCard title="Remarks: Flags & Warnings" icon={Flag} iconColor="#EF4444"
                        action={
                            <button onClick={() => router.push('/student/flags')} className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all">
                                <span className="leading-none">View All</span>
                                <ChevronRight size={12} />
                            </button>
                        }>

                        {/* Stat cards */}
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

                        {/* Most recent — one of each type */}
                        {FLAGS.length === 0 ? (
                            <div className="text-center py-6">
                                <p className="text-2xl mb-1">✅</p>
                                <p className="text-xs text-muted-foreground">No flags! Keep it up.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {[
                                    [...FLAGS].filter(f => f.type === 'yellow').sort((a, b) => new Date(a.date).getTime() < new Date(b.date).getTime() ? 1 : -1)[0],
                                    [...FLAGS].filter(f => f.type === 'red').sort((a, b) => new Date(a.date).getTime() < new Date(b.date).getTime() ? 1 : -1)[0],
                                ]
                                    .filter((f): f is typeof FLAGS[0] => f !== undefined)
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

                    {/* ── Achievements ─ */}
                    <SectionCard title="Projects & Achievements" icon={Award} iconColor="#F59E0B"
                        action={
                            <span className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted text-muted-foreground cursor-default select-none">
                                Coming Soon
                            </span>
                        }>
                        <div className="space-y-2.5">
                            {ACHIEVEMENTS.map((a, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200/40 dark:border-amber-900/30">
                                    <span className="text-2xl">{a.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold">{a.title}</p>
                                        <p className="text-[11px] text-muted-foreground">{a.desc}</p>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{a.date}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200/50 dark:border-violet-900/50 flex items-center gap-2">
                            <User size={13} className="text-violet-500 shrink-0" />
                            <p className="text-[11px] text-violet-600 dark:text-violet-400">Share your projects & certificates to build your academic profile</p>
                        </div>
                    </SectionCard>
                </div>

                {/* ── Settings ── */}
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Settings</p>
                    {[
                        { icon: Bell, label: 'Notifications', color: '#2563EB' },
                        { icon: Settings, label: 'App Settings', color: '#7C3AED' },
                    ].map(({ icon: Icon, label, color }) => (
                        <button key={label}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: color + '20' }}>
                                <Icon size={16} style={{ color }} />
                            </div>
                            <span className="flex-1 text-sm font-medium text-left">{label}</span>
                            <ChevronRight size={15} className="text-muted-foreground" />
                        </button>
                    ))}

                    {/* Logout */}
                    <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-100 dark:bg-red-950">
                            <LogOut size={16} className="text-red-500" />
                        </div>
                        <span className="flex-1 text-sm font-medium text-red-500 text-left">Logout</span>
                        <ChevronRight size={15} className="text-red-400" />
                    </button>
                </div>

                {/* Watermark */}
                <div className="text-center py-2 space-y-0.5">
                    <p className="text-sm font-semibold text-muted-foreground/60">QubeEx v1.0</p>
                    <p className="text-xs text-muted-foreground/50">© 2026 All rights reserved.</p>
                </div>

            </div>
        </div>
    );
}