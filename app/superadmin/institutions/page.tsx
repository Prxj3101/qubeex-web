'use client';

import { useState, useRef, useMemo } from 'react';
import { Plus, RefreshCw, Hash, AtSign, Building2, ArrowUpRight, CreditCard, School, GraduationCap, BookOpen, Phone, Mail, MapPin, User, Eye, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateInstitutionModal } from '@/components/superadmin/CreateInstitutionModal';
import { Institution } from '@/types';
import api from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockUser = (email: string) => ({
    id: `u-${email}`, email, role: 'ADMIN' as const,
    createdAt: new Date().toISOString(),
});

const MOCK_SCHOOLS: Institution[] = [
    { id: 's1', name: 'Delhi Public School', type: 'SCHOOL', email: 'admin@dps.edu.in', phone: '+91 98100 11223', city: 'New Delhi', status: 'ACTIVE', createdAt: '', updatedAt: '', users: [mockUser('rohit.sharma@dps.edu.in')] },
    { id: 's2', name: 'Modern High School', type: 'SCHOOL', email: 'info@modernhs.in', phone: '+91 99001 45678', city: 'Mumbai', status: 'PENDING', createdAt: '', updatedAt: '', users: [mockUser('priya.menon@modernhs.in')] },
    { id: 's3', name: 'Kendriya Vidyalaya No. 3', type: 'SCHOOL', email: 'kv3@kv.edu.in', phone: '+91 80045 67890', city: 'Bengaluru', status: 'ACTIVE', createdAt: '', updatedAt: '', users: [mockUser('suresh.k@kv.edu.in')] },
    { id: 's4', name: "St. Xavier's High School", type: 'SCHOOL', email: 'admin@stxaviers.in', phone: '+91 22100 98765', city: 'Kolkata', status: 'SUSPENDED', createdAt: '', updatedAt: '', users: [mockUser('father.alves@stxaviers.in')] },
    { id: 's5', name: 'Ryan International School', type: 'SCHOOL', email: 'ryan@ryan.edu', phone: '+91 98765 43210', city: 'Pune', status: 'ACTIVE', createdAt: '', updatedAt: '', users: [mockUser('meena.pillai@ryan.edu')] },
    { id: 's6', name: 'DAV Public School', type: 'SCHOOL', email: 'admin@dav.edu.in', phone: '+91 92100 33445', city: 'Chandigarh', status: 'ACTIVE', createdAt: '', updatedAt: '', users: [mockUser('amit.singh@dav.edu.in')] },
    { id: 's7', name: 'Bal Bharati School', type: 'SCHOOL', email: 'info@balbharati.in', phone: '+91 98001 22334', city: 'Delhi', status: 'PENDING', createdAt: '', updatedAt: '', users: [mockUser('sunita.rao@balbharati.in')] },
    { id: 's8', name: 'The Heritage School', type: 'SCHOOL', email: 'admin@heritage.edu', phone: '+91 33100 55667', city: 'Kolkata', status: 'ACTIVE', createdAt: '', updatedAt: '', users: [mockUser('ravi.das@heritage.edu')] },
    { id: 's9', name: 'Podar International School', type: 'SCHOOL', email: 'info@podar.edu.in', phone: '+91 22001 44556', city: 'Mumbai', status: 'SUSPENDED', createdAt: '', updatedAt: '', users: [mockUser('neha.joshi@podar.edu.in')] },
];

