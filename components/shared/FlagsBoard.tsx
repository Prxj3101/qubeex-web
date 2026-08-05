'use client';

import { useState } from 'react';
import { ArrowLeft, BookOpen, Calendar, User, ShieldAlert, ChevronDown, ChevronUp, GraduationCap, Trash2 } from 'lucide-react';
import { FlagItem, CardType } from '@/lib/flags';
import { AttachmentPreview } from '@/components/shared/AttachmentPreview';

const CATEGORY_ICONS: Record<string, string> = {
    'Late Submission': '⏰',
    'Classroom Misconduct': '🗣️',
    'Attendance Shortfall': '📉',
    'Dress Code Violation': '👔',
    'Lab Misconduct': '💻',
    'Tab Switch Violation': '🖥️',
    'Academic Dishonesty': '📋',
    'Impersonation Attempt': '🎭',
    'Screenshot Attempt': '📸',
};

export function FlagCard({ flag, classLabel, onDelete }: { flag: FlagItem; classLabel?: string; onDelete?: (flag: FlagItem) => void }) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const isYellow = flag.type === 'yellow';

    return (
        <div className={`relative rounded-2xl border-[1.5px] overflow-hidden ${
            isYellow
                ? 'bg-amber-50 dark:bg-[#1C1A00] border-amber-200 dark:border-[#44330A]'
                : 'bg-red-50 dark:bg-[#1A0A0A] border-red-200 dark:border-[#3D0F0F]'
        }`}>
            {/* Admin-only delete — card disappears everywhere (admin, teacher,
                student) since they all read the same underlying report row. */}
            {onDelete && (
                <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
                    title="Delete card"
                    className={`absolute bottom-3 right-3 z-10 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                        isYellow
                            ? 'text-amber-600/60 hover:text-amber-800 hover:bg-amber-200/50 dark:text-amber-400/60 dark:hover:text-amber-300 dark:hover:bg-amber-900/40'
                            : 'text-red-600/60 hover:text-red-800 hover:bg-red-200/50 dark:text-red-400/60 dark:hover:text-red-300 dark:hover:bg-red-900/40'
                    }`}
                >
                    <Trash2 size={13} />
                </button>
            )}

            {/* Header row — always visible */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-start gap-3 p-4 text-left"
            >
                {/* Card icon */}
                <div
                    className="shrink-0 mt-0.5"
                    style={{
                        width: 18, height: 24, borderRadius: 3,
                        backgroundColor: isYellow ? '#FCFF38' : '#DC2626',
                        transform: 'rotate(-5deg)',
                        boxShadow: '2px 4px 0px rgba(0,0,0,0.35)',
                    }}
                />

                <div className="flex-1 min-w-0">
                    {/* Category badge + icon */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-sm">{CATEGORY_ICONS[flag.category] ?? '⚠️'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isYellow
                                ? 'bg-amber-100 text-amber-800 dark:bg-[#3D3000] dark:text-amber-300'
                                : 'bg-red-100 text-red-800 dark:bg-[#3D0D0D] dark:text-red-300'
                        }`}>
                            {flag.category}
                        </span>
                    </div>
                    {/* Title */}
                    <p className={`text-sm font-semibold ${
                        isYellow ? 'text-amber-900 dark:text-amber-200' : 'text-red-900 dark:text-red-200'
                    }`}>
                        {flag.title}
                    </p>
                </div>

                {/* Expand icon */}
                <div className={`shrink-0 mt-0.5 ${isYellow ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            {/* Confirm delete popup */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
                    <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-base font-bold mb-2">Delete this card?</h3>
                        <p className="text-sm text-muted-foreground mb-5">
                            &ldquo;{flag.title}&rdquo; will be permanently deleted. It will disappear from the teacher&rsquo;s reports and the student&rsquo;s Flags &amp; Warnings board as well. This can&rsquo;t be undone.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setConfirmDelete(false)}
                                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                Cancel
                            </button>
                            <button onClick={() => { setConfirmDelete(false); onDelete?.(flag); }}
                                className="h-9 px-4 rounded-xl text-xs font-semibold text-white bg-red-500 hover:opacity-90 transition-all">
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Meta row */}
            <div className={`flex flex-wrap gap-3 px-4 pl-[52px] ${onDelete ? 'pb-8 pr-8' : 'pb-3'}`}>
                <div className="flex items-center gap-1">
                    <Calendar size={11} className={isYellow ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'} />
                    <span className={`text-[10px] ${isYellow ? 'text-amber-800 dark:text-amber-300' : 'text-red-800 dark:text-red-300'}`}>{flag.date}</span>
                </div>
                {classLabel && (
                    <div className="flex items-center gap-1">
                        <GraduationCap size={11} className={isYellow ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'} />
                        <span className={`text-[10px] ${isYellow ? 'text-amber-800 dark:text-amber-300' : 'text-red-800 dark:text-red-300'}`}>{classLabel}</span>
                    </div>
                )}
                {flag.subject && (
                    <div className="flex items-center gap-1">
                        <BookOpen size={11} className={isYellow ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'} />
                        <span className={`text-[10px] ${isYellow ? 'text-amber-800 dark:text-amber-300' : 'text-red-800 dark:text-red-300'}`}>{flag.subject}</span>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    <User size={11} className={isYellow ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'} />
                    <span className={`text-[10px] ${isYellow ? 'text-amber-800 dark:text-amber-300' : 'text-red-800 dark:text-red-300'}`}>{flag.reportedBy}</span>
                </div>
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div className={`px-4 space-y-3 ${onDelete ? 'pb-9 pr-8' : 'pb-4'}`}>
                    {/* Incident detail */}
                    <div className={`p-3 rounded-xl border ${
                        isYellow
                            ? 'bg-amber-100 dark:bg-[#3D3000] border-amber-200 dark:border-[#44330A]'
                            : 'bg-red-100 dark:bg-[#3D0D0D] border-red-200 dark:border-[#3D0F0F]'
                    }`}>
                        <p className={`text-[11px] font-bold mb-1.5 ${
                            isYellow ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'
                        }`}>
                            📝 Incident Detail
                        </p>
                        <p className={`text-xs leading-relaxed ${
                            isYellow ? 'text-amber-900 dark:text-amber-200' : 'text-red-900 dark:text-red-200'
                        }`}>
                            {flag.detail}
                        </p>
                    </div>

                    {/* Attachments — multiple images/files/videos can be attached to one report */}
                    {flag.attachments.length > 0 && (
                        <div className="space-y-2">
                            {flag.attachments.map((att, i) => (
                                <AttachmentPreview key={i} attachment={att} compact />
                            ))}
                        </div>
                    )}

                    {/* Action taken */}
                    {flag.actionTaken && (
                        <div className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50">
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1.5">⚡ Action Taken</p>
                            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">{flag.actionTaken}</p>
                        </div>
                    )}

                    {/* Review remark */}
                    {flag.reviewRemark && (
                        <div className="p-3 rounded-xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50">
                            <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-1.5">
                                💬 Reviewer Remark{flag.reviewedBy ? ` — ${flag.reviewedBy}` : ''}
                            </p>
                            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{flag.reviewRemark}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const floatStyle: React.CSSProperties = {
    animation: 'flagFloat 1.6s ease-in-out infinite',
};

interface FlagsBoardProps {
    flags: FlagItem[];
    title: string;
    subtitle: string;
    onBack: () => void;
    headerAction?: React.ReactNode;
    appealNote?: string;
    classLabel?: string;
    /** Pass only from the admin side — when present, every card shows a delete
     * button. Teacher and student views omit this so they stay read-only. */
    onDelete?: (flag: FlagItem) => void;
}

export default function FlagsBoard({ flags, title, subtitle, onBack, headerAction, appealNote = 'Contact your class teacher or Principal.', classLabel, onDelete }: FlagsBoardProps) {
    const [activeTab, setActiveTab] = useState<CardType>('yellow');

    const sortByDateDesc = (arr: FlagItem[]) =>
        [...arr].sort((a, b) => new Date(a.date).getTime() < new Date(b.date).getTime() ? 1 : -1);

    const yellowFlags = sortByDateDesc(flags.filter(f => f.type === 'yellow'));
    const redFlags = sortByDateDesc(flags.filter(f => f.type === 'red'));
    const activeFlags = activeTab === 'yellow' ? yellowFlags : redFlags;

    return (
        <div className="flex flex-col h-full overflow-y-auto lg:overflow-hidden">
            <style>{`
                @keyframes flagFloat {
                    0%, 100% { transform: translateY(0px); }
                    50%       { transform: translateY(-8px); }
                }
            `}</style>
            {/* Page header */}
            <div className="shrink-0 px-1 pb-3">
                <div className="flex items-center gap-3 pb-3">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0"
                    >
                        <ArrowLeft size={15} className="text-foreground" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold leading-tight truncate">{title}</h1>
                        <p className="text-[13px] text-muted-foreground">{subtitle}</p>
                    </div>
                    {headerAction}
                </div>
                <div className="h-px bg-border/60" />
            </div>

            {/* Body: left tabs + right content */}
            <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-4 pb-3">

                {/* ── Left: Tab buttons ── */}
                <div className="lg:shrink-0 flex flex-row flex-wrap lg:flex-col gap-3 w-full lg:w-44">
                    {/* Yellow tab */}
                    <button
                        onClick={() => setActiveTab('yellow')}
                        className={`flex-1 lg:flex-none flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                            activeTab === 'yellow'
                                ? 'bg-amber-50 dark:bg-[#1C1A00] border-amber-300 dark:border-amber-500 border-b-[3px] border-b-amber-400 dark:border-b-amber-400'
                                : 'bg-card border-border/50 hover:bg-muted/30'
                        }`}
                    >
                        <img
                            src="/images/Yellowcard.png"
                            alt="Yellow Card"
                            style={{ width: 75, height: 75, objectFit: 'contain', ...(activeTab === 'yellow' ? floatStyle : {}) }}
                        />
                        <div className="text-center">
                            <p className={`text-sm font-bold ${
                                activeTab === 'yellow' ? 'text-amber-800 dark:text-amber-300' : 'text-foreground'
                            }`}>
                                Yellow Card
                            </p>
                            <p className={`text-xs ${
                                activeTab === 'yellow' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                            }`}>
                                {yellowFlags.length} flags
                            </p>
                        </div>
                    </button>

                    {/* Red tab */}
                    <button
                        onClick={() => setActiveTab('red')}
                        className={`flex-1 lg:flex-none flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                            activeTab === 'red'
                                ? 'bg-red-50 dark:bg-[#1A0A0A] border-red-300 dark:border-red-500 border-b-[3px] border-b-red-500'
                                : 'bg-card border-border/50 hover:bg-muted/30'
                        }`}
                    >
                        <img
                            src="/images/Redcard.png"
                            alt="Red Card"
                            style={{ width: 75, height: 75, objectFit: 'contain', ...(activeTab === 'red' ? floatStyle : {}) }}
                        />
                        <div className="text-center">
                            <p className={`text-sm font-bold ${
                                activeTab === 'red' ? 'text-red-800 dark:text-red-300' : 'text-foreground'
                            }`}>
                                Red Card
                            </p>
                            <p className={`text-xs ${
                                activeTab === 'red' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                            }`}>
                                {redFlags.length} flags
                            </p>
                        </div>
                    </button>

                    {/* Appeal note */}
                    <div className="w-full lg:mt-auto p-3 rounded-xl border bg-violet-50 dark:bg-violet-950/20 border-violet-200/50 dark:border-violet-900/50">
                        <div className="flex items-start gap-2">
                            <ShieldAlert size={14} className="text-violet-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[11px] font-bold text-violet-700 dark:text-violet-400 mb-1">Want to appeal?</p>
                                <p className="text-[10px] text-violet-600 dark:text-violet-400 leading-relaxed">
                                    {appealNote}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right: Flag cards ── */}
                <div className="w-full lg:flex-1 overflow-y-auto space-y-3 pr-1">
                    {activeFlags.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2">
                            <span className="text-4xl">✅</span>
                            <p className="text-sm text-muted-foreground font-semibold">
                                No {activeTab === 'yellow' ? 'yellow' : 'red'} cards! Keep it up.
                            </p>
                        </div>
                    ) : (
                        activeFlags.map(flag => <FlagCard key={flag.id} flag={flag} classLabel={classLabel} onDelete={onDelete} />)
                    )}
                </div>
            </div>
        </div>
    );
}
