'use client';

import { useState, useEffect } from 'react';
import NextImage from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronRight, Hash, Mail, Phone, MapPin,
    Calendar, User, GraduationCap, Briefcase, Edit2,
    Check, X, PowerOff, Power, BookOpen, Layers,
    CheckCircle2, Circle, Tag, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Teacher, InstitutionType } from '@/types';
import { getStructureLabels } from '@/lib/getInstitutionAccent';
import { useMockInstType } from '@/context/MockInstTypeContext';
import api from '@/lib/api';
import { colorForSubject } from '@/lib/subjectColors';
import { formatDisplayName } from '@/lib/displayName';
import { getErrorMessage } from '@/lib/error';
import { formatTokens } from '@/lib/utils';
import { formatINR } from '@/lib/payroll';

type MonthlySalary = { grossPay: number; netPay: number; earnings: { label: string; amount: number }[]; deductions: { label: string; amount: number }[] };

// ── Salary line-item editor (earnings/deductions), shared by the Salary section below ──
interface SalaryLineItem { label: string; amount: number; }
function SalaryLineItemEditor({ items, onChange, label }: { items: SalaryLineItem[]; onChange: (items: SalaryLineItem[]) => void; label: string }) {
    return (
        <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
            {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input
                        className="flex-1 h-8 px-2 rounded-lg border border-border bg-background text-xs"
                        placeholder="Label (e.g. Basic)"
                        value={item.label}
                        onChange={e => onChange(items.map((it, idx) => idx === i ? { ...it, label: e.target.value } : it))}
                    />
                    <input
                        type="number"
                        className="w-24 h-8 px-2 rounded-lg border border-border bg-background text-xs"
                        placeholder="Amount"
                        value={item.amount}
                        onChange={e => onChange(items.map((it, idx) => idx === i ? { ...it, amount: Number(e.target.value) || 0 } : it))}
                    />
                    <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500">
                        <X size={13} />
                    </button>
                </div>
            ))}
            <button
                onClick={() => onChange([...items, { label: '', amount: 0 }])}
                className="text-[11px] font-semibold text-primary flex items-center gap-1"
            >
                <Plus size={11} /> Add line item
            </button>
        </div>
    );
}

// ── Mock teacher data ─────────────────────────────────────────────────────────
const MOCK_TEACHERS: (Teacher & {
    teacherId?: string; dob?: string; gender?: string;
    address?: string; city?: string; state?: string;
    qualification?: string; experience?: string; avatarUrl?: string;
})[] = [
        {
            id: 't1', teacherId: 'TCH-001', name: 'Ritu Sharma',
            email: 'ritu.sharma@dps.edu.in', phone: '+91 98765 43210',
            status: 'ACTIVE', joinedAt: '2025-08-15T00:00:00Z',
            dob: '1990-03-22', gender: 'FEMALE',
            address: '12, Green Park', city: 'New Delhi', state: 'Delhi',
            qualification: 'B.Ed, M.A (Mathematics)', experience: '8 years',
            assignments: [
                { id: 'a1', level1Id: 'l1-1', level1Name: 'Class 10', level2Id: 'l2-1', level2Name: 'Mathematics', level3Id: 'l3-1', level3Name: '10-A', role: 'CLASS_TEACHER' },
                { id: 'a2', level1Id: 'l1-1', level1Name: 'Class 10', level2Id: 'l2-1', level2Name: 'Mathematics', level3Id: 'l3-2', level3Name: '10-B', role: 'SUBJECT_TEACHER' },
            ],
        },
        {
            id: 't2', teacherId: 'TCH-002', name: 'Ankit Verma',
            email: 'ankit.verma@dps.edu.in', status: 'ACTIVE',
            joinedAt: '2025-09-01T00:00:00Z', dob: '1988-07-10', gender: 'MALE',
            city: 'Mumbai', state: 'Maharashtra',
            qualification: 'M.Sc (Physics)', experience: '6 years',
            assignments: [
                { id: 'a3', level1Id: 'l1-1', level1Name: 'Class 10', level2Id: 'l2-2', level2Name: 'Science', level3Id: 'l3-4', level3Name: '10-A', role: 'SUBJECT_TEACHER' },
            ],
        },
        {
            id: 't3', teacherId: 'TCH-003', name: 'Priya Nair',
            email: 'priya.nair@dps.edu.in', phone: '+91 87654 32109',
            status: 'ACTIVE', joinedAt: '2025-07-20T00:00:00Z',
            dob: '1992-11-05', gender: 'FEMALE',
            address: '45, Marine Drive', city: 'Mumbai', state: 'Maharashtra',
            qualification: 'M.A (English)', experience: '5 years',
            assignments: [
                { id: 'a4', level1Id: 'l1-1', level1Name: 'Class 10', level2Id: 'l2-3', level2Name: 'English', level3Id: 'l3-6', level3Name: '10-A', role: 'SUBJECT_TEACHER' },
            ],
        },
        {
            id: 't4', teacherId: 'TCH-004', name: 'Rajesh Kumar',
            email: 'rajesh.k@dps.edu.in', status: 'INACTIVE',
            joinedAt: '2024-06-10T00:00:00Z', gender: 'MALE',
            city: 'Delhi', state: 'Delhi',
            qualification: 'B.Ed', experience: '3 years',
            assignments: [],
        },
        {
            id: 't5', teacherId: 'TCH-005', name: 'Meena Patel',
            email: 'meena.patel@dps.edu.in', phone: '+91 76543 21098',
            status: 'ACTIVE', joinedAt: '2026-01-15T00:00:00Z',
            dob: '1995-02-18', gender: 'FEMALE',
            address: '8, Satellite Road', city: 'Ahmedabad', state: 'Gujarat',
            qualification: 'M.Ed', experience: '4 years',
            assignments: [
                { id: 'a5', level1Id: 'l1-2', level1Name: 'Class 9', level2Id: 'l2-4', level2Name: 'Mathematics', level3Id: 'l3-7', level3Name: '9-A', role: 'CLASS_TEACHER' },
            ],
        },
        {
            id: 't6', teacherId: 'TCH-006', name: 'Suresh Iyer',
            email: 'suresh.iyer@dps.edu.in', phone: '+91 65432 10987',
            status: 'ACTIVE', joinedAt: '2025-11-01T00:00:00Z',
            gender: 'MALE', city: 'Chennai', state: 'Tamil Nadu',
            qualification: 'M.Sc (Chemistry)', experience: '10 years',
            assignments: [],
        },
    ];

