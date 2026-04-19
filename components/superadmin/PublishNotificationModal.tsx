'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Send, Check, Megaphone, Wrench, Sparkles, Bug,
    CreditCard, ShieldAlert, Bell, Users, Building2,
    School, GraduationCap, BookOpen, Search, ChevronDown,
    Clock, CheckCircle2, History,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tag = {
    value: string;
    label: string;
    icon: React.ElementType;
    cls: string;
};

type RecipientType = 'ALL' | 'SCHOOL' | 'COLLEGE' | 'COACHING' | 'SPECIFIC';
type ModalTab = 'compose' | 'history';

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

const RECIPIENTS = [
    { value: 'ALL' as RecipientType, label: 'All Admins', icon: Users, count: 48, cls: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800' },
    { value: 'SCHOOL' as RecipientType, label: 'School Admins', icon: School, count: 21, cls: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-800' },
    { value: 'COLLEGE' as RecipientType, label: 'College Admins', icon: GraduationCap, count: 18, cls: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' },
    { value: 'COACHING' as RecipientType, label: 'Coaching Admins', icon: BookOpen, count: 9, cls: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800' },
    { value: 'SPECIFIC' as RecipientType, label: 'Specific Institution', icon: Building2, count: 0, cls: 'bg-muted text-muted-foreground border-border' },
];

const MOCK_INSTITUTIONS = [
    { id: 's1', name: 'Delhi Public School', type: 'SCHOOL' },
    { id: 's2', name: 'Modern High School', type: 'SCHOOL' },
    { id: 's3', name: 'Ryan International School', type: 'SCHOOL' },
    { id: 'c1', name: 'DY Patil College', type: 'COLLEGE' },
    { id: 'c2', name: 'Fergusson College', type: 'COLLEGE' },
    { id: 'c3', name: 'Shree Vidya College', type: 'COLLEGE' },
    { id: 'k1', name: 'Aakash Coaching', type: 'COACHING' },
    { id: 'k2', name: 'Sunrise Academy', type: 'COACHING' },
];

interface HistoryNotification {
    id: string;
    title: string;
    message: string;
    tag: string;
    recipient: string;
    deliveredTo: number;
    sentAt: string;
}

const MOCK_HISTORY: HistoryNotification[] = [
    {
        id: 'n1', title: 'Scheduled Maintenance Tonight',
        message: 'QubeEx will be under maintenance from 2AM to 4AM IST. Please save your work.',
        tag: 'MAINTENANCE', recipient: 'All Admins', deliveredTo: 48, sentAt: '2 hours ago',
    },
    {
        id: 'n2', title: 'New Feature: Bulk CSV Import',
        message: 'You can now import students in bulk using CSV files. Check the People section.',
        tag: 'FEATURE', recipient: 'School Admins', deliveredTo: 21, sentAt: '1 day ago',
    },
    {
        id: 'n3', title: 'Bug Fixed: Test Submission Issue',
        message: 'The issue where test submissions were not saving has been resolved.',
        tag: 'BUG_FIXED', recipient: 'All Admins', deliveredTo: 48, sentAt: '3 days ago',
    },
    {
        id: 'n4', title: 'Plan Expiring Soon',
        message: 'Your Pro plan is expiring in 7 days. Please renew to avoid service interruption.',
        tag: 'PLAN_EXPIRY', recipient: 'Aakash Coaching', deliveredTo: 1, sentAt: '5 days ago',
    },
    {
        id: 'n5', title: 'Security Advisory',
        message: 'We recommend all admins to reset their passwords as a precautionary measure.',
        tag: 'SECURITY', recipient: 'All Admins', deliveredTo: 48, sentAt: '1 week ago',
    },
    {
        id: 'n6', title: 'Platform v2.1 Update Released',
        message: 'QubeEx v2.1 is live with improved AI grading, faster load times and new reports.',
        tag: 'UPDATE', recipient: 'All Admins', deliveredTo: 48, sentAt: '2 weeks ago',
    },
];

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
    const [history, setHistory] = useState<HistoryNotification[]>(MOCK_HISTORY);

    const filteredInstitutions = MOCK_INSTITUTIONS.filter(i =>
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
            const names = MOCK_INSTITUTIONS
                .filter(i => selectedInstitutions.includes(i.id))
                .map(i => i.name);
            return names.length <= 2
                ? names.join(', ')
                : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
        }
        return RECIPIENTS.find(r => r.value === recipient)?.label ?? '';
    };

    const getRecipientCount = () => {
        if (recipient === 'SPECIFIC') return selectedInstitutions.length;
        return RECIPIENTS.find(r => r.value === recipient)?.count ?? 0;
    };

    const tagCfg = TAGS.find(t => t.value === selectedTag);
    const TagIcon = tagCfg?.icon;

    const handleSend = () => {
        setSending(true);
        setTimeout(() => {
            // Add to history
            const newNotif: HistoryNotification = {
                id: `n-${Date.now()}`,
                title,
                message,
                tag: selectedTag!,
                recipient: getRecipientLabel(),
                deliveredTo: getRecipientCount(),
                sentAt: 'Just now',
            };
            setHistory(prev => [newNotif, ...prev]);
            setSending(false);
            setSent(true);
            setTimeout(() => {
                setSent(false);
                handleResetCompose();
                setModalTab('history');
            }, 1500);
        }, 1200);
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
                        <div className="bg-card border border-border/50 rounded-2xl w-full max-w-2xl h-[75vh] overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
                            {/* ── Modal Header ── */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
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
                                        <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                                            {history.length}
                                        </span>
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
                                            {history.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                                    <History size={32} className="text-muted-foreground mb-3" />
                                                    <p className="text-sm font-medium text-muted-foreground">No notifications sent yet</p>
                                                </div>
                                            ) : (
                                                history.map((notif, i) => {
                                                    const tag = TAGS.find(t => t.value === notif.tag);
                                                    const TagIc = tag?.icon;
                                                    return (
                                                        <motion.div
                                                            key={notif.id}
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.04 }}
                                                            className="flex items-start gap-3 px-6 py-4 hover:bg-muted/20 transition-colors"
                                                        >
                                                            {/* Tag icon */}
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tag?.cls ?? 'bg-muted text-muted-foreground'}`}>
                                                                {TagIc && <TagIc size={14} />}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                {/* Title + tag */}
                                                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                                    <p className="text-sm font-semibold truncate">{notif.title}</p>
                                                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${tag?.cls}`}>
                                                                        {tag?.label}
                                                                    </span>
                                                                </div>
                                                                {/* Message preview */}
                                                                <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">{notif.message}</p>
                                                                {/* Meta */}
                                                                <div className="flex items-center gap-3">
                                                                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                                        <Users size={10} />
                                                                        {notif.recipient}
                                                                    </span>
                                                                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                                        <CheckCircle2 size={10} />
                                                                        {notif.deliveredTo} delivered
                                                                    </span>
                                                                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                                        <Clock size={10} />
                                                                        {notif.sentAt}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })
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
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {RECIPIENTS.map(r => {
                                                                    const Icon = r.icon;
                                                                    const isActive = recipient === r.value;
                                                                    return (
                                                                        <button key={r.value} onClick={() => setRecipient(r.value)}
                                                                            className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${isActive ? r.cls : 'border-border/50 hover:bg-muted/30'
                                                                                }`}>
                                                                            <Icon size={15} className={isActive ? '' : 'text-muted-foreground'} />
                                                                            <div>
                                                                                <p className="text-xs font-semibold">{r.label}</p>
                                                                                {r.count > 0 && <p className="text-[10px] opacity-70">{r.count} admins</p>}
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
                                                                                {filteredInstitutions.map(inst => {
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
                                                                { label: 'Total admins', value: `${getRecipientCount()}` },
                                                                { label: 'Category', value: tagCfg?.label ?? '' },
                                                            ].map(({ label, value }) => (
                                                                <div key={label} className="flex items-center justify-between">
                                                                    <span className="text-xs text-muted-foreground">{label}</span>
                                                                    <span className="text-xs font-semibold">{value}</span>
                                                                </div>
                                                            ))}
                                                        </div>
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
                                            <button onClick={() => setStep('compose')}
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
                                                            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                            Sending...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send size={14} />
                                                            Send to {getRecipientCount()} admin{getRecipientCount() !== 1 ? 's' : ''}
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