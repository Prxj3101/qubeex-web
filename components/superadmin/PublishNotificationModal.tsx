'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Send, Check, Megaphone, Wrench, Sparkles, Bug,
    CreditCard, ShieldAlert, Bell, Users, Building2,
    School, GraduationCap, BookOpen, Search, ChevronDown,
    Clock, CheckCircle2, History, Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tag = {
    value: string;
    label: string;
    icon: React.ElementType;
    cls: string;
};

type RecipientType = 'ALL' | 'SCHOOL' | 'COLLEGE' | 'COACHING' | 'SPECIFIC';
type ModalTab = 'compose' | 'history';

type InstitutionOption = {
    id: string;
    name: string;
    type: string;
};

type HistoryNotification = {
    id: string;
    title: string;
    message: string;
    tag: string;
    recipientType: string;
    deliveredTo: number;
    createdAt: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const TAGS: Tag[] = [
    { value: 'ANNOUNCEMENT', label: 'Announcement', icon: Megaphone, cls: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800' },
    { value: 'MAINTENANCE', label: 'Maintenance', icon: Wrench, cls: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800' },
    { value: 'UPDATE', label: 'Update', icon: Bell, cls: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-800' },
    { value: 'FEATURE', label: 'Feature Added', icon: Sparkles, cls: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' },
    { value: 'BUG_FIXED', label: 'Bug Fixed', icon: Bug, cls: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800' },
    { value: 'PLAN_EXPIRY', label: 'Plan Expiring', icon: CreditCard, cls: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800' },
    { value: 'SECURITY', label: 'Security Alert', icon: ShieldAlert, cls: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800' },
];

const RECIPIENT_META = [
    { value: 'ALL' as RecipientType, label: 'All Institutions', icon: Users, cls: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800' },
    { value: 'SCHOOL' as RecipientType, label: 'Schools', icon: School, cls: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-800' },
    { value: 'COLLEGE' as RecipientType, label: 'Colleges', icon: GraduationCap, cls: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' },
    { value: 'COACHING' as RecipientType, label: 'Coaching', icon: BookOpen, cls: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800' },
    { value: 'SPECIFIC' as RecipientType, label: 'Specific Institution', icon: Building2, cls: 'bg-muted text-muted-foreground border-border' },
];

function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function recipientLabel(recipientType: string): string {
    return RECIPIENT_META.find(r => r.value === recipientType)?.label ?? recipientType;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PublishNotificationModalProps {
    open: boolean;
    onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PublishNotificationModal({ open, onClose }: PublishNotificationModalProps) {
    const [modalTab, setModalTab] = useState<ModalTab>('compose');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [recipient, setRecipient] = useState<RecipientType>('ALL');
    const [specificSearch, setSpecificSearch] = useState('');
    const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([]);
    const [step, setStep] = useState<'compose' | 'preview'>('compose');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Real data
    const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
    const [loadingInstitutions, setLoadingInstitutions] = useState(false);
    const [history, setHistory] = useState<HistoryNotification[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyTotal, setHistoryTotal] = useState(0);

    const fetchInstitutions = useCallback(async () => {
        setLoadingInstitutions(true);
        try {
            const res = await api.get('/superadmin/institutions');
            const list: InstitutionOption[] = (res.data?.data ?? []).map((i: { id: string; name: string; type: string }) => ({
                id: i.id,
                name: i.name,
                type: i.type,
            }));
            setInstitutions(list);
        } catch {
            // non-fatal — picker will just be empty
        } finally {
            setLoadingInstitutions(false);
        }
    }, []);

    const fetchHistory = useCallback(async (page = 1) => {
        setLoadingHistory(true);
        try {
            const res = await api.get('/superadmin/notifications', { params: { page, limit: 20 } });
            const { notifications, pagination } = res.data ?? { notifications: [], pagination: { total: 0 } };
            setHistory(prev => page === 1 ? notifications : [...prev, ...notifications]);
            setHistoryTotal(pagination.total ?? 0);
            setHistoryPage(page);
        } catch {
            // non-fatal
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            void fetchInstitutions();
            void fetchHistory(1);
        }
    }, [open, fetchInstitutions, fetchHistory]);

    // Counts derived from real institutions
    const countAll = institutions.length;
    const countByType = (type: string) => institutions.filter(i => i.type === type).length;

    const getRecipientCount = () => {
        if (recipient === 'SPECIFIC') return selectedInstitutions.length;
        if (recipient === 'ALL') return countAll;
        return countByType(recipient);
    };

    const filteredInstitutions = institutions.filter(i =>
        i.name.toLowerCase().includes(specificSearch.toLowerCase())
    );

    const toggleInstitution = (id: string) =>
        setSelectedInstitutions(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );

    const canPreview = title.trim() && message.trim() && selectedTag &&
        (recipient !== 'SPECIFIC' || selectedInstitutions.length > 0);

    const getRecipientLabel = () => {
        if (recipient === 'SPECIFIC') {
            const names = institutions
                .filter(i => selectedInstitutions.includes(i.id))
                .map(i => i.name);
            return names.length <= 2
                ? names.join(', ')
                : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
        }
        return RECIPIENT_META.find(r => r.value === recipient)?.label ?? '';
    };

    const tagCfg = TAGS.find(t => t.value === selectedTag);
    const TagIcon = tagCfg?.icon;

    const handleSend = async () => {
        setSending(true);
        setError(null);
        try {
            await api.post('/superadmin/notifications', {
                title,
                message,
                tag: selectedTag,
                recipient,
                institutionIds: recipient === 'SPECIFIC' ? selectedInstitutions : undefined,
            });
            setSent(true);
            await fetchHistory(1);
            setTimeout(() => {
                setSent(false);
                handleResetCompose();
                setModalTab('history');
            }, 1500);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to send notification. Please try again.'));
        } finally {
            setSending(false);
        }
    };

    const handleResetCompose = () => {
        setTitle('');
        setMessage('');
        setSelectedTag(null);
        setRecipient('ALL');
        setSpecificSearch('');
        setSelectedInstitutions([]);
        setStep('compose');
        setSending(false);
        setSent(false);
        setError(null);
    };

    const handleClose = () => {
        handleResetCompose();
        setModalTab('compose');
        onClose();
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50"
                        onClick={handleClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="bg-card border border-border/50 rounded-2xl w-full max-w-2xl h-[75vh] overflow-hidden flex flex-col pointer-events-auto shadow-2xl mx-4">
                            {/* ── Modal Header ── */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-6 py-4 border-b border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center">
                                        <Megaphone size={25} className="text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-semibold">Broadcast Notification</p>
                                </div>

                                {/* Tabs */}
                                <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
                                    <button onClick={() => { setModalTab('compose'); setStep('compose'); }}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${modalTab === 'compose'
                                            ? 'bg-card text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}>
                                        <Send size={16} />
                                        Compose
                                    </button>
                                    <button onClick={() => setModalTab('history')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${modalTab === 'history'
                                            ? 'bg-card text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}>
                                        <History size={16} />
                                        History
                                        {historyTotal > 0 && (
                                            <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                                                {historyTotal}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                <button onClick={handleClose}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
                                    <X size={16} className="text-muted-foreground" />
                                </button>
                            </div>

                            {/* ── Body ── */}
                            <div className="flex-1 overflow-y-auto min-h-0">
                                <AnimatePresence mode="wait">

                                    {/* ── History Tab ── */}
                                    {modalTab === 'history' && (
                                        <motion.div
                                            key="history"
                                            initial={{ opacity: 0, x: 16 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -16 }}
                                            className="divide-y divide-border/40"
                                        >
                                            {loadingHistory && history.length === 0 ? (
                                                <div className="flex items-center justify-center py-20">
                                                    <Loader2 size={24} className="text-muted-foreground animate-spin" />
                                                </div>
                                            ) : history.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                                    <History size={32} className="text-muted-foreground mb-3" />
                                                    <p className="text-sm font-medium text-muted-foreground">No notifications sent yet</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {history.map((notif, i) => {
                                                        const tag = TAGS.find(t => t.value === notif.tag);
                                                        const TagIc = tag?.icon;
                                                        return (
                                                            <motion.div
                                                                key={notif.id}
                                                                initial={{ opacity: 0, y: 8 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: i * 0.03 }}
                                                                className="flex items-start gap-3 px-6 py-4 hover:bg-muted/20 transition-colors"
                                                            >
                                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tag?.cls ?? 'bg-muted text-muted-foreground'}`}>
                                                                    {TagIc && <TagIc size={14} />}
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                                        <p className="text-sm font-semibold truncate">{notif.title}</p>
                                                                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${tag?.cls}`}>
                                                                            {tag?.label ?? notif.tag}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">{notif.message}</p>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                                            <Users size={10} />
                                                                            {recipientLabel(notif.recipientType)}
                                                                        </span>
                                                                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                                            <CheckCircle2 size={10} />
                                                                            {notif.deliveredTo} delivered
                                                                        </span>
                                                                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                                            <Clock size={10} />
                                                                            {relativeTime(notif.createdAt)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                                    {history.length < historyTotal && (
                                                        <div className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => fetchHistory(historyPage + 1)}
                                                                disabled={loadingHistory}
                                                                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                                            >
                                                                {loadingHistory ? 'Loading...' : 'Load more'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* ── Compose Tab ── */}
                                    {modalTab === 'compose' && (
                                        <motion.div
                                            key="compose-tab"
                                            initial={{ opacity: 0, x: -16 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 16 }}
                                        >
                                            <AnimatePresence mode="wait">

                                                {/* Compose step */}
                                                {step === 'compose' && (
                                                    <motion.div
                                                        key="compose"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        className="p-6 space-y-5"
                                                    >
                                                        {/* Title */}
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</label>
                                                            <input
                                                                value={title}
                                                                onChange={e => setTitle(e.target.value)}
                                                                placeholder="e.g. Scheduled Maintenance Tonight"
                                                                maxLength={80}
                                                                className="w-full h-10 px-3 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
                                                            />
                                                            <p className="text-[11px] text-muted-foreground text-right">{title.length}/80</p>
                                                        </div>

                                                        {/* Message */}
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message</label>
                                                            <textarea
                                                                value={message}
                                                                onChange={e => setMessage(e.target.value)}
                                                                placeholder="Write your notification message here..."
                                                                rows={4}
                                                                maxLength={500}
                                                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none transition-all"
                                                            />
                                                            <p className="text-[11px] text-muted-foreground text-right">{message.length}/500</p>
                                                        </div>

                                                        {/* Tags */}
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tag / Category</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {TAGS.map(tag => {
                                                                    const Icon = tag.icon;
                                                                    const isActive = selectedTag === tag.value;
                                                                    return (
                                                                        <button key={tag.value}
                                                                            onClick={() => setSelectedTag(isActive ? null : tag.value)}
                                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${isActive ? tag.cls : 'border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                                                                }`}>
                                                                            <Icon size={12} />
                                                                            {tag.label}
                                                                            {isActive && <Check size={11} />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Recipients */}
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Send To</label>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {RECIPIENT_META.map(r => {
                                                                    const Icon = r.icon;
                                                                    const isActive = recipient === r.value;
                                                                    const count = r.value === 'SPECIFIC' ? 0
                                                                        : r.value === 'ALL' ? countAll
                                                                        : countByType(r.value);
                                                                    return (
                                                                        <button key={r.value} onClick={() => setRecipient(r.value)}
                                                                            className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${isActive ? r.cls : 'border-border/50 hover:bg-muted/30'
                                                                                }`}>
                                                                            <Icon size={15} className={isActive ? '' : 'text-muted-foreground'} />
                                                                            <div>
                                                                                <p className="text-xs font-semibold">{r.label}</p>
                                                                                {r.value !== 'SPECIFIC' && (
                                                                                    <p className="text-[10px] opacity-70">
                                                                                        {loadingInstitutions ? '...' : `${count} institution${count !== 1 ? 's' : ''}`}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            {isActive && <Check size={13} className="ml-auto" />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Specific institution picker */}
                                                            <AnimatePresence>
                                                                {recipient === 'SPECIFIC' && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <div className="mt-2 space-y-2">
                                                                            <div className="relative">
                                                                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                                                <input
                                                                                    value={specificSearch}
                                                                                    onChange={e => setSpecificSearch(e.target.value)}
                                                                                    placeholder="Search institution..."
                                                                                    className="w-full h-9 pl-8 pr-3 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-1 max-h-[160px] overflow-y-auto">
                                                                                {loadingInstitutions ? (
                                                                                    <div className="flex items-center justify-center py-6">
                                                                                        <Loader2 size={18} className="text-muted-foreground animate-spin" />
                                                                                    </div>
                                                                                ) : filteredInstitutions.length === 0 ? (
                                                                                    <p className="text-xs text-muted-foreground text-center py-4">No institutions found</p>
                                                                                ) : filteredInstitutions.map(inst => {
                                                                                    const isSelected = selectedInstitutions.includes(inst.id);
                                                                                    return (
                                                                                        <button key={inst.id} onClick={() => toggleInstitution(inst.id)}
                                                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${isSelected
                                                                                                ? 'border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800'
                                                                                                : 'border-border/40 hover:bg-muted/30'
                                                                                                }`}>
                                                                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-violet-600 border-violet-600' : 'border-border'
                                                                                                }`}>
                                                                                                {isSelected && <Check size={11} className="text-white" />}
                                                                                            </div>
                                                                                            <p className="text-xs font-medium flex-1 truncate">{inst.name}</p>
                                                                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${inst.type === 'SCHOOL' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400' :
                                                                                                inst.type === 'COLLEGE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' :
                                                                                                    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                                                                                }`}>{inst.type}</span>
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            {selectedInstitutions.length > 0 && (
                                                                                <p className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                                                                                    {selectedInstitutions.length} institution{selectedInstitutions.length > 1 ? 's' : ''} selected
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </motion.div>
                                                )}

                                                {/* Preview step */}
                                                {step === 'preview' && (
                                                    <motion.div
                                                        key="preview"
                                                        initial={{ opacity: 0, x: 16 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -16 }}
                                                        className="p-6 space-y-4"
                                                    >
                                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>

                                                        {/* Notification preview card */}
                                                        <div className="border border-border/50 rounded-2xl overflow-hidden">
                                                            <div className={`flex items-center gap-2 px-4 py-3 ${tagCfg?.cls ?? ''}`}>
                                                                {TagIcon && <TagIcon size={14} />}
                                                                <span className="text-xs font-bold uppercase tracking-wider">{tagCfg?.label}</span>
                                                            </div>
                                                            <div className="p-4 bg-card space-y-2">
                                                                <p className="text-sm font-bold">{title}</p>
                                                                <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="text-[11px] text-muted-foreground">Just now · QubeEx SuperAdmin</p>
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                                                        <circle cx="12" cy="12" r="12" fill="#DA7756" />
                                                                        <path d="M6 12.5L10 16.5L18 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Send summary */}
                                                        <div className="p-4 bg-muted/30 rounded-xl space-y-2.5">
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Send Summary</p>
                                                            {[
                                                                { label: 'Recipients', value: getRecipientLabel() },
                                                                { label: 'Total institutions', value: `${getRecipientCount()}` },
                                                                { label: 'Category', value: tagCfg?.label ?? '' },
                                                            ].map(({ label, value }) => (
                                                                <div key={label} className="flex items-center justify-between">
                                                                    <span className="text-xs text-muted-foreground">{label}</span>
                                                                    <span className="text-xs font-semibold">{value}</span>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Error */}
                                                        {error && (
                                                            <p className="text-xs text-red-500 font-medium">{error}</p>
                                                        )}
                                                    </motion.div>
                                                )}

                                            </AnimatePresence>
                                        </motion.div>
                                    )}

                                </AnimatePresence>
                            </div>

                            {/* ── Footer — only on compose tab ── */}
                            {modalTab === 'compose' && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10">
                                    {step === 'compose' ? (
                                        <>
                                            <button onClick={handleClose}
                                                className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => setStep('preview')}
                                                disabled={!canPreview}
                                                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                            >
                                                Preview
                                                <ChevronDown size={14} className="-rotate-90" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => { setStep('compose'); setError(null); }}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                                                <ChevronDown size={14} className="rotate-90" />
                                                Back
                                            </button>
                                            {sent ? (
                                                <div className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-500">
                                                    <Check size={14} />
                                                    Sent!
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleSend}
                                                    disabled={sending}
                                                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-70 transition-all hover:opacity-90"
                                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                                >
                                                    {sending ? (
                                                        <>
                                                            <Loader2 size={14} className="animate-spin" />
                                                            Sending...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send size={14} />
                                                            Send to {getRecipientCount()} institution{getRecipientCount() !== 1 ? 's' : ''}
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
