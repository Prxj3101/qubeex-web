'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import NextImage from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUp, Rss, X, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { LinkifiedText } from '@/components/shared/LinkifiedText';
import { useStudentStore } from '@/store/studentStore';
import { AttachmentPreview } from '@/components/shared/AttachmentPreview';
import { useFeedBadge } from '@/context/FeedBadgeContext';
import { toast } from 'sonner';
import { formatDisplayName, resolveDisplayTitle } from '@/lib/displayName';

// ── Types ─────────────────────────────────────────────────────────────────────
type EventType = 'holiday' | 'event' | 'sports' | 'trip' | 'meeting' | 'test' | 'termtest' | 'exam' | 'submission';

interface CalEvent {
    id: string;
    date: number;
    fullDate: string;
    type: EventType;
    label: string;
    isClassEvent: boolean;
    createdBy: { id: string; name: string } | null;
}

type PostType = 'announcement' | 'notice' | 'material' | 'result';
type FeedSource = 'general' | 'class';

interface FeedPost {
    id: string;
    type: PostType;
    source: FeedSource;
    author: { id: string; name: string; role: string; avatarUrl?: string | null; prefix?: string | null; title?: string | null };
    subject?: string | null;
    title: string;
    body: string;
    createdAt: string;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
    attachmentName?: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────
const EVENT_CFG = {
    holiday:    { dot: '#EF4444', bg: 'bg-red-100 dark:bg-red-950/40',        text: 'text-red-700 dark:text-red-400',         label: 'Holiday',       emoji: '🏖️' },
    event:      { dot: '#3B82F6', bg: 'bg-blue-100 dark:bg-blue-950/40',      text: 'text-blue-700 dark:text-blue-400',       label: 'Event',         emoji: '📅' },
    sports:     { dot: '#DB2777', bg: 'bg-pink-100 dark:bg-pink-950/40',      text: 'text-pink-700 dark:text-pink-400',       label: 'Sports',        emoji: '🏆' },
    trip:       { dot: '#92400E', bg: 'bg-amber-100 dark:bg-amber-950/40',    text: 'text-amber-800 dark:text-amber-500',     label: 'Trip',          emoji: '🚌' },
    meeting:    { dot: '#F97316', bg: 'bg-orange-100 dark:bg-orange-950/40',  text: 'text-orange-700 dark:text-orange-400',   label: 'Meeting',       emoji: '🤝' },
    test:       { dot: '#8B5CF6', bg: 'bg-violet-100 dark:bg-violet-950/40',  text: 'text-violet-700 dark:text-violet-400',   label: 'Test',          emoji: '📝' },
    termtest:   { dot: '#10B981', bg: 'bg-emerald-100 dark:bg-emerald-950/40',text: 'text-emerald-700 dark:text-emerald-400', label: 'Term Test',     emoji: '📋' },
    exam:       { dot: '#F59E0B', bg: 'bg-amber-100 dark:bg-amber-950/40',    text: 'text-amber-700 dark:text-amber-400',     label: 'Semester Exam', emoji: '🎓' },
    submission: { dot: '#0891B2', bg: 'bg-cyan-100 dark:bg-cyan-950/40',      text: 'text-cyan-700 dark:text-cyan-400',       label: 'Submission',    emoji: '📤' },
} as const;

const POST_META = {
    announcement: { emoji: '📢', label: 'Announcement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    notice:       { emoji: '📌', label: 'Notice',       cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    material:     { emoji: '📄', label: 'Material',     cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    result:       { emoji: '✅', label: 'Result',        cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
} as const;

type FilterKey = PostType | FeedSource | 'all';

const FILTERS: { key: FilterKey; label: string; emoji: string }[] = [
    { key: 'all',          label: 'All',          emoji: '🗂️' },
    { key: 'general',      label: 'General',      emoji: '🏫' },
    { key: 'class',        label: 'My Class',     emoji: '🏷️' },
    { key: 'announcement', label: 'Announcement', emoji: '📢' },
    { key: 'notice',       label: 'Notice',       emoji: '📌' },
    { key: 'material',     label: 'Material',     emoji: '📄' },
    { key: 'result',       label: 'Results',      emoji: '✅' },
];

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function getInitials(name: string) { return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase(); }
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}
function formatDateTime(iso: string) {
    const d = new Date(iso);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h12}:${m} ${ampm}`;
}

// ── Verified Badge (same as teacher/admin feed) ────────────────────────────────
function VerifiedBadge() {
    return (
        <svg width="12" height="12" viewBox="0 0 40 40" fill="none" style={{ marginTop: -1 }}>
            <path d="M20 2
                L23.5 6.5 L29 5 L31.5 10.5 L37.5 12
                L36 18 L40 22 L36 26 L37.5 32
                L31.5 33.5 L29 39 L23.5 37.5
                L20 42 L16.5 37.5 L11 39
                L8.5 33.5 L2.5 32 L4 26
                L0 22 L4 18 L2.5 12
                L8.5 10.5 L11 5 L16.5 6.5 Z"
                fill="#DA7756" />
            <path d="M13 21l5 5 9-10"
                stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Academic Calendar ─────────────────────────────────────────────────────────
function AcademicCalendar() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [events, setEvents] = useState<CalEvent[]>([]);
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

    const fetchEvents = useCallback(async () => {
        try {
            const res = await api.get('/student/feed/events', { params: { year, month } });
            setEvents(res.data.data);
        } catch { /* silent */ }
    }, [year, month]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const eventsOn = (d: number) => events.filter(e => e.date === d);
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
                                            <div key={di} className="w-2.5 h-2.5 rounded-full" style={{ background: EVENT_CFG[ev.type]?.dot ?? '#888' }} />
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
                                {eventsOn(selectedDate).map(ev => {
                                    const cfg = EVENT_CFG[ev.type] ?? EVENT_CFG.event;
                                    return (
                                        <div key={ev.id} className={`flex items-center gap-3 p-3 rounded-xl border-l-4 ${cfg.bg}`}
                                            style={{ borderLeftColor: cfg.dot }}>
                                            <span className="text-lg">{cfg.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</p>
                                                    {ev.isClassEvent && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400">Class</span>
                                                    )}
                                                </div>
                                                <p className={`text-xs font-bold ${cfg.text}`}>{ev.label}</p>
                                                {ev.createdBy && <p className="text-[10px] text-muted-foreground mt-0.5">by {ev.createdBy.name}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Feed Card ─────────────────────────────────────────────────────────────────
function FeedCard({ post, divisionName }: { post: FeedPost; divisionName: string }) {
    const [expanded, setExpanded] = useState(false);
    const isLongBody = (post.body?.length ?? 0) > 100;
    const meta = POST_META[post.type];
    const avatarColor = getAvatarColor(post.author.name);
    const initials = getInitials(post.author.name);

    const sourceLabel = post.source === 'class' ? (divisionName || 'My Class') : 'General';
    const sourceCls = post.source === 'class'
        ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400'
        : 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400';

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-2xl p-4 space-y-3"
        >
            <div className="flex items-center justify-between flex-wrap gap-y-1">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>
                    {meta.emoji} {meta.label}
                    {post.subject && <span className="font-normal opacity-75">· {post.subject}</span>}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sourceCls}`}>
                        {sourceLabel}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{formatRelative(post.createdAt)}</span>
                </div>
            </div>

            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold text-white shrink-0 relative"
                    style={{ background: post.author.avatarUrl ? 'transparent' : avatarColor }}>
                    {post.author.avatarUrl
                        ? <NextImage src={post.author.avatarUrl} alt={post.author.name} fill sizes="32px" className="object-cover" />
                        : initials}
                </div>
                <div>
                    <p className="text-xs font-semibold">{formatDisplayName(post.author.name, post.author.prefix)}</p>
                    <div className="flex items-center gap-1">
                        <p className="text-[10px] text-muted-foreground">{resolveDisplayTitle(post.author.role, post.author.title)}</p>
                        <VerifiedBadge />
                    </div>
                </div>
            </div>

            <div>
                <p className="text-sm font-bold mb-1">{post.title}</p>
                {post.body && (
                    <p className={`text-xs text-muted-foreground leading-relaxed ${!expanded && isLongBody ? 'line-clamp-2' : ''}`}>
                        <LinkifiedText text={post.body} />
                    </p>
                )}
            </div>

            {post.attachmentUrl && post.attachmentName && post.attachmentType && (
                <AttachmentPreview
                    attachment={{ url: post.attachmentUrl, name: post.attachmentName, type: post.attachmentType }}
                />
            )}

            <div className="flex items-center justify-between">
                {isLongBody ? (
                    <button onClick={() => setExpanded(v => !v)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {expanded ? 'Show less' : 'Read more'}
                    </button>
                ) : <span />}
                <span className="text-[11px] text-muted-foreground/70">{formatDateTime(post.createdAt)}</span>
            </div>
        </motion.div>
    );
}

