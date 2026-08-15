'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    FileText, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar, Timer, BarChart2, Layers,
    Upload, CheckCircle2, AlertCircle, RefreshCw, BookOpen, ClipboardList, Radio, ShieldAlert,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

type StudentStatus = 'LIVE' | 'UPCOMING' | 'DONE';
type AssignmentStatus = 'PENDING' | 'SUBMITTED' | 'WRITE_AGAIN' | 'CORRECT' | 'MISSED' | 'OVERDUE';
type Tab = 'tests' | 'assignments';

interface StudentTest {
    id: string;
    title: string;
    description: string | null;
    subjectName: string;
    durationMinutes: number;
    totalMarks: number;
    numberOfQuestions: number;
    maxAttempts: number;
    startDate: string | null;
    validUntil: string | null;
    daysLeft: number | null;
    studentStatus: StudentStatus;
    attemptsUsed: number;
    bestScore: number | null;
    bestPercentage: number | null;
    lastAttemptId: string | null;
    lastAttemptStartTime: string | null;
    lastAttemptEndTime: string | null;
    lastAttemptMalpracticeFlag: boolean;
    attempts: { id: string; attemptNumber: number; totalScore: number; maxScore: number; percentage: number; startTime: string | null; endTime: string | null; malpracticeFlag: boolean }[];
}

