'use client';

import { useRef, useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { TeacherAttendanceChart } from '@/components/teacher/TeacherAttendanceChart';
import TeacherNotepad from '@/components/teacher/TeacherNotepad';
import { AlertCircle, Users, LayoutGrid, BookOpen, ScrollText, ClipboardList, Sparkles, AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight, Bell, X, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BirthdayBanner, isTodayBirthday } from '@/components/shared/BirthdayBanner';
import { SillyStringOverlay } from '@/components/shared/SillyStringOverlay';
import { formatDisplayName } from '@/lib/displayName';
import { formatTokens } from '@/lib/utils';

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_STATS = [
    { label: 'Classes Assigned', value: '5', sub: '+1 this month', trend: 'up', icon: LayoutGrid, iconBg: 'bg-[var(--muted)]', iconColor: 'text-[var(--primary)]' },
    { label: 'Subjects Teaching', value: '3', sub: 'this academic year', trend: 'up', icon: BookOpen, iconBg: 'bg-amber-100 dark:bg-amber-950', iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Tests Conducted', value: '24', sub: '+3 this month', trend: 'up', icon: ClipboardList, iconBg: 'bg-green-100 dark:bg-green-950', iconColor: 'text-green-600 dark:text-green-400' },
    { label: 'Avg Attendance', value: '87%', sub: '+2% this month', trend: 'up', icon: TrendingUp, iconBg: 'bg-sky-100 dark:bg-sky-950', iconColor: 'text-sky-600 dark:text-sky-400' },
];

type LogEntry = {
    id: string; action: string; category: string;
    severity: string; details: string; ip: string; createdAt: string;
};

const ACTION_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
    STUDENT_ADDED: { label: 'Student Added', cls: 'bg-[var(--muted)] text-[var(--primary)] bg-[var(--muted)] text-[var(--primary)]', dot: 'bg-[var(--muted)]0' },
    STUDENT_UPDATED: { label: 'Student Updated', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400', dot: 'bg-blue-500' },
    STUDENT_DEACTIVATED: { label: 'Student Deactivated', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    STUDENT_ACTIVATED: { label: 'Student Activated', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500' },
    POST_CREATED: { label: 'Post Created', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500' },
    POST_DELETED: { label: 'Post Deleted', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    ATTENDANCE_MARKED: { label: 'Attendance Marked', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400', dot: 'bg-sky-500' },
    TIMETABLE_UPLOADED: { label: 'Timetable Uploaded', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', dot: 'bg-amber-500' },
    RESULT_UPLOADED: { label: 'Result Uploaded', cls: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400', dot: 'bg-pink-500' },
    CALENDAR_EVENT_ADDED: { label: 'Calendar Event Added', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400', dot: 'bg-indigo-500' },
    CALENDAR_EVENT_DELETED: { label: 'Calendar Event Deleted', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400', dot: 'bg-orange-500' },
    LOGIN_SUCCESS: { label: 'Login', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
    LOGIN_FAILED: { label: 'Login Failed', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400', dot: 'bg-rose-500' },
    PASSWORD_CHANGED: { label: 'Password Changed', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', dot: 'bg-amber-500' },
};

const MOCK_LOGS: LogEntry[] = [
    { id: '1', action: 'LOGIN_SUCCESS', category: 'SECURITY', severity: 'INFO', details: 'Teacher logged in successfully', ip: '192.168.1.1', createdAt: '2026-05-29T08:30:00Z' },
    { id: '2', action: 'POST_CREATED', category: 'ACTIVITY', severity: 'INFO', details: 'Posted announcement: PTM this Saturday', ip: '192.168.1.1', createdAt: '2026-05-29T09:15:00Z' },
    { id: '3', action: 'STUDENT_ADDED', category: 'ACTIVITY', severity: 'INFO', details: 'Added student Aarav Mehta to Class 10-A', ip: '192.168.1.1', createdAt: '2026-05-29T10:00:00Z' },
    { id: '4', action: 'ATTENDANCE_MARKED', category: 'ACTIVITY', severity: 'INFO', details: 'Marked attendance for Class 10-A (42 students)', ip: '192.168.1.2', createdAt: '2026-05-28T08:45:00Z' },
    { id: '5', action: 'TIMETABLE_UPLOADED', category: 'ACTIVITY', severity: 'INFO', details: 'Uploaded timetable for Class 10-A', ip: '192.168.1.2', createdAt: '2026-05-28T11:20:00Z' },
    { id: '6', action: 'RESULT_UPLOADED', category: 'ACTIVITY', severity: 'INFO', details: 'Uploaded Unit Test 1 results for Class 10-A', ip: '192.168.1.1', createdAt: '2026-05-27T14:30:00Z' },
];

function toIST(iso: string) {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }),
    };
}

const MOCK_SHORT_ATTENDANCE = [
    { name: 'Sneha Patel', rollNo: '04', pct: 61 },
    { name: 'Karan Joshi', rollNo: '07', pct: 48 },
    { name: 'Ananya Nair', rollNo: '08', pct: 55 },
    { name: 'Ishaan Verma', rollNo: '10', pct: 69 },
];

const MOCK_ANNOUNCEMENTS = [
    { id: '1', text: 'Staff meeting scheduled — Monday 9:00 AM in Conference Room' },
    { id: '2', text: 'Submit attendance reports by Friday EOD' },
];

const THOUGHTS = [
    { text: "Teaching is the greatest act of optimism.", author: "William Arthur Ward" },
    { text: "The mediocre teacher tells. The good teacher explains. The superior teacher demonstrates. The great teacher inspires.", author: "Colleen Wilcox" },
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
const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const TEACHER_CHARACTERS = [
    '/images/teacher1.png',
    '/images/teacher2.png',
    '/images/teacher3.png',
    '/images/teacher4.png',
    '/images/teacher5.png',
    '/images/teacher6.png',
    '/images/teacher7.png',
    '/images/teacher8.png',
];



// ── Subcomponents ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
            <p className="font-semibold mb-1">{label}</p>
            <p className="text-[var(--primary)] font-bold">{payload[0].value}%</p>
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

function Blackboard({ thought, teacherClass }: { thought: { text: string; author: string }; teacherClass: string }) {
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                    <p style={{ fontFamily: '"Caveat", cursive', fontSize: '17px', color: 'rgba(255,255,255,0.38)' }}>
                        {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p style={{ fontFamily: '"Caveat", cursive', fontSize: '17px', color: 'rgba(255,255,255,0.38)' }}>
                        Class: {teacherClass}
                    </p>
                </div>
                <div className="chalk-flicker" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, position: 'relative', zIndex: 1 }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                    <p style={{ fontFamily: '"Caveat", cursive', fontSize: '18px', color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', textTransform: 'uppercase', textShadow: '0 0 8px rgba(255,255,255,0.2)' }}>✦ Thought of the Day ✦</p>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                </div>
                <p style={{ fontFamily: '"Caveat", cursive', fontSize: '72px', color: 'rgba(255,255,255,0.08)', lineHeight: '0.6', marginBottom: 8, position: 'relative', zIndex: 1 }}>&quot;</p>
                <p className="chalk-flicker" style={{ fontFamily: '"Caveat", cursive', fontSize: '25px', color: 'rgba(255,255,255,0.92)', lineHeight: '1.5', marginBottom: 12, textShadow: '0 0 8px rgba(255,255,255,0.15), 1px 1px 2px rgba(0,0,0,0.4)', position: 'relative', zIndex: 1 }}>
                    {thought.text}
                </p>
                <div className="chalk-flicker" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>
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

const CASUAL_MESSAGES = [
    "Good morning! ☕ Ready to inspire some young minds today?",
    "GM teacher! 🌅 May your first period be as energetic as your coffee!",
    "Rise & shine! 🌞 Aaj ka din productive lagta hai!",
    "Good morning! May your chalk never break and students always listen ✏️",
    "Goood morningggg! 🎉 Today feels like a great teaching day!",
    "GM! 👋 Wonder if anyone did their homework last night...",
    "Morning teacher! The classroom is waiting for its superhero 🦸",
    "Hey! ☀️ Aaj attendance mein kitne 'present sir' milenge?",
    "Quick question — strict mode or chill mode today? 😎",
    "Pro tip: Jo sabse peeche baitha hai, usse aaj zaroor bulao 😄",
    "Today's forecast: 100% chance of someone forgetting their textbook 📚",
    "Reminder: You are literally shaping the future. No pressure! 😅",
    "Fun fact: Your students are more nervous than you right now 😄",
    "Hey! Someone in your class today will remember you for life 🌟",
    "That 'aha!' moment from a student — absolutely priceless ✨",
    "Teacher mode: ACTIVATED 🚀 Aaj ka din legendary hone wala hai!",
    "You don't just teach, you inspire — never forget that 💫",
    "Best moment today? When a student finally gets it 😊",
    "Lesson plan ready? Students ready? Chalein phir! 🎯",
    "Hey teacher! Maybe try something different in class today? 🔬",
    "Reminder: You're the world's most underrated superhero 🦸‍♀️",
    "Monday energy ON! ⚡ Time to charge up the whole class!",
    "Midweek check-in — class ki energy kaisi hai aaj? 😊",
    "Almost Friday! 🎊 Just one more day — hang in there!",
    "Friday vibes! 🥳 Finish strong, last period matters too!",
    "Psst! 🤖 Busy day ahead — chai pehle, baaki sab baad mein!",
    "AI observation: Your students seem surprisingly motivated today 👀",
    "Fun stat: Your class attendance is improving — keep it up! 📈",
    "Quick check: Aaj ka thought of the day board pe likha kya? 🖊️",
    "Hey! The little things you do in class matter more than you know 💙",
    "Good morning! Every class is a fresh start — make it count 🌟",
    "Teaching tip: A little humor goes a long way in class 😄",
    "Today is a great day to be a great teacher! ✨",
    "GM! Aaj koi student zaroor surprise karega — ready rehna 😊",
    "Good morning! Your energy sets the tone for the whole class today ⚡",
];

function getCasualMessage() {
    const today = new Date();
    const day = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return CASUAL_MESSAGES[day % CASUAL_MESSAGES.length];
}

const greeting = hour < 12
    ? 'Good Mooorningggg, Teeeacherrrr! 👋'
    : hour < 17
        ? 'Good Afternooooon, Teeeacherrrr! 👋'
        : 'Good Evening, Teacher! 👋';


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherOverviewPage() {
    const { user } = useAuthStore();
    // Background is driven by the --hero-accent CSS var (globals.css), not
    // JS. A JS instType/isDark check (same as admin's OverviewHero) cannot
    // be flash-free here: admin's hero only mounts after its data fetch
    // resolves (well past hydration), so it never has server-rendered markup
    // to conflict with; this hero renders immediately, so the server (always
    // defaulting to 'SCHOOL', no way to know the real value during SSR)
    // and the client's first paint (already correct from cache) would
    // genuinely differ — no way to fix that with JS alone without either a
    // hydration error or a visible flash while it corrects itself. CSS
    // doesn't have this problem: --hero-accent comes from the
    // 'theme-college'/'dark' classes on <html>, which are already correct
    // server-side (see app/layout.tsx's cookie read), so server and client
    // render the same value from byte one.

    type OverviewData = {
        teacher: { name: string; prefix: string | null; institutionName: string; classTeacherDivisionName: string | null };
        stats: { classesAssigned: number; subjectsTeaching: number; testsConducted: number; avgAttendancePct: number | null };
        attendanceTrend: { month: string; attendance: number; students: number }[];
        shortAttendance: { name: string; rollNo: string; pct: number; avatarUrl: string | null }[];
        auditLogs: { id: string; action: string; category: string; severity: string; details: string | null; ip: string | null; createdAt: string }[];
    };
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [overviewLoading, setOverviewLoading] = useState(true);
    const [teacherDob, setTeacherDob] = useState<string | null>(null);
    const [aiUsage, setAiUsage] = useState<{
        totalTokens: number; institutionPoolLimit: number; institutionPoolUsed: number; poolSharePct: number;
    } | null>(null);
    const [aiUsageLoading, setAiUsageLoading] = useState(true);
    const fetchedRef = useRef(false);
    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        api.get('/teacher/overview')
            .then(res => setOverview(res.data.data))
            .catch(() => setOverview(null))
            .finally(() => setOverviewLoading(false));
        // Fetch profile for birthday data — silent fail (non-critical)
        api.get('/teacher/me')
            .then(res => {
                const d = res.data?.data ?? res.data;
                setTeacherDob(d?.dob ?? null);
            })
            .catch(() => {});
        api.get('/teacher/ai-usage')
            .then(res => setAiUsage(res.data.data))
            .catch(() => setAiUsage(null))
            .finally(() => setAiUsageLoading(false));
    }, []);

    const [announcementVisible, setAnnouncementVisible] = useState(true);
    const thought = getTodaysThought();
    const [currentTime, setCurrentTime] = useState('');
    useEffect(() => {
        const fmt = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        setCurrentTime(fmt());
        const id = setInterval(() => setCurrentTime(fmt()), 1000);
        return () => clearInterval(id);
    }, []);

    // Waiting for overviewLoading (not just checking user?.name) matters here:
    // user.name is already available instantly from the auth store, so
    // rendering it right away shows the name WITHOUT its prefix for a beat,
    // then a second render adds "Prof." once /teacher/overview resolves —
    // that's the flash. Holding off until overview has actually loaded means
    // the skeleton shows instead, and the name only ever appears once, already
    // correct with its prefix.
    const teacherName = overviewLoading ? '' : formatDisplayName(
        user?.name ?? user?.email?.split('@')[0] ?? '',
        overview?.teacher.prefix
    );

    // State
    const [currentChar, setCurrentChar] = useState(0);

    useEffect(() => {
        const iv = setInterval(() => setCurrentChar(p => (p + 1) % TEACHER_CHARACTERS.length), 7000);
        return () => clearInterval(iv);
    }, []);

    return (
        <div className="space-y-3 pb-3">

            {/* ── Hero ── */}
            <div
                className="-mx-4 relative overflow-hidden rounded-b-[65px] px-5 lg:px-13 py-5 flex items-center justify-between min-h-[160px]"
                style={{ background: 'var(--hero-accent)' }}
            >
                {/* Orbs */}
                <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
                <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />
                {/* Stars */}
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-20 left-36 animate-pulse delay-300" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-12 left-5 animate-pulse delay-500" />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-4 left-52 animate-pulse delay-700" />

                {/* Text */}
                <div className="space-y-1 z-10">
                    <p className="text-white/70 text-base">{greeting}</p>
                    <div className="relative">
                        <div className="text-white text-xl lg:text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                            {teacherName || <Skeleton className="h-7 w-40 bg-white/20" />}
                        </div>
                        <SillyStringOverlay name={teacherName} fontSize={30} active={isTodayBirthday(teacherDob ?? '')} />
                    </div>
                    <p className="text-white/60 text-sm">{getCasualMessage()}</p>
                    <p className="text-white/50 text-xs mt-2">{dateStr}{currentTime && <span className="ml-2">·&nbsp; {currentTime}</span>}</p>
                </div>

                {/* Animated character */}
                <div className="z-10 relative w-[250px] h-[200px] hidden sm:block self-end mb-[-40px]">
                    <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.img
                                key={currentChar}
                                src={TEACHER_CHARACTERS[currentChar]}
                                alt="teacher character"
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

            <BirthdayBanner
                name={teacherName}
                role="teacher"
                dob={teacherDob ?? ''}
            />

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
            {overviewLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {(overview ? [
                        { label: 'Classes Assigned', value: String(overview.stats.classesAssigned), sub: 'this academic year', trend: 'up' as const, icon: LayoutGrid, iconBg: 'bg-[var(--muted)]', iconColor: 'text-[var(--primary)]' },
                        { label: 'Subjects Teaching', value: String(overview.stats.subjectsTeaching), sub: 'this academic year', trend: 'up' as const, icon: BookOpen, iconBg: 'bg-amber-100 dark:bg-amber-950', iconColor: 'text-amber-600 dark:text-amber-400' },
                        { label: 'Tests Conducted', value: String(overview.stats.testsConducted), sub: 'this academic year', trend: 'up' as const, icon: ClipboardList, iconBg: 'bg-green-100 dark:bg-green-950', iconColor: 'text-green-600 dark:text-green-400' },
                        { label: 'Avg Attendance', value: overview.stats.avgAttendancePct !== null ? `${overview.stats.avgAttendancePct}%` : '—', sub: 'this academic year', trend: 'up' as const, icon: TrendingUp, iconBg: 'bg-sky-100 dark:bg-sky-950', iconColor: 'text-sky-600 dark:text-sky-400' },
                    ] : MOCK_STATS).map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="bg-card border border-border/50 rounded-xl p-4 relative shadow-sm shadow-black/10">
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
            )}

            {/* ── Blackboard + Short Attendance (same as student overview) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-auto lg:h-[390px]" style={{ marginTop: '1.25rem' }}>

                {/* Blackboard — left, same size as student */}
                <div className="lg:col-span-1 h-[390px] lg:h-auto">
                    <Blackboard thought={thought} teacherClass={(() => { const v = overview?.teacher.classTeacherDivisionName ?? '—'; const m = v.match(/(\d+[-–]\w+)\s*$/); return m ? m[1] : v; })()} />
                </div>

                {/* Notepad */}
                <div className="col-span-1 h-[390px]">
                    <TeacherNotepad />
                </div>
            </div>

            {/* ── Graph + AI Token + Short Attendance ── */}
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 items-stretch" style={{ marginTop: '1.25rem' }}>

                {/* Graph — 2 cols */}
                <div className="col-span-1 lg:col-span-3">
                    <TeacherAttendanceChart data={overview?.attendanceTrend} />
                </div>

                {/* AI Token — 2 cols */}
                <div className="col-span-1 lg:col-span-2 bg-card border border-border/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={15} className="text-muted-foreground" />
                        <p className="text-sm font-medium">AI Token Usage</p>
                        <span className="ml-auto text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">Last 30 Days</span>
                    </div>
                    <div className="p-4 space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-xs font-semibold">Your usage · last 30 days</p>
                                <span className="text-xs font-bold">
                                    {aiUsageLoading ? '…' : formatTokens(aiUsage?.totalTokens ?? 0)}
                                    <span className="text-muted-foreground font-normal"> / {formatTokens(aiUsage?.institutionPoolLimit ?? 0)} pool</span>
                                </span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(aiUsage?.poolSharePct ?? 0, 100)}%`, background: 'var(--primary)' }} />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">{aiUsageLoading ? '…' : aiUsage?.poolSharePct ?? 0}% of institution pool</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-muted/40 rounded-xl p-3 text-center">
                                <p className="text-sm font-bold">{aiUsageLoading ? '…' : formatTokens(aiUsage?.totalTokens ?? 0)}</p>
                                <p className="text-[10px] text-muted-foreground">Used</p>
                            </div>
                            <div className="bg-muted/40 rounded-xl p-3 text-center">
                                <p className="text-sm font-bold">{aiUsageLoading ? '…' : formatTokens(Math.max(0, (aiUsage?.institutionPoolLimit ?? 0) - (aiUsage?.totalTokens ?? 0)))}</p>
                                <p className="text-[10px] text-muted-foreground">Remaining</p>
                            </div>
                            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(124,58,237,0.08)' }}>
                                <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{aiUsageLoading ? '…' : `${aiUsage?.poolSharePct ?? 0}%`}</p>
                                <p className="text-[10px] text-muted-foreground">Pool share</p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[11px] font-semibold text-muted-foreground">Institution pool</p>
                                <span className="text-[11px] font-semibold">
                                    {aiUsageLoading ? '…' : formatTokens(aiUsage?.institutionPoolUsed ?? 0)}
                                    <span className="font-normal text-muted-foreground"> / {formatTokens(aiUsage?.institutionPoolLimit ?? 0)} used</span>
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{
                                    width: `${aiUsage?.institutionPoolLimit ? Math.min(100, Math.round((aiUsage.institutionPoolUsed / aiUsage.institutionPoolLimit) * 100)) : 0}%`,
                                    background: '#DA7756',
                                }} />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">Shared across all teachers</p>
                        </div>
                    </div>
                </div>

                {/* Short Attendance — 1 col */}
                <div className="col-span-1 bg-card border border-border/50 rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={15} className="text-muted-foreground" />
                            <p className="text-sm font-medium">Short Attendance</p>
                        </div>
                        <span className="text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-950/40 px-2 py-0.5 rounded-full">{(overview?.shortAttendance ?? []).length}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">Students below 75%</p>
                    <div className="space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: '168px' }}>
                        {(overview?.shortAttendance ?? []).map((s, i) => (
                            <motion.div key={s.rollNo} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                                className="flex items-center gap-2 p-2 rounded-xl border border-border/50 bg-muted/20">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden"
                                    style={{ background: s.avatarUrl ? 'transparent' : (s.pct >= 65 ? '#D97706' : '#DC2626') }}>
                                    {s.avatarUrl
                                        ? <img src={s.avatarUrl} alt={s.name} className="w-full h-full object-cover" />
                                        : s.name.split(' ').map(n => n[0]).join('')}
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
            <div className="flex flex-col gap-3" style={{ marginTop: '1.25rem' }}>

                {/* Recent Audit Logs */}
                <div className="bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <ScrollText size={15} className="text-muted-foreground" />
                            <p className="text-sm font-medium">Recent Audit Logs</p>
                        </div>
                        <a href="/teacher/audit-logs" className="text-xs text-primary hover:underline">
                            View all →
                        </a>
                    </div>
                    {(overview?.auditLogs ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4">No recent activity.</p>
                    ) : (
                        <div className="space-y-0.5">
                            {(overview?.auditLogs ?? []).slice(0, 3).map((log) => {
                                const actionCfg = ACTION_CONFIG[log.action] ?? {
                                    label: log.action.replace(/_/g, ' '),
                                    cls: 'bg-muted text-muted-foreground',
                                    dot: 'bg-muted-foreground',
                                };
                                const { date, time } = toIST(log.createdAt);
                                return (
                                    <div key={log.id} className="grid grid-cols-1 lg:grid-cols-[140px_1fr] items-start gap-1.5 lg:gap-3 py-2.5 border-b border-border/40 last:border-none">
                                        {/* Action badge */}
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit mt-0.5 ${actionCfg.cls}`}>
                                            {actionCfg.label}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-xs text-foreground leading-relaxed">{log.details}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-[11px] text-muted-foreground">{log.ip}</p>
                                                <span className="text-muted-foreground/40">·</span>
                                                <p className="text-[11px] text-muted-foreground">{date} · {time}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}