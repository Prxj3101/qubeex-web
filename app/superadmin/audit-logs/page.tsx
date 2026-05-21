'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, ScrollText, Search, X, ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type LogEntry = {
    id: string;
    action: string;
    userId?: string | null;
    actorRole?: string | null;
    institutionId?: string | null;
    details?: string | null;
    ip?: string | null;
    metadata?: unknown;
    createdAt: string;
    user?: { id: string; name?: string | null; email: string } | null;
    institution?: { id: string; name: string; institutionCode?: string } | null;
};

type Pagination = { total: number; page: number; limit: number; pages: number };

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; cls: string }> = {
    INSTITUTION_CREATED:   { label: 'Institution Created',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    INSTITUTION_SUSPENDED: { label: 'Institution Suspended', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    INSTITUTION_ACTIVATED: { label: 'Institution Activated', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400' },
    INVITE_SENT:           { label: 'Invite Sent',           cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400' },
    INVITE_ACCEPTED:       { label: 'Invite Accepted',       cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    PLAN_ASSIGNED:         { label: 'Plan Assigned',         cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    LOGIN_SUCCESS:         { label: 'Login Success',         cls: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400' },
    LOGIN_FAILED:          { label: 'Login Failed',          cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' },
    NOTIFICATION_SENT:     { label: 'Notification Sent',     cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
};

const ROLES_LIST  = ['All Roles', 'SUPER_ADMIN', 'ADMIN'];
const ACTION_LIST = ['All Action Types', ...Object.keys(ACTION_CONFIG)];
const PAGE_SIZE   = 15;

/** Format a UTC ISO string to IST date + time */
function toIST(iso: string) {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('en-IN',  { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN',  { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }),
    };
}

// ─── Custom Dropdown ──────────────────────────────────────────────────────────

function CustomDropdown({ value, onChange, options, getLabel }: {
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

    const label = getLabel ? getLabel(value) : value;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm text-foreground hover:bg-muted/60 transition-all whitespace-nowrap min-w-[150px] justify-between"
            >
                <span className="truncate">{label}</span>
                <ChevronDown size={13} className={`text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-11 left-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-full max-h-64 overflow-y-auto"
                    >
                        {options.map(opt => {
                            const optLabel = getLabel ? getLabel(opt) : opt;
                            const isSelected = opt === value;
                            return (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => { onChange(opt); setOpen(false); }}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors
                                        ${isSelected ? 'bg-primary/8 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                                >
                                    <span>{optLabel}</span>
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

// ─── Date Input with Label ────────────────────────────────────────────────────

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="relative">
            <label className="absolute -top-2 left-2.5 text-[10px] font-medium text-muted-foreground bg-background px-1 z-10">
                {label}
            </label>
            <input
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="h-9 px-3 w-36 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all"
            />
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
    const [logs, setLogs]           = useState<LogEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
    const [loading, setLoading]     = useState(false);

    // Filter state (applied server-side via query params)
    const [search, setSearch]       = useState('');
    const [actionFilter, setActionFilter] = useState('All Action Types');
    const [roleFilter, setRoleFilter]     = useState('All Roles');
    const [fromDate, setFromDate]   = useState('');
    const [toDate, setToDate]       = useState('');
    const [page, setPage]           = useState(1);

    // Institution names for dropdown (built from current page results + remembered across pages)
    const [instNames, setInstNames] = useState<string[]>([]);

    const fetchLogs = useCallback(async (currentPage = page) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            params.set('page',  String(currentPage));
            params.set('limit', String(PAGE_SIZE));
            if (actionFilter !== 'All Action Types') params.set('action',    actionFilter);
            if (roleFilter   !== 'All Roles')        params.set('actorRole', roleFilter);
            if (fromDate)                             params.set('from',      fromDate);
            if (toDate)                               params.set('to',        toDate + 'T23:59:59');

            const res = await api.get(`/superadmin/audit-logs?${params.toString()}`);
            const { logs: rawLogs, pagination: pg } = res.data;

            setLogs(rawLogs ?? []);
            setPagination(pg ?? { total: 0, page: currentPage, limit: PAGE_SIZE, pages: 1 });

            // Collect institution names for dropdown (accumulate across fetches)
            const names = (rawLogs ?? [])
                .map((l: LogEntry) => l.institution?.name)
                .filter(Boolean) as string[];
            setInstNames(prev => Array.from(new Set([...prev, ...names])));
        } catch {
            toast.error('Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    }, [page, actionFilter, roleFilter, fromDate, toDate]);

    // Fetch on mount and whenever server-side filters change
    useEffect(() => {
        fetchLogs(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, actionFilter, roleFilter, fromDate, toDate]);

    // Client-side search filter (runs on current page data only)
    const filtered = useMemo(() => {
        if (!search.trim()) return logs;
        const q = search.toLowerCase();
        return logs.filter(l =>
            l.institution?.name?.toLowerCase().includes(q) ||
            l.details?.toLowerCase().includes(q) ||
            l.actorRole?.toLowerCase().includes(q) ||
            l.action?.toLowerCase().includes(q)
        );
    }, [logs, search]);

    const clearFilters = () => {
        setSearch('');
        setActionFilter('All Action Types');
        setRoleFilter('All Roles');
        setFromDate('');
        setToDate('');
        setPage(1);
    };

    const hasFilters = search || actionFilter !== 'All Action Types' || roleFilter !== 'All Roles' || fromDate || toDate;

    const goToPage = (p: number) => {
        setPage(p);
        // fetchLogs called automatically via useEffect
    };

    const INSTITUTIONS_LIST = ['All Institutions', ...instNames];

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-20 bg-background pb-3 space-y-3">

                <div className="flex items-center justify-between pt-3 px-1">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ScrollText size={28} />
                            Audit Logs
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {pagination.total > 0
                                ? `${pagination.total.toLocaleString('en-IN')} total events · All times in IST`
                                : 'Track all platform and institution activity'}
                        </p>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => fetchLogs(page)} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>

                <div className="h-px bg-border/60" />

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search (client-side on current page) */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search current page..."
                            className="w-72 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                        />
                        {search && (
                            <button onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    <CustomDropdown value={actionFilter} onChange={v => { setActionFilter(v); setPage(1); }} options={ACTION_LIST}
                        getLabel={v => v === 'All Action Types' ? 'All Action Types' : (ACTION_CONFIG[v]?.label ?? v)} />
                    <CustomDropdown value={roleFilter} onChange={v => { setRoleFilter(v); setPage(1); }} options={ROLES_LIST} />
                    <DateInput label="From" value={fromDate} onChange={v => { setFromDate(v); setPage(1); }} />
                    <DateInput label="To"   value={toDate}   onChange={v => { setToDate(v);   setPage(1); }} />

                    {hasFilters && (
                        <button onClick={clearFilters}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                            <X size={11} /> Clear all
                        </button>
                    )}
                </div>
            </div>

            {/* ── Table ── */}
            <div className="flex-1 flex flex-col min-h-0 pb-6">
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col">

                    {/* Sticky Table header */}
                    <div className="grid grid-cols-[140px_190px_180px_1fr_170px] gap-4 px-5 py-3 border-b border-border/50 bg-muted/30 sticky top-0 z-10">
                        {['TIMESTAMP (IST)', 'ACTION', 'ACTOR', 'CONTEXT / DETAILS', 'INSTITUTION'].map(h => (
                            <p key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</p>
                        ))}
                    </div>

                    {/* Scrollable body */}
                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                        {loading ? (
                        <div>
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="grid grid-cols-[140px_190px_180px_1fr_170px] gap-4 px-5 py-4 border-b border-border/40 last:border-none animate-pulse">
                                    {[...Array(5)].map((_, j) => <div key={j} className="h-4 bg-muted rounded" />)}
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <ScrollText size={32} className="text-muted-foreground/30 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">
                                {logs.length === 0 ? 'No audit logs yet' : 'No logs match your search'}
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                {logs.length === 0 ? 'Actions like login, institution create, and invites will appear here' : 'Try adjusting your filters'}
                            </p>
                        </div>
                    ) : (
                        filtered.map((log, i) => {
                            const { date, time } = toIST(log.createdAt);
                            const actionCfg = ACTION_CONFIG[log.action] ?? {
                                label: log.action.replace(/_/g, ' '),
                                cls: 'bg-muted text-muted-foreground',
                            };
                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.025 }}
                                    className="grid grid-cols-[140px_190px_180px_1fr_170px] gap-4 px-5 py-4 border-b border-border/40 last:border-none hover:bg-muted/20 transition-colors"
                                >
                                    {/* Timestamp (IST) */}
                                    <div>
                                        <p className="text-xs font-medium">{date}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{time}</p>
                                    </div>

                                    {/* Action badge */}
                                    <div className="flex items-start pt-0.5">
                                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${actionCfg.cls}`}>
                                            {actionCfg.label}
                                        </span>
                                    </div>

                                    {/* Actor */}
                                    <div>
                                        <p className="text-xs font-medium truncate">
                                            {log.user?.email ?? log.userId ?? '—'}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {log.actorRole ?? '—'}
                                        </p>
                                    </div>

                                    {/* Details */}
                                    <div>
                                        <p className="text-xs text-foreground leading-relaxed">
                                            {log.details ?? <span className="text-muted-foreground/50 italic">No details</span>}
                                        </p>
                                        {log.ip && (
                                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">IP: {log.ip}</p>
                                        )}
                                    </div>

                                    {/* Institution */}
                                    <div className="flex items-start">
                                        {log.institution ? (
                                            <div>
                                                <p className="text-xs font-medium text-foreground">{log.institution.name}</p>
                                                {log.institution.institutionCode && (
                                                    <p className="text-[10px] font-mono mt-0.5" style={{ color: '#DA7756' }}>
                                                        {log.institution.institutionCode}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">—</p>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                    </div>
                </div>

                {/* ── Pagination ── */}
                <div className="flex items-center justify-between mt-4 px-1">
                    <p className="text-[11px] text-muted-foreground">
                        {pagination.total > 0
                            ? `Page ${pagination.page} of ${pagination.pages} · ${pagination.total.toLocaleString('en-IN')} total logs`
                            : 'No logs'}
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
            </div>
        </div>
    );
}
