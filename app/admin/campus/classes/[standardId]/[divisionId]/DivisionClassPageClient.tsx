'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronRight, Users, BookOpen,
    Plus, X, Check, ChevronDown, User as UserIcon,
    Calendar, FileText, Trophy, Send, Crown, ChevronUp, Paperclip, PowerOff, Power, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { assignSubjectColor } from '@/lib/subjectColors';
import { FeesTab } from './fees';

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
    standard: { id: string; name: string };
    subjects: Subject[];
    assignments: Assignment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
function getAvatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
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
    id: string; type: PostType; title: string; body?: string;
    author: string; role: string; subject?: string; time: string;
    attachments?: { name: string; kind: string }[];
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

const MOCK_ANNOUNCEMENTS: DivAnnouncement[] = [
    { id: 'a1', type: 'announcement', title: 'PTM this Saturday', body: 'Parent Teacher Meeting on Saturday at 10 AM.', author: 'Ritu Sharma', role: 'Teacher', time: '2h ago' },
    { id: 'a2', type: 'notice', title: 'Unit Test 3 Schedule', body: 'Unit Test 3 will be held on 20th May.', author: 'Admin', role: 'Admin', time: '1d ago' },
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

function DivFeedCard({ ann }: { ann: DivAnnouncement }) {
    const [expanded, setExpanded] = useState(false);
    const meta = POST_META[ann.type];
    const initials = ann.author.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    const avatarColor = AVATAR_COLORS[ann.author.charCodeAt(0) % AVATAR_COLORS.length];

    return (
        <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>
                    {meta.emoji} {meta.label}
                    {ann.subject && <span className="font-normal opacity-75">· {ann.subject}</span>}
                </span>
                <span className="text-[11px] text-muted-foreground">{ann.time}</span>
            </div>
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: avatarColor }}>
                    {initials}
                </div>
                <div>
                    <p className="text-xs font-semibold">{ann.author}</p>
                    <div className="flex items-center gap-1">
                        <p className="text-[10px] text-muted-foreground">{ann.role}</p>
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
            {ann.attachments && ann.attachments.length > 0 && expanded && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
                    {ann.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted border border-border/50 text-[11px] font-medium">
                            <span>{
                                att.kind === 'image' ? '🖼️' :
                                    att.kind === 'video' ? '🎥' :
                                        att.kind === 'pdf' ? '📄' : '📎'
                            }</span>
                            <span className="text-muted-foreground">{att.name}</span>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'overview' as const, label: 'View' },
    { key: 'manage' as const, label: 'Manage' },
    { key: 'fees' as const, label: 'Fees' },
];

export default function DivisionDetailPage() {
    const router = useRouter();
    const params = useParams();
    const divisionId = params.divisionId as string;

    const [division, setDivision] = useState<Division | null>(null);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'manage' | 'fees'>('overview');
    const [manageTab, setManageTab] = useState<'teachers' | 'subjects'>('teachers');
    const [addingSubject, setAddingSubject] = useState(false);
    const [savingAssign, setSavingAssign] = useState(false);
    const [savingSubject, setSavingSubject] = useState(false);
    const fetchedRef = useRef(false);
    const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
    const [postType, setPostType] = useState<PostType>('announcement');
    const [postInput, setPostInput] = useState('');
    const [announcements, setAnnouncements] = useState<DivAnnouncement[]>(MOCK_ANNOUNCEMENTS);
    const [postBody, setPostBody] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showTimetable, setShowTimetable] = useState(false);
    const [postSubject, setPostSubject] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<typeof MOCK_STUDENTS[0] | null>(null);
    const [manageRightTab, setManageRightTab] = useState<'teachers' | 'student'>('teachers');
    const [confirmToggle, setConfirmToggle] = useState(false);
    const [studentActive, setStudentActive] = useState(true);
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [feesSubTab, setFeesSubTab] = useState<'setup' | 'students'>('students');


    const toggleSubject = (subId: string) => {
        setSelectedSubjects(prev =>
            prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
        );
    };

    const filteredAnnouncements = feedFilter === 'all'
        ? announcements
        : announcements.filter(a => a.type === feedFilter);

    const handlePost = () => {
        if (!postInput.trim()) return;
        setAnnouncements(prev => [{
            id: `a-${Date.now()}`, type: postType,
            title: postInput.trim(),
            body: postBody.trim() || undefined,
            subject: postSubject.trim() || undefined,
            author: 'Admin', role: 'Admin',
            time: 'Just now',
            attachments: attachments.map(f => ({
                name: f.name,
                kind: f.type.startsWith('image/') ? 'image' :
                    f.type.startsWith('video/') ? 'video' :
                        f.name.endsWith('.pdf') ? 'pdf' : 'file'
            })),
        }, ...prev]);
        setPostInput('');
        setPostBody('');
        setPostSubject('');
        setAttachments([]);
        toast.success('Posted!');
    };

    const fetchAll = useCallback(async () => {
        try {
            const [divRes, teachersRes] = await Promise.all([
                api.get(`/admin/campus/divisions/${divisionId}`),
                api.get('/admin/teachers'),
            ]);
            setDivision(divRes.data.data);
            setTeachers(teachersRes.data.data ?? []);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to load division');
        } finally {
            setLoading(false);
        }
    }, [divisionId]);

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
            const colorIndex = division.subjects.length;
            const color = assignSubjectColor(colorIndex);
            const res = await api.post(`/admin/campus/divisions/${division.id}/subjects`, { name, color });
            const newSubject: Subject = res.data.data;
            setDivision(prev => prev ? {
                ...prev, subjects: [...prev.subjects, newSubject],
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
                subjects: prev.subjects.filter(s => s.id !== subjectId),
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
                                return (
                                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="relative">
                                        {isActive && (
                                            <motion.div layoutId="divTab"
                                                className="absolute inset-0 bg-primary rounded-4xl"
                                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                                        )}
                                        <div className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-4xl transition-colors ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {tab.label}
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
                                    { label: 'Subjects', value: division.subjects.length },
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
                                            <h2 className="text-sm font-bold">📢 {division.name} Announcements & Feed</h2>
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
                                        {filteredAnnouncements.map((ann, i) => {
                                            const meta = POST_META[ann.type as keyof typeof POST_META];
                                            const initials = ann.author.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
                                            const avatarColor = AVATAR_COLORS[ann.author.charCodeAt(0) % AVATAR_COLORS.length];
                                            return (
                                                <DivFeedCard key={ann.id} ann={ann} />
                                            );
                                        })}
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
                                                {attachments.length > 0 && (
                                                    <div className="flex items-center gap-1 ml-2">
                                                        {attachments.map((file, i) => (
                                                            <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted border border-border/50 text-[10px]">
                                                                <span>{
                                                                    file.type.startsWith('image/') ? '🖼️' :
                                                                        file.type.startsWith('video/') ? '🎥' :
                                                                            file.name.endsWith('.pdf') ? '📄' :
                                                                                file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? '📊' :
                                                                                    file.name.endsWith('.docx') || file.name.endsWith('.doc') ? '📝' : '📎'
                                                                }</span>
                                                                <span className="truncate max-w-[60px] text-muted-foreground">{file.name}</span>
                                                                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>
                                                                    <X size={9} className="text-muted-foreground hover:text-red-500" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <input ref={fileInputRef} type="file" multiple className="hidden"
                                                onChange={e => {
                                                    if (e.target.files) {
                                                        setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                                                        e.target.value = '';
                                                    }
                                                }} />
                                            <button onClick={() => fileInputRef.current?.click()}
                                                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50 transition-all shrink-0">
                                                <Paperclip size={14} />
                                            </button>
                                            <button onClick={handlePost} disabled={!postInput.trim()}
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
                                        {division.subjects.length === 0 && (
                                            <p className="text-xs text-muted-foreground/60 italic py-3 text-center">No subjects yet</p>
                                        )}
                                        {division.subjects.map(sub => {
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
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Trophy size={12} /> Leaderboard — Top 5
                                        </p>
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
                                            className="w-full rounded-xl object-contain max-h-48 hover:opacity-90 transition-opacity"
                                        />
                                    </div>
                                </div>

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
                            <div className="w-[50%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
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
                            <div className="w-[50%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">

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
                                            <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                                                View Details <ExternalLink size={10} />
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

                                                {/* Subjects Pool Selection */}
                                                <div>
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                                        Division Subjects
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {MOCK_SUBJECT_POOL.map(sub => {
                                                            const isSelected = selectedSubjects.includes(sub.id);
                                                            return (
                                                                <button key={sub.id}
                                                                    onClick={() => toggleSubject(sub.id)}
                                                                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all" style={isSelected ? {
                                                                        background: sub.color + '20',
                                                                        color: sub.color,
                                                                        border: `1px solid ${sub.color}40`,
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
                                                </div>

                                                {/* Divider */}
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
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Subject Teachers</p>
                                                        {selectedSubjects.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground/60 italic">Select subjects above first</p>
                                                        ) : (
                                                            <div className="space-y-1.5">
                                                                {MOCK_SUBJECT_POOL
                                                                    .filter(sub => selectedSubjects.includes(sub.id))
                                                                    .map(sub => {
                                                                        const assignment = division.assignments.find(a => a.subjectId === sub.id);
                                                                        return (
                                                                            <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded-xl border border-border/40 bg-muted/20">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="w-2 h-2 rounded-full shrink-0"
                                                                                        style={{ background: sub.color }} />
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
                                                                                        accentColor={sub.color}
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
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Student Info tab */}
                                        {manageRightTab === 'student' && (
                                            <motion.div key="student" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="px-4 py-3">
                                                {!selectedStudent ? (
                                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                                            <Users size={20} className="text-muted-foreground" />
                                                        </div>
                                                        <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                                                        <p className="text-xs text-muted-foreground/60 mt-1">Click any student from the list</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {/* Student header */}
                                                        <div className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-muted/20">
                                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white shrink-0"
                                                                style={{ background: getAvatarColor(selectedStudent.name) }}>
                                                                {getInitials(selectedStudent.name)}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold">{selectedStudent.name}</p>
                                                                <p className="text-[11px] text-muted-foreground">Roll No. {selectedStudent.rollNo} · {selectedStudent.gender}</p>
                                                                <p className="text-[11px] text-muted-foreground">DOB: {selectedStudent.dob}</p>
                                                            </div>
                                                        </div>

                                                        {/* Stats */}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
                                                                <p className="text-lg font-black" style={{ color: '#7C3AED' }}>#{selectedStudent.rank}</p>
                                                                <p className="text-[11px] text-muted-foreground">Class Rank</p>
                                                            </div>
                                                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
                                                                <p className="text-lg font-black">{Math.round((selectedStudent.totalMarks / 500) * 100)}%</p>
                                                                <p className="text-[11px] text-muted-foreground">Score %</p>
                                                            </div>
                                                        </div>

                                                        {/* Attendance */}
                                                        <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <p className="text-xs font-semibold">Attendance</p>
                                                                <span className={`text-sm font-black ${selectedStudent.attendance >= 75 ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : selectedStudent.attendance >= 65 ? 'text-amber-600'
                                                                        : 'text-red-500'
                                                                    }`}>
                                                                    {selectedStudent.attendance}%
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full transition-all"
                                                                    style={{
                                                                        width: `${selectedStudent.attendance}%`,
                                                                        background: selectedStudent.attendance >= 75 ? '#10b981'
                                                                            : selectedStudent.attendance >= 65 ? '#F59E0B'
                                                                                : '#ef4444'
                                                                    }} />
                                                            </div>
                                                            <div className="mt-2">
                                                                {selectedStudent.attendance >= 75 ? (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-semibold">
                                                                        ✅ Good
                                                                    </span>
                                                                ) : selectedStudent.attendance >= 65 ? (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-semibold">
                                                                        ⚠️ Condonation
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 font-semibold">
                                                                        ❌ Defaulter
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Contact */}
                                                        <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                                            <p className="text-xs font-semibold mb-2">Contact</p>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[11px] text-muted-foreground">Phone</span>
                                                                <span className="text-[11px] font-medium">{selectedStudent.phone}</span>
                                                            </div>
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
