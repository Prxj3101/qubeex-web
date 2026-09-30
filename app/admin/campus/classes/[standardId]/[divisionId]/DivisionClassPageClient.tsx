'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import NextImage from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronRight, Users, BookOpen, User, Shield, MapPin, Heart,
    Plus, X, Check, ChevronDown, User as UserIcon, ArrowUp,
    Calendar, FileText, Trophy, Send, Megaphone, Flag, Eye, EyeOff, Crown, ChevronLeft, ChevronUp, Paperclip, PowerOff, Power, ExternalLink,
    CalendarCheck, BarChart2, NotebookPen, Smartphone, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAcademicYear, useIsHistoricalYear } from '@/context/AcademicYearContext';
import api from '@/lib/api';
import { validateAttachment, ATTACHMENT_ACCEPT } from '@/lib/attachmentValidation';
import { AttachmentPreview } from '@/components/shared/AttachmentPreview';
import { colorForSubject } from '@/lib/subjectColors';
import { toTitleCase } from '@/lib/utils';
import { formatDisplayName, resolveDisplayTitle } from '@/lib/displayName';
import { FeesTab, FeesTabHandle } from './fees';
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
    teacher: { id: string; prefix: string | null; avatarUrl?: string | null; user: { id: string; name: string | null } };
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
    timetableUrl: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Students created without a real email get an auto-generated placeholder
// (e.g. skps01s260003@students.qubeex.local) purely so the account has a
// unique login identifier — it was never entered by anyone and shouldn't be
// displayed as if it were a real address.
function isPlaceholderEmail(email: string): boolean {
    return email.endsWith('@students.qubeex.local');
}

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

function ReadField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <div className={`px-3 rounded-md border border-border/40 bg-muted flex ${multiline ? 'min-h-8 py-2 items-start' : 'h-8 items-center'}`}>
                <span className="text-xs text-foreground leading-relaxed">{value || '—'}</span>
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

