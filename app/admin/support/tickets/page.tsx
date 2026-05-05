'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TicketIcon, Plus, X, ChevronDown, ChevronUp,
    Send, Clock, CheckCircle2, AlertCircle, Loader2,
    Bug, Sparkles, CreditCard, HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type TicketCategory = 'BUG' | 'FEATURE' | 'BILLING' | 'OTHER';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TicketReply {
    id: string;
    author: string;
    role: 'ADMIN' | 'SUPPORT';
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
    createdAt: string;
    updatedAt: string;
    replies: TicketReply[];
}

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_TICKETS: Ticket[] = [
    {
        id: 'TKT-001',
        title: 'Test submissions not saving',
        description: 'Students are facing issues submitting tests. The submit button is unresponsive sometimes. This is affecting our ongoing exams.',
        category: 'BUG', priority: 'URGENT', status: 'IN_PROGRESS',
        createdAt: '2 hrs ago', updatedAt: '30 min ago',
        replies: [
            { id: 'r1', author: 'Admin', role: 'ADMIN', message: 'Students are losing their work. This is very urgent.', time: '2 hrs ago' },
            { id: 'r2', author: 'QubeEx Support', role: 'SUPPORT', message: 'We have identified the issue. Working on a hotfix. ETA 30 mins.', time: '1 hr ago' },
        ],
    },
    {
        id: 'TKT-002',
        title: 'Request for CSV bulk import feature',
        description: 'We have 500+ students to add. Manually adding them one by one is very time consuming. Can you add a CSV import feature?',
        category: 'FEATURE', priority: 'MEDIUM', status: 'OPEN',
        createdAt: '1 day ago', updatedAt: '1 day ago',
        replies: [],
    },
    {
        id: 'TKT-003',
        title: 'March invoice incorrect amount',
        description: 'The March invoice shows ₹45,000 but our plan is ₹40,000. Please check and correct.',
        category: 'BILLING', priority: 'HIGH', status: 'RESOLVED',
        createdAt: '3 days ago', updatedAt: '1 day ago',
        replies: [
            { id: 'r3', author: 'Admin', role: 'ADMIN', message: 'We need this resolved before month end.', time: '3 days ago' },
            { id: 'r4', author: 'QubeEx Support', role: 'SUPPORT', message: 'Corrected invoice has been sent to your email.', time: '2 days ago' },
        ],
    },
];

// ── Config ────────────────────────────────────────────────────────────────────
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

