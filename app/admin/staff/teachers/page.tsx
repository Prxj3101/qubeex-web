'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import NextImage from 'next/image';
import type {
    Teacher,
    TeacherAssignment,
    InstitutionStructure,
    InstitutionType,
} from '@/types';
import { getStructureLabels } from '@/lib/getInstitutionAccent';
import { AddTeacherModal, type TeacherFormData } from '@/components/admin/AddTeacherModal';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    Plus, Search, X, Users, Mail, Phone,
    CalendarDays, BookOpen, Edit2, PowerOff, Power,
    GraduationCap, Hash, Layers, Eye, Sparkles, MapPin, Briefcase, MailCheck, Trash2
} from 'lucide-react';

import { useMockInstType } from '@/context/MockInstTypeContext';
import { useAuthStore } from '@/store/authStore';

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_TEACHERS: Teacher[] = [
    {
        id: 't1', teacherId: 'TCH-001', name: 'Ritu Sharma', email: 'ritu.sharma@dps.edu.in',
        phone: '+91 98765 43210', status: 'ACTIVE', joinedAt: '2025-08-15T00:00:00Z',
        assignments: [
            { id: 'a1', level1Id: 'l1-1', level1Name: 'Class 10', level2Id: 'l2-1', level2Name: 'Mathematics', level3Id: 'l3-1', level3Name: '10-A', role: 'CLASS_TEACHER' },
            { id: 'a2', level1Id: 'l1-1', level1Name: 'Class 10', level2Id: 'l2-1', level2Name: 'Mathematics', level3Id: 'l3-2', level3Name: '10-B', role: 'SUBJECT_TEACHER' },
        ],
    },
    {
        id: 't2', teacherId: 'TCH-002', name: 'Ankit Verma', email: 'ankit.verma@dps.edu.in',
        status: 'ACTIVE', joinedAt: '2025-09-01T00:00:00Z',
        assignments: [
            { id: 'a3', level1Id: 'l1-1', level1Name: 'Class 10', level2Id: 'l2-2', level2Name: 'Science', level3Id: 'l3-4', level3Name: '10-A', role: 'SUBJECT_TEACHER' },
        ],
    },
    {
        id: 't3', teacherId: 'TCH-003', name: 'Priya Nair', email: 'priya.nair@dps.edu.in',
        phone: '+91 87654 32109', status: 'ACTIVE', joinedAt: '2025-07-20T00:00:00Z',
        assignments: [
            { id: 'a4', level1Id: 'l1-1', level1Name: 'Class 10', level2Id: 'l2-3', level2Name: 'English', level3Id: 'l3-6', level3Name: '10-A', role: 'SUBJECT_TEACHER' },
        ],
    },
    {
        id: 't4', teacherId: 'TCH-004', name: 'Rajesh Kumar', email: 'rajesh.k@dps.edu.in',
        status: 'INACTIVE', joinedAt: '2024-06-10T00:00:00Z', assignments: [],
    },
    {
        id: 't5', teacherId: 'TCH-005', name: 'Meena Patel', email: 'meena.patel@dps.edu.in',
        phone: '+91 76543 21098', status: 'ACTIVE', joinedAt: '2026-01-15T00:00:00Z',
        assignments: [
            { id: 'a5', level1Id: 'l1-2', level1Name: 'Class 9', level2Id: 'l2-4', level2Name: 'Mathematics', level3Id: 'l3-7', level3Name: '9-A', role: 'CLASS_TEACHER' },
        ],
    },
    {
        id: 't6', teacherId: 'TCH-006', name: 'Suresh Iyer', email: 'suresh.iyer@dps.edu.in',
        phone: '+91 65432 10987', status: 'ACTIVE', joinedAt: '2025-11-01T00:00:00Z',
        assignments: [],
    },
];