const MOCK_COLLEGES: Institution[] = [
    { id: 'c1', name: 'DY Patil College of Engineering', type: 'COLLEGE', email: 'admin@dypatil.edu', phone: '+91 20100 11223', city: 'Pune', status: 'ACTIVE', createdAt: '', updatedAt: '', users: [mockUser('rajesh.patil@dypatil.edu')] },
    { id: 'c2', name: 'Aakash Institute', type: 'COLLEGE', email: 'admin@aakash.ac.in', phone: '+91 11456 78901', city: 'New Delhi', status: 'ACTIVE', createdAt: '', updatedAt: '', users: [mockUser('anita.verma@aakash.ac.in')] },
    { id: 'c3', name: 'Shree Vidya College', type: 'COLLEGE', email: 'info@shreevidya.edu', phone: '+91 79001 23456', city: 'Ahmedabad', status: 'PENDING', createdAt: '', updatedAt: '', users: [mockUser('dinesh.shah@shreevidya.edu')] },
    { id: 'c4', name: 'MES College of Arts', type: 'COLLEGE', email: 'mes@mesarts.in', phone: '+91 80123 45678', city: 'Bengaluru', status: 'SUSPENDED', createdAt: '', updatedAt: '', users: [mockUser('lakshmi.r@mesarts.in')] },
    { id: 'c5', name: 'Fergusson College', type: 'COLLEGE', email: 'admin@fergusson.edu', phone: '+91 20987 65432', city: 'Pune', status: 'ACTIVE', createdAt: '', updatedAt: '', users: [mockUser('vivek.joshi@fergusson.edu')] },
    { id: 'c6', name: 'St. Xavier\'s College', type: 'COLLEGE', email: 'admin@xaviers.edu', phone: '+91 22100 77889', city: 'Mumbai', status: 'ACTIVE', createdAt: '', updatedAt: '', users: [mockUser('joseph.d@xaviers.edu')] },
    { id: 'c7', name: 'Presidency College', type: 'COLLEGE', email: 'info@presidency.ac.in', phone: '+91 33001 88990', city: 'Kolkata', status: 'PENDING', createdAt: '', updatedAt: '', users: [mockUser('tapan.ghosh@presidency.ac.in')] },
    { id: 'c8', name: 'Hansraj College', type: 'COLLEGE', email: 'admin@hansraj.edu.in', phone: '+91 11001 99001', city: 'New Delhi', status: 'ACTIVE', createdAt: '', updatedAt: '', users: [mockUser('kavita.sharma@hansraj.edu.in')] },
    { id: 'c9', name: 'Symbiosis College of Arts', type: 'COLLEGE', email: 'info@symbiosis.edu', phone: '+91 20001 11223', city: 'Pune', status: 'SUSPENDED', createdAt: '', updatedAt: '', users: [mockUser('preethi.nair@symbiosis.edu')] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    SUSPENDED: { label: 'Suspended', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

const FILTERS = [
    { label: 'Active', value: 'ACTIVE', cls: 'text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-400' },
    { label: 'Pending', value: 'PENDING', cls: 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-400' },
    { label: 'Suspended', value: 'SUSPENDED', cls: 'text-red-600 border-red-300 bg-red-50 dark:bg-red-950/50 dark:border-red-800 dark:text-red-400' },
    { label: 'Basic', value: 'BASIC', cls: 'text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-950/50 dark:border-violet-800 dark:text-violet-400' },
    { label: 'Pro', value: 'PRO', cls: 'text-[#DA7756] border-[#DA7756]/50 bg-[#DA7756]/8' },
];

// ─── Institution Card ─────────────────────────────────────────────────────────

function InstitutionCard({ inst, index }: { inst: Institution; index: number }) {
    const router = useRouter();
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initials = inst.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
    const status = statusConfig[inst.status] ?? statusConfig['PENDING'];

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3, ease: 'easeOut' }}
            className="bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-md transition-all duration-200 group flex flex-col overflow-visible"
        >
            {/* Top */}
            <div className="flex items-start gap-3 p-4 pb-3">
                <div className="w-12 h-12 rounded-xl bg-muted text-muted-foreground ring-2 ring-border flex items-center justify-center text-base font-bold shrink-0 select-none">
                    {initials}
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

                            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md text-[11px] font-medium text-white bg-gray-900 whitespace-nowrap pointer-events-none z-[100] transition-opacity duration-300 ${showTooltip ? 'opacity-100' : 'opacity-0'}`}>                                Manage Plan
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

            {/* Details */}
            <div className="px-4 py-3 space-y-2.5 flex-1">
                {([
                    { icon: Hash, label: 'Institute ID', value: <span className="italic text-muted-foreground/50 text-[11px]">Auto generated</span> },
                    { icon: Mail, label: 'Email', value: inst.email },
                    { icon: User, label: 'Admin', value: inst.users?.[0]?.email?.split('@')[0] ?? 'N/A' },
                    { icon: AtSign, label: 'Admin Email', value: inst.users?.[0]?.email ?? 'N/A' },
                    { icon: Phone, label: 'Phone', value: inst.phone ?? 'N/A' },
                    { icon: MapPin, label: 'Location', value: inst.city ?? 'N/A' },
                    { icon: CreditCard, label: 'Plan', value: (inst as any).plan ?? 'Basic' },
                ] as { icon: React.ElementType; label: string; value: React.ReactNode }[]).map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-2">
                        <Icon size={15} className="shrink-0 text-muted-foreground/60" />
                        <span className="text-[13px] text-muted-foreground w-20 shrink-0">{label}</span>
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

    const allInstitutions = [...MOCK_SCHOOLS, ...MOCK_COLLEGES, ...institutions];

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

                {/* Tab pills */}
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

                {/* Search + Filters */}
                <div className="space-y-2 px-1">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, email, admin or ID..."
                            className="w-full max-w-xl h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-muted-foreground font-medium">Filter:</span>
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
                                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-1">
                                <X size={11} /> Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── SCROLLABLE CARDS ── */}
            <div className="flex-1 overflow-y-auto pb-6">
                {activeTab === 'COACHING' ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                            <BookOpen size={24} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Coaching institutes coming soon</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">This section will be available in a future update</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-3">
                        {filteredInstitutions.length > 0
                            ? filteredInstitutions.map((inst, i) => <InstitutionCard key={inst.id} inst={inst} index={i} />)
                            : <EmptyState label={activeTab.toLowerCase()} />
                        }
                    </div>
                )}
            </div>

            <CreateInstitutionModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={(newInst) => {
                    setModalOpen(false);
                    if (newInst) {
                        setInstitutions(prev => [...prev, newInst]);
                        setActiveTab(newInst.type as 'SCHOOL' | 'COLLEGE' | 'COACHING');
                    } else {
                        fetchInstitutions();
                    }
                }}
            />
        </div>
    );
}