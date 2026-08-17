
'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hash, Mail, Phone, MapPin, Calendar, User,
    GraduationCap, Briefcase, Edit2, Check, X,
    BookOpen, Camera, Tag, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatTokens } from '@/lib/utils';
import { useUserAvatarStore } from '@/store/userAvatarStore';
import { useUserTitleStore } from '@/store/userTitleStore';
import { useAuthStore } from '@/store/authStore';
import NextImage from 'next/image';

// ── Types ─────────────────────────────────────────────────────────────────────
interface TeacherAssignment {
    id: string;
    level1Name: string;
    level2Name: string;
    level3Name: string;
    role: 'CLASS_TEACHER' | 'SUBJECT_TEACHER';
}

interface TeacherData {
    id: string;
    teacherId: string;
    avatarUrl: string | null;
    phone: string | null;
    dob: string | null;
    gender: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country: string | null;
    qualification: string | null;
    experience: string | null;
    prefix: string | null;
    title: string | null;
    status: string;
    joinedAt: string;
    user: { id: string; name: string; email: string };
    assignments: TeacherAssignment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
    { bg: 'bg-[var(--muted)]', text: 'text-[var(--primary)]' },
    { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300' },
    { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300' },
    { bg: 'bg-sky-100 dark:bg-sky-950', text: 'text-sky-700 dark:text-sky-300' },
    { bg: 'bg-rose-100 dark:bg-rose-950', text: 'text-rose-700 dark:text-rose-300' },
];
function getAvatarColor(id: string) {
    return AVATAR_COLORS[id.charCodeAt(id.length - 1) % AVATAR_COLORS.length];
}
function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
const PHONE_CODES = [
    { code: '+91', flag: '🇮🇳', max: 10 },
    { code: '+1',  flag: '🇺🇸', max: 10 },
    { code: '+44', flag: '🇬🇧', max: 10 },
    { code: '+61', flag: '🇦🇺', max: 9  },
    { code: '+971',flag: '🇦🇪', max: 9  },
    { code: '+65', flag: '🇸🇬', max: 8  },
];

function parsePhone(val: string) {
    const match = (val ?? '').match(/^(\+\d+)\s*(.*)$/);
    return match ? { code: match[1], number: match[2] } : { code: '+91', number: val ?? '' };
}

function PhoneEditField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const { code, number } = parsePhone(value);
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (btnRef.current && !btnRef.current.contains(e.target as Node) &&
                dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onScroll = (e: Event) => { if (dropRef.current && dropRef.current.contains(e.target as Node)) return; setOpen(false); };
        document.addEventListener('mousedown', close);
        window.addEventListener('scroll', onScroll, true);
        return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', onScroll, true); };
    }, [open]);

