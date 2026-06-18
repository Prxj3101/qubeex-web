'use client';

import { useState, useEffect } from 'react';
import PencilLoader from '@/components/student/PencilLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Users, FileText, Trophy, Calendar, X, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// ── Mock Data ─────────────────────────────────────────────────────────────────
const DIVISION = {
    name: '10-A',
    standard: 'Class 10',
    totalStudents: 45,
    classTeacher: 'Mrs. Priya Sharma',
    subjects: [
        { id: 's1', name: 'English',   code: 'ENG',  color: '#DA7756', teacher: 'Mrs. Sunita Rao' },
        { id: 's2', name: 'Hindi',     code: 'HIN',  color: '#EC4899', teacher: 'Mrs. Kavita Joshi' },
        { id: 's3', name: 'Marathi',   code: 'MAR',  color: '#0891B2', teacher: 'Mrs. Rekha Patil' },
        { id: 's4', name: 'Algebra',   code: 'ALG',  color: '#7C3AED', teacher: 'Mrs. Priya Sharma' },
        { id: 's5', name: 'Geometry',  code: 'GEO',  color: '#059669', teacher: 'Mr. Suresh Iyer' },
        { id: 's6', name: 'Science 1', code: 'SC1',  color: '#0EA5E9', teacher: 'Mr. Rahul Verma' },
        { id: 's7', name: 'Science 2', code: 'SC2',  color: '#6366F1', teacher: 'Mr. Vijay Nair' },
        { id: 's8', name: 'History',   code: 'HIS',  color: '#D97706', teacher: 'Mr. Anil Kumar' },
        { id: 's9', name: 'Geography', code: 'GEOG', color: '#16A34A', teacher: 'Mrs. Deepa Nair' },
    ],
};

const CURRENT_STUDENT_ID = 'st5'; // mock — replace with useAuthStore id

const CLASSMATES = [
    { id: 'st1',  name: 'Aarav Mehta',   rollNo: '01', rank: 1,  attendance: 92, totalMarks: 487 },
    { id: 'st2',  name: 'Priya Singh',   rollNo: '02', rank: 2,  attendance: 61, totalMarks: 471 },
    { id: 'st3',  name: 'Rohan Gupta',   rollNo: '03', rank: 3,  attendance: 78, totalMarks: 458 },
    { id: 'st4',  name: 'Sneha Patel',   rollNo: '04', rank: 4,  attendance: 55, totalMarks: 445 },
    { id: 'st5',  name: 'Arjun Kumar',   rollNo: '05', rank: 5,  attendance: 88, totalMarks: 432 },
    { id: 'st6',  name: 'Meera Sharma',  rollNo: '06', rank: 6,  attendance: 70, totalMarks: 419 },
    { id: 'st7',  name: 'Karan Joshi',   rollNo: '07', rank: 7,  attendance: 48, totalMarks: 406 },
    { id: 'st8',  name: 'Ananya Nair',   rollNo: '08', rank: 8,  attendance: 95, totalMarks: 398 },
    { id: 'st9',  name: 'Vikram Rao',    rollNo: '09', rank: 9,  attendance: 67, totalMarks: 385 },
    { id: 'st10', name: 'Ishaan Verma',  rollNo: '10', rank: 10, attendance: 82, totalMarks: 372 },
];

const RESULTS_FILES = [
    { id: 'r1', title: 'Unit Test 1 — Results', ext: 'PDF', date: '12 Apr 2025', url: '#' },
    { id: 'r2', title: 'Term Test Results',     ext: 'XLS', date: '3 Mar 2025',  url: '#' },
];

