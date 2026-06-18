
'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Hash, Mail, Phone, MapPin, Calendar, User,
    GraduationCap, Briefcase, Edit2, Check, X,
    BookOpen, Layers, Camera, Tag,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_TEACHER = {
    id: 't1', teacherId: 'TCH-001', name: 'Ritu Sharma',
    email: 'ritu.sharma@dps.edu.in', phone: '+91 98765 43210',
    status: 'ACTIVE', joinedAt: '2025-08-15T00:00:00Z',
    dob: '1990-03-22', gender: 'FEMALE',
    address: '12, Green Park', city: 'New Delhi', state: 'Delhi',
    pincode: '110016', country: 'India',
    qualification: 'B.Ed, M.A (Mathematics)', experience: '8 years',
    assignments: [
        { id: 'a1', level1Name: 'Class 10', level2Name: 'Mathematics', level3Name: '10-A', role: 'CLASS_TEACHER' },
        { id: 'a2', level1Name: 'Class 9', level2Name: 'Mathematics', level3Name: '9-B', role: 'SUBJECT_TEACHER' },
        { id: 'a3', level1Name: 'Class 8', level2Name: 'Mathematics', level3Name: '8-C', role: 'SUBJECT_TEACHER' },
        { id: 'a4', level1Name: 'Class 10', level2Name: 'Mathematics', level3Name: '10-B', role: 'SUBJECT_TEACHER' },
        { id: 'a5', level1Name: 'Class 7', level2Name: 'Mathematics', level3Name: '7-A', role: 'SUBJECT_TEACHER' },
        { id: 'a6', level1Name: 'Class 6', level2Name: 'Mathematics', level3Name: '6-B', role: 'SUBJECT_TEACHER' },
    ],
};

