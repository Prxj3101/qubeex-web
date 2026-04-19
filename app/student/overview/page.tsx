'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy, Star, Bell, X, ChevronRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const STUDENT = {
    name: 'Prajwal Kotian',
    batch: 'B.Tech CSE — Sem 5, Div A',
    rollNo: '09',
    overallRank: 4,
    totalStudents: 62,
    overallScore: 71,
};

const LEADERBOARD = [
    { rank: 1, name: 'Rahul Sharma', pct: 98.5, color: '#F59E0B' },
    { rank: 2, name: 'Priya Mehta', pct: 96.2, color: '#94A3B8' },
    { rank: 3, name: 'Arjun Verma', pct: 94.8, color: '#CD7C2F' },
    { rank: 4, name: 'Prajwal Kotian', pct: 92.1, color: '#7C3AED', isMe: true },
    { rank: 5, name: 'Sneha Patel', pct: 90.4, color: '#64748B' },
];

const QUICK_STATS = [
    { label: 'Attendance', value: '82%', icon: '📊', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950/50', href: '/student/profile' },
    { label: 'Exam In', value: '5 Days', icon: '⏰', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-950/50', href: '/student/feed' },
    { label: 'Pending Tasks', value: '3', icon: '📝', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-950/50', href: '/student/tasks' },
    { label: 'Overall Score', value: '71%', icon: '⭐', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/50', href: '/student/profile' },
];

const THOUGHTS = [
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "Education is the most powerful weapon you can use to change the world.", author: "Nelson Mandela" },
    { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentOverview() {
    const [announcementVisible, setAnnouncementVisible] = useState(true);
    const thought = getTodaysThought();

    return (
        <div className="space-y-5 pb-8">

            {/* ── Greeting Banner ── */}
            <div className="-mx-4 relative overflow-hidden rounded-b-[65px] bg-[#7C3AED] dark:bg-[#4C1D95] px-13 py-10 flex items-center justify-between min-h-[200px]">                <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
                <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-20 left-36 animate-pulse delay-300" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-12 left-5 animate-pulse delay-500" />

                <div className="space-y-1 z-10">
                    <p className="text-white/70 text-base">{greeting} 👋</p>
                    <p className="text-white text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                        {STUDENT.name}
                    </p>
                    <p className="text-white/60 text-sm">Here's your academic overview for today.</p>
                    <p className="text-white/50 text-xs mt-2">{dateStr}</p>
                </div>

                <div className="z-10 flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold text-white border-2 border-white/30">
                        {STUDENT.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex gap-1.5">
                        <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">Roll #{STUDENT.rollNo}</span>
                        <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">Rank #{STUDENT.overallRank}</span>
                    </div>
                </div>
            </div>

            {/* ── Announcement Strip (below header) ── */}
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
                            📢 Exam schedule updated — Check calendar for new dates
                        </p>
                        <button onClick={() => setAnnouncementVisible(false)} className="text-amber-500 hover:text-amber-700 transition-colors">
                            <X size={13} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Quick Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {QUICK_STATS.map((s, i) => (
                    <motion.a
                        key={s.label}
                        href={s.href}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className={`flex items-center gap-3 p-3.5 rounded-xl ${s.bg} hover:scale-[1.02] transition-all cursor-pointer`}
                    >
                        <span className="text-xl">{s.icon}</span>
                        <div>
                            <p className="text-base font-bold text-foreground">{s.value}</p>
                            <p className={`text-[11px] font-medium ${s.color}`}>{s.label}</p>
                        </div>
                    </motion.a>
                ))}
            </div>

            {/* ── Thought of the Day + Leaderboard ── */}
            <div className="grid grid-cols-2 gap-4" style={{ alignItems: 'stretch' }}>

                {/* ── Blackboard ── */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '10px',
                    overflow: 'visible',
                    boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
                    border: '12px solid #6B3F1F',
                    outline: '2px solid #4A2A0E',
                    outlineOffset: '0px',
                    minHeight: '100%',
                }}>

                    {/* Top wood strip with screws */}
                    <div style={{
                        height: '20px',
                        flexShrink: 0,
                        background: 'repeating-linear-gradient(90deg, #7A4F2A 0px, #9A6A3A 6px, #6B3F1F 12px, #8A5A2A 18px, #7A4F2A 24px)',
                        position: 'relative',
                        borderRadius: '0',
                    }}>
                        {/* Left screw */}
                        <div style={{
                            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                            width: 14, height: 14, borderRadius: '50%',
                            background: 'radial-gradient(circle at 35% 35%, #E8C070, #C8A050, #8B6030)',
                            border: '1px solid #6B4010',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }}>
                            <div style={{ position: 'absolute', top: 3, left: 3, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                        </div>
                        {/* Right screw */}
                        <div style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            width: 14, height: 14, borderRadius: '50%',
                            background: 'radial-gradient(circle at 35% 35%, #E8C070, #C8A050, #8B6030)',
                            border: '1px solid #6B4010',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }}>
                            <div style={{ position: 'absolute', top: 3, left: 3, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                        </div>
                    </div>

                    {/* Board green surface */}
                    <div style={{
                        flex: 1,
                        background: 'linear-gradient(160deg, #2e5c28 0%, #1e4018 50%, #2a5624 100%)',
                        padding: '16px 20px',
                        position: 'relative',
                    }}>
                        {/* Chalk smudge texture */}
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 18, left: 20, width: 70, height: 5, background: 'rgba(255,255,255,0.035)', borderRadius: 4, transform: 'rotate(-1deg)' }} />
                            <div style={{ position: 'absolute', top: 55, right: 30, width: 45, height: 3, background: 'rgba(255,255,255,0.025)', borderRadius: 4, transform: 'rotate(1deg)' }} />
                            <div style={{ position: 'absolute', bottom: 40, left: 50, width: 80, height: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 4, transform: 'rotate(-0.5deg)' }} />
                            {/* Inner chalk border */}
                            <div style={{ position: 'absolute', inset: 8, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }} />
                        </div>

                        {/* Date */}
                        <p style={{ fontFamily: '"Caveat", cursive', fontSize: '17px', color: 'rgba(255,255,255,0.38)', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                            {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>

                        {/* Header */}
                        <div className="chalk-flicker" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, position: 'relative', zIndex: 1 }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                            <p style={{ fontFamily: '"Caveat", cursive', fontSize: '18px', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', textTransform: 'uppercase', textShadow: '0 0 8px rgba(255,255,255,0.2)' }}>✦ Thought of the Day ✦</p>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                        </div>

                        {/* Quote mark */}
                        <p style={{ fontFamily: '"Caveat", cursive', fontSize: '72px', color: 'rgba(255,255,255,0.08)', lineHeight: '0.6', marginBottom: 8, position: 'relative', zIndex: 1 }}>"</p>

                        {/* Thought */}
                        <p className="chalk-flicker" style={{ fontFamily: '"Caveat", cursive', fontSize: '26px', color: 'rgba(255,255,255,0.92)', lineHeight: '1.5', marginBottom: 12, textShadow: '0 0 8px rgba(255,255,255,0.15), 1px 1px 2px rgba(0,0,0,0.4)', position: 'relative', zIndex: 1 }}>
                            {thought.text}
                        </p>

                        {/* Author */}
                        <div className="chalk-flicker" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>
                            <div style={{ width: 50, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                            <p style={{ fontFamily: '"Caveat", cursive', fontSize: '21px', color: 'rgba(255,255,255,0.5)', textShadow: '0 0 6px rgba(255,255,255,0.1)' }}>— {thought.author}</p>
                        </div>
                    </div>

                    {/* Chalk tray */}
                    <div style={{
                        flexShrink: 0,
                        height: '32px',
                        background: 'repeating-linear-gradient(90deg, #5C3A1E 0px, #7A5030 5px, #4A2E10 10px, #6A4020 15px, #5C3A1E 20px)',
                        borderTop: '1px solid rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: '14px',
                        gap: '8px',
                    }}>
                        {/* Chalk pieces */}
                        {[
                            { top: '#F5F5F0', shadow: '#C8C8C0' },
                            { top: '#FFB3B3', shadow: '#E08080' },
                            { top: '#B3D9FF', shadow: '#80B0E0' },
                            { top: '#C8FFB3', shadow: '#90D870' },
                            { top: '#FFE4B3', shadow: '#E0BC70' },
                        ].map((c, i) => (
                            <div key={i} style={{ position: 'relative', width: 28, height: 10 }}>
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 9, borderRadius: 5, background: c.shadow }} />
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 9, borderRadius: 5, background: c.top }} />
                            </div>
                        ))}
                        {/* Eraser */}
                        <div style={{ marginLeft: 6, position: 'relative', width: 48, height: 20 }}>
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 18, borderRadius: 3, background: '#A0603A', border: '1px solid #6B3F1F' }} />
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 17, borderRadius: 3, background: '#D4956A' }} />
                            <div style={{ position: 'absolute', top: 3, left: 4, right: 4, height: 7, borderRadius: 1, background: '#8B4513', opacity: 0.55 }} />
                            <div style={{ position: 'absolute', bottom: 3, left: 4, right: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }} />
                        </div>
                    </div>

                    {/* Bottom wood strip with screws */}
                    <div style={{
                        height: '20px',
                        flexShrink: 0,
                        background: 'repeating-linear-gradient(90deg, #7A4F2A 0px, #9A6A3A 6px, #6B3F1F 12px, #8A5A2A 18px, #7A4F2A 24px)',
                        borderTop: '1px solid rgba(0,0,0,0.25)',
                        position: 'relative',
                    }}>
                        {/* Left screw */}
                        <div style={{
                            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                            width: 14, height: 14, borderRadius: '50%',
                            background: 'radial-gradient(circle at 35% 35%, #E8C070, #C8A050, #8B6030)',
                            border: '1px solid #6B4010',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }}>
                            <div style={{ position: 'absolute', top: 3, left: 3, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                        </div>
                        {/* Right screw */}
                        <div style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            width: 14, height: 14, borderRadius: '50%',
                            background: 'radial-gradient(circle at 35% 35%, #E8C070, #C8A050, #8B6030)',
                            border: '1px solid #6B4010',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }}>
                            <div style={{ position: 'absolute', top: 3, left: 3, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                        </div>
                    </div>

                </div>

                {/* ── Leaderboard ── */}
                <div className="bg-card border border-border/50 rounded-xl p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span>🏆</span>
                            <p className="text-sm font-semibold">Overall Leaderboard</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Top 5 Students</p>
                    </div>

                    {/* Podium */}
                    <div className="flex items-end justify-center gap-3 mb-4">
                        {/* 2nd */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-400 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
                                {LEADERBOARD[1].name[0]}
                            </div>
                            <p className="text-[10px] font-medium">{LEADERBOARD[1].name.split(' ')[0]}</p>
                            <p className="text-[10px] text-slate-500">{LEADERBOARD[1].pct}%</p>
                            <div className="w-16 h-10 bg-slate-400 rounded-t-lg flex items-center justify-center text-lg">🥈</div>
                        </div>
                        {/* 1st */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 border-2 border-amber-400 flex items-center justify-center text-base font-bold text-amber-700 dark:text-amber-400">
                                {LEADERBOARD[0].name[0]}
                            </div>
                            <p className="text-[10px] font-medium">{LEADERBOARD[0].name.split(' ')[0]}</p>
                            <p className="text-[10px] text-amber-500 font-semibold">{LEADERBOARD[0].pct}%</p>
                            <div className="w-16 h-14 bg-amber-400 rounded-t-lg flex items-center justify-center text-lg">🥇</div>
                        </div>
                        {/* 3rd */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-950 border-2 border-orange-400 flex items-center justify-center text-sm font-bold text-orange-700 dark:text-orange-400">
                                {LEADERBOARD[2].name[0]}
                            </div>
                            <p className="text-[10px] font-medium">{LEADERBOARD[2].name.split(' ')[0]}</p>
                            <p className="text-[10px] text-orange-500">{LEADERBOARD[2].pct}%</p>
                            <div className="w-16 h-8 bg-orange-400 rounded-t-lg flex items-center justify-center text-lg">🥉</div>
                        </div>
                    </div>

                    {/* 4th & 5th */}
                    <div className="space-y-2 mt-auto">
                        {LEADERBOARD.slice(3).map(s => (
                            <div key={s.rank}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border ${(s as any).isMe ? 'border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800' : 'border-border/50 bg-muted/20'}`}>
                                <span className="text-base">{s.rank === 4 ? '4️⃣' : '5️⃣'}</span>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${(s as any).isMe ? 'bg-violet-100 dark:bg-violet-950 border-violet-400 text-violet-700 dark:text-violet-300' : 'bg-muted border-border text-muted-foreground'}`}>
                                    {s.name[0]}
                                </div>
                                <p className={`flex-1 text-xs font-semibold ${(s as any).isMe ? 'text-violet-700 dark:text-violet-300' : 'text-foreground'}`}>
                                    {s.name} {(s as any).isMe && '(You)'}
                                </p>
                                <p className={`text-xs font-bold ${(s as any).isMe ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}>{s.pct}%</p>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}