interface StudentAssignment {
    id: string;
    title: string;
    description: string | null;
    subjectName: string;
    totalMarks: number;
    dueDate: string | null;
    daysLeft: number | null;
    submissionType: 'OFFLINE' | 'ONLINE';
    studentStatus: AssignmentStatus;
    submission: {
        id: string;
        fileUrl: string | null;
        submittedAt: string | null;
        resubmitCount: number;
        reviewStatus: string | null;
        reviewNote: string | null;
        reviewedAt: string | null;
        offlineSubmittedAt: string | null;
    } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_STATUS_META: Record<StudentStatus, { label: string; emoji: string; textColor: string; bgColor: string }> = {
    LIVE: { label: 'Live Now', emoji: '🔴', textColor: 'text-red-500', bgColor: 'bg-red-500/10' },
    UPCOMING: { label: 'Upcoming', emoji: '⏰', textColor: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    DONE: { label: 'Completed', emoji: '✅', textColor: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
};

const ASSIGNMENT_STATUS_META: Record<AssignmentStatus, { label: string; textColor: string; bgColor: string }> = {
    PENDING:    { label: 'Pending',     textColor: 'text-orange-500',  bgColor: 'bg-orange-500/10' },
    SUBMITTED:  { label: 'Submitted',   textColor: 'text-blue-500',    bgColor: 'bg-blue-500/10' },
    WRITE_AGAIN:{ label: 'Write Again', textColor: 'text-red-500',     bgColor: 'bg-red-500/10' },
    CORRECT:    { label: 'Correct ✓',   textColor: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    MISSED:     { label: 'Missed',      textColor: 'text-red-400',     bgColor: 'bg-red-400/10' },
    OVERDUE:    { label: 'Overdue',     textColor: 'text-red-500',     bgColor: 'bg-red-500/10' },
};

const TEST_FILTERS: { key: 'ALL' | StudentStatus | 'MISSED'; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'LIVE', label: '🔴 Live' },
    { key: 'UPCOMING', label: '⏰ Upcoming' },
    { key: 'DONE', label: '✅ Done' },
    { key: 'MISSED', label: '❌ Missed' },
];

const ASSIGNMENT_FILTERS: { key: 'ALL' | AssignmentStatus; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'WRITE_AGAIN', label: 'Write Again' },
    { key: 'CORRECT', label: 'Correct' },
    { key: 'MISSED', label: 'Missed' },
];

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function DaysLeftBadge({ daysLeft }: { daysLeft: number }) {
    const isOverdue = daysLeft < 0;
    return (
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-500/20 text-red-500' : 'bg-muted text-muted-foreground'}`}>
            {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
        </span>
    );
}

// ── Test Card ─────────────────────────────────────────────────────────────────

function TestCard({ test }: { test: StudentTest }) {
    const [expanded, setExpanded] = useState(false);
    // Which attempt's result the View Result button currently points to —
    // defaults to the best-scoring attempt (matches the "highest counts"
    // scoring rule), but the chevrons let the student flip to any other
    // attempt's result right from the card.
    const [viewedIdx, setViewedIdx] = useState(() => {
        if (test.attempts.length === 0) return -1;
        let bestI = 0;
        for (let i = 1; i < test.attempts.length; i++) {
            if (test.attempts[i].totalScore > test.attempts[bestI].totalScore) bestI = i;
        }
        return bestI;
    });
    const router = useRouter();
    const missed = test.studentStatus === 'DONE' && test.attemptsUsed === 0;
    const meta = missed
        ? { label: 'Missed', emoji: '❌', textColor: 'text-red-500', bgColor: 'bg-red-500/10' }
        : TEST_STATUS_META[test.studentStatus];

    const syllabusLines = (test.description ?? '')
        .split('\n').map((l) => l.trim()).filter(Boolean);

    // A bare date/time chip with no label left students guessing whether it was
    // the start or end time — show both whenever both exist, each clearly labeled.
    const startLabel = test.studentStatus === 'UPCOMING' ? 'Starts' : 'Started';
    const endLabel = test.studentStatus === 'DONE' ? 'Ended' : 'Ends';
    const durationLabel = test.durationMinutes >= 60
        ? `${Math.floor(test.durationMinutes / 60)}hr${test.durationMinutes % 60 ? ` ${test.durationMinutes % 60}mins` : ''}`
        : `${test.durationMinutes}mins`;

    function handleStart() {
        router.push(`/student/tasks/tests/${test.id}`);
    }
    const viewedAttempt = test.attempts[viewedIdx] ?? test.attempts[test.attempts.length - 1] ?? null;
    function handleViewResult() {
        const id = viewedAttempt?.id ?? test.lastAttemptId;
        if (id) router.push(`/student/tasks/tests/${test.id}/result/${id}`);
    }
    // A test can be LIVE with attempts already used up to (but not reaching)
    // maxAttempts — e.g. attempt 1/2 done, attempt 2 still available. Previously
    // that state only ever showed "Start Test Now" and the already-taken
    // attempt's result was unreachable from the card. Now both buttons can
    // show together: View Result for whatever's been attempted so far, and
    // Start Test Now for the next attempt if one remains.
    const canStartAnother = test.studentStatus === 'LIVE' && test.attemptsUsed < test.maxAttempts;

    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: test.studentStatus === 'LIVE' ? '#ef44441a' : test.studentStatus === 'UPCOMING' ? '#f59e0b1a' : missed ? '#ef44441a' : '#22c55e1a' }}>
                        <FileText size={20} className={test.studentStatus === 'LIVE' ? 'text-red-400' : test.studentStatus === 'UPCOMING' ? 'text-amber-500' : missed ? 'text-red-400' : 'text-emerald-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold leading-snug">{test.title}</h2>
                        <p className="text-xs text-muted-foreground">{test.subjectName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${meta.bgColor} ${meta.textColor}`}>
                            {meta.emoji} {meta.label}
                        </span>
                        {viewedAttempt ? (
                            <span className="text-xs font-semibold text-foreground">
                                Score: {viewedAttempt.totalScore}/{test.totalMarks} ({viewedAttempt.percentage}%)
                            </span>
                        ) : test.bestScore !== null && (
                            <span className="text-xs font-semibold text-foreground">
                                Score: {test.bestScore}/{test.totalMarks}
                                {test.bestPercentage !== null && ` (${test.bestPercentage}%)`}
                            </span>
                        )}
                        {missed && (
                            <span className="text-xs font-semibold text-foreground">
                                Score: 0/{test.totalMarks} (0%)
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                    {test.startDate && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                            <Calendar size={10} />
                            <span className="font-semibold text-foreground/70">{startLabel}:</span>
                            {formatDate(test.startDate)}, {formatTime(test.startDate)}
                        </span>
                    )}
                    {test.validUntil && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                            <Calendar size={10} />
                            <span className="font-semibold text-foreground/70">{endLabel}:</span>
                            {formatDate(test.validUntil)}, {formatTime(test.validUntil)}
                        </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                        <Timer size={10} /> {durationLabel}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                        <BarChart2 size={10} /> {test.totalMarks} marks
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                        <Layers size={10} /> {test.numberOfQuestions} Ques
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                        Attempt {viewedAttempt?.attemptNumber ?? test.attemptsUsed}/{test.maxAttempts}
                    </span>
                    {(viewedAttempt?.startTime ?? test.lastAttemptStartTime) && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-1 rounded-lg whitespace-nowrap" style={{ background: 'rgba(192,96,64,0.12)' }}>
                            <Calendar size={10} />
                            <span className="font-semibold text-foreground/70">Given at :</span>
                            {formatDate((viewedAttempt?.startTime ?? test.lastAttemptStartTime)!)}, {formatTime((viewedAttempt?.startTime ?? test.lastAttemptStartTime)!)}
                        </span>
                    )}
                    {(viewedAttempt?.endTime ?? test.lastAttemptEndTime) && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-1 rounded-lg whitespace-nowrap" style={{ background: 'rgba(192,96,64,0.12)' }}>
                            <Calendar size={10} />
                            <span className="font-semibold text-foreground/70">Submitted at :</span>
                            {formatDate((viewedAttempt?.endTime ?? test.lastAttemptEndTime)!)}, {formatTime((viewedAttempt?.endTime ?? test.lastAttemptEndTime)!)}
                        </span>
                    )}
                    {(viewedAttempt ? viewedAttempt.malpracticeFlag : test.lastAttemptMalpracticeFlag) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                            <ShieldAlert size={10} /> Flagged for malpractice
                        </span>
                    )}
                </div>

                {expanded && syllabusLines.length > 0 && (
                    <div className="mt-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Syllabus</p>
                        <ul className="space-y-1">
                            {syllabusLines.map((line, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                    {line}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {test.lastAttemptId && (
                    <div className="mt-3 flex items-center gap-1.5">
                        {test.attempts.length > 1 && (
                            <button
                                onClick={() => setViewedIdx((i) => Math.max(0, i - 1))}
                                disabled={viewedIdx <= 0}
                                className="w-9 h-9 shrink-0 rounded-xl border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted/50 active:scale-[0.98] transition-all"
                                aria-label="Previous attempt"
                            >
                                <ChevronLeft size={15} />
                            </button>
                        )}
                        <button onClick={handleViewResult}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted/50 active:scale-[0.98] transition-all">
                            View Result{test.attempts.length > 1 && viewedAttempt ? ` (Attempt ${viewedAttempt.attemptNumber}/${test.maxAttempts})` : ''}
                        </button>
                        {test.attempts.length > 1 && (
                            <button
                                onClick={() => setViewedIdx((i) => Math.min(test.attempts.length - 1, i + 1))}
                                disabled={viewedIdx >= test.attempts.length - 1}
                                className="w-9 h-9 shrink-0 rounded-xl border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted/50 active:scale-[0.98] transition-all"
                                aria-label="Next attempt"
                            >
                                <ChevronRight size={15} />
                            </button>
                        )}
                    </div>
                )}
                {canStartAnother && (
                    <button onClick={handleStart}
                        className={`${test.lastAttemptId ? 'mt-2' : 'mt-3'} w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2`}>
                        <Radio size={15} />
                        Start Test Now
                        {test.attemptsUsed > 0 && ` (Attempt ${test.attemptsUsed + 1}/${test.maxAttempts})`}
                    </button>
                )}
            </div>
            {syllabusLines.length > 0 && (
                <button onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-center gap-1 py-2 border-t border-border text-[11px] text-muted-foreground hover:bg-muted/30 transition-colors">
                    {expanded ? <><ChevronUp size={12} /> Hide syllabus/instructions</> : <><ChevronDown size={12} /> View syllabus/instructions</>}
                </button>
            )}
        </div>
    );
}

// ── Assignment Card ───────────────────────────────────────────────────────────

function AssignmentCard({ assignment, onSubmitted }: { assignment: StudentAssignment; onSubmitted: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const meta = ASSIGNMENT_STATUS_META[assignment.studentStatus];

    const descLines = (assignment.description ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast.error('Only PDF files are accepted');
            return;
        }
        if (file.size > 25 * 1024 * 1024) {
            toast.error('File must be under 25 MB');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            await api.post(`/student/tasks/assignments/${assignment.id}/submit`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Assignment submitted successfully!');
            onSubmitted();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to submit assignment';
            toast.error(msg);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    const canSubmitOnline = assignment.submissionType === 'ONLINE' &&
        ['PENDING', 'WRITE_AGAIN'].includes(assignment.studentStatus);

    const statusIcon = {
        CORRECT: <CheckCircle2 size={14} className="text-emerald-500" />,
        SUBMITTED: <CheckCircle2 size={14} className="text-blue-500" />,
        WRITE_AGAIN: <RefreshCw size={14} className="text-red-500" />,
        MISSED: <AlertCircle size={14} className="text-red-400" />,
        OVERDUE: <AlertCircle size={14} className="text-red-500" />,
        PENDING: null,
    }[assignment.studentStatus];

    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/10">
                        <BookOpen size={20} className="text-violet-500" />
                    </div>

                    {/* Title + subject */}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold leading-snug">{assignment.title}</h2>
                        <p className="text-xs text-muted-foreground">{assignment.subjectName}</p>
                    </div>

                    {/* Status badge */}
                    <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${meta.bgColor} ${meta.textColor}`}>
                        {statusIcon}
                        {meta.label}
                    </span>
                </div>

                {/* Chips row */}
                <div className="flex flex-wrap gap-2 mt-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        assignment.submissionType === 'ONLINE' ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'
                    }`}>
                        {assignment.submissionType === 'ONLINE' ? '📤 Online' : '📝 Offline'}
                    </span>
                    {assignment.dueDate && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                            <Calendar size={10} /> Due {formatDate(assignment.dueDate)}
                        </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                        <BarChart2 size={10} /> {assignment.totalMarks} marks
                    </span>
                    {assignment.daysLeft !== null && !['CORRECT', 'SUBMITTED', 'MISSED'].includes(assignment.studentStatus) && (
                        <DaysLeftBadge daysLeft={assignment.daysLeft} />
                    )}
                </div>

                {/* Expandable section */}
                {expanded && (
                    <div className="mt-3 space-y-2">
                        {descLines.length > 0 && (
                            <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description</p>
                                <ul className="space-y-1">
                                    {descLines.map((line, i) => (
                                        <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                            {line}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Write Again note */}
                        {assignment.studentStatus === 'WRITE_AGAIN' && assignment.submission?.reviewNote && (
                            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">Teacher Feedback</p>
                                <p className="text-xs text-foreground">{assignment.submission.reviewNote}</p>
                            </div>
                        )}

                        {/* Submission info */}
                        {assignment.submission?.submittedAt && (
                            <div className="rounded-xl bg-muted/40 p-3">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Online Submission</p>
                                <p className="text-xs text-foreground">
                                    Submitted {new Date(assignment.submission.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                    {assignment.submission.resubmitCount > 0 && ` · Resubmission #${assignment.submission.resubmitCount}`}
                                </p>
                                {assignment.submission.fileUrl && (
                                    <a href={assignment.submission.fileUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-xs text-primary underline underline-offset-2 mt-1 inline-block">
                                        View submitted PDF
                                    </a>
                                )}
                            </div>
                        )}

