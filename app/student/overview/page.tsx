'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { BirthdayBanner, isTodayBirthday } from '@/components/shared/BirthdayBanner';
import { SillyStringOverlay } from '@/components/shared/SillyStringOverlay';
import { useThemeAccent } from '@/hooks/useThemeAccent';

interface OverviewData {
    student: { name: string; rollNo: string; divisionName: string; standardName: string };
    attendance: { pct: number | null; present: number; total: number };
    marks: { pct: number | null; classRank: number | null; totalStudents: number };
    pendingTasks: number;
    nextEvent: { type: string; label: string; date: string; daysAway: number } | null;
    latestPost: { title: string; type: string } | null;
    leaderboard: { rank: number; name: string; rollNo: string; pct: number; isMe: boolean; avatarUrl: string | null }[];
}

const THOUGHTS = [
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "Education is the most powerful weapon you can use to change the world.", author: "Nelson Mandela" },
    { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
];

function getTodaysThought() {
    const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return THOUGHTS[day % THOUGHTS.length];
}

function formatDivision(divisionName: string): string {
    if (!divisionName) return '';
    // "10-A" → "Division A", "12-B" → "Division B", "A" → "Division A"
    const parts = divisionName.split('-');
    const letter = parts.length > 1 ? parts.slice(1).join('-') : divisionName;
    return `Division ${letter}`;
}

const STUDENT_CHARACTERS = [
    '/images/school_boy1.png',
    '/images/school_girl1.png',
    '/images/school_boy2.png',
    '/images/school_girl2.png',
];

const now = new Date();
const hour = now.getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

