'use client';

import { useState } from 'react';
import { ArrowLeft, BookOpen, Calendar, User, ShieldAlert, ChevronDown, ChevronUp, GraduationCap } from 'lucide-react';
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

const STATUS_CFG = {
    open:         { label: 'Open',         emoji: '🔴', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    under_review: { label: 'Under Review', emoji: '🕓', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    resolved:     { label: 'Resolved',     emoji: '✅', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    rejected:     { label: 'Rejected',     emoji: '🚫', color: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
    appealed:     { label: 'Appealed',     emoji: '⚖️', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
};

const SEVERITY_CFG = {
    low:    { label: 'Low',    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    medium: { label: 'Medium', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' },
    high:   { label: 'High',   color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

export function FlagCard({ flag, classLabel }: { flag: FlagItem; classLabel?: string }) {
    const [expanded, setExpanded] = useState(false);
    const isYellow = flag.type === 'yellow';
    const status = STATUS_CFG[flag.status];

    return (
        <div className={`rounded-2xl border-[1.5px] overflow-hidden ${
            isYellow
                ? 'bg-amber-50 dark:bg-[#1C1A00] border-amber-200 dark:border-[#44330A]'
                : 'bg-red-50 dark:bg-[#1A0A0A] border-red-200 dark:border-[#3D0F0F]'
        }`}>
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
                        {flag.severity && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SEVERITY_CFG[flag.severity].color}`}>
                                {SEVERITY_CFG[flag.severity].label}
                            </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${status.color}`}>
                            <span>{status.emoji}</span>{status.label}
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

            {/* Meta row */}
            <div className="flex flex-wrap gap-3 px-4 pb-3 pl-[52px]">
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
                {flag.assignedToName && (
                    <div className="flex items-center gap-1">
                        <ShieldAlert size={11} className={isYellow ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'} />
                        <span className={`text-[10px] ${isYellow ? 'text-amber-800 dark:text-amber-300' : 'text-red-800 dark:text-red-300'}`}>Assigned to {flag.assignedToName}</span>
                    </div>
                )}
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div className="px-4 pb-4 space-y-3">
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

                    {/* Attachment */}
                    {flag.attachmentUrl && flag.attachmentName && flag.attachmentType && (
                        <AttachmentPreview
                            attachment={{ url: flag.attachmentUrl, name: flag.attachmentName, type: flag.attachmentType }}
                            compact
                        />
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
}

export default function FlagsBoard({ flags, title, subtitle, onBack, headerAction, appealNote = 'Contact your class teacher or Principal.', classLabel }: FlagsBoardProps) {
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
                        activeFlags.map(flag => <FlagCard key={flag.id} flag={flag} classLabel={classLabel} />)
                    )}
                </div>
            </div>
        </div>
    );
}