                        {assignment.submission?.offlineSubmittedAt && (
                            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Offline Copy</p>
                                <p className="text-xs text-foreground">
                                    Marked received on {formatDate(assignment.submission.offlineSubmittedAt)}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Action: submit PDF */}
                {canSubmitOnline && (
                    <>
                        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                            {uploading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Uploading…
                                </>
                            ) : (
                                <>
                                    <Upload size={15} />
                                    {assignment.studentStatus === 'WRITE_AGAIN' ? 'Resubmit PDF' : 'Submit PDF'}
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-muted-foreground text-center mt-1">PDF only · max 25 MB</p>
                    </>
                )}

                {assignment.studentStatus === 'CORRECT' && (
                    <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/10">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Assignment marked correct</span>
                    </div>
                )}
            </div>

            <button onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 py-2 border-t border-border text-[11px] text-muted-foreground hover:bg-muted/30 transition-colors">
                {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
            </button>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentTasksPage() {
    const [tab, setTab] = useState<Tab>('tests');
    const [testsLoading, setTestsLoading] = useState(true);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [tests, setTests] = useState<StudentTest[]>([]);
    const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
    const [testFilter, setTestFilter] = useState<'ALL' | StudentStatus | 'MISSED'>('ALL');
    const [aFilter, setAFilter] = useState<'ALL' | AssignmentStatus>('ALL');
    const assignmentsFetched = useRef(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/student/tasks/tests');
                if (!cancelled) setTests(res.data.data as StudentTest[]);
            } catch {
                if (!cancelled) toast.error('Failed to load tests');
            } finally {
                if (!cancelled) setTestsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    async function loadAssignments() {
        setAssignmentsLoading(true);
        try {
            const res = await api.get('/student/tasks/assignments');
            setAssignments(res.data.data as StudentAssignment[]);
            assignmentsFetched.current = true;
        } catch {
            toast.error('Failed to load assignments');
        } finally {
            setAssignmentsLoading(false);
        }
    }

    function handleTabChange(t: Tab) {
        setTab(t);
        if (t === 'assignments' && !assignmentsFetched.current) {
            loadAssignments();
        }
    }

    const filteredTests = testFilter === 'ALL'
        ? tests
        : testFilter === 'MISSED'
            ? tests.filter((t) => t.studentStatus === 'DONE' && t.attemptsUsed === 0)
            : tests.filter((t) => t.studentStatus === testFilter);
    const filteredAssignments = aFilter === 'ALL' ? assignments : assignments.filter((a) => a.studentStatus === aFilter);

    const testCounts = {
        LIVE: tests.filter((t) => t.studentStatus === 'LIVE').length,
        UPCOMING: tests.filter((t) => t.studentStatus === 'UPCOMING').length,
        DONE: tests.filter((t) => t.studentStatus === 'DONE').length,
    };
    const pendingCount = assignments.filter((a) => a.studentStatus === 'PENDING' || a.studentStatus === 'WRITE_AGAIN').length;

    return (
        <div className="max-w-2xl mx-auto px-3 pb-10">
            {/* Sticky header: summary strip + tab bar + filter chips stay pinned while
                the cards below scroll underneath (scroll container is the layout's
                <main>, so `sticky top-0` here pins relative to that). */}
            <div className="sticky top-0 z-10 bg-background pt-1 pb-2">
                {/* Summary strip — only meaningful for the Tests tab. Rendered even while
                    testsLoading (just showing 0s) instead of being skipped entirely, so
                    the tab bar below doesn't render at the top first and then jump down
                    once loading finishes — that was the visible "flash" on refresh. */}
                {tab === 'tests' && (
                    <div className="flex gap-2 mb-3 overflow-x-auto">
                        <div className="flex-1 min-w-[90px] rounded-2xl border border-border bg-card p-3 flex flex-col items-center gap-1">
                            <span className="text-xl font-bold text-red-500">{testCounts.LIVE}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">Live</span>
                        </div>
                        <div className="flex-1 min-w-[90px] rounded-2xl border border-border bg-card p-3 flex flex-col items-center gap-1">
                            <span className="text-xl font-bold text-orange-500">{testCounts.UPCOMING}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">Upcoming</span>
                        </div>
                        <div className="flex-1 min-w-[90px] rounded-2xl border border-border bg-card p-3 flex flex-col items-center gap-1">
                            <span className="text-xl font-bold text-emerald-500">{testCounts.DONE}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">Done</span>
                        </div>
                    </div>
                )}

                {/* Tab bar — same pill/active-indicator style as the main nav (Overview/Feed/Tasks) */}
                <div className="flex gap-1 mb-2 bg-muted/50 rounded-4xl p-0.5 border border-border/30">
                    <button onClick={() => handleTabChange('tests')} className="relative flex-1">
                        {tab === 'tests' && (
                            <motion.div layoutId="studentTasksActiveTab" className="absolute inset-0 bg-primary rounded-4xl"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                        )}
                        <div className={`relative z-10 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-4xl transition-colors ${
                            tab === 'tests' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                        }`}>
                            📝 Tests & Exams
                            {testCounts.LIVE > 0 && (
                                <span className="w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    {testCounts.LIVE}
                                </span>
                            )}
                        </div>
                    </button>
                    <button onClick={() => handleTabChange('assignments')} className="relative flex-1">
                        {tab === 'assignments' && (
                            <motion.div layoutId="studentTasksActiveTab" className="absolute inset-0 bg-primary rounded-4xl"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                        )}
                        <div className={`relative z-10 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-4xl transition-colors ${
                            tab === 'assignments' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                        }`}>
                            📤 Submissions
                            {pendingCount > 0 && (
                                <span className="w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    {pendingCount}
                                </span>
                            )}
                        </div>
                    </button>
                </div>

                {/* Filter chips — swap with the active tab, not gated on loading so the
                    sticky header's height stays stable while the list below loads */}
                {tab === 'tests' ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {TEST_FILTERS.map((f) => (
                            <button key={f.key} onClick={() => setTestFilter(f.key)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0 transition-all ${
                                    testFilter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
                                }`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {ASSIGNMENT_FILTERS.map((f) => (
                            <button key={f.key} onClick={() => setAFilter(f.key)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0 transition-all ${
                                    aFilter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
                                }`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Tests Tab ─────────────────────────────────────────────── */}
            {tab === 'tests' && (
                testsLoading ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading tests…</div>
                ) : filteredTests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                        <FileText size={40} className="text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No tests here yet.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredTests.map((t) => <TestCard key={t.id} test={t} />)}
                    </div>
                )
            )}

            {/* ── Assignments Tab ───────────────────────────────────────── */}
            {tab === 'assignments' && (
                assignmentsLoading ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading assignments…</div>
                ) : filteredAssignments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                        <ClipboardList size={40} className="text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No assignments here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredAssignments.map((a) => (
                            <AssignmentCard key={a.id} assignment={a} onSubmitted={loadAssignments} />
                        ))}
                    </div>
                )
            )}
        </div>
    );
}
