'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, MinusCircle, ShieldAlert, Timer, Layers, Calendar, ArrowLeft, Award, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

// Same thresholds/colors as the marksheet's scoreColor() (student report card),
// so a score reads the same way everywhere on the platform.
function scoreColor(pct: number | null) {
    if (pct === null) return '#94A3B8';
    if (pct >= 75) return '#059669';
    if (pct >= 35) return '#F59E0B';
    return '#DC2626';
}

interface AttemptAnswer {
    questionId: string;
    generatedQuestion: string;
    generatedOptions: string[] | null;
    studentAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    sectionId?: string | null;
    sectionTitle?: string | null;
    sectionInstruction?: string | null;
}

interface AttemptResult {
    id: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    malpracticeFlag?: boolean;
    tabChangeCount?: number;
    attemptNumber?: number;
    startTime?: string;
    endTime?: string | null;
    student: { name: string; rollNo: string; studentId: string; className: string };
    test: { title: string; totalMarks: number; durationMinutes?: number; maxAttempts?: number; subjectName: string };
    attempts: { id: string; attemptNumber: number; totalScore: number; maxScore: number; percentage: number }[];
    answers: AttemptAnswer[];
}

export default function TestResultPage() {
    const router = useRouter();
    const params = useParams();
    const testId = params.testId as string;
    const attemptId = params.attemptId as string;

    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<AttemptResult | null>(null);
    const [downloading, setDownloading] = useState(false);

    // App WebView (narrow, no sm:): `position: sticky` doesn't reliably hold
    // inside a scrollable container on some mobile WebKit/WebView builds — it
    // detaches and scrolls away with the content once you scroll past a
    // section. `position: fixed` (relative to the viewport, not the scroll
    // container) always holds, so the header uses that on mobile instead.
    // A measured spacer of the same height keeps content from jumping under
    // it. Desktop (sm+) is untouched — still the original sticky block.
    const headerRef = useRef<HTMLDivElement>(null);
    const [headerHeight, setHeaderHeight] = useState(0);
    useEffect(() => {
        const el = headerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            setHeaderHeight(entries[0].contentRect.height);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [result]);

    // `fixed` pins to the viewport, not to the app shell's scroll area — so
    // without an offset it renders at y=0 and covers the Topbar above it.
    // Measure the actual top of the <main> scroll container (which already
    // accounts for the Topbar's height + the layout's padding/gap) and pin
    // the header just below it instead of at the true viewport top.
    const [topOffset, setTopOffset] = useState(0);
    useEffect(() => {
        const computeOffset = () => {
            const mainEl = headerRef.current?.closest('main');
            if (mainEl) setTopOffset(mainEl.getBoundingClientRect().top);
        };
        computeOffset();
        window.addEventListener('resize', computeOffset);
        return () => window.removeEventListener('resize', computeOffset);
    }, [result]);

    const handleDownloadPdf = async () => {
        setDownloading(true);
        try {
            const res = await api.get(`/student/tasks/attempts/${attemptId}/pdf`, { responseType: 'blob' });
            const blob = res.data as Blob;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Result_${result?.test.title ?? 'test'}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Download failed');
        } finally {
            setDownloading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get(`/student/tasks/attempts/${attemptId}`);
                if (!cancelled) setResult(res.data.data as AttemptResult);
            } catch {
                if (!cancelled) router.replace('/student/tasks');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [attemptId, router]);

    if (loading) {
        return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading result…</div>;
    }
    if (!result) return null;

    const correctCount = result.answers.filter((a) => a.isCorrect).length;
    const unansweredCount = result.answers.filter((a) => !a.studentAnswer).length;
    const incorrectCount = result.answers.length - correctCount - unansweredCount;

    // When a test allows multiple attempts, this same page is reachable once per
    // attempt (attempt 1's result, attempt 2's result, ...) — these let the
    // student flip between them instead of only ever seeing the one they landed on.
    const attemptIndex = result.attempts.findIndex((a) => a.id === attemptId);
    const prevAttempt = attemptIndex > 0 ? result.attempts[attemptIndex - 1] : null;
    const nextAttempt = attemptIndex >= 0 && attemptIndex < result.attempts.length - 1 ? result.attempts[attemptIndex + 1] : null;
    const goToAttempt = (id: string) => router.replace(`/student/tasks/tests/${testId}/result/${id}`);

    return (
        <div className="max-w-2xl mx-auto px-2 pb-10">
            <div className="sm:sticky sm:top-0 sm:z-10 sm:bg-background sm:pt-2 sm:pb-1">
                {/* App WebView (narrow, no sm:): `position: sticky` doesn't
                    reliably hold inside a scrollable container in some mobile
                    WebViews — it detaches and scrolls away. `fixed` always
                    holds (relative to the viewport), so the header uses that
                    on mobile, with a measured spacer below to keep content
                    from jumping under it. Desktop (sm+): back to normal flow
                    so it's part of the same sticky block as the card below,
                    unchanged from before. */}
                <div ref={headerRef} style={{ top: topOffset - 10 }} className="fixed left-0 right-0 z-20 bg-background px-2 pt-2 pb-1 sm:static sm:!top-auto sm:z-auto sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => router.replace('/student/tasks')} className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0">
                        <ArrowLeft size={15} className="text-foreground" />
                    </button>
                    <p className="text-xl font-bold flex items-center gap-2"><Award size={21} /> Results</p>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-1.5 mb-0.5 sm:mb-2">
                    <div className="flex items-center flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-card border border-border/50 px-2 py-1 rounded-lg">
                            Name : {result.student.name}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-card border border-border/50 px-2 py-1 rounded-lg">
                            Roll No. {result.student.rollNo.padStart(2, '0')}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-card border border-border/50 px-2 py-1 rounded-lg">
                            {result.student.className}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-card border border-border/50 px-2 py-1 rounded-lg">
                            {result.test.subjectName}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold bg-card border border-border/50 px-2 py-1 rounded-lg" style={{ color: '#DA7756' }}>
                            {result.student.studentId}
                        </span>
                    </div>
                    {result.attempts.length > 1 && (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground shrink-0">
                            <button
                                onClick={() => prevAttempt && goToAttempt(prevAttempt.id)}
                                disabled={!prevAttempt}
                                className="p-1 disabled:opacity-30 hover:opacity-70 enabled:cursor-pointer"
                                aria-label="Previous attempt"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="px-1">{attemptIndex + 1}/{result.attempts.length}</span>
                            <button
                                onClick={() => nextAttempt && goToAttempt(nextAttempt.id)}
                                disabled={!nextAttempt}
                                className="p-1 disabled:opacity-30 hover:opacity-70 enabled:cursor-pointer"
                                aria-label="Next attempt"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </span>
                    )}
                </div>
                </div>
                <div style={{ height: headerHeight + 6 }} className="sm:hidden" />
                <div className="relative flex flex-col rounded-2xl border border-border bg-card p-4">
                    {/* App WebView (narrow, no sm:): pills move below the
                        Correct/Incorrect/Skipped stats row, in flow.
                        Normal web browser (sm+): unchanged — pills sit
                        absolute top-right like before. */}
                    <div className="order-3 flex flex-wrap items-start gap-1 mt-3 sm:mt-0 sm:absolute sm:top-3 sm:right-4 sm:flex-col sm:items-end">
                        {result.test.durationMinutes != null && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                                <Timer size={10} /> {result.test.durationMinutes >= 60
                                    ? `${Math.floor(result.test.durationMinutes / 60)}hr${result.test.durationMinutes % 60 ? ` ${result.test.durationMinutes % 60}mins` : ''}`
                                    : `${result.test.durationMinutes}mins`}
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                            <Layers size={10} /> {result.answers.length} Ques
                        </span>
                        {result.attemptNumber != null && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                                Attempt {result.attemptNumber}{result.test.maxAttempts != null ? `/${result.test.maxAttempts}` : ''}
                            </span>
                        )}
                        {result.startTime && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-1 rounded-lg whitespace-nowrap" style={{ background: 'rgba(192,96,64,0.12)' }}>
                                <Calendar size={10} />
                                <span className="font-semibold text-foreground/70">Given at :</span>
                                {new Date(result.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {new Date(result.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                        )}
                        {result.endTime && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-1 rounded-lg whitespace-nowrap" style={{ background: 'rgba(192,96,64,0.12)' }}>
                                <Calendar size={10} />
                                <span className="font-semibold text-foreground/70">Submitted at :</span>
                                {new Date(result.endTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {new Date(result.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                        )}
                    </div>
                    <div className="order-1 flex items-center gap-4 sm:pr-24">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0" style={{ background: `conic-gradient(${scoreColor(result.percentage)} ${result.percentage * 3.6}deg, ${scoreColor(result.percentage)}1f 0deg)` }}>
                            <div className="w-[52px] h-[52px] rounded-full bg-card flex items-center justify-center">
                                <span className="text-sm font-bold">{result.percentage}%</span>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-2xl font-bold text-foreground truncate relative -top-[4px]">{result.test.title}</p>
                            <div className="text-2xl font-bold">{result.totalScore}<span className="text-sm text-muted-foreground font-normal">/{result.maxScore} marks</span></div>
                            {result.malpracticeFlag && (
                                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                                    <ShieldAlert size={10} /> Flagged for malpractice
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="order-2 flex items-center gap-2 mt-3">
                        <div className="rounded-xl bg-emerald-500/10 py-1.5 text-center w-20">
                            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-sm"><CheckCircle2 size={12} /> {correctCount}</div>
                            <p className="text-[10px] text-muted-foreground">Correct</p>
                        </div>
                        <div className="rounded-xl bg-red-500/10 py-1.5 text-center w-20">
                            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400 font-bold text-sm"><XCircle size={12} /> {incorrectCount}</div>
                            <p className="text-[10px] text-muted-foreground">Incorrect</p>
                        </div>
                        <div className="rounded-xl bg-muted py-1.5 text-center w-20">
                            <div className="flex items-center justify-center gap-1 text-muted-foreground font-bold text-sm"><MinusCircle size={12} /> {unansweredCount}</div>
                            <p className="text-[10px] text-muted-foreground">Skipped</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {result.answers.map((a, i) => (
                    <div key={a.questionId}>
                        {a.sectionTitle && (i === 0 || a.sectionId !== result.answers[i - 1].sectionId) && (
                            <div className="mb-2 pl-3 mt-1" style={{ borderLeft: '3px solid #C06040' }}>
                                <p className="text-sm">
                                    <span className="font-bold text-foreground">{a.sectionTitle}{a.sectionInstruction && ' :'}</span>
                                    {a.sectionInstruction && (
                                        <span className="text-muted-foreground text-xs"> {a.sectionInstruction}</span>
                                    )}
                                </p>
                            </div>
                        )}
                        <div className="rounded-2xl border border-border bg-card p-4">
                            <div className="flex items-start gap-2 mb-2">
                                {a.isCorrect ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" /> : <XCircle size={16} className="text-red-600 shrink-0 mt-0.5" />}
                                <p className="text-sm font-medium leading-relaxed">{i + 1}. {a.generatedQuestion}</p>
                            </div>
                            <div className="pl-6 space-y-1 text-xs">
                                <p className={a.isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
                                    Your answer: {a.studentAnswer || '—'}
                                </p>
                                {!a.isCorrect && (
                                    <p className="text-muted-foreground">Correct answer: {a.correctAnswer}</p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2 mt-5">
                <button onClick={() => router.replace('/student/tasks')}
                    className="w-1/2 py-2.5 rounded-xl text-sm font-semibold border border-border">
                    Back to Tests
                </button>
                <button onClick={handleDownloadPdf} disabled={downloading}
                    className="w-1/2 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                    <Download size={14} /> {downloading ? 'Downloading…' : 'Download Result PDF'}
                </button>
            </div>
        </div>
    );
}
