'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Rss, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type EventType = 'holiday' | 'event' | 'sports' | 'trip' | 'meeting' | 'test' | 'termtest' | 'exam' | 'submission';
interface CalEvent { id: string; date: number; type: EventType; label: string; createdBy: string; }

type PostType = 'announcement' | 'notice' | 'material' | 'result';
type FeedSource = 'general' | 'class';

interface FeedPost {
    id: string; type: PostType; source: FeedSource;
    author: string; role: string;
    subject?: string; title: string; body: string; time: string;
    attachments?: { name: string; kind: 'pdf' | 'link' }[];
}

// ── Config ────────────────────────────────────────────────────────────────────
const EVENT_CFG = {
    // Campus-wide (from main feed calendar)
    holiday:    { dot: '#EF4444', bg: 'bg-red-100 dark:bg-red-950/40',      text: 'text-red-700 dark:text-red-400',       label: 'Holiday',       emoji: '🏖️' },
    event:      { dot: '#3B82F6', bg: 'bg-blue-100 dark:bg-blue-950/40',    text: 'text-blue-700 dark:text-blue-400',     label: 'Event',         emoji: '📅' },
    sports:     { dot: '#DB2777', bg: 'bg-pink-100 dark:bg-pink-950/40',    text: 'text-pink-700 dark:text-pink-400',     label: 'Sports',        emoji: '🏆' },
    trip:       { dot: '#92400E', bg: 'bg-amber-100 dark:bg-amber-950/40',  text: 'text-amber-800 dark:text-amber-500',   label: 'Trip',          emoji: '🚌' },
    meeting:    { dot: '#F97316', bg: 'bg-orange-100 dark:bg-orange-950/40',text: 'text-orange-700 dark:text-orange-400', label: 'Meeting',       emoji: '🤝' },
    // Class-specific (from class calendar)
    test:       { dot: '#8B5CF6', bg: 'bg-violet-100 dark:bg-violet-950/40',text: 'text-violet-700 dark:text-violet-400', label: 'Test',          emoji: '📝' },
    termtest:   { dot: '#10B981', bg: 'bg-emerald-100 dark:bg-emerald-950/40',text: 'text-emerald-700 dark:text-emerald-400',label: 'Term Test',  emoji: '📋' },
    exam:       { dot: '#F59E0B', bg: 'bg-amber-100 dark:bg-amber-950/40',  text: 'text-amber-700 dark:text-amber-400',   label: 'Semester Exam', emoji: '🎓' },
    submission: { dot: '#0891B2', bg: 'bg-cyan-100 dark:bg-cyan-950/40',    text: 'text-cyan-700 dark:text-cyan-400',     label: 'Submission',    emoji: '📤' },
} as const;

