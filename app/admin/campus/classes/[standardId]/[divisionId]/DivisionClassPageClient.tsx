'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronRight, Users, BookOpen,
    Plus, X, Check, ChevronDown, User as UserIcon,
    Calendar, FileText, Trophy, Send, Crown,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { assignSubjectColor } from '@/lib/subjectColors';

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

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'overview' as const, label: 'View' },
    { key: 'manage' as const, label: 'Manage' },
];

export default function DivisionDetailPage() {
    const router = useRouter();
    const params = useParams();
    const divisionId = params.divisionId as string;

    const [division, setDivision] = useState<Division | null>(null);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'manage'>('overview');
    const [manageTab, setManageTab] = useState<'teachers' | 'subjects'>('teachers');
    const [addingSubject, setAddingSubject] = useState(false);
    const [savingAssign, setSavingAssign] = useState(false);
    const [savingSubject, setSavingSubject] = useState(false);
    const fetchedRef = useRef(false);

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

                    <div className="flex items-center gap-4">
                        {[
                            { label: 'Subjects', value: division.subjects.length },
                            { label: 'Teachers', value: new Set(division.assignments.map(a => a.teacher.id)).size },
                        ].map(({ label, value }) => (
                            <div key={label} className="text-right">
                                <p className="text-lg font-bold leading-tight">{value}</p>
                                <p className="text-[11px] text-muted-foreground">{label}</p>
                            </div>
                        ))}
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

                            {/* LEFT — Class Teacher + Subject Teachers */}
                            <div className="w-[50%] flex flex-col gap-3 min-h-0">

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

                                {/* Subject teachers */}
                                <div className="flex-1 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <BookOpen size={12} /> Subject Teachers
                                        </p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-border/20">
                                        {division.subjects.length === 0 && (
                                            <p className="text-xs text-muted-foreground/60 italic py-4 text-center">
                                                No subjects yet — add them in Manage tab
                                            </p>
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
                            </div>

                            {/* RIGHT — Stats stubs */}
                            <div className="w-[50%] flex flex-col gap-3 min-h-0 overflow-y-auto pb-1">

                                {/* Leaderboard stub */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Trophy size={12} /> Leaderboard
                                        </p>
                                    </div>
                                    <div className="px-4 py-6 flex items-center justify-center text-xs text-muted-foreground/60 italic">
                                        No students enrolled yet
                                    </div>
                                </div>

                                {/* Timetable stub */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Calendar size={12} /> Timetable
                                        </p>
                                    </div>
                                    <div className="px-4 py-6 flex items-center justify-center text-xs text-muted-foreground/60 italic">
                                        Coming soon
                                    </div>
                                </div>

                                {/* Results stub */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <FileText size={12} /> Results
                                        </p>
                                    </div>
                                    <div className="px-4 py-6 flex items-center justify-center text-xs text-muted-foreground/60 italic">
                                        Coming soon
                                    </div>
                                </div>

                                {/* Feed stub */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Send size={12} /> Announcements
                                        </p>
                                    </div>
                                    <div className="px-4 py-6 flex items-center justify-center text-xs text-muted-foreground/60 italic">
                                        Coming soon
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── TAB 2: MANAGE ── */}
                    {activeTab === 'manage' && (
                        <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex gap-3 h-full pt-3 pb-3 px-1 overflow-hidden">

                            {/* LEFT — Students (read-only) */}
                            <div className="w-[40%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                <div className="px-4 py-3 border-b border-border/40 shrink-0">
                                    <p className="text-sm font-bold flex items-center gap-2">
                                        <Users size={15} /> Students
                                    </p>
                                </div>
                                <div className="flex-1 flex items-center justify-center bg-background">
                                    <div className="text-center px-6">
                                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                                            <Users size={20} className="text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground">No students yet</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">
                                            Students are enrolled by class teachers
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT — Teachers + Subjects */}
                            <div className="w-[60%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">

                                {/* Tab bar */}
                                <div className="px-4 py-2.5 border-b border-border/40 shrink-0">
                                    <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/40 w-fit">
                                        {[
                                            { key: 'teachers' as const, label: 'Teacher Assignments' },
                                            { key: 'subjects' as const, label: 'Subjects' },
                                        ].map(tab => {
                                            const isActive = manageTab === tab.key;
                                            return (
                                                <button key={tab.key} onClick={() => setManageTab(tab.key)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto min-h-0">
                                    <AnimatePresence mode="wait">

                                        {/* Teachers tab */}
                                        {manageTab === 'teachers' && (
                                            <motion.div key="teachers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="px-4 py-3 space-y-4">

                                                {/* Class Teacher */}
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
                                                                <button
                                                                    onClick={() => removeAssignment(classTeacherAssignment.id)}
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

                                                {/* Subject Teachers */}
                                                <div>
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Subject Teachers</p>
                                                    {division.subjects.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground/60 italic">
                                                            Add subjects first using the Subjects tab
                                                        </p>
                                                    ) : (
                                                        <div className="space-y-1.5">
                                                            {division.subjects.map(sub => {
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
                                                                                <button
                                                                                    onClick={() => removeAssignment(assignment.id)}
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

                                        {/* Subjects tab */}
                                        {manageTab === 'subjects' && (
                                            <motion.div key="subjects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="px-4 py-3">
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                        {division.subjects.length} subjects
                                                    </p>
                                                    {!addingSubject && (
                                                        <button onClick={() => setAddingSubject(true)}
                                                            className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium">
                                                            <Plus size={12} /> Add subject
                                                        </button>
                                                    )}
                                                </div>

                                                {division.subjects.length === 0 && !addingSubject && (
                                                    <p className="text-xs text-muted-foreground/60 italic text-center py-6">
                                                        No subjects yet
                                                    </p>
                                                )}

                                                <div className="space-y-1.5">
                                                    {division.subjects.map(sub => (
                                                        <div key={sub.id}
                                                            className="flex items-center justify-between py-2 px-3 rounded-xl border border-border/40 bg-muted/20">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full shrink-0"
                                                                    style={{ background: sub.color ?? '#7C3AED' }} />
                                                                <span className="text-sm font-medium">{sub.name}</span>
                                                                {sub.code && (
                                                                    <span className="text-[10px] text-muted-foreground">({sub.code})</span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => deleteSubject(sub.id)}
                                                                className="text-[10px] text-red-500 hover:underline">
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                                {addingSubject && (
                                                    <InlineAddInput
                                                        placeholder="Subject name"
                                                        onAdd={addSubject}
                                                        onCancel={() => setAddingSubject(false)}
                                                        loading={savingSubject}
                                                    />
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
