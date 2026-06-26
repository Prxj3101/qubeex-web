'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TicketIcon, Search, X, ChevronDown, ChevronUp,
    Send, Clock, CheckCircle2, AlertCircle, Loader2,
    Bug, Sparkles, CreditCard, HelpCircle, Building2,
    RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus   = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type TicketCategory = 'BUG' | 'FEATURE' | 'BILLING' | 'OTHER';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TicketReply {
    id: string;
    author: string;
    role: string;
    message: string;
    createdAt: string;
}

interface Ticket {
    id: string;
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    institution: { name: string; type: string };
    adminEmail: string;
    createdAt: string;
    updatedAt: string;
    replies: TicketReply[];
}

type Pagination = { total: number; page: number; limit: number; pages: number };

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

const STATUS_CFG: Record<TicketStatus, { label: string; cls: string; icon: React.ElementType; dotCls: string }> = {
    OPEN:        { label: 'Open',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',     icon: AlertCircle,  dotCls: 'bg-blue-500' },
    IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', icon: Loader2,      dotCls: 'bg-amber-500' },
    RESOLVED:    { label: 'Resolved',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', icon: CheckCircle2, dotCls: 'bg-emerald-500' },
    CLOSED:      { label: 'Closed',      cls: 'bg-muted text-muted-foreground',                                    icon: X,            dotCls: 'bg-muted-foreground' },
};

const CATEGORY_CFG: Record<TicketCategory, { label: string; cls: string; icon: React.ElementType }> = {
    BUG:     { label: 'Bug',             cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',           icon: Bug },
    FEATURE: { label: 'Feature Request', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400', icon: Sparkles },
    BILLING: { label: 'Billing',         cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',   icon: CreditCard },
    OTHER:   { label: 'Other',           cls: 'bg-muted text-muted-foreground',                                       icon: HelpCircle },
};

const PRIORITY_CFG: Record<TicketPriority, { label: string; cls: string }> = {
    LOW:    { label: 'Low',    cls: 'text-muted-foreground border-border' },
    MEDIUM: { label: 'Medium', cls: 'text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-800' },
    HIGH:   { label: 'High',   cls: 'text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-800' },
    URGENT: { label: 'Urgent', cls: 'text-red-600 border-red-300 dark:text-red-400 dark:border-red-800' },
};

const INST_TYPE_COLORS: Record<string, string> = {
    SCHOOL:   'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    COLLEGE:  'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    COACHING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

const STATUS_FILTERS = [
    { label: 'All',         value: 'ALL' },
    { label: 'Open',        value: 'OPEN' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Resolved',    value: 'RESOLVED' },
    { label: 'Closed',      value: 'CLOSED' },
];

const CATEGORY_FILTERS = [
    { label: 'Bug',     value: 'BUG',     cls: 'text-red-600 border-red-300 bg-red-50 dark:bg-red-950/50 dark:border-red-800 dark:text-red-400' },
    { label: 'Feature', value: 'FEATURE', cls: 'text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-950/50 dark:border-violet-800 dark:text-violet-400' },
    { label: 'Billing', value: 'BILLING', cls: 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-400' },
    { label: 'Other',   value: 'OTHER',   cls: 'text-muted-foreground border-border' },
];

// ─── Ticket Card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, index, onReply, onStatusChange }: {
    ticket: Ticket;
    index: number;
    onReply: (id: string, message: string) => Promise<TicketReply>;
    onStatusChange: (id: string, status: TicketStatus) => Promise<void>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [status, setStatus] = useState<TicketStatus>(ticket.status);
    const [replies, setReplies] = useState<TicketReply[]>(ticket.replies);
    const [sending, setSending] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const statusCfg  = STATUS_CFG[status];
    const categoryCfg = CATEGORY_CFG[ticket.category as TicketCategory] ?? CATEGORY_CFG.OTHER;
    const priorityCfg = PRIORITY_CFG[ticket.priority as TicketPriority] ?? PRIORITY_CFG.LOW;
    const CatIcon    = categoryCfg.icon;

    const handleSendReply = async () => {
        if (!replyText.trim()) return;
        setSending(true);
        try {
            const newReply = await onReply(ticket.id, replyText.trim());
            setReplies(prev => [...prev, newReply]);
            setReplyText('');
            // Auto status update mirroring backend behaviour
            if (status === 'OPEN') setStatus('IN_PROGRESS');
        } catch {
            toast.error('Failed to send reply');
        } finally {
            setSending(false);
        }
    };

    const handleStatusChange = async (newStatus: TicketStatus) => {
        if (newStatus === status || updatingStatus) return;
        setUpdatingStatus(true);
        try {
            await onStatusChange(ticket.id, newStatus);
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
            {/* Card Header */}
            <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setExpanded(e => !e)}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${categoryCfg.cls}`}>
                    <CatIcon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold leading-snug truncate pr-1">{ticket.title}</p>
                        <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                            #{ticket.id.slice(0, 8)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${categoryCfg.cls}`}>
                            {categoryCfg.label}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priorityCfg.cls}`}>
                            {priorityCfg.label}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statusCfg.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotCls}`} />
                            {statusCfg.label}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <Building2 size={11} className="text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{ticket.institution.name}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INST_TYPE_COLORS[ticket.institution.type] ?? ''}`}>
                                {ticket.institution.type}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock size={10} className="text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{relativeTime(ticket.createdAt)}</span>
                        </div>
                        {replies.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                                {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
                            </span>
                        )}
                    </div>
                </div>

                {expanded
                    ? <ChevronUp size={15} className="text-muted-foreground mt-1 shrink-0" />
                    : <ChevronDown size={15} className="text-muted-foreground mt-1 shrink-0" />
                }
            </button>

            {/* Expanded content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-border/40 px-4 py-4 space-y-4">

                            {/* Description */}
                            <div className="p-3 bg-muted/30 rounded-xl">
                                <p className="text-[11px] font-semibold text-muted-foreground mb-1">Description</p>
                                <p className="text-sm text-foreground leading-relaxed">{ticket.description}</p>
                                <p className="text-[11px] text-muted-foreground mt-2">from {ticket.adminEmail}</p>
                            </div>

                            {/* Reply thread */}
                            {replies.length > 0 && (
                                <div className="space-y-2.5">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Thread</p>
                                    {replies.map(r => {
                                        const isSA = r.role === 'SUPER_ADMIN';
                                        return (
                                            <div key={r.id} className={`flex gap-2.5 ${isSA ? 'flex-row-reverse' : ''}`}>
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isSA
                                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                                                    : 'bg-muted text-muted-foreground'}`}>
                                                    {r.author.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                </div>
                                                <div className={`flex-1 flex flex-col ${isSA ? 'items-end' : 'items-start'}`}>
                                                    <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] ${isSA
                                                        ? 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100'
                                                        : 'bg-muted text-foreground'}`}>
                                                        {r.message}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-1 px-1">
                                                        {r.author} · {relativeTime(r.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Reply input */}
                            {status !== 'CLOSED' && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Reply</p>
                                    <div className="flex gap-2">
                                        <textarea
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                            placeholder="Type your reply..."
                                            rows={2}
                                            className="flex-1 px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none"
                                        />
                                        <button
                                            onClick={handleSendReply}
                                            disabled={!replyText.trim() || sending}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold self-end disabled:opacity-50 transition-all hover:opacity-90"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                        >
                                            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                            Send
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Status update */}
                            <div className="flex items-center gap-3 pt-1 border-t border-border/40 flex-wrap">
                                <p className="text-[11px] font-semibold text-muted-foreground">
                                    {updatingStatus ? 'Updating…' : 'Update Status:'}
                                </p>
                                <div className="flex gap-1.5 flex-wrap">
                                    {(Object.keys(STATUS_CFG) as TicketStatus[]).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => handleStatusChange(s)}
                                            disabled={updatingStatus}
                                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${status === s
                                                ? STATUS_CFG[s].cls + ' ring-2 ring-offset-1 ring-primary/30'
                                                : 'border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-50'}`}
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

const PAGE_SIZE = 20;

export default function TicketsPage() {
    const [tickets, setTickets]       = useState<Ticket[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
    const [loading, setLoading]       = useState(false);
    const [page, setPage]             = useState(1);

    const [search, setSearch]                   = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeStatus, setActiveStatus]       = useState('ALL');
    const [activeCategories, setActiveCategories] = useState<string[]>([]);

    // Debounce search 400ms
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(val);
            setPage(1);
        }, 400);
    };

    const fetchTickets = useCallback(async (currentPage = page) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('limit', String(PAGE_SIZE));
            if (activeStatus !== 'ALL') params.set('status', activeStatus);
            if (activeCategories.length === 1) params.set('category', activeCategories[0]);
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

            const res = await api.get(`/superadmin/support/tickets?${params}`);
            setTickets(res.data?.tickets ?? []);
            setPagination(res.data?.pagination ?? { total: 0, page: currentPage, limit: PAGE_SIZE, pages: 1 });
        } catch {
            toast.error('Failed to load tickets');
        } finally {
            setLoading(false);
        }
    }, [page, activeStatus, activeCategories, debouncedSearch]);

    useEffect(() => {
        void fetchTickets(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, activeStatus, activeCategories, debouncedSearch]);

    const handleReply = async (id: string, message: string): Promise<TicketReply> => {
        const res = await api.post(`/superadmin/support/tickets/${id}/reply`, { message });
        return res.data.data as TicketReply;
    };

    const handleStatusChange = async (id: string, status: TicketStatus) => {
        await api.patch(`/superadmin/support/tickets/${id}/status`, { status });
    };

    const toggleCategory = (val: string) =>
        setActiveCategories(prev =>
            prev.includes(val) ? prev.filter(f => f !== val) : [...prev, val]
        );

    const openCount       = pagination.total;
    const hasFilters      = debouncedSearch || activeStatus !== 'ALL' || activeCategories.length > 0;

    return (
        <div className="space-y-2">

            {/* ── Page Header ── */}
            <div className="sticky top-0 z-20 bg-background pb-1 space-y-2">
                <div className="flex items-center justify-between pt-0 px-1 flex-wrap gap-3">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <TicketIcon size={21} />
                            Support Tickets
                        </h1>
                        <p className="text-muted-foreground text-[13px]">
                            {pagination.total > 0 ? `${pagination.total} ticket${pagination.total !== 1 ? 's' : ''}` : 'No tickets yet'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                            placeholder="Search tickets..."
                            className="w-56 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                        />
                        {search && (
                            <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Status filters */}
                    {STATUS_FILTERS.map(f => (
                        <button key={f.value} onClick={() => { setActiveStatus(f.value); setPage(1); }}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${activeStatus === f.value
                                ? 'bg-primary text-white border-primary'
                                : 'border-border/50 text-muted-foreground hover:text-foreground'}`}>
                            {f.label}
                        </button>
                    ))}

                    {/* Category filters */}
                    {CATEGORY_FILTERS.map(f => (
                        <button key={f.value} onClick={() => { toggleCategory(f.value); setPage(1); }}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${activeCategories.includes(f.value)
                                ? f.cls
                                : 'border-border/50 text-muted-foreground hover:text-foreground'}`}>
                            {f.label}
                        </button>
                    ))}

                    {hasFilters && (
                        <button onClick={() => { setSearch(''); setDebouncedSearch(''); setActiveStatus('ALL'); setActiveCategories([]); setPage(1); }}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                            <X size={11} /> Clear
                        </button>
                    )}

                    <Button variant="outline" size="icon" onClick={() => fetchTickets(page)} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
                </div>
                <div className="h-px bg-border/60" />
            </div>

            {/* ── Tickets Grid ── */}
            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border/50 rounded-2xl h-28 animate-pulse" />
                    ))}
                </div>
            ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        <TicketIcon size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                        {hasFilters ? 'No tickets match your filters' : 'No tickets yet'}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                        {hasFilters ? 'Try adjusting your filters' : 'Tickets submitted by institutions will appear here'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {tickets.map((ticket, i) => (
                        <TicketCard
                            key={ticket.id}
                            ticket={ticket}
                            index={i}
                            onReply={handleReply}
                            onStatusChange={handleStatusChange}
                        />
                    ))}
                </div>
            )}

            {/* ── Pagination ── */}
            {!loading && pagination.pages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1">
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
