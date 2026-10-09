'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TicketIcon, Plus, X, ChevronDown, ChevronUp,
    Send, Clock, CheckCircle2, AlertCircle, Loader2,
    Bug, Sparkles, CreditCard, HelpCircle, Paperclip, Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import SupportHeader from '../SupportHeader';
import { AttachmentPreview } from '@/components/shared/AttachmentPreview';
import { PendingAttachmentChip } from '@/components/shared/PendingAttachmentChip';

// ── Types ─────────────────────────────────────────────────────────────────────
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type TicketCategory = 'BUG' | 'FEATURE' | 'BILLING' | 'ADDON' | 'SUGGESTION' | 'OTHER';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TicketAttachment {
    url: string;
    name: string;
    type: 'image' | 'video' | 'file';
    size: number;
}

interface TicketReply {
    id: string;
    author: string;
    role: 'ADMIN' | 'SUPPORT';
    message: string;
    createdAt: string;
    attachments?: TicketAttachment[] | null;
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
    attachments?: TicketAttachment[] | null;
    adminAvatarUrl?: string | null;
}

// ── Attachment upload helper ──────────────────────────────────────────────────
async function uploadTicketFile(file: File): Promise<TicketAttachment> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post('/admin/support/tickets/attachments', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
}

// ── Config ────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<TicketStatus, { label: string; cls: string; icon: React.ElementType; dotCls: string }> = {
    OPEN:        { label: 'Open',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',       icon: AlertCircle,   dotCls: 'bg-blue-500' },
    IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',   icon: Loader2,       dotCls: 'bg-amber-500' },
    RESOLVED:    { label: 'Resolved',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', icon: CheckCircle2, dotCls: 'bg-emerald-500' },
    CLOSED:      { label: 'Closed',      cls: 'bg-muted text-muted-foreground',                                       icon: X,             dotCls: 'bg-muted-foreground' },
};

const CATEGORY_CFG: Record<TicketCategory, { label: string; cls: string; icon: React.ElementType }> = {
    BUG:        { label: 'Bug',             cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',             icon: Bug },
    FEATURE:    { label: 'Feature Request', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400', icon: Sparkles },
    BILLING:    { label: 'Billing',         cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',     icon: CreditCard },
    ADDON:      { label: 'Add-On',          cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',             icon: Plus },
    SUGGESTION: { label: 'Suggestion',      cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',     icon: Lightbulb },
    OTHER:      { label: 'Other',           cls: 'bg-muted text-muted-foreground',                                         icon: HelpCircle },
};

const PRIORITY_CFG: Record<TicketPriority, { label: string; cls: string }> = {
    LOW:    { label: 'Low',    cls: 'text-muted-foreground border-border' },
    MEDIUM: { label: 'Medium', cls: 'text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-800' },
    HIGH:   { label: 'High',   cls: 'text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-800' },
    URGENT: { label: 'Urgent', cls: 'text-red-600 border-red-300 dark:text-red-400 dark:border-red-800' },
};

function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// ── Create Ticket Modal ───────────────────────────────────────────────────────
function CreateTicketModal({ open, onClose, onCreate }: {
    open: boolean; onClose: () => void; onCreate: (t: Ticket) => void;
}) {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<TicketCategory>('BUG');
    const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
    const [description, setDescription] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCreate = async () => {
        if (!title.trim() || !description.trim()) return;
        setSaving(true);
        try {
            const uploaded = attachments.length > 0
                ? await Promise.all(attachments.map(uploadTicketFile))
                : [];
            const res = await api.post('/admin/support/tickets', {
                title: title.trim(),
                description: description.trim(),
                category,
                priority,
                attachments: uploaded,
            });
            onCreate(res.data.data);
            setTitle(''); setCategory('BUG'); setPriority('MEDIUM'); setDescription(''); setAttachments([]);
            onClose();
            toast.success('Ticket raised successfully!');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to create ticket');
        } finally {
            setSaving(false);
        }
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Category</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {(Object.keys(CATEGORY_CFG) as TicketCategory[]).map(cat => {
                                    const Icon = CATEGORY_CFG[cat].icon;
                                    return (
                                        <button key={cat} onClick={() => setCategory(cat)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${category === cat ? CATEGORY_CFG[cat].cls + ' border-current' : 'border-border/50 text-muted-foreground hover:border-border'}`}>
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
                                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${priority === pri ? PRIORITY_CFG[pri].cls + ' bg-muted/50' : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                                        {PRIORITY_CFG[pri].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Description</label>
                        <div className="relative">
                            <textarea value={description} onChange={e => setDescription(e.target.value)}
                                placeholder="Describe the issue in detail..." rows={4}
                                className="w-full px-3 py-2.5 pr-10 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none transition-all" />
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-2.5 right-2.5 w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                title="Add attachment">
                                <Paperclip size={13} />
                            </button>
                            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                className="hidden"
                                onChange={e => {
                                    const files = Array.from(e.target.files ?? []);
                                    setAttachments(prev => [...prev, ...files].slice(0, 5));
                                    e.target.value = '';
                                }} />
                        </div>
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {attachments.map((f, i) => (
                                    <PendingAttachmentChip key={i} file={f} onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-between px-5 py-4 border-t border-border/50 bg-muted/20">
                    <button onClick={onClose} className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">Cancel</button>
                    <button onClick={handleCreate} disabled={!title.trim() || !description.trim() || saving}
                        className="h-9 px-5 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        {saving ? (attachments.length > 0 ? 'Uploading...' : 'Submitting...') : 'Submit Ticket'}
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
    const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
    const [replies, setReplies] = useState<TicketReply[]>(ticket.replies);
    const [sending, setSending] = useState(false);
    const replyFileInputRef = useRef<HTMLInputElement>(null);

    const statusCfg = STATUS_CFG[ticket.status];
    const categoryCfg = CATEGORY_CFG[ticket.category];
    const priorityCfg = PRIORITY_CFG[ticket.priority];
    const CatIcon = categoryCfg.icon;

    const handleReply = async () => {
        if (!replyInput.trim()) return;
        setSending(true);
        try {
            const uploaded = replyAttachments.length > 0
                ? await Promise.all(replyAttachments.map(uploadTicketFile))
                : [];
            const res = await api.post(`/admin/support/tickets/${ticket.id}/replies`, {
                message: replyInput.trim(),
                attachments: uploaded,
            });
            setReplies(prev => [...prev, res.data.data]);
            setReplyInput('');
            setReplyAttachments([]);
            toast.success('Message sent!');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all duration-200 overflow-hidden">

            <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setExpanded(e => !e)}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${categoryCfg.cls}`}>
                    <CatIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold leading-snug truncate pr-1">{ticket.title}</p>
                        <span className="text-[11px] text-muted-foreground font-mono shrink-0">#{ticket.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${categoryCfg.cls}`}>{categoryCfg.label}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priorityCfg.cls}`}>{priorityCfg.label}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statusCfg.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotCls}`} />
                            {statusCfg.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                            <Clock size={10} className="text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{formatRelative(ticket.createdAt)}</span>
                        </div>
                        {replies.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span>
                        )}
                    </div>
                </div>
                {expanded ? <ChevronUp size={15} className="text-muted-foreground mt-1 shrink-0" /> : <ChevronDown size={15} className="text-muted-foreground mt-1 shrink-0" />}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="border-t border-border/40 px-4 pt-0 pb-1 flex flex-col gap-2">
                            <div
                                className="max-h-[285px] overflow-y-auto space-y-4 pr-1 pt-1 pb-3 border-b border-border/40"
                                style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}
                            >
                                <div className="p-3 bg-muted/30 rounded-xl">
                                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">Description</p>
                                    <p className="text-sm text-foreground leading-relaxed">{ticket.description}</p>
                                    {ticket.attachments && ticket.attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2.5">
                                            {ticket.attachments.map((a, i) => (
                                                <AttachmentPreview key={i} attachment={a} compact />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {replies.length > 0 && (
                                    <div className="space-y-2.5">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Thread</p>
                                        {replies.map(r => {
                                            const isAdmin = r.role === 'ADMIN';
                                            return (
                                                <div key={r.id} className={`flex gap-2.5 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                                                    {isAdmin ? (
                                                        ticket.adminAvatarUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={ticket.adminAvatarUrl} alt={r.author}
                                                                className="w-7 h-7 rounded-full object-cover shrink-0" />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white"
                                                                style={{ background: '#7C3AED' }}>AD</div>
                                                        )
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: '#1A112E' }}>
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src="/QubeEx_darkmode_DA7756.png" alt="QubeEx"
                                                                className="w-5 h-5 object-contain" />
                                                        </div>
                                                    )}
                                                    <div className={`flex-1 flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                                                        <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] ${isAdmin ? 'text-white rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}
                                                            style={isAdmin ? { background: '#7C3AED' } : {}}>
                                                            {r.message}
                                                        </div>
                                                        {r.attachments && r.attachments.length > 0 && (
                                                            <div className={`flex flex-wrap gap-1.5 mt-1.5 max-w-[85%] ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                                                {r.attachments.map((a, i) => (
                                                                    <AttachmentPreview key={i} attachment={a} compact />
                                                                ))}
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] text-muted-foreground mt-1 px-1">{r.author} · {formatRelative(r.createdAt)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {ticket.status !== 'CLOSED' && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Reply</p>
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <textarea value={replyInput} onChange={e => setReplyInput(e.target.value)}
                                                placeholder="Add a message..." rows={2}
                                                className="w-full px-3 py-2 pr-9 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none" />
                                            <button type="button" onClick={() => replyFileInputRef.current?.click()}
                                                className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                                title="Add attachment">
                                                <Paperclip size={13} />
                                            </button>
                                            <input ref={replyFileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                                className="hidden"
                                                onChange={e => {
                                                    const files = Array.from(e.target.files ?? []);
                                                    setReplyAttachments(prev => [...prev, ...files].slice(0, 5));
                                                    e.target.value = '';
                                                }} />
                                        </div>
                                        <button onClick={handleReply} disabled={!replyInput.trim() || sending}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold self-start disabled:opacity-50 transition-all hover:opacity-90"
                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                            Send
                                        </button>
                                    </div>
                                    {replyAttachments.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {replyAttachments.map((f, i) => (
                                                <PendingAttachmentChip key={i} file={f} onRemove={() => setReplyAttachments(prev => prev.filter((_, j) => j !== i))} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminTicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>('ALL');
    const fetchedRef = useRef(false);

    const fetchTickets = useCallback(async (status: TicketStatus | 'ALL' = 'ALL') => {
        setLoading(true);
        try {
            const res = await api.get('/admin/support/tickets', {
                params: status !== 'ALL' ? { status } : {},
            });
            setTickets(res.data.data);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to load tickets');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchTickets();
    }, [fetchTickets]);

    const handleFilterChange = (s: TicketStatus | 'ALL') => {
        setStatusFilter(s);
        fetchTickets(s);
    };

    return (
        <div className="space-y-3">
            <SupportHeader subtitle="Raise and track support tickets"><div className="flex items-center gap-2 flex-wrap">
                        {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map(s => (
                            <button key={s} onClick={() => handleFilterChange(s)}
                                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${statusFilter === s ? 'bg-primary text-white border-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'}`}>
                                {s === 'ALL' ? 'All' : s === 'IN_PROGRESS' ? 'In Progress' : s.charAt(0) + s.slice(1).toLowerCase()}
                            </button>
                        ))}
                        <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1 h-8 px-3 rounded-xl text-[13px] font-semibold text-white hover:opacity-90 transition-all shrink-0"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Plus size={15} /> Raise Ticket
                        </button>
                    </div></SupportHeader>

            {loading ? (
                <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Loading...</div>
            ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        <TicketIcon size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No tickets found</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Raise a ticket if you need help</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {tickets.map((ticket, i) => (
                        <TicketCard key={ticket.id} ticket={ticket} index={i} />
                    ))}
                </div>
            )}

            <CreateTicketModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreate={t => setTickets(prev => [t, ...prev])}
            />
        </div>
    );
}
