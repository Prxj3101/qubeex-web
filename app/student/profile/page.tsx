'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentStore } from '@/store/studentStore';
import { motion } from 'framer-motion';
import {
    Trophy, Star, BarChart2, Calendar, Flag, IndianRupee,
    Award, ChevronRight, ArrowUpRight, Bell, Settings,
    LogOut, CheckCircle2, Clock, AlertTriangle, User,
    Mail, Hash, BookOpen, MapPin, Phone, Copy,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line, Cell, LabelList,
    AreaChart, Area, ReferenceLine,
} from 'recharts';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const STUDENT = {
    name: 'Prajwal Jagdish Kotian',
    rollNo: '09',
    standard: 'Class 10',
    div: 'Division A',
    academicYear: '2026-27',
    dob: '2001-05-31',
    email: 'prajwal.kotian@gmail.com',
    totalStudents: 62,
    uid: 'STU-2026-0009',
};

type MarksMode = 'offline' | 'online' | 'combined';

const OVERALL_RANK: Record<MarksMode, number> = { offline: 6, online: 3, combined: 4 };

const SUBJECT_PERFORMANCE = [
    { name: 'English', code: 'ENG', color: '#DA7756', offline: 78, online: 82 },
    { name: 'Hindi', code: 'HIN', color: '#EC4899', offline: 70, online: 75 },
    { name: 'Marathi', code: 'MAR', color: '#0891B2', offline: 65, online: 70 },
    { name: 'Algebra', code: 'ALG', color: '#7C3AED', offline: 80, online: 85 },
    { name: 'Geometry', code: 'GEO', color: '#059669', offline: 72, online: 78 },
    { name: 'Science 1', code: 'SC1', color: '#0EA5E9', offline: 68, online: 74 },
    { name: 'Science 2', code: 'SC2', color: '#6366F1', offline: 75, online: 80 },
    { name: 'History', code: 'HIS', color: '#D97706', offline: 60, online: 66 },
    { name: 'Geography', code: 'GEOG', color: '#16A34A', offline: 73, online: 77 },
];

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

const FLAGS = [
    { type: 'yellow', title: 'Late Submission', category: 'Late Submission', date: '12 Mar 2026', subject: 'DC', detail: 'Assignment submitted 2 days after deadline.', actionTaken: 'Warning issued. Next offense will result in red card.' },
    { type: 'yellow', title: 'Classroom Misconduct', category: 'Classroom Misconduct', date: '5 Feb 2026', subject: 'SMA', detail: 'Disturbing class during lecture.', actionTaken: 'Verbal warning given by faculty.' },
    { type: 'red', title: 'Tab Switch Violation', category: 'Tab Switch Violation', date: '20 Jan 2026', subject: 'DC', detail: 'Switched tabs 3 times during online test.', actionTaken: 'Test invalidated. Zero marks awarded.' },
];

const FEES = [
    { year: 'Year 1 (2022-23)', total: 85000, paid: 85000 },
    { year: 'Year 2 (2023-24)', total: 85000, paid: 85000 },
    { year: 'Year 3 (2024-25)', total: 90000, paid: 60000 },
    { year: 'Year 4 (2025-26)', total: 90000, paid: 0 },
];

const ACHIEVEMENTS = [
    { icon: '🏆', title: 'Top 5 Overall', desc: 'Ranked 4th in batch', date: 'Mar 2025' },
    { icon: '🎯', title: 'Perfect Score', desc: '100% in DBMS Quiz 1', date: 'Jan 2025' },
    { icon: '📜', title: 'Hackathon Winner', desc: 'Smart India Hackathon 2024', date: 'Dec 2024' },
];

const CATEGORY_ICONS: Record<string, string> = {
    'Late Submission': '⏰',
    'Classroom Misconduct': '🗣️',
    'Tab Switch Violation': '🖥️',
    'Attendance Shortfall': '📉',
};

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

