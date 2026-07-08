'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Calendar, User, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { FlagItem, CardType } from '@/lib/flags';
import api from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    active:   { label: 'Active',   emoji: '🔴', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    resolved: { label: 'Resolved', emoji: '✅', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    appealed: { label: 'Appealed', emoji: '⚖️', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
};

// ─── Flag Card ────────────────────────────────────────────────────────────────

function FlagCard({ flag }: { flag: FlagItem }) {
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

                    {/* Action taken */}
                    {flag.actionTaken && (
                        <div className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50">
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1.5">⚡ Action Taken</p>
                            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">{flag.actionTaken}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const floatStyle: React.CSSProperties = {
    animation: 'flagFloat 1.6s ease-in-out infinite',
};

export default function FlagsPage() {
    const [activeTab, setActiveTab] = useState<CardType>('yellow');
    const [flags, setFlags] = useState<FlagItem[]>([]);
    const router = useRouter();

    useEffect(() => {
        api.get('/student/remarks')
            .then(res => setFlags(res.data.data))
            .catch(() => setFlags([]));
    }, []);

    const sortByDateDesc = (arr: FlagItem[]) =>
        [...arr].sort((a, b) => new Date(a.date).getTime() < new Date(b.date).getTime() ? 1 : -1);

    const yellowFlags = sortByDateDesc(flags.filter(f => f.type === 'yellow'));
    const redFlags = sortByDateDesc(flags.filter(f => f.type === 'red'));
    const activeFlags = activeTab === 'yellow' ? yellowFlags : redFlags;

    return (
        <div className="flex flex-col h-full overflow-hidden">
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
                        onClick={() => router.back()}
                        className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0"
                    >
                        <ArrowLeft size={15} className="text-foreground" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold leading-tight">Flags &amp; Warnings</h1>
                        <p className="text-[13px] text-muted-foreground">Your conduct record &amp; disciplinary remarks</p>
                    </div>
                </div>
                <div className="h-px bg-border/60" />
            </div>

            {/* Body: left tabs + right content */}
            <div className="flex-1 overflow-hidden flex gap-4 pb-3">

                {/* ── Left: Tab buttons ── */}
                <div className="shrink-0 flex flex-col gap-3 w-44">
                    {/* Yellow tab */}
                    <button
                        onClick={() => setActiveTab('yellow')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
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
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
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
                    <div className="mt-auto p-3 rounded-xl border bg-violet-50 dark:bg-violet-950/20 border-violet-200/50 dark:border-violet-900/50">
                        <div className="flex items-start gap-2">
                            <ShieldAlert size={14} className="text-violet-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[11px] font-bold text-violet-700 dark:text-violet-400 mb-1">Want to appeal?</p>
                                <p className="text-[10px] text-violet-600 dark:text-violet-400 leading-relaxed">
                                    Contact your class teacher or Principal.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right: Flag cards ── */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {activeFlags.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2">
                            <span className="text-4xl">✅</span>
                            <p className="text-sm text-muted-foreground font-semibold">
                                No {activeTab === 'yellow' ? 'yellow' : 'red'} cards! Keep it up.
                            </p>
                        </div>
                    ) : (
                        activeFlags.map(flag => <FlagCard key={flag.id} flag={flag} />)
                    )}
                </div>
            </div>
        </div>
    );
}
