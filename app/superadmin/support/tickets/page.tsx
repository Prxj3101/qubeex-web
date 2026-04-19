'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TicketIcon, Search, X, ChevronDown, ChevronUp,
    Send, Clock, CheckCircle2, AlertCircle, Loader2,
    Bug, Sparkles, CreditCard, HelpCircle, Building2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type TicketCategory = 'BUG' | 'FEATURE' | 'BILLING' | 'OTHER';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TicketReply {
    id: string;
    author: string;
    role: 'ADMIN' | 'SUPERADMIN';
    message: string;
    time: string;
}

interface Ticket {
    id: string;
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    institution: string;
    institutionType: 'SCHOOL' | 'COLLEGE' | 'COACHING';
    adminEmail: string;
    createdAt: string;
    updatedAt: string;
    replies: TicketReply[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_TICKETS: Ticket[] = [
    {
        id: 'TKT-001',
        title: 'Test submissions not saving correctly',
        description: 'When students submit tests, the answers are not being saved properly. About 30% of submissions are showing blank after submission. This is affecting our ongoing exams.',
        category: 'BUG', priority: 'URGENT', status: 'IN_PROGRESS',
        institution: 'Delhi Public School', institutionType: 'SCHOOL',
        adminEmail: 'admin@dps.edu.in', createdAt: '2 hours ago', updatedAt: '1 hour ago',
        replies: [
            { id: 'r1', author: 'Rohit Sharma', role: 'ADMIN', message: 'This is very urgent, our exams are ongoing and students are losing their work.', time: '2 hours ago' },
            { id: 'r2', author: 'Super Admin', role: 'SUPERADMIN', message: 'We have identified the issue — it is related to a recent queue update. Working on a hotfix right now. ETA 30 mins.', time: '1 hour ago' },
        ],
    },
    {
        id: 'TKT-002',
        title: 'Request for bulk student import via CSV',
        description: 'We have 800+ students to add for the new academic year. Manually adding them one by one is very time consuming. Can you add a CSV import feature?',
        category: 'FEATURE', priority: 'MEDIUM', status: 'OPEN',
        institution: 'Aakash Coaching', institutionType: 'COACHING',
        adminEmail: 'admin@aakash.ac.in', createdAt: '1 day ago', updatedAt: '1 day ago',
        replies: [],
    },
    {
        id: 'TKT-003',
        title: 'Invoice for March shows incorrect amount',
        description: 'Our March invoice shows ₹12,000 but we are on the Basic plan which should be ₹8,000. Please check and issue a corrected invoice.',
        category: 'BILLING', priority: 'HIGH', status: 'OPEN',
        institution: 'Shree Vidya College', institutionType: 'COLLEGE',
        adminEmail: 'admin@shreevidya.edu', createdAt: '3 days ago', updatedAt: '3 days ago',
        replies: [
            { id: 'r3', author: 'Dinesh Shah', role: 'ADMIN', message: 'We need this resolved before month end for our accounting.', time: '2 days ago' },
        ],
    },
    {
        id: 'TKT-004',
        title: 'Dashboard loading very slow',
        description: 'The admin dashboard takes 8-10 seconds to load. This happens consistently across different browsers and internet connections.',
        category: 'BUG', priority: 'HIGH', status: 'RESOLVED',
        institution: 'Ryan International School', institutionType: 'SCHOOL',
        adminEmail: 'admin@ryan.edu', createdAt: '5 days ago', updatedAt: '2 days ago',
        replies: [
            { id: 'r4', author: 'Meena Pillai', role: 'ADMIN', message: 'This is affecting our daily operations significantly.', time: '5 days ago' },
            { id: 'r5', author: 'Super Admin', role: 'SUPERADMIN', message: 'We have optimized the database queries for your institution size. Please check if it is faster now.', time: '3 days ago' },
            { id: 'r6', author: 'Meena Pillai', role: 'ADMIN', message: 'Yes, it is much faster now! Loading in under 2 seconds. Thank you!', time: '2 days ago' },
        ],
    },
    {
        id: 'TKT-005',
        title: 'Can we get attendance export to Excel?',
        description: 'We need to export attendance reports as Excel files to share with parents. Currently only PDF is available.',
        category: 'FEATURE', priority: 'LOW', status: 'OPEN',
        institution: 'Modern High School', institutionType: 'SCHOOL',
        adminEmail: 'info@modernhs.in', createdAt: '1 week ago', updatedAt: '1 week ago',
        replies: [],
    },
    {
        id: 'TKT-006',
        title: 'Cannot add more than 5 teachers',
        description: 'We are on the Pro plan but the system only allows us to add 5 teachers. We need to add 12 more.',
        category: 'BUG', priority: 'HIGH', status: 'IN_PROGRESS',
        institution: 'Fergusson College', institutionType: 'COLLEGE',
        adminEmail: 'admin@fergusson.edu', createdAt: '4 days ago', updatedAt: '1 day ago',
        replies: [
            { id: 'r7', author: 'Super Admin', role: 'SUPERADMIN', message: 'Found the issue — your plan limit was not correctly synced. Fixing it now.', time: '1 day ago' },
        ],
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<TicketStatus, { label: string; cls: string; icon: React.ElementType; dotCls: string }> = {
    OPEN: { label: 'Open', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400', icon: AlertCircle, dotCls: 'bg-blue-500' },
    IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', icon: Loader2, dotCls: 'bg-amber-500' },
    RESOLVED: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', icon: CheckCircle2, dotCls: 'bg-emerald-500' },
    CLOSED: { label: 'Closed', cls: 'bg-muted text-muted-foreground', icon: X, dotCls: 'bg-muted-foreground' },
};

const CATEGORY_CFG: Record<TicketCategory, { label: string; cls: string; icon: React.ElementType }> = {
    BUG: { label: 'Bug', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', icon: Bug },
    FEATURE: { label: 'Feature Request', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400', icon: Sparkles },
    BILLING: { label: 'Billing', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', icon: CreditCard },
    OTHER: { label: 'Other', cls: 'bg-muted text-muted-foreground', icon: HelpCircle },
};

const PRIORITY_CFG: Record<TicketPriority, { label: string; cls: string }> = {
    LOW: { label: 'Low', cls: 'text-muted-foreground border-border' },
    MEDIUM: { label: 'Medium', cls: 'text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-800' },
    HIGH: { label: 'High', cls: 'text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-800' },
    URGENT: { label: 'Urgent', cls: 'text-red-600 border-red-300 dark:text-red-400 dark:border-red-800' },
};

const INST_TYPE_COLORS: Record<string, string> = {
    SCHOOL: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    COLLEGE: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    COACHING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

const STATUS_FILTERS = [
    { label: 'All', value: 'ALL' },
    { label: 'Open', value: 'OPEN' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Resolved', value: 'RESOLVED' },
];

const CATEGORY_FILTERS = [
    { label: 'Bug', value: 'BUG', cls: 'text-red-600 border-red-300 bg-red-50 dark:bg-red-950/50 dark:border-red-800 dark:text-red-400' },
    { label: 'Feature', value: 'FEATURE', cls: 'text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-950/50 dark:border-violet-800 dark:text-violet-400' },
    { label: 'Billing', value: 'BILLING', cls: 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-400' },
];

// ─── Ticket Card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, index }: { ticket: Ticket; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const [reply, setReply] = useState('');
    const [status, setStatus] = useState<TicketStatus>(ticket.status);
    const [replies, setReplies] = useState<TicketReply[]>(ticket.replies);
    const [sending, setSending] = useState(false);

    const statusCfg = STATUS_CFG[status];
    const categoryCfg = CATEGORY_CFG[ticket.category];
    const priorityCfg = PRIORITY_CFG[ticket.priority];
    const CatIcon = categoryCfg.icon;
    const StatusIcon = statusCfg.icon;

    const handleSendReply = () => {
        if (!reply.trim()) return;
        setSending(true);
        setTimeout(() => {
            setReplies(prev => [...prev, {
                id: `r-${Date.now()}`,
                author: 'Super Admin',
                role: 'SUPERADMIN',
                message: reply.trim(),
                time: 'Just now',
            }]);
            setReply('');
            setSending(false);
        }, 600);
    };

    const handleStatusChange = (newStatus: TicketStatus) => {
        setStatus(newStatus);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all duration-200 overflow-hidden"
        >
            {/* Card Header */}
            <button
                className="w-full text-left p-4 flex items-start gap-3"
                onClick={() => setExpanded(e => !e)}
            >
                {/* Category icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${categoryCfg.cls}`}>
                    <CatIcon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                    {/* Title + ID */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold leading-snug truncate pr-1">{ticket.title}</p>
                        <span className="text-[11px] text-muted-foreground font-mono shrink-0">{ticket.id}</span>
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Category */}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${categoryCfg.cls}`}>
                            {categoryCfg.label}
                        </span>
                        {/* Priority */}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priorityCfg.cls}`}>
                            {priorityCfg.label}
                        </span>
                        {/* Status */}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statusCfg.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotCls}`} />
                            {statusCfg.label}
                        </span>
                    </div>

                    {/* Institution + time */}
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5">
                            <Building2 size={11} className="text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{ticket.institution}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INST_TYPE_COLORS[ticket.institutionType]}`}>
                                {ticket.institutionType}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock size={10} className="text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{ticket.createdAt}</span>
                        </div>
                        {replies.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span>
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
                                    {replies.map((r) => (
                                        <div key={r.id} className={`flex gap-2.5 ${r.role === 'SUPERADMIN' ? 'flex-row-reverse' : ''}`}>
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${r.role === 'SUPERADMIN'
                                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                                                    : 'bg-muted text-muted-foreground'
                                                }`}>
                                                {r.author.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                            </div>
                                            <div className={`flex-1 ${r.role === 'SUPERADMIN' ? 'items-end' : 'items-start'} flex flex-col`}>
                                                <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] ${r.role === 'SUPERADMIN'
                                                        ? 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100'
                                                        : 'bg-muted text-foreground'
                                                    }`}>
                                                    {r.message}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-1 px-1">
                                                    {r.author} · {r.time}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reply input */}
                            <div className="space-y-2">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Reply</p>
                                <div className="flex gap-2">
                                    <textarea
                                        value={reply}
                                        onChange={e => setReply(e.target.value)}
                                        placeholder="Type your reply..."
                                        rows={2}
                                        className="flex-1 px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none"
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        disabled={!reply.trim() || sending}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold self-end disabled:opacity-50 transition-all hover:opacity-90"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                    >
                                        {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                        Send
                                    </button>
                                </div>
                            </div>

                            {/* Status update */}
                            <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                                <p className="text-[11px] font-semibold text-muted-foreground">Update Status:</p>
                                <div className="flex gap-1.5 flex-wrap">
                                    {(Object.keys(STATUS_CFG) as TicketStatus[]).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => handleStatusChange(s)}
                                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${status === s
                                                    ? STATUS_CFG[s].cls + ' ring-2 ring-offset-1 ring-primary/30'
                                                    : 'border-border/50 text-muted-foreground hover:text-foreground'
                                                }`}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TicketsPage() {
    const [search, setSearch] = useState('');
    const [activeStatus, setActiveStatus] = useState('ALL');
    const [activeCategories, setActiveCategories] = useState<string[]>([]);

    const toggleCategory = (val: string) =>
        setActiveCategories(prev => prev.includes(val) ? prev.filter(f => f !== val) : [...prev, val]);

    const filtered = useMemo(() => {
        let list = MOCK_TICKETS;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                t.title.toLowerCase().includes(q) ||
                t.institution.toLowerCase().includes(q) ||
                t.id.toLowerCase().includes(q) ||
                t.adminEmail.toLowerCase().includes(q)
            );
        }
        if (activeStatus !== 'ALL') list = list.filter(t => t.status === activeStatus);
        if (activeCategories.length > 0) list = list.filter(t => activeCategories.includes(t.category));
        return list;
    }, [search, activeStatus, activeCategories]);

    const openCount = MOCK_TICKETS.filter(t => t.status === 'OPEN').length;
    const inProgressCount = MOCK_TICKETS.filter(t => t.status === 'IN_PROGRESS').length;

    return (
        <div className="space-y-4 pt-3">

            {/* ── Page Header ── */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <TicketIcon size={26} />
                        Support Tickets
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        {openCount} open · {inProgressCount} in progress · {MOCK_TICKETS.length} total
                    </p>
                </div>
            </div>

            {/* ── Search + Filters ── */}
            <div className="space-y-2 px-1">
                {/* Search */}
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by title, institution, email or ticket ID..."
                        className="w-full max-w-xl h-9 pl-9 pr-8 rounded-4xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X size={13} />
                        </button>
                    )}
                </div>

                {/* Status + Category filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground font-medium">Status:</span>
                    {STATUS_FILTERS.map(f => (
                        <button key={f.value} onClick={() => setActiveStatus(f.value)}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${activeStatus === f.value
                                    ? 'bg-primary text-white border-primary'
                                    : 'border-border/50 text-muted-foreground hover:text-foreground'
                                }`}>
                            {f.label}
                        </button>
                    ))}
                    <span className="text-[11px] text-muted-foreground font-medium ml-2">Category:</span>
                    {CATEGORY_FILTERS.map(f => (
                        <button key={f.value} onClick={() => toggleCategory(f.value)}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${activeCategories.includes(f.value) ? f.cls : 'border-border/50 text-muted-foreground hover:text-foreground'
                                }`}>
                            {f.label}
                        </button>
                    ))}
                    {(activeCategories.length > 0) && (
                        <button onClick={() => setActiveCategories([])}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-1">
                            <X size={11} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tickets Grid ── */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        <TicketIcon size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No tickets found</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filtered.map((ticket, i) => (
                        <TicketCard key={ticket.id} ticket={ticket} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
}