const MOCK_STRUCTURE: InstitutionStructure = {
    institutionType: 'SCHOOL',
    levels: [
        {
            id: 'l1-1', name: 'Class 10', code: '10', order: 1,
            children: [
                {
                    id: 'l2-1', name: 'Mathematics', code: 'MATH', order: 1, children: [
                        { id: 'l3-1', name: '10-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 24 },
                        { id: 'l3-2', name: '10-B', code: 'B', capacity: 30, teacherCount: 1, studentCount: 22 },
                    ]
                },
                {
                    id: 'l2-2', name: 'Science', code: 'SCI', order: 2, children: [
                        { id: 'l3-4', name: '10-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 24 },
                    ]
                },
                {
                    id: 'l2-3', name: 'English', code: 'ENG', order: 3, children: [
                        { id: 'l3-6', name: '10-A', code: 'A', capacity: 35, teacherCount: 1, studentCount: 24 },
                    ]
                },
            ],
        },
        {
            id: 'l1-2', name: 'Class 9', code: '9', order: 2,
            children: [
                {
                    id: 'l2-4', name: 'Mathematics', code: 'MATH', order: 1, children: [
                        { id: 'l3-7', name: '9-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 28 },
                    ]
                },
            ],
        },
    ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

const AVATAR_COLORS = [
    { bg: 'bg-violet-100 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300' },
    { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300' },
    { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300' },
    { bg: 'bg-sky-100 dark:bg-sky-950', text: 'text-sky-700 dark:text-sky-300' },
    { bg: 'bg-rose-100 dark:bg-rose-950', text: 'text-rose-700 dark:text-rose-300' },
    { bg: 'bg-teal-100 dark:bg-teal-950', text: 'text-teal-700 dark:text-teal-300' },
];

function getAvatarColor(id: string) {
    const idx = id.charCodeAt(id.length - 1) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
}

// ── Modal state ───────────────────────────────────────────────────────────────
type ModalState =
    | { type: 'closed' }
    | { type: 'add' }
    | { type: 'edit'; teacher: Teacher }
    | { type: 'deactivate'; teacher: Teacher }
    | { type: 'resendInvite'; teacher: Teacher }
    | { type: 'delete'; teacher: Teacher };


// ── Teacher Card ──────────────────────────────────────────────────────────────
function TeacherCard({
    teacher, index, instType, isSubAdmin,
    onEdit, onToggleStatus, onResendInvite, onDelete,
}: {
    teacher: Teacher;
    index: number;
    instType: InstitutionType;
    isSubAdmin: boolean;
    onEdit: (t: Teacher) => void;
    onToggleStatus: (t: Teacher) => void;
    onResendInvite: (t: Teacher) => void;
    onDelete: (t: Teacher) => void;
}) {
    const avatarColor = getAvatarColor(teacher.id);
    const isActive = teacher.status === 'ACTIVE';
    const labels = getStructureLabels(instType);
    const router = useRouter();

    // Group assignments by level1 (Class/Dept/Batch)
    const grouped = teacher.assignments.reduce<Record<string, TeacherAssignment[]>>((acc, a) => {
        const key = a.level1Name;
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
    }, {});

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.28, ease: 'easeOut' }}
            className={`bg-card border rounded-2xl flex flex-col transition-all duration-200 group overflow-hidden
                ${isActive
                    ? 'border-border/50 hover:border-primary/30 hover:shadow-md'
                    : 'border-border/30 opacity-70 hover:opacity-90'
                }`}
        >
            {/* ── Top: Avatar + Name + Status ── */}
            <div className="flex items-start gap-3 p-4 pb-3">
                {/* Avatar — photo ya initials */}
                <div className="w-12 h-12 rounded-xl bg-muted ring-2 ring-border shrink-0 overflow-hidden flex items-center justify-center">
                    {teacher.avatarUrl ? (
                        <NextImage src={teacher.avatarUrl} alt={teacher.name} fill sizes="48px" className="object-cover" />
                    ) : (
                        <span className={`text-base font-bold select-none ${avatarColor.text}`}>
                            {getInitials(teacher.name)}
                        </span>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug truncate pr-1">
                            {teacher.name}
                        </p>
                        {/* Status badge */}
                        {teacher.invitePending ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                Invite Pending
                            </span>
                        ) : (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${isActive
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground'
                                }`}>
                                {isActive ? 'Active' : 'Inactive'}
                            </span>
                        )}
                    </div>

                    {/* Assignment count */}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {teacher.assignments.length > 0
                            ? `${teacher.assignments.length} assignment${teacher.assignments.length > 1 ? 's' : ''}`
                            : 'No assignments yet'
                        }
                    </p>
                </div>
            </div>

            <div className="h-px bg-border/50 mx-4" />

            {/* Details */}
            <div className="px-4 py-3 space-y-2.5 flex-1">
                {([
                    {
                        icon: Hash,
                        label: 'Teacher ID',
                        value: teacher.teacherId
                            ? <span className="font-mono text-[12px] font-semibold tracking-wider" style={{ color: '#DA7756' }}>{teacher.teacherId}</span>
                            : <span className="italic text-muted-foreground/40 text-[11px]">—</span>,
                    },
                    { icon: Mail, label: 'Email', value: teacher.email },
                    { icon: Phone, label: 'Phone', value: teacher.phone ?? '—' },
                    { icon: CalendarDays, label: 'Joined', value: formatDate(teacher.joinedAt) },
                    { icon: Briefcase, label: 'Experience', value: teacher.experience ?? '—' },
                    { icon: MapPin, label: 'Location', value: teacher.city ? `${teacher.city}${teacher.state ? ', ' + teacher.state : ''}` : '—' },
                ] as { icon: React.ElementType; label: string; value: React.ReactNode }[]).map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-2">
                        <Icon size={15} className="shrink-0 text-muted-foreground/60" />
                        <span className="text-[13px] text-muted-foreground w-24 shrink-0">{label}</span>
                        <span className="text-[13px] font-medium truncate">{value}</span>
                    </div>
                ))}

                {/* AI Token usage — coming soon */}
                <div className="pt-2 border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                        <Sparkles size={12} className="text-muted-foreground/60" />
                        <span className="text-[12px] text-muted-foreground">AI Tokens</span>
                        <span className="ml-auto text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">Coming soon</span>
                    </div>
                </div>
            </div>

            {/* ── Assignments ── */}
            {teacher.assignments.length > 0 && (
                <>
                    <div className="h-px bg-border/50 mx-4" />
                    <div className="px-4 py-3 space-y-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <BookOpen size={12} className="text-muted-foreground/60" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                                Assignments
                            </p>
                        </div>
                        {Object.entries(grouped).map(([level1, assignments]) => (
                            <div key={level1}>
                                {/* Level1 label */}
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Layers size={11} className="text-muted-foreground/50 shrink-0" />
                                    <span className="text-[11px] font-semibold text-muted-foreground">{level1}</span>
                                </div>
                                {/* Assignment tags */}
                                <div className="flex flex-wrap gap-1 pl-4">
                                    {assignments.map(a => (
                                        <span
                                            key={a.id}
                                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${a.role === 'CLASS_TEACHER'
                                                ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800'
                                                : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800'
                                                }`}
                                        >
                                            {a.role === 'CLASS_TEACHER'
                                                ? <GraduationCap size={9} />
                                                : <BookOpen size={9} />
                                            }
                                            {a.level2Name} · {a.level3Name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ── Footer buttons ── */}
            <div className="px-4 pb-4 pt-2 flex gap-2 mt-auto">
                <button
                    onClick={() => router.push(`/admin/staff/teachers/${teacher.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border/60 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
                >
                    <Eye size={12} />
                    View Details
                </button>
                {!isSubAdmin && (teacher.invitePending ? (
                    <button
                        onClick={() => onResendInvite(teacher)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30 text-xs font-medium transition-all duration-150"
                    >
                        <MailCheck size={12} />
                        Resend Invite
                    </button>
                ) : (
                    <button
                        onClick={() => onToggleStatus(teacher)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all duration-150 ${isActive
                            ? 'border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30'
                            }`}
                    >
                        {isActive ? <PowerOff size={12} /> : <Power size={12} />}
                        {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                ))}
                {!isSubAdmin && (
                    <button
                        onClick={() => onDelete(teacher)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:bg-red-950/30 transition-all duration-150 shrink-0"
                        title="Permanently delete teacher"
                    >
                        <Trash2 size={13} />
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeachersPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [structure, setStructure] = useState<InstitutionStructure | null>(null);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<ModalState>({ type: 'closed' });
    const [actionLoading, setActionLoading] = useState(false);
    const [search, setSearch] = useState('');
    const { user: authUser } = useAuthStore();
    const isSubAdmin = authUser?.role === 'SUB_ADMIN';

    useEffect(() => {
        let cancelled = false;
        async function fetchData() {
            const [tRes, sRes] = await Promise.allSettled([
                api.get('/admin/teachers'),
                api.get('/admin/structure'),
            ]);
            if (cancelled) return;

            if (tRes.status === 'fulfilled') {
                setTeachers(tRes.value.data.data ?? []);
            } else {
                const err = tRes.reason as { response?: { status?: number; data?: { error?: string } }; message?: string };
                const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to load teachers';
                console.error('[Teachers] fetch failed:', err?.response?.status, err?.response?.data ?? err);
                toast.error(msg);
                setTeachers([]);
            }

            setStructure(sRes.status === 'fulfilled' ? sRes.value.data.data : MOCK_STRUCTURE);
            if (sRes.status === 'rejected') {
                console.error('[Structure] fetch failed:', sRes.reason);
            }

            setLoading(false);
        }
        fetchData();
        return () => { cancelled = true; };
    }, []);

    const { instType: mockInstType } = useMockInstType();
    const instType: InstitutionType = mockInstType ?? structure?.institutionType ?? 'SCHOOL';
    const activeCount = teachers.filter(t => t.status === 'ACTIVE').length;

    const filtered = search.trim()
        ? teachers.filter(t =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.email.toLowerCase().includes(search.toLowerCase())
        )
        : teachers;

    // ── Handlers ──
    const handleAddTeacher = useCallback(async (data: TeacherFormData) => {
        setActionLoading(true);
        try {
            const res = await api.post('/admin/teachers', data);
            setTeachers(prev => [...prev, { ...res.data.data, assignments: res.data.data.assignments ?? [] }]);
            toast.success('Teacher added — invite sent');
            setModal({ type: 'closed' });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to add teacher');
        } finally { setActionLoading(false); }
    }, []);

    const handleEditTeacher = useCallback(async (data: TeacherFormData) => {
        if (modal.type !== 'edit') return;
        setActionLoading(true);
        try {
            const res = await api.patch(`/admin/teachers/${modal.teacher.id}`, data);
            setTeachers(prev => prev.map(t => t.id === modal.teacher.id ? { ...t, ...res.data.data } : t));
            toast.success('Teacher updated');
            setModal({ type: 'closed' });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to update teacher');
        } finally { setActionLoading(false); }
    }, [modal]);

    const handleResendInvite = useCallback(async () => {
        if (modal.type !== 'resendInvite') return;
        setActionLoading(true);
        try {
            await api.post(`/admin/teachers/${modal.teacher.id}/resend-invite`);
            toast.success('Invite resent successfully');
            setModal({ type: 'closed' });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to resend invite');
        } finally { setActionLoading(false); }
    }, [modal]);

    const handleDeleteTeacher = useCallback(async () => {
        if (modal.type !== 'delete') return;
        setActionLoading(true);
        try {
            await api.delete(`/admin/teachers/${modal.teacher.id}`);
            setTeachers(prev => prev.filter(t => t.id !== modal.teacher.id));
            toast.success('Teacher permanently deleted');
            setModal({ type: 'closed' });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to delete teacher');
        } finally { setActionLoading(false); }
    }, [modal]);

    const handleToggleStatus = useCallback(async () => {
        if (modal.type !== 'deactivate') return;
        setActionLoading(true);
        const t = modal.teacher;
        const newStatus = t.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            await api.patch(`/admin/teachers/${t.id}`, { status: newStatus });
            setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, status: newStatus } : x));
            toast.success(newStatus === 'ACTIVE' ? 'Teacher activated' : 'Teacher deactivated');
            setModal({ type: 'closed' });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to update teacher status');
        } finally { setActionLoading(false); }
    }, [modal]);

    // ── Loading ──
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4 px-2">
                {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-64 rounded-2xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col" style={{ height: '100%' }}>

            {/* ── STICKY SECTION ── */}
            <div className="sticky top-0 z-20 bg-background space-y-2 pt-0 pb-0">

                {/* Header row */}
                <div className="flex items-center justify-between pt-0 px-1">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Users size={21} />
                                Teachers
                            </h1>
                            <p className="text-muted-foreground text-[13px]">
                                {activeCount} active · {teachers.length - activeCount} inactive
                            </p>
                        </div>
                    </div>

                    {/* Right — Search + Add */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search teachers..."
                                className="w-56 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        {!isSubAdmin && (
                            <button
                                onClick={() => setModal({ type: 'add' })}
                                className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            >
                                <Plus size={15} />
                                Add New Teacher
                            </button>
                        )}
                    </div>
                </div>

                <div className="h-px bg-border/60" />
            </div>

            {/* ── SCROLLABLE CARDS ── */}
            <div className="flex-1 overflow-y-auto pb-6">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                            <Users size={24} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No teachers found</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Add one using the button above</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 items-start">
                        {filtered.map((teacher, i) => (
                            <TeacherCard
                                key={teacher.id}
                                teacher={teacher}
                                index={i}
                                instType={instType}
                                isSubAdmin={isSubAdmin}
                                onEdit={t => setModal({ type: 'edit', teacher: t })}
                                onToggleStatus={t => setModal({ type: 'deactivate', teacher: t })}
                                onResendInvite={t => setModal({ type: 'resendInvite', teacher: t })}
                                onDelete={t => setModal({ type: 'delete', teacher: t })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Modals ── */}
            <AddTeacherModal
                open={modal.type === 'add' || modal.type === 'edit'}
                onOpenChange={v => !v && setModal({ type: 'closed' })}
                mode={modal.type === 'edit' ? 'edit' : 'create'}
                defaultValues={modal.type === 'edit' ? {
                    name: modal.teacher.name,
                    email: modal.teacher.email,
                    phone: modal.teacher.phone,
                    dob: modal.teacher.dob,
                    gender: modal.teacher.gender,
                    address: modal.teacher.address,
                    city: modal.teacher.city,
                    state: modal.teacher.state,
                    pincode: modal.teacher.pincode,
                    country: modal.teacher.country,
                    qualification: modal.teacher.qualification,
                    experience: modal.teacher.experience,
                } : undefined}
                loading={actionLoading}
                onSubmit={modal.type === 'edit' ? handleEditTeacher : handleAddTeacher}
            />

            <DeleteConfirmDialog
                open={modal.type === 'deactivate'}
                onOpenChange={v => !v && setModal({ type: 'closed' })}
                label={modal.type === 'deactivate' && modal.teacher.status === 'ACTIVE' ? 'Teacher' : 'Teacher'}
                name={modal.type === 'deactivate' ? modal.teacher.name : ''}
                loading={actionLoading}
                onConfirm={handleToggleStatus}
                confirmLabel={modal.type === 'deactivate' && modal.teacher.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                description={
                    modal.type === 'deactivate' && modal.teacher.status === 'ACTIVE'
                        ? 'Teacher will lose access immediately. You can reactivate anytime.'
                        : 'Teacher will regain access to the platform.'
                }
            />

            <DeleteConfirmDialog
                open={modal.type === 'resendInvite'}
                onOpenChange={v => !v && setModal({ type: 'closed' })}
                label="Teacher"
                name={modal.type === 'resendInvite' ? modal.teacher.name : ''}
                loading={actionLoading}
                onConfirm={handleResendInvite}
                confirmLabel="Resend Invite"
                description="A new invite email will be sent. The previous invite link will be invalidated."
            />

            <DeleteConfirmDialog
                open={modal.type === 'delete'}
                onOpenChange={v => !v && setModal({ type: 'closed' })}
                label="Teacher"
                name={modal.type === 'delete' ? modal.teacher.name : ''}
                loading={actionLoading}
                onConfirm={handleDeleteTeacher}
                confirmLabel="Delete"
                description="This will permanently delete the teacher and all their data — assignments, questions, tests, and blackboard content. This cannot be undone."
            />
        </div>
    );
}