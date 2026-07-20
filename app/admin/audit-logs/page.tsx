'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    RefreshCw, ScrollText, Search, X, ChevronLeft, ChevronRight,
    ChevronDown, Check, Shield, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
type LogEntry = {
    id: string;
    action: string;
    category: string;
    severity: string;
    actorRole?: string | null;
    details?: string | null;
    ip?: string | null;
    createdAt: string;
    user?: { id: string; name?: string | null; email: string } | null;
};

type Pagination = { total: number; page: number; limit: number; pages: number };
type Tab = 'ADMIN_ACTION' | 'SECURITY';

// ─── Action Config ────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
    // Staff
    TEACHER_ADDED: { label: 'Teacher Added', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500' },
    TEACHER_UPDATED: { label: 'Teacher Updated', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400', dot: 'bg-sky-500' },
    TEACHER_DEACTIVATED: { label: 'Teacher Deactivated', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    TEACHER_ACTIVATED: { label: 'Teacher Activated', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500' },
    TEACHER_INVITE_RESENT: { label: 'Invite Resent', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', dot: 'bg-amber-500' },
    INVITE_ACCEPTED: { label: 'Invite Accepted', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400', dot: 'bg-teal-500' },
    // Students
    STUDENT_ADDED: { label: 'Student Added', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400', dot: 'bg-violet-500' },
    STUDENT_UPDATED: { label: 'Student Updated', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400', dot: 'bg-blue-500' },
    STUDENT_DEACTIVATED: { label: 'Student Deactivated', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    STUDENT_ACTIVATED: { label: 'Student Activated', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500' },
    // Sub-admins
    SUBADMIN_DEACTIVATED: { label: 'Sub-admin Deactivated', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    SUBADMIN_ACTIVATED: { label: 'Sub-admin Activated', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500' },
    // Campus
    CLASS_CREATED: { label: 'Class Created', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', dot: 'bg-amber-500' },
    CLASS_UPDATED: { label: 'Class Updated', cls: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-500', dot: 'bg-amber-400' },
    CLASS_DELETED: { label: 'Class Deleted', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    SUBJECT_CREATED: { label: 'Subject Created', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400', dot: 'bg-teal-500' },
    SUBJECT_UPDATED: { label: 'Subject Updated', cls: 'bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-500', dot: 'bg-teal-400' },
    SUBJECT_DELETED: { label: 'Subject Deleted', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    TEACHER_ASSIGNED: { label: 'Teacher Assigned', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400', dot: 'bg-indigo-500' },
    TEACHER_UNASSIGNED: { label: 'Teacher Unassigned', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400', dot: 'bg-orange-500' },
    // Content
    ANNOUNCEMENT_POSTED: { label: 'Announcement Posted', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400', dot: 'bg-orange-500' },
    POST_DELETED: { label: 'Post Deleted', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    // Institution
    INSTITUTION_UPDATED: { label: 'Settings Updated', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-500' },
    INSTITUTION_LOGO_UPDATED: { label: 'Logo Updated', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
    // Security
    LOGIN_FAILED: { label: 'Login Failed', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400', dot: 'bg-rose-500' },
    PASSWORD_CHANGED: { label: 'Password Changed', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', dot: 'bg-amber-500' },
    LOGIN_SUCCESS: { label: 'Login', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
};

const SECURITY_ACTIONS_LIST = ['LOGIN_FAILED', 'PASSWORD_CHANGED', 'LOGIN_SUCCESS'];
const ACTIVITY_ACTIONS_LIST = Object.keys(ACTION_CONFIG).filter(k => !SECURITY_ACTIONS_LIST.includes(k));

const ROLES_LIST = ['All Roles', 'ADMIN', 'TEACHER'];
const PAGE_SIZE = 15;

function toIST(iso: string) {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }),
    };
}

// ─── Custom Dropdown ──────────────────────────────────────────────────────────
function CustomDropdown({ value, onChange, options, getLabel }: {
    value: string; onChange: (v: string) => void;
    options: string[]; getLabel?: (v: string) => string;
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
            <button type="button" onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm text-foreground hover:bg-muted/60 transition-all whitespace-nowrap min-w-[150px] justify-between">
                <span className="truncate">{getLabel ? getLabel(value) : value}</span>
                <ChevronDown size={13} className={`text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-11 left-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-full max-h-64 overflow-y-auto">
                        {options.map(opt => (
                            <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); }}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors
                                    ${opt === value ? 'bg-primary/8 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}>
                                <span className="flex items-center gap-2">
                                    {opt !== 'All Action Types' && opt !== 'All Roles' && ACTION_CONFIG[opt] && (
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${ACTION_CONFIG[opt].dot}`} />
                                    )}
                                    {getLabel ? getLabel(opt) : opt}
                                </span>
                                {opt === value && <Check size={13} className="shrink-0" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Date Input ───────────────────────────────────────────────────────────────
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="relative">
            <label className="absolute -top-2 left-2.5 text-[10px] font-medium text-muted-foreground bg-background px-1 z-10">{label}</label>
            <input type="date" value={value} onChange={e => onChange(e.target.value)}
                className="h-9 px-3 w-36 rounded-xl border border-border bg-muted/40 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all" />
        </div>
    );
}

// ─── Severity dot ─────────────────────────────────────────────────────────────
function SeverityDot({ severity }: { severity: string }) {
    if (severity === 'CRITICAL') return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 ring-2 ring-red-200 dark:ring-red-900" />;
    if (severity === 'WARNING') return <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />;
    return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminAuditLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('ADMIN_ACTION');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('All Action Types');
    const [roleFilter, setRoleFilter] = useState('All Roles');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    // Reset action filter when tab changes
    useEffect(() => {
        setActionFilter('All Action Types');
        setPage(1);
    }, [activeTab]);

    const actionList = activeTab === 'ADMIN_ACTION'
        ? ['All Action Types', ...ACTIVITY_ACTIONS_LIST]
        : ['All Action Types', ...SECURITY_ACTIONS_LIST];

    const fetchLogs = useCallback(async (currentPage = page) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('limit', String(PAGE_SIZE));
            params.set('category', activeTab);
            if (actionFilter !== 'All Action Types') params.set('action', actionFilter);
            if (roleFilter !== 'All Roles') params.set('actorRole', roleFilter);
            if (fromDate) params.set('from', fromDate);
            if (toDate) params.set('to', toDate + 'T23:59:59');
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

            const res = await api.get(`/admin/audit-logs?${params.toString()}`);
            const { logs: rawLogs, pagination: pg } = res.data.data;
            setLogs(rawLogs ?? []);
            setPagination(pg ?? { total: 0, page: currentPage, limit: PAGE_SIZE, pages: 1 });
        } catch {
            toast.error('Failed to load audit logs');
            setLogs([]);
            setPagination({ total: 0, page: currentPage, limit: PAGE_SIZE, pages: 1 });
        } finally {
            setLoading(false);
        }
    }, [page, activeTab, actionFilter, roleFilter, fromDate, toDate, debouncedSearch]);

    useEffect(() => { fetchLogs(page); }, [page, activeTab, actionFilter, roleFilter, fromDate, toDate, debouncedSearch]);

    const clearFilters = () => {
        setSearch(''); setActionFilter('All Action Types');
        setRoleFilter('All Roles'); setFromDate(''); setToDate(''); setPage(1);
    };

    const hasFilters = search || actionFilter !== 'All Action Types' || roleFilter !== 'All Roles' || fromDate || toDate;

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-20 bg-background pb-2 pt-0 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <ScrollText size={21} />
                            Audit Logs
                        </h1>
                        <p className="text-muted-foreground text-[13px]">
                            {pagination.total > 0
                                ? `${pagination.total.toLocaleString('en-IN')} events · All times in IST`
                                : 'Track all institution activity'}
                        </p>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => fetchLogs(page)} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>

                {/* ── Tabs ── */}
                <div className="flex items-center gap-1 border-b border-border/60">
                    {([
                        { key: 'ADMIN_ACTION' as Tab, label: 'Activity', icon: Activity },
                        { key: 'SECURITY' as Tab, label: 'Security', icon: Shield },
                    ]).map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${activeTab === key
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}>
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* ── Filters ── */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search logs..."
                            className="w-64 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all" />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <CustomDropdown value={actionFilter} onChange={v => { setActionFilter(v); setPage(1); }} options={actionList}
                        getLabel={v => v === 'All Action Types' ? 'All Action Types' : (ACTION_CONFIG[v]?.label ?? v)} />
                    <CustomDropdown value={roleFilter} onChange={v => { setRoleFilter(v); setPage(1); }} options={ROLES_LIST} />
                    <DateInput label="From" value={fromDate} onChange={v => { setFromDate(v); setPage(1); }} />
                    <DateInput label="To" value={toDate} onChange={v => { setToDate(v); setPage(1); }} />
                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                            <X size={11} /> Clear all
                        </button>
                    )}
                </div>
            </div>

            {/* ── Table ── */}
            <div className="flex-1 flex flex-col min-h-0 pb-6">
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col">
                  <div className="overflow-x-auto">
                    <div className="min-w-[700px]">
                    <div className="grid grid-cols-[140px_200px_180px_1fr] gap-4 px-5 py-3 border-b border-border/50 bg-muted/30">
                        {['TIMESTAMP (IST)', 'ACTION', 'ACTOR', 'DETAILS'].map(h => (
                            <p key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</p>
                        ))}
                    </div>

                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
                        {loading ? (
                            <div>
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="grid grid-cols-[140px_200px_180px_1fr] gap-4 px-5 py-4 border-b border-border/40 last:border-none animate-pulse">
                                        {[...Array(4)].map((_, j) => <div key={j} className="h-4 bg-muted rounded" />)}
                                    </div>
                                ))}
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <ScrollText size={32} className="text-muted-foreground/30 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    {hasFilters ? 'No logs match your filters' : 'No logs yet'}
                                </p>
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                    {hasFilters ? 'Try adjusting your search or filters' : 'Actions will appear here'}
                                </p>
                            </div>
                        ) : (
                            logs.map((log, i) => {
                                const { date, time } = toIST(log.createdAt);
                                const actionCfg = ACTION_CONFIG[log.action] ?? {
                                    label: log.action.replace(/_/g, ' '),
                                    cls: 'bg-muted text-muted-foreground',
                                    dot: 'bg-muted-foreground',
                                };
                                return (
                                    <motion.div key={log.id}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.02 }}
                                        className="grid grid-cols-[140px_200px_180px_1fr] gap-4 px-5 py-4 border-b border-border/40 last:border-none hover:bg-muted/20 transition-colors"
                                    >
                                        {/* Timestamp */}
                                        <div className="flex items-start gap-2">
                                            <SeverityDot severity={log.severity} />
                                            <div>
                                                <p className="text-xs font-medium">{date}</p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">{time}</p>
                                            </div>
                                        </div>

                                        {/* Action badge */}
                                        <div className="flex items-start pt-0.5">
                                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${actionCfg.cls}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${actionCfg.dot}`} />
                                                {actionCfg.label}
                                            </span>
                                        </div>

                                        {/* Actor */}
                                        <div>
                                            <p className="text-xs font-medium truncate">
                                                {log.user?.name ?? log.user?.email ?? '—'}
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
                                                <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">
                                                    {log.ip}
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>
                    </div>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between flex-wrap gap-2 mt-4 px-1">
                    <p className="text-[11px] text-muted-foreground">
                        {pagination.total > 0
                            ? `Page ${pagination.page} of ${pagination.pages} · ${pagination.total.toLocaleString('en-IN')} total`
                            : 'No logs'}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
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
                            .map((p, i) => p === '...' ? (
                                <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">...</span>
                            ) : (
                                <button key={p} onClick={() => setPage(p as number)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all
                                        ${page === p ? 'bg-primary text-white' : 'border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                                    {p}
                                </button>
                            ))}
                        <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