const AVATAR_COLORS = [
    { bg: 'bg-violet-100 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300' },
    { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300' },
    { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300' },
    { bg: 'bg-sky-100 dark:bg-sky-950', text: 'text-sky-700 dark:text-sky-300' },
    { bg: 'bg-rose-100 dark:bg-rose-950', text: 'text-rose-700 dark:text-rose-300' },
    { bg: 'bg-teal-100 dark:bg-teal-950', text: 'text-teal-700 dark:text-teal-300' },
];

function getAvatarColor(id: string) {
    return AVATAR_COLORS[id.charCodeAt(id.length - 1) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
}

// ── Verified Badge ────────────────────────────────────────────────────────────
function VerifiedBadge() {
    return (
        <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
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

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ title, children, editBtn, contentClassName = 'px-5 pt-2 pb-5' }: {
    title: React.ReactNode; children: React.ReactNode; editBtn?: React.ReactNode; contentClassName?: string;
}) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden" data-admin-surface="">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/30 min-h-[56px]">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
                {editBtn}
            </div>
            <div className={contentClassName}>{children}</div>
        </div>
    );
}

// ── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: {
    icon: React.ElementType; label: string; value: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
            <Icon size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
            <span className="text-xs font-medium text-foreground flex-1">{value}</span>
        </div>
    );
}

