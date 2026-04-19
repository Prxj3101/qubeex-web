'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Trophy, Star, BarChart2, Calendar, Flag, IndianRupee,
    Award, ChevronRight, ArrowUpRight, Bell, Settings,
    LogOut, CheckCircle2, Clock, AlertTriangle, User,
    Mail, Hash, BookOpen, MapPin, Phone, Copy,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line,
} from 'recharts';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const STUDENT = {
    name: 'Prajwal Jagdish Kotian',
    rollNo: '09',
    batch: 'B.Tech CSE',
    div: 'Division A',
    sem: 'Semester 5',
    dob: '2001-05-31',
    email: 'prajwal.kotian@gmail.com',
    overallRank: 4,
    totalStudents: 62,
    overallScore: 71,
    uid: 'STU-CLG-VIT01-0009',
};

const SUBJECTS = [
    { name: 'Data Structures', short: 'DS', color: '#F59E0B', rank: 3, scores: [65, 72, 68, 80, 75] },
    { name: 'Operating Systems', short: 'OS', color: '#2563EB', rank: 7, scores: [70, 65, 78, 72, 80] },
    { name: 'DBMS', short: 'DB', color: '#10B981', rank: 2, scores: [80, 85, 78, 90, 88] },
    { name: 'Computer Networks', short: 'CN', color: '#EF4444', rank: 5, scores: [60, 55, 68, 72, 65] },
];

const ATTENDANCE_DATA = [
    { label: 'Data Structures', theory: 92, practical: 83 },
    { label: 'Operating Systems', theory: 78, practical: 66 },
    { label: 'DBMS', theory: 88, practical: 91 },
    { label: 'Computer Networks', theory: 65, practical: 58 },
];

const ATTENDANCE_TREND = [
    { month: 'Jun', value: 75 },
    { month: 'Jul', value: 78 },
    { month: 'Aug', value: 95 },
    { month: 'Sep', value: 88 },
    { month: 'Oct', value: 82 },
    { month: 'Nov', value: 80 },
    { month: 'Dec', value: 65 },
    { month: 'Jan', value: 72 },
    { month: 'Feb', value: 82 },
];

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

