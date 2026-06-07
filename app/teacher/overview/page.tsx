'use client';

import { useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Users, LayoutGrid, BookOpen, TrendingUp, ArrowUpRight, ArrowDownRight, Bell, X, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_TEACHER = {
    name: 'Ritu Sharma',
    institutionName: 'Viva Institute of Technology',
};

const MOCK_STATS = [
    { label: 'Classes Assigned', value: '5', sub: '+1 this month', trend: 'up', icon: LayoutGrid, iconBg: 'bg-violet-100 dark:bg-violet-950', iconColor: 'text-violet-600 dark:text-violet-400' },
    { label: 'Total Students', value: '210', sub: '+8 this week', trend: 'up', icon: Users, iconBg: 'bg-emerald-100 dark:bg-emerald-950', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Subjects Teaching', value: '3', sub: 'This semester', trend: 'up', icon: BookOpen, iconBg: 'bg-amber-100 dark:bg-amber-950', iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Avg Attendance', value: '87%', sub: '+2% this month', trend: 'up', icon: TrendingUp, iconBg: 'bg-sky-100 dark:bg-sky-950', iconColor: 'text-sky-600 dark:text-sky-400' },
];

const MOCK_ATTENDANCE_TREND = [
    { month: 'Jun', pct: 92 },
    { month: 'Jul', pct: 88 },
    { month: 'Aug', pct: 85 },
    { month: 'Sep', pct: 90 },
    { month: 'Oct', pct: 87 },
    { month: 'Nov', pct: 91 },
];

const MOCK_SHORT_ATTENDANCE = [
    { name: 'Sneha Patel', rollNo: '04', pct: 61 },
    { name: 'Karan Joshi', rollNo: '07', pct: 48 },
    { name: 'Ananya Nair', rollNo: '08', pct: 55 },
    { name: 'Ishaan Verma', rollNo: '10', pct: 69 },
];

const MOCK_RECENT_ACTIVITY = [
    { id: '1', action: 'Marked attendance for 10-A', time: '10 mins ago', icon: '✅' },
    { id: '2', action: 'Added remark for Sneha Patel', time: '1 hour ago', icon: '💬' },
    { id: '3', action: 'Exported attendance report', time: '2 hours ago', icon: '📥' },
    { id: '4', action: 'Marked holiday — Maharashtra Day', time: 'Yesterday', icon: '🏖️' },
    { id: '5', action: 'Updated student profile', time: '2 days ago', icon: '✏️' },
];

const MOCK_ANNOUNCEMENTS = [
    { id: '1', text: 'Staff meeting scheduled — Monday 9:00 AM in Conference Room' },
    { id: '2', text: 'Submit attendance reports by Friday EOD' },
];

const THOUGHTS = [
    { text: "The mediocre teacher tells. The good teacher explains. The superior teacher demonstrates. The great teacher inspires.", author: "William Arthur Ward" },
    { text: "Teaching is the greatest act of optimism.", author: "Colleen Wilcox" },
    { text: "A good teacher can inspire hope, ignite the imagination, and instill a love of learning.", author: "Brad Henry" },
    { text: "The art of teaching is the art of assisting discovery.", author: "Mark Van Doren" },
    { text: "Teachers, I believe, are the most responsible and important members of society.", author: "Kurt Vonnegut" },
];

function getTodaysThought() {
    const today = new Date();
    const day = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return THOUGHTS[day % THOUGHTS.length];
}

const now = new Date();
const hour = now.getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// ── Subcomponents ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
            <p className="font-semibold mb-1">{label}</p>
            <p className="text-violet-500 font-bold">{payload[0].value}%</p>
        </div>
    );
}

