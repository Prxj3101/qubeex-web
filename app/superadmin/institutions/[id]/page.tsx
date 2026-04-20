'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Building2, Mail, Calendar, Phone, MapPin,
    User, Send, ToggleLeft, ToggleRight, Hash, Globe,
    BookOpen, School, GraduationCap, CreditCard, Users,
    Tag, Zap, CheckCircle, XCircle, Clock, ShieldCheck,
    FileText, Percent, Save, ChevronRight, Pencil, X, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Institution } from '@/types';
import api from '@/lib/api';
import { toast } from 'sonner';

// ─── Mock Institution ─────────────────────────────────────────────────────────

const MOCK_INST: Institution & {
    phone?: string; city?: string; state?: string; address?: string;
    pincode?: string; country?: string; board?: string; medium?: string;
    plan?: string; joinedAt?: string; adminName?: string;
    totalStudents?: number; totalTeachers?: number;
} = {
    id: 's1',
    name: 'Delhi Public School',
    type: 'SCHOOL',
    email: 'admin@dps.edu.in',
    phone: '+91 98100 11223',
    city: 'New Delhi',
    state: 'Delhi',
    address: 'Mathura Road, Near Siri Fort',
    pincode: '110003',
    country: 'India',
    board: 'CBSE',
    medium: 'English',
    status: 'ACTIVE',
    plan: 'PRO',
    joinedAt: '2025-11-14T09:00:00Z',
    adminName: 'Rohit Sharma',
    totalStudents: 342,
    totalTeachers: 28,
    createdAt: '2025-11-14T09:00:00Z',
    updatedAt: '2026-04-10T12:00:00Z',
    users: [{ id: 'u1', email: 'rohit.sharma@dps.edu.in', role: 'ADMIN', createdAt: '2025-11-14T09:30:00Z' }],
};

// ─── Features list ────────────────────────────────────────────────────────────

const PRICING = {
    SCHOOL: {
        BASIC: { licence: 39999, monthly: 20, sixMonth: 17 },
        PRO: { licence: 69999, monthly: 25, sixMonth: 22 },
        TRIAL: { licence: 0, monthly: 0, sixMonth: 0 },
    },
    COLLEGE: {
        BASIC: { licence: 59999, monthly: 30, sixMonth: 27 },
        PRO: { licence: 89999, monthly: 35, sixMonth: 32 },
        TRIAL: { licence: 0, monthly: 0, sixMonth: 0 },
    },
    COACHING: {
        BASIC: { licence: 39999, monthly: 20, sixMonth: 17 },
        PRO: { licence: 69999, monthly: 25, sixMonth: 22 },
        TRIAL: { licence: 0, monthly: 0, sixMonth: 0 },
    },
};

const ALL_FEATURES = [
    { key: 'tests', label: 'Tests & Assessments', desc: 'Create and conduct tests' },
    { key: 'question_bank', label: 'Question Bank', desc: 'Manage question repository' },
    { key: 'attendance', label: 'Attendance Tracking', desc: 'Student attendance management' },
    { key: 'results', label: 'Results & Analytics', desc: 'Performance reports & analytics' },
    { key: 'fees', label: 'Fees Management', desc: 'Track fee payments' },
    { key: 'announcements', label: 'Announcements', desc: 'Post notices & updates' },
    { key: 'tasks', label: 'Tasks & Homework', desc: 'Assign & track tasks' },
    { key: 'leaderboard', label: 'Leaderboard', desc: 'Student ranking system' },
    { key: 'pdf_upload', label: 'PDF / Material Upload', desc: 'Share study materials' },
    { key: 'flags', label: 'Flags & Warnings', desc: 'Student disciplinary tracking' },
];