const AVATAR_COLORS = [
    { bg: 'bg-violet-100 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300' },
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

function formatDate(iso?: string) {
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
function SectionCard({ title, children, editBtn }: {
    title: React.ReactNode; children: React.ReactNode; editBtn?: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 min-h-[60px] border-b border-border/50 bg-muted/30">
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
            <input value={value} onChange={e => onChange(e.target.value)}
                className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all" />
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherProfilePage() {
    const teacher = MOCK_TEACHER;
    const avatarColor = getAvatarColor(teacher.id);

    const [editingSection, setEditingSection] = useState<string | null>(null);

    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const TITLE_OPTIONS = ['Teacher', 'Professor', 'Asst. Teacher', 'Lecturer', 'HOD', 'Mentor', 'Tutor', 'Educator'];
    const [titleDraft, setTitleDraft] = useState('Teacher');
    const [titleSaved, setTitleSaved] = useState('Teacher');

    const PREFIX_OPTIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.', 'Er.', 'CA', 'Adv.'];
    const defaultPrefix = teacher.gender === 'MALE' ? 'Mr.' : teacher.gender === 'FEMALE' ? 'Ms.' : '';
    const [prefixDraft, setPrefixDraft] = useState(defaultPrefix);
    const [prefixSaved, setPrefixSaved] = useState(defaultPrefix);

    const [personalDraft, setPersonalDraft] = useState({
        name: teacher.name, dob: teacher.dob, gender: teacher.gender,
    });
    const [personalSaved, setPersonalSaved] = useState({ ...personalDraft });

    const [contactDraft, setContactDraft] = useState({
        phone: teacher.phone, address: teacher.address,
        city: teacher.city, state: teacher.state,
        pincode: teacher.pincode, country: teacher.country,
    });
    const [contactSaved, setContactSaved] = useState({ ...contactDraft });

    const [profDraft, setProfDraft] = useState({
        qualification: teacher.qualification, experience: teacher.experience,
    });
    const [profSaved, setProfSaved] = useState({ ...profDraft });

    const cancelEdit = (s: string) => {
        if (s === 'personal') { setPersonalDraft({ ...personalSaved }); setTitleDraft(titleSaved); setPrefixDraft(prefixSaved); }
        if (s === 'contact') setContactDraft({ ...contactSaved });
        if (s === 'prof') setProfDraft({ ...profSaved });
        setEditingSection(null);
    };

    const saveEdit = (s: string) => {
        if (s === 'personal') { setPersonalSaved({ ...personalDraft }); setTitleSaved(titleDraft); setPrefixSaved(prefixDraft); }
        if (s === 'contact') setContactSaved({ ...contactDraft });
        if (s === 'prof') setProfSaved({ ...profDraft });
        setEditingSection(null);
        toast.success('Changes saved');
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
                        <div className="relative cursor-pointer" onClick={() => fileRef.current?.click()}>
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${avatarColor.bg} ${avatarColor.text} overflow-hidden`}>
                                {avatarPreview
                                    ? <img src={avatarPreview} alt={teacher.name} className="w-full h-full object-cover" />
                                    : getInitials(teacher.name)
                                }
                            </div>
                            {/* Camera badge */}
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border-2 border-background flex items-center justify-center shadow-sm"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                <Camera size={11} className="text-white" />
                            </div>
                        </div>

                        <input ref={fileRef} type="file" accept="image/*" className="hidden"
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = () => setAvatarPreview(reader.result as string);
                                    reader.readAsDataURL(file);
                                    toast.success('Photo updated!');
                                }
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
                                    Active
                                </span>
                            </div>
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
                                {/* Full Name with prefix */}
                                <div className="flex items-start gap-3 py-2.5 border-b border-border/40">
                                    <span className="text-xs text-muted-foreground w-28 shrink-0 mt-2">Full Name</span>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex flex-wrap gap-1.5">
                                            {PREFIX_OPTIONS.map(opt => (
                                                <button
                                                    key={opt}
                                                    onClick={() => setPrefixDraft(p => p === opt ? '' : opt)}
                                                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                                                        prefixDraft === opt
                                                            ? 'border-transparent text-white'
                                                            : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-transparent'
                                                    }`}
                                                    style={prefixDraft === opt ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {prefixDraft && (
                                                <span className="text-xs font-semibold shrink-0" style={{ color: '#DA7756' }}>{prefixDraft}</span>
                                            )}
                                            <input
                                                value={personalDraft.name}
                                                onChange={e => setPersonalDraft(d => ({ ...d, name: e.target.value }))}
                                                placeholder="Enter full name"
                                                className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
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
                                {/* Title chooser */}
                                <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
                                    <Tag size={14} className="text-muted-foreground shrink-0 mt-1" />
                                    <span className="text-xs text-muted-foreground w-28 shrink-0 mt-0.5">Display Title</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {TITLE_OPTIONS.map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => setTitleDraft(opt)}
                                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                                                    titleDraft === opt
                                                        ? 'border-transparent text-white'
                                                        : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-transparent'
                                                }`}
                                                style={titleDraft === opt ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <InfoRow icon={Hash} label="Teacher ID" value={
                                    <span className="font-mono text-xs font-semibold tracking-wider" style={{ color: '#DA7756' }}>
                                        {teacher.teacherId}
                                    </span>
                                } />
                                <InfoRow icon={User} label="Full Name" value={
                                    <span>{prefixSaved && <span className="font-semibold mr-1" style={{ color: '#DA7756' }}>{prefixSaved}</span>}{personalSaved.name}</span>
                                } />
                                <InfoRow icon={Tag} label="Display Title" value={
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(218,119,86,0.12)', color: '#DA7756' }}>
                                        {titleSaved}
                                    </span>
                                } />
                                <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(personalSaved.dob)} />
                                <InfoRow icon={User} label="Gender" value={
                                    personalSaved.gender === 'MALE' ? 'Male'
                                        : personalSaved.gender === 'FEMALE' ? 'Female'
                                            : personalSaved.gender || '—'
                                } />
                                <InfoRow icon={Calendar} label="Joined" value={formatDate(teacher.joinedAt)} />
                            </>
                        )}
                    </SectionCard>

                    {/* AI Token Usage */}
                    <SectionCard title="AI Token Usage">
                        <div className="space-y-3">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-xs font-semibold">Your usage this month</p>
                                    <span className="text-xs font-bold">1.2M <span className="text-muted-foreground font-normal">/ 10M pool</span></span>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: '12%', background: '#7C3AED' }} />
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">12% of institution pool</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-muted/40 rounded-xl p-3 text-center">
                                    <p className="text-sm font-bold">1.2M</p>
                                    <p className="text-[10px] text-muted-foreground">Used</p>
                                </div>
                                <div className="bg-muted/40 rounded-xl p-3 text-center">
                                    <p className="text-sm font-bold">8.8M</p>
                                    <p className="text-[10px] text-muted-foreground">Remaining</p>
                                </div>
                                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(124,58,237,0.08)' }}>
                                    <p className="text-sm font-bold" style={{ color: '#7C3AED' }}>12%</p>
                                    <p className="text-[10px] text-muted-foreground">Pool share</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[11px] font-semibold text-muted-foreground">Institution pool</p>
                                    <span className="text-[11px] font-semibold">4.4M <span className="font-normal text-muted-foreground">/ 10M used</span></span>
                                </div>
                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: '44%', background: '#DA7756' }} />
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">🔄 Resets 1st of every month</p>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Professional Details */}
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

                    {/* Contact Details */}
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
                                <InfoRow icon={Mail} label="Email" value={teacher.email} />
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
                <SectionCard title={`Assignments (${teacher.assignments.length})`}>
                    {teacher.assignments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                <BookOpen size={20} className="text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">No assignments yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-72 overflow-y-auto pr-1">

                            {/* Class Teacher */}
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

                            {/* Subject Teacher */}
                            {teacher.assignments.filter(a => a.role === 'SUBJECT_TEACHER').length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                                        <p className="text-xs font-semibold text-muted-foreground">Subject Teacher</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        {teacher.assignments.filter(a => a.role === 'SUBJECT_TEACHER').map(a => (
                                            <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-muted/20">
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-violet-100 dark:bg-violet-950">
                                                    <BookOpen size={13} className="text-violet-600 dark:text-violet-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold">{a.level3Name}</p>
                                                    <p className="text-[11px] text-muted-foreground">{a.level2Name}</p>
                                                </div>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
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