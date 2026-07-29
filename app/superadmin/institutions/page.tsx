'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { Plus, Megaphone, RefreshCw, Hash, AtSign, Building2, ArrowUpRight, CreditCard, School, GraduationCap, BookOpen, Phone, Mail, MapPin, User, Eye, Search, X, Users, UserCheck, CalendarDays, Filter, ArrowUpDown, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateInstitutionModal } from '@/components/superadmin/CreateInstitutionModal';
import { Institution } from '@/types';
import api from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PublishNotificationModal } from '@/components/superadmin/PublishNotificationModal';

type InstitutionListItem = Institution & {
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    institutionCode?: string | null;
    admin?: { name?: string | null; email?: string | null } | null;
    users?: Array<{ role?: string; email?: string; name?: string | null }>;
    teacherCount?: number;
    studentCount?: number;
    subscription?: {
        plan?: { name?: string | null } | null;
        status?: string | null;
        endDate?: string | null;
        trialOutcome?: string | null;
    } | null;
};

// ─── Filter / sort helpers ────────────────────────────────────────────────────

const isChurned = (inst: InstitutionListItem) =>
    inst.subscription?.trialOutcome === 'CHURNED' || inst.subscription?.status === 'LOCKED';

const planOf = (inst: InstitutionListItem) =>
    (inst.subscription?.plan?.name ?? '').toUpperCase();

const userCountOf = (inst: InstitutionListItem) =>
    inst.users?.length ?? ((inst.teacherCount ?? 0) + (inst.studentCount ?? 0));

const STATUS_OPTS = [
    { label: 'Active',    value: 'ACTIVE' },
    { label: 'Suspended', value: 'SUSPENDED' },
    { label: 'Churned',   value: 'CHURNED' },
    { label: 'Pending',   value: 'PENDING' },
];
const PLAN_OPTS = [
    { label: 'Trial', value: 'TRIAL' },
    { label: 'Basic', value: 'BASIC' },
    { label: 'Pro',   value: 'PRO' },
];
const SUB_STATUS_OPTS = [
    { label: 'Active',  value: 'ACTIVE' },
    { label: 'Trial',   value: 'TRIAL' },
    { label: 'Expired', value: 'EXPIRED' },
    { label: 'Locked',  value: 'LOCKED' },
];
const SORT_OPTS = [
    { label: 'Newest first',     value: 'CREATED_DESC' },
    { label: 'Oldest first',     value: 'CREATED_ASC' },
    { label: 'Name (A–Z)',       value: 'NAME_ASC' },
    { label: 'Name (Z–A)',       value: 'NAME_DESC' },
    { label: 'Expiry (soonest)', value: 'EXPIRY_ASC' },
    { label: 'Users (highest)',  value: 'USERS_DESC' },
    { label: 'Users (lowest)',   value: 'USERS_ASC' },
] as const;
type SortKey = typeof SORT_OPTS[number]['value'];

const STORAGE_KEY = 'sa-institutions-view';
type PersistState = {
    activeTab: 'SCHOOL' | 'COLLEGE' | 'COACHING';
    search: string;
    statusFilters: string[];
    planFilters: string[];
    subStatusFilters: string[];
    createdFrom: string;
    createdTo: string;
    sortBy: SortKey;
};
const DEFAULT_STATE: PersistState = {
    activeTab: 'SCHOOL', search: '', statusFilters: [], planFilters: [],
    subStatusFilters: [], createdFrom: '', createdTo: '', sortBy: 'CREATED_DESC',
};
function loadState(): PersistState {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
    } catch { return DEFAULT_STATE; }
}

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

// ─── Filter group (checkbox chips inside the Filters popover) ──────────────────

