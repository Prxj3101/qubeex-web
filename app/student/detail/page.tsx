'use client';

import { ArrowLeft, User, BookOpen, Shield, MapPin, Users, Hash, Copy, Heart, Phone, CheckCircle, Pencil, X, Check, ChevronDown, Eye, EyeOff, Info, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import NextImage from 'next/image';
import { createPortal } from 'react-dom';
import { useStudentStore } from '@/store/studentStore';

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const STUDENT = {
    name: 'Prajwal Jagdish Kotian',
    rollNo: '09',
    standard: 'Class 10',
    div: 'Division A',
    academicYear: '2026-27',
    dob: '2001-05-31',
    email: 'prajwal.kotian@gmail.com',
    uid: 'STU-2026-0009',
    gender: 'Male',
    nationality: 'Indian',
    admissionYear: '2022',
    religion: 'Hindu',
    category: 'General',
    phone: '+91 98765 43210',
    bloodGroup: 'B+',
    aadharNo: '1234 5678 9012',
    panNo: 'ABCPK1234D',
    emergencyContact: '+91 98765 00003',
    address: 'Flat 12, Shanti Niwas, Sector 7, Andheri West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400058',
    country: 'India',
    houseColor: 'Blue',
    guardians: [
        { name: 'Jagdish Kotian', number: '+91 98765 00001', relation: 'Father' },
        { name: 'Poornima Kotian', number: '+91 98765 00002', relation: 'Mother' },
    ],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const dobDate = new Date(STUDENT.dob);
const age = new Date().getFullYear() - dobDate.getFullYear();
const dobDisplay = dobDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Auto-format DOB input as YYYY-MM-DD, digits only, capped at 8 digits
function formatDob(text: string): string {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Read-only field (same style as ManageTab) ─────────────────────────────────
function ReadField({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <div className={`px-3 rounded-md border border-border/50 bg-muted flex ${multiline ? 'min-h-8 py-2 items-start' : 'h-8 items-center'}`}>
                <span className="text-xs text-foreground leading-relaxed">{value || '—'}</span>
            </div>
        </div>
    );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GENDERS = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'].map(c => ({ value: c, label: c }));
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => ({ value: b, label: b }));

function formatAadhar(val: string): string {
    const digits = val.replace(/\D/g, '').slice(0, 12);
    return (digits.match(/.{1,4}/g) ?? []).join(' ');
}

const COUNTRY_CODES = [
    { code: '+91',  label: '🇮🇳 +91',  max: 10 },
    { code: '+1',   label: '🇺🇸 +1',   max: 10 },
    { code: '+44',  label: '🇬🇧 +44',  max: 10 },
    { code: '+61',  label: '🇦🇺 +61',  max: 9  },
    { code: '+971', label: '🇦🇪 +971', max: 9  },
    { code: '+65',  label: '🇸🇬 +65',  max: 8  },
];

function parsePhone(val: string) {
    const match = (val ?? '').match(/^(\+\d+)\s*(.*)$/);
    return match ? { code: match[1], number: match[2] } : { code: '+91', number: val ?? '' };
}

function PhoneField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const { code, number } = parsePhone(value);
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (
                btnRef.current && !btnRef.current.contains(e.target as Node) &&
                dropRef.current && !dropRef.current.contains(e.target as Node)
            ) setOpen(false);
        };
        const onScroll = (e: Event) => {
            if (dropRef.current && dropRef.current.contains(e.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', close);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('mousedown', close);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [open]);

    const handleToggle = () => {
        if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + 4, left: r.left });
        }
        setOpen(v => !v);
    };

    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <div className="flex gap-1.5">
                <div className="shrink-0">
                    <button ref={btnRef} type="button" onClick={handleToggle}
                        className="h-8 px-2.5 rounded-md border border-primary/50 bg-primary/5 text-xs flex items-center gap-1 whitespace-nowrap hover:bg-primary/10 transition-all">
                        {code} <ChevronDown size={10} className="text-muted-foreground" />
                    </button>
                    {open && typeof document !== 'undefined' && createPortal(
                        <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}
                            className="bg-card border border-border rounded-xl shadow-xl py-1 min-w-[130px] max-h-[108px] overflow-y-auto">
                            {COUNTRY_CODES.map(c => (
                                <button key={c.code} type="button"
                                    onClick={() => { onChange(`${c.code} ${number}`); setOpen(false); }}
                                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors ${code === c.code ? 'text-primary font-semibold' : 'text-foreground'}`}>
                                    {c.label}
                                </button>
                            ))}
                        </div>,
                        document.body
                    )}
                </div>
                <input value={number}
                    onChange={e => {
                        const raw = e.target.value;
                        const maxDigits = COUNTRY_CODES.find(c => c.code === code)?.max ?? 10;
                        if (raw.replace(/\D/g, '').length <= maxDigits) onChange(`${code} ${raw}`);
                    }}
                    placeholder="98765 43210"
                    className="flex-1 h-8 px-3 rounded-md border border-primary/50 bg-primary/5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
        </div>
    );
}

// ─── Dropdown field ───────────────────────────────────────────────────────────
function EditDropdown({ label, value, options, onChange }: {
    label: string; value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <div className="relative">
                <button type="button" onClick={() => setOpen(v => !v)}
                    className="w-full h-8 px-3 rounded-md border border-primary/50 bg-primary/5 text-xs text-left flex items-center justify-between">
                    <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
                        {value ? options.find(o => o.value === value)?.label ?? value : 'Select'}
                    </span>
                    <ChevronDown size={11} className="text-muted-foreground" />
                </button>
                {open && (
                    <div className="absolute top-9 left-0 z-50 w-full bg-card border border-border rounded-xl shadow-xl py-1 max-h-[145px] overflow-y-auto"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                        {options.map(o => (
                            <button key={o.value} type="button"
                                onClick={() => { onChange(o.value); setOpen(false); }}
                                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors ${value === o.value ? 'text-primary font-semibold' : 'text-foreground'}`}>
                                {o.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Editable field ───────────────────────────────────────────────────────────
function EditField({ label, value, onChange, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <div>
            <p className="text-[11px] text-muted-foreground mb-1 font-medium">{label}</p>
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-8 w-full px-3 rounded-md border border-primary/50 bg-primary/5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
        </div>
    );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, editing, saving, onEdit, onSave, onCancel, afterLabel }: {
    icon: React.ElementType; label: string;
    editing?: boolean; saving?: boolean;
    onEdit?: () => void; onSave?: () => void; onCancel?: () => void;
    afterLabel?: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-2 mb-3 min-h-[24px]">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Icon size={11} className="text-primary" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{label}</p>
            {afterLabel}
            <div className="flex-1 h-px bg-border/60" />
            {onEdit && !editing && (
                <button onClick={onEdit}
                    className="h-6 px-2.5 rounded-lg border border-border/50 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-all shrink-0 flex items-center gap-1">
                    <Pencil size={10} /> Edit
                </button>
            )}
            {editing && (
                <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={onCancel}
                        className="h-6 px-2.5 rounded-lg border border-border/50 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all flex items-center gap-1">
                        <X size={10} /> Cancel
                    </button>
                    <button onClick={onSave} disabled={saving}
                        className="h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        <Check size={10} /> {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentDetailPage() {
    const router = useRouter();
    const [copied, setCopied] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // ── Global student store ──
    const store = useStudentStore();
    const updateInfo = store.updateInfo;

    useEffect(() => { store.fetchProfile(); }, []);

    // ── Student Info edit ──
    const data = { name: store.name, dob: store.dob, email: store.email, phone: store.phone, gender: store.gender, nationality: store.nationality, admissionYear: store.admissionYear, religion: store.religion, category: store.category };
    const [draft, setDraft] = useState(data);
    const [editingInfo, setEditingInfo] = useState(false);

    const startEdit = () => { setDraft(data); setEditingInfo(true); };
    const saveEdit = async () => { await store.saveProfile(draft); setEditingInfo(false); };
    const cancelEdit = () => { setDraft(data); setEditingInfo(false); };

    // ── Medical edit ──
    const medData = { bloodGroup: store.bloodGroup, aadharNo: store.aadharNo, panNo: store.panNo, emergencyContact: store.emergencyContact };
    const [medDraft, setMedDraft] = useState(medData);
    const [editingMed, setEditingMed] = useState(false);

    const startMedEdit = () => { setMedDraft(medData); setEditingMed(true); };
    const saveMedEdit = async () => { await store.saveProfile(medDraft); setEditingMed(false); };
    const cancelMedEdit = () => { setMedDraft(medData); setEditingMed(false); };

    // ── Address edit ──
    const addrData = { address: store.address, city: store.city, state: store.state, pincode: store.pincode, country: store.country };
    const [addrDraft, setAddrDraft] = useState(addrData);
    const [editingAddr, setEditingAddr] = useState(false);

    const startAddrEdit = () => { setAddrDraft(addrData); setEditingAddr(true); };
    const saveAddrEdit = async () => { await store.saveProfile(addrDraft); setEditingAddr(false); };
    const cancelAddrEdit = () => { setAddrDraft(addrData); setEditingAddr(false); };

    // ── Guardians edit ──
    const [guardianDraft, setGuardianDraft] = useState(store.guardians);
    const [editingGuardians, setEditingGuardians] = useState(false);

    const startGuardiansEdit = () => { setGuardianDraft(store.guardians.map(g => ({ ...g }))); setEditingGuardians(true); };
    const saveGuardiansEdit = async () => { await store.saveProfile({ guardians: guardianDraft }); setEditingGuardians(false); };
    const cancelGuardiansEdit = () => { setGuardianDraft(store.guardians.map(g => ({ ...g }))); setEditingGuardians(false); };

    // computed dob display from editable state
    const displayDob = (() => {
        const d = new Date(data.dob);
        if (isNaN(d.getTime())) return data.dob;
        const a = new Date().getFullYear() - d.getFullYear();
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ` (${a} yrs)`;
    })();

    const photoInputRef = useRef<HTMLInputElement>(null);
    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        // Show preview immediately
        const reader = new FileReader();
        reader.onload = (ev) => updateInfo({ photo: ev.target?.result as string });
        reader.readAsDataURL(file);
        // Upload to server
        try { await store.uploadPhoto(file); } catch { /* preview already shown */ }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(store.studentId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full">

            {/* ── Header ── */}
            <div className="flex items-center gap-3 pt-0 pb-3 shrink-0">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0"
                >
                    <ArrowLeft size={15} className="text-foreground" />
                </button>
                <p className="text-xl font-bold">My Profile</p>
            </div>
            <div className="h-px bg-border/60 shrink-0" />

            {/* ── Body row: left fixed, right scrollable ── */}
            <div className="flex gap-3 flex-1 min-h-0 bg-white dark:bg-muted/40 py-4 -mx-2 px-2">

            {/* ── LEFT — Profile Banner (fixed, no scroll) ── */}
            <div className="w-[30%] shrink-0">
                <div className="space-y-3">

                    {/* Profile card */}
                    <div className="rounded-2xl overflow-hidden border border-border/50 shadow-lg">
                        {/* Gradient banner */}
                        <div
                            className="px-5 pt-7 pb-6 flex flex-col items-center gap-3 dark:[background:linear-gradient(135deg,#4C1D95,#2D1F50)]"
                            style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
                        >
                            {/* Avatar */}
                            <div className="relative">
                                <div
                                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white overflow-hidden"
                                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}
                                >
                                    {store.photo
                                        ? <NextImage src={store.photo} alt="profile" fill sizes="160px" className="object-cover" unoptimized={store.photo.startsWith('data:')} />
                                        : getInitials(data.name)
                                    }
                                </div>
                                {/* Camera upload button — bottom right */}
                                <button
                                    onClick={() => photoInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-6 h-6 rounded-full flex items-center justify-center hover:opacity-90 transition-all shadow-sm"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                    title="Upload photo">
                                    <Camera size={15} className="text-white" />
                                </button>
                                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            </div>

                            {/* Name */}
                            <div className="text-center">
                                <p className="text-white font-bold text-base leading-tight">{data.name}</p>
                                <p className="text-white/70 text-xs mt-0.5">{store.standard} · {store.division}</p>
                            </div>

                            {/* Chips */}
                            <div className="flex flex-wrap justify-center gap-1.5">
                                {[
                                    `Roll No: ${store.rollNo}`,
                                    store.standard,
                                    data.admissionYear,
                                ].map((chip, i) => (
                                    <span key={i}
                                        className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'white' }}>
                                        {chip}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* UID strip */}
                        <div className="flex items-center gap-1 px-4 py-2.5 bg-violet-50 dark:bg-violet-950/30 border-t border-violet-200/50 dark:border-violet-900/50">
                            <Hash size={13} className="text-muted-foreground shrink-0" />
                            <span className="font-mono text-xs font-semibold tracking-wider flex-1 truncate" style={{ color: '#DA7756' }}>
                                {store.studentId}
                            </span>
                            <button onClick={handleCopy}
                                className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-all shrink-0">
                                {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>

                        {/* Status pill */}
                        <div className="px-4 py-3 bg-card border-t border-border/40">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">Status</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[11px] text-muted-foreground">Blood Group</span>
                                <div className="flex items-center gap-1">
                                    <Heart size={11} className="text-red-500" />
                                    <span className="text-[11px] font-bold text-red-500">{medData.bloodGroup}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[11px] text-muted-foreground">Emergency</span>
                                <div className="flex items-center gap-1">
                                    <Phone size={11} className="text-muted-foreground" />
                                    <span className="text-[11px] font-medium">{medData.emergencyContact}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Privacy note */}
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200/50 dark:border-violet-900/50">
                        <Shield size={12} className="text-violet-500 shrink-0" />
                        <p className="text-[10px] text-violet-600 dark:text-violet-400 leading-relaxed">
                            Your data is encrypted and only visible to you and authorized staff.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── RIGHT — Detail Sections (scrollable) ── */}
            <div className="w-[70%] min-w-0 space-y-3 overflow-y-auto pb-6 pr-2"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>

                {/* ROW 1 — Student Info + Academic Details */}
                <div className="flex gap-3 border border-border/50 rounded-2xl overflow-hidden bg-background">

                    {/* LEFT — Student Info */}
                    <div className="flex-1 px-4 py-3 border-r border-border/40 min-w-0 space-y-2.5">
                        <SectionHeader icon={User} label="Student Info"
                            editing={editingInfo} onEdit={startEdit} onSave={saveEdit} onCancel={cancelEdit} />
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                                style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}>
                                {store.photo
                                    ? <img src={store.photo} alt="profile" className="w-full h-full object-cover" />
                                    : getInitials(editingInfo ? draft.name : data.name)
                                }
                            </div>
                            {editingInfo
                                ? <EditField label="Full Name" value={draft.name} onChange={v => setDraft(p => ({ ...p, name: v }))} placeholder="Full Name" />
                                : <p className="text-sm font-bold">{data.name}</p>
                            }
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {editingInfo
                                ? <EditField label="Date of Birth" value={draft.dob} onChange={v => setDraft(p => ({ ...p, dob: formatDob(v) }))} placeholder="YYYY-MM-DD" />
                                : <ReadField label="Date of Birth" value={displayDob} />
                            }
                            {editingInfo
                                ? <EditDropdown label="Gender" value={draft.gender} options={GENDERS} onChange={v => setDraft(p => ({ ...p, gender: v }))} />
                                : <ReadField label="Gender" value={data.gender} />
                            }
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {editingInfo
                                ? <EditField label="Religion" value={draft.religion} onChange={v => setDraft(p => ({ ...p, religion: v }))} placeholder="e.g. Hindu" />
                                : <ReadField label="Religion" value={data.religion} />
                            }
                            {editingInfo
                                ? <EditDropdown label="Category" value={draft.category} options={CATEGORIES} onChange={v => setDraft(p => ({ ...p, category: v }))} />
                                : <ReadField label="Category" value={data.category} />
                            }
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {editingInfo
                                ? <EditField label="Nationality" value={draft.nationality} onChange={v => setDraft(p => ({ ...p, nationality: v }))} placeholder="e.g. Indian" />
                                : <ReadField label="Nationality" value={data.nationality} />
                            }
                            {editingInfo
                                ? <EditField label="Admission Year" value={draft.admissionYear} onChange={v => { if (v.replace(/\D/g, '').length <= 4) setDraft(p => ({ ...p, admissionYear: v.replace(/\D/g, '') })); }} placeholder="e.g. 2022" />
                                : <ReadField label="Admission Year" value={data.admissionYear} />
                            }
                        </div>
                        {editingInfo
                            ? <EditField label="Email" value={draft.email} onChange={v => setDraft(p => ({ ...p, email: v }))} placeholder="email@example.com" />
                            : <ReadField label="Email" value={data.email} />
                        }
                        {editingInfo
                            ? <PhoneField label="Contact No" value={draft.phone} onChange={v => setDraft(p => ({ ...p, phone: v }))} />
                            : <ReadField label="Contact No" value={data.phone} />
                        }
                    </div>

                    {/* RIGHT — Academic Details */}
                    <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                        <SectionHeader icon={BookOpen} label="Academic Details" />
                        <div className="grid grid-cols-2 gap-2">
                            <ReadField label="Class" value={store.standard.replace(/^Class\s*/i, '')} />
                            <ReadField label="Division" value={store.division.replace(/^Division\s*/i, '')} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ReadField label="Roll No" value={store.rollNo} />
                            <ReadField label="House Color" value={store.houseColor ?? ''} />
                        </div>
                        {/* Student ID */}
                        <div>
                            <p className="text-[11px] text-muted-foreground mb-1 font-medium">Student ID</p>
                            <div className="h-8 px-3 rounded-md border border-border/40 bg-muted/40 flex items-center justify-between">
                                <span className="text-sm font-mono font-semibold" style={{ color: '#DA7756' }}>
                                    {store.studentId}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50">Read only</span>
                            </div>
                        </div>
                        {/* Password — only shown if student hasn't changed it yet */}
                        {store.mustChangePassword && store.tempPassword && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <p className="text-[11px] text-muted-foreground font-medium">Temporary Password</p>
                                <div className="group relative">
                                    <Info size={11} className="text-muted-foreground/50 hover:text-blue-500 cursor-pointer transition-colors" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-800 border border-gray-700 shadow-lg text-[10px] text-white leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-normal">
                                        Change your password on first login. This is shown only until you set a new password.
                                    </div>
                                </div>
                            </div>
                            <div className="h-8 px-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-2">
                                <span className="text-sm font-mono flex-1 text-amber-600 dark:text-amber-400">
                                    {showPassword ? store.tempPassword : '••••••••••'}
                                </span>
                                <button type="button" onClick={() => setShowPassword(v => !v)}
                                    className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0">
                                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                            </div>
                        </div>
                        )}
                        {/* Lock notice */}
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/50">
                            <span className="text-sm">🔒</span>
                            <p className="text-[10px] text-blue-600 dark:text-blue-400">
                                Academic details can only be updated by your institution.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ROW 2 — Medical & Identity + Address */}
                <div className="flex gap-3 border border-border/50 rounded-2xl overflow-hidden bg-background">

                    {/* LEFT — Medical & Identity */}
                    <div className="flex-1 px-4 py-3 border-r border-border/40 min-w-0 space-y-2.5">
                        <SectionHeader icon={Shield} label="Medical & Identity"
                            editing={editingMed} onEdit={startMedEdit} onSave={saveMedEdit} onCancel={cancelMedEdit} />
                        {/* Blood group */}
                        {editingMed ? (
                            <EditDropdown label="Blood Group" value={medDraft.bloodGroup} options={BLOOD_GROUPS} onChange={v => setMedDraft(p => ({ ...p, bloodGroup: v }))} />
                        ) : (
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/50">
                                <Heart size={18} className="text-red-500 shrink-0" />
                                <div>
                                    <p className="text-[10px] text-red-400 font-medium">Blood Group</p>
                                    <p className="text-xl font-black text-red-500">{medData.bloodGroup}</p>
                                </div>
                            </div>
                        )}
                        {editingMed
                            ? <EditField label="Aadhar No" value={medDraft.aadharNo} onChange={v => setMedDraft(p => ({ ...p, aadharNo: formatAadhar(v) }))} placeholder="XXXX XXXX XXXX" />
                            : <ReadField label="Aadhar No" value={medData.aadharNo} />
                        }
                        {editingMed
                            ? <EditField label="PAN No" value={medDraft.panNo} onChange={v => { if (v.replace(/\s/g, '').length <= 10) setMedDraft(p => ({ ...p, panNo: v.toUpperCase() })); }} placeholder="ABCDE1234F" />
                            : <ReadField label="PAN No" value={medData.panNo} />
                        }
                        {editingMed
                            ? <PhoneField label="Emergency Contact" value={medDraft.emergencyContact} onChange={v => setMedDraft(p => ({ ...p, emergencyContact: v }))} />
                            : <ReadField label="Emergency Contact" value={medData.emergencyContact} />
                        }
                    </div>

                    {/* RIGHT — Address */}
                    <div className="flex-1 px-4 py-3 min-w-0 space-y-2.5">
                        <SectionHeader icon={MapPin} label="Address"
                            editing={editingAddr} onEdit={startAddrEdit} onSave={saveAddrEdit} onCancel={cancelAddrEdit} />
                        {editingAddr
                            ? <EditField label="Address" value={addrDraft.address} onChange={v => setAddrDraft(p => ({ ...p, address: v }))} placeholder="Street / Area" />
                            : <ReadField label="Address" value={addrData.address} multiline />
                        }
                        <div className="grid grid-cols-2 gap-2">
                            {editingAddr
                                ? <EditField label="City" value={addrDraft.city} onChange={v => setAddrDraft(p => ({ ...p, city: v }))} placeholder="Mumbai" />
                                : <ReadField label="City" value={addrData.city} />
                            }
                            {editingAddr
                                ? <EditField label="State" value={addrDraft.state} onChange={v => setAddrDraft(p => ({ ...p, state: v }))} placeholder="Maharashtra" />
                                : <ReadField label="State" value={addrData.state} />
                            }
                            {editingAddr
                                ? <EditField label="Pincode" value={addrDraft.pincode} onChange={v => setAddrDraft(p => ({ ...p, pincode: v }))} placeholder="400001" />
                                : <ReadField label="Pincode" value={addrData.pincode} />
                            }
                            {editingAddr
                                ? <EditField label="Country" value={addrDraft.country} onChange={v => setAddrDraft(p => ({ ...p, country: v }))} placeholder="India" />
                                : <ReadField label="Country" value={addrData.country} />
                            }
                        </div>
                    </div>
                </div>

                {/* ROW 3 — Parents / Guardian */}
                <div className="border border-border/50 rounded-2xl px-4 py-3 space-y-2.5 bg-background">
                    <SectionHeader icon={Users} label="Parents / Guardian"
                        editing={editingGuardians} onEdit={startGuardiansEdit} onSave={saveGuardiansEdit} onCancel={cancelGuardiansEdit}
                        afterLabel={editingGuardians && (
                            <div className="flex items-center gap-2">
                                <button type="button"
                                    onClick={() => setGuardianDraft(p => [...p, { name: '', number: '', relation: 'Father' }])}
                                    className="text-[11px] text-primary font-semibold hover:underline">
                                    + Parent
                                </button>
                                <span className="text-muted-foreground/40 text-[11px]">·</span>
                                <button type="button"
                                    onClick={() => setGuardianDraft(p => [...p, { name: '', number: '', relation: 'Guardian' }])}
                                    className="text-[11px] text-primary font-semibold hover:underline">
                                    + Guardian
                                </button>
                            </div>
                        )}
                    />
                    {(editingGuardians ? guardianDraft : store.guardians).length === 0 && !editingGuardians && (
                        <p className="text-xs text-muted-foreground/60 text-center py-2">No parents or guardians added yet</p>
                    )}
                    {(editingGuardians ? guardianDraft : store.guardians).map((g, i) => (
                        <div key={i} className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                    {g.relation || `Entry ${i + 1}`}
                                </p>
                                {editingGuardians && (
                                    <button type="button" onClick={() => setGuardianDraft(p => p.filter((_, gi) => gi !== i))}
                                        className="text-[10px] text-red-500 hover:text-red-400 font-medium">
                                        Remove
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {editingGuardians ? (
                                    <>
                                        <EditField label="Name" value={g.name} onChange={v => {
                                            const updated = [...guardianDraft];
                                            updated[i] = { ...updated[i], name: v };
                                            setGuardianDraft(updated);
                                        }} placeholder="Full Name" />
                                        <PhoneField label="Number" value={g.number} onChange={v => {
                                            const updated = [...guardianDraft];
                                            updated[i] = { ...updated[i], number: v };
                                            setGuardianDraft(updated);
                                        }} />
                                        <EditField label="Relation" value={g.relation} onChange={v => {
                                            const updated = [...guardianDraft];
                                            updated[i] = { ...updated[i], relation: v };
                                            setGuardianDraft(updated);
                                        }} placeholder="e.g. Father" />
                                    </>
                                ) : (
                                    <>
                                        <ReadField label="Name" value={g.name} />
                                        <ReadField label="Number" value={g.number} />
                                        <ReadField label="Relation" value={g.relation} />
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            </div>{/* end body row */}
        </div>
    );
}
