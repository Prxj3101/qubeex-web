'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Send, X, Rss, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import type { InstitutionType } from '@/types';
import { useMockInstType } from '@/context/MockInstTypeContext';

// ── Types ─────────────────────────────────────────────────────────────────────
type EventType = 'holiday' | 'test' | 'exam' | 'submission';
interface CalEvent { date: number; type: EventType; label: string; }
type PostType = 'announcement' | 'notice' | 'material' | 'result';
interface FeedPost {
    id: string; type: PostType; author: string; role: string;
    subject?: string; title: string; body: string; time: string;
    attachments?: { name: string; kind: 'pdf' | 'link' }[];
}

// ── Config ────────────────────────────────────────────────────────────────────
const EVENT_CFG = {
    holiday: { dot: '#EF4444', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', label: 'Holiday', emoji: '🏖️' },
    test: { dot: '#3B82F6', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', label: 'Test', emoji: '📝' },
    exam: { dot: '#F59E0B', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', label: 'Main Exam', emoji: '🎓' },
    submission: { dot: '#8B5CF6', bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', label: 'Submission', emoji: '📤' },
} as const;

const POST_META = {
    announcement: { emoji: '📢', label: 'Announcement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    notice: { emoji: '📌', label: 'Notice', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    material: { emoji: '📄', label: 'Material', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    result: { emoji: '✅', label: 'Result', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
} as const;

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];

const SCHOOL_EVENTS: CalEvent[] = [
    { date: 1, type: 'holiday', label: 'Maharashtra Day' },
    { date: 5, type: 'test', label: 'Mathematics Unit Test' },
    { date: 10, type: 'submission', label: 'History Assignment Due' },
    { date: 14, type: 'holiday', label: 'Budget Holiday' },
    { date: 18, type: 'test', label: 'Science Quiz' },
    { date: 22, type: 'exam', label: 'Half Yearly Exam — English' },
    { date: 23, type: 'exam', label: 'Half Yearly Exam — Maths' },
    { date: 25, type: 'submission', label: 'Geography Project Due' },
    { date: 28, type: 'exam', label: 'Half Yearly Exam — Science' },
];

const COLLEGE_EVENTS: CalEvent[] = [
    { date: 1, type: 'holiday', label: 'Maharashtra Day' },
    { date: 5, type: 'test', label: 'DS Unit Test 1' },
    { date: 10, type: 'submission', label: 'ML Assignment Due' },
    { date: 14, type: 'holiday', label: 'Budget Holiday' },
    { date: 18, type: 'test', label: 'DBMS Quiz' },
    { date: 22, type: 'exam', label: 'Mid Semester — DS' },
    { date: 25, type: 'submission', label: 'Major Project Due' },
    { date: 28, type: 'exam', label: 'Mid Semester — CN' },
];

const SCHOOL_POSTS: FeedPost[] = [
    { id: 'p1', type: 'announcement', author: 'Admin', role: 'Admin', title: 'Staff meeting today at 3 PM', body: 'All teachers are requested to attend the staff meeting today at 3 PM in the conference room. Please be on time.', time: '10:32 AM' },
    { id: 'p2', type: 'notice', author: 'Principal Office', role: 'Admin', title: 'School closed on 14th May', body: 'School will remain closed on 14th May due to a state-declared holiday. All pending submissions are extended by 2 days.', time: '1d ago' },
    { id: 'p3', type: 'material', author: 'Ritu Sharma', role: 'Teacher', subject: 'Math', title: 'Chapter 5 Notes', body: 'Complete notes for Chapter 5 uploaded. Please revise before the unit test.', time: '2d ago', attachments: [{ name: 'Math_Ch5_Notes.pdf', kind: 'pdf' }] },
    { id: 'p4', type: 'result', author: 'Ankit Verma', role: 'Teacher', subject: 'Science', title: 'Unit Test 1 Results Published', body: 'Results for Science Unit Test 1 are now live. Class average: 28/40.', time: '3d ago' },
];

const COLLEGE_POSTS: FeedPost[] = [
    { id: 'p1', type: 'announcement', author: 'Admin', role: 'Admin', title: 'Faculty meeting today at 3 PM', body: 'All faculty members are requested to attend the meeting today at 3 PM in the seminar hall.', time: '10:32 AM' },
    { id: 'p2', type: 'notice', author: 'HOD Office', role: 'Admin', title: 'Campus closed on 14th May', body: 'Campus will remain closed on 14th May due to a state-declared holiday.', time: '1d ago' },
    { id: 'p3', type: 'material', author: 'Dr. Ashwini Save', role: 'Faculty', subject: 'DS', title: 'Unit 4 Notes', body: 'Complete notes for Data Structures Unit 4 uploaded. Please revise before the test.', time: '2d ago', attachments: [{ name: 'DS_Unit4_Notes.pdf', kind: 'pdf' }] },
    { id: 'p4', type: 'result', author: 'Prof. Bhavika Thakur', role: 'Faculty', subject: 'DC', title: 'Unit Test 1 Results Published', body: 'Results for DC Unit Test 1 are now live. Batch average: 31/40.', time: '3d ago' },
];

const FILTERS: { key: PostType | 'all'; label: string; emoji: string }[] = [
    { key: 'all', label: 'All', emoji: '🗂️' },
    { key: 'announcement', label: 'Alerts', emoji: '📢' },
    { key: 'notice', label: 'Notice', emoji: '📌' },
    { key: 'material', label: 'Files', emoji: '📄' },
    { key: 'result', label: 'Results', emoji: '✅' },
];

// ── Calendar helpers ──────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }

// ── Academic Calendar ─────────────────────────────────────────────────────────
function AcademicCalendar({ events, isAdmin }: { events: CalEvent[]; isAdmin: boolean }) {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [selectedDate, setSelectedDate] = useState<number | null>(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addDate, setAddDate] = useState<number | null>(null);
    const [localEvents, setLocalEvents] = useState<CalEvent[]>(events);
    const [newLabel, setNewLabel] = useState('');
    const [newType, setNewType] = useState<EventType>('holiday');

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    const today = now.getDate();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const startOffset = (getFirstDay(year, month) + 6) % 7;
    const daysInMonth = getDaysInMonth(year, month);

    const cells: (number | null)[] = [
        ...Array(startOffset).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const eventsOn = (d: number) => localEvents.filter(e => e.date === d);
    const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

    const handleAddEvent = () => {
        if (!newLabel.trim() || !addDate) return;
        setLocalEvents(prev => [...prev, { date: addDate, type: newType, label: newLabel.trim() }]);
        setNewLabel(''); setNewType('holiday'); setShowAddModal(false);
    };

    const handleDeleteEvent = (date: number, label: string) => {
        setLocalEvents(prev => prev.filter(e => !(e.date === date && e.label === label)));
    };

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
                {/* Day headers + Grid — bg-background */}
                <div className="bg-background rounded-xl mb-2">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                        {DAYS.map((d, i) => (
                            <div key={i} className={`text-center text-[10px] font-semibold py-0.5 ${i >= 5 ? 'text-red-500' : 'text-muted-foreground'}`}>{d}</div>
                        ))}
                    </div>
                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 border-l border-t border-border/50 bg-card">                        {cells.map((d, i) => {
                        if (!d) return <div key={i} className="border-r border-b border-border/50" />;
                        const isToday = isCurrentMonth && d === today;
                        const isSelected = d === selectedDate;
                        const evs = eventsOn(d);
                        const isWeekend = (i % 7) >= 5;
                        return (
                            <button key={i}
                                onClick={() => {
                                    setSelectedDate(d);
                                    if (evs.length > 0) setShowEventModal(true);
                                    else if (isAdmin) { setAddDate(d); setShowAddModal(true); }
                                }}
                                className={`relative flex flex-col items-center justify-center aspect-square text-[10px] font-medium transition-all border-r border-b border-border/50
                                    ${isSelected ? 'bg-primary/15 text-primary' : ''}
                                    ${isToday && !isSelected ? 'ring-2 ring-[#DA7756] text-[#DA7756] font-bold bg-[#DA7756]/10' : ''}
                                    ${isWeekend && !isSelected && !isToday ? 'text-red-500' : ''}
                                    ${!isSelected && !isToday && !isWeekend ? 'text-foreground' : ''}
                                    hover:bg-muted/60`}
                            >
                                {d}
                                {evs.length > 0 && (
                                    <div className="flex gap-0.5 absolute bottom-1 items-center">
                                        {evs.slice(0, 3).map((ev, di) => (
                                            <div key={di} className="w-2.5 h-2.5 rounded-full" style={{ background: EVENT_CFG[ev.type].dot }} />
                                        ))}
                                        {evs.length > 3 && (
                                            <span className="text-[10px] font-bold text-muted-foreground leading-none">+{evs.length - 3}</span>
                                        )}
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
                    {isAdmin && <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">Click any date to add an event</p>}
                </div>
            </div>

            {/* Event modal */}
            <AnimatePresence>
                {showEventModal && selectedDate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold">📅 {selectedDate} {MONTHS_S[month]}, {year}</p>
                                <button onClick={() => setShowEventModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {eventsOn(selectedDate).map((ev, i) => (
                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-l-4 ${EVENT_CFG[ev.type].bg}`}
                                        style={{ borderLeftColor: EVENT_CFG[ev.type].dot }}>
                                        <span className="text-lg">{EVENT_CFG[ev.type].emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[11px] font-semibold ${EVENT_CFG[ev.type].text}`}>{EVENT_CFG[ev.type].label}</p>
                                            <p className={`text-xs font-bold ${EVENT_CFG[ev.type].text}`}>{ev.label}</p>
                                        </div>
                                        {isAdmin && (
                                            <button onClick={() => { handleDeleteEvent(selectedDate, ev.label); if (eventsOn(selectedDate).length <= 1) setShowEventModal(false); }}
                                                className="w-6 h-6 rounded-md flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shrink-0">
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {isAdmin && (
                                <button onClick={() => { setShowEventModal(false); setAddDate(selectedDate); setShowAddModal(true); }}
                                    className="mt-3 w-full py-2 rounded-xl border border-border/50 text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    + Add another event
                                </button>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add event modal */}
            <AnimatePresence>
                {showAddModal && addDate && isAdmin && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold">Add Event — {addDate} {MONTHS_S[month]}</p>
                                <button onClick={() => setShowAddModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    {(Object.keys(EVENT_CFG) as EventType[]).map(type => (
                                        <button key={type} onClick={() => setNewType(type)}
                                            className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${newType === type ? `border-current ${EVENT_CFG[type].text} ${EVENT_CFG[type].bg}` : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                                            <span>{EVENT_CFG[type].emoji}</span>
                                            {EVENT_CFG[type].label}
                                        </button>
                                    ))}
                                </div>
                                <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddEvent(); }}
                                    placeholder="Event name..."
                                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                                <button onClick={handleAddEvent} disabled={!newLabel.trim()}
                                    className="w-full h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    Add Event
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Feed Post Card ────────────────────────────────────────────────────────────
function FeedCard({ post }: { post: FeedPost }) {
    const [expanded, setExpanded] = useState(false);
    const meta = POST_META[post.type];
    const initials = post.author.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    const avatarColor = AVATAR_COLORS[post.author.charCodeAt(0) % AVATAR_COLORS.length];

    return (
        <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>
                    {meta.emoji} {meta.label}
                    {post.subject && <span className="font-normal opacity-75">· {post.subject}</span>}
                </span>
                <span className="text-[11px] text-muted-foreground">{post.time}</span>
            </div>
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: avatarColor }}>
                    {initials}
                </div>
                <div>
                    <p className="text-xs font-semibold">{post.author}</p>
                    <p className="text-[10px] text-muted-foreground">{post.role}</p>
                </div>
            </div>
            <div>
                <p className="text-sm font-bold mb-1">{post.title}</p>
                <p className={`text-xs text-muted-foreground leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>{post.body}</p>
            </div>
            {post.attachments && expanded && (
                <div className="space-y-1.5">
                    {post.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                            <span>{att.kind === 'pdf' ? '📄' : '🔗'}</span>
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">{att.name}</span>
                        </div>
                    ))}
                </div>
            )}
            <button onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Show less' : 'Read more'}
            </button>
        </div>
    );
}

// ── Feed Tab ──────────────────────────────────────────────────────────────────
function FeedTab({ instType }: { instType: InstitutionType }) {
    const [activeFilter, setActiveFilter] = useState<PostType | 'all'>('all');
    const [posts, setPosts] = useState<FeedPost[]>(instType === 'COLLEGE' ? COLLEGE_POSTS : SCHOOL_POSTS);
    const [postInput, setPostInput] = useState('');
    const [postType, setPostType] = useState<PostType>('announcement');
    const [postSubject, setPostSubject] = useState('');
    const isAdmin = true;

    const filtered = activeFilter === 'all' ? posts : posts.filter(p => p.type === activeFilter);

    const handlePost = () => {
        if (!postInput.trim()) return;
        setPosts(prev => [{
            id: `p-${Date.now()}`, type: postType, author: 'Admin', role: 'Admin',
            subject: postSubject || undefined, title: postInput.trim(), body: '',
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        }, ...prev]);
        setPostInput(''); setPostSubject('');
    };

    const events = instType === 'COLLEGE' ? COLLEGE_EVENTS : SCHOOL_EVENTS;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-1 pt-0 pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Rss size={21} />
                            Feed
                        </h1>
                        <p className="text-[13px] text-muted-foreground">Announcements & Academic Calendar</p>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>
            {/* ← Yeh wrapper add karo */}
            <div className="flex gap-3 flex-1 min-h-0 overflow-hidden pb-0">

                {/* Announcements */}
                <div className="w-[65%] flex flex-col min-h-0 overflow-hidden border border-border/50 rounded-2xl bg-card shadow-md shadow-black/20">
                    <div className="px-4 pt-3 pb-2 border-b border-border/40 shrink-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold">📢 Announcements & Feed</h2>
                            <div className="flex items-center gap-1.5">
                                {FILTERS.map(tab => {
                                    const isActive = activeFilter === tab.key;
                                    return (
                                        <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all ${isActive ? 'bg-primary text-white border-primary' : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                                                }`}>
                                            {tab.emoji} {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0 bg-background">
                        {filtered.map(post => <FeedCard key={post.id} post={post} />)}
                    </div>
                    {isAdmin && (
                        <div className="border-t border-border/40 px-4 py-3 shrink-0 space-y-2">
                            <div className="flex items-center gap-1.5 overflow-x-auto">
                                {(['announcement', 'notice', 'material', 'result'] as PostType[]).map(type => (
                                    <button key={type} onClick={() => setPostType(type)}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap transition-all ${postType === type ? POST_META[type].cls + ' border-current' : 'border-border/50 text-muted-foreground hover:border-border'
                                            }`}>
                                        {POST_META[type].emoji} {POST_META[type].label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                    <input value={postInput} onChange={e => setPostInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handlePost(); }}
                                        placeholder={`Write a ${POST_META[postType].label.toLowerCase()}...`}
                                        className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none" />
                                    <input value={postSubject} onChange={e => setPostSubject(e.target.value)}
                                        placeholder="Subject (optional)"
                                        className="w-28 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none border-l border-border/40 pl-2" />
                                </div>
                                <button onClick={handlePost} disabled={!postInput.trim()}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 shrink-0 hover:opacity-90 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    <Send size={13} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                {/* Calendar */}
                <div className="w-[35%] min-h-0 shadow-md shadow-black/20 rounded-2xl" style={{ height: '420px', alignSelf: 'flex-start' }}>
                    <AcademicCalendar events={events} isAdmin={isAdmin} />
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminCampusPage() {
    const router = useRouter();
    const { instType } = useMockInstType();
    const [activeTab, setActiveTab] = useState<'feed' | 'classes'>('feed');

    const classesLabel = instType === 'COLLEGE' ? 'Departments' : instType === 'COACHING' ? 'Batches' : 'Classes';

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <>
                <div className="flex-1 min-h-0 overflow-hidden pb-3 h-full">
                    <FeedTab instType={instType} />
                </div>
            </>
        </div>
    );
}