const MY_RESULTS: Record<string, { test: string; scored: number; total: number }[]> = {
    s1: [
        { test: 'Unit Test 1',  scored: 32, total: 40 },
        { test: 'Online Test 1',scored: 18, total: 20 },
        { test: 'Unit Test 2',  scored: 36, total: 40 },
        { test: 'Online Test 2',scored: 17, total: 20 },
        { test: 'Unit Test 3',  scored: 34, total: 40 },
        { test: 'Online Test 3',scored: 16, total: 20 },
        { test: 'Unit Test 4',  scored: 38, total: 40 },
        { test: 'Online Test 4',scored: 19, total: 20 },
        { test: 'Term Test',    scored: 68, total: 80 },
    ],
    s2: [
        { test: 'Unit Test 1',  scored: 35, total: 40 },
        { test: 'Online Test 1',scored: 16, total: 20 },
        { test: 'Unit Test 2',  scored: 30, total: 40 },
        { test: 'Online Test 2',scored: 19, total: 20 },
        { test: 'Term Test',    scored: 72, total: 80 },
    ],
    s3: [
        { test: 'Unit Test 1',  scored: 28, total: 40 },
        { test: 'Online Test 1',scored: 15, total: 20 },
        { test: 'Unit Test 2',  scored: 33, total: 40 },
        { test: 'Term Test',    scored: 58, total: 80 },
    ],
    s4: [
        { test: 'Unit Test 1',  scored: 38, total: 40 },
        { test: 'Online Test 1',scored: 19, total: 20 },
        { test: 'Unit Test 2',  scored: 36, total: 40 },
        { test: 'Online Test 2',scored: 18, total: 20 },
        { test: 'Term Test',    scored: 74, total: 80 },
    ],
    s5: [
        { test: 'Unit Test 1',  scored: 30, total: 40 },
        { test: 'Online Test 1',scored: 14, total: 20 },
        { test: 'Unit Test 2',  scored: 34, total: 40 },
        { test: 'Term Test',    scored: 61, total: 80 },
    ],
    s6: [
        { test: 'Unit Test 1',  scored: 33, total: 40 },
        { test: 'Online Test 1',scored: 17, total: 20 },
        { test: 'Unit Test 2',  scored: 37, total: 40 },
        { test: 'Online Test 2',scored: 16, total: 20 },
        { test: 'Term Test',    scored: 70, total: 80 },
    ],
    s7: [
        { test: 'Unit Test 1',  scored: 29, total: 40 },
        { test: 'Online Test 1',scored: 15, total: 20 },
        { test: 'Unit Test 2',  scored: 32, total: 40 },
        { test: 'Online Test 2',scored: 14, total: 20 },
        { test: 'Term Test',    scored: 63, total: 80 },
    ],
    s8: [
        { test: 'Unit Test 1',  scored: 34, total: 40 },
        { test: 'Online Test 1',scored: 16, total: 20 },
        { test: 'Unit Test 2',  scored: 31, total: 40 },
        { test: 'Term Test',    scored: 66, total: 80 },
    ],
    s9: [
        { test: 'Unit Test 1',  scored: 27, total: 40 },
        { test: 'Online Test 1',scored: 13, total: 20 },
        { test: 'Unit Test 2',  scored: 35, total: 40 },
        { test: 'Online Test 2',scored: 17, total: 20 },
        { test: 'Term Test',    scored: 60, total: 80 },
    ],
};

const MY_MATERIALS: Record<string, { name: string; type: string; size: string }[]> = {
    s1: [
        { name: 'Algebra Notes — Chapter 5', type: 'pdf', size: '2.1 MB' },
        { name: 'Practice Problems Set',      type: 'pdf', size: '1.0 MB' },
    ],
    s2: [
        { name: 'Physics — Laws of Motion',  type: 'pdf', size: '1.8 MB' },
        { name: 'Chemistry Lab Manual',       type: 'pdf', size: '3.2 MB' },
    ],
    s3: [{ name: 'Grammar Reference Sheet',  type: 'pdf', size: '0.9 MB' }],
    s4: [
        { name: 'History Chapter 3 Notes',   type: 'pdf', size: '1.4 MB' },
        { name: 'Map Work Reference',         type: 'pdf', size: '0.6 MB' },
    ],
    s5: [
        { name: 'Map Work Reference Sheet',  type: 'pdf', size: '0.8 MB' },
        { name: 'Practice Questions',         type: 'link', size: '' },
    ],
    s6: [{ name: 'व्याकरण नोट्स',            type: 'pdf', size: '1.2 MB' }],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase(); }
function pctColor(pct: number) {
    if (pct >= 75) return 'text-emerald-600 dark:text-emerald-400';
    if (pct >= 65) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-500 dark:text-red-400';
}

