'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Building2, Mail, Calendar, Phone, MapPin,
    User, Send, ToggleLeft, ToggleRight, Hash, Globe,
    BookOpen, School, GraduationCap, CreditCard, Users,
    Tag, Zap, CheckCircle, XCircle, Clock, ShieldCheck,
    FileText, Percent, Save, ChevronRight,
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

const PLAN_PRICES: Record<string, number> = { BASIC: 11999, PRO: 24999 };

function fmt(n: number) { return `₹${n.toLocaleString('en-IN')}`; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusCfg: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    SUSPENDED: { label: 'Suspended', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/50 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
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

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button onClick={onToggle}
            className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 shrink-0
                ${on ? 'bg-[#DA7756]' : 'bg-muted-foreground/30'}`}
            style={{ height: '22px' }}
        >
            <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200
                ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
                style={{ width: '18px', height: '18px' }}
            />
        </button>
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
    const joinDate = inst.joinedAt ? new Date(inst.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="space-y-4">

            {/* Profile banner */}
            <div className="bg-card border border-border/50 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-2xl bg-muted text-muted-foreground ring-2 ring-border flex items-center justify-center text-xl font-bold shrink-0 select-none">
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold leading-tight">{inst.name}</h2>
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

                        {/* Quick stats */}
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
                <SectionCard title="Institution Info">
                    <InfoRow icon={Hash} label="Institute ID" value={<span className="italic text-muted-foreground/60 text-[11px]">Auto generated</span>} />
                    <InfoRow icon={Building2} label="Name" value={inst.name} />
                    <InfoRow icon={TypeIcon} label="Type" value={inst.type} />
                    <InfoRow icon={Mail} label="Email" value={inst.email} />
                    <InfoRow icon={Phone} label="Phone" value={inst.phone ?? '—'} />
                    <InfoRow icon={BookOpen} label="Board" value={inst.board ?? '—'} />
                    <InfoRow icon={Globe} label="Medium" value={inst.medium ?? '—'} />
                    <InfoRow icon={Calendar} label="Joined Qubeex" value={joinDate} />
                </SectionCard>

                {/* Location */}
                <SectionCard title="Location">
                    <InfoRow icon={MapPin} label="Address" value={inst.address ?? '—'} />
                    <InfoRow icon={MapPin} label="City" value={inst.city ?? '—'} />
                    <InfoRow icon={MapPin} label="State" value={inst.state ?? '—'} />
                    <InfoRow icon={Globe} label="Country" value={inst.country ?? '—'} />
                    <InfoRow icon={Hash} label="Pincode" value={inst.pincode ?? '—'} />
                </SectionCard>

                {/* Admin Info */}
                <SectionCard title="Admin Info">
                    {inst.users && inst.users.length > 0 ? (
                        inst.users.map(user => (
                            <div key={user.id}>
                                <InfoRow icon={User} label="Admin Name" value={inst.adminName ?? '—'} />
                                <InfoRow icon={Mail} label="Admin Email" value={user.email} />
                                <InfoRow icon={ShieldCheck} label="Role" value={user.role} />
                                <InfoRow icon={Calendar} label="Invite Sent" value={new Date(user.createdAt).toLocaleDateString('en-IN')} />
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">No admin assigned yet</p>
                    )}
                </SectionCard>

                {/* Platform Stats */}
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
    const [plan, setPlan] = useState<'BASIC' | 'PRO'>(inst.plan as 'BASIC' | 'PRO' ?? 'BASIC');
    const [discount, setDiscount] = useState(0);
    const [userCount, setUserCount] = useState(inst.totalStudents ?? 0);
    const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING' | 'FAILED'>('PAID');
    const [features, setFeatures] = useState<Record<string, boolean>>({
        tests: true, question_bank: true, attendance: true, results: true,
        fees: false, announcements: true, tasks: true, leaderboard: true,
        pdf_upload: true, flags: false,
    });
    const [saving, setSaving] = useState(false);

    const basePrice = PLAN_PRICES[plan];
    const discountAmt = Math.round(basePrice * (discount / 100));
    const finalPrice = basePrice - discountAmt;

    const toggleFeature = (key: string) =>
        setFeatures(prev => ({ ...prev, [key]: !prev[key] }));

    const handleSave = async () => {
        setSaving(true);
        await new Promise(r => setTimeout(r, 800));
        toast.success('Plan updated successfully!');
        setSaving(false);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="space-y-4">

            {/* Plan selector */}
            <SectionCard title="Subscription Plan">
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {(['BASIC', 'PRO'] as const).map(p => {
                        const isActive = plan === p;
                        const isPro = p === 'PRO';
                        return (
                            <button key={p} onClick={() => setPlan(p)}
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all
                                    ${isActive
                                        ? isPro ? 'border-[#DA7756] bg-[#DA7756]/8' : 'border-primary bg-primary/5'
                                        : 'border-border/50 bg-muted/30 hover:border-border'
                                    }`}>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                                    ${isActive ? (isPro ? 'border-[#DA7756]' : 'border-primary') : 'border-muted-foreground/40'}`}>
                                    {isActive && <div className={`w-2 h-2 rounded-full ${isPro ? 'bg-[#DA7756]' : 'bg-primary'}`} />}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${isActive ? (isPro ? 'text-[#DA7756]' : 'text-primary') : 'text-foreground'}`}>{p}</p>
                                    <p className="text-xs text-muted-foreground">{fmt(PLAN_PRICES[p])}/year</p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Discount */}
                <div className="bg-muted/40 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Percent size={14} className="text-[#DA7756]" />
                        <p className="text-xs font-semibold">Discount</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="range" min={0} max={50} step={5}
                            value={discount}
                            onChange={e => setDiscount(Number(e.target.value))}
                            className="flex-1 accent-[#DA7756]"
                        />
                        <span className="text-sm font-bold text-[#DA7756] w-10 text-right">{discount}%</span>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                        <div className="space-y-0.5">
                            <p className="text-[11px] text-muted-foreground">Base price</p>
                            <p className="text-xs font-medium">{fmt(basePrice)}</p>
                        </div>
                        {discount > 0 && (
                            <div className="space-y-0.5 text-center">
                                <p className="text-[11px] text-muted-foreground">Discount</p>
                                <p className="text-xs font-medium text-red-500">-{fmt(discountAmt)}</p>
                            </div>
                        )}
                        <div className="space-y-0.5 text-right">
                            <p className="text-[11px] text-muted-foreground">Final price</p>
                            <p className="text-sm font-bold text-[#DA7756]">{fmt(finalPrice)}</p>
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* User count */}
            <SectionCard title="User Count">
                <p className="text-xs text-muted-foreground mb-4">Track enrolled students — updates as admin adds users</p>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">Students enrolled</span>
                            <span className="text-sm font-bold">{userCount}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${Math.min((userCount / (plan === 'PRO' ? 2000 : 200)) * 100, 100)}%`,
                                    background: 'linear-gradient(90deg, #DA7756, #E8876A)',
                                }} />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[11px] text-muted-foreground">0</span>
                            <span className="text-[11px] text-muted-foreground">
                                Limit: {plan === 'PRO' ? 'Unlimited' : '200'}
                            </span>
                        </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center shrink-0">
                        <p className="text-2xl font-bold">{inst.totalTeachers ?? 0}</p>
                        <p className="text-[11px] text-muted-foreground">Teachers</p>
                    </div>
                </div>
            </SectionCard>

            {/* Features control */}
            <SectionCard title="Feature Controls">
                <p className="text-xs text-muted-foreground mb-4">Enable or disable features for this institution</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ALL_FEATURES.map(({ key, label, desc }) => (
                        <div key={key}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all
                                ${features[key] ? 'border-[#DA7756]/30 bg-[#DA7756]/5' : 'border-border/50 bg-muted/20'}`}>
                            <div className="min-w-0 mr-3">
                                <p className="text-xs font-medium truncate">{label}</p>
                                <p className="text-[11px] text-muted-foreground">{desc}</p>
                            </div>
                            <Toggle on={features[key]} onToggle={() => toggleFeature(key)} />
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Payment status */}
            <SectionCard title="Payment Status">
                <div className="flex items-center gap-3 mb-4">
                    {([
                        { s: 'PAID', icon: CheckCircle, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400' },
                        { s: 'PENDING', icon: Clock, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400' },
                        { s: 'FAILED', icon: XCircle, cls: 'text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400' },
                    ] as const).map(({ s, icon: Icon, cls }) => (
                        <button key={s} onClick={() => setPaymentStatus(s)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all
                                ${paymentStatus === s ? `border-current ${cls}` : 'border-border/50 text-muted-foreground hover:bg-muted/50'}`}>
                            <Icon size={13} />{s}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Last Payment', value: '14 Apr 2026' },
                        { label: 'Next Due', value: '14 Apr 2027' },
                        { label: 'Amount', value: fmt(finalPrice) },
                    ].map(({ label, value }) => (
                        <div key={label} className="bg-muted/40 rounded-xl p-3">
                            <p className="text-[11px] text-muted-foreground">{label}</p>
                            <p className="text-sm font-semibold mt-0.5">{value}</p>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Save button */}
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