function TeacherPicker({ value, teachers, onChange, accentColor, loading, disabled, title }: {
    value?: string;
    teachers: TeacherOption[];
    onChange: (teacherId: string, name: string) => void;
    accentColor?: string;
    loading?: boolean;
    disabled?: boolean;
    title?: string;
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
                disabled={loading || disabled}
                title={title}
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
    author: { id: string; name: string; role: string; avatarUrl?: string | null; prefix?: string | null; title?: string | null };
}

const POST_META = {
    announcement: { emoji: '📢', label: 'Announcement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    notice: { emoji: '📌', label: 'Notice', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    material: { emoji: '📄', label: 'Material', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    result: { emoji: '✅', label: 'Result', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
};

interface AdminStudent {
    id: string;
    studentId: string;
    userId: string;
    user: { name: string | null; email: string; mustChangePassword: boolean };
    hasLoggedIn: boolean;
    rollNo: string | null;
    avatarUrl: string | null;
    phone: string | null;
    dob: string | null;
    gender: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country: string | null;
    houseColor: string | null;
    bloodGroup: string | null;
    aadharNo: string | null;
    panNo: string | null;
    emergencyContact: string | null;
    religion: string | null;
    category: string | null;
    nationality: string | null;
    admissionYear: string | null;
    guardians: { name: string; number: string; relation: string }[] | null;
    tempPassword: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED';
}

interface LeaderboardEntry {
    id: string;
    rank: number;
    name: string;
    rollNo: string;
    avatarUrl: string | null;
    attendancePct: number | null;
    combinedPct: number;
    offlinePct: number | null;
    onlinePct: number | null;
}

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
    const isLongBody = (ann.body?.length ?? 0) > 100;
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
    const exactDateTime = (() => {
        const d = new Date(ann.createdAt);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h12}:${m} ${ampm}`;
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
                <div className="w-11 h-11 rounded-full overflow-hidden relative flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: ann.author.avatarUrl ? 'transparent' : avatarColor }}>
                    {ann.author.avatarUrl
                        ? <NextImage src={ann.author.avatarUrl} alt={authorName} fill sizes="88px" quality={95} className="object-cover" />
                        : initials}
                </div>
                <div>
                    <p className="text-xs font-semibold">{formatDisplayName(authorName, ann.author.prefix)}</p>
                    <div className="flex items-center gap-1">
                        <p className="text-[10px] text-muted-foreground">{resolveDisplayTitle(ann.author.role, ann.author.title)}</p>
                        <VerifiedBadge />
                    </div>
                </div>
            </div>
            <div>
                <p className="text-sm font-bold mb-1">{ann.title}</p>
                {ann.body && (
                    <p className={`text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap ${!expanded && isLongBody ? 'line-clamp-2' : ''}`}>
                        {ann.body}
                    </p>
                )}
            </div>
            {ann.attachmentUrl && ann.attachmentName && ann.attachmentType && (
                <AttachmentPreview
                    attachment={{ url: ann.attachmentUrl, name: ann.attachmentName, type: ann.attachmentType }}
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
                <span className="text-[11px] text-muted-foreground/70">{exactDateTime}</span>
            </div>
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

const VALID_TABS = ['overview', 'manage', 'fees', 'attendance', 'marksheet'] as const;
type TabKey = typeof VALID_TABS[number];

export default function DivisionDetailPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const divisionId = params.divisionId as string;
    const wantedStudentId = searchParams.get('student');

    const [division, setDivision] = useState<Division | null>(null);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [loading, setLoading] = useState(true);
    // division === null already means "Division not found" below; this flag
    // distinguishes a failed load so that screen says so instead.
    const [loadError, setLoadError] = useState(false);
    const [students, setStudents] = useState<AdminStudent[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const { user } = useAuthStore();
    const { selectedYearId, isCurrentYearSelected } = useAcademicYear();
    const isHistorical = useIsHistoricalYear();
    // The year this screen actually requests: null means "current year" (the
    // API call sends no academicYearId). selectedYearId itself starts as null
    // and then becomes the current year's real id once AcademicYearContext
    // loads — both mean "current", so comparing effectiveYear (not the raw id)
    // keeps that first-mount transition from looking like a year switch.
    const effectiveYear = isCurrentYearSelected ? null : selectedYearId;
    const yearParams = effectiveYear === null ? {} : { academicYearId: effectiveYear };
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

    const [activeTab, setActiveTab] = useState<TabKey>(() => {
        const tabParam = searchParams.get('tab') as TabKey | null;
        const wantedTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : null;
        if (wantedTab && (!subAdminPermissions || !isTabLocked(wantedTab))) {
            return wantedTab;
        }
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
    // Request sequencing: only the most recently *initiated* fetch may update
    // state, so a slow response for a previously-selected year can never land
    // on top of the newer year's data (or clear it on failure).
    const reqIdRef = useRef(0);
    const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
    const [showScrollTop, setShowScrollTop] = useState(false);
    const feedScrollRef = useRef<HTMLDivElement>(null);
    const [postType, setPostType] = useState<PostType>('announcement');
    const [postInput, setPostInput] = useState('');
    const [announcements, setAnnouncements] = useState<DivAnnouncement[]>([]);
    const [postLoading, setPostLoading] = useState(false);
    const [postBody, setPostBody] = useState('');
    const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
    // Description box grows with content up to 5 lines, then stays fixed and
    // scrolls internally instead of growing further.
    const autoGrowBody = (el: HTMLTextAreaElement) => {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 96) + 'px';
    };
    const [postAttachment, setPostAttachment] = useState<{ url: string; name: string; type: string; mimeType: string } | null>(null);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showTimetable, setShowTimetable] = useState(false);
    const [postSubject, setPostSubject] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);
    const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; name: string } | null>(null);
    const [manageRightTab, setManageRightTab] = useState<'teachers' | 'student'>('teachers');
    const [confirmToggle, setConfirmToggle] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState(false);
    const [togglingSubject, setTogglingSubject] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [feesSubTab, setFeesSubTab] = useState<'setup' | 'students'>('students');
    const feesTabRef = useRef<FeesTabHandle>(null);
    const [feesSaving, setFeesSaving] = useState(false);
    const [attendanceSubTab, setAttendanceSubTab] = useState<AttendanceSubTab>('daily');
    const [attendanceHeaderStats, setAttendanceHeaderStats] = useState<{ overall: number | null; thisMonth: number | null }>({ overall: null, thisMonth: null });
    const [marksheetSubTab, setMarksheetSubTab] = useState<MarksSubTab>('offline');
    const [marksStats, setMarksStats] = useState<MarksStats>({ avg: null, topGrade: null });
    const [leaderTab, setLeaderTab] = useState<'offline' | 'online' | 'combined'>('combined');
    const [showPassword, setShowPassword] = useState(false);

    interface StudentStats { attendance: { present: number; total: number; pct: number | null }; score: { pct: number | null }; classRank: number | null }
    const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    useEffect(() => {
        if (!selectedStudent) { setStudentStats(null); return; }
        let cancelled = false;
        setLoadingStats(true);
        api.get(`/admin/campus/divisions/${divisionId}/students/${selectedStudent.id}/stats`)
            .then(res => { if (!cancelled) setStudentStats(res.data.data); })
            .catch(() => { if (!cancelled) setStudentStats(null); })
            .finally(() => { if (!cancelled) setLoadingStats(false); });
        return () => { cancelled = true; };
    }, [selectedStudent, divisionId]);

    const toggleStudentStatus = async () => {
        if (!selectedStudent) return;
        setTogglingStatus(true);
        try {
            const newStatus = selectedStudent.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            const res = await api.patch(`/admin/campus/divisions/${divisionId}/students/${selectedStudent.id}`, { status: newStatus });
            const updatedStatus = res.data.data.status as AdminStudent['status'];
            setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, status: updatedStatus } : s));
            setSelectedStudent(prev => prev ? { ...prev, status: updatedStatus } : prev);
            toast.success(updatedStatus === 'ACTIVE' ? 'Student activated' : 'Student deactivated');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to update status');
        } finally {
            setTogglingStatus(false);
            setConfirmToggle(false);
        }
    };

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
            requestAnimationFrame(() => {
                if (bodyTextareaRef.current) bodyTextareaRef.current.style.height = 'auto';
            });
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
    const canFetchStudents = !subAdminPermissions || subAdminPermissions.includes('CAMPUS_MANAGE') || subAdminPermissions.includes('CAMPUS_ATTENDANCE');
    const canFetchLeaderboard = !subAdminPermissions || subAdminPermissions.includes('CAMPUS_VIEW') || subAdminPermissions.includes('CAMPUS_MANAGE');

    const fetchAll = useCallback(async () => {
        const requestId = ++reqIdRef.current;
        setLoading(true);
        try {
            // Use allSettled so a failed posts/teachers/students/leaderboard fetch (e.g. 403
            // during permission sync) doesn't prevent the division itself from loading.
            const [divResult, teachersResult, postsResult, studentsResult, leaderboardResult] = await Promise.allSettled([
                api.get(`/admin/campus/divisions/${divisionId}`, { params: yearParams }),
                canFetchTeachers ? api.get('/admin/teachers') : Promise.resolve({ data: { data: [] } }),
                canFetchPosts ? api.get('/admin/campus/feed/posts', { params: { divisionId, limit: 50 } }) : Promise.resolve({ data: { data: [] } }),
                canFetchStudents ? api.get(`/admin/campus/divisions/${divisionId}/students`, { params: yearParams }) : Promise.resolve({ data: { data: [] } }),
                canFetchLeaderboard ? api.get(`/admin/campus/divisions/${divisionId}/leaderboard`) : Promise.resolve({ data: { data: [] } }),
            ]);
            if (requestId !== reqIdRef.current) return; // a newer request has started; discard this stale response
            // Division is critical — re-throw so the catch block handles it
            if (divResult.status === 'rejected') throw divResult.reason;
            setLoadError(false);
            setDivision(divResult.value.data.data);
            setTeachers(teachersResult.status === 'fulfilled' ? (teachersResult.value.data.data ?? []) : []);
            setAnnouncements(postsResult.status === 'fulfilled' ? (postsResult.value.data.data ?? []) : []);
            setStudents(studentsResult.status === 'fulfilled' ? (studentsResult.value.data.data ?? []) : []);
            setLeaderboard(leaderboardResult.status === 'fulfilled' ? (leaderboardResult.value.data.data ?? []) : []);
            setLoading(false);
        } catch (err: unknown) {
            if (requestId !== reqIdRef.current) return; // a newer request has started; discard this stale failure
            // Clear rather than keep the previous response on screen — otherwise
            // it would be shown (and be actionable) under the newly-selected
            // year's label. loadError makes the empty state say "failed to load".
            setDivision(null);
            setTeachers([]);
            setAnnouncements([]);
            setStudents([]);
            setLeaderboard([]);
            setSelectedStudent(null);
            setLoadError(true);
            setLoading(false);
            const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
                ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to load class');
        }
    // yearParams is derived solely from effectiveYear, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [divisionId, canFetchTeachers, canFetchPosts, canFetchStudents, canFetchLeaderboard, effectiveYear]);

    // fetchedRef guards against React StrictMode's dev-only double-invoke of this
    // effect on mount (same deps, no real dependency change). prevYearRef tracks
    // the effective year so a genuine year switch still triggers a refetch — see
    // the Classes list page (app/admin/campus/classes/page.tsx) for the same pattern.
    const prevYearRef = useRef(effectiveYear);
    useEffect(() => {
        if (!fetchedRef.current) {
            fetchedRef.current = true;
            prevYearRef.current = effectiveYear;
            fetchAll();
            return;
        }
        if (prevYearRef.current !== effectiveYear) {
            prevYearRef.current = effectiveYear;
            // A student selected under the previous year's roster is a separate
            // piece of state that fetchAll() never touches — left alone, the
            // Student Info panel would keep showing that student's (possibly
            // now-stale, possibly no-longer-enrolled-here) details after the
            // new year's roster loads. Clear it so the panel falls back to its
            // "Select a student" empty state until the admin picks one fresh.
            setSelectedStudent(null);
            fetchAll();
        }
    }, [fetchAll, effectiveYear]);

    // Re-select the student that was clicked into Report/View Profile, once the
    // students list has loaded, instead of leaving selection empty/reset.
    const restoredSelectionRef = useRef(false);
    useEffect(() => {
        if (restoredSelectionRef.current) return;
        if (!wantedStudentId || students.length === 0) return;
        const wanted = students.find(s => s.id === wantedStudentId);
        if (wanted) {
            setSelectedStudent(wanted);
            setManageRightTab('student');
        }
        restoredSelectionRef.current = true;
    }, [students, wantedStudentId]);

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
            const res = await api.post(`/admin/campus/standards/${division.standard.id}/subjects`, { name });
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
                <p className="text-sm text-muted-foreground">{loadError ? 'Failed to load this class' : 'Division not found'}</p>
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
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <button onClick={() => router.back()}
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all">
                            <ArrowLeft size={16} />
                        </button>
                        <div>
                            <h1 className="text-lg lg:text-2xl font-bold flex items-center gap-2">
                                <Users size={24} />
                                {division.name}
                            </h1>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {division.standard.name} <ChevronRight size={11} /> {division.name}
                            </p>
                        </div>

                        {/* Tab bar */}
                        <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 lg:ml-4 overflow-x-auto">
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
                    <div className="flex items-center gap-4 flex-wrap overflow-x-auto">
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
                            <div className="flex items-center gap-4 flex-wrap">
                                {feesSubTab === 'setup' && (
                                    <button
                                        onClick={() => feesTabRef.current?.save()}
                                        disabled={feesSaving}
                                        className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-all shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                    >
                                        <Save size={13} />
                                        {feesSaving ? 'Saving…' : 'Save Changes'}
                                    </button>
                                )}
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
                            <div className="flex items-center gap-4 flex-wrap">
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
                            className="flex flex-col lg:flex-row gap-3 h-full pt-3 pb-3 px-1 overflow-y-auto lg:overflow-hidden">

                            {/* LEFT — Class Teacher + Feed */}
                            <div className="w-full lg:w-[58%] h-[70vh] lg:h-auto flex flex-col gap-3 min-h-0 lg:overflow-hidden">

                                {/* Class Teacher card */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm shadow-black/5">
                                    <div className="w-9 h-9 rounded-xl overflow-hidden relative flex items-center justify-center text-sm font-bold text-white shrink-0"
                                        style={{ background: classTeacherAssignment?.teacher.avatarUrl ? 'transparent' : '#F59E0B' }}>
                                        {classTeacherAssignment?.teacher.avatarUrl
                                            ? <NextImage src={classTeacherAssignment.teacher.avatarUrl} alt={classTeacherAssignment.teacher.user.name ?? 'Class Teacher'} fill sizes="36px" className="object-cover" />
                                            : classTeacherAssignment
                                                ? getInitials(classTeacherAssignment.teacher.user.name ?? 'CT')
                                                : '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-semibold" style={{ color: '#F59E0B' }}>Class Teacher</p>
                                        <p className="text-sm font-bold truncate">
                                            {classTeacherAssignment?.teacher.user.name
                                                ? formatDisplayName(classTeacherAssignment.teacher.user.name, classTeacherAssignment.teacher.prefix)
                                                : 'Not assigned'}
                                        </p>
                                    </div>
                                </div>

                                {/* Feed */}
                                <div className="relative flex-1 min-h-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
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
                                    <div ref={feedScrollRef} onScroll={e => setShowScrollTop(e.currentTarget.scrollTop > 200)} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0 bg-background">
                                        {filteredAnnouncements.length === 0 && (
                                            <p className="text-xs text-muted-foreground/60 italic text-center py-8">No posts yet</p>
                                        )}
                                        {filteredAnnouncements.map(ann => (
                                            <DivFeedCard key={ann.id} ann={ann} onDelete={deletePost} />
                                        ))}
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

                                    {/* Composer */}
                                    <div className="border-t border-border/40 px-3 py-1.5 shrink-0 space-y-1.5">
                                        {/* Row 1 — Title + Filters */}
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
                                            <div className="flex-1 flex items-start px-3 py-2 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 focus-within:bg-background transition-all">
                                                <textarea ref={bodyTextareaRef} value={postBody}
                                                    onChange={e => { setPostBody(e.target.value); autoGrowBody(e.target); }}
                                                    placeholder="Write description (optional)..." rows={1}
                                                    className="flex-1 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none resize-none max-h-24 overflow-y-auto py-0.5"
                                                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }} />
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
                            <div className="w-full lg:w-[42%] h-[65vh] lg:h-auto flex flex-col gap-3 min-h-0 overflow-y-auto pb-1">

                                {/* Subject Teachers */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <BookOpen size={12} /> Subject Teachers
                                        </p>
                                    </div>
                                    <div className="px-4 py-2 divide-y divide-border/20 overflow-y-auto"
                                        style={{ maxHeight: 7 * 37, scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                                        {division.divisionSubjects.length === 0 && (
                                            <p className="text-xs text-muted-foreground/60 italic py-3 text-center">No subjects selected</p>
                                        )}
                                        {division.standard.subjects
                                            .filter(sub => division.divisionSubjects.some(ds => ds.subjectId === sub.id))
                                            .map(sub => {
                                            const assignment = division.assignments.find(a => a.subjectId === sub.id);
                                            const teacherName = assignment?.teacher.user.name
                                                ? formatDisplayName(assignment.teacher.user.name, assignment.teacher.prefix)
                                                : null;
                                            return (
                                                <div key={sub.id} className="flex items-center justify-between py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full shrink-0"
                                                            style={{ background: colorForSubject(sub) }} />
                                                        <span className="text-xs font-medium">{sub.name}</span>
                                                    </div>
                                                    {teacherName ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-5 h-5 rounded-full overflow-hidden relative flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                                style={{ background: assignment?.teacher.avatarUrl ? 'transparent' : getAvatarColor(teacherName) }}>
                                                                {assignment?.teacher.avatarUrl
                                                                    ? <NextImage src={assignment.teacher.avatarUrl} alt={teacherName} fill sizes="20px" className="object-cover" />
                                                                    : getInitials(teacherName)}
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
                                                            { height: 'h-16', color: '#C0C0C0', label: '2nd', crown: false },
                                                            { height: 'h-24', color: '#F59E0B', label: '1st', crown: true },
                                                            { height: 'h-12', color: '#CD7F32', label: '3rd', crown: false },
                                                        ];
                                                        const cfg = podiumConfig[i];
                                                        if (!student) return null;
                                                        return (
                                                            <div key={student.id} className="flex flex-col items-center gap-1.5">

                                                                <div className="w-10 h-10 rounded-full overflow-hidden relative flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/20"
                                                                    style={{ background: student.avatarUrl ? 'transparent' : getAvatarColor(student.name) }}>
                                                                    {student.avatarUrl
                                                                        ? <NextImage src={student.avatarUrl} alt={student.name} fill sizes="40px" className="object-cover" />
                                                                        : getInitials(student.name)}
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
                                                            <div className="w-6 h-6 rounded-full overflow-hidden relative flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                                style={{ background: student.avatarUrl ? 'transparent' : getAvatarColor(student.name) }}>
                                                                {student.avatarUrl
                                                                    ? <NextImage src={student.avatarUrl} alt={student.name} fill sizes="24px" className="object-cover" />
                                                                    : getInitials(student.name)}
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

                                {/* Timetable */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Calendar size={12} /> Timetable
                                        </p>
                                    </div>
                                    {division.timetableUrl ? (
                                        <div className="p-2 cursor-pointer" onClick={() => setShowTimetable(true)}>
                                            <img
                                                src={division.timetableUrl}
                                                alt="Timetable"
                                                className="w-full rounded-xl object-contain max-h-84 hover:opacity-90 transition-opacity"
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-6 flex flex-col items-center justify-center gap-1.5 text-center">
                                            <Calendar size={22} className="text-muted-foreground/40" />
                                            <p className="text-[12px] text-muted-foreground">Timetable not uploaded yet</p>
                                        </div>
                                    )}
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
                            className="flex flex-col lg:flex-row gap-3 h-full pt-3 pb-3 px-1 overflow-y-auto lg:overflow-hidden">

                            {/* LEFT — Students List */}
                            <div className="w-full lg:w-[40%] h-[50vh] lg:h-auto flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl lg:overflow-hidden shadow-sm shadow-black/5">
                                <div className="px-4 py-3 border-b border-border/40 shrink-0">
                                    <p className="text-sm font-bold flex items-center gap-2">
                                        <Users size={15} /> Students ({students.length})
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto bg-background">
                                    {[...students].sort((a, b) => (a.rollNo ?? '').localeCompare(b.rollNo ?? '', undefined, { numeric: true })).map(student => {
                                        const isSelected = selectedStudent?.id === student.id;
                                        const lb = leaderboard.find(e => e.id === student.id);
                                        const name = student.user.name ?? '—';
                                        return (
                                            <button key={student.id}
                                                onClick={() => { setSelectedStudent(student); setManageRightTab('student'); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-colors hover:bg-muted/30 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                                                    }`}>
                                                <div onClick={e => { if (student.avatarUrl) { e.stopPropagation(); setExpandedPhoto({ url: student.avatarUrl, name }); } }}
                                                    className={`w-7 h-7 rounded-full overflow-hidden relative flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${student.avatarUrl ? 'cursor-pointer' : ''}`}
                                                    style={{ background: student.avatarUrl ? 'transparent' : getAvatarColor(name) }}>
                                                    {student.avatarUrl
                                                        ? <NextImage src={student.avatarUrl} alt={name} fill sizes="28px" className="object-cover" />
                                                        : getInitials(name)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold truncate">{name}</p>
                                                    <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo ?? '—'}</p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="flex flex-col items-end gap-1">
                                                        {!student.hasLoggedIn && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                                                                First login
                                                            </span>
                                                        )}
                                                        {student.status === 'INACTIVE' && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[11px] font-bold" style={{ color: '#7C3AED' }}>{lb ? `#${lb.rank}` : '—'}</p>
                                                        <p className="text-[9px] text-muted-foreground/60">rank</p>
                                                    </div>
                                                    <div className="text-right">

                                                        <div className={`text-[11px] font-bold ${lb?.attendancePct == null ? 'text-muted-foreground/60'
                                                            : lb.attendancePct >= 75 ? 'text-emerald-600 dark:text-emerald-400'
                                                                : lb.attendancePct >= 65 ? 'text-amber-600'
                                                                    : 'text-red-500'
                                                            }`}>
                                                            {lb?.attendancePct != null ? `${lb.attendancePct}%` : '—'}
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
                            <div className="w-full lg:w-[60%] h-[70vh] lg:h-auto flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">

                                {/* Tab bar */}
                                <div className="px-4 py-2.5 border-b border-border/40 shrink-0 flex items-center justify-between flex-wrap gap-2">
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
                                                disabled={togglingStatus || isHistorical}
                                                title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50 ${selectedStudent.status === 'ACTIVE'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                                    }`}>
                                                {selectedStudent.status === 'ACTIVE' ? <><PowerOff size={11} /> Deactivate</> : <><Power size={11} /> Activate</>}
                                            </button>
                                            <button onClick={() => {
                                                // Sync this entry's own URL with the current tab/selection first (no new
                                                // history entry — replaceState is synchronous), so when Report/Profile
                                                // navigates back with a plain router.back(), it lands on this exact
                                                // state instead of a duplicate class-page entry.
                                                const params = new URLSearchParams(searchParams.toString());
                                                params.set('tab', 'manage');
                                                params.set('student', selectedStudent.id);
                                                window.history.replaceState(null, '', `/admin/campus/classes/${division?.standard.id}/${divisionId}?${params.toString()}`);
                                                router.push(`/admin/campus/classes/${division?.standard.id}/${divisionId}/students/${selectedStudent.id}/reports?name=${encodeURIComponent(selectedStudent.user.name ?? 'Student')}&class=${encodeURIComponent(division?.name ?? '')}`);
                                            }}
                                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-red-500 hover:border-red-400/50 transition-all">
                                                <Flag size={11} /> Report
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const params = new URLSearchParams(searchParams.toString());
                                                    params.set('tab', 'manage');
                                                    params.set('student', selectedStudent.id);
                                                    window.history.replaceState(null, '', `/admin/campus/classes/${division?.standard.id}/${divisionId}?${params.toString()}`);
                                                    router.push(`/admin/campus/classes/${division?.standard.id}/${divisionId}/students/${selectedStudent.id}/profile`);
                                                }}
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
                                                                        disabled={togglingSubject === sub.id || isHistorical}
                                                                        title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all disabled:opacity-50"
                                                                        style={isSelected ? {
                                                                            background: (colorForSubject(sub)) + '20',
                                                                            color: colorForSubject(sub),
                                                                            border: `1px solid ${colorForSubject(sub)}40`,
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
                                                                    — {formatDisplayName(classTeacherAssignment.teacher.user.name ?? '', classTeacherAssignment.teacher.prefix)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {classTeacherAssignment && (
                                                                <button onClick={() => setConfirmRemove(classTeacherAssignment.id)}
                                                                    disabled={isHistorical}
                                                                    title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                                    className="text-[10px] text-red-500 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed">
                                                                    Remove
                                                                </button>
                                                            )}
                                                            <TeacherPicker
                                                                value={classTeacherAssignment?.teacher.id}
                                                                teachers={teachers}
                                                                accentColor="#F59E0B"
                                                                loading={savingAssign}
                                                                disabled={isHistorical}
                                                                title={isHistorical ? 'Read-only — viewing a past year' : undefined}
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
                                                                                    style={{ background: colorForSubject(sub) }} />
                                                                                <span className="text-xs text-muted-foreground">{sub.name}</span>
                                                                                {assignment && (
                                                                                    <span className="text-[10px] text-foreground font-semibold">
                                                                                        — {formatDisplayName(assignment.teacher.user.name ?? '', assignment.teacher.prefix)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                {assignment && (
                                                                                    <button onClick={() => setConfirmRemove(assignment.id)}
                                                                                        disabled={isHistorical}
                                                                                        title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                                                        className="text-[10px] text-red-500 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed">
                                                                                        Remove
                                                                                    </button>
                                                                                )}
                                                                                <TeacherPicker
                                                                                    value={assignment?.teacher.id}
                                                                                    teachers={teachers}
                                                                                    accentColor={colorForSubject(sub)}
                                                                                    loading={savingAssign}
                                                                                    disabled={isHistorical}
                                                                                    title={isHistorical ? 'Read-only — viewing a past year' : undefined}
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
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                            {[
                                                                {
                                                                    label: 'Class Rank',
                                                                    value: loadingStats ? '…' : (studentStats?.classRank != null ? `#${studentStats.classRank}` : '—'),
                                                                    sub: 'by score',
                                                                    color: studentStats?.classRank == null ? undefined :
                                                                        studentStats.classRank === 1 ? '#F59E0B' :
                                                                            studentStats.classRank <= 3 ? '#7C3AED' :
                                                                                studentStats.classRank <= 10 ? 'var(--blue)' :
                                                                                    'var(--muted-foreground)',
                                                                },
                                                                {
                                                                    label: 'Score %',
                                                                    value: loadingStats ? '…' : (studentStats?.score.pct != null ? `${studentStats.score.pct}%` : '—'),
                                                                    sub: 'overall',
                                                                    // Same thresholds/colors as the marksheet's own scoreColor().
                                                                    color: studentStats?.score.pct == null ? undefined :
                                                                        studentStats.score.pct >= 75 ? '#059669' :
                                                                            studentStats.score.pct >= 35 ? '#F59E0B' : '#DC2626',
                                                                },
                                                                {
                                                                    label: 'Attendance',
                                                                    value: loadingStats ? '…' : (studentStats?.attendance.pct != null ? `${studentStats.attendance.pct}%` : '—'),
                                                                    sub: 'overall',
                                                                    color: studentStats?.attendance.pct == null ? undefined :
                                                                        studentStats.attendance.pct >= 75 ? '#10B981' :
                                                                            studentStats.attendance.pct >= 65 ? '#F59E0B' : '#EF4444',
                                                                },
                                                            ].map(stat => (
                                                                <div key={stat.label} className="flex flex-col items-center justify-center py-2.5 rounded-xl border border-border/40 bg-muted/20">
                                                                    <p className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</p>
                                                                    <p className="text-[11px] font-semibold text-foreground/70 mt-0.5">{stat.label}</p>
                                                                    <p className="text-[10px] text-muted-foreground/60">{stat.sub}</p>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Account status banner */}
                                                        {selectedStudent.hasLoggedIn ? (
                                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                                                <p className="text-[11px] text-green-700 dark:text-green-300 font-medium">Active — student has logged in</p>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                                                                    Awaiting first login — student hasn&apos;t logged in yet
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* ROW 1 — Student Info + Academic */}
                                                        <div className="flex flex-col md:flex-row gap-3 border border-border/40 rounded-2xl overflow-hidden bg-background">
                                                            {/* LEFT — Student Info */}
                                                            <div className="flex-1 px-4 py-3 md:border-r border-border/40 min-w-0 space-y-2.5">
                                                                <SectionViewLabel icon={User} label="Student Info" />
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <div onClick={() => selectedStudent.avatarUrl && setExpandedPhoto({ url: selectedStudent.avatarUrl, name: selectedStudent.user.name ?? '—' })}
                                                                        className={`w-12 h-12 rounded-xl overflow-hidden relative flex items-center justify-center text-sm font-bold text-white shrink-0 ${selectedStudent.avatarUrl ? 'cursor-pointer' : ''}`}
                                                                        style={{ background: selectedStudent.avatarUrl ? 'transparent' : getAvatarColor(selectedStudent.user.name ?? '—') }}>
                                                                        {selectedStudent.avatarUrl
                                                                            ? <NextImage src={selectedStudent.avatarUrl} alt={selectedStudent.user.name ?? 'Student'} fill sizes="48px" className="object-cover" />
                                                                            : getInitials(selectedStudent.user.name ?? '—')}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold">{selectedStudent.user.name ?? '—'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    <ReadField label="Date of Birth" value={selectedStudent.dob ?? '—'} />
                                                                    <ReadField label="Gender" value={toTitleCase(selectedStudent.gender) || '—'} />
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    <ReadField label="Religion" value={selectedStudent.religion ?? '—'} />
                                                                    <ReadField label="Category" value={selectedStudent.category ?? '—'} />
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    <ReadField label="Nationality" value={selectedStudent.nationality ?? '—'} />
                                                                    <ReadField label="Admission Year" value={selectedStudent.admissionYear ?? '—'} />
                                                                </div>
                                                                <ReadField label="Email" value={isPlaceholderEmail(selectedStudent.user.email) ? '' : selectedStudent.user.email} />
                                                                <ReadField label="Contact No" value={selectedStudent.phone ?? '—'} />
                                                            </div>

                                                            {/* RIGHT — Academic Details */}
                                                            <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                                                                <SectionViewLabel icon={BookOpen} label="Academic Details" />
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    <ReadField label="Class" value={division?.standard.name.replace(/^Class\s*/i, '') ?? '—'} />
                                                                    <ReadField label="Division" value={division?.name.split('-').pop() ?? division?.name ?? '—'} />
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    <ReadField label="Roll No" value={selectedStudent.rollNo ?? '—'} />
                                                                    <ReadField label="House Color" value={selectedStudent.houseColor ?? '—'} />
                                                                </div>
                                                                {/* Student ID */}
                                                                <div>
                                                                    <p className="text-[11px] text-muted-foreground mb-1 font-medium">Student ID</p>
                                                                    <div className="h-8 px-3 rounded-md border border-border/40 bg-muted/40 flex items-center justify-between">
                                                                        <span className="text-sm font-mono font-semibold" style={{ color: '#DA7756' }}>
                                                                            {selectedStudent.studentId}
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-foreground/50">Read only</span>
                                                                    </div>
                                                                </div>

                                                                {/* Password */}
                                                                <div>
                                                                    <p className="text-[11px] text-muted-foreground mb-1 font-medium">Current Password</p>
                                                                    <div className="h-8 px-3 rounded-md border border-border/40 bg-muted/40 flex items-center justify-between gap-2">
                                                                        <span className="text-sm font-mono flex-1">
                                                                            {showPassword
                                                                                ? (selectedStudent.user.mustChangePassword && selectedStudent.tempPassword ? selectedStudent.tempPassword : '(changed)')
                                                                                : '••••••••••'}
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
                                                        <div className="flex flex-col md:flex-row gap-3 border border-border/40 rounded-2xl overflow-hidden bg-background">
                                                            {/* LEFT — Medical & Identity */}
                                                            <div className="flex-1 px-4 py-3 md:border-r border-border/40 min-w-0 space-y-2.5">
                                                                <SectionViewLabel icon={Shield} label="Medical & Identity" />
                                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/50">
                                                                    <Heart size={18} className="text-red-500 shrink-0" />
                                                                    <div>
                                                                        <p className="text-[10px] text-red-400 font-medium">Blood Group</p>
                                                                        <p className="text-xl font-black text-red-500">{selectedStudent.bloodGroup || '—'}</p>
                                                                    </div>
                                                                </div>
                                                                <ReadField label="Aadhar No" value={selectedStudent.aadharNo ?? '—'} />
                                                                <ReadField label="PAN No" value={selectedStudent.panNo ?? '—'} />
                                                                <ReadField label="Emergency Contact" value={selectedStudent.emergencyContact ?? '—'} />
                                                            </div>

                                                            {/* RIGHT — Address */}
                                                            <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                                                                <SectionViewLabel icon={MapPin} label="Address" />
                                                                <ReadField label="Address" value={selectedStudent.address ?? '—'} multiline />
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    <ReadField label="City" value={selectedStudent.city ?? '—'} />
                                                                    <ReadField label="State" value={selectedStudent.state ?? '—'} />
                                                                    <ReadField label="Pincode" value={selectedStudent.pincode ?? '—'} />
                                                                    <ReadField label="Country" value={selectedStudent.country ?? '—'} />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* ROW 3 — Parents/Guardian */}
                                                        <div className="border border-border/40 rounded-2xl px-4 py-3 space-y-2.5 bg-background">
                                                            <SectionViewLabel icon={Users} label="Parents / Guardian" />
                                                            {(!selectedStudent.guardians || selectedStudent.guardians.length === 0) ? (
                                                                <p className="text-xs text-muted-foreground/60 text-center py-1">No parents or guardians added yet</p>
                                                            ) : (
                                                                selectedStudent.guardians.map((g, i) => (
                                                                    <div key={i} className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-2">
                                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                                                            {g.relation || `Entry ${i + 1}`}
                                                                        </p>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                            <ReadField label="Name" value={g.name} />
                                                                            <ReadField label="Number" value={g.number} />
                                                                            <ReadField label="Relation" value={g.relation} />
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
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
                                ref={feesTabRef}
                                divisionId={divisionId}
                                divisionName={division.name}
                                feesSubTab={feesSubTab}
                                onSavingChange={setFeesSaving}
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
                                        color: colorForSubject(s),
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
                                    <a href={division.timetableUrl ?? '#'} download
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
                            {division.timetableUrl && <img src={division.timetableUrl} alt="Timetable"
                                className="w-full rounded-2xl object-contain max-h-[80vh]" />}
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
                {confirmToggle && selectedStudent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                            <h3 className="text-base font-bold mb-2">
                                {selectedStudent.status === 'ACTIVE' ? '⚠️ Deactivate Student?' : '✅ Activate Student?'}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                {selectedStudent.status === 'ACTIVE'
                                    ? `${selectedStudent.user.name ?? 'This student'} will lose access immediately.`
                                    : `${selectedStudent.user.name ?? 'This student'} will regain access to the platform.`
                                }
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmToggle(false)} disabled={togglingStatus}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all disabled:opacity-50">
                                    Cancel
                                </button>
                                <button onClick={toggleStudentStatus} disabled={togglingStatus}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                    style={{ background: selectedStudent.status === 'ACTIVE' ? '#ef4444' : '#10b981' }}>
                                    {togglingStatus ? '…' : selectedStudent.status === 'ACTIVE' ? 'Yes, Deactivate' : 'Yes, Activate'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Expanded student photo — same treatment as My Profile's avatar zoom */}
            <AnimatePresence>
                {expandedPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => setExpandedPhoto(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <img src={expandedPhoto.url} alt={expandedPhoto.name} className="w-full h-full object-cover" />
                            <button
                                onClick={() => setExpandedPhoto(null)}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                                <X size={14} className="text-white" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