function fmt(n: number) { return `₹${n.toLocaleString('en-IN')}`; }

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button onClick={onToggle}
            className={`relative w-10 rounded-full transition-colors duration-200 shrink-0 ${on ? 'bg-[#DA7756]' : 'bg-muted-foreground/30'}`}
            style={{ height: '22px' }}>
            <div className={`absolute top-0.5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
                style={{ width: '18px', height: '18px' }} />
        </button>
    );
}

function InfoBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-sm font-bold mt-0.5">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusCfg: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    SUSPENDED: { label: 'Suspended', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

function SectionCard({ title, children, editBtn }: {
    title: string;
    children: React.ReactNode;
    editBtn?: React.ReactNode;
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

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
            <Icon size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
            <span className="text-xs font-medium text-foreground flex-1">{value}</span>
        </div>
    );
}

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

// ─── View Details Tab ─────────────────────────────────────────────────────────

function ViewDetailsTab({ inst, onStatusToggle, onResendInvite }: {
    inst: typeof MOCK_INST;
    onStatusToggle: () => void;
    onResendInvite: () => void;
}) {
    const status = statusCfg[inst.status] ?? statusCfg['PENDING'];
    const TypeIcon = inst.type === 'SCHOOL' ? School : inst.type === 'COLLEGE' ? GraduationCap : BookOpen;
    const initials = inst.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const joinDate = inst.joinedAt
        ? new Date(inst.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    const [editingSection, setEditingSection] = useState<string | null>(null);

    const [instDraft, setInstDraft] = useState({ name: inst.name, email: inst.email, phone: inst.phone ?? '', board: inst.board ?? '', medium: inst.medium ?? '' });
    const [instSaved, setInstSaved] = useState({ ...instDraft });

    const [locDraft, setLocDraft] = useState({ address: inst.address ?? '', city: inst.city ?? '', state: inst.state ?? '', country: inst.country ?? '', pincode: inst.pincode ?? '' });
    const [locSaved, setLocSaved] = useState({ ...locDraft });

    const [adminDraft, setAdminDraft] = useState({ adminName: inst.adminName ?? '' });
    const [adminSaved, setAdminSaved] = useState({ ...adminDraft });

    const cancelEdit = (section: string) => {
        if (section === 'inst') setInstDraft({ ...instSaved });
        if (section === 'loc') setLocDraft({ ...locSaved });
        if (section === 'admin') setAdminDraft({ ...adminSaved });
        setEditingSection(null);
    };
    const saveEdit = (section: string) => {
        if (section === 'inst') setInstSaved({ ...instDraft });
        if (section === 'loc') setLocSaved({ ...locDraft });
        if (section === 'admin') setAdminSaved({ ...adminDraft });
        setEditingSection(null);
        toast.success('Changes saved');
    };

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="space-y-4">

            {/* Profile banner */}
            <div className="bg-card border border-border/50 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-muted text-muted-foreground ring-2 ring-border flex items-center justify-center text-xl font-bold shrink-0 select-none">
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold leading-tight">{instSaved.name}</h2>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                        <TypeIcon size={11} />{inst.type}
                                    </span>
                                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${status.cls}`}>
                                        {status.label}
                                    </span>
                                    {inst.plan && (
                                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                                            style={{ background: inst.plan === 'PRO' ? '#DA775620' : '#7C3AED20', color: inst.plan === 'PRO' ? '#DA7756' : '#7C3AED' }}>
                                            {inst.plan}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={onResendInvite}
                                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                    <Send size={12} /> Resend Invite
                                </button>
                                <button onClick={onStatusToggle}
                                    className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all
                                        ${inst.status === 'ACTIVE'
                                            ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400'
                                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400'
                                        }`}>
                                    {inst.status === 'ACTIVE'
                                        ? <><ToggleLeft size={13} /> Suspend</>
                                        : <><ToggleRight size={13} /> Activate</>
                                    }
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                            {[
                                { label: 'Students', value: inst.totalStudents ?? '—' },
                                { label: 'Teachers', value: inst.totalTeachers ?? '—' },
                                { label: 'Joined', value: joinDate },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <p className="text-lg font-bold leading-tight">{value}</p>
                                    <p className="text-[11px] text-muted-foreground">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Institution Info */}
                <SectionCard title="Institution Info"
                    editBtn={
                        editingSection === 'inst'
                            ? <div className="flex gap-1.5">
                                <button onClick={() => cancelEdit('inst')} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:opacity-80 transition-all"><X size={11} /> Cancel</button>
                                <button onClick={() => saveEdit('inst')}
                                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-90 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    <Check size={11} /> Save
                                </button>                            </div>
                            : <button onClick={() => setEditingSection('inst')} className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"><Pencil size={11} /> Edit</button>
                    }>
                    {editingSection === 'inst' ? (
                        <>
                            <EditableField label="Name" value={instDraft.name} onChange={v => setInstDraft(d => ({ ...d, name: v }))} />
                            <EditableField label="Email" value={instDraft.email} onChange={v => setInstDraft(d => ({ ...d, email: v }))} />
                            <EditableField label="Phone" value={instDraft.phone} onChange={v => setInstDraft(d => ({ ...d, phone: v }))} />
                            <EditableField label="Board" value={instDraft.board} onChange={v => setInstDraft(d => ({ ...d, board: v }))} />
                            <EditableField label="Medium" value={instDraft.medium} onChange={v => setInstDraft(d => ({ ...d, medium: v }))} />
                        </>
                    ) : (
                        <>
                            <InfoRow icon={Hash} label="Institute ID" value={<span className="italic text-muted-foreground/60 text-[11px]">Auto generated</span>} />
                            <InfoRow icon={Building2} label="Name" value={instSaved.name} />
                            <InfoRow icon={TypeIcon} label="Type" value={inst.type} />
                            <InfoRow icon={Mail} label="Email" value={instSaved.email} />
                            <InfoRow icon={Phone} label="Phone" value={instSaved.phone || '—'} />
                            <InfoRow icon={BookOpen} label="Board" value={instSaved.board || '—'} />
                            <InfoRow icon={Globe} label="Medium" value={instSaved.medium || '—'} />
                            <InfoRow icon={Calendar} label="Joined" value={joinDate} />
                        </>
                    )}
                </SectionCard>

                {/* Location */}
                <SectionCard title="Location"
                    editBtn={
                        editingSection === 'loc'
                            ? <div className="flex gap-1.5">
                                <button onClick={() => cancelEdit('loc')} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:opacity-80 transition-all"><X size={11} /> Cancel</button>
                                <button onClick={() => saveEdit('inst')}
                                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-90 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    <Check size={11} /> Save
                                </button>                            </div>
                            : <button onClick={() => setEditingSection('loc')} className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"><Pencil size={11} /> Edit</button>
                    }>
                    {editingSection === 'loc' ? (
                        <>
                            <EditableField label="Address" value={locDraft.address} onChange={v => setLocDraft(d => ({ ...d, address: v }))} />
                            <EditableField label="City" value={locDraft.city} onChange={v => setLocDraft(d => ({ ...d, city: v }))} />
                            <EditableField label="State" value={locDraft.state} onChange={v => setLocDraft(d => ({ ...d, state: v }))} />
                            <EditableField label="Country" value={locDraft.country} onChange={v => setLocDraft(d => ({ ...d, country: v }))} />
                            <EditableField label="Pincode" value={locDraft.pincode} onChange={v => setLocDraft(d => ({ ...d, pincode: v }))} />
                        </>
                    ) : (
                        <>
                            <InfoRow icon={MapPin} label="Address" value={locSaved.address || '—'} />
                            <InfoRow icon={MapPin} label="City" value={locSaved.city || '—'} />
                            <InfoRow icon={MapPin} label="State" value={locSaved.state || '—'} />
                            <InfoRow icon={Globe} label="Country" value={locSaved.country || '—'} />
                            <InfoRow icon={Hash} label="Pincode" value={locSaved.pincode || '—'} />
                        </>
                    )}
                </SectionCard>

                {/* Admin Info */}
                <SectionCard title="Admin Info"
                    editBtn={
                        editingSection === 'admin'
                            ? <div className="flex gap-1.5">
                                <button onClick={() => cancelEdit('admin')} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:opacity-80 transition-all"><X size={11} /> Cancel</button>
                                <button onClick={() => saveEdit('inst')}
                                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-90 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    <Check size={11} /> Save
                                </button>                            </div>
                            : <button onClick={() => setEditingSection('admin')} className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"><Pencil size={11} /> Edit</button>
                    }>
                    {inst.users && inst.users.length > 0 ? inst.users.map(user => (
                        <div key={user.id}>
                            {editingSection === 'admin'
                                ? <EditableField label="Admin Name" value={adminDraft.adminName} onChange={v => setAdminDraft(d => ({ ...d, adminName: v }))} />
                                : <InfoRow icon={User} label="Admin Name" value={adminSaved.adminName || '—'} />
                            }
                            <InfoRow icon={Mail} label="Admin Email" value={user.email} />
                            <InfoRow icon={ShieldCheck} label="Role" value={user.role} />
                            <InfoRow icon={Calendar} label="Invite Sent" value={new Date(user.createdAt).toLocaleDateString('en-IN')} />
                        </div>
                    )) : (
                        <p className="text-sm text-muted-foreground">No admin assigned yet</p>
                    )}
                </SectionCard>

                {/* Platform Stats — read only */}
                <SectionCard title="Platform Stats">
                    <InfoRow icon={Users} label="Total Students" value={inst.totalStudents ?? '—'} />
                    <InfoRow icon={User} label="Total Teachers" value={inst.totalTeachers ?? '—'} />
                    <InfoRow icon={FileText} label="Tests Conducted" value="124" />
                    <InfoRow icon={Zap} label="Last Active" value="Today, 2:30 PM" />
                    <InfoRow icon={Calendar} label="Last Updated" value={new Date(inst.updatedAt).toLocaleDateString('en-IN')} />
                </SectionCard>
            </div>
        </motion.div>
    );
}
// ─── Manage Plan Tab ──────────────────────────────────────────────────────────

function ManagePlanTab({ inst }: { inst: typeof MOCK_INST }) {
    const instType = (inst.type as keyof typeof PRICING) in PRICING ? inst.type as keyof typeof PRICING : 'SCHOOL';
    const pricing = PRICING[instType];

    const [plan, setPlan] = useState<'BASIC' | 'PRO' | 'TRIAL'>((inst.plan as 'BASIC' | 'PRO' | 'TRIAL') ?? 'BASIC');
    const [billing, setBilling] = useState<'MONTHLY' | 'SIX_MONTH'>('MONTHLY');
    const [discount, setDiscount] = useState(0);
    const [discountInput, setDiscountInput] = useState('0');
    const [predefinedUsers, setPredefinedUsers] = useState(inst.totalStudents ?? 100);
    const [predefinedInput, setPredefinedInput] = useState(String(inst.totalStudents ?? 100));
    const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING' | 'FAILED'>('PAID');
    const [features, setFeatures] = useState<Record<string, boolean>>({
        tests: true, question_bank: true, attendance: true, results: true,
        fees: false, announcements: true, tasks: true, leaderboard: true,
        pdf_upload: true, flags: false,
    });
    const [saving, setSaving] = useState(false);

    const activeUsers = (inst.totalStudents ?? 0) + (inst.totalTeachers ?? 0) + 1;
    const planPricing = pricing[plan];
    const licenceCost = planPricing.licence;
    const discountAmt = Math.round(licenceCost * (discount / 100));
    const finalLicence = licenceCost - discountAmt;

    // Monthly bill = active users × monthly rate
    const monthlyBill = activeUsers * planPricing.monthly;

    // 6 Month bill = predefined users × sixMonth rate × 6
    const sixMonthBill = predefinedUsers * planPricing.sixMonth * 6;

    // Extra users in 6 month = active - predefined (if active > predefined)
    const extraUsers = Math.max(0, activeUsers - predefinedUsers);
    const extraMonthly = extraUsers * planPricing.monthly;

    const handleDiscountSlider = (v: number) => {
        setDiscount(v);
        setDiscountInput(String(v));
    };

    const handleDiscountInput = (v: string) => {
        setDiscountInput(v);
        const num = Math.min(50, Math.max(0, Number(v) || 0));
        setDiscount(num);
    };

    const handlePredefinedSlider = (v: number) => {
        setPredefinedUsers(v);
        setPredefinedInput(String(v));
    };

    const handlePredefinedInput = (v: string) => {
        setPredefinedInput(v);
        const num = Math.max(1, Number(v) || 1);
        setPredefinedUsers(num);
    };

    const toggleFeature = (key: string) =>
        setFeatures(prev => ({ ...prev, [key]: !prev[key] }));

    const handleSave = async () => {
        setSaving(true);
        await new Promise(r => setTimeout(r, 800));
        toast.success('Plan updated successfully!');
        setSaving(false);
    };

    const PLANS = [
        { key: 'BASIC' as const, label: 'Basic', licence: pricing.BASIC.licence, activeColor: 'text-primary', dot: 'bg-primary', activeBorder: 'border-primary bg-primary/5' },
        { key: 'PRO' as const, label: 'Pro', licence: pricing.PRO.licence, activeColor: 'text-[#DA7756]', dot: 'bg-[#DA7756]', activeBorder: 'border-[#DA7756] bg-[#DA7756]/5' },
        { key: 'TRIAL' as const, label: 'Trial', licence: 0, activeColor: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', activeBorder: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="space-y-4">

            {/* ── 1. Plan Selector ── */}
            <SectionCard title="Subscription Plan">

                {/* Plan buttons */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                    {PLANS.map(p => {
                        const isActive = plan === p.key;
                        return (
                            <button key={p.key} onClick={() => setPlan(p.key)}
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${isActive ? p.activeBorder : 'border-border/50 bg-muted/30 hover:border-border'}`}>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isActive ? 'border-current' : 'border-muted-foreground/40'}`}>
                                    {isActive && <div className={`w-2 h-2 rounded-full ${p.dot}`} />}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${isActive ? p.activeColor : 'text-foreground'}`}>{p.label}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {p.key === 'TRIAL' ? 'Free trial' : `${fmt(p.licence)} one-time`}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Licence + Discount — only non-trial */}
                {plan !== 'TRIAL' && (
                    <div className="bg-muted/40 rounded-xl p-3.5 mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold flex items-center gap-1.5">
                                <Percent size={13} className="text-[#DA7756]" />
                                One-time Licence Fee
                            </p>
                            <p className="text-sm font-bold">{fmt(licenceCost)}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-3">Apply discount on one-time licence cost only</p>

                        {/* Discount slider + input */}
                        <div className="flex items-center gap-3">
                            <input
                                type="range" min={0} max={50} step={1}
                                value={discount}
                                onChange={e => handleDiscountSlider(Number(e.target.value))}
                                className="flex-1 accent-[#DA7756] h-1.5 cursor-pointer"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                                <input
                                    type="number" min={0} max={50}
                                    value={discountInput}
                                    onChange={e => handleDiscountInput(e.target.value)}
                                    className="w-14 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-[#DA7756] transition-all"
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                            </div>
                        </div>

                        {/* Price summary */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                            <div>
                                <p className="text-[11px] text-muted-foreground">Original</p>
                                <p className="text-xs font-medium line-through text-muted-foreground">{discount > 0 ? fmt(licenceCost) : ''}</p>
                            </div>
                            {discount > 0 && (
                                <div className="text-center">
                                    <p className="text-[11px] text-muted-foreground">Discount</p>
                                    <p className="text-xs font-medium text-red-500">-{fmt(discountAmt)}</p>
                                </div>
                            )}
                            <div className="text-right">
                                <p className="text-[11px] text-muted-foreground">Final licence</p>
                                <p className="text-sm font-bold text-[#DA7756]">{fmt(finalLicence)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </SectionCard>

            {/* ── 2. Billing Cycle ── */}
            {plan !== 'TRIAL' && (
                <SectionCard title="Billing Cycle">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {[
                            { key: 'MONTHLY' as const, label: 'Monthly', sub: 'Billed end of each month based on active users', rate: planPricing.monthly },
                            { key: 'SIX_MONTH' as const, label: '6 Months', sub: 'Predefined user count, paid upfront', rate: planPricing.sixMonth },
                        ].map(b => (
                            <button key={b.key} onClick={() => setBilling(b.key)}
                                className={`flex flex-col gap-1 p-4 rounded-xl border-2 text-left transition-all ${billing === b.key ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'}`}>
                                <div className="flex items-center justify-between">
                                    <p className={`text-sm font-bold ${billing === b.key ? 'text-primary' : 'text-foreground'}`}>{b.label}</p>
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${billing === b.key ? 'border-primary' : 'border-muted-foreground/40'}`}>
                                        {billing === b.key && <div className="w-2 h-2 rounded-full bg-primary" />}
                                    </div>
                                </div>
                                <p className="text-[11px] text-muted-foreground">{b.sub}</p>
                                <p className="text-xs font-semibold text-primary mt-1">{fmt(b.rate)}/user</p>
                            </button>
                        ))}
                    </div>

                    {/* Monthly bill preview */}
                    {billing === 'MONTHLY' && (
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Month Estimate</p>
                            <div className="grid grid-cols-3 gap-3">
                                <InfoBox label="Active Users" value={String(activeUsers)} sub="Admin + Teachers + Students" />
                                <InfoBox label="Rate per User" value={fmt(planPricing.monthly)} sub="per month" />
                                <InfoBox label="Estimated Bill" value={fmt(monthlyBill)} sub="end of month" />
                            </div>
                            <div className="p-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-200/50 dark:border-violet-900/50">
                                <p className="text-[11px] text-violet-600 dark:text-violet-400">
                                    💡 Bill is calculated on active user count at end of each month. Users can be added or removed anytime.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 6 Month plan */}
                    {billing === 'SIX_MONTH' && (
                        <div className="space-y-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">6 Month Plan Setup</p>

                            {/* Predefined user count */}
                            <div className="bg-muted/40 rounded-xl p-3.5">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold">Predefined User Count</p>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number" min={1}
                                            value={predefinedInput}
                                            onChange={e => handlePredefinedInput(e.target.value)}
                                            className="w-16 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-primary transition-all"
                                        />
                                        <span className="text-xs text-muted-foreground">users</span>
                                    </div>
                                </div>
                                <input
                                    type="range" min={1} max={2000} step={1}
                                    value={predefinedUsers}
                                    onChange={e => handlePredefinedSlider(Number(e.target.value))}
                                    className="w-full accent-[#7C3AED] h-1.5 cursor-pointer"
                                />
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] text-muted-foreground">1</span>
                                    <span className="text-[10px] text-muted-foreground">2000</span>
                                </div>
                            </div>

                            {/* Bill summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <InfoBox label="Predefined Users" value={String(predefinedUsers)} sub="committed count" />
                                <InfoBox label="Rate per User" value={fmt(planPricing.sixMonth)} sub="per user × 6 months" />
                                <InfoBox label="Upfront Amount" value={fmt(sixMonthBill)} sub="total for 6 months" />
                            </div>

                            {/* Extra users warning */}
                            {extraUsers > 0 && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200/50 dark:border-amber-900/50">
                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                                        ⚠️ {extraUsers} extra user{extraUsers > 1 ? 's' : ''} detected
                                    </p>
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                        Current active users ({activeUsers}) exceeds predefined count ({predefinedUsers}). Extra {extraUsers} user{extraUsers > 1 ? 's' : ''} will be billed at monthly rate ({fmt(planPricing.monthly)}/user/month) = {fmt(extraMonthly)}/month additionally.
                                    </p>
                                </div>
                            )}

                            <div className="p-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-200/50 dark:border-violet-900/50">
                                <p className="text-[11px] text-violet-600 dark:text-violet-400">
                                    💡 Institution commits to {predefinedUsers} users for 6 months regardless of actual usage. Any additional users beyond this count will be charged at monthly rate (₹{planPricing.monthly}/user/month).
                                </p>
                            </div>
                        </div>
                    )}
                </SectionCard>
            )}

            {/* ── 3. User Count ── */}
            <SectionCard title="Current Users">
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: 'Admin', value: 1, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-950/50' },
                        { label: 'Teachers', value: inst.totalTeachers ?? 0, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/50' },
                        { label: 'Students', value: inst.totalStudents ?? 0, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950/50' },
                        { label: 'Total', value: activeUsers, color: 'text-foreground', bg: 'bg-muted/50' },
                    ].map(({ label, value, color, bg }) => (
                        <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                            <p className={`text-xl font-black ${color}`}>{value}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* ── 4. Feature Controls ── */}
            <SectionCard title="Feature Controls">
                <p className="text-xs text-muted-foreground mb-4">Enable or disable features for this institution</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ALL_FEATURES.map(({ key, label, desc }) => (
                        <div key={key}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${features[key] ? 'border-[#DA7756]/30 bg-[#DA7756]/5' : 'border-border/50 bg-muted/20'}`}>
                            <div className="min-w-0 mr-3">
                                <p className="text-xs font-medium truncate">{label}</p>
                                <p className="text-[11px] text-muted-foreground">{desc}</p>
                            </div>
                            <Toggle on={features[key]} onToggle={() => toggleFeature(key)} />
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* ── 5. Payment Status ── */}
            <SectionCard title="Payment Status">
                <div className="flex items-center gap-3 mb-4">
                    {([
                        { s: 'PAID', icon: CheckCircle, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400' },
                        { s: 'PENDING', icon: Clock, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400' },
                        { s: 'FAILED', icon: XCircle, cls: 'text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400' },
                    ] as const).map(({ s, icon: Icon, cls }) => (
                        <button key={s} onClick={() => setPaymentStatus(s)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${paymentStatus === s ? `border-current ${cls}` : 'border-border/50 text-muted-foreground hover:bg-muted/50'}`}>
                            <Icon size={13} />{s}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <InfoBox label="Last Payment" value="14 Apr 2026" />
                    <InfoBox label="Next Due" value={billing === 'MONTHLY' ? '14 May 2026' : '14 Oct 2026'} />
                    <InfoBox label="Amount Due" value={billing === 'MONTHLY' ? fmt(monthlyBill) : fmt(sixMonthBill)} />
                </div>
            </SectionCard>

            {/* ── Save ── */}
            <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                    <Save size={15} />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InstitutionDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [institution, setInstitution] = useState<typeof MOCK_INST | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'details' | 'plan'>('details');

    // Check if opened from Manage Plan button
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tab') === 'plan') setActiveTab('plan');
        }
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/superadmin/institutions/${id}`);
                setInstitution(res.data.data);
            } catch {
                setInstitution(MOCK_INST); // fallback to mock
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const handleStatusToggle = async () => {
        if (!institution) return;
        const newStatus = institution.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        try {
            await api.patch(`/superadmin/institutions/${id}/status`, { status: newStatus });
            toast.success(`Institution ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`);
            setInstitution(prev => prev ? { ...prev, status: newStatus } : prev);
        } catch {
            setInstitution(prev => prev ? { ...prev, status: newStatus } : prev); // mock toggle
            toast.success(`Institution ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`);
        }
    };

    const handleResendInvite = async () => {
        if (!institution) return;
        try {
            await api.post(`/superadmin/institutions/${id}/resend-invite`, { email: institution.users?.[0]?.email });
            toast.success('Invite resent successfully');
        } catch {
            toast.success('Invite resent successfully'); // mock
        }
    };

    if (loading) return (
        <div className="space-y-4 animate-pulse">
            <div className="h-8 w-48 bg-muted rounded-xl" />
            <div className="h-40 w-full bg-muted rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-48 bg-muted rounded-2xl" />
                <div className="h-48 bg-muted rounded-2xl" />
            </div>
        </div>
    );

    if (!institution) return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <Building2 size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Institution not found</p>
        </div>
    );

    const TABS = [
        { key: 'details' as const, label: 'View Details' },
        { key: 'plan' as const, label: 'Manage Plan' },
    ];

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all">
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <h1 className="text-xl font-bold">{institution.name}</h1>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        Institutions <ChevronRight size={11} /> {institution.name}
                    </p>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="relative">
                            {isActive && (
                                <motion.div layoutId="instDetailTab"
                                    className="absolute inset-0 rounded-4xl bg-primary"
                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                />
                            )}
                            <div className={`relative z-10 px-5 py-2 text-sm font-medium rounded-4xl transition-colors
                                ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                {tab.label}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Tab Content ── */}
            <AnimatePresence mode="wait">
                {activeTab === 'details' ? (
                    <ViewDetailsTab
                        key="details"
                        inst={institution}
                        onStatusToggle={handleStatusToggle}
                        onResendInvite={handleResendInvite}
                    />
                ) : (
                    <ManagePlanTab key="plan" inst={institution} />
                )}
            </AnimatePresence>
        </div>
    );
}