// ── Editable Field ────────────────────────────────────────────────────────────
function EditableField({ label, value, onChange }: {
    label: string; value: string; onChange: (v: string) => void;
}) {
    return (
        <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
            <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all"
            />
        </div>
    );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ teacher, onDeactivateClick, onTeacherUpdate }: {
    teacher: typeof MOCK_TEACHERS[0];
    onDeactivateClick: () => void;
    onTeacherUpdate: (updated: Partial<typeof MOCK_TEACHERS[0]>) => void;
}) {
    const avatarColor = getAvatarColor(teacher.id);
    const isActive = teacher.status === 'ACTIVE';
    const [photoExpanded, setPhotoExpanded] = useState(false);
    const [editingSection, setEditingSection] = useState<string | null>(null);
    // The admin's *explicit* soft limit — null means "never configured".
    // Deliberately NOT seeded from softLimitTokens, which is always non-null
    // (it falls back to a computed even-split default) and would otherwise make
    // every teacher look like they have a limit set.
    const [softLimitOverride, setSoftLimitOverride] = useState<number | null>(null);
    const [softLimitInput, setSoftLimitInput] = useState('0');
    const [showSoftLimit, setShowSoftLimit] = useState(false);
    const hasSoftLimit = softLimitOverride !== null && softLimitOverride > 0;

    const [aiUsage, setAiUsage] = useState<{
        totalTokens: number; institutionPoolLimit: number; institutionPoolUsed: number; poolSharePct: number;
        totalRequests: number; successRequests: number; failedRequests: number;
        softLimitTokens: number | null; softLimitOverride: number | null; isOverSoftLimit: boolean;
    } | null>(null);
    const [aiUsageLoading, setAiUsageLoading] = useState(true);
    // Slider scales to the institution's real pool (never below 10M, so small/trial
    // pools still get a usable range) instead of a flat 10M assumption.
    const softLimitSliderMaxM = Math.max(10, Math.ceil((aiUsage?.institutionPoolLimit ?? 0) / 1_000_000));

    useEffect(() => {
        if (!teacher?.id) return;
        api.get(`/admin/teachers/${teacher.id}/ai-usage`)
            .then(res => {
                setAiUsage(res.data.data);
                setSoftLimitOverride(res.data.data.softLimitOverride ?? null);
            })
            .catch(() => {})
            .finally(() => setAiUsageLoading(false));
    }, [teacher?.id]);

    const [linkedStaff, setLinkedStaff] = useState<{ id: string; monthlySalary: MonthlySalary | null } | null>(null);
    const [staffLoading, setStaffLoading] = useState(true);

    useEffect(() => {
        if (!teacher?.email) return;
        api.get('/admin/payroll/staff')
            .then(res => {
                const all: { id: string; email: string; userId: string | null; monthlySalary: MonthlySalary | null }[] = res.data.data ?? [];
                setLinkedStaff(all.find(s => s.userId === teacher.id) ?? all.find(s => s.email === teacher.email) ?? null);
            })
            .catch(() => setLinkedStaff(null))
            .finally(() => setStaffLoading(false));
    }, [teacher?.email]);

    const [personalDraft, setPersonalDraft] = useState({
        name: teacher.name, dob: teacher.dob ?? '', gender: teacher.gender ?? '',
    });
    const [personalSaved, setPersonalSaved] = useState({ ...personalDraft });
    const prefix = teacher.prefix ?? '';

    const TITLE_OPTIONS = ['Teacher', 'Professor', 'Asst. Teacher', 'Lecturer', 'HOD', 'Mentor', 'Tutor', 'Educator'];
    const [titleDraft, setTitleDraft] = useState(teacher.title ?? 'Teacher');
    const [titleSaved, setTitleSaved] = useState(teacher.title ?? 'Teacher');

    const [contactDraft, setContactDraft] = useState({
        email: teacher.email, phone: teacher.phone ?? '',
        address: teacher.address ?? '', city: teacher.city ?? '', state: teacher.state ?? '',
        pincode: teacher.pincode ?? '', country: teacher.country ?? '',
    });
    const [contactSaved, setContactSaved] = useState({ ...contactDraft });

    const [profDraft, setProfDraft] = useState({
        qualification: teacher.qualification ?? '', experience: teacher.experience ?? '',
    });
    const [profSaved, setProfSaved] = useState({ ...profDraft });

    const cancelEdit = (s: string) => {
        if (s === 'personal') { setPersonalDraft({ ...personalSaved }); setTitleDraft(titleSaved); }
        if (s === 'contact') setContactDraft({ ...contactSaved });
        if (s === 'prof') setProfDraft({ ...profSaved });
        setEditingSection(null);
    };

    const saveEdit = async (s: string) => {
        let payload: Record<string, string> = {};
        if (s === 'personal') payload = { name: personalDraft.name, dob: personalDraft.dob, gender: personalDraft.gender };
        if (s === 'contact') payload = { phone: contactDraft.phone, address: contactDraft.address, city: contactDraft.city, state: contactDraft.state, pincode: contactDraft.pincode, country: contactDraft.country };
        if (s === 'prof') payload = { qualification: profDraft.qualification, experience: profDraft.experience };
        try {
            await api.patch(`/admin/teachers/${teacher.id}`, payload);
            if (s === 'personal') { setPersonalSaved({ ...personalDraft }); setTitleSaved(titleDraft); onTeacherUpdate({ name: personalDraft.name, dob: personalDraft.dob, gender: personalDraft.gender }); }
            if (s === 'contact') { setContactSaved({ ...contactDraft }); onTeacherUpdate({ phone: contactDraft.phone, address: contactDraft.address, city: contactDraft.city, state: contactDraft.state, pincode: contactDraft.pincode, country: contactDraft.country }); }
            if (s === 'prof') { setProfSaved({ ...profDraft }); onTeacherUpdate({ qualification: profDraft.qualification, experience: profDraft.experience }); }
            setEditingSection(null);
            toast.success('Changes saved');
        } catch {
            toast.error('Failed to save changes');
        }
    };

    const editBtns = (s: string) => editingSection === s ? (
        <div className="flex gap-1.5">
            <button onClick={() => cancelEdit(s)}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:opacity-80 transition-all">
                <X size={11} /> Cancel
            </button>
            <button onClick={() => saveEdit(s)}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                <Check size={11} /> Save
            </button>
        </div>
    ) : (
        <button onClick={() => setEditingSection(s)}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
            <Edit2 size={11} /> Edit
        </button>
    );

    const grouped = teacher.assignments.reduce<Record<string, typeof teacher.assignments>>((acc, a) => {
        if (!acc[a.level1Name]) acc[a.level1Name] = [];
        acc[a.level1Name].push(a);
        return acc;
    }, {});


    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">

            {/* Header card */}
            <div className="bg-card border border-border/50 rounded-2xl p-5" data-admin-surface="">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Avatar */}
                    <div
                        className={`relative w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-xl font-bold shrink-0 ${teacher.avatarUrl ? 'cursor-pointer' : `${avatarColor.bg} ${avatarColor.text}`}`}
                        onClick={() => teacher.avatarUrl && setPhotoExpanded(true)}
                    >
                        {teacher.avatarUrl
                            ? <NextImage src={teacher.avatarUrl} alt={teacher.name} fill sizes="160px" quality={100} className="object-cover" />
                            : getInitials(teacher.name)
                        }
                    </div>

                    {/* Photo expand modal */}
                    <AnimatePresence>
                        {photoExpanded && teacher.avatarUrl && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                                onClick={() => setPhotoExpanded(false)}
                            >
                                <motion.div
                                    initial={{ scale: 0.85, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.85, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                    className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <img src={teacher.avatarUrl} alt={teacher.name} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => setPhotoExpanded(false)}
                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                                        <X size={14} className="text-white" />
                                    </button>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold leading-tight">
                                    {prefix && <span className="mr-1" style={{ color: '#DA7756' }}>{prefix}</span>}
                                    {personalSaved.name}
                                </h2>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <p className="text-[11px] text-muted-foreground">{titleSaved}</p>
                                    <VerifiedBadge />
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {teacher.teacherId && (
                                        <span className="font-mono text-[12px] font-semibold tracking-wider" style={{ color: '#DA7756' }}>
                                            {teacher.teacherId}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={onDeactivateClick}
                                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all shrink-0 ${isActive
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400'
                                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400'
                                    }`}
                            >
                                {isActive ? <><PowerOff size={13} /> Deactivate</> : <><Power size={13} /> Activate</>}
                            </button>
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center flex-wrap gap-4 mt-3 pt-3 border-t border-border/50">
                            {[
                                { label: 'Assignments', value: teacher.assignments.length },
                                { label: 'Joined', value: formatDate(teacher.joinedAt) },
                                { label: 'Experience', value: profSaved.experience || '—' },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <p className="text-sm font-bold leading-tight">{value}</p>
                                    <p className="text-[11px] text-muted-foreground">{label}</p>
                                </div>
                            ))}
                            <span className={`ml-auto text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${isActive
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground'
                                }`}>
                                {isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Personal Info */}
                <SectionCard title="Personal Info" editBtn={editBtns('personal')}>
                    {editingSection === 'personal' ? (
                        <>
                            <EditableField label="Full Name" value={personalDraft.name} onChange={v => setPersonalDraft(d => ({ ...d, name: v }))} />
                            <EditableField label="Date of Birth" value={personalDraft.dob} onChange={v => setPersonalDraft(d => ({ ...d, dob: v }))} />
                            {/* Gender dropdown */}
                            <div className="flex items-center gap-3 py-2 border-b border-border/40">
                                <span className="text-xs text-muted-foreground w-28 shrink-0">Gender</span>
                                <div className="flex gap-2">
                                    {[{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }, { value: 'OTHER', label: 'Other' }].map(opt => (
                                        <button key={opt.value} type="button"
                                            onClick={() => setPersonalDraft(d => ({ ...d, gender: opt.value }))}
                                            className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
                                                personalDraft.gender === opt.value
                                                    ? 'border-transparent text-white'
                                                    : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                                            }`}
                                            style={personalDraft.gender === opt.value ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Display Title chooser */}
                            <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
                                <Tag size={14} className="text-muted-foreground shrink-0 mt-1" />
                                <span className="text-xs text-muted-foreground w-28 shrink-0 mt-0.5">Display Title</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {TITLE_OPTIONS.map(opt => (
                                        <button key={opt} type="button" onClick={() => setTitleDraft(opt)}
                                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                                                titleDraft === opt
                                                    ? 'border-transparent text-white'
                                                    : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-transparent'
                                            }`}
                                            style={titleDraft === opt ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}>
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <InfoRow icon={Hash} label="Teacher ID" value={
                                teacher.teacherId
                                    ? <span className="font-mono text-xs font-semibold tracking-wider" style={{ color: '#DA7756' }}>{teacher.teacherId}</span>
                                    : '—'
                            } />
                            <InfoRow icon={User} label="Full Name" value={
                                <span>{prefix && <span className="font-semibold mr-1" style={{ color: '#DA7756' }}>{prefix}</span>}{personalSaved.name}</span>
                            } />
                            <InfoRow icon={Tag} label="Display Title" value={
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(218,119,86,0.12)', color: '#DA7756' }}>
                                    {titleSaved}
                                </span>
                            } />
                            <InfoRow icon={Calendar} label="Date of Birth" value={personalSaved.dob ? formatDate(personalSaved.dob) : '—'} />
                            <InfoRow icon={User} label="Gender" value={
                                personalSaved.gender === 'MALE' ? 'Male'
                                    : personalSaved.gender === 'FEMALE' ? 'Female'
                                        : personalSaved.gender || '—'
                            } />
                            <InfoRow icon={Calendar} label="Joined" value={formatDate(teacher.joinedAt)} />
                        </>
                    )}
                </SectionCard>

                {/* AI Tokens */}
                <SectionCard title="AI Token Usage" contentClassName="p-5">
                    <div className="space-y-3">

                        {/* Teacher usage */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-xs font-semibold">{formatDisplayName(teacher.name, teacher.prefix)}&apos;s usage · this month</p>
                                <span className="text-xs font-bold">
                                    {aiUsageLoading ? '…' : formatTokens(aiUsage?.totalTokens ?? 0)}
                                    <span className="text-muted-foreground font-normal"> / {formatTokens(aiUsage?.institutionPoolLimit ?? 0)} pool</span>
                                </span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(aiUsage?.poolSharePct ?? 0, 100)}%`, background: '#7C3AED' }} />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">{aiUsageLoading ? '…' : aiUsage?.poolSharePct ?? 0}% of institution pool</p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="bg-muted/40 rounded-xl p-3 text-center" data-admin-surface="">
                                <p className="text-sm font-bold">{aiUsageLoading ? '…' : formatTokens(aiUsage?.totalTokens ?? 0)}</p>
                                <p className="text-[10px] text-muted-foreground">Used</p>
                            </div>
                            <div className="bg-muted/40 rounded-xl p-3 text-center" data-admin-surface="">
                                <p className="text-sm font-bold">{aiUsageLoading ? '…' : formatTokens(Math.max(0, (aiUsage?.institutionPoolLimit ?? 0) - (aiUsage?.totalTokens ?? 0)), 2)}</p>
                                <p className="text-[10px] text-muted-foreground">Remaining</p>
                            </div>
                            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(124,58,237,0.08)' }}>
                                <p className="text-sm font-bold" style={{ color: '#7C3AED' }}>{aiUsageLoading ? '…' : `${aiUsage?.poolSharePct ?? 0}%`}</p>
                                <p className="text-[10px] text-muted-foreground">Pool share</p>
                            </div>
                        </div>

                        {/* Institution pool */}
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-3" data-admin-surface="">
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[11px] font-semibold text-muted-foreground">Institution pool</p>
                                <span className="text-[11px] font-semibold">
                                    {aiUsageLoading ? '…' : formatTokens(aiUsage?.institutionPoolUsed ?? 0)}
                                    <span className="font-normal text-muted-foreground"> / {formatTokens(aiUsage?.institutionPoolLimit ?? 0)} used</span>
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{
                                    width: `${aiUsage?.institutionPoolLimit ? Math.min(100, Math.round((aiUsage.institutionPoolUsed / aiUsage.institutionPoolLimit) * 100)) : 0}%`,
                                    background: '#DA7756',
                                }} />
                            </div>
                            {/* No reset-timing claim here: the pool counter is a
                                running total and there is no monthly reset job. */}
                            <p className="text-[11px] text-muted-foreground mt-1">Shared across all teachers</p>
                        </div>

                        {/* Soft Limit */}
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2.5" data-admin-surface="">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold">Soft Limit</p>
                                    <p className="text-[10px] text-muted-foreground">Optional max tokens for this teacher</p>
                                </div>
                                <button
                                    onClick={() => setShowSoftLimit(v => !v)}
                                    className="text-[11px] font-semibold text-primary hover:opacity-75 transition-opacity"
                                >
                                    {hasSoftLimit ? 'Edit' : 'Set limit'}
                                </button>
                            </div>

                            {showSoftLimit && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={0}
                                            max={softLimitSliderMaxM}
                                            step={0.1}
                                            value={softLimitInput}
                                            onChange={e => setSoftLimitInput(e.target.value)}
                                            className="flex-1 accent-[#7C3AED] h-1.5 cursor-pointer"
                                        />
                                        <span className="text-sm font-bold w-14 text-right" style={{ color: '#7C3AED' }}>
                                            {softLimitInput || 0}M
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] text-muted-foreground">0M — {softLimitSliderMaxM}M (pool limit)</p>
                                        <button
                                            onClick={async () => {
                                                const tokens = Number(softLimitInput) * 1_000_000;
                                                try {
                                                    await api.patch(`/admin/teachers/${teacher.id}/ai-soft-limit`, { softLimitTokens: tokens });
                                                    setSoftLimitOverride(tokens);
                                                    setShowSoftLimit(false);
                                                    toast.success(`Soft limit set to ${softLimitInput}M tokens`);
                                                } catch (err: unknown) {
                                                    toast.error(getErrorMessage(err, 'Failed to set soft limit'));
                                                }
                                            }}
                                            disabled={!softLimitInput || Number(softLimitInput) === 0}
                                            className="h-7 px-3 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                        >
                                            Set
                                        </button>
                                    </div>
                                </div>
                            )}

                            {hasSoftLimit && !showSoftLimit && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-muted-foreground">{formatTokens(aiUsage?.totalTokens ?? 0)} used of {formatTokens(softLimitOverride!)} limit</span>
                                        <span className="font-semibold" style={{ color: (aiUsage?.totalTokens ?? 0) > softLimitOverride! * 0.8 ? '#DA7756' : '#7C3AED' }}>
                                            {Math.round(((aiUsage?.totalTokens ?? 0) / softLimitOverride!) * 100)}%
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${Math.min(100, Math.round(((aiUsage?.totalTokens ?? 0) / softLimitOverride!) * 100))}%`,
                                                background: (aiUsage?.totalTokens ?? 0) > softLimitOverride! * 0.8 ? '#DA7756' : '#7C3AED'
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await api.patch(`/admin/teachers/${teacher.id}/ai-soft-limit`, { softLimitTokens: null });
                                                    setSoftLimitOverride(null);
                                                    setSoftLimitInput('');
                                                    toast.success('Soft limit removed');
                                                } catch (err: unknown) {
                                                    toast.error(getErrorMessage(err, 'Failed to remove soft limit'));
                                                }
                                            }}
                                            className="text-[10px] text-red-500 hover:opacity-75 transition-opacity"
                                        >
                                            Remove limit
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!hasSoftLimit && !showSoftLimit && (
                                <p className="text-[11px] text-muted-foreground">No limit set — uses from shared pool freely</p>
                            )}
                        </div>

                    </div>
                </SectionCard>

                {/* Salary */}
                <SectionCard title="Salary" contentClassName="p-5">
                    {staffLoading ? (
                        <div className="h-16 rounded-xl bg-muted/40 animate-pulse" />
                    ) : linkedStaff?.monthlySalary ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <p className="text-muted-foreground mb-1">Earnings</p>
                                    {linkedStaff.monthlySalary.earnings.map((e, i) => (
                                        <p key={i} className="flex justify-between gap-2"><span>{e.label}</span><span className="font-medium">{formatINR(e.amount)}</span></p>
                                    ))}
                                </div>
                                <div>
                                    <p className="text-muted-foreground mb-1">Deductions</p>
                                    {linkedStaff.monthlySalary.deductions.length === 0
                                        ? <p className="text-muted-foreground/60">None</p>
                                        : linkedStaff.monthlySalary.deductions.map((d, i) => (
                                            <p key={i} className="flex justify-between gap-2"><span>{d.label}</span><span className="font-medium">{formatINR(d.amount)}</span></p>
                                        ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/15 px-3 py-2 text-xs">
                                <span className="text-muted-foreground">Take-home / month</span>
                                <span className="font-bold text-primary">{formatINR(linkedStaff.monthlySalary.netPay)}</span>
                            </div>
                            <a href="/admin/payroll/staff" className="text-xs font-semibold text-primary">Manage in Staff Payroll →</a>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">No salary assigned yet</p>
                            <a href="/admin/payroll/staff" className="text-xs font-semibold text-primary">Assign in Staff Payroll →</a>
                        </div>
                    )}
                </SectionCard>

                {/* Professional */}
                <SectionCard title="Professional Details" editBtn={editBtns('prof')}>
                    {editingSection === 'prof' ? (
                        <>
                            <EditableField label="Qualification" value={profDraft.qualification} onChange={v => setProfDraft(d => ({ ...d, qualification: v }))} />
                            <EditableField label="Experience" value={profDraft.experience} onChange={v => setProfDraft(d => ({ ...d, experience: v }))} />
                        </>
                    ) : (
                        <>
                            <InfoRow icon={GraduationCap} label="Qualification" value={profSaved.qualification || '—'} />
                            <InfoRow icon={Briefcase} label="Experience" value={profSaved.experience || '—'} />
                        </>
                    )}
                </SectionCard>


                {/* Contact */}
                <SectionCard title="Contact Details" editBtn={editBtns('contact')}>
                    {editingSection === 'contact' ? (
                        <>
                            <EditableField label="Phone" value={contactDraft.phone} onChange={v => setContactDraft(d => ({ ...d, phone: v }))} />
                            <EditableField label="Address" value={contactDraft.address} onChange={v => setContactDraft(d => ({ ...d, address: v }))} />
                            <EditableField label="City" value={contactDraft.city} onChange={v => setContactDraft(d => ({ ...d, city: v }))} />
                            <EditableField label="State" value={contactDraft.state} onChange={v => setContactDraft(d => ({ ...d, state: v }))} />
                            <EditableField label="Pincode" value={contactDraft.pincode} onChange={v => setContactDraft(d => ({ ...d, pincode: v }))} />
                            <EditableField label="Country" value={contactDraft.country} onChange={v => setContactDraft(d => ({ ...d, country: v }))} />
                        </>
                    ) : (
                        <>
                            <InfoRow icon={Mail} label="Email" value={contactSaved.email} />
                            <InfoRow icon={Phone} label="Phone" value={contactSaved.phone || '—'} />
                            <InfoRow icon={MapPin} label="Address" value={contactSaved.address || '—'} />
                            <InfoRow icon={MapPin} label="City" value={contactSaved.city || '—'} />
                            <InfoRow icon={MapPin} label="State" value={contactSaved.state || '—'} />
                            <InfoRow icon={MapPin} label="Pincode" value={contactSaved.pincode || '—'} />
                            <InfoRow icon={MapPin} label="Country" value={contactSaved.country || '—'} />
                        </>
                    )}
                </SectionCard>


            </div>

            <SectionCard title={`Assignments (${teacher.assignments.length})`} contentClassName="p-5">
                {teacher.assignments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                            <BookOpen size={20} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No assignments yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            Go to Structure to assign classes & subjects
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                        {Object.entries(grouped).map(([level1, assignments]) => (
                            <div key={level1}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Layers size={13} className="text-muted-foreground" />
                                    <p className="text-xs font-semibold text-muted-foreground">{level1}</p>
                                </div>
                                <div className="space-y-1.5 pl-4">
                                    {assignments.map(a => {
                                        const subjectColor = a.role === 'SUBJECT_TEACHER'
                                            ? colorForSubject({ id: a.level3Id, color: a.subjectColor })
                                            : null;
                                        return (
                                            <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border/50 bg-muted/20" data-admin-surface="">
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${a.role === 'CLASS_TEACHER' ? 'bg-amber-100 dark:bg-amber-950' : ''}`}
                                                    style={subjectColor ? { background: subjectColor + '20' } : undefined}>
                                                    {a.role === 'CLASS_TEACHER'
                                                        ? <GraduationCap size={12} className="text-amber-700 dark:text-amber-300" />
                                                        : <BookOpen size={12} style={{ color: subjectColor ?? undefined }} />
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold">{a.level2Name} · {a.level3Name}</p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {a.role === 'CLASS_TEACHER' ? 'Class Teacher' : 'Subject Teacher'}
                                                    </p>
                                                </div>
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.role === 'CLASS_TEACHER' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : ''}`}
                                                    style={subjectColor ? { background: subjectColor + '20', color: subjectColor } : undefined}>
                                                    {a.role === 'CLASS_TEACHER' ? 'Class Teacher' : 'Subject Teacher'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>
        </motion.div>
    );
}


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [teacher, setTeacher] = useState<typeof MOCK_TEACHERS[0] | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirmToggle, setConfirmToggle] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function fetchTeacher() {
            try {
                const res = await api.get(`/admin/teachers/${id}`);
                if (!cancelled) setTeacher(res.data.data);
            } catch (err: unknown) {
                const e = err as { response?: { status?: number; data?: { error?: string } }; message?: string };
                console.error('[Teacher detail] fetch failed:', e?.response?.status, e?.response?.data ?? e);
                if (!cancelled) {
                    const msg = e?.response?.data?.error ?? e?.message ?? 'Failed to load teacher';
                    toast.error(msg);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchTeacher();
        return () => { cancelled = true; };
    }, [id]);

    const handleToggleStatus = async () => {
        if (!teacher) return;
        const newStatus = teacher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            await api.patch(`/admin/teachers/${teacher.id}`, { status: newStatus });
            setTeacher(prev => prev ? { ...prev, status: newStatus } : prev);
            toast.success(newStatus === 'ACTIVE' ? 'Teacher activated' : 'Teacher deactivated');
        } catch {
            toast.error('Failed to update teacher status');
        }
        setConfirmToggle(false);
    };

    if (loading) return (
        <div className="space-y-4 animate-pulse">
            <div className="h-8 w-48 bg-muted rounded-xl" />
            <div className="h-36 w-full bg-muted rounded-2xl" data-admin-surface="" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-48 bg-muted rounded-2xl" />
                <div className="h-48 bg-muted rounded-2xl" />
            </div>
        </div>
    );

    if (!teacher) return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <User size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Teacher not found</p>
            <button onClick={() => router.back()} className="mt-3 text-xs text-primary hover:underline">
                Go back
            </button>
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            {/* Back + breadcrumb — sticky */}
            <div className="sticky top-0 z-20 bg-background px-2 pt-1 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()}
                        className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all shrink-0">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">{formatDisplayName(teacher.name, teacher.prefix)}</h1>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Teachers <ChevronRight /> {formatDisplayName(teacher.name, teacher.prefix)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-1 pb-2">
                <ProfileTab
                    teacher={teacher}
                    onDeactivateClick={() => setConfirmToggle(true)}
                    onTeacherUpdate={(updated) => setTeacher(prev => prev ? { ...prev, ...updated } : prev)}
                />

            {confirmToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" data-admin-surface=""
                    >
                        <h3 className="text-base font-bold mb-2">
                            {teacher.status === 'ACTIVE' ? '⚠️ Deactivate Teacher?' : '✅ Activate Teacher?'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-5">
                            {teacher.status === 'ACTIVE'
                                ? `${formatDisplayName(teacher.name, teacher.prefix)} will lose access immediately. All assignments will be preserved.`
                                : `${formatDisplayName(teacher.name, teacher.prefix)} will regain access to the platform.`
                            }
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setConfirmToggle(false)}
                                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleToggleStatus}
                                className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                                style={{ background: teacher.status === 'ACTIVE' ? '#ef4444' : '#10b981' }}
                            >
                                {teacher.status === 'ACTIVE' ? 'Yes, Deactivate' : 'Yes, Activate'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
            </div>
        </div>
    );
}