const POST_META = {
    announcement: { emoji: '📢', label: 'Announcement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    notice:       { emoji: '📌', label: 'Notice',       cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    material:     { emoji: '📄', label: 'Material',     cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    result:       { emoji: '✅', label: 'Result',        cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
} as const;

const SOURCE_CFG: Record<FeedSource, { label: string; cls: string }> = {
    general: { label: 'General', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400' },
    class:   { label: '10-A',    cls: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400' },
};

type FilterKey = PostType | FeedSource | 'all';

const FILTERS: { key: FilterKey; label: string; emoji: string }[] = [
    { key: 'all',          label: 'All',          emoji: '🗂️' },
    { key: 'general',      label: 'General',      emoji: '🏫' },
    { key: 'class',        label: '10-A',         emoji: '🏷️' },
    { key: 'announcement', label: 'Announcement', emoji: '📢' },
    { key: 'notice',       label: 'Notice',       emoji: '📌' },
    { key: 'material',     label: 'Material',     emoji: '📄' },
    { key: 'result',       label: 'Results',      emoji: '✅' },
];

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];

// ── Mock Data ─────────────────────────────────────────────────────────────────
const ALL_POSTS: FeedPost[] = [
    {
        id: 'c1', type: 'announcement', source: 'class', author: 'Mrs. Priya Sharma', role: 'Class Teacher', subject: 'M1',
        title: 'Chapter 5 syllabus revised',
        body: 'Algebra chapter 5 topics have been updated. Students are requested to focus on quadratic equations only. Notes will be shared by tomorrow.',
        time: '2h ago',
    },
    {
        id: 'g1', type: 'notice', source: 'general', author: 'Principal Office', role: 'Admin',
        title: 'School closed on 14th May',
        body: 'School will remain closed on 14th May due to a state-declared holiday. All pending submissions are extended by 2 days automatically.',
        time: '4h ago',
    },
    {
        id: 'c2', type: 'material', source: 'class', author: 'Mr. Rahul Verma', role: 'Subject Teacher', subject: 'S1',
        title: 'Physics Notes — Chapter 3',
        body: 'Complete notes for Laws of Motion uploaded. Please revise before the unit test on Friday.',
        time: '5h ago',
        attachments: [{ name: 'Physics_Ch3_Notes.pdf', kind: 'pdf' }],
    },
    {
        id: 'g2', type: 'announcement', source: 'general', author: 'Admin Office', role: 'Admin',
        title: 'Annual Sports Day — 25th May',
        body: 'Annual Sports Day will be held on 25th May. All students must register for events by 20th May. Registration forms are available at the admin office.',
        time: '1d ago',
    },
    {
        id: 'c3', type: 'result', source: 'class', author: 'Mrs. Sunita Rao', role: 'Subject Teacher', subject: 'Eng',
        title: 'Unit Test 1 Results Published',
        body: 'Results for English Unit Test 1 are now live. Check your marks in the Tests section. Class average: 28/40.',
        time: '2d ago',
    },
    {
        id: 'g3', type: 'notice', source: 'general', author: 'Principal Office', role: 'Admin',
        title: 'New Library Timings from June',
        body: 'Library will now be open from 8 AM to 6 PM on all working days starting June 1st. Weekend access requires prior registration.',
        time: '2d ago',
    },
    {
        id: 'c4', type: 'announcement', source: 'class', author: 'Mr. Anil Kumar', role: 'Subject Teacher', subject: 'His',
        title: 'History Project Submission — 20th May',
        body: 'All students must submit their history projects by 20th May. Late submissions will not be accepted. Format: A4 size, handwritten.',
        time: '3d ago',
    },
    {
        id: 'g4', type: 'announcement', source: 'general', author: 'Admin Office', role: 'Admin',
        title: 'Parent-Teacher Meeting — 30th May',
        body: 'PTM scheduled for 30th May from 10 AM to 1 PM. All parents are requested to attend. Bring your ward\'s report card for discussion.',
        time: '4d ago',
    },
    {
        id: 'c5', type: 'material', source: 'class', author: 'Mrs. Deepa Nair', role: 'Subject Teacher', subject: 'Geo',
        title: 'Map Work Reference Sheet',
        body: 'Reference sheet for map work uploaded. Useful for unit test and half yearly exam preparation.',
        time: '4d ago',
        attachments: [{ name: 'MapWork_Ref.pdf', kind: 'pdf' }, { name: 'Practice Questions', kind: 'link' }],
    },
    {
        id: 'g5', type: 'material', source: 'general', author: 'Admin Office', role: 'Admin',
        title: 'Exam Guidelines & Hall Ticket Info',
        body: 'Please read the attached exam guidelines carefully. Hall tickets will be distributed on 18th May.',
        time: '5d ago',
        attachments: [{ name: 'Exam_Guidelines_2025.pdf', kind: 'pdf' }],
    },
];

// General (campus-wide) events — managed by admin/principal
const GENERAL_CAL_EVENTS: CalEvent[] = [
    { id: 'e1', date: 1,  type: 'holiday', label: 'Maharashtra Day',       createdBy: 'Principal Office' },
    { id: 'e2', date: 5,  type: 'event',   label: 'Science Exhibition',    createdBy: 'Principal Office' },
    { id: 'e3', date: 10, type: 'meeting', label: 'Parent-Teacher Meeting',createdBy: 'Principal Office' },
    { id: 'e4', date: 14, type: 'holiday', label: 'Budget Holiday',        createdBy: 'Principal Office' },
    { id: 'e5', date: 18, type: 'sports',  label: 'Inter-House Sports',    createdBy: 'Principal Office' },
    { id: 'e6', date: 22, type: 'event',   label: 'Annual Day Rehearsal',  createdBy: 'Principal Office' },
    { id: 'e7', date: 25, type: 'trip',    label: 'Educational Trip',      createdBy: 'Principal Office' },
    { id: 'e8', date: 28, type: 'event',   label: 'Prize Distribution',    createdBy: 'Principal Office' },
];

// Class-specific events — managed by class teacher
const CLASS_CAL_EVENTS: CalEvent[] = [
    { id: 'c1', date: 5,  type: 'test',      label: 'Unit Test — Mathematics',  createdBy: 'Mrs. Priya Sharma' },
    { id: 'c2', date: 10, type: 'submission', label: 'History Assignment Due',   createdBy: 'Mr. Anil Kumar' },
    { id: 'c3', date: 15, type: 'termtest',  label: 'Term Test — Science',       createdBy: 'Mr. Rahul Verma' },
    { id: 'c4', date: 18, type: 'test',      label: 'Science Quiz',              createdBy: 'Mr. Rahul Verma' },
    { id: 'c5', date: 22, type: 'exam',      label: 'Semester Exam — English',   createdBy: 'Mrs. Sunita Rao' },
    { id: 'c6', date: 23, type: 'exam',      label: 'Semester Exam — Maths',     createdBy: 'Mrs. Priya Sharma' },
    { id: 'c7', date: 25, type: 'submission',label: 'Geography Project Due',     createdBy: 'Mrs. Deepa Nair' },
    { id: 'c8', date: 28, type: 'exam',      label: 'Semester Exam — Science',   createdBy: 'Mr. Rahul Verma' },
];

// Combined — both shown on calendar
const CAL_EVENTS: CalEvent[] = [...GENERAL_CAL_EVENTS, ...CLASS_CAL_EVENTS];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function getInitials(name: string) { return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase(); }
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

// ── Academic Calendar ─────────────────────────────────────────────────────────
function AcademicCalendar() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [selectedDate, setSelectedDate] = useState<number | null>(null);
    const [showModal, setShowModal] = useState(false);

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS = ['M','T','W','T','F','S','S'];

    const today = now.getDate();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const startOffset = (getFirstDay(year, month) + 6) % 7;
    const daysInMonth = getDaysInMonth(year, month);
    const cells: (number | null)[] = [
        ...Array(startOffset).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const eventsOn = (d: number) => CAL_EVENTS.filter(e => e.date === d);
    const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/40">
                <p className="text-sm font-bold">📅 Academic Calendar</p>
                <div className="flex items-center gap-2">
                    <button onClick={prevMonth} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                        <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-semibold min-w-[100px] text-center">{MONTHS[month]} {year}</span>
                    <button onClick={nextMonth} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-1.5 bg-background">
                <div className="grid grid-cols-7 mb-1">
                    {DAYS.map((d, i) => (
                        <div key={i} className={`text-center text-[10px] font-semibold py-0.5 ${i >= 5 ? 'text-red-500' : 'text-muted-foreground'}`}>{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 border-l border-t border-border/50 bg-card">
                    {cells.map((d, i) => {
                        if (!d) return <div key={i} className="border-r border-b border-border/50" />;
                        const isToday = isCurrentMonth && d === today;
                        const isSelected = d === selectedDate;
                        const evs = eventsOn(d);
                        const isWeekend = (i % 7) >= 5;
                        return (
                            <button key={i}
                                onClick={() => { if (evs.length > 0) { setSelectedDate(d); setShowModal(true); } }}
                                className={`relative flex flex-col items-center justify-center aspect-square text-[10px] font-medium transition-all border-r border-b border-border/50
                                    ${isSelected ? 'bg-primary/15 text-primary' : ''}
                                    ${isToday && !isSelected ? 'ring-2 ring-[#DA7756] text-[#DA7756] font-bold bg-[#DA7756]/10' : ''}
                                    ${isWeekend && !isSelected && !isToday ? 'text-red-500' : ''}
                                    ${!isSelected && !isToday && !isWeekend ? 'text-foreground' : ''}
                                    ${evs.length > 0 ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default'}`}>
                                {d}
                                {evs.length > 0 && (
                                    <div className="flex gap-0.5 absolute bottom-1 items-center">
                                        {evs.slice(0, 3).map((ev, di) => (
                                            <div key={di} className="w-2.5 h-2.5 rounded-full" style={{ background: EVENT_CFG[ev.type].dot }} />
                                        ))}
                                        {evs.length > 3 && <span className="text-[10px] font-bold text-muted-foreground leading-none">+{evs.length - 3}</span>}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2 pt-2 border-t border-border/40">
                    {(Object.keys(EVENT_CFG) as EventType[]).map(type => (
                        <div key={type} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: EVENT_CFG[type].dot }} />
                            <span className="text-[10px] text-muted-foreground">{EVENT_CFG[type].label}</span>
                        </div>
                    ))}
                </div>
                <p className="text-[10px] text-muted-foreground/40 mt-2 text-center">Managed by Principal Office and Teachers</p>
            </div>

            <AnimatePresence>
                {showModal && selectedDate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold">📅 {selectedDate} {MONTHS_S[month]}, {year}</p>
                                <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {eventsOn(selectedDate).map(ev => (
                                    <div key={ev.id} className={`flex items-center gap-3 p-3 rounded-xl border-l-4 ${EVENT_CFG[ev.type].bg}`}
                                        style={{ borderLeftColor: EVENT_CFG[ev.type].dot }}>
                                        <span className="text-lg">{EVENT_CFG[ev.type].emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[11px] font-semibold ${EVENT_CFG[ev.type].text}`}>{EVENT_CFG[ev.type].label}</p>
                                            <p className={`text-xs font-bold ${EVENT_CFG[ev.type].text}`}>{ev.label}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">by {ev.createdBy}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Feed Card ─────────────────────────────────────────────────────────────────
function FeedCard({ post }: { post: FeedPost }) {
    const [expanded, setExpanded] = useState(false);
    const meta = POST_META[post.type];
    const src = SOURCE_CFG[post.source];
    const avatarColor = getAvatarColor(post.author);
    const initials = getInitials(post.author);

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-2xl p-4 space-y-3"
        >
            {/* Type chip + source tag + timestamp */}
            <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>
                    {meta.emoji} {meta.label}
                    {post.subject && <span className="font-normal opacity-75">· {post.subject}</span>}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${src.cls}`}>
                        {src.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{post.time}</span>
                </div>
            </div>

            {/* Author */}
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: avatarColor }}>
                    {initials}
                </div>
                <div>
                    <p className="text-xs font-semibold">{post.author}</p>
                    <p className="text-[10px] text-muted-foreground">{post.role}</p>
                </div>
            </div>

            {/* Content */}
            <div>
                <p className="text-sm font-bold mb-1">{post.title}</p>
                <p className={`text-xs text-muted-foreground leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
                    {post.body}
                </p>
            </div>

            {/* Attachments */}
            {post.attachments && expanded && (
                <div className="space-y-1.5">
                    {post.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 cursor-pointer hover:opacity-80 transition-opacity">
                            <span className="text-sm">{att.kind === 'pdf' ? '📄' : '🔗'}</span>
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 truncate">{att.name}</span>
                        </div>
                    ))}
                </div>
            )}

            <button onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Show less' : 'Read more'}
            </button>
        </motion.div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentFeedPage() {
    const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

    const filtered = ALL_POSTS.filter(p => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'general' || activeFilter === 'class') return p.source === activeFilter;
        return p.type === activeFilter;
    });

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Page Header */}
            <div className="shrink-0 px-1 pb-3">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Rss size={21} /> Feed
                </h1>
                <p className="text-[13px] text-muted-foreground">Announcements &amp; Academic Calendar</p>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Feed + Calendar */}
            <div className="flex gap-3 flex-1 min-h-0 overflow-hidden pb-2">

                {/* Feed panel — LEFT */}
                <div className="w-[65%] flex flex-col min-h-0 overflow-hidden border border-border/50 rounded-2xl bg-card shadow-md shadow-black/20">

                    {/* Header + filters */}
                    <div className="px-4 pt-3 pb-2 border-b border-border/40 shrink-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold">📢 Announcements &amp; Feed</h2>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {FILTERS.map(tab => (
                                    <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all ${
                                            activeFilter === tab.key
                                                ? 'bg-primary text-white border-primary'
                                                : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                                        }`}>
                                        {tab.emoji} {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Feed list */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0 bg-background">
                        <AnimatePresence mode="popLayout">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <p className="text-sm font-medium text-muted-foreground">No posts here</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">Check back later</p>
                                </div>
                            ) : (
                                filtered.map(post => <FeedCard key={post.id} post={post} />)
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Calendar — RIGHT */}
                <div className="w-[35%] shadow-md shadow-black/20 rounded-2xl shrink-0" style={{ height: '440px', alignSelf: 'flex-start' }}>
                    <AcademicCalendar />
                </div>
            </div>
        </div>
    );
}
