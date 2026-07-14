'use client';

import { useState, useRef, useEffect } from 'react';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, Trophy, Calendar, FileText, Megaphone,
    ChevronDown, ChevronUp, Send, X, Paperclip, Upload, ChevronLeft, ChevronRight, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { Division, Assignment, getInitials, getAvatarColor, AVATAR_COLORS, LeaderboardEntry } from './DivisionClassPageClient';
import { AttachmentPreview } from '@/components/shared/AttachmentPreview';

// ── Types ─────────────────────────────────────────────────────────────────────
type PostType = 'announcement' | 'notice' | 'material' | 'result';
type FeedFilter = 'all' | PostType;

interface DivAnnouncement {
    id: string;
    type: PostType;
    title: string;
    body: string;
    subject: string | null;
    attachmentUrl: string | null;
    attachmentType: string | null;
    attachmentName: string | null;
    createdAt: string;
    author: { id: string; name: string; role: string };
}

const POST_META = {
    announcement: { emoji: '📢', label: 'Announcement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    notice: { emoji: '📌', label: 'Notice', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    material: { emoji: '📄', label: 'Material', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    result: { emoji: '✅', label: 'Result', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
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

// ── Verified Badge ────────────────────────────────────────────────────────────
function VerifiedBadge() {
    return (
        <svg width="12" height="12" viewBox="0 0 40 40" fill="none">
            <path d="M20 2 L23.5 6.5 L29 5 L31.5 10.5 L37.5 12 L36 18 L40 22 L36 26 L37.5 32 L31.5 33.5 L29 39 L23.5 37.5 L20 42 L16.5 37.5 L11 39 L8.5 33.5 L2.5 32 L4 26 L0 22 L4 18 L2.5 12 L8.5 10.5 L11 5 L16.5 6.5 Z" fill="#DA7756" />
            <path d="M13 21l5 5 9-10" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Calendar types ────────────────────────────────────────────────────────────
type CalEventType = 'holiday' | 'event' | 'test' | 'termtest' | 'exam' | 'meeting' | 'submission';
interface CalEvent {
    id: string;
    date: number;
    type: CalEventType;
    label: string;
    inherited?: boolean;
}

const CAL_EVENT_CFG = {
    holiday: { dot: '#EF4444', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', label: 'Holiday', emoji: '🏖️' },
    event: { dot: '#3B82F6', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', label: 'Event', emoji: '📅' },
    test: { dot: '#8B5CF6', bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', label: 'Test', emoji: '📝' },
    termtest: { dot: '#10B981', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', label: 'Term Test', emoji: '📋' },
    exam: { dot: '#F59E0B', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', label: 'Semester Exam', emoji: '🎓' },
    meeting: { dot: '#F97316', bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', label: 'Meeting', emoji: '🤝' },
    submission: { dot: '#0891B2', bg: 'bg-cyan-100 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-400', label: 'Submission', emoji: '📤' },
} as const;

const ALLOWED_TYPES_SUBJECT_TEACHER: CalEventType[] = ['test', 'submission'];
const ALLOWED_TYPES_CLASS_TEACHER: CalEventType[] = ['holiday', 'event', 'test', 'termtest', 'exam', 'meeting', 'submission'];
const KNOWN_CAL_TYPES = new Set<string>(['holiday', 'event', 'test', 'termtest', 'exam', 'meeting', 'submission']);

// ── Class Calendar ────────────────────────────────────────────────────────────
function ClassCalendar({ isClassTeacher, isSubjectTeacher, divisionName, divisionId }: {
    isClassTeacher: boolean;
    isSubjectTeacher: boolean;
    divisionName: string;
    divisionId: string;
}) {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [events, setEvents] = useState<CalEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [selectedDate, setSelectedDate] = useState<number | null>(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addDate, setAddDate] = useState<number | null>(null);
    const [newLabel, setNewLabel] = useState('');
    const [newType, setNewType] = useState<CalEventType>('test');
    const [saving, setSaving] = useState(false);

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    const today = now.getDate();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
        ...Array(startOffset).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const eventsOn = (d: number) => events.filter(e => e.date === d);
    const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

    const canEdit = isClassTeacher || isSubjectTeacher;
    const allowedTypes = isClassTeacher ? ALLOWED_TYPES_CLASS_TEACHER : ALLOWED_TYPES_SUBJECT_TEACHER;

    useEffect(() => {
        setLoadingEvents(true);
        api.get('/teacher/campus/feed/events', { params: { year, month, divisionId } })
            .then(res => {
                const data: CalEvent[] = (res.data.data ?? [])
                    .filter((e: { type: string }) => KNOWN_CAL_TYPES.has(e.type))
                    .map((e: { id: string; date: number; type: string; label: string }) => ({
                        id: e.id,
                        date: e.date,
                        type: e.type as CalEventType,
                        label: e.label,
                    }));
                setEvents(data);
            })
            .catch(() => { /* silent */ })
            .finally(() => setLoadingEvents(false));
    }, [year, month, divisionId]);

    const handleAddEvent = async () => {
        if (!newLabel.trim() || !addDate) return;
        setSaving(true);
        try {
            const dateStr = new Date(Date.UTC(year, month, addDate)).toISOString().split('T')[0];
            const res = await api.post('/teacher/campus/feed/events', {
                type: newType.toUpperCase(),
                label: newLabel.trim(),
                date: dateStr,
                divisionId,
            });
            const e = res.data.data;
            setEvents(prev => [...prev, { id: e.id, date: e.date, type: newType, label: e.label }]);
            setNewLabel('');
            setNewType('test');
            setShowAddModal(false);
            toast.success('Event added');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to add event');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        const remaining = eventsOn(selectedDate ?? 0).filter(e => e.id !== eventId);
        try {
            await api.delete(`/teacher/campus/feed/events/${eventId}`);
            setEvents(prev => prev.filter(e => e.id !== eventId));
            if (remaining.length === 0) setShowEventModal(false);
            toast.success('Event removed');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to remove event');
        }
    };

    return (
        <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} /> {divisionName} Academic Calendar
                    {loadingEvents && <span className="w-3 h-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />}
                </p>
                <div className="flex items-center gap-1.5">
                    <button onClick={prevMonth} className="w-5.5 h-5.5 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                        <ChevronLeft size={14} />
                    </button>
                    <span className="text-[12px] font-semibold min-w-[80px] text-center">{MONTHS[month]} {year}</span>
                    <button onClick={nextMonth} className="w-5.5 h-5.5 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            <div className="px-4.5 py-2.5 bg-background">
                <div className="grid grid-cols-7 mb-1">
                    {DAYS.map((d, i) => (
                        <div key={i} className={`text-center text-[9px] font-semibold py-0.5 ${i >= 5 ? 'text-red-500' : 'text-muted-foreground'}`}>{d}</div>
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
                                    else if (canEdit) { setAddDate(d); setShowAddModal(true); }
                                }}
                                className={`relative flex flex-col items-center justify-center aspect-square text-[9px] font-medium transition-all border-r border-b border-border/50
                                    ${isSelected ? 'bg-primary/15 text-primary' : ''}
                                    ${isToday && !isSelected ? 'ring-2 ring-[#DA7756] text-[#DA7756] font-bold bg-[#DA7756]/10' : ''}
                                    ${isWeekend && !isSelected && !isToday ? 'text-red-500' : ''}
                                    ${!isSelected && !isToday && !isWeekend ? 'text-foreground' : ''}
                                    ${canEdit ? 'hover:bg-muted/60 cursor-pointer' : evs.length > 0 ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default'}`}>
                                {d}
                                {evs.length > 0 && (
                                    <div className="flex gap-0.5 absolute bottom-1 items-center">
                                        {evs.slice(0, 3).map((ev, di) => (
                                            <div key={di} className="w-2.5 h-2.5 rounded-full"
                                                style={{ background: CAL_EVENT_CFG[ev.type].dot }} />
                                        ))}
                                        {evs.length > 3 && <span className="text-[10px] font-bold text-muted-foreground leading-none">+{evs.length - 3}</span>}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2 pt-2 border-t border-border/40">
                    {(Object.keys(CAL_EVENT_CFG) as CalEventType[]).map(type => (
                        <div key={type} className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: CAL_EVENT_CFG[type].dot }} />
                            <span className="text-[10px] text-muted-foreground">{CAL_EVENT_CFG[type].label}</span>
                        </div>
                    ))}
                </div>
                {canEdit && (
                    <p className="text-[9px] text-muted-foreground/40 mt-1 text-center">
                        {isClassTeacher ? 'Click any date to add an event' : 'Click any date to add a test'}
                    </p>
                )}
            </div>

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
                                {eventsOn(selectedDate).map(ev => (
                                    <div key={ev.id} className={`flex items-center gap-3 p-3 rounded-xl border-l-4 ${CAL_EVENT_CFG[ev.type].bg}`}
                                        style={{ borderLeftColor: CAL_EVENT_CFG[ev.type].dot }}>
                                        <span className="text-lg">{CAL_EVENT_CFG[ev.type].emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={`text-[11px] font-semibold ${CAL_EVENT_CFG[ev.type].text}`}>{CAL_EVENT_CFG[ev.type].label}</p>
                                                {ev.inherited && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">School</span>
                                                )}
                                            </div>
                                            <p className={`text-xs font-bold ${CAL_EVENT_CFG[ev.type].text}`}>{ev.label}</p>
                                        </div>
                                        {!ev.inherited && canEdit && (
                                            <button onClick={() => handleDeleteEvent(ev.id)}
                                                className="w-6 h-6 rounded-md flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shrink-0">
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {canEdit && (
                                <button onClick={() => { setShowEventModal(false); setAddDate(selectedDate); setShowAddModal(true); }}
                                    className="mt-3 w-full py-2 rounded-xl border border-border/50 text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    + Add another event
                                </button>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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
                                <div className="grid grid-cols-2 gap-2">
                                    {allowedTypes.map(type => (
                                        <button key={type} onClick={() => setNewType(type)}
                                            className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${newType === type
                                                ? `border-current ${CAL_EVENT_CFG[type].text} ${CAL_EVENT_CFG[type].bg}`
                                                : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                                            <span>{CAL_EVENT_CFG[type].emoji}</span>
                                            {CAL_EVENT_CFG[type].label}
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

// ── Feed Card ─────────────────────────────────────────────────────────────────
function DivFeedCard({ ann, myUserId, onDelete }: {
    ann: DivAnnouncement;
    myUserId: string | null;
    onDelete: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const meta = POST_META[ann.type];
    const initials = ann.author.name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
    const avatarColor = AVATAR_COLORS[ann.author.name.charCodeAt(0) % AVATAR_COLORS.length];
    const isMe = ann.author.id === myUserId;
    const roleLabel = ann.author.role === 'ADMIN' ? 'Admin' : 'Teacher';

    return (
        <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>
                    {meta.emoji} {meta.label}
                    {ann.subject && <span className="font-normal opacity-75">· {ann.subject}</span>}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{formatTime(ann.createdAt)}</span>
                    {isMe && (
                        <button onClick={() => setConfirmDelete(true)}
                            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-red-500 transition-colors">
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: avatarColor }}>
                    {initials}
                </div>
                <div>
                    <p className="text-xs font-semibold">
                        {ann.author.name}
                        {isMe && <span className="text-[10px] font-normal text-muted-foreground ml-1">(You)</span>}
                    </p>
                    <div className="flex items-center gap-1">
                        <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
                        <VerifiedBadge />
                    </div>
                </div>
            </div>
            <div>
                <p className="text-sm font-bold mb-1">{ann.title}</p>
                {ann.body && (
                    <p className={`text-xs text-muted-foreground leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
                        {ann.body}
                    </p>
                )}
            </div>
            {ann.attachmentUrl && ann.attachmentName && ann.attachmentType && (
                <div className="pt-2 border-t border-border/40">
                    <AttachmentPreview
                        attachment={{ url: ann.attachmentUrl, name: ann.attachmentName, type: ann.attachmentType }}
                    />
                </div>
            )}
            <div className="flex items-center justify-between">
                <button onClick={() => setExpanded(v => !v)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {expanded ? 'Show less' : 'Read more'}
                </button>
                <span className="text-[11px] text-muted-foreground/70">{formatDateTime(ann.createdAt)}</span>
            </div>
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
                                <button onClick={() => { onDelete(ann.id); setConfirmDelete(false); }}
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ViewTab({ division, classTeacherAssignment, isClassTeacher, leaderboard }: {
    division: Division;
    classTeacherAssignment: Assignment | undefined;
    isClassTeacher: boolean;
    leaderboard: LeaderboardEntry[];
}) {
    const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
    const [postType, setPostType] = useState<PostType>('announcement');
    const [postInput, setPostInput] = useState('');
    const [postBody, setPostBody] = useState('');
    const [postSubject, setPostSubject] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [announcements, setAnnouncements] = useState<DivAnnouncement[]>([]);
    const [postsLoading, setPostsLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [uploadingResult, setUploadingResult] = useState(false);
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const [showTimetable, setShowTimetable] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const timetableInputRef = useRef<HTMLInputElement>(null);
    const resultsFileInputRef = useRef<HTMLInputElement>(null);
    const [timetableImage, setTimetableImage] = useState<string | null>(null);
    const [leaderTab, setLeaderTab] = useState<'offline' | 'online' | 'combined'>('combined');
    const fetchedRef = useRef(false);

    // Derived
    const results = announcements.filter(a => a.type === 'result');
    const filteredAnnouncements = feedFilter === 'all'
        ? announcements
        : announcements.filter(a => a.type === feedFilter);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        Promise.all([
            api.get('/teacher/me'),
            api.get('/teacher/campus/feed/posts', { params: { divisionId: division.id, limit: 50 } }),
        ])
            .then(([meRes, postsRes]) => {
                setMyUserId(meRes.data.data.id);
                setAnnouncements(postsRes.data.data ?? []);
            })
            .catch(() => toast.error('Failed to load feed'))
            .finally(() => setPostsLoading(false));
    }, [division.id]);

    const handlePost = async () => {
        if (!postInput.trim() || posting) return;
        setPosting(true);
        try {
            let attachmentUrl: string | undefined;
            let attachmentType: string | undefined;
            let attachmentName: string | undefined;

            if (attachments.length > 0) {
                const formData = new FormData();
                formData.append('file', attachments[0]);
                const uploadRes = await api.post('/teacher/campus/feed/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                attachmentUrl = uploadRes.data.data.url;
                attachmentType = uploadRes.data.data.type;
                attachmentName = uploadRes.data.data.name;
            }

            const res = await api.post('/teacher/campus/feed/posts', {
                type: postType.toUpperCase(),
                title: postInput.trim(),
                body: postBody.trim(),
                subject: postSubject.trim() || undefined,
                divisionId: division.id,
                ...(attachmentUrl && { attachmentUrl, attachmentType, attachmentName }),
            });
            setAnnouncements(prev => [res.data.data, ...prev]);
            setPostInput(''); setPostBody(''); setPostSubject(''); setAttachments([]);
            toast.success('Posted!');
        } catch {
            toast.error('Failed to post');
        } finally {
            setPosting(false);
        }
    };

    const handleDeletePost = async (id: string) => {
        try {
            await api.delete(`/teacher/campus/feed/posts/${id}`);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
            toast.success('Post deleted');
        } catch {
            toast.error('Failed to delete post');
        }
    };

    const handleUploadResult = async (file: File) => {
        setUploadingResult(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await api.post('/teacher/campus/feed/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const { url, name, type } = uploadRes.data.data;

            const res = await api.post('/teacher/campus/feed/posts', {
                type: 'RESULT',
                title: file.name.replace(/\.[^.]+$/, ''),
                body: '',
                divisionId: division.id,
                attachmentUrl: url,
                attachmentType: type,
                attachmentName: name,
            });
            setAnnouncements(prev => [res.data.data, ...prev]);
            toast.success('Result uploaded!');
        } catch {
            toast.error('Failed to upload result');
        } finally {
            setUploadingResult(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-3 h-full pt-3 pb-3 px-1 overflow-y-auto lg:overflow-hidden">

            {/* LEFT — Class Teacher info + Feed */}
            <div className="w-full lg:w-[60%] h-[560px] lg:h-auto shrink-0 lg:shrink flex flex-col gap-3 min-h-0 overflow-hidden">

                {/* Class Teacher card */}
                <div className="shrink-0 bg-card border border-border/50 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm shadow-black/5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: '#F59E0B' }}>
                        {classTeacherAssignment ? getInitials(classTeacherAssignment.teacher.user.name ?? 'CT') : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold" style={{ color: '#F59E0B' }}>Class Teacher</p>
                        <p className="text-sm font-bold truncate">
                            {classTeacherAssignment?.teacher.user.name ?? 'Not assigned'}
                            {isClassTeacher && classTeacherAssignment && (
                                <span className="text-xs font-normal text-muted-foreground ml-1">(You)</span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Feed */}
                <div className="flex-1 min-h-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                    <div className="px-4 pt-3 pb-2 border-b border-border/40 shrink-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <Megaphone size={14} /> {division.name} Announcements & Feed
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {([
                                    { key: 'all', label: 'All', emoji: '🗂️' },
                                    { key: 'announcement', label: 'Announcement', emoji: '📢' },
                                    { key: 'notice', label: 'Notice', emoji: '📌' },
                                    { key: 'material', label: 'Material', emoji: '📄' },
                                    { key: 'result', label: 'Results', emoji: '✅' },
                                ] as const).map(tab => (
                                    <button key={tab.key} onClick={() => setFeedFilter(tab.key as FeedFilter)}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all ${feedFilter === tab.key ? 'bg-primary text-white border-primary' : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'}`}>
                                        {tab.emoji} {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0 bg-background">
                        {postsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <span className="w-5 h-5 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
                            </div>
                        ) : filteredAnnouncements.length === 0 ? (
                            <p className="text-xs text-muted-foreground/60 italic text-center py-8">No posts yet</p>
                        ) : (
                            filteredAnnouncements.map(ann => (
                                <DivFeedCard key={ann.id} ann={ann} myUserId={myUserId} onDelete={handleDeletePost} />
                            ))
                        )}
                    </div>

                    {/* Composer */}
                    <div className="border-t border-border/40 px-3 py-1.5 shrink-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex-1 flex items-center gap-2 h-7 px-3 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                <input value={postInput} onChange={e => setPostInput(e.target.value)}
                                    placeholder="Title..."
                                    className="flex-1 bg-transparent text-sm font-bold placeholder:text-muted-foreground/60 placeholder:font-normal focus:outline-none" />
                                <div className="w-px h-4 bg-border/50 shrink-0" />
                                <input value={postSubject} onChange={e => setPostSubject(e.target.value)}
                                    placeholder="Subject (optional)"
                                    className="w-28 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none" />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {(['announcement', 'notice', 'material', 'result'] as PostType[]).map(type => (
                                    <button key={type} onClick={() => setPostType(type)}
                                        className={`px-2 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap transition-all ${postType === type ? POST_META[type].cls + ' border-current' : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                                        {POST_META[type].emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center px-3 py-2 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                <input value={postBody} onChange={e => setPostBody(e.target.value)}
                                    placeholder="Write description (optional)..."
                                    className="flex-1 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none" />
                                {attachments.length > 0 && (
                                    <div className="flex items-center gap-1 ml-2">
                                        {attachments.map((file, i) => (
                                            <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted border border-border/50 text-[10px]">
                                                <span>{file.type.startsWith('image/') ? '🖼️' : file.name.endsWith('.pdf') ? '📄' : '📎'}</span>
                                                <span className="truncate max-w-[60px] text-muted-foreground">{file.name}</span>
                                                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>
                                                    <X size={9} className="text-muted-foreground hover:text-red-500" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" className="hidden"
                                onChange={e => { if (e.target.files) { setAttachments([e.target.files[0]]); e.target.value = ''; } }} />
                            <button onClick={() => fileInputRef.current?.click()}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50 transition-all shrink-0">
                                <Paperclip size={14} />
                            </button>
                            <button onClick={handlePost} disabled={!postInput.trim() || posting}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                {posting ? <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Send size={13} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT — Subject Teachers + Leaderboard + Timetable + Calendar + Results */}
            <div className="w-full lg:w-[40%] flex flex-col gap-3 min-h-0 overflow-y-auto pb-1">

                {/* Subject Teachers */}
                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <BookOpen size={14} /> Subject Teachers
                        </p>
                    </div>
                    <div className="px-4 py-2 divide-y divide-border/20">
                        {division.subjects.length === 0 && (
                            <p className="text-xs text-muted-foreground/60 italic py-3 text-center">No subjects yet</p>
                        )}
                        {division.subjects.map(sub => {
                            const assignment = division.assignments.find(a => a.subjectId === sub.id);
                            const teacherName = assignment?.teacher.user.name ?? null;
                            return (
                                <div key={sub.id} className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color ?? '#7C3AED' }} />
                                        <span className="text-xs font-medium">{sub.name}</span>
                                    </div>
                                    {teacherName ? (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                style={{ background: getAvatarColor(teacherName) }}>
                                                {getInitials(teacherName)}
                                            </div>
                                            <span className="text-[11px] text-muted-foreground">{teacherName}</span>
                                        </div>
                                    ) : (
                                        <span className="text-[11px] text-muted-foreground/50 italic">Not assigned</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Leaderboard */}
                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Trophy size={14} /> Leaderboard — Top 5
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

                    {/* Podium — top 3, re-sorted locally by the active tab's metric */}
                    {(() => {
                        const pctFor = (e: LeaderboardEntry) =>
                            leaderTab === 'offline' ? e.offlinePct : leaderTab === 'online' ? e.onlinePct : e.combinedPct;
                        const sorted = [...leaderboard]
                            .filter(e => pctFor(e) !== null)
                            .sort((a, b) => (pctFor(b) ?? 0) - (pctFor(a) ?? 0));
                        const top5 = sorted.slice(0, 5);
                        const podium = [top5[1], top5[0], top5[2]];
                        return (
                            <>
                                <div className="flex items-end justify-center gap-4 px-4 pt-4 pb-2">
                                    {podium.map((student, i) => {
                                        const podiumConfig = [
                                            { height: 'h-16', color: '#C0C0C0', label: '2nd' },
                                            { height: 'h-24', color: '#F59E0B', label: '1st' },
                                            { height: 'h-12', color: '#CD7F32', label: '3rd' },
                                        ];
                                        const cfg = podiumConfig[i];
                                        if (!student) return null;
                                        return (
                                            <div key={student.id} className="flex flex-col items-center gap-1.5">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/20"
                                                    style={{ background: getAvatarColor(student.name) }}>
                                                    {getInitials(student.name)}
                                                </div>
                                                <p className="text-[10px] font-bold text-center w-16 truncate">{student.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{pctFor(student)}%</p>
                                                <div className={`${cfg.height} w-14 rounded-t-xl flex items-center justify-center text-white text-xs font-black`}
                                                    style={{ background: cfg.color }}>
                                                    {cfg.label}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Rank 4 & 5 */}
                                <div className="px-4 pb-3 space-y-1.5">
                                    {top5.slice(3, 5).map((student, i) => (
                                        <div key={student.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
                                            <span className="text-xs font-black text-muted-foreground w-4 text-center">{i + 4}</span>
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                style={{ background: getAvatarColor(student.name) }}>
                                                {getInitials(student.name)}
                                            </div>
                                            <p className="text-xs font-semibold flex-1 truncate">{student.name}</p>
                                            <span className="text-[11px] font-bold text-muted-foreground">{pctFor(student)}%</span>
                                        </div>
                                    ))}
                                    {top5.length === 0 && (
                                        <p className="text-xs text-muted-foreground/60 italic text-center py-3">No published marksheet yet</p>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </div>

                {/* Timetable — mock */}
                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Calendar size={14} /> Timetable
                        </p>
                        {isClassTeacher && (
                            <button
                                onClick={() => timetableInputRef.current?.click()}
                                className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                <Upload size={11} /> Upload
                            </button>
                        )}
                    </div>
                    <div className="p-2 cursor-pointer" onClick={() => setShowTimetable(true)}>
                        <img src={timetableImage ?? '/timetable.jpeg'} alt="Timetable"
                            className="w-full rounded-xl object-contain max-h-90 hover:opacity-90 transition-opacity" />
                    </div>
                </div>

                {isClassTeacher && (
                    <input ref={timetableInputRef} type="file" accept="image/*" className="hidden"
                        onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = () => setTimetableImage(reader.result as string);
                                reader.readAsDataURL(file);
                                toast.success('Timetable uploaded!');
                            }
                            e.target.value = '';
                        }} />
                )}

                {/* Academic Calendar */}
                <ClassCalendar
                    isClassTeacher={isClassTeacher}
                    isSubjectTeacher={!isClassTeacher}
                    divisionName={division.name}
                    divisionId={division.id}
                />

                {/* Results */}
                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <FileText size={14} /> Results
                        </p>
                        {isClassTeacher && (
                            <button
                                onClick={() => resultsFileInputRef.current?.click()}
                                disabled={uploadingResult}
                                className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                {uploadingResult
                                    ? <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                    : <><Upload size={11} /> Upload</>}
                            </button>
                        )}
                    </div>

                    <input ref={resultsFileInputRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden"
                        onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadResult(file);
                            e.target.value = '';
                        }} />

                    <div className="px-4 py-2 space-y-2">
                        {postsLoading ? (
                            <div className="flex items-center justify-center py-6">
                                <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
                            </div>
                        ) : results.length === 0 ? (
                            <p className="text-xs text-muted-foreground/60 italic py-3 text-center">No results uploaded yet</p>
                        ) : (
                            results.map(result => {
                                const ext = result.attachmentName?.split('.').pop()?.toUpperCase() ?? 'FILE';
                                const isPdf = ext === 'PDF';
                                return (
                                    <div key={result.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/20 last:border-none">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${isPdf ? 'bg-red-500' : 'bg-emerald-600'}`}>
                                            {isPdf ? 'PDF' : ext.slice(0, 4)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold truncate">{result.title}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {new Date(result.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                        {result.attachmentUrl && (
                                            <a href={result.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                                className="text-[10px] h-6 px-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0 flex items-center">
                                                View
                                            </a>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Timetable Modal */}
            <AnimatePresence>
                {showTimetable && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowTimetable(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="relative max-w-4xl w-full mx-4 flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-2 shrink-0">
                                <p className="text-white text-sm font-semibold">Timetable — {division.name}</p>
                                <div className="flex items-center gap-2">
                                    <a href={timetableImage ?? '/timetable.jpeg'} download
                                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        ⬇ Download
                                    </a>
                                    <button onClick={() => setShowTimetable(false)}
                                        className="flex items-center justify-center w-8 h-8 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-all">
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <img src={timetableImage ?? '/timetable.jpeg'} alt="Timetable" className="rounded-2xl w-full object-contain" style={{ maxHeight: 'calc(90vh - 48px)' }} />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
