'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { RefreshCw, ScrollText, Search, X, ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuditLog } from '@/types';
import api from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_LOGS: (AuditLog & { actorRole: string; institution: string; details: string; ip?: string; browser?: string })[] = [
    { id: '1', action: 'INSTITUTION_CREATED', userId: 'u1', createdAt: '2026-04-17T10:42:00Z', institutionId: 'i1', actorRole: 'SUPER_ADMIN', institution: 'Delhi Public School', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Created Delhi Public School · Type: SCHOOL · Plan: PRO · Admin: principal@dps.in' },
    { id: '2', action: 'INVITE_ACCEPTED', userId: 'u2', createdAt: '2026-04-17T10:45:00Z', institutionId: 'i1', actorRole: 'ADMIN', institution: 'Delhi Public School', user: { id: 'u2', email: 'principal@dps.in', role: 'ADMIN', createdAt: '' }, details: 'Accepted invite for Delhi Public School · Password set' },
    { id: '3', action: 'PLAN_ASSIGNED', userId: 'u1', createdAt: '2026-04-17T11:03:00Z', institutionId: 'i2', actorRole: 'SUPER_ADMIN', institution: 'IIT Coaching Centre', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Assigned plan PRO to IIT Coaching Centre' },
    { id: '4', action: 'INSTITUTION_SUSPENDED', userId: 'u1', createdAt: '2026-04-17T11:20:00Z', institutionId: 'i3', actorRole: 'SUPER_ADMIN', institution: "St. Mary's College", user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: "Suspended St. Mary's College · Status: ACTIVE → SUSPENDED" },
    { id: '5', action: 'LOGIN_SUCCESS', userId: 'u3', createdAt: '2026-04-17T11:45:00Z', institutionId: 'i3', actorRole: 'ADMIN', institution: "St. Mary's College", user: { id: 'u3', email: 'admin@stmarys.in', role: 'ADMIN', createdAt: '' }, details: 'Logged in · IP: 103.21.58.2 · Browser: Chrome/Linux' },
    { id: '6', action: 'INSTITUTION_CREATED', userId: 'u1', createdAt: '2026-04-16T09:10:00Z', institutionId: 'i4', actorRole: 'SUPER_ADMIN', institution: 'Ryan International', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Created Ryan International · Type: SCHOOL · Plan: BASIC · Admin: ryan@ryan.edu' },
    { id: '7', action: 'LOGIN_FAILED', userId: 'u4', createdAt: '2026-04-16T09:32:00Z', institutionId: 'i5', actorRole: 'ADMIN', institution: 'MES College', user: { id: 'u4', email: 'admin@mes.edu', role: 'ADMIN', createdAt: '' }, details: 'Login failed (3×) · IP: 49.32.11.4 · Browser: Firefox/Win' },
    { id: '8', action: 'INVITE_SENT', userId: 'u1', createdAt: '2026-04-16T10:00:00Z', institutionId: 'i6', actorRole: 'SUPER_ADMIN', institution: 'Kendriya Vidyalaya', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Invite sent to kv.admin@kv.edu.in for Kendriya Vidyalaya' },
    { id: '9', action: 'PLAN_ASSIGNED', userId: 'u1', createdAt: '2026-04-15T14:22:00Z', institutionId: 'i7', actorRole: 'SUPER_ADMIN', institution: 'Aakash Institute', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Assigned plan PRO to Aakash Institute · Upgraded from BASIC' },
    { id: '10', action: 'LOGIN_SUCCESS', userId: 'u5', createdAt: '2026-04-15T15:10:00Z', institutionId: 'i7', actorRole: 'ADMIN', institution: 'Aakash Institute', user: { id: 'u5', email: 'admin@aakash.ac.in', role: 'ADMIN', createdAt: '' }, details: 'Logged in · IP: 122.45.67.8 · Browser: Safari/Mac' },
    { id: '11', action: 'INSTITUTION_SUSPENDED', userId: 'u1', createdAt: '2026-04-15T16:00:00Z', institutionId: 'i8', actorRole: 'SUPER_ADMIN', institution: 'Modern High School', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Suspended Modern High School · Reason: Payment overdue' },
    { id: '12', action: 'INSTITUTION_ACTIVATED', userId: 'u1', createdAt: '2026-04-14T11:00:00Z', institutionId: 'i9', actorRole: 'SUPER_ADMIN', institution: 'Fergusson College', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Activated Fergusson College · Status: SUSPENDED → ACTIVE' },
    { id: '13', action: 'INVITE_ACCEPTED', userId: 'u6', createdAt: '2026-04-14T12:30:00Z', institutionId: 'i9', actorRole: 'ADMIN', institution: 'Fergusson College', user: { id: 'u6', email: 'admin@fergusson.edu', role: 'ADMIN', createdAt: '' }, details: 'Accepted invite for Fergusson College · Password set' },
    { id: '14', action: 'LOGIN_FAILED', userId: 'u1', createdAt: '2026-04-14T13:45:00Z', institutionId: undefined, actorRole: 'SUPER_ADMIN', institution: '—', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Login failed from new device · IP: 45.33.22.11' },
    { id: '15', action: 'INVITE_SENT', userId: 'u1', createdAt: '2026-04-13T09:00:00Z', institutionId: 'i10', actorRole: 'SUPER_ADMIN', institution: 'Hansraj College', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Invite sent to kavita@hansraj.edu.in for Hansraj College' },
    { id: '16', action: 'INSTITUTION_CREATED', userId: 'u1', createdAt: '2026-04-13T10:15:00Z', institutionId: 'i11', actorRole: 'SUPER_ADMIN', institution: 'DAV Public School', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Created DAV Public School · Type: SCHOOL · Plan: PRO · Admin: dav@dav.edu.in' },
    { id: '17', action: 'PLAN_ASSIGNED', userId: 'u1', createdAt: '2026-04-12T14:00:00Z', institutionId: 'i12', actorRole: 'SUPER_ADMIN', institution: 'DY Patil College', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Assigned plan BASIC to DY Patil College' },
    { id: '18', action: 'LOGIN_SUCCESS', userId: 'u7', createdAt: '2026-04-12T15:20:00Z', institutionId: 'i12', actorRole: 'ADMIN', institution: 'DY Patil College', user: { id: 'u7', email: 'admin@dypatil.edu', role: 'ADMIN', createdAt: '' }, details: 'Logged in · IP: 103.55.22.9 · Browser: Chrome/Win' },
    { id: '19', action: 'INSTITUTION_ACTIVATED', userId: 'u1', createdAt: '2026-04-11T10:00:00Z', institutionId: 'i13', actorRole: 'SUPER_ADMIN', institution: 'Shree Vidya College', user: { id: 'u1', email: 'superadmin@qubeex.in', role: 'SUPER_ADMIN', createdAt: '' }, details: 'Activated Shree Vidya College · Payment received' },
    { id: '20', action: 'INVITE_ACCEPTED', userId: 'u8', createdAt: '2026-04-11T11:30:00Z', institutionId: 'i13', actorRole: 'SUPER_ADMIN', institution: 'Shree Vidya College', user: { id: 'u8', email: 'admin@shreevidya.edu', role: 'ADMIN', createdAt: '' }, details: 'Accepted invite for Shree Vidya College · Password set' },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; cls: string }> = {
    INSTITUTION_CREATED: { label: 'Institution Created', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    INSTITUTION_SUSPENDED: { label: 'Institution Suspended', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    INSTITUTION_ACTIVATED: { label: 'Institution Activated', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400' },
    INVITE_SENT: { label: 'Invite Sent', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400' },
    INVITE_ACCEPTED: { label: 'Invite Accepted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    PLAN_ASSIGNED: { label: 'Plan Assigned', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
    LOGIN_SUCCESS: { label: 'Login Success', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400' },
    LOGIN_FAILED: { label: 'Login Failed', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' },
};

const INSTITUTIONS_LIST = ['All Institutions', ...Array.from(new Set(MOCK_LOGS.map(l => l.institution).filter(i => i !== '—')))];
const ROLES_LIST = ['All Roles', 'SUPER_ADMIN', 'ADMIN'];
const ACTION_LIST = ['All Action Types', ...Object.keys(ACTION_CONFIG)];
const PAGE_SIZE = 10;

type LogEntry = typeof MOCK_LOGS[0];

function formatTime(iso: string) {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
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
    const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('All Action Types');
    const [instFilter, setInstFilter] = useState('All Institutions');
    const [roleFilter, setRoleFilter] = useState('All Roles');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(1);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/audit-logs');
            setLogs(res.data.data);
        } catch {
            // keep mock data
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        let list = logs;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(l =>
                l.user?.email?.toLowerCase().includes(q) ||
                l.institution?.toLowerCase().includes(q) ||
                l.details?.toLowerCase().includes(q)
            );
        }
        if (actionFilter !== 'All Action Types') list = list.filter(l => l.action === actionFilter);
        if (instFilter !== 'All Institutions') list = list.filter(l => l.institution === instFilter);
        if (roleFilter !== 'All Roles') list = list.filter(l => l.actorRole === roleFilter);
        if (fromDate) list = list.filter(l => new Date(l.createdAt) >= new Date(fromDate));
        if (toDate) list = list.filter(l => new Date(l.createdAt) <= new Date(toDate + 'T23:59:59'));
        return list;
    }, [logs, search, actionFilter, instFilter, roleFilter, fromDate, toDate]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const clearFilters = () => {
        setSearch(''); setActionFilter('All Action Types');
        setInstFilter('All Institutions'); setRoleFilter('All Roles');
        setFromDate(''); setToDate(''); setPage(1);
    };

    const hasFilters = search || actionFilter !== 'All Action Types' || instFilter !== 'All Institutions' || roleFilter !== 'All Roles' || fromDate || toDate;

    return (
        <div className="flex flex-col h-full">

            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-20 bg-background pb-3 space-y-3">

                <div className="flex items-center justify-between pt-3 px-1">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ScrollText size={28} />
                            Audit Logs
                        </h1>
                        <p className="text-muted-foreground text-sm">Track all platform and institution activity</p>
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>

                <div className="h-px bg-border/60" />

                <div className="space-y-2.5">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search by email, institution, or details..."
                            className="w-full max-w-lg h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                        />
                        {search && (
                            <button onClick={() => { setSearch(''); setPage(1); }}
                                className="absolute left-[28rem] top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Filters row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <CustomDropdown
                            value={actionFilter}
                            onChange={v => { setActionFilter(v); setPage(1); }}
                            options={ACTION_LIST}
                            getLabel={v => v === 'All Action Types' ? 'All Action Types' : (ACTION_CONFIG[v]?.label ?? v)}
                        />
                        <CustomDropdown
                            value={instFilter}
                            onChange={v => { setInstFilter(v); setPage(1); }}
                            options={INSTITUTIONS_LIST}
                        />
                        <CustomDropdown
                            value={roleFilter}
                            onChange={v => { setRoleFilter(v); setPage(1); }}
                            options={ROLES_LIST}
                        />
                        <DateInput label="From" value={fromDate} onChange={v => { setFromDate(v); setPage(1); }} />
                        <DateInput label="To" value={toDate} onChange={v => { setToDate(v); setPage(1); }} />

                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-1">
                                <X size={11} /> Clear all
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="flex-1 overflow-y-auto pb-6">
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">

                    {/* Table header */}
                    <div className="grid grid-cols-[140px_190px_180px_1fr_170px] gap-4 px-5 py-3 border-b border-border/50 bg-muted/30">
                        {['TIMESTAMP', 'ACTION', 'ACTOR', 'CONTEXT / DETAILS', 'INSTITUTION'].map(h => (
                            <p key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</p>
                        ))}
                    </div>

                    {/* Rows */}
                    {loading ? (
                        <div>
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="grid grid-cols-[140px_190px_180px_1fr_170px] gap-4 px-5 py-4 border-b border-border/40 last:border-none animate-pulse">
                                    {[...Array(5)].map((_, j) => <div key={j} className="h-4 bg-muted rounded" />)}
                                </div>
                            ))}
                        </div>
                    ) : paginated.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <ScrollText size={32} className="text-muted-foreground/30 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">No logs found</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
                        </div>
                    ) : (
                        paginated.map((log, i) => {
                            const { date, time } = formatTime(log.createdAt);
                            const actionCfg = ACTION_CONFIG[log.action] ?? { label: log.action.replace(/_/g, ' '), cls: 'bg-muted text-muted-foreground' };
                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="grid grid-cols-[140px_190px_180px_1fr_170px] gap-4 px-5 py-4 border-b border-border/40 last:border-none hover:bg-muted/20 transition-colors"
                                >
                                    {/* Timestamp */}
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
                                        <p className="text-xs font-medium truncate">{log.user?.email ?? log.userId}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{log.actorRole}</p>
                                    </div>

                                    {/* Context / Details */}
                                    <div>
                                        <p className="text-xs text-foreground leading-relaxed">{log.details}</p>
                                    </div>

                                    {/* Institution */}
                                    <div className="flex items-start">
                                        <p className={`text-xs font-medium ${log.institution === '—' ? 'text-muted-foreground' : 'text-foreground'}`}>
                                            {log.institution}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

                {/* ── Pagination ── */}
                <div className="flex items-center justify-between mt-4 px-1">
                    <p className="text-[11px] text-muted-foreground">
                        Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} logs
                    </p>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <ChevronLeft size={14} />
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                            .reduce<(number | '...')[]>((acc, p, i, arr) => {
                                if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((p, i) =>
                                p === '...' ? (
                                    <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">...</span>
                                ) : (
                                    <button key={p} onClick={() => setPage(p as number)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all
                                            ${page === p ? 'bg-primary text-white' : 'border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                                        {p}
                                    </button>
                                )
                            )
                        }

                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}