'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronRight, Users, BookOpen, User, Shield, MapPin,
    Plus, X, Check, ChevronDown, User as UserIcon,
    Calendar, FileText, Trophy, Send, Megaphone, Flag, Eye, EyeOff, Crown, ChevronLeft, ChevronUp, Paperclip, PowerOff, Power, ExternalLink,
    CalendarCheck, BarChart2, NotebookPen, Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { validateAttachment, ATTACHMENT_ACCEPT } from '@/lib/attachmentValidation';
import { AttachmentPreview } from '@/components/shared/AttachmentPreview';
import { assignSubjectColor } from '@/lib/subjectColors';
import { FeesTab } from './fees';
import AttendanceTab, { AttendanceSubTab } from '@/app/teacher/classes/[divisionId]/AttendanceTab';
import MarksTab, { MarksSubTab, MarksStats } from '@/app/teacher/classes/[divisionId]/MarksTab';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeacherOption {
    id: string;
    teacherId: string;
    name: string | null;
}

interface Assignment {
    id: string;
    subjectId: string | null;
    teacher: { id: string; user: { id: string; name: string | null } };
    subject: { id: string; name: string; color: string | null } | null;
}

interface Subject {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
    order: number;
}

interface Division {
    id: string;
    name: string;
    capacity: number | null;
    standard: { id: string; name: string; subjects: Subject[] };
    divisionSubjects: { subjectId: string }[];
    assignments: Assignment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const GENDERS = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' },
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'];

function SectionHeader({ icon: Icon, label, editing, onEdit, onSave, onCancel }: {
    icon: React.ElementType; label: string; editing: boolean;
    onEdit: () => void; onSave: () => void; onCancel: () => void;
}) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                <Icon size={11} className="text-primary" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{label}</p>
            <div className="flex-1 h-px bg-border/60" />
            {editing ? (
                <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={onCancel}
                        className="h-6 px-2.5 rounded-lg border border-border/50 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                        Cancel
                    </button>
                    <button onClick={onSave}
                        className="h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        Save
                    </button>
                </div>
            ) : (
                <button onClick={onEdit}
                    className="h-6 px-2.5 rounded-lg border border-border/50 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-all shrink-0">
                    Edit
                </button>
            )}
        </div>
    );
}

function ReadField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <div className="h-8 px-3 rounded-md border border-border/40 bg-muted flex items-center">
                <span className="text-xs text-foreground">{value || '—'}</span>
            </div>
        </div>
    );
}

function SectionViewLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                <Icon size={11} className="text-primary" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{label}</p>
            <div className="flex-1 h-px bg-border/60" />
        </div>
    );
}

