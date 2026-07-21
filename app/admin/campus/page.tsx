'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import NextImage from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUp, Send, X, Rss, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { AttachmentPreview } from '@/components/shared/AttachmentPreview';
import { validateAttachment, ATTACHMENT_ACCEPT } from '@/lib/attachmentValidation';
import { formatDisplayName, resolveDisplayTitle } from '@/lib/displayName';

// ── Types ─────────────────────────────────────────────────────────────────────
type EventType = 'holiday' | 'event' | 'sports' | 'trip' | 'meeting';
interface CalEvent { id: string; date: number; type: EventType; label: string; fullDate: string; }

type PostType = 'announcement' | 'notice' | 'material' | 'result';
interface FeedPost {
    id: string; type: PostType; author: { id: string; name: string; role: string; avatarUrl?: string | null; prefix?: string | null; title?: string | null };
    subject?: string | null; title: string; body: string; createdAt: string;
    attachmentUrl?: string | null; attachmentType?: string | null; attachmentName?: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────
const EVENT_CFG = {
    holiday: { dot: '#EF4444', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', label: 'Holiday', emoji: '🏖️' },
    event: { dot: '#3B82F6', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', label: 'Event', emoji: '🎉' },
    sports: { dot: '#DB2777', bg: 'bg-pink-100 dark:bg-pink-950/40', text: 'text-pink-700 dark:text-pink-400', label: 'Sports', emoji: '🏆' },
    trip: { dot: '#92400E', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-800 dark:text-amber-500', label: 'Trip', emoji: '🚌' },
    meeting: { dot: '#F97316', bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', label: 'Meeting', emoji: '🤝' },
} as const;

const POST_META = {
    announcement: { emoji: '📢', label: 'Announcement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    notice: { emoji: '📌', label: 'Notice', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    material: { emoji: '📄', label: 'Material', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    result: { emoji: '✅', label: 'Result', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
} as const;

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];
const FILTERS: { key: PostType | 'all'; label: string; emoji: string }[] = [
    { key: 'all', label: 'All', emoji: '🗂️' },
    { key: 'announcement', label: 'Announcement', emoji: '📢' },
    { key: 'notice', label: 'Notice', emoji: '📌' },
    { key: 'material', label: 'Material', emoji: '📄' },
    { key: 'result', label: 'Results', emoji: '✅' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }

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

// ── Academic Calendar ─────────────────────────────────────────────────────────
function AcademicCalendar({ canManage }: { canManage: boolean }) {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [events, setEvents] = useState<CalEvent[]>([]);
    const [selectedDate, setSelectedDate] = useState<number | null>(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addDate, setAddDate] = useState<number | null>(null);
    const [newLabel, setNewLabel] = useState('');
    const [newType, setNewType] = useState<EventType>('holiday');
    const [saving, setSaving] = useState(false);

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    const today = now.getDate();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const startOffset = (getFirstDay(year, month) + 6) % 7;
    const daysInMonth = getDaysInMonth(year, month);
    const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);

    const fetchEvents = useCallback(async () => {
        try {
            const res = await api.get('/admin/campus/feed/events', { params: { year, month } });
            setEvents(res.data.data);
        } catch {
            // silent — calendar stays empty
        }
    }, [year, month]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const eventsOn = (d: number) => events.filter(e => e.date === d);

    const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

    const handleAddEvent = async () => {
        if (!newLabel.trim() || !addDate) return;
        setSaving(true);
        try {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(addDate).padStart(2, '0')}`;
            const res = await api.post('/admin/campus/feed/events', { type: newType.toUpperCase(), label: newLabel.trim(), date: dateStr });
            setEvents(prev => [...prev, res.data.data]);
            setNewLabel(''); setNewType('holiday'); setShowAddModal(false);
            toast.success('Event added');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to add event');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        try {
            await api.delete(`/admin/campus/feed/events/${eventId}`);
            setEvents(prev => prev.filter(e => e.id !== eventId));
            if (selectedDate && eventsOn(selectedDate).length <= 1) setShowEventModal(false);
            toast.success('Event removed');
        } catch {
            toast.error('Failed to remove event');
        }
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
                <div className="bg-background rounded-xl mb-2">
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
                                    onClick={() => {
                                        setSelectedDate(d);
                                        if (evs.length > 0) setShowEventModal(true);
                                        else if (canManage) { setAddDate(d); setShowAddModal(true); }
                                    }}
                                    className={`relative flex flex-col items-center justify-center aspect-square text-[10px] font-medium transition-all border-r border-b border-border/50
                                        ${isSelected ? 'bg-primary/15 text-primary' : ''}
                                        ${isToday && !isSelected ? 'ring-2 ring-[#DA7756] text-[#DA7756] font-bold bg-[#DA7756]/10' : ''}
                                        ${isWeekend && !isSelected && !isToday ? 'text-red-500' : ''}
                                        ${!isSelected && !isToday && !isWeekend ? 'text-foreground' : ''}
                                        hover:bg-muted/60`}>
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
                    {canManage && <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">Click any date to add an event</p>}
                </div>
            </div>

            {/* Event detail modal */}
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
                                {eventsOn(selectedDate).map((ev) => (
                                    <div key={ev.id} className={`flex items-center gap-3 p-3 rounded-xl border-l-4 ${EVENT_CFG[ev.type].bg}`}
                                        style={{ borderLeftColor: EVENT_CFG[ev.type].dot }}>
                                        <span className="text-lg">{EVENT_CFG[ev.type].emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[11px] font-semibold ${EVENT_CFG[ev.type].text}`}>{EVENT_CFG[ev.type].label}</p>
                                            <p className={`text-xs font-bold ${EVENT_CFG[ev.type].text}`}>{ev.label}</p>
                                        </div>
                                        {canManage && (
                                            <button onClick={() => handleDeleteEvent(ev.id)}
                                                className="w-6 h-6 rounded-md flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shrink-0">
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {canManage && (
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
                {showAddModal && addDate && (
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
                                <div className="grid grid-cols-4 gap-1.5">
                                    {(Object.keys(EVENT_CFG) as EventType[]).map(type => (
                                        <button key={type} onClick={() => setNewType(type)}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-[10px] font-semibold transition-all ${newType === type ? `border-current ${EVENT_CFG[type].text} ${EVENT_CFG[type].bg}` : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                                            <span className="text-base">{EVENT_CFG[type].emoji}</span>
                                            {EVENT_CFG[type].label}
                                        </button>
                                    ))}
                                </div>
                                <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddEvent(); }}
                                    placeholder="Event name..."
                                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                                <button onClick={handleAddEvent} disabled={!newLabel.trim() || saving}
                                    className="w-full h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    {saving ? 'Adding...' : 'Add Event'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function VerifiedBadge() {
    return (
        <svg width="12" height="12" viewBox="0 0 40 40" fill="none">
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

// ── Feed Post Card ────────────────────────────────────────────────────────────
function FeedCard({ post, onDelete, canManage }: { post: FeedPost; onDelete: (id: string) => void; canManage: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const isLongBody = (post.body?.length ?? 0) > 100;
    const meta = POST_META[post.type];
    const name = post.author.name;
    const displayName = formatDisplayName(name, post.author.prefix);
    const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    const avatarColor = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

    return (
        <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>
                    {meta.emoji} {meta.label}
                    {post.subject && <span className="font-normal opacity-75">· {post.subject}</span>}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{formatRelative(post.createdAt)}</span>
                    {canManage && (
                        <button onClick={() => setConfirmDelete(true)}
                            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-red-500 transition-colors">
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2.5">
                <div className="relative">
                    <div className="w-8 h-8 rounded-full overflow-hidden relative flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ background: post.author.avatarUrl ? 'transparent' : avatarColor }}>
                        {post.author.avatarUrl
                            ? <NextImage src={post.author.avatarUrl} alt={name} fill sizes="32px" className="object-cover" />
                            : initials}
                    </div>

                </div>
                <div>
                    <div>
                        <p className="text-xs font-semibold">{displayName}</p>
                        <div className="flex items-center gap-1">
                            <p className="text-[10px] text-muted-foreground">{resolveDisplayTitle(post.author.role, post.author.title)}</p>
                            <VerifiedBadge />
                        </div>
                    </div>
                </div>
            </div>
            <div>
                <p className="text-sm font-bold mb-1">{post.title}</p>
                {post.body && (
                    <p className={`text-xs text-muted-foreground leading-relaxed ${!expanded && isLongBody ? 'line-clamp-2' : ''}`}>{post.body}</p>
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
            {/* Confirm popup */}
            <AnimatePresence>
                {confirmDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                            <h3 className="text-base font-bold mb-2">Delete Post?</h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                This post will be permanently deleted. Are you sure?
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmDelete(false)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => { onDelete(post.id); setConfirmDelete(false); }}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white bg-red-500 hover:opacity-90 transition-all">
                                    Yes, Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function AdminCampusPage() {
    const { instType: _instType } = useMockInstType();
    const { user } = useAuthStore();
    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const canManage = !isSubAdmin || (user?.permissions ?? []).includes('CAMPUS_FEED');
    const [activeFilter, setActiveFilter] = useState<PostType | 'all'>('all');
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const feedScrollRef = useRef<HTMLDivElement>(null);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [postInput, setPostInput] = useState('');
    const [postType, setPostType] = useState<PostType>('announcement');
    const [postSubject, setPostSubject] = useState('');
    const [posting, setPosting] = useState(false);
    const fetchedRef = useRef(false);
    const [postBody, setPostBody] = useState('');
    const [postAttachment, setPostAttachment] = useState<{ url: string; name: string; type: string; mimeType: string } | null>(null);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchPosts = useCallback(async (filter: PostType | 'all' = 'all') => {
        setLoadingPosts(true);
        try {
            const res = await api.get('/admin/campus/feed/posts', {
                params: { limit: 50, ...(filter !== 'all' ? { type: filter } : {}) },
            });
            setPosts(res.data.data);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to load feed');
        } finally {
            setLoadingPosts(false);
        }
    }, []);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchPosts();
    }, [fetchPosts]);

    const handleFilterChange = (f: PostType | 'all') => {
        setActiveFilter(f);
        fetchPosts(f);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const err = validateAttachment(file);
        if (err) { toast.error(err); return; }
        setUploadingAttachment(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await api.post('/admin/campus/feed/upload', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setPostAttachment(res.data.data);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
                ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Upload failed');
        } finally {
            setUploadingAttachment(false);
        }
    };

    const handlePost = async () => {
        if (!postInput.trim()) return;
        setPosting(true);
        try {
            const res = await api.post('/admin/campus/feed/posts', {
                type: postType.toUpperCase(),
                title: postInput.trim(),
                body: postBody.trim(),
                subject: postSubject.trim() || undefined,
                ...(postAttachment ? {
                    attachmentUrl: postAttachment.url,
                    attachmentType: postAttachment.mimeType,
                    attachmentName: postAttachment.name,
                } : {}),
            });
            setPosts(prev => [res.data.data, ...prev]);
            setPostInput('');
            setPostBody('');
            setPostSubject('');
            setPostAttachment(null);
            toast.success('Posted');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to post');
        } finally {
            setPosting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/admin/campus/feed/posts/${id}`);
            setPosts(prev => prev.filter(p => p.id !== id));
            toast.success('Post deleted');
        } catch {
            toast.error('Failed to delete post');
        }
    };

    const filtered = activeFilter === 'all' ? posts : posts.filter(p => p.type === activeFilter);

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
                        <p className="text-[13px] text-muted-foreground">Announcements &amp; Academic Calendar</p>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pb-2">

                {/* Feed panel */}
                <div className="relative w-full lg:w-[65%] h-[70vh] lg:h-auto flex flex-col min-h-0 overflow-hidden border border-border/50 rounded-2xl bg-card shadow-md shadow-black/20">
                    <div className="px-4 pt-3 pb-2 border-b border-border/40 shrink-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h2 className="text-sm font-bold">📢 Announcements &amp; Feed</h2>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {FILTERS.map(tab => {
                                    const isActive = activeFilter === tab.key;
                                    return (
                                        <button key={tab.key} onClick={() => handleFilterChange(tab.key)}
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all ${isActive ? 'bg-primary text-white border-primary' : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'}`}>
                                            {tab.emoji} {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div ref={feedScrollRef} onScroll={e => setShowScrollTop(e.currentTarget.scrollTop > 200)} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0 bg-background">
                        {loadingPosts && (
                            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>
                        )}
                        {!loadingPosts && filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <p className="text-sm font-medium text-muted-foreground">No posts yet</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Write the first announcement below</p>
                            </div>
                        )}
                        {filtered.map(post => <FeedCard key={post.id} post={post} onDelete={handleDelete} canManage={canManage} />)}
                    </div>

                    <AnimatePresence>
                        {showScrollTop && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ y: -5, transition: { type: 'spring', stiffness: 500, damping: 8 } }}
                                whileTap={{ scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                onClick={() => feedScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                                className="absolute bottom-[88px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-md border border-border/60 bg-card text-foreground z-10 hover:shadow-lg hover:border-primary/40 hover:text-primary"
                                title="Back to top"
                            >
                                <ArrowUp size={15} />
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {/* Composer — only for admins and subadmins with CAMPUS_MANAGE */}
                    {canManage && <div className="border-t border-border/40 px-3 py-1.5 shrink-0 space-y-1.5">
                        {/* Row 1 — Title + Subject + Filters */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                            <div className="w-full sm:flex-1 flex items-center gap-2 h-7 px-3 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                <input value={postInput} onChange={e => setPostInput(e.target.value)}
                                    placeholder="Title..."
                                    className="flex-1 bg-transparent text-sm font-bold placeholder:text-muted-foreground/60 placeholder:font-normal focus:outline-none" />
                                <div className="w-px h-4 bg-border/50 shrink-0" />
                                <input value={postSubject} onChange={e => setPostSubject(e.target.value)}
                                    placeholder="Subject (optional)"
                                    className="w-28 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none" />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {(['announcement', 'notice', 'material', 'result'] as PostType[]).map(type => {
                                    const meta = POST_META[type];
                                    return (
                                        <button key={type} onClick={() => setPostType(type)}
                                            className={`px-2 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap transition-all ${postType === type ? meta.cls + ' border-current' : 'border-border/50 text-muted-foreground hover:border-border'
                                                }`}>
                                            {meta.emoji}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Row 2 — Body + Attach + Send */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center px-3 py-2 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                <input value={postBody} onChange={e => setPostBody(e.target.value)}
                                    placeholder="Write description (optional)..."
                                    className="flex-1 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none" />
                                {uploadingAttachment && (
                                    <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-lg bg-muted border border-border/50 text-[10px] text-muted-foreground">
                                        <span className="w-3 h-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                                        Uploading...
                                    </div>
                                )}
                                {postAttachment && !uploadingAttachment && (
                                    <div className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-lg bg-muted border border-border/50 text-[10px]">
                                        <span>{
                                            postAttachment.mimeType.startsWith('image/') ? '🖼️' :
                                                postAttachment.name.endsWith('.pdf') ? '📄' :
                                                    postAttachment.name.endsWith('.xlsx') || postAttachment.name.endsWith('.xls') ? '📊' :
                                                        postAttachment.name.endsWith('.docx') || postAttachment.name.endsWith('.doc') ? '📝' : '📎'
                                        }</span>
                                        <span className="truncate max-w-[60px] text-muted-foreground">{postAttachment.name}</span>
                                        <button onClick={() => setPostAttachment(null)}>
                                            <X size={9} className="text-muted-foreground hover:text-red-500" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleFileSelect} />
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAttachment}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50 transition-all shrink-0 disabled:opacity-50">
                                <Paperclip size={14} />
                            </button>
                            <button onClick={handlePost} disabled={!postInput.trim() || posting || uploadingAttachment}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                <Send size={13} />
                            </button>
                        </div>
                    </div>}
                </div>

                {/* Calendar panel */}
                <div className="w-full lg:w-[35%] min-h-0 shadow-md shadow-black/20 rounded-2xl" style={{ height: '420px', alignSelf: 'flex-start' }}>
                    <AcademicCalendar canManage={canManage} />
                </div>
            </div>
        </div>
    );
}
