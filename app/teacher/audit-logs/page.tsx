'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
    ScrollText, Search, X, ChevronLeft, ChevronRight,
    ChevronDown, Check, Shield, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
type LogEntry = {
    id: string;
    action: string;
    category: 'ACTIVITY' | 'SECURITY';
    severity: string;
    details: string;
    ip: string;
    createdAt: string;
};

type Tab = 'ACTIVITY' | 'SECURITY';

// ─── Action Config ────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
    // Students
    STUDENT_ADDED: { label: 'Student Added', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400', dot: 'bg-violet-500' },
    STUDENT_UPDATED: { label: 'Student Updated', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400', dot: 'bg-blue-500' },
    STUDENT_DEACTIVATED: { label: 'Student Deactivated', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    STUDENT_ACTIVATED: { label: 'Student Activated', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500' },
    // Posts
    POST_CREATED: { label: 'Post Created', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500' },
    POST_DELETED: { label: 'Post Deleted', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    // Attendance
    ATTENDANCE_MARKED: { label: 'Attendance Marked', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400', dot: 'bg-sky-500' },
    // Timetable
    TIMETABLE_UPLOADED: { label: 'Timetable Uploaded', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', dot: 'bg-amber-500' },
    // Results
    RESULT_UPLOADED: { label: 'Result Uploaded', cls: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400', dot: 'bg-pink-500' },
    // Calendar
    CALENDAR_EVENT_ADDED: { label: 'Calendar Event Added', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400', dot: 'bg-indigo-500' },
    CALENDAR_EVENT_DELETED: { label: 'Calendar Event Deleted', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400', dot: 'bg-orange-500' },
    // Security
    LOGIN_SUCCESS: { label: 'Login', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
    LOGIN_FAILED: { label: 'Login Failed', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400', dot: 'bg-rose-500' },
    PASSWORD_CHANGED: { label: 'Password Changed', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', dot: 'bg-amber-500' },
};

const SECURITY_ACTIONS = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'PASSWORD_CHANGED'];
const ACTIVITY_ACTIONS = Object.keys(ACTION_CONFIG).filter(k => !SECURITY_ACTIONS.includes(k));

const PAGE_SIZE = 15;

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_LOGS: LogEntry[] = [
    { id: '1', action: 'LOGIN_SUCCESS', category: 'SECURITY', severity: 'INFO', details: 'Teacher logged in successfully', ip: '192.168.1.1', createdAt: '2026-05-29T08:30:00Z' },
    { id: '2', action: 'POST_CREATED', category: 'ACTIVITY', severity: 'INFO', details: 'Posted announcement: PTM this Saturday', ip: '192.168.1.1', createdAt: '2026-05-29T09:15:00Z' },
    { id: '3', action: 'STUDENT_ADDED', category: 'ACTIVITY', severity: 'INFO', details: 'Added student Aarav Mehta to Class 10-A', ip: '192.168.1.1', createdAt: '2026-05-29T10:00:00Z' },
    { id: '4', action: 'ATTENDANCE_MARKED', category: 'ACTIVITY', severity: 'INFO', details: 'Marked attendance for Class 10-A (42 students)', ip: '192.168.1.2', createdAt: '2026-05-28T08:45:00Z' },
    { id: '5', action: 'TIMETABLE_UPLOADED', category: 'ACTIVITY', severity: 'INFO', details: 'Uploaded timetable for Class 10-A', ip: '192.168.1.2', createdAt: '2026-05-28T11:20:00Z' },
    { id: '6', action: 'RESULT_UPLOADED', category: 'ACTIVITY', severity: 'INFO', details: 'Uploaded Unit Test 1 results for Class 10-A', ip: '192.168.1.1', createdAt: '2026-05-27T14:30:00Z' },
    { id: '7', action: 'CALENDAR_EVENT_ADDED', category: 'ACTIVITY', severity: 'INFO', details: 'Added event: Unit Test 3 on 20 May', ip: '192.168.1.1', createdAt: '2026-05-27T10:00:00Z' },
    { id: '8', action: 'STUDENT_UPDATED', category: 'ACTIVITY', severity: 'INFO', details: 'Updated details for Priya Singh', ip: '192.168.1.3', createdAt: '2026-05-26T09:00:00Z' },
    { id: '9', action: 'POST_DELETED', category: 'ACTIVITY', severity: 'INFO', details: 'Deleted post: Old notice', ip: '192.168.1.1', createdAt: '2026-05-26T11:00:00Z' },
    { id: '10', action: 'STUDENT_DEACTIVATED', category: 'ACTIVITY', severity: 'WARNING', details: 'Deactivated student Karan Joshi', ip: '192.168.1.2', createdAt: '2026-05-25T14:00:00Z' },
    { id: '11', action: 'LOGIN_FAILED', category: 'SECURITY', severity: 'CRITICAL', details: 'Failed login attempt', ip: '203.0.113.10', createdAt: '2026-05-25T07:30:00Z' },
    { id: '12', action: 'CALENDAR_EVENT_DELETED', category: 'ACTIVITY', severity: 'INFO', details: 'Removed event: Sports Day', ip: '192.168.1.1', createdAt: '2026-05-24T16:00:00Z' },
    { id: '13', action: 'PASSWORD_CHANGED', category: 'SECURITY', severity: 'WARNING', details: 'Teacher changed account password', ip: '192.168.1.1', createdAt: '2026-05-24T12:00:00Z' },
    { id: '14', action: 'ATTENDANCE_MARKED', category: 'ACTIVITY', severity: 'INFO', details: 'Marked attendance for Class 9-B (38 students)', ip: '192.168.1.2', createdAt: '2026-05-23T08:50:00Z' },
    { id: '15', action: 'POST_CREATED', category: 'ACTIVITY', severity: 'INFO', details: 'Posted material: Chapter 5 Notes', ip: '192.168.1.1', createdAt: '2026-05-23T10:30:00Z' },
    { id: '16', action: 'STUDENT_ADDED', category: 'ACTIVITY', severity: 'INFO', details: 'Added student Meera Sharma to Class 10-A', ip: '192.168.1.1', createdAt: '2026-05-22T09:00:00Z' },
    { id: '17', action: 'RESULT_UPLOADED', category: 'ACTIVITY', severity: 'INFO', details: 'Uploaded Mid Term results for Class 9-B', ip: '192.168.1.2', createdAt: '2026-05-22T15:00:00Z' },
    { id: '18', action: 'LOGIN_SUCCESS', category: 'SECURITY', severity: 'INFO', details: 'Teacher logged in successfully', ip: '192.168.1.1', createdAt: '2026-05-21T08:00:00Z' },
    { id: '19', action: 'CALENDAR_EVENT_ADDED', category: 'ACTIVITY', severity: 'INFO', details: 'Added event: Parent Teacher Meeting', ip: '192.168.1.1', createdAt: '2026-05-21T11:00:00Z' },
    { id: '20', action: 'STUDENT_ACTIVATED', category: 'ACTIVITY', severity: 'INFO', details: 'Activated student Ishaan Verma', ip: '192.168.1.1', createdAt: '2026-05-20T14:00:00Z' },
    { id: '21', action: 'LOGIN_FAILED', category: 'SECURITY', severity: 'CRITICAL', details: 'Multiple failed login attempts from unknown IP', ip: '198.51.100.5', createdAt: '2026-05-20T02:15:00Z' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toIST(iso: string) {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }),
    };
}

function SeverityDot({ severity }: { severity: string }) {
    if (severity === 'CRITICAL') return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 ring-2 ring-red-200 dark:ring-red-900" />;
    if (severity === 'WARNING') return <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />;
    return null;
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
                className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm text-foreground hover:bg-muted/60 transition-all whitespace-nowrap min-w-[160px] justify-between">
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
                                    ${opt === value ? 'bg-primary/5 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}>
                                <span className="flex items-center gap-2">
                                    {ACTION_CONFIG[opt] && (
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeacherAuditLogsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('ACTIVITY');
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('All Action Types');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(1);

    // Reset action filter on tab change
    useEffect(() => {
        setActionFilter('All Action Types');
        setPage(1);
    }, [activeTab]);

    const actionList = activeTab === 'ACTIVITY'
        ? ['All Action Types', ...ACTIVITY_ACTIONS]
        : ['All Action Types', ...SECURITY_ACTIONS];

    const filtered = useMemo(() => {
        return MOCK_LOGS.filter(l => {
            const matchTab = l.category === activeTab;
            const matchSearch = !search.trim() ||
                l.action.toLowerCase().includes(search.toLowerCase()) ||
                l.details.toLowerCase().includes(search.toLowerCase());
            const matchAction = actionFilter === 'All Action Types' || l.action === actionFilter;
            const matchFrom = !fromDate || new Date(l.createdAt) >= new Date(fromDate);
            const matchTo = !toDate || new Date(l.createdAt) <= new Date(toDate + 'T23:59:59');
            return matchTab && matchSearch && matchAction && matchFrom && matchTo;
        });
    }, [activeTab, search, actionFilter, fromDate, toDate]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const hasFilters = search || actionFilter !== 'All Action Types' || fromDate || toDate;

    const clearFilters = () => {
        setSearch(''); setActionFilter('All Action Types');
        setFromDate(''); setToDate(''); setPage(1);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* Header */}
            <div className="sticky top-0 z-20 bg-background pb-2 pt-0 space-y-2">
                <div className="flex items-center justify-between px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <ScrollText size={21} /> Audit Logs
                        </h1>
                        <p className="text-[13px] text-muted-foreground">
                            {filtered.length} events · All times in IST
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-border/60">
                    {([
                        { key: 'ACTIVITY' as Tab, label: 'Activity', icon: Activity },
                        { key: 'SECURITY' as Tab, label: 'Security', icon: Shield },
                    ]).map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${activeTab === key
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}>
                            <Icon size={14} /> {label}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search logs..."
                            className="w-64 h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all" />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <CustomDropdown value={actionFilter} onChange={v => { setActionFilter(v); setPage(1); }}
                        options={actionList}
                        getLabel={v => v === 'All Action Types' ? 'All Action Types' : (ACTION_CONFIG[v]?.label ?? v)} />
                    <DateInput label="From" value={fromDate} onChange={v => { setFromDate(v); setPage(1); }} />
                    <DateInput label="To" value={toDate} onChange={v => { setToDate(v); setPage(1); }} />
                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                            <X size={11} /> Clear all
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 flex flex-col min-h-0 pb-6">
                <div className="bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col">
                    <div className="grid grid-cols-[140px_200px_1fr_120px] gap-4 px-5 py-3 border-b border-border/50 bg-muted/30">
                        {['TIMESTAMP (IST)', 'ACTION', 'DETAILS', 'IP'].map(h => (
                            <p key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</p>
                        ))}
                    </div>

                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
                        {paginated.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <ScrollText size={32} className="text-muted-foreground/30 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    {hasFilters ? 'No logs match your filters' : 'No logs yet'}
                                </p>
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                    {hasFilters ? 'Try adjusting your search or filters' : 'Actions will appear here'}
                                </p>
                            </div>
                        ) : paginated.map((log, i) => {
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
                                    className="grid grid-cols-[140px_200px_1fr_120px] gap-4 px-5 py-4 border-b border-border/40 last:border-none hover:bg-muted/20 transition-colors">

                                    {/* Timestamp */}
                                    <div className="flex items-start gap-2">
                                        <SeverityDot severity={log.severity} />
                                        <div>
                                            <p className="text-xs font-medium">{date}</p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">{time}</p>
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <div className="flex items-start pt-0.5">
                                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${actionCfg.cls}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${actionCfg.dot}`} />
                                            {actionCfg.label}
                                        </span>
                                    </div>

                                    {/* Details */}
                                    <div>
                                        <p className="text-xs text-foreground leading-relaxed">{log.details}</p>
                                    </div>

                                    {/* IP */}
                                    <div>
                                        <p className="text-[11px] font-mono text-muted-foreground">{log.ip}</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 px-1">
                    <p className="text-[11px] text-muted-foreground">
                        Page {page} of {totalPages} · {filtered.length} total logs
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
                            .map((p, i) => p === '...' ? (
                                <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">...</span>
                            ) : (
                                <button key={p} onClick={() => setPage(p as number)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${page === p ? 'bg-primary text-white' : 'border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                                    {p}
                                </button>
                            ))}
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