'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Send, ChevronDown, ChevronUp, Check,
    Megaphone, Wrench, Sparkles, Bug, CreditCard,
    ShieldAlert, Bell, Users, Building2, School,
    GraduationCap, BookOpen, Search,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tag = {
    value: string;
    label: string;
    icon: React.ElementType;
    cls: string;
};

type RecipientType = 'ALL' | 'SCHOOL' | 'COLLEGE' | 'COACHING' | 'SPECIFIC';

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface PublishNotificationModalProps {
    open: boolean;
    onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PublishNotificationModal({ open, onClose }: PublishNotificationModalProps) {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [recipient, setRecipient] = useState<RecipientType>('ALL');
    const [specificSearch, setSpecificSearch] = useState('');
    const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([]);
    const [step, setStep] = useState<'compose' | 'preview'>('compose');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

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
            setSending(false);
            setSent(true);
            setTimeout(() => {
                setSent(false);
                handleClose();
            }, 1800);
        }, 1200);
    };

    const handleClose = () => {
        setTitle('');
        setMessage('');
        setSelectedTag(null);
        setRecipient('ALL');
        setSpecificSearch('');
        setSelectedInstitutions([]);
        setStep('compose');
        setSending(false);
        setSent(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
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
                        <div className="bg-card border border-border/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto shadow-2xl">

                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center">
                                        <Megaphone size={25} className="text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">Broadcast Notification</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {step === 'compose' ? 'Compose your message' : 'Preview before sending'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={handleClose}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
                                    <X size={16} className="text-muted-foreground" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto">
                                <AnimatePresence mode="wait">

                                    {/* ── Compose Step ── */}
                                    {step === 'compose' && (
                                        <motion.div
                                            key="compose"
                                            initial={{ opacity: 0, x: -16 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 16 }}
                                            className="p-6 space-y-5"
                                        >
                                            {/* Title */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    Notification Title
                                                </label>
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
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    Message
                                                </label>
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
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    Tag / Category
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {TAGS.map(tag => {
                                                        const Icon = tag.icon;
                                                        const isActive = selectedTag === tag.value;
                                                        return (
                                                            <button key={tag.value} onClick={() => setSelectedTag(isActive ? null : tag.value)}
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
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    Send To
                                                </label>
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
                                                                    {r.count > 0 && (
                                                                        <p className="text-[10px] opacity-70">{r.count} admins</p>
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
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-xs font-medium truncate">{inst.name}</p>
                                                                                </div>
                                                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${inst.type === 'SCHOOL' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400' :
                                                                                    inst.type === 'COLLEGE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' :
                                                                                        'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                                                                    }`}>
                                                                                    {inst.type}
                                                                                </span>
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

                                    {/* ── Preview Step ── */}
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
                                                {/* Tag header */}
                                                <div className={`flex items-center gap-2 px-4 py-3 ${tagCfg?.cls ?? ''}`}>
                                                    {TagIcon && <TagIcon size={14} />}
                                                    <span className="text-xs font-bold uppercase tracking-wider">{tagCfg?.label}</span>
                                                </div>
                                                {/* Content */}
                                                <div className="p-4 bg-card space-y-2">
                                                    <p className="text-sm font-bold">{title}</p>
                                                    <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-[11px] text-muted-foreground">Just now · QubeEx SuperAdmin</p>
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                                            <circle cx="12" cy="12" r="12" fill="#DA7756" />
                                                            <path d="M6 12.5L10 16.5L18 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Send summary */}
                                            <div className="p-4 bg-muted/30 rounded-xl space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Send Summary</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Recipients</span>
                                                    <span className="text-xs font-semibold">{getRecipientLabel()}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Total admins</span>
                                                    <span className="text-xs font-semibold">{getRecipientCount()}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Category</span>
                                                    <span className="text-xs font-semibold">{tagCfg?.label}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                </AnimatePresence>
                            </div>

                            {/* Footer */}
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
                                            <ChevronUp size={14} className="-rotate-90" />
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

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}