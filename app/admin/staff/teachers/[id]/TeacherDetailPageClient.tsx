'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronRight, Hash, Mail, Phone, MapPin,
    Calendar, User, GraduationCap, Briefcase, Edit2,
    Check, X, PowerOff, Power, BookOpen, Layers,
    CheckCircle2, Circle, MailCheck, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Teacher, InstitutionType } from '@/types';
import { getStructureLabels } from '@/lib/getInstitutionAccent';
import { useMockInstType } from '@/context/MockInstTypeContext';
import api from '@/lib/api';


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

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ title, children, editBtn }: {
    title: React.ReactNode; children: React.ReactNode; editBtn?: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
                {editBtn}
            </div>
            <div className="p-5">{children}</div>
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
function ProfileTab({ teacher, onDeactivateClick, onResendInviteClick, onTeacherUpdate }: {
    teacher: typeof MOCK_TEACHERS[0];
    onDeactivateClick: () => void;
    onResendInviteClick: () => void;
    onTeacherUpdate: (updated: Partial<typeof MOCK_TEACHERS[0]>) => void;
}) {
    const avatarColor = getAvatarColor(teacher.id);
    const isActive = teacher.status === 'ACTIVE';
    const [editingSection, setEditingSection] = useState<string | null>(null);

    const [personalDraft, setPersonalDraft] = useState({
        name: teacher.name, dob: teacher.dob ?? '', gender: teacher.gender ?? '',
    });
    const [personalSaved, setPersonalSaved] = useState({ ...personalDraft });

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
        if (s === 'personal') setPersonalDraft({ ...personalSaved });
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
            if (s === 'personal') { setPersonalSaved({ ...personalDraft }); onTeacherUpdate({ name: personalDraft.name, dob: personalDraft.dob, gender: personalDraft.gender }); }
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
            <div className="bg-card border border-border/50 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${avatarColor.bg} ${avatarColor.text}`}>
                        {teacher.avatarUrl
                            ? <img src={teacher.avatarUrl} alt={teacher.name} className="w-full h-full object-cover rounded-2xl" />
                            : getInitials(teacher.name)
                        }
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold leading-tight">{personalSaved.name}</h2>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {teacher.teacherId && (
                                        <span className="font-mono text-[12px] font-semibold tracking-wider" style={{ color: '#DA7756' }}>
                                            {teacher.teacherId}
                                        </span>
                                    )}
                                    {teacher.invitePending ? (
                                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                            Invite Pending
                                        </span>
                                    ) : (
                                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${isActive
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                            : 'bg-muted text-muted-foreground'
                                            }`}>
                                            {isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {teacher.invitePending ? (
                                <button
                                    onClick={onResendInviteClick}
                                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-400 transition-all"
                                >
                                    <MailCheck size={13} /> Resend Invite
                                </button>
                            ) : (
                                <button
                                    onClick={onDeactivateClick}
                                    className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${isActive
                                        ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400'
                                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400'
                                        }`}
                                >
                                    {isActive ? <><PowerOff size={13} /> Deactivate</> : <><Power size={13} /> Activate</>}
                                </button>
                            )}
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
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
                            <EditableField label="Full Name" value={personalDraft.name} onChange={v => setPersonalDraft(d => ({ ...d, name: v }))} />
                            <EditableField label="Date of Birth" value={personalDraft.dob} onChange={v => setPersonalDraft(d => ({ ...d, dob: v }))} />
                            <EditableField label="Gender" value={personalDraft.gender} onChange={v => setPersonalDraft(d => ({ ...d, gender: v }))} />
                        </>
                    ) : (
                        <>
                            <InfoRow icon={Hash} label="Teacher ID" value={
                                teacher.teacherId
                                    ? <span className="font-mono text-xs font-semibold tracking-wider" style={{ color: '#DA7756' }}>{teacher.teacherId}</span>
                                    : '—'
                            } />
                            <InfoRow icon={User} label="Full Name" value={personalSaved.name} />
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

                {/* AI Tokens — coming soon */}
                <SectionCard title={
                    <span className="flex items-center gap-1.5">
                        <Sparkles size={12} />
                        AI Token Usage
                        <span className="ml-1 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">Coming soon</span>
                    </span>
                }>
                    <div className="flex items-center justify-center h-28 text-muted-foreground/30 text-sm">
                        Real-time token data will appear here
                    </div>
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

            <SectionCard title={`Assignments (${teacher.assignments.length})`}>
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
                    <div className="space-y-4">
                        {Object.entries(grouped).map(([level1, assignments]) => (
                            <div key={level1}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Layers size={13} className="text-muted-foreground" />
                                    <p className="text-xs font-semibold text-muted-foreground">{level1}</p>
                                </div>
                                <div className="space-y-1.5 pl-4">
                                    {assignments.map(a => (
                                        <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border/50 bg-muted/20">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${a.role === 'CLASS_TEACHER'
                                                ? 'bg-violet-100 dark:bg-violet-950'
                                                : 'bg-sky-100 dark:bg-sky-950'
                                                }`}>
                                                {a.role === 'CLASS_TEACHER'
                                                    ? <GraduationCap size={12} className="text-violet-600 dark:text-violet-400" />
                                                    : <BookOpen size={12} className="text-sky-600 dark:text-sky-400" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold">{a.level2Name} · {a.level3Name}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {a.role === 'CLASS_TEACHER' ? 'Class Teacher' : 'Subject Teacher'}
                                                </p>
                                            </div>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.role === 'CLASS_TEACHER'
                                                ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                                                : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                                                }`}>
                                                {a.role === 'CLASS_TEACHER' ? 'Class Teacher' : 'Subject Teacher'}
                                            </span>
                                        </div>
                                    ))}
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
    const [confirmResend, setConfirmResend] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);

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

    const handleResendInvite = async () => {
        if (!teacher) return;
        setResendLoading(true);
        try {
            await api.post(`/admin/teachers/${teacher.id}/resend-invite`);
            toast.success('Invite resent successfully');
            setConfirmResend(false);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg ?? 'Failed to resend invite');
        } finally {
            setResendLoading(false);
        }
    };

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
            <div className="h-36 w-full bg-muted rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
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
        <div className="space-y-5 py-4 px-2 pb-6">
            {/* Back + breadcrumb */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all">
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <h1 className="text-xl font-bold">{teacher.name}</h1>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        Teachers <ChevronRight /> {teacher.name}
                    </p>
                </div>
            </div>
            <ProfileTab
                teacher={teacher}
                onDeactivateClick={() => setConfirmToggle(true)}
                onResendInviteClick={() => setConfirmResend(true)}
                onTeacherUpdate={(updated) => setTeacher(prev => prev ? { ...prev, ...updated } : prev)}
            />

            {confirmToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
                    >
                        <h3 className="text-base font-bold mb-2">
                            {teacher.status === 'ACTIVE' ? '⚠️ Deactivate Teacher?' : '✅ Activate Teacher?'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-5">
                            {teacher.status === 'ACTIVE'
                                ? `${teacher.name} will lose access immediately. All assignments will be preserved.`
                                : `${teacher.name} will regain access to the platform.`
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

            {confirmResend && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
                    >
                        <h3 className="text-base font-bold mb-2">Resend Invite?</h3>
                        <p className="text-sm text-muted-foreground mb-5">
                            A new invite email will be sent to {teacher.name}. The previous invite link will be invalidated.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setConfirmResend(false)}
                                disabled={resendLoading}
                                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResendInvite}
                                disabled={resendLoading}
                                className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            >
                                {resendLoading ? 'Sending…' : 'Yes, Resend'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