// ── Feed Skeleton ─────────────────────────────────────────────────────────────
function FeedSkeleton() {
    return (
        <div className="space-y-2">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-card border border-border/50 rounded-2xl p-4 space-y-3 animate-pulse">
                    <div className="flex items-center justify-between">
                        <div className="h-6 w-28 bg-muted rounded-full" />
                        <div className="h-4 w-16 bg-muted rounded-full" />
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-muted" />
                        <div className="space-y-1">
                            <div className="h-3 w-24 bg-muted rounded" />
                            <div className="h-2.5 w-16 bg-muted rounded" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="h-4 w-48 bg-muted rounded" />
                        <div className="h-3 w-full bg-muted rounded" />
                        <div className="h-3 w-3/4 bg-muted rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentFeedPage() {
    const { division } = useStudentStore();
    const { setFeedHasNew } = useFeedBadge();
    const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const feedScrollRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [inScreenHasNew, setInScreenHasNew] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const latestCreatedAtRef = useRef<string | null>(null);

    const fetchPosts = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        try {
            const typeParam = (activeFilter === 'general' || activeFilter === 'class' || activeFilter === 'all')
                ? undefined
                : activeFilter;
            const res = await api.get('/student/feed/posts', {
                params: { limit: 50, ...(typeParam ? { type: typeParam } : {}) },
            });
            const all: FeedPost[] = res.data.data;
            const newestAt = all[0]?.createdAt ?? null;

            if (isInitial) {
                latestCreatedAtRef.current = newestAt;
                setInScreenHasNew(false);
            } else if (newestAt && latestCreatedAtRef.current && newestAt > latestCreatedAtRef.current) {
                latestCreatedAtRef.current = newestAt;
                setInScreenHasNew(true); // in-page pulse dot (user is on the feed)
                // nav badge fires only when user is NOT on this page (layout clears it on navigate-in)
                setFeedHasNew(true);
            }

            // Client-side source filter
            const filtered = activeFilter === 'general'
                ? all.filter(p => p.source === 'general')
                : activeFilter === 'class'
                ? all.filter(p => p.source === 'class')
                : all;

            setPosts(filtered);
        } catch (err: unknown) {
            if (isInitial) {
                const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                toast.error(msg ?? 'Failed to load feed');
            }
        }
        if (isInitial) setLoading(false);
    }, [activeFilter, setFeedHasNew]);

    useEffect(() => {
        fetchPosts(true);
        pollRef.current = setInterval(() => fetchPosts(false), 30_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [fetchPosts]);

    // Update FILTERS label for 'class' dynamically
    const filters = FILTERS.map(f => f.key === 'class' ? { ...f, label: division || 'My Class' } : f);

    return (
        <div className="flex flex-col h-full overflow-y-auto lg:overflow-hidden">
            <div className="shrink-0 px-1 pb-3">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Rss size={21} /> Feed
                </h1>
                <p className="text-[13px] text-muted-foreground">Announcements &amp; Academic Calendar</p>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 lg:overflow-hidden pb-2">

                {/* Feed panel — LEFT */}
                <div className="relative w-full lg:w-[65%] h-[70vh] lg:h-auto flex flex-col min-h-0 overflow-hidden border border-border/50 rounded-2xl bg-card shadow-md shadow-black/20">

                    <div className="px-4 pt-3 pb-2 border-b border-border/40 shrink-0">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <h2 className="text-sm font-bold flex items-center gap-1.5">
                                📢 Announcements &amp; Feed
                                {loading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
                                {inScreenHasNew && !loading && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="New updates" />
                                )}
                            </h2>
                            <div className="flex items-center gap-1.5 flex-wrap justify-start lg:justify-end">
                                {filters.map(tab => (
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

                    <div ref={feedScrollRef} onScroll={e => setShowScrollTop(e.currentTarget.scrollTop > 200)} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0 bg-background">
                        {loading ? (
                            <FeedSkeleton />
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {posts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <p className="text-sm font-medium text-muted-foreground">No posts here</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Check back later</p>
                                    </div>
                                ) : (
                                    posts.map(post => (
                                        <FeedCard key={post.id} post={post} divisionName={division} />
                                    ))
                                )}
                            </AnimatePresence>
                        )}
                    </div>

                    <AnimatePresence>
                        {showScrollTop && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ y: -5, transition: { type: 'spring', stiffness: 500, damping: 8 } }}
                                whileTap={{ scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                onClick={() => feedScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-md border border-border/60 bg-card text-foreground z-10 hover:shadow-lg hover:border-primary/40 hover:text-primary"
                                title="Back to top"
                            >
                                <ArrowUp size={15} />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Calendar — RIGHT */}
                <div className="w-full lg:w-[35%] shadow-md shadow-black/20 rounded-2xl shrink-0 h-[420px] lg:h-[440px] lg:self-start">
                    <AcademicCalendar />
                </div>
            </div>
        </div>
    );
}
