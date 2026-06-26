'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Bell, RefreshCw, Megaphone, Wrench, Sparkles, Bug,
    CreditCard, ShieldAlert, Users, School, GraduationCap,
    BookOpen, Building2, CheckCircle2, Clock, ChevronLeft,
    ChevronRight, ChevronDown, Check, X, Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PublishNotificationModal } from '@/components/superadmin/PublishNotificationModal';
import api from '@/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type Notification = {
    id: string;
    title: string;
    message: string;
    tag: string;
    recipientType: string;
    deliveredTo: number;
    sentById: string | null;
    createdAt: string;
};

type Pagination = { total: number; page: number; limit: number; pages: number };

// ─── Config ───────────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    ANNOUNCEMENT: { label: 'Announcement',   icon: Megaphone,    cls: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800' },
    MAINTENANCE:  { label: 'Maintenance',    icon: Wrench,       cls: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800' },
    UPDATE:       { label: 'Update',         icon: Bell,         cls: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-800' },
    FEATURE:      { label: 'Feature Added',  icon: Sparkles,     cls: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' },
    BUG_FIXED:    { label: 'Bug Fixed',      icon: Bug,          cls: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800' },
    PLAN_EXPIRY:  { label: 'Plan Expiring',  icon: CreditCard,   cls: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800' },
    SECURITY:     { label: 'Security Alert', icon: ShieldAlert,  cls: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800' },
    TRIAL:        { label: 'Trial',          icon: Clock,        cls: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800' },
    SYSTEM:       { label: 'System',         icon: Bell,         cls: 'bg-muted text-muted-foreground border-border' },
};

const RECIPIENT_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
    ALL:      { label: 'All Institutions',    icon: Users },
    SCHOOL:   { label: 'Schools',             icon: School },
    COLLEGE:  { label: 'Colleges',            icon: GraduationCap },
    COACHING: { label: 'Coaching',            icon: BookOpen },
    SPECIFIC: { label: 'Specific Institution',icon: Building2 },
    SYSTEM:   { label: 'System',              icon: Bell },
};

const TAG_FILTER_OPTIONS = ['All Tags', ...Object.keys(TAG_CONFIG)];
const RECIPIENT_FILTER_OPTIONS = ['All Recipients', ...Object.keys(RECIPIENT_CONFIG)];
const PAGE_SIZE = 15;

function toIST(iso: string) {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }),
    };
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown({ value, onChange, options, getLabel }: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    getLabel?: (v: string) => string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm text-foreground hover:bg-muted/60 transition-all whitespace-nowrap min-w-[150px] justify-between"
            >
                <span className="truncate">{getLabel ? getLabel(value) : value}</span>
                <ChevronDown size={13} className={`text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-11 left-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-full max-h-64 overflow-y-auto"
                    >
                        {options.map(opt => {
                            const label = getLabel ? getLabel(opt) : opt;
                            const isSelected = opt === value;
                            return (
                                <button key={opt} type="button"
                                    onClick={() => { onChange(opt); setOpen(false); }}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors
                                        ${isSelected ? 'bg-primary/8 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                                >
                                    <span>{label}</span>
                                    {isSelected && <Check size={13} className="shrink-0" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Notification Card ─────────────────────────────────────────────────────────

function NotificationCard({ notif, index }: { notif: Notification; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const tag = TAG_CONFIG[notif.tag] ?? { label: notif.tag, icon: Bell, cls: 'bg-muted text-muted-foreground border-border' };
    const TagIcon = tag.icon;
    const recipient = RECIPIENT_CONFIG[notif.recipientType] ?? { label: notif.recipientType, icon: Users };
    const RecipientIcon = recipient.icon;
    const { date, time } = toIST(notif.createdAt);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-border transition-all"
        >
            <div
                className="flex items-start gap-4 p-4 cursor-pointer"
                onClick={() => setExpanded(e => !e)}
            >
                {/* Tag icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${tag.cls}`}>
                    <TagIcon size={16} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <p className="text-sm font-semibold truncate">{notif.title}</p>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${tag.cls}`}>
                                    {tag.label}
                                </span>
                            </div>
                            <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? '' : 'line-clamp-1'}`}>
                                {notif.message}
                            </p>
                        </div>

                        {/* Expand toggle */}
                        <ChevronDown
                            size={14}
                            className={`text-muted-foreground shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        />
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <RecipientIcon size={11} />
                            {recipient.label}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 size={11} />
                            {notif.deliveredTo} delivered
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock size={11} />
                            {date} · {time}
                        </span>
                    </div>
                </div>
            </div>

            {/* Expanded full message */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-0">
                            <div className={`border rounded-xl p-4 ${tag.cls}`}>
                                <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">{tag.label}</p>
                                <p className="text-sm font-semibold mb-1">{notif.title}</p>
                                <p className="text-sm leading-relaxed opacity-80">{notif.message}</p>
                                <p className="text-[11px] mt-3 opacity-60">Sent by QubeEx SuperAdmin · {date} at {time}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
    const [loading, setLoading] = useState(false);
    const [broadcastOpen, setBroadcastOpen] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState('All Tags');
    const [recipientFilter, setRecipientFilter] = useState('All Recipients');
    const [page, setPage] = useState(1);

    const fetchNotifications = useCallback(async (currentPage = page) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('limit', String(PAGE_SIZE));

            const res = await api.get(`/superadmin/notifications?${params.toString()}`);
            const { notifications: raw, pagination: pg } = res.data ?? {};
            setNotifications(raw ?? []);
            setPagination(pg ?? { total: 0, page: currentPage, limit: PAGE_SIZE, pages: 1 });
        } catch {
            toast.error('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        void fetchNotifications(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    // Client-side filtering (current page only)
    const filtered = notifications.filter(n => {
        const q = search.toLowerCase();
        const matchesSearch = !q || n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
        const matchesTag = tagFilter === 'All Tags' || n.tag === tagFilter;
        const matchesRecipient = recipientFilter === 'All Recipients' || n.recipientType === recipientFilter;
        return matchesSearch && matchesTag && matchesRecipient;
    });

    const hasFilters = search || tagFilter !== 'All Tags' || recipientFilter !== 'All Recipients';

    const clearFilters = () => {
        setSearch('');
        setTagFilter('All Tags');
        setRecipientFilter('All Recipients');
    };

    const goToPage = (p: number) => setPage(p);

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-20 bg-background pb-2 space-y-2">
                <div className="flex items-center justify-between pt-1 px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Bell size={21} />
                            Notifications
                        </h1>
                        <p className="text-muted-foreground text-[13px]">
                            {pagination.total > 0
                                ? `${pagination.total.toLocaleString('en-IN')} notifications sent`
                                : 'Broadcast messages to institutions'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => fetchNotifications(page)} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </Button>
                        <button
                            onClick={() => setBroadcastOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md hover:opacity-90 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                        >
                            <Megaphone size={15} />
                            Broadcast
                        </button>
                    </div>
                </div>

                <div className="h-px bg-border/60" />

                {/* Filter bar */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search notifications..."
                            className="w-64 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                        />
                        {search && (
                            <button onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    <Dropdown
                        value={tagFilter}
                        onChange={v => { setTagFilter(v); setPage(1); }}
                        options={TAG_FILTER_OPTIONS}
                        getLabel={v => v === 'All Tags' ? 'All Tags' : (TAG_CONFIG[v]?.label ?? v)}
                    />
                    <Dropdown
                        value={recipientFilter}
                        onChange={v => { setRecipientFilter(v); setPage(1); }}
                        options={RECIPIENT_FILTER_OPTIONS}
                        getLabel={v => v === 'All Recipients' ? 'All Recipients' : (RECIPIENT_CONFIG[v]?.label ?? v)}
                    />

                    {hasFilters && (
                        <button onClick={clearFilters}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                            <X size={11} /> Clear all
                        </button>
                    )}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 flex flex-col min-h-0 pb-6">
                {loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-card border border-border/50 rounded-2xl h-20 animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
                        <Bell size={40} className="text-muted-foreground/30 mb-4" />
                        <p className="text-sm font-medium text-muted-foreground">
                            {notifications.length === 0 ? 'No notifications sent yet' : 'No notifications match your filters'}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            {notifications.length === 0
                                ? 'Click Broadcast to send your first notification to institutions'
                                : 'Try adjusting your filters'}
                        </p>
                        {notifications.length === 0 && (
                            <button
                                onClick={() => setBroadcastOpen(true)}
                                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            >
                                <Megaphone size={14} />
                                Broadcast Now
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((notif, i) => (
                            <NotificationCard key={notif.id} notif={notif} index={i} />
                        ))}
                    </div>
                )}

                {/* ── Pagination ── */}
                {!loading && pagination.pages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-1">
                        <p className="text-[11px] text-muted-foreground">
                            Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString('en-IN')} total
                        </p>
                        <div className="flex items-center gap-1">
                            <button onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1}
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
                                .map((p, i) =>
                                    p === '...' ? (
                                        <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">...</span>
                                    ) : (
                                        <button key={p} onClick={() => goToPage(p as number)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all
                                                ${page === p ? 'bg-primary text-white' : 'border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                                            {p}
                                        </button>
                                    )
                                )
                            }

                            <button onClick={() => goToPage(Math.min(pagination.pages, page + 1))} disabled={page === pagination.pages}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Broadcast modal — refreshes list after send */}
            <PublishNotificationModal
                open={broadcastOpen}
                onClose={() => {
                    setBroadcastOpen(false);
                    void fetchNotifications(1);
                    setPage(1);
                }}
            />
        </div>
    );
}