// ── Create Ticket Modal ───────────────────────────────────────────────────────
function CreateTicketModal({ open, onClose, onCreate }: {
    open: boolean; onClose: () => void; onCreate: (t: Ticket) => void;
}) {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<TicketCategory>('BUG');
    const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
    const [description, setDescription] = useState('');

    const handleCreate = () => {
        if (!title.trim() || !description.trim()) return;
        onCreate({
            id: `TKT-${Date.now()}`,
            title: title.trim(), description: description.trim(),
            category, priority, status: 'OPEN',
            createdAt: 'Just now', updatedAt: 'Just now',
            replies: [],
        });
        setTitle(''); setCategory('BUG'); setPriority('MEDIUM'); setDescription('');
        onClose();
        toast.success('Ticket raised successfully!');
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border rounded-2xl overflow-hidden max-w-lg w-full mx-4 shadow-2xl">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/50">
                    <h3 className="text-base font-bold flex items-center gap-2"><TicketIcon size={16} /> Raise a Ticket</h3>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"><X size={14} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Brief description of the issue..."
                            className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Category</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {(Object.keys(CATEGORY_CFG) as TicketCategory[]).map(cat => {
                                    const Icon = CATEGORY_CFG[cat].icon;
                                    return (
                                        <button key={cat} onClick={() => setCategory(cat)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${category === cat ? CATEGORY_CFG[cat].cls + ' border-current' : 'border-border/50 text-muted-foreground hover:border-border'
                                                }`}>
                                            <Icon size={12} /> {CATEGORY_CFG[cat].label.split(' ')[0]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Priority</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {(Object.keys(PRIORITY_CFG) as TicketPriority[]).map(pri => (
                                    <button key={pri} onClick={() => setPriority(pri)}
                                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${priority === pri ? PRIORITY_CFG[pri].cls + ' bg-muted/50' : 'border-border/50 text-muted-foreground hover:border-border'
                                            }`}>
                                        {PRIORITY_CFG[pri].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="Describe the issue in detail..." rows={4}
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none transition-all" />
                    </div>
                </div>
                <div className="flex items-center justify-between px-5 py-4 border-t border-border/50 bg-muted/20">
                    <button onClick={onClose} className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">Cancel</button>
                    <button onClick={handleCreate} disabled={!title.trim() || !description.trim()}
                        className="h-9 px-5 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        Submit Ticket
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// ── Ticket Card ───────────────────────────────────────────────────────────────
function TicketCard({ ticket, index }: { ticket: Ticket; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const [replyInput, setReplyInput] = useState('');
    const [replies, setReplies] = useState<TicketReply[]>(ticket.replies);
    const [sending, setSending] = useState(false);

    const statusCfg = STATUS_CFG[ticket.status];
    const categoryCfg = CATEGORY_CFG[ticket.category];
    const priorityCfg = PRIORITY_CFG[ticket.priority];
    const CatIcon = categoryCfg.icon;

    const handleReply = () => {
        if (!replyInput.trim()) return;
        setSending(true);
        setTimeout(() => {
            setReplies(prev => [...prev, {
                id: `r-${Date.now()}`,
                author: 'Admin', role: 'ADMIN',
                message: replyInput.trim(),
                time: 'Just now',
            }]);
            setReplyInput('');
            setSending(false);
            toast.success('Message sent!');
        }, 500);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all duration-200 overflow-hidden">

            {/* Header */}
            <button className="w-full text-left p-4 flex items-start gap-3"
                onClick={() => setExpanded(e => !e)}>

                {/* Category icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${categoryCfg.cls}`}>
                    <CatIcon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold leading-snug truncate pr-1">{ticket.title}</p>
                        <span className="text-[11px] text-muted-foreground font-mono shrink-0">{ticket.id}</span>
                    </div>

                    {/* Badges */}
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

                    <div className="flex items-center gap-3 mt-2">
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

            {/* Expanded */}
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="border-t border-border/40 px-4 py-4 space-y-4">

                            {/* Description */}
                            <div className="p-3 bg-muted/30 rounded-xl">
                                <p className="text-[11px] font-semibold text-muted-foreground mb-1">Description</p>
                                <p className="text-sm text-foreground leading-relaxed">{ticket.description}</p>
                            </div>

                            {/* Thread */}
                            {replies.length > 0 && (
                                <div className="space-y-2.5">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Thread</p>
                                    {replies.map(r => {
                                        const isAdmin = r.role === 'ADMIN';
                                        return (
                                            <div key={r.id} className={`flex gap-2.5 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white`}
                                                    style={{ background: isAdmin ? '#7C3AED' : '#DA7756' }}>
                                                    {isAdmin ? 'AD' : 'QX'}
                                                </div>
                                                <div className={`flex-1 flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                                                    <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] ${isAdmin
                                                        ? 'text-white rounded-tr-sm'
                                                        : 'bg-muted text-foreground rounded-tl-sm'
                                                        }`} style={isAdmin ? { background: '#7C3AED' } : {}}>
                                                        {r.message}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-1 px-1">{r.author} · {r.time}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Reply input — always visible */}
                            <div className="space-y-2">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Reply</p>
                                <div className="flex gap-2">
                                    <textarea value={replyInput} onChange={e => setReplyInput(e.target.value)}
                                        placeholder="Add a message..."
                                        rows={2}
                                        className="flex-1 px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none" />
                                    <button onClick={handleReply} disabled={!replyInput.trim() || sending}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold self-end disabled:opacity-50 transition-all hover:opacity-90"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminTicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>(MOCK_TICKETS);
    const [showCreate, setShowCreate] = useState(false);
    const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>('ALL');

    const filtered = statusFilter === 'ALL'
        ? tickets
        : tickets.filter(t => t.status === statusFilter);

    return (
        <div className="space-y-4 pt-3">

            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 flex-wrap">
                    {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${statusFilter === s ? 'bg-primary text-white border-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'
                                }`}>
                            {s === 'ALL' ? 'All' : s === 'IN_PROGRESS' ? 'In Progress' : s.charAt(0) + s.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1 h-8 px-3 rounded-xl text-[13px] font-semibold text-white hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                    <Plus size={15} /> Raise Ticket
                </button>
            </div>

            {/* Tickets */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        <TicketIcon size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No tickets found</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Raise a ticket if you need help</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {filtered.map((ticket, i) => (
                        <TicketCard key={ticket.id} ticket={ticket} index={i} />
                    ))}
                </div>
            )}

            <CreateTicketModal open={showCreate} onClose={() => setShowCreate(false)}
                onCreate={t => setTickets(prev => [t, ...prev])} />
        </div>
    );
}