function Screw({ side }: { side: 'left' | 'right' }) {
    return (
        <div style={{ position: 'absolute', [side]: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #E8C070, #C8A050, #8B6030)', border: '1px solid #6B4010', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
            <div style={{ position: 'absolute', top: 3, left: 3, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
        </div>
    );
}

function WoodStrip({ position }: { position: 'top' | 'bottom' }) {
    return (
        <div style={{ height: '20px', flexShrink: 0, background: 'repeating-linear-gradient(90deg, #7A4F2A 0px, #9A6A3A 6px, #6B3F1F 12px, #8A5A2A 18px, #7A4F2A 24px)', borderTop: position === 'bottom' ? '1px solid rgba(0,0,0,0.25)' : undefined, position: 'relative' }}>
            <Screw side="left" />
            <Screw side="right" />
        </div>
    );
}

function Blackboard({ thought }: { thought: { text: string; author: string } }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '10px', overflow: 'visible', boxShadow: '0 6px 24px rgba(0,0,0,0.3)', border: '12px solid #6B3F1F', outline: '2px solid #4A2A0E', outlineOffset: '0px', height: '100%' }}>
            <WoodStrip position="top" />
            <div style={{ flex: 1, background: 'linear-gradient(160deg, #2e5c28 0%, #1e4018 50%, #2a5624 100%)', padding: '16px 20px', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 18, left: 20, width: 70, height: 5, background: 'rgba(255,255,255,0.035)', borderRadius: 4, transform: 'rotate(-1deg)' }} />
                    <div style={{ position: 'absolute', top: 55, right: 30, width: 45, height: 3, background: 'rgba(255,255,255,0.025)', borderRadius: 4, transform: 'rotate(1deg)' }} />
                    <div style={{ position: 'absolute', bottom: 40, left: 50, width: 80, height: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 4, transform: 'rotate(-0.5deg)' }} />
                    <div style={{ position: 'absolute', inset: 8, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }} />
                </div>
                <p style={{ fontFamily: '"Caveat", cursive', fontSize: '17px', color: 'rgba(255,255,255,0.38)', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                    {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, position: 'relative', zIndex: 1 }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                    <p style={{ fontFamily: '"Caveat", cursive', fontSize: '18px', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', textTransform: 'uppercase', textShadow: '0 0 8px rgba(255,255,255,0.2)' }}>✦ Thought of the Day ✦</p>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                </div>
                <p style={{ fontFamily: '"Caveat", cursive', fontSize: '72px', color: 'rgba(255,255,255,0.08)', lineHeight: '0.6', marginBottom: 8, position: 'relative', zIndex: 1 }}>&quot;</p>
                <p style={{ fontFamily: '"Caveat", cursive', fontSize: '22px', color: 'rgba(255,255,255,0.92)', lineHeight: '1.5', marginBottom: 12, textShadow: '0 0 8px rgba(255,255,255,0.15), 1px 1px 2px rgba(0,0,0,0.4)', position: 'relative', zIndex: 1 }}>
                    {thought.text}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: 50, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                    <p style={{ fontFamily: '"Caveat", cursive', fontSize: '21px', color: 'rgba(255,255,255,0.5)', textShadow: '0 0 6px rgba(255,255,255,0.1)' }}>— {thought.author}</p>
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
                <div style={{ marginLeft: 6, position: 'relative', width: 48, height: 20 }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 18, borderRadius: 3, background: '#A0603A', border: '1px solid #6B3F1F' }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 17, borderRadius: 3, background: '#D4956A' }} />
                    <div style={{ position: 'absolute', top: 3, left: 4, right: 4, height: 7, borderRadius: 1, background: '#8B4513', opacity: 0.55 }} />
                    <div style={{ position: 'absolute', bottom: 3, left: 4, right: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }} />
                </div>
            </div>
            <WoodStrip position="bottom" />
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherOverviewPage() {
    const { user } = useAuthStore();
    const [announcementVisible, setAnnouncementVisible] = useState(true);
    const thought = getTodaysThought();

    const teacherName = user?.name ?? user?.email?.split('@')[0] ?? MOCK_TEACHER.name;

    return (
        <div className="space-y-3">

            {/* ── Hero — same as OverviewHero ── */}
            <div className="-mx-4 relative overflow-hidden rounded-b-[65px] bg-[#7C3AED] dark:bg-[#4C1D95] px-13 py-10 flex items-center justify-between min-h-[200px]">
                <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
                <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-20 left-36 animate-pulse delay-300" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-12 left-5 animate-pulse delay-500" />
                <div className="space-y-1 z-10">
                    <p className="text-white/70 text-base">{greeting} 👋</p>
                    <p className="text-white text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>{teacherName}</p>
                    <p className="text-white/60 text-sm">Here&apos;s your teaching overview for today.</p>
                    <p className="text-white/50 text-xs mt-2">{dateStr}</p>
                </div>
                <div className="z-10 flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold text-white border-2 border-white/30">
                        {teacherName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-center">
                        <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">Class Teacher</span>
                        <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">{MOCK_TEACHER.institutionName}</span>
                    </div>
                </div>
            </div>

            {/* ── WelcomeBanner equivalent ── */}
            <AnimatePresence>
                {announcementVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50"
                    >
                        <Bell size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex-1">
                            📢 {MOCK_ANNOUNCEMENTS[0].text}
                        </p>
                        <button onClick={() => setAnnouncementVisible(false)} className="text-amber-500 hover:text-amber-700 transition-colors">
                            <X size={13} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── StatCards equivalent ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {MOCK_STATS.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="bg-muted/50 rounded-xl p-4 relative">
                            <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                                <Icon size={15} className={s.iconColor} />
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                            <p className="text-3xl font-semibold tracking-tight">{s.value}</p>
                            <div className="flex items-center gap-1 mt-1.5">
                                {s.trend === 'up'
                                    ? <ArrowUpRight size={13} className="text-emerald-600 dark:text-emerald-400" />
                                    : <ArrowDownRight size={13} className="text-red-500" />
                                }
                                <span className={`text-xs ${s.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{s.sub}</span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── EnrollmentGrowthChart + Blackboard + PlanUsageCard equivalent ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-stretch">

                {/* Attendance Trend Chart — 2 cols */}
                <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <CalendarDays size={15} className="text-muted-foreground" />
                        <p className="text-sm font-medium">Class Attendance Trend</p>
                        <span className="ml-auto text-[10px] text-muted-foreground/50 uppercase tracking-wide">10-A</span>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={MOCK_ATTENDANCE_TREND} barSize={20}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[70, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="pct" fill="#7C3AED" radius={[4, 4, 0, 0]} opacity={0.85} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Blackboard — 2 cols */}
                <div className="lg:col-span-2" style={{ minHeight: '240px' }}>
                    <Blackboard thought={thought} />
                </div>

                {/* Short Attendance — 1 col */}
                <div className="lg:col-span-1 bg-card border border-border/50 rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium">⚠️ Short Attendance</p>
                        <span className="text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-950/40 px-2 py-0.5 rounded-full">{MOCK_SHORT_ATTENDANCE.length}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">Students below 75%</p>
                    <div className="space-y-2 flex-1">
                        {MOCK_SHORT_ATTENDANCE.map((s, i) => (
                            <motion.div key={s.rollNo} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                                className="flex items-center gap-2 p-2 rounded-xl border border-border/50 bg-muted/20">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                    style={{ background: s.pct >= 65 ? '#D97706' : '#DC2626' }}>
                                    {s.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold truncate">{s.name}</p>
                                    <p className="text-[9px] text-muted-foreground">Roll {s.rollNo}</p>
                                </div>
                                <p className={`text-xs font-black shrink-0 ${s.pct >= 65 ? 'text-amber-500' : 'text-red-500'}`}>{s.pct}%</p>
                            </motion.div>
                        ))}
                    </div>
                    <a href="/teacher/classes" className="mt-3 flex items-center justify-center gap-1 h-7 rounded-lg border border-border/50 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                        View Classes <ArrowUpRight size={11} />
                    </a>
                </div>
            </div>

            {/* ── RecentActivityCard + NotificationsPreviewCard equivalent ── */}
            <div className="flex flex-col gap-3">

                {/* Recent Activity */}
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium">Recent Activity</p>
                        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">Last 7 days</span>
                    </div>
                    <div className="space-y-1">
                        {MOCK_RECENT_ACTIVITY.map((a, i) => (
                            <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                                <span className="text-base shrink-0">{a.icon}</span>
                                <p className="text-xs flex-1">{a.action}</p>
                                <span className="text-[10px] text-muted-foreground/50 shrink-0">{a.time}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Announcements */}
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium">📢 Announcements</p>
                        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">{MOCK_ANNOUNCEMENTS.length} new</span>
                    </div>
                    <div className="space-y-2">
                        {MOCK_ANNOUNCEMENTS.map((a, i) => (
                            <motion.div key={a.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                                className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30">
                                <Bell size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700 dark:text-amber-400">{a.text}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}