function EditField({ label, value, onChange, placeholder }: {
    label: string; value: string;
    onChange: (v: string) => void; placeholder: string;
}) {
    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full h-8 px-3 rounded-md border border-border/50 bg-muted text-xs focus:outline-none focus:border-primary/50 transition-all" />
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
function getAvatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// ── Calendar Types & Config ───────────────────────────────────────────────────
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

// ── Class Calendar Component ──────────────────────────────────────────────────
function ClassCalendar({ isClassTeacher, isSubjectTeacher, divisionName, divisionId: calDivisionId }: {
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
        api.get('/admin/campus/feed/events', { params: { year, month, divisionId: calDivisionId } })
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
            .catch(() => { /* silent — calendar still usable */ })
            .finally(() => setLoadingEvents(false));
    }, [year, month]);

    const handleAddEvent = async () => {
        if (!newLabel.trim() || !addDate) return;
        setSaving(true);
        try {
            const dateStr = new Date(Date.UTC(year, month, addDate)).toISOString().split('T')[0];
            const res = await api.post('/admin/campus/feed/events', {
                type: newType.toUpperCase(),
                label: newLabel.trim(),
                date: dateStr,
                divisionId: calDivisionId,
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
            await api.delete(`/admin/campus/feed/events/${eventId}`);
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
            {/* Header */}
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

            {/* Grid */}
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

                {/* Legend */}
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
                                        {/* Delete sirf non-inherited events pe aur sirf allowed users ke liye */}
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

// ── Teacher Picker ────────────────────────────────────────────────────────────

function TeacherPicker({ value, teachers, onChange, accentColor, loading }: {
    value?: string;
    teachers: TeacherOption[];
    onChange: (teacherId: string, name: string) => void;
    accentColor?: string;
    loading?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState<TeacherOption | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const selected = teachers.find(t => t.id === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setPending(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                disabled={loading}
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-medium transition-all disabled:opacity-50"
                style={selected ? {
                    borderColor: (accentColor ?? '#7C3AED') + '60',
                    background: (accentColor ?? '#7C3AED') + '10',
                    color: accentColor ?? '#7C3AED',
                } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                <UserIcon size={11} />
                {selected ? (selected.name ?? 'Unnamed') : 'Assign'}
                <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && !pending && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-8 right-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px] max-h-48 overflow-y-auto">
                        {teachers.length === 0 && (
                            <p className="text-xs text-muted-foreground px-3 py-2">No teachers yet</p>
                        )}
                        {teachers.map(t => {
                            const name = t.name ?? 'Unnamed';
                            return (
                                <button key={t.id} type="button"
                                    onClick={() => { setPending(t); setOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors ${value === t.id ? 'text-primary font-semibold' : 'text-foreground'}`}>
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                        style={{ background: getAvatarColor(name) }}>
                                        {getInitials(name)}
                                    </div>
                                    {name}
                                    {value === t.id && <Check size={11} className="ml-auto text-primary shrink-0" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {pending && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-8 right-0 z-50 bg-card border border-border rounded-xl shadow-xl p-3 w-52">
                        <p className="text-xs font-semibold mb-1">Confirm Assignment</p>
                        <p className="text-[11px] text-muted-foreground mb-3">
                            Assign <span className="font-semibold text-foreground">{pending.name ?? 'Unnamed'}</span>?
                        </p>
                        <div className="flex gap-1.5">
                            <button onClick={() => setPending(null)}
                                className="flex-1 h-7 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    onChange(pending.id, pending.name ?? 'Unnamed');
                                    setPending(null);
                                }}
                                className="flex-1 h-7 rounded-lg text-[11px] font-semibold text-white transition-all hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                Confirm
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Inline Add Input ──────────────────────────────────────────────────────────

function InlineAddInput({ placeholder, onAdd, onCancel, loading }: {
    placeholder: string; onAdd: (val: string) => void; onCancel: () => void; loading?: boolean;
}) {
    const [val, setVal] = useState('');
    return (
        <div className="flex items-center gap-1.5 mt-2">
            <input autoFocus value={val} onChange={e => setVal(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && val.trim()) onAdd(val.trim());
                    if (e.key === 'Escape') onCancel();
                }}
                placeholder={placeholder}
                className="h-8 px-3 rounded-xl border border-primary/50 bg-primary/5 text-xs focus:outline-none focus:border-primary transition-all w-40" />
            <button onClick={() => val.trim() && onAdd(val.trim())} disabled={loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                <Check size={13} />
            </button>
            <button onClick={onCancel}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                <X size={13} />
            </button>
        </div>
    );
}

type PostType = 'announcement' | 'notice' | 'material' | 'result';
type FeedFilter = 'all' | PostType;

interface DivAnnouncement {
    id: string;
    type: PostType;
    title: string;
    body: string;
    subject: string | null;
    divisionId: string | null;
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
};

const MOCK_STUDENTS = [
    { id: 'st1', name: 'Aarav Mehta', rollNo: '01', rank: 1, attendance: 92, totalMarks: 487, gender: 'Male', dob: '12 Mar 2009', phone: '+91 98765 43210' },
    { id: 'st2', name: 'Priya Singh', rollNo: '02', rank: 2, attendance: 61, totalMarks: 471, gender: 'Female', dob: '5 Jul 2009', phone: '+91 87654 32109' },
    { id: 'st3', name: 'Rohan Gupta', rollNo: '03', rank: 3, attendance: 78, totalMarks: 458, gender: 'Male', dob: '22 Jan 2009', phone: '+91 76543 21098' },
    { id: 'st4', name: 'Sneha Patel', rollNo: '04', rank: 4, attendance: 55, totalMarks: 445, gender: 'Female', dob: '8 Sep 2009', phone: '+91 65432 10987' },
    { id: 'st5', name: 'Arjun Kumar', rollNo: '05', rank: 5, attendance: 88, totalMarks: 432, gender: 'Male', dob: '15 Apr 2009', phone: '+91 54321 09876' },
    { id: 'st6', name: 'Meera Sharma', rollNo: '06', rank: 6, attendance: 70, totalMarks: 419, gender: 'Female', dob: '3 Dec 2009', phone: '+91 43210 98765' },
    { id: 'st7', name: 'Karan Joshi', rollNo: '07', rank: 7, attendance: 48, totalMarks: 406, gender: 'Male', dob: '19 Feb 2009', phone: '+91 32109 87654' },
    { id: 'st8', name: 'Ananya Nair', rollNo: '08', rank: 8, attendance: 95, totalMarks: 398, gender: 'Female', dob: '27 Jun 2009', phone: '+91 21098 76543' },
    { id: 'st9', name: 'Vikram Rao', rollNo: '09', rank: 9, attendance: 67, totalMarks: 385, gender: 'Male', dob: '11 Oct 2009', phone: '+91 10987 65432' },
    { id: 'st10', name: 'Ishaan Verma', rollNo: '10', rank: 10, attendance: 82, totalMarks: 372, gender: 'Male', dob: '4 Aug 2009', phone: '+91 98765 43211' },
];

const MOCK_SUBJECT_POOL = [
    { id: 'sub1', name: 'Mathematics', color: '#7C3AED' },
    { id: 'sub2', name: 'Science', color: '#0891B2' },
    { id: 'sub3', name: 'English', color: '#DA7756' },
    { id: 'sub4', name: 'Hindi', color: '#059669' },
    { id: 'sub5', name: 'History', color: '#D97706' },
    { id: 'sub6', name: 'Geography', color: '#8B5CF6' },
];

const MOCK_RESULTS = [
    { id: 'r1', name: 'Unit Test 1', date: '15 Jan 2026', type: 'PDF', maxMarks: 100 },
    { id: 'r2', name: 'Mid Term Exam', date: '28 Feb 2026', type: 'Excel', maxMarks: 500 },
    { id: 'r3', name: 'Unit Test 2', date: '10 Apr 2026', type: 'PDF', maxMarks: 100 },
];


function VerifiedBadge() {
    return (
        <svg width="12" height="12" viewBox="0 0 40 40" fill="none">
            <path d="M20 2 L23.5 6.5 L29 5 L31.5 10.5 L37.5 12 L36 18 L40 22 L36 26 L37.5 32 L31.5 33.5 L29 39 L23.5 37.5 L20 42 L16.5 37.5 L11 39 L8.5 33.5 L2.5 32 L4 26 L0 22 L4 18 L2.5 12 L8.5 10.5 L11 5 L16.5 6.5 Z"
                fill="#DA7756" />
            <path d="M13 21l5 5 9-10"
                stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}



function DivFeedCard({ ann, onDelete }: { ann: DivAnnouncement; onDelete?: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const meta = POST_META[ann.type];
    const authorName = ann.author.name;
    const initials = authorName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
    const avatarColor = AVATAR_COLORS[authorName.charCodeAt(0) % AVATAR_COLORS.length];
    const timeAgo = (() => {
        const diff = Date.now() - new Date(ann.createdAt).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    })();

    return (
        <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>
                    {meta.emoji} {meta.label}
                    {ann.subject && <span className="font-normal opacity-75">· {ann.subject}</span>}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{timeAgo}</span>
                    {onDelete && (
                        <button onClick={() => setConfirmDelete(true)}
                            className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                            <X size={11} />
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
                    <p className="text-xs font-semibold">{authorName}</p>
                    <div className="flex items-center gap-1">
                        <p className="text-[10px] text-muted-foreground">{ann.author.role.split('_').map((w: string) => w[0] + w.slice(1).toLowerCase()).join(' ')}</p>
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
                <AttachmentPreview
                    attachment={{ url: ann.attachmentUrl, name: ann.attachmentName, type: ann.attachmentType }}
                />
            )}
            <button onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Show less' : 'Read more'}
            </button>
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <h3 className="text-base font-bold mb-1">Delete Announcement?</h3>
                        <p className="text-sm text-muted-foreground mb-5">This announcement will be permanently deleted. Are you sure?</p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setConfirmDelete(false)}
                                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                Cancel
                            </button>
                            <button onClick={() => { onDelete?.(ann.id); setConfirmDelete(false); }}
                                className="h-9 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-all">
                                Delete
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'overview' as const,    label: 'View' },
    { key: 'manage' as const,      label: 'Manage' },
    { key: 'fees' as const,        label: 'Fees' },
    { key: 'attendance' as const,  label: 'Attendance' },
    { key: 'marksheet' as const,   label: 'Marksheet' },
];

export default function DivisionDetailPage() {
    const router = useRouter();
    const params = useParams();
    const divisionId = params.divisionId as string;

    const [division, setDivision] = useState<Division | null>(null);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuthStore();
    const subAdminPermissions = user?.role === 'SUB_ADMIN' ? (user.permissions ?? []) : null;

    function isTabLocked(tabKey: 'overview' | 'manage' | 'fees' | 'attendance' | 'marksheet'): boolean {
        if (!subAdminPermissions) return false;
        if (tabKey === 'overview')   return !subAdminPermissions.includes('CAMPUS_VIEW');
        if (tabKey === 'manage')     return !subAdminPermissions.includes('CAMPUS_MANAGE');
        if (tabKey === 'fees')       return !subAdminPermissions.includes('CAMPUS_FEES');
        if (tabKey === 'attendance') return !subAdminPermissions.includes('CAMPUS_ATTENDANCE');
        if (tabKey === 'marksheet')  return !subAdminPermissions.includes('CAMPUS_MARKSHEET');
        return false;
    }

    const [activeTab, setActiveTab] = useState<'overview' | 'manage' | 'fees' | 'attendance' | 'marksheet'>(() => {
        if (!subAdminPermissions) return 'overview';
        if (subAdminPermissions.includes('CAMPUS_VIEW'))       return 'overview';
        if (subAdminPermissions.includes('CAMPUS_MANAGE'))     return 'manage';
        if (subAdminPermissions.includes('CAMPUS_FEES'))       return 'fees';
        if (subAdminPermissions.includes('CAMPUS_ATTENDANCE')) return 'attendance';
        if (subAdminPermissions.includes('CAMPUS_MARKSHEET'))  return 'marksheet';
        return 'overview';
    });

    // When permissions update (30s poll), redirect away from now-locked tab
    useEffect(() => {
        if (!subAdminPermissions) return;
        if (isTabLocked(activeTab)) {
            const order: typeof activeTab[] = ['overview', 'manage', 'fees', 'attendance', 'marksheet'];
            const first = order.find(t => !isTabLocked(t));
            if (first) setActiveTab(first);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subAdminPermissions]);
    const [manageTab, setManageTab] = useState<'teachers' | 'subjects'>('teachers');
    const [addingSubject, setAddingSubject] = useState(false);
    const [savingAssign, setSavingAssign] = useState(false);
    const [savingSubject, setSavingSubject] = useState(false);
    const fetchedRef = useRef(false);
    const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
    const [postType, setPostType] = useState<PostType>('announcement');
    const [postInput, setPostInput] = useState('');
    const [announcements, setAnnouncements] = useState<DivAnnouncement[]>([]);
    const [postLoading, setPostLoading] = useState(false);
    const [postBody, setPostBody] = useState('');
    const [postAttachment, setPostAttachment] = useState<{ url: string; name: string; type: string; mimeType: string } | null>(null);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showTimetable, setShowTimetable] = useState(false);
    const [postSubject, setPostSubject] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<typeof MOCK_STUDENTS[0] | null>(null);
    const [manageRightTab, setManageRightTab] = useState<'teachers' | 'student'>('teachers');
    const [confirmToggle, setConfirmToggle] = useState(false);
    const [studentActive, setStudentActive] = useState(true);
    const [togglingSubject, setTogglingSubject] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [feesSubTab, setFeesSubTab] = useState<'setup' | 'students'>('students');
    const [attendanceSubTab, setAttendanceSubTab] = useState<AttendanceSubTab>('daily');
    const [attendanceHeaderStats, setAttendanceHeaderStats] = useState<{ overall: number | null; thisMonth: number | null }>({ overall: null, thisMonth: null });
    const [marksheetSubTab, setMarksheetSubTab] = useState<MarksSubTab>('offline');
    const [marksStats, setMarksStats] = useState<MarksStats>({ avg: null, topGrade: null });
    const [timetableImage, setTimetableImage] = useState<string | null>(null);
    const [leaderTab, setLeaderTab] = useState<'offline' | 'online' | 'combined'>('combined');
    const timetableInputRef = useRef<HTMLInputElement>(null);
    const [showPassword, setShowPassword] = useState(false);


    const toggleSubject = async (subId: string) => {
        if (!division || togglingSubject) return;
        const isSelected = division.divisionSubjects.some(ds => ds.subjectId === subId);
        setTogglingSubject(subId);
        try {
            if (isSelected) {
                await api.delete(`/admin/campus/divisions/${division.id}/subjects/${subId}`);
                setDivision(prev => prev ? {
                    ...prev,
                    divisionSubjects: prev.divisionSubjects.filter(ds => ds.subjectId !== subId),
                    assignments: prev.assignments.filter(a => a.subjectId !== subId),
                } : prev);
            } else {
                await api.post(`/admin/campus/divisions/${division.id}/subjects/${subId}`);
                setDivision(prev => prev ? {
                    ...prev,
                    divisionSubjects: [...prev.divisionSubjects, { subjectId: subId }],
                } : prev);
            }
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to update');
        } finally {
            setTogglingSubject(null);
        }
    };

    const filteredAnnouncements = feedFilter === 'all'
        ? announcements
        : announcements.filter(a => a.type === feedFilter);

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
        if (!postInput.trim() || postLoading) return;
        setPostLoading(true);
        try {
            const res = await api.post('/admin/campus/feed/posts', {
                type: postType.toUpperCase(),
                title: postInput.trim(),
                body: postBody.trim() || '',
                subject: postSubject.trim() || undefined,
                divisionId,
                ...(postAttachment ? {
                    attachmentUrl: postAttachment.url,
                    attachmentType: postAttachment.mimeType,
                    attachmentName: postAttachment.name,
                } : {}),
            });
            setAnnouncements(prev => [res.data.data, ...prev]);
            setPostInput('');
            setPostBody('');
            setPostSubject('');
            setPostAttachment(null);
            toast.success('Posted!');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to post');
        } finally {
            setPostLoading(false);
        }
    };

    const deletePost = async (postId: string) => {
        try {
            await api.delete(`/admin/campus/feed/posts/${postId}`);
            setAnnouncements(prev => prev.filter(a => a.id !== postId));
            toast.success('Post deleted');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to delete post');
        }
    };

    const canFetchTeachers = !subAdminPermissions || subAdminPermissions.includes('STAFF_TEACHERS') || subAdminPermissions.includes('CAMPUS_MANAGE');
    const canFetchPosts = !subAdminPermissions || subAdminPermissions.includes('CAMPUS_VIEW');

    const fetchAll = useCallback(async () => {
        try {
            // Use allSettled so a failed posts/teachers fetch (e.g. 403 during permission sync)
            // doesn't prevent the division itself from loading.
            const [divResult, teachersResult, postsResult] = await Promise.allSettled([
                api.get(`/admin/campus/divisions/${divisionId}`),
                canFetchTeachers ? api.get('/admin/teachers') : Promise.resolve({ data: { data: [] } }),
                canFetchPosts ? api.get('/admin/campus/feed/posts', { params: { divisionId, limit: 50 } }) : Promise.resolve({ data: { data: [] } }),
            ]);
            // Division is critical — re-throw so the catch block handles it
            if (divResult.status === 'rejected') throw divResult.reason;
            setDivision(divResult.value.data.data);
            setTeachers(teachersResult.status === 'fulfilled' ? (teachersResult.value.data.data ?? []) : []);
            setAnnouncements(postsResult.status === 'fulfilled' ? (postsResult.value.data.data ?? []) : []);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
                ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to load class');
        } finally {
            setLoading(false);
        }
    }, [divisionId, canFetchTeachers, canFetchPosts]);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchAll();
    }, [fetchAll]);

    const assignTeacher = async (subjectId: string | null, teacherId: string, name: string) => {
        if (!division) return;
        setSavingAssign(true);
        try {
            const res = await api.post(`/admin/campus/divisions/${division.id}/assign`, {
                teacherId,
                subjectId,
            });
            const newAssignment: Assignment = res.data.data;
            setDivision(prev => {
                if (!prev) return prev;
                // Remove the existing assignment for this slot (same subjectId), then add the new one
                const withoutSlot = prev.assignments.filter(a =>
                    subjectId !== null ? a.subjectId !== subjectId : a.subjectId !== null
                );
                return { ...prev, assignments: [...withoutSlot, newAssignment] };
            });
            toast.success(`${name} assigned`);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to assign');
        } finally {
            setSavingAssign(false);
        }
    };

    const removeAssignment = async (assignmentId: string) => {
        if (!division) return;
        try {
            await api.delete(`/admin/campus/assignments/${assignmentId}`);
            setDivision(prev => prev ? {
                ...prev,
                assignments: prev.assignments.filter(a => a.id !== assignmentId),
            } : prev);
            toast.success('Assignment removed');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to remove');
        }
    };

    const addSubject = async (name: string) => {
        if (!division) return;
        setSavingSubject(true);
        try {
            const colorIndex = division.standard.subjects.length;
            const color = assignSubjectColor(colorIndex);
            const res = await api.post(`/admin/campus/standards/${division.standard.id}/subjects`, { name, color });
            const newSubject: Subject = res.data.data;
            setDivision(prev => prev ? {
                ...prev,
                standard: { ...prev.standard, subjects: [...prev.standard.subjects, newSubject] },
            } : prev);
            setAddingSubject(false);
            toast.success('Subject added');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to add subject');
        } finally {
            setSavingSubject(false);
        }
    };

    const deleteSubject = async (subjectId: string) => {
        if (!division) return;
        try {
            await api.delete(`/admin/campus/subjects/${subjectId}`);
            setDivision(prev => prev ? {
                ...prev,
                standard: { ...prev.standard, subjects: prev.standard.subjects.filter(s => s.id !== subjectId) },
                assignments: prev.assignments.filter(a => a.subjectId !== subjectId),
            } : prev);
            toast.success('Subject removed');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to delete');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Loading...
            </div>
        );
    }

    if (!division) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <p className="text-sm text-muted-foreground">Division not found</p>
                <button onClick={() => router.back()}
                    className="text-xs text-primary underline">Go back</button>
            </div>
        );
    }

    const classTeacherAssignment = division.assignments.find(a => a.subjectId === null);

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* Header */}
            <div className="shrink-0 px-1 pt-1 pb-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()}
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all">
                            <ArrowLeft size={16} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Users size={24} />
                                {division.name}
                            </h1>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {division.standard.name} <ChevronRight size={11} /> {division.name}
                            </p>
                        </div>

                        {/* Tab bar */}
                        <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 ml-4">
                            {TABS.map(tab => {
                                const isActive = activeTab === tab.key;
                                const locked = isTabLocked(tab.key);
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => {
                                            if (locked) {
                                                toast.error('Access restricted — contact your admin');
                                                return;
                                            }
                                            setActiveTab(tab.key);
                                        }}
                                        className={`relative ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                        {isActive && !locked && (
                                            <motion.div layoutId="divTab"
                                                className="absolute inset-0 bg-primary rounded-4xl"
                                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                                        )}
                                        <div className={`relative z-10 flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-4xl transition-colors ${isActive && !locked ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {tab.label}
                                            {locked && <Lock size={11} />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stats / Sub tabs — conditional */}
                    <div className="flex items-center gap-4">
                        {(activeTab === 'overview' || activeTab === 'manage') && (
                            <>
                                {[
                                    { label: 'Subjects', value: division.divisionSubjects.length },
                                    { label: 'Teachers', value: new Set(division.assignments.map(a => a.teacher.id)).size },
                                ].map(({ label, value }) => (
                                    <div key={label} className="text-right">
                                        <p className="text-lg font-bold leading-tight">{value}</p>
                                        <p className="text-[11px] text-muted-foreground">{label}</p>
                                    </div>
                                ))}
                            </>
                        )}

                        {activeTab === 'fees' && (
                            <div className="flex items-center gap-4">
                                <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/40">
                                    {[
                                        { key: 'students' as const, label: 'Student Fees' },
                                        { key: 'setup' as const, label: 'Fee Setup' },
                                    ].map(tab => {
                                        const isActive = feesSubTab === tab.key;
                                        return (
                                            <button key={tab.key} onClick={() => setFeesSubTab(tab.key)}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold leading-tight text-emerald-600">5</p>
                                    <p className="text-[11px] text-muted-foreground">Paid</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold leading-tight text-red-500">5</p>
                                    <p className="text-[11px] text-muted-foreground">Pending</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'attendance' && (
                            <div className="flex items-center gap-4">
                                <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
                                    {([
                                        { key: 'daily' as AttendanceSubTab, label: 'Daily Attendance', Icon: CalendarCheck },
                                        { key: 'overall' as AttendanceSubTab, label: 'Overall', Icon: BarChart2 },
                                    ]).map(({ key, label, Icon }) => {
                                        const isActive = attendanceSubTab === key;
                                        return (
                                            <button key={key} onClick={() => setAttendanceSubTab(key)}
                                                className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all
                                                    ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                <Icon size={14} />
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-4">
                                    {[
                                        { label: 'Class Overall', value: attendanceHeaderStats.overall !== null ? `${attendanceHeaderStats.overall}%` : '—' },
                                        { label: 'This Month', value: attendanceHeaderStats.thisMonth !== null ? `${attendanceHeaderStats.thisMonth}%` : '—' },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="text-right">
                                            <p className="text-lg font-bold leading-tight">{value}</p>
                                            <p className="text-[11px] text-muted-foreground">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <AnimatePresence>
                            {activeTab === 'marksheet' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
                                    {([
                                        { key: 'offline' as MarksSubTab, label: 'Offline', Icon: NotebookPen },
                                        { key: 'online' as MarksSubTab, label: 'Online', Icon: Smartphone },
                                        { key: 'overall' as MarksSubTab, label: 'Overall', Icon: BarChart2 },
                                    ]).map(({ key, label, Icon }) => {
                                        const isActive = marksheetSubTab === key;
                                        return (
                                            <button key={key} onClick={() => setMarksheetSubTab(key)}
                                                className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all
                                                    ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                <Icon size={14} />
                                                {label}
                                            </button>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {activeTab === 'marksheet' && (
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-lg font-bold leading-tight">
                                        {marksStats.avg !== null ? `${marksStats.avg}%` : '—'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">{marksStats.pill1Label ?? 'Class Avg'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold leading-tight"
                                        style={{ color: marksStats.pill2Color ?? undefined }}>
                                        {marksStats.pill2Value ?? marksStats.topGrade ?? '—'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">{marksStats.pill2Label ?? 'Top Grade'}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <AnimatePresence mode="wait">

                    {/* ── TAB 1: OVERVIEW ── */}
                    {activeTab === 'overview' && (
                        <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex gap-3 h-full pt-3 pb-3 px-1 overflow-hidden">

                            {/* LEFT — Class Teacher + Feed */}
                            <div className="w-[58%] flex flex-col gap-3 min-h-0 overflow-hidden">

                                {/* Class Teacher card */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm shadow-black/5">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                        style={{ background: '#F59E0B' }}>
                                        {classTeacherAssignment
                                            ? getInitials(classTeacherAssignment.teacher.user.name ?? 'CT')
                                            : '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-semibold" style={{ color: '#F59E0B' }}>Class Teacher</p>
                                        <p className="text-sm font-bold truncate">
                                            {classTeacherAssignment?.teacher.user.name ?? 'Not assigned'}
                                        </p>
                                    </div>
                                </div>

                                {/* Feed */}
                                <div className="flex-1 min-h-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 pt-3 pb-2 border-b border-border/40 shrink-0">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                <Megaphone size={14} /> {division.name} Announcements & Feed
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                {([
                                                    { key: 'all', label: 'All', emoji: '🗂️' },
                                                    { key: 'announcement', label: 'Announcement', emoji: '📢' },
                                                    { key: 'notice', label: 'Notice', emoji: '📌' },
                                                    { key: 'material', label: 'Material', emoji: '📄' },
                                                    { key: 'result', label: 'Results', emoji: '✅' },
                                                ]).map(tab => {
                                                    const isActive = feedFilter === tab.key;
                                                    return (
                                                        <button key={tab.key} onClick={() => setFeedFilter(tab.key as FeedFilter)}
                                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap transition-all ${isActive ? 'bg-primary text-white border-primary' : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                                                                }`}>
                                                            {tab.emoji} {tab.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Posts */}
                                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0 bg-background">
                                        {filteredAnnouncements.length === 0 && (
                                            <p className="text-xs text-muted-foreground/60 italic text-center py-8">No posts yet</p>
                                        )}
                                        {filteredAnnouncements.map(ann => (
                                            <DivFeedCard key={ann.id} ann={ann} onDelete={deletePost} />
                                        ))}
                                    </div>

                                    {/* Composer */}
                                    <div className="border-t border-border/40 px-3 py-1.5 shrink-0 space-y-1.5">
                                        {/* Row 1 — Title + Filters */}
                                        <div className="flex items-center gap-2">
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
                                            <button onClick={handlePost} disabled={!postInput.trim() || postLoading || uploadingAttachment}
                                                className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                <Send size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* RIGHT — Subject Teachers + Leaderboard + Timetable + Results */}
                            <div className="w-[42%] flex flex-col gap-3 min-h-0 overflow-y-auto pb-1">

                                {/* Subject Teachers */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <BookOpen size={12} /> Subject Teachers
                                        </p>
                                    </div>
                                    <div className="px-4 py-2 divide-y divide-border/20">
                                        {division.divisionSubjects.length === 0 && (
                                            <p className="text-xs text-muted-foreground/60 italic py-3 text-center">No subjects selected</p>
                                        )}
                                        {division.standard.subjects
                                            .filter(sub => division.divisionSubjects.some(ds => ds.subjectId === sub.id))
                                            .map(sub => {
                                            const assignment = division.assignments.find(a => a.subjectId === sub.id);
                                            const teacherName = assignment?.teacher.user.name ?? null;
                                            return (
                                                <div key={sub.id} className="flex items-center justify-between py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full shrink-0"
                                                            style={{ background: sub.color ?? '#7C3AED' }} />
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
                                            <Trophy size={12} /> Leaderboard — Top 5
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

                                    {/* Podium — top 3 */}
                                    <div className="flex items-end justify-center gap-4 px-4 pt-4 pb-2">
                                        {[MOCK_STUDENTS[1], MOCK_STUDENTS[0], MOCK_STUDENTS[2]].map((student, i) => {
                                            const podiumConfig = [
                                                { height: 'h-16', color: '#C0C0C0', label: '2nd', crown: false },
                                                { height: 'h-24', color: '#F59E0B', label: '1st', crown: true },
                                                { height: 'h-12', color: '#CD7F32', label: '3rd', crown: false },
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
                                                    <p className="text-[10px] text-muted-foreground">{student.attendance}%</p>
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
                                        {MOCK_STUDENTS.slice(3, 5).map(student => (
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

                                {/* Timetable */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Calendar size={12} /> Timetable
                                        </p>
                                    </div>
                                    <div className="p-2 cursor-pointer" onClick={() => setShowTimetable(true)}>
                                        <img
                                            src="/timetable.jpeg"
                                            alt="Timetable"
                                            className="w-full rounded-xl object-contain max-h-84 hover:opacity-90 transition-opacity"
                                        />
                                    </div>
                                </div>

                                {/* Class Calendar */}
                                <ClassCalendar
                                    isClassTeacher={true}
                                    isSubjectTeacher={false}
                                    divisionName={division.name}
                                    divisionId={division.id}
                                />

                                {/* Results */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <FileText size={12} /> Results
                                        </p>
                                    </div>
                                    <div className="px-4 py-2 space-y-2">
                                        {MOCK_RESULTS.map(result => (
                                            <div key={result.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/20 last:border-none">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${result.type === 'PDF' ? 'bg-red-500' : 'bg-emerald-600'}`}>
                                                    {result.type}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold truncate">{result.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{result.date}</p>
                                                </div>
                                                <button className="text-[10px] h-6 px-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0">
                                                    View
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── TAB 2: MANAGE ── */}
                    {activeTab === 'manage' && (
                        <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex gap-3 h-full pt-3 pb-3 px-1 overflow-hidden">

                            {/* LEFT — Students List */}
                            <div className="w-[40%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                <div className="px-4 py-3 border-b border-border/40 shrink-0">
                                    <p className="text-sm font-bold flex items-center gap-2">
                                        <Users size={15} /> Students ({MOCK_STUDENTS.length})
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto bg-background">
                                    {[...MOCK_STUDENTS].sort((a, b) => parseInt(a.rollNo) - parseInt(b.rollNo)).map(student => {
                                        const isSelected = selectedStudent?.id === student.id;
                                        return (
                                            <button key={student.id}
                                                onClick={() => { setSelectedStudent(student); setManageRightTab('student'); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-all hover:bg-muted/30 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                                                    }`}>
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                    style={{ background: getAvatarColor(student.name) }}>
                                                    {getInitials(student.name)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold truncate">{student.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-right">
                                                        <p className="text-[11px] font-bold" style={{ color: '#7C3AED' }}>#{student.rank}</p>
                                                        <p className="text-[9px] text-muted-foreground/60">rank</p>
                                                    </div>
                                                    <div className="text-right">

                                                        <div className={`text-[11px] font-bold ${student.attendance >= 75 ? 'text-emerald-600 dark:text-emerald-400'
                                                            : student.attendance >= 65 ? 'text-amber-600'
                                                                : 'text-red-500'
                                                            }`}>
                                                            {student.attendance}%
                                                        </div>
                                                        <p className="text-[9px] text-muted-foreground/60">attend.</p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* RIGHT — 2 tabs */}
                            <div className="w-[60%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">

                                {/* Tab bar */}
                                <div className="px-4 py-2.5 border-b border-border/40 shrink-0 flex items-center justify-between">
                                    <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/40">
                                        {[
                                            { key: 'teachers' as const, label: 'Subjects & Teachers' },
                                            { key: 'student' as const, label: 'Student Info' },
                                        ].map(tab => {
                                            const isActive = manageRightTab === tab.key;
                                            return (
                                                <button key={tab.key} onClick={() => setManageRightTab(tab.key)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                                        }`}>
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {manageRightTab === 'student' && selectedStudent && (
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setConfirmToggle(true)}
                                                className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all ${studentActive
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                                    }`}>
                                                {studentActive ? <><PowerOff size={11} /> Deactivate</> : <><Power size={11} /> Activate</>}
                                            </button>
                                            <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-red-500 hover:border-red-400/50 transition-all">
                                                <Flag size={11} /> Report
                                            </button>
                                            <button
                                                onClick={() => router.push(`/student/${selectedStudent.id}/profile`)}
                                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                                                <ExternalLink size={10} /> View Profile
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Right content */}
                                <div className="flex-1 overflow-y-auto min-h-0">
                                    <AnimatePresence mode="wait">

                                        {/* Teachers tab */}
                                        {manageRightTab === 'teachers' && (
                                            <motion.div key="teachers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="px-4 py-3 space-y-4">

                                                {/* Subject Pool — toggle which subjects this division has */}
                                                <div>
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                                        Subject Pool — select for this division
                                                    </p>
                                                    {division.standard.subjects.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground/60 italic">No subjects in this standard yet</p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {division.standard.subjects.map(sub => {
                                                                const isSelected = division.divisionSubjects.some(ds => ds.subjectId === sub.id);
                                                                return (
                                                                    <button key={sub.id}
                                                                        onClick={() => toggleSubject(sub.id)}
                                                                        disabled={togglingSubject === sub.id}
                                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all disabled:opacity-50"
                                                                        style={isSelected ? {
                                                                            background: (sub.color ?? '#7C3AED') + '20',
                                                                            color: sub.color ?? '#7C3AED',
                                                                            border: `1px solid ${sub.color ?? '#7C3AED'}40`,
                                                                        } : {
                                                                            background: 'hsl(var(--muted))',
                                                                            color: 'hsl(var(--muted-foreground))',
                                                                            border: '1px dashed hsl(var(--border))',
                                                                        }}>
                                                                        <BookOpen size={10} />
                                                                        {sub.name}
                                                                        {isSelected && <Check size={8} className="ml-0.5" />}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="h-px bg-border/40" />

                                                <div>
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Class Teacher</p>
                                                    <div className="flex items-center justify-between py-2 px-3 rounded-xl border border-border/40 bg-muted/20">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
                                                            <span className="text-xs text-muted-foreground">Class Teacher</span>
                                                            {classTeacherAssignment && (
                                                                <span className="text-[10px] text-foreground font-semibold">
                                                                    — {classTeacherAssignment.teacher.user.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {classTeacherAssignment && (
                                                                <button onClick={() => setConfirmRemove(classTeacherAssignment.id)}
                                                                    className="text-[10px] text-red-500 hover:underline">
                                                                    Remove
                                                                </button>
                                                            )}
                                                            <TeacherPicker
                                                                value={classTeacherAssignment?.teacher.id}
                                                                teachers={teachers}
                                                                accentColor="#F59E0B"
                                                                loading={savingAssign}
                                                                onChange={(teacherId, name) => assignTeacher(null, teacherId, name)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Subject Teachers</p>
                                                    {division.divisionSubjects.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground/60 italic">Select subjects above first</p>
                                                    ) : (
                                                        <div className="space-y-1.5">
                                                            {division.standard.subjects
                                                                .filter(sub => division.divisionSubjects.some(ds => ds.subjectId === sub.id))
                                                                .map(sub => {
                                                                    const assignment = division.assignments.find(a => a.subjectId === sub.id);
                                                                    return (
                                                                        <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded-xl border border-border/40 bg-muted/20">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-2 h-2 rounded-full shrink-0"
                                                                                    style={{ background: sub.color ?? '#7C3AED' }} />
                                                                                <span className="text-xs text-muted-foreground">{sub.name}</span>
                                                                                {assignment && (
                                                                                    <span className="text-[10px] text-foreground font-semibold">
                                                                                        — {assignment.teacher.user.name}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                {assignment && (
                                                                                    <button onClick={() => setConfirmRemove(assignment.id)}
                                                                                        className="text-[10px] text-red-500 hover:underline">
                                                                                        Remove
                                                                                    </button>
                                                                                )}
                                                                                <TeacherPicker
                                                                                    value={assignment?.teacher.id}
                                                                                    teachers={teachers}
                                                                                    accentColor={sub.color ?? '#7C3AED'}
                                                                                    loading={savingAssign}
                                                                                    onChange={(teacherId, name) => assignTeacher(sub.id, teacherId, name)}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Student Info tab */}
                                        {manageRightTab === 'student' && (
                                            <motion.div key="student" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="px-4 py-3 overflow-y-auto h-full">
                                                {!selectedStudent ? (
                                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                                            <Users size={20} className="text-muted-foreground" />
                                                        </div>
                                                        <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                                                        <p className="text-xs text-muted-foreground/60 mt-1">Click any student from the list</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3 pb-6">

                                                        {/* Stats */}
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
                                                                <p className="text-lg font-black" style={{ color: '#7C3AED' }}>#{selectedStudent.rank}</p>
                                                                <p className="text-[11px] text-muted-foreground">Class Rank</p>
                                                            </div>
                                                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
                                                                <p className="text-lg font-black">{Math.round((selectedStudent.totalMarks / 500) * 100)}%</p>
                                                                <p className="text-[11px] text-muted-foreground">Score %</p>
                                                            </div>
                                                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
                                                                <p className={`text-lg font-black ${selectedStudent.attendance >= 75 ? 'text-emerald-600' : selectedStudent.attendance >= 65 ? 'text-amber-600' : 'text-red-500'}`}>
                                                                    {selectedStudent.attendance}%
                                                                </p>
                                                                <p className="text-[11px] text-muted-foreground">Attendance</p>
                                                            </div>
                                                        </div>

                                                        {/* ROW 1 — Student Info + Academic */}
                                                        <div className="flex gap-3 border border-border/40 rounded-2xl overflow-hidden bg-background">
                                                            {/* LEFT — Student Info */}
                                                            <div className="flex-1 px-4 py-3 border-r border-border/40 min-w-0 space-y-2.5">
                                                                <SectionViewLabel icon={User} label="Student Info" />
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                                                        style={{ background: getAvatarColor(selectedStudent.name) }}>
                                                                        {getInitials(selectedStudent.name)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold">{selectedStudent.name}</p>
                                                                        <p className="text-[11px] text-muted-foreground">Roll No. {selectedStudent.rollNo}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <ReadField label="Date of Birth" value="12/03/2009" />
                                                                    <ReadField label="Gender" value={selectedStudent.gender} />
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <ReadField label="Religion" value="Hindu" />
                                                                    <ReadField label="Category" value="General" />
                                                                </div>
                                                                <ReadField label="Admission Date" value="01/06/2023" />
                                                                <ReadField label="Email" value={`${selectedStudent.name.split(' ')[0].toLowerCase()}@school.in`} />
                                                                <ReadField label="Contact No" value={selectedStudent.phone} />
                                                            </div>

                                                            {/* RIGHT — Academic Details */}
                                                            <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                                                                <SectionViewLabel icon={BookOpen} label="Academic Details" />
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <ReadField label="Class" value="Class 10" />
                                                                    <ReadField label="Division" value="A" />
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <ReadField label="Roll No" value={selectedStudent.rollNo} />
                                                                    <ReadField label="House Color" value="Red" />
                                                                </div>
                                                                {/* Student ID */}
                                                                <div>
                                                                    <p className="text-[11px] text-muted-foreground mb-1 font-medium">Student ID</p>
                                                                    <div className="h-8 px-3 rounded-md border border-border/40 bg-muted/40 flex items-center justify-between">
                                                                        <span className="text-sm font-mono font-semibold" style={{ color: '#DA7756' }}>
                                                                            STU-2026-0001
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-foreground/50">Read only</span>
                                                                    </div>
                                                                </div>

                                                                {/* Password */}
                                                                <div>
                                                                    <p className="text-[11px] text-muted-foreground mb-1 font-medium">Current Password</p>
                                                                    <div className="h-8 px-3 rounded-md border border-border/40 bg-muted/40 flex items-center justify-between gap-2">
                                                                        <span className="text-sm font-mono flex-1">
                                                                            {showPassword ? 'Abc@12345x' : '••••••••••'}
                                                                        </span>
                                                                        <button type="button" onClick={() => setShowPassword(v => !v)}
                                                                            className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0">
                                                                            {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                            </div>
                                                        </div>

                                                        {/* ROW 2 — Medical + Address */}
                                                        <div className="flex gap-3 border border-border/40 rounded-2xl overflow-hidden bg-background">
                                                            {/* LEFT — Medical & Identity */}
                                                            <div className="flex-1 px-4 py-3 border-r border-border/40 min-w-0 space-y-2.5">
                                                                <SectionViewLabel icon={Shield} label="Medical & Identity" />
                                                                <ReadField label="Blood Group" value="B+" />
                                                                <ReadField label="Aadhar No" value="1234 5678 9012" />
                                                                <ReadField label="PAN No" value="—" />
                                                                <ReadField label="Emergency Contact" value="+91 98765 00000" />
                                                            </div>

                                                            {/* RIGHT — Address */}
                                                            <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                                                                <SectionViewLabel icon={MapPin} label="Address" />
                                                                <ReadField label="Address" value="123 MG Road" />
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <ReadField label="City" value="Mumbai" />
                                                                    <ReadField label="State" value="Maharashtra" />
                                                                    <ReadField label="Pincode" value="400001" />
                                                                    <ReadField label="Country" value="India" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* ROW 3 — Parents/Guardian */}
                                                        <div className="border border-border/40 rounded-2xl px-4 py-3 space-y-2.5 bg-background">
                                                            <SectionViewLabel icon={Users} label="Parents / Guardian" />
                                                            {[
                                                                { name: 'Rajesh ' + selectedStudent.name.split(' ')[1], number: '+91 98765 43210', relation: 'Father' },
                                                                { name: 'Sunita ' + selectedStudent.name.split(' ')[1], number: '+91 87654 32109', relation: 'Mother' },
                                                            ].map((g, i) => (
                                                                <div key={i} className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-2">
                                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Guardian {i + 1}</p>
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <ReadField label="Name" value={g.name} />
                                                                        <ReadField label="Number" value={g.number} />
                                                                        <ReadField label="Relation" value={g.relation} />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── TAB 3: FEES ── */}
                    {activeTab === 'fees' && (
                        <motion.div key="fees" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="h-full pt-3 pb-3 px-1 overflow-y-auto">
                            <FeesTab
                                divisionId={divisionId}
                                divisionName={division.name}
                                feesSubTab={feesSubTab}
                            />
                        </motion.div>
                    )}

                    {/* ── TAB 4: ATTENDANCE ── */}
                    {activeTab === 'attendance' && (
                        <motion.div key="attendance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                            <AttendanceTab
                                divisionId={divisionId}
                                divisionName={division.name}
                                isClassTeacher={false}
                                attendanceSubTab={attendanceSubTab}
                                onAttendanceSubTabChange={setAttendanceSubTab}
                                onHeaderStatsLoad={setAttendanceHeaderStats}
                                readOnly={true}
                            />
                        </motion.div>
                    )}

                    {/* ── TAB 5: MARKSHEET ── */}
                    {activeTab === 'marksheet' && (
                        <motion.div key="marksheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                            <MarksTab
                                divisionId={divisionId}
                                subjects={division.standard.subjects
                                    .filter(s => division.divisionSubjects.some(ds => ds.subjectId === s.id))
                                    .map(s => ({
                                        id: s.id,
                                        name: s.name,
                                        code: s.code ?? s.name.slice(0, 4).toUpperCase(),
                                        color: s.color ?? '#7C3AED',
                                    }))}
                                divisionName={division.name}
                                subTab={marksheetSubTab}
                                onSubTabChange={setMarksheetSubTab}
                                onStatsChange={setMarksStats}
                                readOnly={true}
                                isAdmin={true}
                            />
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
            <AnimatePresence>
                {showTimetable && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowTimetable(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative max-w-4xl w-full mx-4"
                            onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-white text-sm font-semibold">Timetable — {division.name}</p>
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
                            <img src="/timetable.jpeg" alt="Timetable"
                                className="w-full rounded-2xl object-contain max-h-[80vh]" />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {confirmRemove && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                            <h3 className="text-base font-bold mb-2">Remove Assignment?</h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                This teacher will be unassigned. You can reassign anytime.
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmRemove(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => { removeAssignment(confirmRemove); setConfirmRemove(null); }}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 bg-red-500">
                                    Yes, Remove
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {confirmToggle && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                            <h3 className="text-base font-bold mb-2">
                                {studentActive ? '⚠️ Deactivate Student?' : '✅ Activate Student?'}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                {studentActive
                                    ? `${selectedStudent?.name} will lose access immediately.`
                                    : `${selectedStudent?.name} will regain access to the platform.`
                                }
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmToggle(false)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => { setStudentActive(v => !v); setConfirmToggle(false); toast.success(studentActive ? 'Student deactivated' : 'Student activated'); }}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                                    style={{ background: studentActive ? '#ef4444' : '#10b981' }}>
                                    {studentActive ? 'Yes, Deactivate' : 'Yes, Activate'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
