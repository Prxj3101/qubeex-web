'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Calendar, User, BookOpen, GraduationCap, Send } from 'lucide-react';
import api from '@/lib/api';
import { FlagItem, Status } from '@/lib/flags';
import { AttachmentPreview } from '@/components/shared/AttachmentPreview';

const CATEGORY_ICONS: Record<string, string> = {
    'Attendance': '📉',
    'Discipline': '🗣️',
    'Poor Performance': '📉',
    'Assignment Not Submitted': '⏰',
    'Misconduct': '⚠️',
};

const STATUS_CFG: Record<Status, { label: string; color: string }> = {
    open: { label: 'Open', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    rejected: { label: 'Rejected', color: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
    appealed: { label: 'Appealed', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
};

const SEVERITY_CFG = {
    low: { label: 'Low', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    medium: { label: 'Medium', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' },
    high: { label: 'High', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

const REVIEW_ACTIONS: Array<{ status: 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED'; label: string; className: string }> = [
    { status: 'UNDER_REVIEW', label: 'Mark Under Review', className: 'bg-blue-600 hover:bg-blue-700' },
    { status: 'RESOLVED', label: 'Resolve', className: 'bg-emerald-600 hover:bg-emerald-700' },
    { status: 'REJECTED', label: 'Reject', className: 'bg-zinc-600 hover:bg-zinc-700' },
];

function ReportRow({ report, reviewUrlBase, studentHrefBase, onReviewed }: {
    report: FlagItem;
    reviewUrlBase: string;
    studentHrefBase: (report: FlagItem) => string;
    onReviewed: () => void;
}) {
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const [remark, setRemark] = useState('');
    const [submitting, setSubmitting] = useState<string | null>(null);
    const isYellow = report.type === 'yellow';

    const handleReview = async (status: 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED') => {
        setSubmitting(status);
        try {
            await api.patch(`${reviewUrlBase}/${report.id}`, { status, reviewRemark: remark.trim() || undefined });
            toast.success('Report updated');
            setRemark('');
            onReviewed();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            toast.error(e?.response?.data?.error ?? 'Failed to update report');
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className={`rounded-2xl border-[1.5px] overflow-hidden ${
            isYellow
                ? 'bg-amber-50 dark:bg-[#1C1A00] border-amber-200 dark:border-[#44330A]'
                : 'bg-red-50 dark:bg-[#1A0A0A] border-red-200 dark:border-[#3D0F0F]'
        }`}>
            <button onClick={() => setExpanded(e => !e)} className="w-full flex items-start gap-3 p-4 text-left">
                <div className="shrink-0 mt-0.5" style={{
                    width: 18, height: 24, borderRadius: 3,
                    backgroundColor: isYellow ? '#FCFF38' : '#DC2626',
                    transform: 'rotate(-5deg)', boxShadow: '2px 4px 0px rgba(0,0,0,0.35)',
                }} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-sm">{CATEGORY_ICONS[report.category] ?? '⚠️'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isYellow ? 'bg-amber-100 text-amber-800 dark:bg-[#3D3000] dark:text-amber-300' : 'bg-red-100 text-red-800 dark:bg-[#3D0D0D] dark:text-red-300'
                        }`}>
                            {report.category}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SEVERITY_CFG[report.severity].color}`}>
                            {SEVERITY_CFG[report.severity].label}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CFG[report.status].color}`}>
                            {STATUS_CFG[report.status].label}
                        </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{report.title}</p>
                    <button
                        onClick={e => { e.stopPropagation(); router.push(studentHrefBase(report)); }}
                        className="text-xs font-medium text-primary hover:underline mt-0.5"
                    >
                        {report.studentName}{report.className ? ` · ${report.className}` : ''}
                    </button>
                </div>
                <div className="shrink-0 mt-0.5 text-muted-foreground">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            <div className="flex flex-wrap gap-3 px-4 pb-3 pl-[52px]">
                <div className="flex items-center gap-1">
                    <Calendar size={11} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{report.date}</span>
                </div>
                {report.subject && (
                    <div className="flex items-center gap-1">
                        <BookOpen size={11} className="text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{report.subject}</span>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    <User size={11} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Reported by {report.reportedBy}</span>
                </div>
                {report.assignedToName && (
                    <div className="flex items-center gap-1">
                        <GraduationCap size={11} className="text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Assigned to {report.assignedToName}</span>
                    </div>
                )}
            </div>

            {expanded && (
                <div className="px-4 pb-4 space-y-3">
                    <div className={`p-3 rounded-xl border ${isYellow ? 'bg-amber-100 dark:bg-[#3D3000] border-amber-200 dark:border-[#44330A]' : 'bg-red-100 dark:bg-[#3D0D0D] border-red-200 dark:border-[#3D0F0F]'}`}>
                        <p className="text-[11px] font-bold mb-1.5 text-foreground/80">📝 Incident Detail</p>
                        <p className="text-xs leading-relaxed text-foreground/90">{report.detail}</p>
                    </div>

                    {report.attachmentUrl && report.attachmentName && report.attachmentType && (
                        <AttachmentPreview attachment={{ url: report.attachmentUrl, name: report.attachmentName, type: report.attachmentType }} compact />
                    )}

                    {report.actionTaken && (
                        <div className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50">
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1.5">⚡ Action Taken</p>
                            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">{report.actionTaken}</p>
                        </div>
                    )}

                    {report.reviewRemark && (
                        <div className="p-3 rounded-xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50">
                            <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-1.5">
                                💬 Reviewer Remark{report.reviewedBy ? ` — ${report.reviewedBy}` : ''}
                            </p>
                            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{report.reviewRemark}</p>
                        </div>
                    )}

                    {report.canReview && (
                        <div className="p-3 rounded-xl border border-border/50 bg-card space-y-2">
                            <textarea
                                value={remark}
                                onChange={e => setRemark(e.target.value)}
                                rows={2}
                                placeholder="Add a remark (optional)"
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring transition-all resize-none"
                            />
                            <div className="flex flex-wrap gap-2">
                                {REVIEW_ACTIONS.map(action => (
                                    <button
                                        key={action.status}
                                        onClick={() => handleReview(action.status)}
                                        disabled={!!submitting}
                                        className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-semibold text-white transition-all disabled:opacity-60 ${action.className}`}
                                    >
                                        <Send size={11} />
                                        {submitting === action.status ? 'Saving...' : action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface ReportsInboxViewProps {
    title: string;
    subtitle: string;
    inboxUrl: string;
    submittedUrl?: string;
    reviewUrlBase: string;
    studentHrefBase: (report: FlagItem) => string;
    /** Called whenever the list is (re)loaded, with the count of open/under_review items — for a nav badge. */
    onCountChange?: (count: number) => void;
}

export default function ReportsInboxView({ title, subtitle, inboxUrl, submittedUrl, reviewUrlBase, studentHrefBase, onCountChange }: ReportsInboxViewProps) {
    const [tab, setTab] = useState<'inbox' | 'submitted'>('inbox');
    const [inbox, setInbox] = useState<FlagItem[]>([]);
    const [submitted, setSubmitted] = useState<FlagItem[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        const requests: Promise<void>[] = [
            api.get(inboxUrl).then(res => {
                const data: FlagItem[] = res.data.data;
                setInbox(data);
                onCountChange?.(data.filter(r => r.status === 'open' || r.status === 'under_review').length);
            }).catch(() => setInbox([])),
        ];
        if (submittedUrl) {
            requests.push(
                api.get(submittedUrl).then(res => setSubmitted(res.data.data)).catch(() => setSubmitted([]))
            );
        }
        Promise.all(requests).finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inboxUrl, submittedUrl]);

    useEffect(() => { load(); }, [load]);

    const activeList = tab === 'inbox' ? inbox : submitted;

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="shrink-0 px-1 pb-3">
                <h1 className="text-xl font-bold leading-tight">{title}</h1>
                <p className="text-[13px] text-muted-foreground">{subtitle}</p>
                <div className="h-px bg-border/60 mt-3" />
            </div>

            <div className="shrink-0 px-1 pb-3 flex gap-2">
                <button
                    onClick={() => setTab('inbox')}
                    className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all ${tab === 'inbox' ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                >
                    Inbox ({inbox.length})
                </button>
                {submittedUrl && (
                    <button
                        onClick={() => setTab('submitted')}
                        className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all ${tab === 'submitted' ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                    >
                        Submitted by me ({submitted.length})
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-4">
                {loading ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
                ) : activeList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 py-12">
                        <span className="text-4xl">✅</span>
                        <p className="text-sm text-muted-foreground font-semibold">
                            {tab === 'inbox' ? 'No pending reports.' : 'You have not submitted any reports.'}
                        </p>
                    </div>
                ) : (
                    activeList.map(report => (
                        <ReportRow key={report.id} report={report} reviewUrlBase={reviewUrlBase} studentHrefBase={studentHrefBase} onReviewed={load} />
                    ))
                )}
            </div>
        </div>
    );
}