const dobDate = new Date(STUDENT.dob);
const age = new Date().getFullYear() - dobDate.getFullYear();
const dobDisplay = dobDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
    const [activeSubject, setActiveSubject] = useState(0);
    const [expandedFlag, setExpandedFlag] = useState<number | null>(null);
    const [activeCardTab, setActiveCardTab] = useState<'yellow' | 'red'>('yellow');
    const [copied, setCopied] = useState(false);

    const subject = SUBJECTS[activeSubject];
    const chartData = subject.scores.map((s, i) => ({ name: `T${i + 1}`, score: s }));
    const avg = Math.round(subject.scores.reduce((a, b) => a + b, 0) / subject.scores.length);

    const yellowFlags = FLAGS.filter(f => f.type === 'yellow');
    const redFlags = FLAGS.filter(f => f.type === 'red');
    const activeFlags = activeCardTab === 'yellow' ? yellowFlags : redFlags;

    const handleCopy = () => {
        navigator.clipboard.writeText(STUDENT.uid);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-5 pb-8">

            {/* ── ID Card ── */}
            <div className="rounded-2xl overflow-hidden border border-border/50 shadow-lg">
                {/* Purple header strip */}
                <div className="px-6 py-4 flex items-center justify-between"
                    style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>
                    <div>
                        <p className="text-white font-bold text-base" style={{ fontFamily: 'var(--font-poppins)' }}>
                            Viva Institute of Technology
                        </p>
                        <p className="text-white/70 text-xs">Student ID Card</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-white/70 text-xs">Active</span>
                    </div>
                </div>

                {/* Card body */}
                <div className="bg-card p-5 flex items-start gap-5">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
                            style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}>
                            {STUDENT.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-card" />
                        <div className="mt-2 text-center">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-semibold">
                                {STUDENT.batch.split(' ')[0]}
                            </span>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-bold leading-tight">{STUDENT.name}</p>
                        <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold mt-0.5">
                            {STUDENT.sem} · {STUDENT.div}
                        </p>
                        <div className="h-px bg-border/50 my-3" />
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                            <InfoRow label="Roll No" value={STUDENT.rollNo} />
                            <InfoRow label="Batch" value={STUDENT.batch} />
                            <InfoRow label="Date of Birth" value={`${dobDisplay} (${age} yrs)`} />
                            <InfoRow label="Email" value={STUDENT.email} />
                        </div>
                    </div>
                </div>

                {/* UID strip */}
                <div className="flex items-center gap-3 px-5 py-2.5 bg-violet-50 dark:bg-violet-950/30 border-t border-violet-200/50 dark:border-violet-900/50">
                    <Mail size={12} className="text-violet-500 shrink-0" />
                    <span className="text-xs text-violet-600 dark:text-violet-400 flex-1">{STUDENT.uid}</span>
                    <button onClick={handleCopy}
                        className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 hover:bg-violet-200 transition-all">
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
                                STUDENT.overallRank === 1 ? '#F59E0B' :
                                    STUDENT.overallRank <= 3 ? '#7C3AED' :
                                        STUDENT.overallRank <= 10 ? '#2563EB' :
                                            'hsl(var(--muted-foreground))'
                        }}>
                            #{STUDENT.overallRank}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">out of {STUDENT.totalStudents} students</p>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Star size={14} className="text-amber-500 fill-amber-500" />
                            <p className="text-xs font-semibold text-muted-foreground">Overall Score</p>
                        </div>
                        <p className="text-4xl font-black text-violet-600 dark:text-violet-400">{STUDENT.overallScore}%</p>
                        <p className="text-xs text-muted-foreground mt-1">across all subjects</p>
                    </div>
                </div>

                {/* ── Subject Performance ── */}
                <div className="col-span-2 h-full">
                    <SectionCard title="Subject Performance" icon={BarChart2} iconColor="#7C3AED">
                        {/* Subject pills */}
                        <div className="flex gap-2 mb-4 flex-wrap">
                            {SUBJECTS.map((s, i) => (
                                <button key={s.name} onClick={() => setActiveSubject(i)}
                                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
                                    style={activeSubject === i
                                        ? { backgroundColor: s.color, color: 'white', borderColor: s.color }
                                        : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }
                                    }>
                                    {s.short}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold">{subject.name}</p>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-semibold">
                                🏅 Rank #{subject.rank} in subject
                            </span>
                        </div>

                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={chartData}>
                                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                                <Bar dataKey="score" fill={subject.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
                            </BarChart>
                        </ResponsiveContainer>

                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: subject.color + '80' }} />
                            <span className="text-[11px] font-semibold" style={{ color: subject.color }}>Avg {avg}%</span>
                        </div>
                    </SectionCard>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-stretch">
                {/* ── Attendance ── */}
                <SectionCard title="Attendance" icon={Calendar} iconColor="#10B981"
                    action={
                        <a href="#" className="text-xs text-primary hover:underline flex items-center gap-1">
                            View Details <ChevronRight size={12} />
                        </a>
                    }>

                    <div className="space-y-4 mb-4">
                        {ATTENDANCE_DATA.map(({ label, theory, practical }) => {
                            const tp = getPct(theory);
                            const pp = getPct(practical);
                            return (
                                <div key={label}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-xs font-medium">{label}</p>
                                        <div className="flex gap-1.5">
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tp.cls}`}>T: {theory}%</span>
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pp.cls}`}>P: {practical}%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground w-12">Theory</span>
                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
                                                <div className="absolute left-[75%] top-0 bottom-0 w-px bg-muted-foreground/30 z-10" />
                                                <div className="h-full rounded-full" style={{ width: `${theory}%`, backgroundColor: tp.color }} />
                                            </div>
                                            <span className="text-[10px] font-semibold" style={{ color: tp.color }}>{theory}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground w-12">Practical</span>
                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
                                                <div className="absolute left-[75%] top-0 bottom-0 w-px bg-muted-foreground/30 z-10" />
                                                <div className="h-full rounded-full" style={{ width: `${practical}%`, backgroundColor: pp.color }} />
                                            </div>
                                            <span className="text-[10px] font-semibold" style={{ color: pp.color }}>{practical}%</span>
                                        </div>
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
                    <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={ATTENDANCE_TREND}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={[50, 100]} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                            <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981', stroke: 'hsl(var(--card))', strokeWidth: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>

                    {/* Legend */}
                    <div className="flex gap-4 mt-2">
                        {[
                            { label: 'Safe ≥75%', color: '#10B981' },
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

        </div >
    );
}