function FilterGroup({ title, opts, selected, onToggle }: {
    title: string;
    opts: { label: string; value: string }[];
    selected: string[];
    onToggle: (v: string) => void;
}) {
    return (
        <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</p>
            <div className="flex flex-wrap gap-1.5">
                {opts.map(o => {
                    const on = selected.includes(o.value);
                    return (
                        <button key={o.value} onClick={() => onToggle(o.value)}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'}`}>
                            {o.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Institution Card ─────────────────────────────────────────────────────────

function InstitutionCard({ inst, index }: { inst: InstitutionListItem; index: number }) {
    const router = useRouter();
    const [showTooltip, setShowTooltip] = useState(false);
    const [imgError, setImgError]       = useState(false);
    const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initials = inst.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
    const status   = statusConfig[inst.status] ?? statusConfig['PENDING'];

    // Enriched fields from updated API
    const adminUser     = inst.admin ?? inst.users?.find((u) => u.role === 'ADMIN');
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
    const [institutions, setInstitutions] = useState<InstitutionListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Persisted view state — filters/sort/search survive navigation within the
    // Super Admin dashboard until reset. Load after mount (not in the initializer)
    // to avoid an SSR/CSR hydration mismatch; the guard stops the initial default
    // from overwriting the saved value before it's read.
    const [view, setView] = useState<PersistState>(DEFAULT_STATE);
    const loadedRef = useRef(false);
    useEffect(() => {
        setView(loadState());
        loadedRef.current = true;
    }, []);
    useEffect(() => {
        if (!loadedRef.current) return;
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view)); } catch { /* ignore */ }
    }, [view]);
    const patch = (p: Partial<PersistState>) => setView(v => ({ ...v, ...p }));
    const toggleIn = (key: 'statusFilters' | 'planFilters' | 'subStatusFilters', val: string) =>
        setView(v => ({ ...v, [key]: v[key].includes(val) ? v[key].filter(x => x !== val) : [...v[key], val] }));

    const { activeTab, search, statusFilters, planFilters, subStatusFilters, createdFrom, createdTo, sortBy } = view;

    const activeFilterCount =
        statusFilters.length + planFilters.length + subStatusFilters.length +
        (createdFrom ? 1 : 0) + (createdTo ? 1 : 0);

    // Single action to clear every filter/search/sort (keeps the current type tab).
    const resetAll = () => setView(v => ({ ...DEFAULT_STATE, activeTab: v.activeTab }));

    const filteredInstitutions = useMemo(() => {
        let list = institutions.filter(inst => inst.type === activeTab);

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(inst =>
                inst.name.toLowerCase().includes(q) ||
                (inst.admin?.name ?? '').toLowerCase().includes(q) ||
                (inst.admin?.email ?? inst.email ?? '').toLowerCase().includes(q) ||
                (inst.institutionCode ?? '').toLowerCase().includes(q) ||
                inst.id.toLowerCase().includes(q)
            );
        }
        if (statusFilters.length) {
            list = list.filter(inst =>
                statusFilters.some(s => (s === 'CHURNED' ? isChurned(inst) : inst.status === s)));
        }
        if (planFilters.length) {
            list = list.filter(inst => planFilters.includes(planOf(inst)));
        }
        if (subStatusFilters.length) {
            list = list.filter(inst => subStatusFilters.includes(inst.subscription?.status ?? ''));
        }
        if (createdFrom) {
            const from = new Date(createdFrom).getTime();
            list = list.filter(inst => new Date(inst.createdAt).getTime() >= from);
        }
        if (createdTo) {
            const to = new Date(createdTo).getTime() + 86400000; // inclusive end-of-day
            list = list.filter(inst => new Date(inst.createdAt).getTime() < to);
        }

        const sorted = [...list];
        const name = (i: InstitutionListItem) => i.name.toLowerCase();
        const created = (i: InstitutionListItem) => new Date(i.createdAt).getTime();
        const expiry = (i: InstitutionListItem) => i.subscription?.endDate ? new Date(i.subscription.endDate).getTime() : Infinity;
        switch (sortBy) {
            case 'NAME_ASC':     sorted.sort((a, b) => name(a).localeCompare(name(b))); break;
            case 'NAME_DESC':    sorted.sort((a, b) => name(b).localeCompare(name(a))); break;
            case 'CREATED_ASC':  sorted.sort((a, b) => created(a) - created(b)); break;
            case 'CREATED_DESC': sorted.sort((a, b) => created(b) - created(a)); break;
            case 'EXPIRY_ASC':   sorted.sort((a, b) => expiry(a) - expiry(b)); break;
            case 'USERS_DESC':   sorted.sort((a, b) => userCountOf(b) - userCountOf(a)); break;
            case 'USERS_ASC':    sorted.sort((a, b) => userCountOf(a) - userCountOf(b)); break;
        }
        return sorted;
    }, [institutions, activeTab, search, statusFilters, planFilters, subStatusFilters, createdFrom, createdTo, sortBy]);

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
            <div className="sticky top-0 z-20 bg-background space-y-2 pb-2">

                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0 px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Building2 size={21} />
                            Institutions
                        </h1>
                        <p className="text-muted-foreground text-[13px]">Manage all institutions</p>
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
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                    {/* Left — Tabs + Publish */}
                    <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
                        <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.value;
                                return (
                                    <button key={tab.value} onClick={() => patch({ activeTab: tab.value })} className="relative">
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
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 lg:mr-4">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => patch({ search: e.target.value })}
                                placeholder="Search name, admin, email, ID..."
                                className="w-full sm:w-56 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                            />
                            {search && (
                                <button onClick={() => patch({ search: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Sort */}
                            <div className="relative">
                                <ArrowUpDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <select
                                    value={sortBy}
                                    onChange={e => patch({ sortBy: e.target.value as SortKey })}
                                    className="h-9 pl-8 pr-7 rounded-4xl border border-border bg-muted/40 text-xs font-medium focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
                                    title="Sort by"
                                >
                                    {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </div>

                            {/* Filters popover */}
                            <div className="relative">
                                <button
                                    onClick={() => setFiltersOpen(o => !o)}
                                    className={`flex items-center gap-1.5 h-9 px-3 rounded-4xl border text-xs font-medium transition-all ${activeFilterCount > 0 ? 'border-primary/50 text-primary bg-primary/5' : 'border-border text-muted-foreground hover:text-foreground bg-muted/40'}`}
                                >
                                    <Filter size={13} /> Filters
                                    {activeFilterCount > 0 && (
                                        <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
                                    )}
                                </button>
                                {filtersOpen && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setFiltersOpen(false)} />
                                        <div className="absolute right-0 top-11 z-40 w-72 bg-card border border-border rounded-2xl shadow-2xl p-4 space-y-4">
                                            <FilterGroup title="Institution Status" opts={STATUS_OPTS} selected={statusFilters} onToggle={v => toggleIn('statusFilters', v)} />
                                            <FilterGroup title="Subscription Plan" opts={PLAN_OPTS} selected={planFilters} onToggle={v => toggleIn('planFilters', v)} />
                                            <FilterGroup title="Subscription Status" opts={SUB_STATUS_OPTS} selected={subStatusFilters} onToggle={v => toggleIn('subStatusFilters', v)} />
                                            <div>
                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Creation Date</p>
                                                <div className="flex items-center gap-2">
                                                    <input type="date" value={createdFrom} onChange={e => patch({ createdFrom: e.target.value })}
                                                        className="flex-1 h-8 px-2 rounded-lg border border-border bg-muted/40 text-xs focus:outline-none focus:border-primary/50" />
                                                    <span className="text-muted-foreground text-xs">–</span>
                                                    <input type="date" value={createdTo} onChange={e => patch({ createdTo: e.target.value })}
                                                        className="flex-1 h-8 px-2 rounded-lg border border-border bg-muted/40 text-xs focus:outline-none focus:border-primary/50" />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                                <button onClick={resetAll} className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"><X size={11} /> Clear all</button>
                                                <button onClick={() => setFiltersOpen(false)} className="text-[11px] font-semibold text-primary hover:opacity-80">Done</button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {activeFilterCount > 0 && (
                                <button onClick={resetAll} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
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
                    if (newInst?.type) patch({ activeTab: newInst.type as 'SCHOOL' | 'COLLEGE' | 'COACHING' });
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