// ── View Tab ──────────────────────────────────────────────────────────────────
function ViewTab() {
    const [showTimetable, setShowTimetable] = useState(false);
    const [leaderTab, setLeaderTab] = useState<'offline' | 'online' | 'combined'>('combined');

    const podiumOrder = [CLASSMATES[1], CLASSMATES[0], CLASSMATES[2]];
    const podiumCfg = [
        { height: 'h-16', color: '#C0C0C0', label: '2nd' },
        { height: 'h-24', color: '#F59E0B', label: '1st' },
        { height: 'h-12', color: '#CD7F32', label: '3rd' },
    ];

    return (
        <div className="h-full overflow-hidden flex gap-3 pt-3 pb-3 px-1">

            {/* LEFT — Classmates list (20%) */}
            <div className="w-[25%] shrink-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Users size={13} /> Classmates ({CLASSMATES.length})
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {CLASSMATES.map((s) => {
                        const color = getAvatarColor(s.name);
                        const isMe = s.id === CURRENT_STUDENT_ID;
                        return (
                            <div key={s.id} className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 transition-colors ${isMe ? 'bg-violet-500/10 hover:bg-violet-500/15' : 'hover:bg-muted/20'}`}>
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                    style={{ background: color }}>
                                    {getInitials(s.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-semibold truncate">{s.name}</p>
                                        {isMe && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: '#7C3AED22', color: '#7C3AED' }}>You</span>}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Roll No. {s.rollNo}</p>
                                </div>
                                <div className="flex flex-col items-center shrink-0">
                                    <span className="text-[11px] font-bold" style={{ color: '#7C3AED' }}>#{s.rank}</span>
                                    <span className="text-[9px] text-muted-foreground/60">rank</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT — 2x2 grid */}
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-3 overflow-y-auto" style={{ gridTemplateRows: 'repeat(2, 360px)' }}>

                {/* TOP-LEFT: Timetable */}
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col min-h-0">
                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Calendar size={13} /> Timetable
                        </p>
                    </div>
                    <div className="p-2 cursor-pointer" onClick={() => setShowTimetable(true)}>
                        <img src="/timetable.jpeg" alt="Timetable"
                            className="w-full rounded-xl object-contain max-h-84 hover:opacity-90 transition-opacity" />
                    </div>
                </div>

                {/* TOP-RIGHT: Leaderboard */}
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col min-h-0">
                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Trophy size={13} /> Leaderboard — Top 5
                        </p>
                        <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
                            {(['offline', 'online', 'combined'] as const).map(t => (
                                <button key={t} onClick={() => setLeaderTab(t)}
                                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold capitalize transition-all ${leaderTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="flex items-end justify-center gap-4 px-4 pt-4 pb-2">
                            {podiumOrder.map((student, i) => (
                                <div key={student.id} className="flex flex-col items-center gap-1.5">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/20"
                                        style={{ background: getAvatarColor(student.name) }}>
                                        {getInitials(student.name)}
                                    </div>
                                    <p className="text-[10px] font-bold text-center w-16 truncate">{student.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{student.attendance}%</p>
                                    <div className={`${podiumCfg[i].height} w-14 rounded-t-xl flex items-center justify-center text-white text-xs font-black`}
                                        style={{ background: podiumCfg[i].color }}>
                                        {podiumCfg[i].label}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-4 pb-3 space-y-1.5">
                            {CLASSMATES.slice(3, 5).map(student => (
                                <div key={student.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
                                    <span className="text-xs font-black text-muted-foreground w-4 text-center">{student.rank}</span>
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                        style={{ background: getAvatarColor(student.name) }}>
                                        {getInitials(student.name)}
                                    </div>
                                    <p className="text-xs font-semibold flex-1 truncate">{student.name}</p>
                                    <span className="text-[11px] font-bold text-muted-foreground">{student.attendance}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* BOTTOM-LEFT: Subject Teachers */}
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col min-h-0">
                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <BookOpen size={13} /> Subject Teachers
                        </p>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-border/20">
                        {DIVISION.subjects.map(sub => (
                            <div key={sub.id} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color }} />
                                    <span className="text-xs font-medium">{sub.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                        style={{ background: getAvatarColor(sub.teacher) }}>
                                        {getInitials(sub.teacher)}
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">{sub.teacher}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* BOTTOM-RIGHT: Results */}
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col min-h-0">
                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <FileText size={13} /> Results
                        </p>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                        {RESULTS_FILES.map(r => (
                            <div key={r.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/20 last:border-none">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${r.ext === 'PDF' ? 'bg-red-500' : 'bg-emerald-600'}`}>
                                    {r.ext}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate">{r.title}</p>
                                    <p className="text-[10px] text-muted-foreground">{r.date}</p>
                                </div>
                                <a href={r.url} className="text-[10px] h-6 px-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0 flex items-center">
                                    View
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Timetable fullscreen modal */}
            <AnimatePresence>
                {showTimetable && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowTimetable(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="relative max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-white text-sm font-semibold">Timetable — {DIVISION.name}</p>
                                <div className="flex items-center gap-2">
                                    <a href="/timetable.jpeg" download
                                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        ⬇ Download
                                    </a>
                                    <button onClick={() => setShowTimetable(false)}
                                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>
                            <img src="/timetable.jpeg" alt="Timetable" className="w-full rounded-2xl object-contain max-h-[80vh]" />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Mock subject leaderboard ──────────────────────────────────────────────────
type LBEntry = { name: string; scored: number; total: number };
type LBMode  = { combined: LBEntry[]; offline: LBEntry[]; online: LBEntry[] };
const SUBJECT_LEADERBOARD: Record<string, LBMode> = {
    s1: {
        combined: [
            { name: 'Aarav Mehta',  scored: 156, total: 160 },
            { name: 'Ananya Nair',  scored: 151, total: 160 },
            { name: 'Arjun Kumar',  scored: 148, total: 160 },
            { name: 'Meera Sharma', scored: 141, total: 160 },
            { name: 'Ishaan Verma', scored: 138, total: 160 },
        ],
        offline: [
            { name: 'Arjun Kumar',  scored: 78, total: 80 },
            { name: 'Aarav Mehta',  scored: 75, total: 80 },
            { name: 'Meera Sharma', scored: 72, total: 80 },
            { name: 'Ananya Nair',  scored: 69, total: 80 },
            { name: 'Ishaan Verma', scored: 65, total: 80 },
        ],
        online: [
            { name: 'Aarav Mehta',  scored: 78, total: 80 },
            { name: 'Ananya Nair',  scored: 76, total: 80 },
            { name: 'Priya Singh',  scored: 71, total: 80 },
            { name: 'Arjun Kumar',  scored: 68, total: 80 },
            { name: 'Rohan Gupta',  scored: 64, total: 80 },
        ],
    },
    s2: {
        combined: [
            { name: 'Ananya Nair',  scored: 155, total: 160 },
            { name: 'Priya Singh',  scored: 149, total: 160 },
            { name: 'Aarav Mehta',  scored: 144, total: 160 },
            { name: 'Rohan Gupta',  scored: 139, total: 160 },
            { name: 'Arjun Kumar',  scored: 135, total: 160 },
        ],
        offline: [
            { name: 'Priya Singh',  scored: 77, total: 80 },
            { name: 'Ananya Nair',  scored: 74, total: 80 },
            { name: 'Rohan Gupta',  scored: 70, total: 80 },
            { name: 'Aarav Mehta',  scored: 67, total: 80 },
            { name: 'Arjun Kumar',  scored: 63, total: 80 },
        ],
        online: [
            { name: 'Ananya Nair',  scored: 79, total: 80 },
            { name: 'Aarav Mehta',  scored: 75, total: 80 },
            { name: 'Sneha Patel',  scored: 72, total: 80 },
            { name: 'Priya Singh',  scored: 70, total: 80 },
            { name: 'Rohan Gupta',  scored: 67, total: 80 },
        ],
    },
    s3: {
        combined: [
            { name: 'Sneha Patel',  scored: 158, total: 160 },
            { name: 'Meera Sharma', scored: 153, total: 160 },
            { name: 'Priya Singh',  scored: 147, total: 160 },
            { name: 'Aarav Mehta',  scored: 142, total: 160 },
            { name: 'Ananya Nair',  scored: 137, total: 160 },
        ],
        offline: [
            { name: 'Meera Sharma', scored: 78, total: 80 },
            { name: 'Sneha Patel',  scored: 75, total: 80 },
            { name: 'Aarav Mehta',  scored: 71, total: 80 },
            { name: 'Priya Singh',  scored: 68, total: 80 },
            { name: 'Karan Joshi',  scored: 64, total: 80 },
        ],
        online: [
            { name: 'Sneha Patel',  scored: 80, total: 80 },
            { name: 'Priya Singh',  scored: 76, total: 80 },
            { name: 'Ananya Nair',  scored: 73, total: 80 },
            { name: 'Meera Sharma', scored: 69, total: 80 },
            { name: 'Aarav Mehta',  scored: 66, total: 80 },
        ],
    },
    s4: {
        combined: [
            { name: 'Rohan Gupta',  scored: 152, total: 160 },
            { name: 'Karan Joshi',  scored: 148, total: 160 },
            { name: 'Vikram Rao',   scored: 143, total: 160 },
            { name: 'Sneha Patel',  scored: 138, total: 160 },
            { name: 'Ishaan Verma', scored: 133, total: 160 },
        ],
        offline: [
            { name: 'Karan Joshi',  scored: 76, total: 80 },
            { name: 'Rohan Gupta',  scored: 73, total: 80 },
            { name: 'Sneha Patel',  scored: 70, total: 80 },
            { name: 'Vikram Rao',   scored: 66, total: 80 },
            { name: 'Ishaan Verma', scored: 62, total: 80 },
        ],
        online: [
            { name: 'Rohan Gupta',  scored: 77, total: 80 },
            { name: 'Vikram Rao',   scored: 74, total: 80 },
            { name: 'Karan Joshi',  scored: 70, total: 80 },
            { name: 'Arjun Kumar',  scored: 67, total: 80 },
            { name: 'Sneha Patel',  scored: 64, total: 80 },
        ],
    },
    s5: {
        combined: [
            { name: 'Arjun Kumar',  scored: 154, total: 160 },
            { name: 'Aarav Mehta',  scored: 149, total: 160 },
            { name: 'Rohan Gupta',  scored: 144, total: 160 },
            { name: 'Ananya Nair',  scored: 139, total: 160 },
            { name: 'Priya Singh',  scored: 134, total: 160 },
        ],
        offline: [
            { name: 'Aarav Mehta',  scored: 75, total: 80 },
            { name: 'Arjun Kumar',  scored: 73, total: 80 },
            { name: 'Ananya Nair',  scored: 69, total: 80 },
            { name: 'Rohan Gupta',  scored: 66, total: 80 },
            { name: 'Priya Singh',  scored: 62, total: 80 },
        ],
        online: [
            { name: 'Arjun Kumar',  scored: 79, total: 80 },
            { name: 'Rohan Gupta',  scored: 76, total: 80 },
            { name: 'Priya Singh',  scored: 70, total: 80 },
            { name: 'Aarav Mehta',  scored: 72, total: 80 },
            { name: 'Ananya Nair',  scored: 68, total: 80 },
        ],
    },
    s6: {
        combined: [
            { name: 'Meera Sharma', scored: 157, total: 160 },
            { name: 'Sneha Patel',  scored: 152, total: 160 },
            { name: 'Vikram Rao',   scored: 146, total: 160 },
            { name: 'Karan Joshi',  scored: 141, total: 160 },
            { name: 'Ishaan Verma', scored: 136, total: 160 },
        ],
        offline: [
            { name: 'Sneha Patel',  scored: 77, total: 80 },
            { name: 'Meera Sharma', scored: 74, total: 80 },
            { name: 'Karan Joshi',  scored: 70, total: 80 },
            { name: 'Vikram Rao',   scored: 67, total: 80 },
            { name: 'Ishaan Verma', scored: 63, total: 80 },
        ],
        online: [
            { name: 'Meera Sharma', scored: 80, total: 80 },
            { name: 'Vikram Rao',   scored: 76, total: 80 },
            { name: 'Sneha Patel',  scored: 73, total: 80 },
            { name: 'Ishaan Verma', scored: 70, total: 80 },
            { name: 'Karan Joshi',  scored: 66, total: 80 },
        ],
    },
    s7: {
        combined: [
            { name: 'Ishaan Verma', scored: 153, total: 160 },
            { name: 'Aarav Mehta',  scored: 147, total: 160 },
            { name: 'Sneha Patel',  scored: 142, total: 160 },
            { name: 'Priya Singh',  scored: 136, total: 160 },
            { name: 'Rohan Gupta',  scored: 131, total: 160 },
        ],
        offline: [
            { name: 'Aarav Mehta',  scored: 76, total: 80 },
            { name: 'Ishaan Verma', scored: 73, total: 80 },
            { name: 'Sneha Patel',  scored: 69, total: 80 },
            { name: 'Priya Singh',  scored: 65, total: 80 },
            { name: 'Rohan Gupta',  scored: 62, total: 80 },
        ],
        online: [
            { name: 'Ishaan Verma', scored: 78, total: 80 },
            { name: 'Sneha Patel',  scored: 74, total: 80 },
            { name: 'Aarav Mehta',  scored: 70, total: 80 },
            { name: 'Rohan Gupta',  scored: 67, total: 80 },
            { name: 'Priya Singh',  scored: 63, total: 80 },
        ],
    },
    s8: {
        combined: [
            { name: 'Vikram Rao',   scored: 155, total: 160 },
            { name: 'Meera Sharma', scored: 149, total: 160 },
            { name: 'Karan Joshi',  scored: 143, total: 160 },
            { name: 'Ananya Nair',  scored: 138, total: 160 },
            { name: 'Arjun Kumar',  scored: 132, total: 160 },
        ],
        offline: [
            { name: 'Meera Sharma', scored: 77, total: 80 },
            { name: 'Vikram Rao',   scored: 74, total: 80 },
            { name: 'Karan Joshi',  scored: 71, total: 80 },
            { name: 'Ananya Nair',  scored: 67, total: 80 },
            { name: 'Arjun Kumar',  scored: 63, total: 80 },
        ],
        online: [
            { name: 'Vikram Rao',   scored: 79, total: 80 },
            { name: 'Karan Joshi',  scored: 75, total: 80 },
            { name: 'Meera Sharma', scored: 71, total: 80 },
            { name: 'Arjun Kumar',  scored: 67, total: 80 },
            { name: 'Ananya Nair',  scored: 64, total: 80 },
        ],
    },
    s9: {
        combined: [
            { name: 'Priya Singh',  scored: 151, total: 160 },
            { name: 'Arjun Kumar',  scored: 146, total: 160 },
            { name: 'Aarav Mehta',  scored: 140, total: 160 },
            { name: 'Sneha Patel',  scored: 134, total: 160 },
            { name: 'Vikram Rao',   scored: 129, total: 160 },
        ],
        offline: [
            { name: 'Arjun Kumar',  scored: 74, total: 80 },
            { name: 'Priya Singh',  scored: 71, total: 80 },
            { name: 'Aarav Mehta',  scored: 68, total: 80 },
            { name: 'Vikram Rao',   scored: 64, total: 80 },
            { name: 'Sneha Patel',  scored: 60, total: 80 },
        ],
        online: [
            { name: 'Priya Singh',  scored: 78, total: 80 },
            { name: 'Sneha Patel',  scored: 74, total: 80 },
            { name: 'Aarav Mehta',  scored: 70, total: 80 },
            { name: 'Arjun Kumar',  scored: 66, total: 80 },
            { name: 'Vikram Rao',   scored: 63, total: 80 },
        ],
    },
};

// ── Subjects Tab ──────────────────────────────────────────────────────────────
function SubjectsTab() {
    const [selectedId, setSelectedId] = useState<string>(DIVISION.subjects[0].id);
    const [subTab, setSubTab] = useState<'results' | 'materials'>('results');
    const [resultMode, setResultMode] = useState<'offline' | 'online' | 'combined'>('combined');

    const subject     = DIVISION.subjects.find(s => s.id === selectedId)!;
    const allResults  = MY_RESULTS[selectedId] ?? [];
    const results     = allResults.filter(r =>
        resultMode === 'combined' ? true :
        resultMode === 'online'   ? r.test.toLowerCase().includes('online') :
                                    !r.test.toLowerCase().includes('online')
    );
    const materials   = MY_MATERIALS[selectedId] ?? [];
    const leaderboard = SUBJECT_LEADERBOARD[selectedId]?.[resultMode] ?? [];
    const chartData   = results.map(r => ({ name: r.test, score: Math.round((r.scored / r.total) * 100) }));

    return (
        <div className="h-full flex flex-col overflow-hidden pt-3 pb-3 px-1">

            {/* Subject tags */}
            <div className="shrink-0 flex flex-wrap gap-1.5 mb-3">
                {DIVISION.subjects.map(sub => {
                    const isActive = sub.id === selectedId;
                    return (
                        <button key={sub.id} onClick={() => { setSelectedId(sub.id); setSubTab('results'); }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                            style={isActive ? {
                                background: sub.color + '20',
                                color: sub.color,
                                border: `1px solid ${sub.color}40`,
                            } : {
                                background: 'hsl(var(--muted))',
                                color: 'hsl(var(--muted-foreground))',
                                border: '1px solid hsl(var(--border))',
                            }}>
                            <BookOpen size={10} />
                            {sub.name}
                        </button>
                    );
                })}
            </div>

            {/* LEFT + RIGHT split */}
            <div className="flex-1 min-h-0 flex gap-3">

                {/* LEFT — teacher info + leaderboard */}
                <div className="w-[35%] shrink-0 flex flex-col gap-3 overflow-hidden">

                    {/* Teacher card */}
                    <div className="shrink-0 bg-card border border-border/50 rounded-2xl px-4 py-3 shadow-sm shadow-black/5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: subject.color }}>
                            {subject.code}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{subject.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                                    style={{ background: getAvatarColor(subject.teacher) }}>
                                    {getInitials(subject.teacher)}
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">{subject.teacher}</p>
                            </div>
                        </div>
                        <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40 shrink-0">
                            {(['offline', 'online', 'combined'] as const).map(t => (
                                <button key={t} onClick={() => setResultMode(t)}
                                    className={`px-2 py-0.5 rounded-md text-[9px] font-semibold capitalize transition-all ${resultMode === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Leaderboard */}
                    <div className="flex-1 min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col">
                        <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0 flex items-center gap-2">
                            <span className="text-sm">🏆</span>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{subject.name} — Top 5</p>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                            {leaderboard.length === 0
                                ? <p className="text-xs text-muted-foreground py-8 text-center">No data yet</p>
                                : leaderboard.map((s, i) => {
                                    const pct = Math.round((s.scored / s.total) * 100);
                                    const isMe = s.name === CLASSMATES.find(c => c.id === CURRENT_STUDENT_ID)?.name;
                                    return (
                                        <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${isMe ? 'border-violet-500/30 bg-violet-500/10' : 'border-border/40 bg-background'}`}
                                            style={i === 0 ? { borderColor: subject.color + '40', background: subject.color + '10' } : {}}>
                                            <span className="text-sm w-5 text-center shrink-0">
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-[10px] font-black text-muted-foreground">#{i + 1}</span>}
                                            </span>
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                                                style={{ background: getAvatarColor(s.name) }}>
                                                {getInitials(s.name)}
                                            </div>
                                            <p className="text-[11px] font-semibold flex-1 truncate">
                                                {s.name}
                                                {isMe && <span className="ml-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#7C3AED22', color: '#7C3AED' }}>You</span>}
                                            </p>
                                            <span className="text-[11px] font-bold shrink-0" style={{ color: subject.color }}>{pct}%</span>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                </div>

                {/* RIGHT — 2 sub tabs */}
                <div className="flex-1 min-w-0 bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col shadow-sm shadow-black/5">

                    {/* Sub tab bar */}
                    <div className="shrink-0 px-3 pt-3 pb-2 flex items-center justify-between">
                        <div className="flex gap-1 bg-muted/50 border border-border/50 rounded-2xl p-1 w-fit">
                            {(['results', 'materials'] as const).map(t => (
                                <button key={t} onClick={() => setSubTab(t)}
                                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                                    style={subTab === t ? { background: subject.color, color: '#fff' } : { color: 'hsl(var(--muted-foreground))' }}>
                                    {t === 'results' ? '📊 Results' : '📄 Materials'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">

                        {subTab === 'results' && (
                            <div className="flex-1 min-h-0 flex gap-0 overflow-hidden">
                                {/* Left — performance chart */}
                                <div className="w-[70%] shrink-0 min-h-0 p-4 flex flex-col border-r border-border/30 overflow-hidden">
                                    <p className="text-xs font-bold shrink-0 pt-3 mb-0">Performance Trend</p>
                                    {chartData.length === 0
                                        ? <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
                                        : <div className="flex-1 min-h-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={chartData} margin={{ top: 28, right: 8, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id={`grad-${subject.id}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={subject.color} stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor={subject.color} stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                                                    {chartData.map(d => (
                                                        <ReferenceLine key={d.name} x={d.name} stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                                                    ))}
                                                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                                                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} unit="%" />
                                                    <Tooltip
                                                        contentStyle={{ background: '#1A1030', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 11 }}
                                                        labelStyle={{ color: '#F1F5F9' }}
                                                        formatter={(val: any) => [`${val}%`, 'Score']}
                                                        itemStyle={{ color: subject.color }}
                                                    />
                                                    <Area type="monotone" dataKey="score" stroke={subject.color} strokeWidth={2}
                                                        fill={`url(#grad-${subject.id})`}
                                                        dot={(dotProps: any) => {
                                                            const { cx, cy, payload } = dotProps;
                                                            const score = payload.score;
                                                            const vals = chartData.map(d => d.score);
                                                            const isMax = score === Math.max(...vals);
                                                            const isMin = score === Math.min(...vals);
                                                            const labelColor = isMin ? '#EF4444' : '#10B981';
                                                            return (
                                                                <g style={{ overflow: 'visible' }}>
                                                                    <circle cx={cx} cy={cy} r={4} fill={subject.color} />
                                                                    {(isMax || isMin) && (
                                                                        <>
                                                                            <rect x={cx - 14} y={isMin ? cy + 7 : cy - 21} width={28} height={14} rx={3} fill={labelColor} />
                                                                            <text x={cx} y={isMin ? cy + 17 : cy - 10} textAnchor="middle" fill="white" fontSize={9} fontWeight="600">{score}%</text>
                                                                        </>
                                                                    )}
                                                                </g>
                                                            );
                                                        }}
                                                        activeDot={{ r: 6 }}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    }
                                </div>
                                {/* Right — results list */}
                                <div className="flex-1 flex flex-col overflow-hidden" style={{ maxHeight: '380px' }}>
                                <p className="text-xs font-bold shrink-0 px-4 pt-7 mb-6">My Results</p>
                                <div className="flex-1 px-4 pb-3 space-y-2" style={{ overflowY: 'scroll', scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                                    {results.length === 0
                                        ? <p className="text-xs text-muted-foreground py-8 text-center">No results yet</p>
                                        : results.map((r, i) => {
                                            const pct = Math.round((r.scored / r.total) * 100);
                                            return (
                                                <div key={i} className="bg-background border border-border/40 rounded-xl p-3 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-semibold">{r.test}</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold" style={{ color: subject.color }}>{r.scored}/{r.total}</span>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pct >= 75 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' : pct >= 40 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400' : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'}`}>{pct}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: subject.color }} />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                                </div>
                            </div>
                        )}

                        {subTab === 'materials' && (
                            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2" style={{ maxHeight: '340px' }}>
                                {materials.length === 0
                                    ? <p className="text-xs text-muted-foreground py-8 text-center">No materials yet</p>
                                    : materials.map((mat, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-background border border-border/40 rounded-xl p-3">
                                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: subject.color + '20' }}>
                                                <FileText size={16} style={{ color: subject.color }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate">{mat.name}</p>
                                                {mat.size && <p className="text-[10px] text-muted-foreground">{mat.type.toUpperCase()} · {mat.size}</p>}
                                            </div>
                                            <button className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70 shrink-0" style={{ background: subject.color + '20' }}>
                                                <Download size={12} style={{ color: subject.color }} />
                                            </button>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
    { key: 'view' as const,     label: 'View' },
    { key: 'subjects' as const, label: 'Subjects' },
];

export default function StudentClassPageClient() {
    const [activeTab, setActiveTab] = useState<'view' | 'subjects'>('view');
    const [tabLoading, setTabLoading] = useState(false);

    function switchTab(tab: 'view' | 'subjects') {
        if (tab === activeTab) return;
        setTabLoading(true);
        setTimeout(() => { setActiveTab(tab); setTabLoading(false); }, 1300);
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-1 pt-1 pb-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Users size={22} /> {DIVISION.name}
                            </h1>
                            <p className="text-xs text-muted-foreground">{DIVISION.standard}</p>
                        </div>

                        {/* Tab bar */}
                        <div className="flex gap-1 bg-muted/50 rounded-full p-0.5 border border-border/50 ml-4">
                            {TABS.map(tab => {
                                const isActive = activeTab === tab.key;
                                return (
                                    <button key={tab.key} onClick={() => switchTab(tab.key)} className="relative">
                                        {isActive && (
                                            <motion.div layoutId="studentClassTab"
                                                className="absolute inset-0 bg-primary rounded-full"
                                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                                        )}
                                        <div className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {tab.label}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right stats */}
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-lg font-bold leading-tight">{DIVISION.subjects.length}</p>
                            <p className="text-[11px] text-muted-foreground">Subjects</p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold leading-tight">{DIVISION.totalStudents}</p>
                            <p className="text-[11px] text-muted-foreground">Students</p>
                        </div>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {tabLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <PencilLoader size={72} />
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {activeTab === 'view' && (
                            <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                <ViewTab />
                            </motion.div>
                        )}
                        {activeTab === 'subjects' && (
                            <motion.div key="subjects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                <SubjectsTab />
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