interface StatCardProps { icon: string; label: string; value: string; color: string; bg: string; href: string }
function StatCard({ icon, label, value, color, bg, href }: StatCardProps) {
    return (
        <Link href={href}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 p-3.5 rounded-xl ${bg} hover:scale-[1.02] transition-all cursor-pointer h-full`}>
                <span className="text-xl">{icon}</span>
                <div>
                    <p className="text-base font-bold text-foreground">{value}</p>
                    <p className={`text-[11px] font-medium ${color}`}>{label}</p>
                </div>
            </motion.div>
        </Link>
    );
}

const RANK_STYLES: Record<number, { border: string; bg: string; text: string; podiumColor: string; podiumH: number }> = {
    1: { border: 'border-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/60',   text: 'text-amber-700 dark:text-amber-300',  podiumColor: '#F59E0B', podiumH: 72 },
    2: { border: 'border-slate-400',  bg: 'bg-slate-100 dark:bg-slate-800/60',  text: 'text-slate-600 dark:text-slate-300',  podiumColor: '#94A3B8', podiumH: 52 },
    3: { border: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/60', text: 'text-orange-700 dark:text-orange-300', podiumColor: '#CD7C2F', podiumH: 38 },
    4: { border: 'border-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-300', podiumColor: '#7C3AED', podiumH: 0 },
    5: { border: 'border-cyan-400',   bg: 'bg-cyan-50 dark:bg-cyan-950/40',    text: 'text-cyan-700 dark:text-cyan-300',    podiumColor: '#0891B2', podiumH: 0 },
};
const MEDALS = ['🥈', '🥇', '🥉'];

export default function StudentOverview() {
    const [data, setData] = useState<OverviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [announcementVisible, setAnnouncementVisible] = useState(true);
    const thought = getTodaysThought();
    const [currentChar, setCurrentChar] = useState(0);
    const [studentDob, setStudentDob] = useState<string | null>(null);

    const heroColor = useThemeAccent('--hero-accent');

    useEffect(() => {
        const iv = setInterval(() => setCurrentChar(p => (p + 1) % STUDENT_CHARACTERS.length), 7000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        api.get('/student/overview')
            .then(r => setData(r.data.data))
            .catch(() => {})
            .finally(() => setLoading(false));
        // Fetch profile for birthday data — silent fail (non-critical)
        api.get('/student/me')
            .then(res => {
                const d = res.data?.data ?? res.data;
                setStudentDob(d?.dob ?? null);
            })
            .catch(() => {});
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    const studentName = data?.student.name || 'Student';
    const lb = data?.leaderboard ?? [];
    const divisionLabel = formatDivision(data?.student.divisionName ?? '');

    const nextExamValue = data?.nextEvent
        ? data.nextEvent.daysAway === 0 ? 'Today'
        : data.nextEvent.daysAway === 1 ? '1 Day'
        : `${data.nextEvent.daysAway} Days`
        : '—';

    const quickStats: StatCardProps[] = [
        { label: 'Attendance',    value: data?.attendance.pct != null ? `${data.attendance.pct}%` : '—', icon: '📊', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950/50', href: '/student/attendance' },
        { label: data?.nextEvent?.label?.slice(0, 16) || 'Next Event', value: nextExamValue, icon: '⏰', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-950/50', href: '/student/feed' },
        { label: 'Pending Tasks', value: String(data?.pendingTasks ?? 0),                                icon: '📝', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-950/50', href: '/student/class' },
        { label: 'Overall Score', value: data?.marks.pct != null ? `${data.marks.pct}%` : '—',          icon: '⭐', color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-100 dark:bg-amber-950/50',  href: '/student/reportcard' },
    ];

    // Podium layout: [2nd | 1st | 3rd] (silver | gold | bronze)
    const podiumSlots = [lb[1], lb[0], lb[2]];

    return (
        <div className="space-y-5 pb-8">

            {/* ── Greeting Banner ── */}
            <div className="-mx-4 relative overflow-hidden rounded-b-[65px] px-5 py-6 sm:px-8 sm:py-8 lg:px-13 lg:py-5 flex items-center justify-between min-h-[160px]" style={{ background: heroColor }}>
                <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
                <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-20 left-36 animate-pulse delay-300" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-12 left-5 animate-pulse delay-500" />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-4 left-52 animate-pulse delay-700" />

                <div className="space-y-1 z-10">
                    <p className="text-white/70 text-base">{greeting} 👋</p>
                    <div className="relative">
                        <p className="text-white text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                            {studentName}
                        </p>
                        <SillyStringOverlay name={studentName} fontSize={30} active={isTodayBirthday(studentDob ?? '')} />
                    </div>
                    <p className="text-white/60 text-sm">
                        {data?.student.standardName}{divisionLabel ? ` · ${divisionLabel}` : ''}
                    </p>
                    <p className="text-white/50 text-xs mt-2">{dateStr}</p>
                </div>

                {/* Animated character — matches admin/teacher overview hero */}
                <div className="z-10 relative w-[250px] h-[200px] hidden sm:block self-end mb-[-40px]">
                    <motion.div
                        animate={{ y: [-20, -24, -20] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.img
                                key={currentChar}
                                src={STUDENT_CHARACTERS[currentChar]}
                                alt="student character"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1.2 }}
                                className="w-[300px] h-[230px] object-contain"
                                style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' }}
                            />
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>

            <div className="-mt-2">
                <BirthdayBanner
                    name={studentName}
                    role="student"
                    dob={studentDob ?? ''}
                />
            </div>

            {/* ── Announcement Strip ── */}
            <div className="-mt-2">
                <AnimatePresence>
                    {announcementVisible && data?.latestPost && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
                            <Bell size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex-1 truncate">
                                📢 {data.latestPost.title}
                            </p>
                            <button onClick={() => setAnnouncementVisible(false)} className="text-amber-500 hover:text-amber-700 transition-colors shrink-0">
                                <X size={13} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Quick Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 -mt-2">
                {quickStats.map((s) => (
                    <StatCard key={s.label} {...s} />
                ))}
            </div>

            {/* ── Blackboard + Leaderboard ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">

                {/* ── Blackboard ── */}
                <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '10px', boxShadow: '0 6px 24px rgba(0,0,0,0.3)', border: '12px solid #6B3F1F', outline: '2px solid #4A2A0E' }}>
                    {/* Top rail */}
                    <div style={{ height: '20px', flexShrink: 0, background: 'repeating-linear-gradient(90deg, #7A4F2A 0px, #9A6A3A 6px, #6B3F1F 12px, #8A5A2A 18px, #7A4F2A 24px)', position: 'relative' }}>
                        {([0, 1] as const).map((i) => (
                            <div key={i} style={{ position: 'absolute', [i === 0 ? 'left' : 'right']: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #E8C070, #C8A050, #8B6030)', border: '1px solid #6B4010' }}>
                                <div style={{ position: 'absolute', top: 3, left: 3, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                            </div>
                        ))}
                    </div>
                    {/* Green board */}
                    <div style={{ flex: 1, background: 'linear-gradient(160deg, #2e5c28 0%, #1e4018 50%, #2a5624 100%)', padding: '16px 20px', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 8, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }} />
                        <p style={{ fontFamily: '"Caveat", cursive', fontSize: '17px', color: 'rgba(255,255,255,0.38)', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                            {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, position: 'relative', zIndex: 1 }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                            <p style={{ fontFamily: '"Caveat", cursive', fontSize: '18px', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', textTransform: 'uppercase' }}>✦ Thought of the Day ✦</p>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                        </div>
                        <p style={{ fontFamily: '"Caveat", cursive', fontSize: '72px', color: 'rgba(255,255,255,0.08)', lineHeight: '0.6', marginBottom: 8, position: 'relative', zIndex: 1 }}>&quot;</p>
                        <p style={{ fontFamily: '"Caveat", cursive', fontSize: '27px', color: 'rgba(255,255,255,0.92)', lineHeight: '1.5', marginBottom: 12, textShadow: '0 0 8px rgba(255,255,255,0.15)', position: 'relative', zIndex: 1 }}>
                            {thought.text}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>
                            <div style={{ width: 50, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                            <p style={{ fontFamily: '"Caveat", cursive', fontSize: '21px', color: 'rgba(255,255,255,0.5)' }}>— {thought.author}</p>
                        </div>
                    </div>
                    {/* Chalk tray */}
                    <div style={{ flexShrink: 0, height: '32px', background: 'repeating-linear-gradient(90deg, #5C3A1E 0px, #7A5030 5px, #4A2E10 10px, #6A4020 15px, #5C3A1E 20px)', borderTop: '1px solid rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', paddingLeft: '14px', gap: '8px' }}>
                        {[{ top: '#F5F5F0', shadow: '#C8C8C0' }, { top: '#FFB3B3', shadow: '#E08080' }, { top: '#B3D9FF', shadow: '#80B0E0' }, { top: '#C8FFB3', shadow: '#90D870' }, { top: '#FFE4B3', shadow: '#E0BC70' }].map((c, i) => (
                            <div key={i} style={{ position: 'relative', width: 28, height: 10 }}>
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 9, borderRadius: 5, background: c.shadow }} />
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 9, borderRadius: 5, background: c.top }} />
                            </div>
                        ))}
                    </div>
                    {/* Bottom rail */}
                    <div style={{ height: '20px', flexShrink: 0, background: 'repeating-linear-gradient(90deg, #7A4F2A 0px, #9A6A3A 6px, #6B3F1F 12px, #8A5A2A 18px, #7A4F2A 24px)', borderTop: '1px solid rgba(0,0,0,0.25)', position: 'relative' }}>
                        {([0, 1] as const).map((i) => (
                            <div key={i} style={{ position: 'absolute', [i === 0 ? 'left' : 'right']: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #E8C070, #C8A050, #8B6030)', border: '1px solid #6B4010' }}>
                                <div style={{ position: 'absolute', top: 3, left: 3, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Leaderboard ── */}
                <div className="bg-card border border-border/50 rounded-xl p-5 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🏆</span>
                            <p className="text-sm font-semibold">Class Leaderboard</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{divisionLabel ? `${divisionLabel} · Offline` : 'Top 5'}</p>
                    </div>

                    {lb.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-8">
                            <span className="text-4xl">🏆</span>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Leaderboard available<br />once marks are published
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Podium — top 3 */}
                            {lb.length >= 3 && (
                                <div className="flex items-end justify-center gap-4">
                                    {podiumSlots.map((s, idx) => {
                                        if (!s) return null;
                                        const rs = RANK_STYLES[s.rank] ?? RANK_STYLES[4];
                                        const isCenter = idx === 1; // 1st place in center
                                        return (
                                            <div key={s.rank} className="flex flex-col items-center gap-1 min-w-0">
                                                {/* Avatar */}
                                                {s.avatarUrl ? (
                                                    <div
                                                        className={`rounded-full overflow-hidden border-2 ${rs.border}`}
                                                        style={{ width: isCenter ? 48 : 38, height: isCenter ? 48 : 38 }}
                                                    >
                                                        <img src={s.avatarUrl} alt={s.name} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`rounded-full flex items-center justify-center font-bold border-2 ${rs.border} ${rs.bg} ${rs.text}`}
                                                        style={{ width: isCenter ? 48 : 38, height: isCenter ? 48 : 38, fontSize: isCenter ? 16 : 13 }}
                                                    >
                                                        {s.name[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="max-w-[64px] text-center">
                                                    <p className="text-[10px] font-semibold truncate leading-tight">{s.name.split(' ')[0]}</p>
                                                    <p className="text-[9px] font-semibold truncate leading-tight">{s.name.split(' ').slice(1).join(' ')}</p>
                                                </div>
                                                {s.isMe && <p className="text-[9px] font-bold text-violet-500 -mt-0.5">YOU</p>}
                                                <p className={`text-[11px] font-bold ${rs.text}`}>{s.pct}%</p>
                                                {/* Podium block */}
                                                <div
                                                    className="w-16 rounded-t-lg flex items-center justify-center text-xl"
                                                    style={{ height: rs.podiumH, backgroundColor: rs.podiumColor }}
                                                >
                                                    {MEDALS[idx]}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 4th & 5th */}
                            {lb.length > 3 && (
                                <div className="space-y-2">
                                    {lb.slice(3).map(s => {
                                        const rs = RANK_STYLES[s.rank] ?? RANK_STYLES[4];
                                        return (
                                            <div
                                                key={s.rank}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${s.isMe ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30' : `${rs.border} ${rs.bg}`}`}
                                            >
                                                <span className="text-sm">{s.rank === 4 ? '4️⃣' : '5️⃣'}</span>
                                                {s.avatarUrl ? (
                                                    <div className={`w-7 h-7 rounded-full overflow-hidden border-2 ${rs.border}`}>
                                                        <img src={s.avatarUrl} alt={s.name} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ${rs.border} ${rs.bg} ${rs.text}`}>
                                                        {s.name[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <p className={`flex-1 text-xs font-semibold truncate ${s.isMe ? 'text-violet-700 dark:text-violet-300' : 'text-foreground'}`}>
                                                    {s.name}{s.isMe ? ' (You)' : ''}
                                                </p>
                                                <p className={`text-xs font-bold shrink-0 ${s.isMe ? 'text-violet-600 dark:text-violet-400' : rs.text}`}>{s.pct}%</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
