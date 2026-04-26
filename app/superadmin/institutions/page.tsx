'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { Plus, Megaphone, RefreshCw, Hash, AtSign, Building2, ArrowUpRight, CreditCard, School, GraduationCap, BookOpen, Phone, Mail, MapPin, User, Eye, Search, X, Users, UserCheck, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateInstitutionModal } from '@/components/superadmin/CreateInstitutionModal';
import { Institution } from '@/types';
import api from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PublishNotificationModal } from '@/components/superadmin/PublishNotificationModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a UTC ISO date string to IST (Asia/Kolkata, UTC+5:30) */
function toIST(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric', month: 'short', year: 'numeric',
        ...opts,
    });
}

const statusConfig: Record<string, { label: string; className: string }> = {
    ACTIVE:    { label: 'Active',    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    PENDING:   { label: 'Pending',   className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    SUSPENDED: { label: 'Suspended', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

const FILTERS = [
    { label: 'Active',    value: 'ACTIVE',    cls: 'text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-400' },
    { label: 'Pending',   value: 'PENDING',   cls: 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-400' },
    { label: 'Suspended', value: 'SUSPENDED', cls: 'text-red-600 border-red-300 bg-red-50 dark:bg-red-950/50 dark:border-red-800 dark:text-red-400' },
    { label: 'Basic',     value: 'BASIC',     cls: 'text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-950/50 dark:border-violet-800 dark:text-violet-400' },
    { label: 'Pro',       value: 'PRO',       cls: 'text-[#DA7756] border-[#DA7756]/50 bg-[#DA7756]/8' },
];

// ─── Institution Card ─────────────────────────────────────────────────────────

function InstitutionCard({ inst, index }: { inst: any; index: number }) {
    const router = useRouter();
    const [showTooltip, setShowTooltip] = useState(false);
    const [imgError, setImgError]       = useState(false);
    const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initials = inst.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
    const status   = statusConfig[inst.status] ?? statusConfig['PENDING'];

    // Enriched fields from updated API
    const adminUser     = inst.admin ?? inst.users?.find((u: any) => u.role === 'ADMIN');
    const adminName     = adminUser?.name  ?? adminUser?.email?.split('@')[0] ?? '—';
    const adminEmail    = adminUser?.email ?? '—';
    const teacherCount  = inst.teacherCount ?? 0;
    const studentCount  = inst.studentCount ?? 0;
    const planName      = inst.subscription?.plan?.name ?? 'Basic';
    const instCode      = inst.institutionCode ?? null;
    const logoUrl       = inst.logoUrl ?? null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3, ease: 'easeOut' }}
            className="bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-md transition-all duration-200 group flex flex-col overflow-visible"
        >
            {/* Top — logo / avatar + name */}
            <div className="flex items-start gap-3 p-4 pb-3">
                {/* Logo or initials */}
                <div className="w-12 h-12 rounded-xl bg-muted ring-2 ring-border shrink-0 overflow-hidden flex items-center justify-center">
                    {logoUrl && !imgError ? (
                        <img
                            src={logoUrl}
                            alt={inst.name}
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <span className="text-base font-bold text-muted-foreground select-none">{initials}</span>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug truncate pr-1">{inst.name}</p>
                        <button
                            onClick={() => router.push(`/superadmin/institutions/${inst.id}?tab=plan`)}
                            className="relative shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-white transition-all duration-150 hover:opacity-90 active:scale-95"
                            style={{ fontSize: '11px', background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            onMouseEnter={() => { setShowTooltip(true); tooltipTimer.current = setTimeout(() => setShowTooltip(false), 2000); }}
                            onMouseLeave={() => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); setShowTooltip(false); }}
                        >
                            <CreditCard size={17} />
                            <ArrowUpRight size={15} />
                            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md text-[11px] font-medium text-white bg-gray-900 whitespace-nowrap pointer-events-none z-[100] transition-opacity duration-300 ${showTooltip ? 'opacity-100' : 'opacity-0'}`}>
                                Manage Plan
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                            </div>
                        </button>
                    </div>
                    <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${status.className}`}>
                        {status.label}
                    </span>
                </div>
            </div>

            <div className="h-px bg-border/50 mx-4" />

            {/* Stats row — students / teachers */}
            <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Users size={13} className="text-muted-foreground/60" />
                    <span className="font-semibold text-foreground">{studentCount}</span> students
                </div>
                <div className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <UserCheck size={13} className="text-muted-foreground/60" />
                    <span className="font-semibold text-foreground">{teacherCount}</span> teachers
                </div>
            </div>

            <div className="h-px bg-border/50 mx-4" />

            {/* Details */}
            <div className="px-4 py-3 space-y-2.5 flex-1">
                {([
                    {
                        icon: Hash,
                        label: 'Institute ID',
                        value: instCode
                            ? <span className="font-mono text-[12px] font-semibold tracking-wider" style={{ color: '#DA7756' }}>{instCode}</span>
                            : <span className="italic text-muted-foreground/40 text-[11px]">—</span>,
                    },
                    { icon: User,         label: 'Admin',       value: adminName },
                    { icon: AtSign,       label: 'Admin Email',  value: adminEmail },
                    { icon: Mail,         label: 'Email',        value: inst.email },
                    { icon: Phone,        label: 'Phone',        value: inst.phone ?? '—' },
                    { icon: MapPin,       label: 'Location',     value: inst.city ? `${inst.city}${inst.state ? ', ' + inst.state : ''}` : '—' },
                    { icon: CreditCard,   label: 'Plan',         value: planName },
                    { icon: CalendarDays, label: 'Joined',       value: toIST(inst.createdAt) },
                ] as { icon: React.ElementType; label: string; value: React.ReactNode }[]).map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-2">
                        <Icon size={15} className="shrink-0 text-muted-foreground/60" />
                        <span className="text-[13px] text-muted-foreground w-24 shrink-0">{label}</span>
                        <span className="text-[13px] font-medium truncate">{value}</span>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-4 pb-4">
                <button
                    onClick={() => router.push(`/superadmin/institutions/${inst.id}`)}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border/60 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-150 group-hover:border-primary/20"
                >
                    <Eye size={13} />
                    View Details
                </button>
            </div>
        </motion.div>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Building2 size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No {label} found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Create one using the button above</p>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InstitutionsPage() {
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'SCHOOL' | 'COLLEGE' | 'COACHING'>('SCHOOL');
    const [search, setSearch] = useState('');
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const [publishOpen, setPublishOpen] = useState(false);

    const allInstitutions = institutions;

    const filteredInstitutions = useMemo(() => {
        let list = allInstitutions.filter(inst => inst.type === activeTab);

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(inst =>
                inst.name.toLowerCase().includes(q) ||
                inst.email.toLowerCase().includes(q) ||
                inst.id.toLowerCase().includes(q) ||
                inst.users?.[0]?.email?.toLowerCase().includes(q)
            );
        }

        if (activeFilters.length > 0) {
            const hasStatus = activeFilters.some(f => ['ACTIVE', 'PENDING', 'SUSPENDED'].includes(f));
            const hasPlan = activeFilters.some(f => ['BASIC', 'PRO'].includes(f));
            list = list.filter(inst => {
                const statusOk = !hasStatus || activeFilters.includes(inst.status);
                const planOk = !hasPlan || activeFilters.includes(((inst as any).plan ?? 'BASIC').toUpperCase());
                return statusOk && planOk;
            });
        }

        return list;
    }, [allInstitutions, activeTab, search, activeFilters]);

    const toggleFilter = (val: string) =>
        setActiveFilters(prev => prev.includes(val) ? prev.filter(f => f !== val) : [...prev, val]);

    const fetchInstitutions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/institutions');
            setInstitutions(res.data.data);
        } catch {
            toast.error('Failed to fetch institutions');
        } finally {
            setLoading(false);
        }
    };

    // Fetch on mount
    useEffect(() => { fetchInstitutions(); }, []);

    const tabs = [
        { label: 'School', value: 'SCHOOL' as const, icon: School },
        { label: 'College', value: 'COLLEGE' as const, icon: GraduationCap },
        { label: 'Coaching', value: 'COACHING' as const, icon: BookOpen },
    ];

    return (
        // Full height flex column — parent layout must allow this
        <div className="flex flex-col" style={{ height: '100%' }}>

            {/* ── STICKY SECTION ── */}
            <div className="sticky top-0 z-20 bg-background space-y-3 pb-3">

                {/* Header row */}
                <div className="flex items-center justify-between pt-3 px-1">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Building2 size={28} />
                            Institutions
                        </h1>
                        <p className="text-muted-foreground text-sm">Manage all institutions</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={fetchInstitutions} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </Button>
                        <button
                            onClick={() => setModalOpen(true)}
                            className="flex items-center h-8 px-3 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                        >
                            <Plus size={15} className="mr-1.5" />
                            New Institution
                        </button>
                    </div>
                </div>

                {/* Separator */}
                <div className="h-px bg-border/60" />

                {/* Tab pills + Search + Filters + Publish — same row */}
                <div className="flex items-center justify-between gap-2">
                    {/* Left — Tabs + Publish */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.value;
                                return (
                                    <button key={tab.value} onClick={() => setActiveTab(tab.value)} className="relative">
                                        {isActive && (
                                            <motion.div layoutId="instTab"
                                                className="absolute inset-0 bg-primary rounded-4xl"
                                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                            />
                                        )}
                                        <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl
                            ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                            <tab.icon size={14} />
                                            {tab.label}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => setPublishOpen(true)}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            title="Broadcast Notification"
                        >
                            <Megaphone size={20} />
                        </button>
                    </div>

                    {/* Right — Search + Filters */}
                    <div className="flex items-center gap-2 mr-4">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search institutions..."
                                className="w-56 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                            {FILTERS.map(f => {
                                const isOn = activeFilters.includes(f.value);
                                return (
                                    <button key={f.value} onClick={() => toggleFilter(f.value)}
                                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-150
                            ${isOn ? f.cls : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground bg-transparent'}`}>
                                        {f.label}
                                    </button>
                                );
                            })}
                            {activeFilters.length > 0 && (
                                <button onClick={() => setActiveFilters([])}
                                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                                    <X size={11} /> Clear
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SCROLLABLE CARDS ── */}
            <div className="flex-1 overflow-y-auto pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-3">
                    {loading
                        ? Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-card border border-border/50 rounded-2xl h-48 animate-pulse" />
                        ))
                        : filteredInstitutions.length > 0
                            ? filteredInstitutions.map((inst, i) => <InstitutionCard key={inst.id} inst={inst} index={i} />)
                            : <EmptyState label={activeTab.toLowerCase()} />
                    }
                </div>
            </div>

            <CreateInstitutionModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={(newInst) => {
                    setModalOpen(false);
                    // Switch to the tab matching the new institution type
                    if (newInst?.type) setActiveTab(newInst.type as 'SCHOOL' | 'COLLEGE' | 'COACHING');
                    // Re-fetch full list from backend to get all fields (users, subscription, etc.)
                    fetchInstitutions();
                }}
            />
            <PublishNotificationModal
                open={publishOpen}
                onClose={() => setPublishOpen(false)}
            />
        </div>
    );
}