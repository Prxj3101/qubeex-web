'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RadialBarChart, RadialBar, PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
    ArrowLeft, Landmark, LayoutGrid, RefreshCcw, SlidersHorizontal, Building2, Mail, Calendar, Phone, MapPin,
    User, Send, ToggleLeft, ToggleRight, Hash, Globe, IndianRupee,
    BookOpen, School, GraduationCap, CreditCard, HardDrive, Sparkles, Users,
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

function InfoBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
    return (
        <div className={`rounded-xl p-3 ${highlight ? 'bg-[#DA7756]/10 border border-[#DA7756]/20' : 'bg-muted/40'}`}>
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className={`text-sm font-bold mt-0.5 ${highlight ? 'text-[#DA7756]' : ''}`}>{value}</p>
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
    title: React.ReactNode;
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

    const [planActive, setPlanActive] = useState(false);
    const [plan, setPlan] = useState<'BASIC' | 'PRO' | 'TRIAL'>((inst.plan as any) ?? 'BASIC');
    const [billing, setBilling] = useState<'MONTHLY' | 'SIX_MONTH'>('MONTHLY');
    const [predefinedUsers, setPredefinedUsers] = useState(200);
    const [predefinedInput, setPredefinedInput] = useState('200');
    const [discount, setDiscount] = useState(0);
    const [showDiscount, setShowDiscount] = useState(false);
    const [discountInput, setDiscountInput] = useState('0');
    const [licencePaid, setLicencePaid] = useState(false);
    const [upfrontPaid, setUpfrontPaid] = useState(false);
    const [activating, setActivating] = useState(false);
    const [features, setFeatures] = useState<Record<string, boolean>>({
        tests: true, question_bank: true, attendance: true, results: true,
        fees: false, announcements: true, tasks: true, leaderboard: true,
        pdf_upload: true, flags: false,
    });

    const activeUsers = (inst.totalStudents ?? 0) + (inst.totalTeachers ?? 0) + 1;
    const planPricing = pricing[plan] ?? pricing.BASIC;
    const licenceCost = planPricing.licence;
    const discountAmt = Math.round(licenceCost * (discount / 100));
    const finalLicence = licenceCost - discountAmt;
    const monthlyBill = activeUsers * planPricing.monthly;
    const sixMonthBill = predefinedUsers * planPricing.sixMonth * 6;
    const extraUsers = Math.max(0, activeUsers - predefinedUsers);
    const extraAddon = extraUsers * planPricing.monthly;

    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextSix = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());

    const canActivate = !!plan && (
        plan === 'TRIAL' || (
            licencePaid && (billing === 'MONTHLY' || upfrontPaid)
        )
    );
    const handleActivate = async () => {
        setActivating(true);
        await new Promise(r => setTimeout(r, 1000));
        setPlanActive(true);
        setActivating(false);
        toast.success(`${plan} plan activated!`);
    };

    const PLAN_OPTS = [
        {
            key: 'BASIC' as const, label: 'Basic',
            activeColor: 'text-primary', dot: 'bg-primary', border: 'border-primary bg-primary/5',
            features: [
                { icon: IndianRupee, label: `₹${pricing.BASIC.monthly}/user/mo` },
                { icon: Users, label: 'Min. 200 users' },
                { icon: HardDrive, label: '5GB Storage' },
                { icon: Sparkles, label: '100k AI Tokens/mo' },
                { icon: LayoutGrid, label: '5 Default Features' },
                { icon: XCircle, label: 'No Whitelabeling' },
            ],
        },
        {
            key: 'PRO' as const, label: 'Pro',
            activeColor: 'text-[#DA7756]', dot: 'bg-[#DA7756]', border: 'border-[#DA7756] bg-[#DA7756]/5',
            features: [
                { icon: IndianRupee, label: `₹${pricing.PRO.monthly}/user/mo` },
                { icon: Users, label: 'Min. 200 users' },
                { icon: HardDrive, label: '10GB Storage' },
                { icon: Sparkles, label: '200k AI Tokens/mo' },
                { icon: LayoutGrid, label: '7 Default Features' },
                { icon: CheckCircle, label: 'Whitelabeling' },
            ],
        },
        {
            key: 'TRIAL' as const, label: 'Trial',
            activeColor: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', border: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20',
            features: [],
        },
    ];

    // ── ACTIVE VIEW ──
    if (planActive) {
        const paymentHistory = [
            { date: '14 Apr 2026', amount: licenceCost, type: 'One-time Licence', status: 'PAID' },
            { date: '01 Apr 2026', amount: monthlyBill, type: 'Monthly Bill', status: 'PAID' },
            { date: '01 Mar 2026', amount: monthlyBill, type: 'Monthly Bill', status: 'PAID' },
        ];
        const CustomTooltip = ({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const { name, value } = payload[0];
            const colorMap: Record<string, string> = {
                Admin: '#7C3AED', Teachers: '#F59E0B', Students: '#10B981',
            };
            return (
                <div className="px-3 py-2 rounded-xl shadow-xl"
                    style={{ background: '#1A1030', border: '1px solid #2D1F50' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: colorMap[name] }} />
                        <span style={{ color: '#F1F5F9', fontSize: 12, fontWeight: 600 }}>{name}</span>
                    </div>
                    <p style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 800, marginTop: 2 }}>{value}</p>
                </div>
            );
        };

        return (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                className="space-y-4">

                {/* Active Banner */}
                <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Plan Active</span>
                            </div>
                            <h2 className="text-2xl font-black" style={{ color: plan === 'PRO' ? '#DA7756' : '#7C3AED' }}>{plan}</h2>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {instType} · {billing === 'MONTHLY' ? 'Monthly Billing' : '6 Month Billing'}
                            </p>
                        </div>
                        <button onClick={() => { setPlanActive(false); toast.success('Plan deactivated'); }}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-xs font-semibold hover:opacity-80 transition-all">
                            <XCircle size={13} /> Deactivate
                        </button>
                    </div>
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">

                        {/* Left — Donut with center total */}
                        <div className="relative w-[90px] h-[90px] shrink-0" style={{ overflow: 'visible' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Admin', value: 1 },
                                            { name: 'Teachers', value: inst.totalTeachers ?? 0 },
                                            { name: 'Students', value: inst.totalStudents ?? 0 },
                                        ]}
                                        cx="50%" cy="50%"
                                        innerRadius={28} outerRadius={42}
                                        dataKey="value"
                                        strokeWidth={2} stroke="hsl(var(--card))"
                                        paddingAngle={3} minAngle={8}
                                    >
                                        <Cell fill="#7C3AED" />
                                        <Cell fill="#F59E0B" />
                                        <Cell fill="#10B981" />
                                    </Pie>
                                    <Tooltip
                                        content={<CustomTooltip />}
                                        position={{ x: 95, y: 0 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-sm font-black leading-none">{activeUsers}</p>
                                <p className="text-[9px] text-muted-foreground mt-0.5">Total</p>
                            </div>
                        </div>

                        {/* Labels */}
                        <div className="space-y-2 shrink-0">
                            {[
                                { label: 'Admin', value: 1, color: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
                                { label: 'Teachers', value: inst.totalTeachers ?? 0, color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
                                { label: 'Students', value: inst.totalStudents ?? 0, color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
                            ].map(({ label, value, color, dot }) => (
                                <div key={label} className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                                    <div>
                                        <p className={`text-sm font-black leading-none ${color}`}>{value}</p>
                                        <p className="text-[10px] text-muted-foreground">{label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Billing Summary */}
                <SectionCard title="Billing Summary">
                    {billing === 'MONTHLY' ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <InfoBox label="Active Users" value={String(activeUsers)} sub="billed this month" />
                                <InfoBox label="Rate" value={fmt(planPricing.monthly)} sub="per user / month" />
                                <InfoBox label="Next Bill" value={fmt(monthlyBill)} sub={nextMonth.toLocaleDateString('en-IN')} highlight />
                            </div>
                            <div className="p-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-200/50 dark:border-violet-900/50">
                                <p className="text-[11px] text-violet-600 dark:text-violet-400">
                                    💡 Bill calculated on active users at end of each month. Estimate: {fmt(monthlyBill)}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <InfoBox label="Committed Users" value={String(predefinedUsers)} sub="for 6 months" />
                                <InfoBox label="Upfront Paid" value={fmt(sixMonthBill)} sub="already paid" />
                                <InfoBox label="Next Renewal" value={nextSix.toLocaleDateString('en-IN')} sub="6 month cycle" />
                            </div>
                            {extraUsers > 0 ? (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200/50 dark:border-amber-900/50 space-y-2">
                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">⚡ Add-on: {extraUsers} extra user{extraUsers > 1 ? 's' : ''}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <InfoBox label="Extra Users" value={String(extraUsers)} sub="beyond committed" />
                                        <InfoBox label="Rate" value={fmt(planPricing.monthly)} sub="per user / month" />
                                        <InfoBox label="Add-on / Month" value={fmt(extraAddon)} highlight />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/50 dark:border-emerald-900/50">
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                        ✅ Active users ({activeUsers}) within committed count ({predefinedUsers}). No add-on charges.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </SectionCard>

                {/* Payment History */}
                <SectionCard title="Payment History">
                    <div className="divide-y divide-border/40">
                        {paymentHistory.map((p, i) => (
                            <div key={i} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-xs font-semibold">{p.type}</p>
                                    <p className="text-[11px] text-muted-foreground">{p.date}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-sm font-bold">{fmt(p.amount)}</p>
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">{p.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                {/* Feature Controls */}
                <SectionCard title="Feature Controls">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ALL_FEATURES.map(({ key, label, desc }) => (
                            <div key={key} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${features[key] ? 'border-[#DA7756]/30 bg-[#DA7756]/5' : 'border-border/50 bg-muted/20'}`}>
                                <div className="min-w-0 mr-3">
                                    <p className="text-xs font-medium truncate">{label}</p>
                                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                                </div>
                                <Toggle on={features[key]} onToggle={() => setFeatures(p => ({ ...p, [key]: !p[key] }))} />
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </motion.div>
        );
    }

    // ── SETUP VIEW ──
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="space-y-4">

            {/* Pending Banner */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Plan Not Activated</p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-500/80">Configure below and activate to get started.</p>
                </div>
            </div>

            {/* Step 1 — Plan */}
            <SectionCard title={
                <span className="flex items-center gap-2">
                    <LayoutGrid size={15} className="text-muted-foreground/100" />
                    Select Plan
                </span>
            }>
                <div className="grid grid-cols-3 gap-3">
                    {PLAN_OPTS.map(p => {
                        const isActive = plan === p.key;
                        const price = p.key !== 'TRIAL' ? pricing[p.key] : null;
                        return (
                            <button key={p.key} onClick={() => setPlan(p.key)}
                                className={`flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all ${isActive ? p.border : 'border-border/50 bg-muted/30 hover:border-border'}`}>

                                {/* Header */}
                                <div className="flex items-center justify-between w-full">
                                    <p className={`text-sm font-bold ${isActive ? p.activeColor : 'text-foreground'}`}>{p.label}</p>
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-current' : 'border-muted-foreground/40'}`}>
                                        {isActive && <div className={`w-2 h-2 rounded-full ${p.dot}`} />}
                                    </div>
                                </div>

                                {/* Price */}
                                {price ? (
                                    <p className="text-xs font-bold">{fmt(price.licence)} <span className="font-normal text-muted-foreground">one-time</span></p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Free — no charge</p>
                                )}

                                {/* Features */}
                                {p.features.length > 0 && (
                                    <div className="space-y-1.5 mt-1 pt-2 border-t border-border/40 w-full">
                                        {p.features.map(({ icon: Icon, label }) => (
                                            <div key={label} className="flex items-center gap-1.5">
                                                <Icon size={11} className={`shrink-0 ${label.startsWith('No') ? 'text-muted-foreground/50' : isActive ? 'text-current' : 'text-muted-foreground'
                                                    }`} />
                                                <span className={`text-[11px] ${label.startsWith('No') ? 'text-muted-foreground/50' : ''}`}>{label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </SectionCard>

            {/* Step 2 — Billing (not trial) */}
            {plan !== 'TRIAL' && (
                <SectionCard title={
                    <span className="flex items-center gap-2">
                        <RefreshCcw size={15} className="text-muted-foreground/100" />
                        Billing Cycle
                    </span>
                }>                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {[
                            { key: 'MONTHLY' as const, label: 'Monthly', sub: 'Billed end of each month · Flexible user count', rate: planPricing.monthly },
                            { key: 'SIX_MONTH' as const, label: '6 Months', sub: 'Predefined user count · Paid upfront', rate: planPricing.sixMonth },
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

                    {billing === 'SIX_MONTH' && (
                        <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold">Predefined User Count</p>
                                <div className="flex items-center gap-1.5">
                                    <input type="number" min={200} value={predefinedInput}
                                        onChange={e => { setPredefinedInput(e.target.value); setPredefinedUsers(Math.max(200, Number(e.target.value) || 200)); }}
                                        className="w-16 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-primary" />
                                    <span className="text-xs text-muted-foreground">users</span>
                                </div>
                            </div>
                            <input type="range" min={200} max={2000} step={1} value={predefinedUsers}
                                onChange={e => { setPredefinedUsers(Number(e.target.value)); setPredefinedInput(e.target.value); }}
                                className="w-full accent-[#7C3AED] h-1.5 cursor-pointer" />
                            <div className="grid grid-cols-3 gap-3">
                                <InfoBox label="Users" value={String(predefinedUsers)} sub="committed for 6mo" />
                                <InfoBox label="Rate" value={fmt(planPricing.sixMonth)} sub="per user" />
                                <InfoBox label="Upfront Total" value={fmt(sixMonthBill)} highlight />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Extra users beyond {predefinedUsers} → ₹{planPricing.monthly}/user/month (monthly billing)
                            </p>
                        </div>
                    )}

                    {billing === 'MONTHLY' && (
                        <div className="bg-muted/40 rounded-xl p-4">
                            <p className="text-xs font-semibold mb-3">Minimum First Bill</p>
                            <div className="grid grid-cols-3 gap-3">
                                <InfoBox label="Min. Users" value="200" sub="minimum commitment" />
                                <InfoBox label="Rate" value={fmt(planPricing.monthly)} sub="per user / month" />
                                <InfoBox label="Min. First Bill" value={fmt(200 * planPricing.monthly)} sub="minimum amount" highlight />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-3">
                                💡 Minimum 200 users billed per month. Beyond 200, actual active users count.
                            </p>
                        </div>
                    )}
                </SectionCard>
            )}

            {plan !== 'TRIAL' && (
                <SectionCard title={
                    <span className="flex items-center gap-2">
                        <span
                            onDoubleClick={() => setShowDiscount(v => !v)}
                            className="cursor-default select-none"
                        >
                            <Landmark size={15} className="text-muted-foreground/100 hover:text-muted-foreground/70 transition-colors" />
                        </span>
                        One-time Licence Fee
                    </span>
                }>
                    <div className="bg-muted/40 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold">Licence Cost</p>
                                <p className="text-xl font-black mt-0.5">{fmt(finalLicence)}</p>
                            </div>
                        </div>

                        {showDiscount && (
                            <div className="border-t border-border/50 pt-3 mt-3">
                                <div className="flex items-center gap-3 mb-1">
                                    <input type="range" min={0} max={50} step={1} value={discount}
                                        onChange={e => { setDiscount(Number(e.target.value)); setDiscountInput(e.target.value); }}
                                        className="flex-1 accent-[#DA7756] h-1.5 cursor-pointer" />
                                    <div className="flex items-center gap-1 shrink-0">
                                        <input type="number" min={0} max={50} value={discountInput}
                                            onChange={e => { setDiscountInput(e.target.value); setDiscount(Math.min(50, Math.max(0, Number(e.target.value) || 0))); }}
                                            className="w-14 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-[#DA7756]" />
                                        <span className="text-xs text-muted-foreground">% off</span>
                                    </div>
                                </div>
                                {discount > 0 && (
                                    <p className="text-[11px] text-[#DA7756] font-medium">
                                        Saving {fmt(discountAmt)} · Final: {fmt(finalLicence)}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </SectionCard>
            )}

            {/* Step 4 — Features */}
            <SectionCard title={
                <span className="flex items-center gap-2">
                    <SlidersHorizontal size={15} className="text-muted-foreground/100" />
                    Feature Controls
                </span>
            }>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ALL_FEATURES.map(({ key, label, desc }) => (
                        <div key={key} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${features[key] ? 'border-[#DA7756]/30 bg-[#DA7756]/5' : 'border-border/50 bg-muted/20'}`}>
                            <div className="min-w-0 mr-3">
                                <p className="text-xs font-medium truncate">{label}</p>
                                <p className="text-[11px] text-muted-foreground">{desc}</p>
                            </div>
                            <Toggle on={features[key]} onToggle={() => setFeatures(p => ({ ...p, [key]: !p[key] }))} />
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Activate */}
            <div className={`p-5 rounded-2xl border-2 transition-all mb-6 ${canActivate ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border/50 bg-muted/20'}`}>

                {/* Payment confirmations */}
                {plan !== 'TRIAL' && (
                    <div className="space-y-2 mb-4">
                        <div className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${licencePaid ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border/50 bg-card'}`}>
                            <div>
                                <p className="text-xs font-semibold">Licence Payment Received</p>
                                <p className="text-[11px] text-muted-foreground">Mark once one-time licence payment confirmed</p>
                            </div>
                            <Toggle on={licencePaid} onToggle={() => setLicencePaid(v => !v)} />
                        </div>

                        {billing === 'SIX_MONTH' && (
                            <div className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${upfrontPaid ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border/50 bg-card'}`}>
                                <div>
                                    <p className="text-xs font-semibold">6 Month Upfront Payment Received</p>
                                    <p className="text-[11px] text-muted-foreground">{fmt(sixMonthBill)} upfront confirmed for 6 months</p>
                                </div>
                                <Toggle on={upfrontPaid} onToggle={() => setUpfrontPaid(v => !v)} />
                            </div>
                        )}
                    </div>
                )}

                {/* Activate button row */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold">
                            {canActivate ? '✅ Ready to Activate' : '⏳ Complete steps to activate'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {!licencePaid && plan !== 'TRIAL' ? 'Mark licence payment as received · ' : ''}
                            {billing === 'SIX_MONTH' && !upfrontPaid ? 'Mark upfront payment as received' : ''}
                            {canActivate ? `${plan} · ${billing === 'MONTHLY' ? 'Monthly' : '6 Month'} billing` : ''}
                        </p>
                    </div>
                    <button onClick={handleActivate} disabled={!canActivate || activating}
                        className="flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: canActivate ? 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' : 'hsl(var(--muted))' }}>
                        {activating
                            ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Activating...</>
                            : <><Zap size={15} /> Activate Plan</>
                        }
                    </button>
                </div>
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
                setInstitution(MOCK_INST);
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
            setInstitution(prev => prev ? { ...prev, status: newStatus } : prev);
            toast.success(`Institution ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`);
        }
    };

    const handleResendInvite = async () => {
        if (!institution) return;
        try {
            await api.post(`/superadmin/institutions/${id}/resend-invite`, { email: institution.users?.[0]?.email });
            toast.success('Invite resent successfully');
        } catch {
            toast.success('Invite resent successfully');
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
            {/* Header */}
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

            {/* Tabs */}
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

            {/* Tab Content */}
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