const totalFees = FEES.reduce((s, f) => s + f.total, 0);
const totalPaid = FEES.reduce((s, f) => s + f.paid, 0);

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, iconColor, children, action }: {
    title: string; icon: React.ElementType; iconColor: string;
    children: React.ReactNode; action?: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden h-full">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/20">
                <div className="flex items-center gap-2">
                    <Icon size={15} style={{ color: iconColor }} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
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

    const dobDate = new Date(student.dob);
    const age = new Date().getFullYear() - dobDate.getFullYear();
    const dobDisplay = dobDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const [marksMode, setMarksMode] = useState<MarksMode>('combined');
    const [expandedFlag, setExpandedFlag] = useState<number | null>(null);
    const [activeCardTab, setActiveCardTab] = useState<'yellow' | 'red'>('yellow');
    const [copied, setCopied] = useState(false);

    const chartData = SUBJECT_PERFORMANCE.map(s => ({
        name: s.code,
        fullName: s.name,
        color: s.color,
        pct: marksMode === 'offline' ? s.offline : marksMode === 'online' ? s.online : Math.round((s.offline + s.online) / 2),
    }));
    const avg = Math.round(chartData.reduce((a, b) => a + b.pct, 0) / chartData.length);
    const overallRank = OVERALL_RANK[marksMode];

    const yellowFlags = FLAGS.filter(f => f.type === 'yellow');
    const redFlags = FLAGS.filter(f => f.type === 'red');
    const activeFlags = activeCardTab === 'yellow' ? yellowFlags : redFlags;

    const handleCopy = () => {
        navigator.clipboard.writeText(STUDENT.uid);
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
                            Sacred Heart High School
                        </p>
                        <p className="text-white/70 text-xs">Student ID Card</p>
                    </div>
                    <button
                        onClick={() => router.push('/student/detail')}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-all">
                        View <ChevronRight size={13} />
                    </button>
                </div>

                {/* Card body */}
                <div className="bg-card p-5 flex items-start gap-5">
                    {/* Avatar */}
                    <div className="shrink-0">
                        <div className="relative w-20 h-20">
                            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white overflow-hidden"
                                style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}>
                                {student.photo
                                    ? <img src={student.photo} alt="profile" className="w-full h-full object-cover" />
                                    : student.name.split(' ').map(n => n[0]).join('').slice(0, 2)
                                }
                            </div>
                            <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-4 h-4 rounded-full bg-emerald-400 border-2 border-card" />
                        </div>
                        <div className="mt-2 text-center">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-semibold">
                                {STUDENT.standard}
                            </span>
                        </div>
                    </div>

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
                            {STUDENT.standard} · {STUDENT.div}
                        </p>
                        <div className="h-px bg-border/50 my-3" />
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                            <InfoRow label="Roll No" value={STUDENT.rollNo} />
                            <InfoRow label="Class" value="10-A" />
                            <InfoRow label="Admission Year" value={student.admissionYear} />
                            <InfoRow label="Date of Birth" value={`${dobDisplay} (${age} yrs)`} />
                            <InfoRow label="Email" value={student.email} />
                        </div>
                    </div>
                </div>

                {/* UID strip */}
                <div className="flex items-center gap-1.5 px-5 py-2.5 bg-violet-50 dark:bg-violet-950/30 border-t border-violet-200/50 dark:border-violet-900/50">
                    <Hash size={14} className="text-muted-foreground shrink-0" />
                    <span className="font-mono text-sm font-semibold tracking-wider flex-1" style={{ color: '#DA7756' }}>{STUDENT.uid}</span>
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
                            color:
                                overallRank === 1 ? '#F59E0B' :
                                    overallRank <= 3 ? '#7C3AED' :
                                        overallRank <= 10 ? 'var(--blue)' :
                                            'var(--muted-foreground)'
                        }}>
                            #{overallRank}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">out of {STUDENT.totalStudents} students</p>
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
                        action={
                            <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
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
                        }>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData}>
                                <defs>
                                    {chartData.map((d, i) => (
                                        <linearGradient key={i} id={`subjBarGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                                            <stop offset="100%" stopColor={d.color} stopOpacity={0.45} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                                <Tooltip
                                    cursor={false}
                                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                                    labelStyle={{ color: 'var(--card-foreground)', fontWeight: 600 }}
                                    itemStyle={{ color: 'var(--card-foreground)' }}
                                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
                                    formatter={(value: number) => [`${value}%`, 'Score']}
                                />
                                <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={32}>
                                    <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v}%`}
                                        style={{ fontSize: 10, fontWeight: 600, fill: 'var(--foreground)' }} />
                                    {chartData.map((d, i) => <Cell key={i} fill={`url(#subjBarGrad-${i})`} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>

                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 border-t-2 border-dashed border-violet-500/50" />
                            <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">Avg {avg}%</span>
                        </div>
                    </SectionCard>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-stretch">
                {/* ── Attendance ── */}
                <SectionCard title="Attendance" icon={Calendar} iconColor="#10B981"
                    action={
                        <a href="#" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 transition-all">
                            View Details <ChevronRight size={12} />
                        </a>
                    }>

                    <div className="space-y-3 mb-4">
                        {ATTENDANCE_WINDOW.map(({ month, value }) => {
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
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">82%</span>
                    </div>

                    {/* Trend chart */}
                    <p className="text-xs font-semibold mb-2">Overall Attendance Trend</p>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={ATTENDANCE_TREND} margin={{ top: 28, right: 8, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="attendTrendGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                            {ATTENDANCE_TREND.map((d) => (
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
                                    const vals = ATTENDANCE_TREND.map((d) => d.value);
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

                {/* ── Flags ── */}
                <SectionCard title="Remarks: Flags & Warnings" icon={Flag} iconColor="#EF4444"
                    action={
                        <div className="flex gap-2 text-xs text-muted-foreground">
                            <span className="text-amber-500 font-semibold">{yellowFlags.length} yellow</span>
                            <span>·</span>
                            <span className="text-red-500 font-semibold">{redFlags.length} red</span>
                        </div>
                    }>

                    {/* Tab buttons side by side */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <button onClick={() => setActiveCardTab('yellow')}
                            className={`flex items-center justify-center gap-3 p-3 rounded-xl border-2 transition-all ${activeCardTab === 'yellow' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20' : 'border-border/50 bg-muted/20'}`}>
                            <div className="w-3 h-5 rounded-sm bg-yellow-400 rotate-[-5deg] shadow-sm shrink-0" />
                            <div className="text-left">
                                <p className={`text-sm font-bold ${activeCardTab === 'yellow' ? 'text-yellow-700 dark:text-yellow-400' : 'text-muted-foreground'}`}>Yellow Card</p>
                                <p className="text-[11px] text-muted-foreground">{yellowFlags.length} flags</p>
                            </div>
                        </button>
                        <button onClick={() => setActiveCardTab('red')}
                            className={`flex items-center justify-center gap-3 p-3 rounded-xl border-2 transition-all ${activeCardTab === 'red' ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : 'border-border/50 bg-muted/20'}`}>
                            <div className="w-3 h-5 rounded-sm bg-red-600 rotate-[-5deg] shadow-sm shrink-0" />
                            <div className="text-left">
                                <p className={`text-sm font-bold ${activeCardTab === 'red' ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>Red Card</p>
                                <p className="text-[11px] text-muted-foreground">{redFlags.length} flags</p>
                            </div>
                        </button>
                    </div>

                    {/* Flag list */}
                    <div className="space-y-2">
                        {activeFlags.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-2xl mb-2">✅</p>
                                <p className="text-sm text-muted-foreground">No {activeCardTab} cards!</p>
                            </div>
                        ) : activeFlags.map((flag, i) => {
                            const isYellow = flag.type === 'yellow';
                            const expanded = expandedFlag === i;
                            return (
                                <div key={i}
                                    className={`rounded-xl border-2 overflow-hidden transition-all ${isYellow ? 'border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-950/20' : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20'}`}>
                                    <button className="w-full flex items-start gap-3 p-3 text-left" onClick={() => setExpandedFlag(expanded ? null : i)}>
                                        <div className={`w-3 h-5 rounded-sm shrink-0 mt-0.5 rotate-[-5deg] shadow-sm ${isYellow ? 'bg-yellow-400' : 'bg-red-600'}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="text-xs">{CATEGORY_ICONS[flag.category] ?? '⚠️'}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isYellow ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                                                    {flag.category}
                                                </span>
                                            </div>
                                            <p className={`text-xs font-semibold ${isYellow ? 'text-yellow-800 dark:text-yellow-300' : 'text-red-800 dark:text-red-300'}`}>{flag.title}</p>
                                            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                                                <span>📅 {flag.date}</span>
                                                {flag.subject && <span>📚 {flag.subject}</span>}
                                            </div>
                                        </div>
                                        <ChevronRight size={14} className={`shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                                    </button>

                                    {expanded && (
                                        <div className="px-3 pb-3 space-y-2">
                                            <div className={`p-2.5 rounded-lg ${isYellow ? 'bg-yellow-100 dark:bg-yellow-950/40' : 'bg-red-100 dark:bg-red-950/40'}`}>
                                                <p className={`text-[10px] font-bold mb-1 ${isYellow ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'}`}>📝 Incident Detail</p>
                                                <p className="text-[11px] text-foreground">{flag.detail}</p>
                                            </div>
                                            {flag.actionTaken && (
                                                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/50">
                                                    <p className="text-[10px] font-bold mb-1 text-emerald-700 dark:text-emerald-400">⚡ Action Taken</p>
                                                    <p className="text-[11px] text-foreground">{flag.actionTaken}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
            </div>

            <div className="grid grid-cols-2 gap-3 items-stretch">
                {/* ── Fees ── */}
                <SectionCard title="Fees" icon={IndianRupee} iconColor="#10B981"
                    action={
                        <button className="text-xs font-semibold px-3 py-1 rounded-full text-white transition-all hover:opacity-90"
                            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                            Pay Fees
                        </button>
                    }>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                            { label: 'Total Fees', value: `₹${(totalFees / 1000).toFixed(0)}k`, color: 'text-foreground' },
                            { label: 'Paid', value: `₹${(totalPaid / 1000).toFixed(0)}k`, color: 'text-emerald-600 dark:text-emerald-400' },
                            { label: 'Pending', value: `₹${((totalFees - totalPaid) / 1000).toFixed(0)}k`, color: 'text-amber-600 dark:text-amber-400' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="bg-muted/40 rounded-xl p-3 text-center">
                                <p className={`text-base font-black ${color}`}>{value}</p>
                                <p className="text-[11px] text-muted-foreground">{label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2.5">
                        {FEES.map((row) => {
                            const pct = Math.round((row.paid / row.total) * 100);
                            const cleared = row.paid === row.total;
                            const pending = row.total - row.paid;
                            return (
                                <div key={row.year} className="p-3 bg-muted/40 rounded-xl space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium">{row.year}</span>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cleared ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : pending === row.total ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                            {cleared ? '✅ Paid' : `₹${(pending / 1000).toFixed(0)}k due`}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%`, backgroundColor: cleared ? '#10B981' : '#F59E0B' }} />
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[10px] text-muted-foreground">Paid ₹{(row.paid / 1000).toFixed(0)}k</span>
                                        <span className="text-[10px] text-muted-foreground">Total ₹{(row.total / 1000).toFixed(0)}k</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Total Pending</span>
                        <span className="text-base font-black text-amber-600 dark:text-amber-400">₹1,20,000</span>
                    </div>
                </SectionCard>

                {/* ── Achievements ── */}
                <SectionCard title="Projects & Achievements" icon={Award} iconColor="#F59E0B">
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