    return (
        <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
            <span className="text-xs text-muted-foreground w-28 shrink-0">Phone</span>
            <div className="flex gap-1.5 flex-1">
                <div className="shrink-0">
                    <button ref={btnRef} type="button" onClick={() => { if (!open && btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: r.left }); } setOpen(v => !v); }}
                        className="h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs flex items-center gap-1 whitespace-nowrap hover:bg-primary/10 transition-all">
                        {code} <ChevronRight size={10} className="text-muted-foreground rotate-90" />
                    </button>
                    {open && typeof document !== 'undefined' && createPortal(
                        <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}
                            className="bg-card border border-border rounded-xl shadow-xl py-1 min-w-[130px] max-h-[108px] overflow-y-auto">
                            {PHONE_CODES.map(c => (
                                <button key={c.code} type="button"
                                    onClick={() => { onChange(`${c.code} ${number}`); setOpen(false); }}
                                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors ${code === c.code ? 'text-primary font-semibold' : 'text-foreground'}`}>
                                    {c.flag} {c.code}
                                </button>
                            ))}
                        </div>, document.body
                    )}
                </div>
                <input value={number}
                    onChange={e => { const raw = e.target.value; const max = PHONE_CODES.find(c => c.code === code)?.max ?? 10; if (raw.replace(/\D/g, '').length <= max) onChange(`${code} ${raw}`); }}
                    placeholder="98765 43210"
                    className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 placeholder:font-normal" />
            </div>
        </div>
    );
}

function formatDob(raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return digits;
}

function formatDate(iso?: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
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
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 min-h-[60px] border-b border-border/50 bg-muted/30">
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
function EditableField({ label, value, onChange, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
            <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
            <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 placeholder:font-normal" />
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherProfilePage() {
    const [teacher, setTeacher] = useState<TeacherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [photoExpanded, setPhotoExpanded] = useState(false);
    const setUserAvatarUrl = useUserAvatarStore(s => s.setAvatarUrl);
    const setUserTitle = useUserTitleStore(s => s.setTitle);
    const setUserPrefix = useUserTitleStore(s => s.setPrefix);
    const { user, setUser } = useAuthStore();
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const [editingSection, setEditingSection] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const TITLE_OPTIONS = ['Teacher', 'Professor', 'Asst. Teacher', 'Lecturer', 'HOD', 'Mentor', 'Tutor', 'Educator'];
    const [titleDraft, setTitleDraft] = useState('Teacher');
    const [titleSaved, setTitleSaved] = useState('Teacher');
    const [prefixDraft, setPrefixDraft] = useState('');
    const [prefixSaved, setPrefixSaved] = useState('');
    const PREFIX_OPTIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.', 'Er.', 'CA', 'Adv.'];

    const [personalDraft, setPersonalDraft] = useState({ name: '', dob: '', gender: '' });
    const [personalSaved, setPersonalSaved] = useState({ name: '', dob: '', gender: '' });
    const [contactDraft, setContactDraft] = useState({ phone: '', address: '', city: '', state: '', pincode: '', country: '' });
    const [contactSaved, setContactSaved] = useState({ phone: '', address: '', city: '', state: '', pincode: '', country: '' });
    const [profDraft, setProfDraft] = useState({ qualification: '', experience: '' });
    const [profSaved, setProfSaved] = useState({ qualification: '', experience: '' });

    const [aiUsage, setAiUsage] = useState<{
        totalTokens: number; institutionPoolLimit: number; institutionPoolUsed: number; poolSharePct: number;
    } | null>(null);
    const [aiUsageLoading, setAiUsageLoading] = useState(true);

    useEffect(() => {
        api.get('/teacher/me')
            .then(res => {
                const d = res.data.data;
                // Map divisionAssignments → assignments
                const assignments: TeacherAssignment[] = (d.assignments ?? []).map((a: {
                    id: string;
                    division: { name: string; standard: { name: string } };
                    subject: { name: string } | null;
                }) => ({
                    id: a.id,
                    level1Name: a.division.standard.name,
                    level2Name: a.subject?.name ?? '',
                    level3Name: a.division.name,
                    role: a.subject ? 'SUBJECT_TEACHER' : 'CLASS_TEACHER',
                }));
                const t: TeacherData = { ...d, assignments };
                setTeacher(t);
                setAvatarUrl(d.avatarUrl ?? null);
                setUserAvatarUrl(d.avatarUrl ?? null);

                const savedPrefix = d.prefix ?? (d.gender === 'MALE' ? 'Mr.' : d.gender === 'FEMALE' ? 'Ms.' : '');
                setPrefixDraft(savedPrefix); setPrefixSaved(savedPrefix);

                const savedTitle = d.title ?? 'Teacher';
                setTitleDraft(savedTitle); setTitleSaved(savedTitle);

                const personal = { name: d.user?.name ?? '', dob: (d.dob ?? '').slice(0, 10), gender: d.gender ?? '' };
                setPersonalDraft(personal); setPersonalSaved(personal);
                const contact = {
                    phone: d.phone ?? '', address: d.address ?? '',
                    city: d.city ?? '', state: d.state ?? '',
                    pincode: d.pincode ?? '', country: d.country ?? '',
                };
                setContactDraft(contact); setContactSaved(contact);
                const prof = { qualification: d.qualification ?? '', experience: d.experience ?? '' };
                setProfDraft(prof); setProfSaved(prof);
            })
            .catch(() => toast.error('Failed to load profile'))
            .finally(() => setLoading(false));

        api.get('/teacher/ai-usage')
            .then(res => setAiUsage(res.data.data))
            .catch(() => setAiUsage(null))
            .finally(() => setAiUsageLoading(false));
    }, []);

    const handlePhotoChange = async (file: File) => {
        setUploadingPhoto(true);
        try {
            const form = new FormData();
            form.append('photo', file);
            const res = await api.post('/teacher/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setAvatarUrl(res.data.data.avatarUrl);
            setUserAvatarUrl(res.data.data.avatarUrl);
            toast.success('Photo updated!');
        } catch {
            toast.error('Failed to upload photo');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const cancelEdit = (s: string) => {
        if (s === 'personal') { setPersonalDraft({ ...personalSaved }); setTitleDraft(titleSaved); setPrefixDraft(prefixSaved); }
        if (s === 'contact') setContactDraft({ ...contactSaved });
        if (s === 'prof') setProfDraft({ ...profSaved });
        setEditingSection(null);
    };

    const saveEdit = async (s: string) => {
        setSaving(true);
        try {
            if (s === 'personal') {
                await api.patch('/teacher/me', {
                    name: personalDraft.name || undefined,
                    dob: personalDraft.dob || null,
                    gender: personalDraft.gender || null,
                    prefix: prefixDraft || null,
                    title: titleDraft || null,
                });
                setPersonalSaved({ ...personalDraft });
                setTitleSaved(titleDraft);
                setUserTitle(titleDraft || null);
                setPrefixSaved(prefixDraft);
                setUserPrefix(prefixDraft || null);
                if (personalDraft.name && user && personalDraft.name !== user.name) {
                    setUser({ ...user, name: personalDraft.name });
                }
            }
            if (s === 'contact') {
                await api.patch('/teacher/me', {
                    phone: contactDraft.phone || null,
                    address: contactDraft.address || null,
                    city: contactDraft.city || null,
                    state: contactDraft.state || null,
                    pincode: contactDraft.pincode || null,
                    country: contactDraft.country || null,
                });
                setContactSaved({ ...contactDraft });
            }
            if (s === 'prof') {
                await api.patch('/teacher/me', {
                    qualification: profDraft.qualification || null,
                    experience: profDraft.experience || null,
                });
                setProfSaved({ ...profDraft });
            }
            setEditingSection(null);
            toast.success('Changes saved');
        } catch {
            toast.error('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const editBtns = (s: string) => editingSection === s ? (
        <div className="flex gap-1.5">
            <button onClick={() => cancelEdit(s)}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:opacity-80 transition-all">
                <X size={11} /> Cancel
            </button>
            <button onClick={() => saveEdit(s)} disabled={saving}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-90 transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                {saving ? <span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" /> : <Check size={11} />}
                {saving ? 'Saving…' : 'Save'}
            </button>
        </div>
    ) : (
        <button onClick={() => setEditingSection(s)}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
            <Edit2 size={11} /> Edit
        </button>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!teacher) {
        return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Failed to load profile
            </div>
        );
    }

    const avatarColor = getAvatarColor(teacher.id);

    return (
        <div className="space-y-2 pt-0 px-1 pb-2 overflow-y-auto h-full">

            {/* Header */}
            <div className="sticky top-0 z-20 bg-background pb-0 shrink-0">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <User size={21} /> My Profile
                </h1>
                <p className="text-[13px] text-muted-foreground">View and manage your profile details</p>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                className="space-y-4">

                {/* Header Card */}
                <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                        <div className="relative">
                            <div
                                className={`relative w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${avatarColor.bg} ${avatarColor.text} overflow-hidden ${avatarUrl ? 'cursor-pointer' : 'cursor-pointer'}`}
                                onClick={() => { if (avatarUrl) setPhotoExpanded(true); else if (!uploadingPhoto) fileRef.current?.click(); }}
                            >
                                {uploadingPhoto ? (
                                    <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                ) : avatarUrl ? (
                                    <NextImage src={avatarUrl} alt={teacher.user.name} fill sizes="160px" className="object-cover" />
                                ) : (
                                    getInitials(teacher.user.name)
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center shadow-sm cursor-pointer"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                onClick={() => !uploadingPhoto && fileRef.current?.click()}>
                                <Camera size={11} className="text-white" />
                            </div>
                        </div>

                        <AnimatePresence>
                            {photoExpanded && avatarUrl && (
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
                                        <img src={avatarUrl} alt={teacher.user.name} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => setPhotoExpanded(false)}
                                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                                            <X size={14} className="text-white" />
                                        </button>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <input ref={fileRef} type="file" accept="image/*" className="hidden"
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoChange(file);
                                e.target.value = '';
                            }} />

                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-bold leading-tight">
                                        {prefixSaved && <span className="mr-1" style={{ color: '#DA7756' }}>{prefixSaved}</span>}
                                        {personalSaved.name}
                                    </h2>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <p className="text-[11px] text-muted-foreground">{titleSaved}</p>
                                        <VerifiedBadge />
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <span className="font-mono text-[12px] font-semibold tracking-wider" style={{ color: '#DA7756' }}>
                                            {teacher.teacherId}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
                                    {teacher.status === 'ACTIVE' ? 'Active' : teacher.status}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 flex-wrap">
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
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* Personal Info */}
                    <SectionCard title="Personal Info" editBtn={editBtns('personal')}>
                        {editingSection === 'personal' ? (
                            <>
                                <div className="flex items-start gap-3 py-2.5 border-b border-border/40">
                                    <span className="text-xs text-muted-foreground w-28 shrink-0 mt-2">Full Name</span>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex flex-wrap gap-1.5">
                                            {PREFIX_OPTIONS.map(opt => (
                                                <button key={opt} onClick={() => setPrefixDraft(p => p === opt ? '' : opt)}
                                                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${prefixDraft === opt ? 'border-transparent text-white' : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-transparent'}`}
                                                    style={prefixDraft === opt ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}>
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {prefixDraft && <span className="text-xs font-semibold shrink-0" style={{ color: '#DA7756' }}>{prefixDraft}</span>}
                                            <input value={personalDraft.name}
                                                onChange={e => setPersonalDraft(d => ({ ...d, name: e.target.value }))}
                                                placeholder="Full name"
                                                className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all" />
                                        </div>
                                    </div>
                                </div>
                                <EditableField label="Date of Birth" value={personalDraft.dob} onChange={v => setPersonalDraft(d => ({ ...d, dob: formatDob(v) }))} placeholder="YYYY-MM-DD" />
                                <div className="flex items-center gap-3 py-2 border-b border-border/40">
                                    <span className="text-xs text-muted-foreground w-28 shrink-0">Gender</span>
                                    <div className="flex gap-2">
                                        {[{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }, { value: 'OTHER', label: 'Other' }].map(opt => (
                                            <button key={opt.value} type="button"
                                                onClick={() => setPersonalDraft(d => ({ ...d, gender: opt.value }))}
                                                className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${personalDraft.gender === opt.value ? 'border-transparent text-white' : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'}`}
                                                style={personalDraft.gender === opt.value ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
                                    <Tag size={14} className="text-muted-foreground shrink-0 mt-1" />
                                    <span className="text-xs text-muted-foreground w-28 shrink-0 mt-0.5">Display Title</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {TITLE_OPTIONS.map(opt => (
                                            <button key={opt} onClick={() => setTitleDraft(opt)}
                                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${titleDraft === opt ? 'border-transparent text-white' : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-transparent'}`}
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
                                    <span className="font-mono text-xs font-semibold tracking-wider" style={{ color: '#DA7756' }}>{teacher.teacherId}</span>
                                } />
                                <InfoRow icon={User} label="Full Name" value={
                                    <span>{prefixSaved && <span className="font-semibold mr-1" style={{ color: '#DA7756' }}>{prefixSaved}</span>}{personalSaved.name}</span>
                                } />
                                <InfoRow icon={Tag} label="Display Title" value={
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(218,119,86,0.12)', color: '#DA7756' }}>{titleSaved}</span>
                                } />
                                <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(personalSaved.dob)} />
                                <InfoRow icon={User} label="Gender" value={
                                    personalSaved.gender === 'MALE' ? 'Male' : personalSaved.gender === 'FEMALE' ? 'Female' : personalSaved.gender || '—'
                                } />
                                <InfoRow icon={Calendar} label="Joined" value={formatDate(teacher.joinedAt)} />
                            </>
                        )}
                    </SectionCard>

                    {/* AI Token Usage — same live data + layout as the overview widget, not mock */}
                    <SectionCard title="AI Token Usage" contentClassName="p-5">
                        <div className="space-y-3">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-xs font-semibold">Your usage · last 30 days</p>
                                    <span className="text-xs font-bold">
                                        {aiUsageLoading ? '…' : formatTokens(aiUsage?.totalTokens ?? 0)}
                                        <span className="text-muted-foreground font-normal"> / {formatTokens(aiUsage?.institutionPoolLimit ?? 0)} pool</span>
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(aiUsage?.poolSharePct ?? 0, 100)}%`, background: 'var(--primary)' }} />
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">{aiUsageLoading ? '…' : aiUsage?.poolSharePct ?? 0}% of institution pool</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-muted/40 rounded-xl p-3 text-center">
                                    <p className="text-sm font-bold">{aiUsageLoading ? '…' : formatTokens(aiUsage?.totalTokens ?? 0)}</p>
                                    <p className="text-[10px] text-muted-foreground">Used</p>
                                </div>
                                <div className="bg-muted/40 rounded-xl p-3 text-center">
                                    <p className="text-sm font-bold">{aiUsageLoading ? '…' : formatTokens(Math.max(0, (aiUsage?.institutionPoolLimit ?? 0) - (aiUsage?.totalTokens ?? 0)))}</p>
                                    <p className="text-[10px] text-muted-foreground">Remaining</p>
                                </div>
                                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(124,58,237,0.08)' }}>
                                    <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{aiUsageLoading ? '…' : `${aiUsage?.poolSharePct ?? 0}%`}</p>
                                    <p className="text-[10px] text-muted-foreground">Pool share</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
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
                                <p className="text-[11px] text-muted-foreground mt-1">Shared across all teachers</p>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Professional Details */}
                    <SectionCard title="Professional Details" editBtn={editBtns('prof')}>
                        {editingSection === 'prof' ? (
                            <>
                                <EditableField label="Qualification" value={profDraft.qualification} onChange={v => setProfDraft(d => ({ ...d, qualification: v }))} placeholder="e.g. B.Ed, M.Sc" />
                                <EditableField label="Experience" value={profDraft.experience} onChange={v => setProfDraft(d => ({ ...d, experience: v }))} placeholder="e.g. 5 years" />
                            </>
                        ) : (
                            <>
                                <InfoRow icon={GraduationCap} label="Qualification" value={profSaved.qualification || '—'} />
                                <InfoRow icon={Briefcase} label="Experience" value={profSaved.experience || '—'} />
                            </>
                        )}
                    </SectionCard>

                    {/* Contact Details */}
                    <SectionCard title="Contact Details" editBtn={editBtns('contact')}>
                        {editingSection === 'contact' ? (
                            <>
                                <PhoneEditField value={contactDraft.phone} onChange={v => setContactDraft(d => ({ ...d, phone: v }))} />
                                <EditableField label="Address" value={contactDraft.address} onChange={v => setContactDraft(d => ({ ...d, address: v }))} placeholder="Street / Building / Area" />
                                <EditableField label="City" value={contactDraft.city} onChange={v => setContactDraft(d => ({ ...d, city: v }))} placeholder="e.g. Mumbai" />
                                <EditableField label="State" value={contactDraft.state} onChange={v => setContactDraft(d => ({ ...d, state: v }))} placeholder="e.g. Maharashtra" />
                                <EditableField label="Pincode" value={contactDraft.pincode} onChange={v => setContactDraft(d => ({ ...d, pincode: v }))} placeholder="e.g. 400001" />
                                <EditableField label="Country" value={contactDraft.country} onChange={v => setContactDraft(d => ({ ...d, country: v }))} placeholder="e.g. India" />
                            </>
                        ) : (
                            <>
                                <InfoRow icon={Mail} label="Email" value={teacher.user.email} />
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

                {/* Assignments */}
                <SectionCard title={`Assignments (${teacher.assignments.length})`} contentClassName="p-5">
                    {teacher.assignments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                <BookOpen size={20} className="text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">No assignments yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                            {teacher.assignments.filter(a => a.role === 'CLASS_TEACHER').length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        <p className="text-xs font-semibold text-muted-foreground">Class Teacher</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        {teacher.assignments.filter(a => a.role === 'CLASS_TEACHER').map(a => (
                                            <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-muted/20">
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-950">
                                                    <GraduationCap size={13} className="text-amber-600 dark:text-amber-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold">{a.level3Name}</p>
                                                    <p className="text-[11px] text-muted-foreground">{a.level1Name}</p>
                                                </div>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                                    Class Teacher
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {teacher.assignments.filter(a => a.role === 'SUBJECT_TEACHER').length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]0" />
                                        <p className="text-xs font-semibold text-muted-foreground">Subject Teacher</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        {teacher.assignments.filter(a => a.role === 'SUBJECT_TEACHER').map(a => (
                                            <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-muted/20">
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[var(--muted)]">
                                                    <BookOpen size={13} className="text-[var(--primary)]" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold">{a.level3Name}</p>
                                                    <p className="text-[11px] text-muted-foreground">{a.level2Name}</p>
                                                </div>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--primary)] bg-[var(--muted)] text-[var(--primary)]">
                                                    Subject Teacher
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </SectionCard>

            </motion.div>
        </div>
    );
}
