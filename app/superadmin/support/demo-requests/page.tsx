'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CalendarClock, Search, X, ChevronDown, ChevronUp,
    Clock, CheckCircle2, PhoneCall, Loader2, Ban, Sparkles,
    RefreshCw, ChevronLeft, ChevronRight, Mail, Phone, Building2, Users,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

type DemoStatus = 'NEW' | 'CONTACTED' | 'IN_PROGRESS' | 'CONVERTED' | 'CLOSED';

interface DemoRequest {
    id: string;
    name: string;
    email: string;
    phone: string;
    institutionName: string;
    institutionType: 'SCHOOL' | 'COLLEGE' | 'COACHING';
    studentCount: number | null;
    message: string | null;
    status: DemoStatus;
    emailSent: boolean;
    createdAt: string;
    updatedAt: string;
}

type Pagination = { total: number; page: number; limit: number; pages: number };
const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const STATUS_CFG: Record<DemoStatus, { label: string; cls: string; icon: React.ElementType; dotCls: string }> = {
    NEW:         { label: 'New',         cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',       icon: Sparkles,   dotCls: 'bg-blue-500' },
    CONTACTED:   { label: 'Contacted',   cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400', icon: PhoneCall, dotCls: 'bg-violet-500' },
    IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',   icon: Loader2,    dotCls: 'bg-amber-500' },
    CONVERTED:   { label: 'Converted',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', icon: CheckCircle2, dotCls: 'bg-emerald-500' },
    CLOSED:      { label: 'Closed',      cls: 'bg-muted text-muted-foreground',                                      icon: Ban,        dotCls: 'bg-muted-foreground' },
};

const STATUS_FILTERS: { label: string; value: 'ALL' | DemoStatus }[] = [
    { label: 'All',         value: 'ALL' },
    { label: 'New',         value: 'NEW' },
    { label: 'Contacted',   value: 'CONTACTED' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Converted',   value: 'CONVERTED' },
    { label: 'Closed',      value: 'CLOSED' },
];

const INST_TYPE_COLORS: Record<string, string> = {
    SCHOOL:   'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    COLLEGE:  'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    COACHING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

const STATUS_ORDER: DemoStatus[] = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'CONVERTED', 'CLOSED'];

// ─── Demo Request Card ────────────────────────────────────────────────────────

function DemoRequestCard({ request, index, onStatusChange }: {
    request: DemoRequest;
    index: number;
    onStatusChange: (id: string, status: DemoStatus) => Promise<void>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [status, setStatus] = useState<DemoStatus>(request.status);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const statusCfg = STATUS_CFG[status];
    const StatusIcon = statusCfg.icon;

    const handleStatusChange = async (newStatus: DemoStatus) => {
        if (newStatus === status || updatingStatus) return;
        setUpdatingStatus(true);
        try {
            await onStatusChange(request.id, newStatus);
            setStatus(newStatus);
        } catch {
            toast.error('Failed to update status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            className="bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all duration-200 overflow-hidden"
        >
            <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setExpanded(e => !e)}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${statusCfg.cls}`}>
                    <StatusIcon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold leading-snug truncate pr-1">{request.name}</p>
                        <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                            #{request.id.slice(0, 8)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statusCfg.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotCls}`} />
                            {statusCfg.label}
                        </span>
                        {!request.emailSent && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                                Email failed
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <Building2 size={11} className="text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{request.institutionName}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INST_TYPE_COLORS[request.institutionType] ?? ''}`}>
                                {request.institutionType}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock size={10} className="text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{relativeTime(request.createdAt)}</span>
                        </div>
                    </div>
                </div>

                {expanded
                    ? <ChevronUp size={15} className="text-muted-foreground mt-1 shrink-0" />
                    : <ChevronDown size={15} className="text-muted-foreground mt-1 shrink-0" />
                }
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-border/40 px-4 pt-3 pb-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="p-3 bg-muted/30 rounded-xl flex items-center gap-2.5">
                                    <Mail size={13} className="text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-muted-foreground">Email</p>
                                        <p className="text-xs font-medium truncate">{request.email}</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-xl flex items-center gap-2.5">
                                    <Phone size={13} className="text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-muted-foreground">Phone</p>
                                        <p className="text-xs font-medium truncate">{request.phone || '—'}</p>
                                    </div>
                                </div>
                                {request.studentCount != null && (
                                    <div className="p-3 bg-muted/30 rounded-xl flex items-center gap-2.5">
                                        <Users size={13} className="text-muted-foreground shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-muted-foreground">Students/Users</p>
                                            <p className="text-xs font-medium">{request.studentCount}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {request.message && (
                                <div className="p-3 bg-muted/30 rounded-xl">
                                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">Message</p>
                                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{request.message}</p>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {STATUS_ORDER.map((s) => (
                                        <button
                                            key={s}
                                            disabled={updatingStatus}
                                            onClick={() => handleStatusChange(s)}
                                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all disabled:opacity-50 ${status === s
                                                ? `${STATUS_CFG[s].cls} border-transparent`
                                                : 'border-border/50 text-muted-foreground hover:text-foreground'}`}
                                        >
                                            {STATUS_CFG[s].label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoRequestsPage() {
    const [requests, setRequests] = useState<DemoRequest[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeStatus, setActiveStatus] = useState<'ALL' | DemoStatus>('ALL');

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(val);
            setPage(1);
        }, 400);
    };

    const fetchRequests = useCallback(async (currentPage = page) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('limit', String(PAGE_SIZE));
            if (activeStatus !== 'ALL') params.set('status', activeStatus);
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

            const res = await api.get(`/superadmin/demo-requests?${params}`);
            setRequests(res.data?.demoRequests ?? []);
            setPagination(res.data?.pagination ?? { total: 0, page: currentPage, limit: PAGE_SIZE, pages: 1 });
        } catch {
            toast.error('Failed to load demo requests');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, activeStatus, debouncedSearch]);

    useEffect(() => {
        void fetchRequests(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, activeStatus, debouncedSearch]);

    const handleStatusChange = async (id: string, status: DemoStatus) => {
        await api.patch(`/superadmin/demo-requests/${id}/status`, { status });
    };

    const hasFilters = debouncedSearch || activeStatus !== 'ALL';

    return (
        <div className="space-y-2">
            <div className="sticky top-0 z-20 bg-background pb-1 space-y-2">
                <div className="flex items-center justify-between pt-0 px-1 flex-wrap gap-3">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <CalendarClock size={21} />
                            Demo Requests
                        </h1>
                        <p className="text-muted-foreground text-[13px]">
                            {pagination.total > 0 ? `${pagination.total} request${pagination.total !== 1 ? 's' : ''}` : 'No demo requests yet'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => handleSearchChange(e.target.value)}
                                placeholder="Search requests..."
                                className="w-56 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                            />
                            {search && (
                                <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {STATUS_FILTERS.map(f => (
                            <button key={f.value} onClick={() => { setActiveStatus(f.value); setPage(1); }}
                                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${activeStatus === f.value
                                    ? 'bg-primary text-white border-primary'
                                    : 'border-border/50 text-muted-foreground hover:text-foreground'}`}>
                                {f.label}
                            </button>
                        ))}

                        {hasFilters && (
                            <button onClick={() => { setSearch(''); setDebouncedSearch(''); setActiveStatus('ALL'); setPage(1); }}
                                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                                <X size={11} /> Clear
                            </button>
                        )}

                        <Button variant="outline" size="icon" onClick={() => fetchRequests(page)} disabled={loading}>
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </Button>
                    </div>
                </div>
                <div className="h-px bg-border/60" />
            </div>

            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border/50 rounded-2xl h-28 animate-pulse" />
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        <CalendarClock size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                        {hasFilters ? 'No requests match your filters' : 'No demo requests yet'}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                        {hasFilters ? 'Try adjusting your filters' : 'Requests submitted from the landing page will appear here'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {requests.map((request, i) => (
                        <DemoRequestCard
                            key={request.id}
                            request={request}
                            index={i}
                            onStatusChange={handleStatusChange}
                        />
                    ))}
                </div>
            )}

            {!loading && pagination.pages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 px-1">
                    <p className="text-[11px] text-muted-foreground">
                        Page {pagination.page} of {pagination.pages} · {pagination.total} total
                    </p>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === pagination.pages || Math.abs(p - page) <= 1)
                            .reduce<(number | '...')[]>((acc, p, i, arr) => {
                                if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((p, i) => p === '...'
                                ? <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">...</span>
                                : <button key={p} onClick={() => setPage(p as number)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${page === p ? 'bg-primary text-white' : 'border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                                    {p}
                                  </button>
                            )
                        }
                        <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
