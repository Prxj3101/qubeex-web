'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Clock, ShieldAlert, Check, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

interface StartQuestion {
    questionId: string;
    questionText: string;
    options: string[];
    type: 'MCQ' | 'FILL_BLANK' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'NUMERICAL' | 'CONCEPTUAL';
    sectionId?: string | null;
    sectionTitle?: string | null;
    sectionInstruction?: string | null;
    images?: string[] | null;
}

interface StartResponse {
    attemptId: string;
    attemptNumber: number;
    testTitle: string;
    subjectName: string;
    durationMinutes: number;
    totalMarks: number;
    startTime: string;
    questions: StartQuestion[];
}

function getApiToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
}

function getApiBase(): string {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
}

export default function TakeTestPage() {
    const router = useRouter();
    const params = useParams();
    const testId = params.testId as string;

    const [loading, setLoading] = useState(true);
    const [blocked, setBlocked] = useState<'done' | 'upcoming' | null>(null);
    const [session, setSession] = useState<StartResponse | null>(null);
    const [index, setIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [malpracticeWarned, setMalpracticeWarned] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);

    const answersRef = useRef(answers);
    answersRef.current = answers;
    const tabChangeCountRef = useRef(0);
    const submittedRef = useRef(false);
    const sessionRef = useRef<StartResponse | null>(null);
    sessionRef.current = session;
    const malpracticeWarnedRef = useRef(false);
    malpracticeWarnedRef.current = malpracticeWarned;

    const doSubmit = useCallback(async (useKeepalive: boolean) => {
        if (submittedRef.current || !sessionRef.current) return;
        submittedRef.current = true;
        const s = sessionRef.current;
        const payload = {
            attemptId: s.attemptId,
            answers: Object.entries(answersRef.current).map(([questionId, answer]) => ({ questionId, answer })),
            tabChangeCount: tabChangeCountRef.current,
        };

        if (useKeepalive) {
            const token = getApiToken();
            fetch(`${getApiBase()}/student/tasks/tests/${testId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload),
                keepalive: true,
            }).catch(() => {});
            return;
        }

        try {
            setSubmitting(true);
            const res = await api.post(`/student/tasks/tests/${testId}/submit`, payload);
            router.replace(`/student/tasks/tests/${testId}/result/${res.data.data.attemptId}`);
        } catch {
            toast.error('Failed to submit test');
            submittedRef.current = false;
            setSubmitting(false);
        }
    }, [testId, router]);

    // Start the attempt — check status first. The backend's /start is idempotent
    // (it resumes an existing in-progress attempt instead of creating a new one),
    // so it's safe for this effect to fire more than once — no need to guard
    // against that here. A ref-based guard was tried before, but it broke the
    // legitimate "cancelled" cleanup/retry cycle React does on remount, leaving
    // the page stuck on "Loading test…" forever even after a valid response.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const listRes = await api.get('/student/tasks/tests');
                const thisTest = (listRes.data.data as Array<{ id: string; studentStatus: string; lastAttemptId?: string }>).find((t) => t.id === testId);
                if (thisTest?.studentStatus === 'DONE') {
                    setBlocked('done');
                    setLoading(false);
                    return;
                }
                if (thisTest?.studentStatus === 'UPCOMING') {
                    setBlocked('upcoming');
                    setLoading(false);
                    return;
                }

                const res = await api.post(`/student/tasks/tests/${testId}/start`);
                if (cancelled) return;
                const data = res.data.data as StartResponse;
                setSession(data);
                const deadline = new Date(data.startTime).getTime() + data.durationMinutes * 60 * 1000;
                setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
            } catch (err: unknown) {
                const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not start test';
                toast.error(msg);
                router.replace('/student/tasks');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [testId, router]);

    // Countdown timer — auto-submit at zero.
    useEffect(() => {
        if (!session) return;
        if (secondsLeft <= 0) { doSubmit(false); return; }
        const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [session, secondsLeft, doSubmit]);

    // 2-strike malpractice: 1st tab change = warning, 2nd = auto-submit flagged.
    useEffect(() => {
        if (!session) return;
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                tabChangeCountRef.current += 1;
                if (!malpracticeWarnedRef.current) {
                    // First strike
                    setMalpracticeWarned(true);
                    toast.warning('⚠️ Warning: Leaving the test tab has been recorded. One more time will auto-submit your exam.', { duration: Infinity });
                } else {
                    // Second strike - auto-submit and flag
                    toast.error('🚨 Malpractice detected. Your exam is being submitted automatically.', { duration: Infinity });
                    doSubmit(false);
                }
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [session, doSubmit]);

    // Forced submit on hard unload (close tab / refresh).
    useEffect(() => {
        if (!session) return;
        const onBeforeUnload = () => { doSubmit(true); };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [session, doSubmit]);

    // Forced submit on browser/nav back button. Back is an in-app navigation
    // (no page reload), so beforeunload never fires for it — without this a
    // student could back out of a test without it counting as submitted.
    // A guard history entry is pushed so the first back press is caught here
    // instead of silently leaving the page; it's re-armed if submit fails.
    useEffect(() => {
        if (!session) return;
        window.history.pushState(null, '', window.location.href);
        const onPopState = () => {
            if (submittedRef.current) return;
            doSubmit(false).then(() => {
                if (!submittedRef.current) window.history.pushState(null, '', window.location.href);
            });
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [session, doSubmit]);

    // Bridge for the app's in-WebView back button. The RN shell's hardware
    // BackHandler intercepts the phone's back press before it ever becomes a
    // browser `popstate` event, so the guard above never fires when backing
    // out via the app — this exposes a callable hook the native side invokes
    // directly (via injectJavaScript) after the user confirms the "leave and
    // auto-submit" warning. Uses the keepalive submit path (same as
    // beforeunload) since the native screen tears down the WebView's JS
    // context right after calling this, same reasoning as a hard unload.
    useEffect(() => {
        if (!session) return;
        (window as unknown as { __qubeexAppExitSubmit?: () => void }).__qubeexAppExitSubmit = () => { doSubmit(true); };
        return () => { delete (window as unknown as { __qubeexAppExitSubmit?: () => void }).__qubeexAppExitSubmit; };
    }, [session, doSubmit]);

    if (loading) {
        return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading test…</div>;
    }

    if (blocked === 'done') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
                <p className="text-sm text-muted-foreground">You've already completed this test.</p>
                <button onClick={() => router.replace('/student/tasks')} className="text-sm font-semibold text-primary">Back to Tests</button>
            </div>
        );
    }
    if (blocked === 'upcoming') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
                <p className="text-sm text-muted-foreground">This test hasn't started yet.</p>
                <button onClick={() => router.replace('/student/tasks')} className="text-sm font-semibold text-primary">Back to Tests</button>
            </div>
        );
    }
    if (!session) return null;

    const q = session.questions[index];
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const isLast = index === session.questions.length - 1;
    const allAnswered = Object.keys(answers).length >= session.questions.length;
    // The progress bar treats every section as an equal-width slice (not
    // proportional to how many questions it has) - a 2-question Section B
    // gets the same visual width as a 6-question Section A, split 50/50.
    const segments: { start: number; length: number }[] = [];
    session.questions.forEach((sQ, i) => {
        if (i === 0 || sQ.sectionId !== session.questions[i - 1].sectionId) {
            segments.push({ start: i, length: 1 });
        } else {
            segments[segments.length - 1].length += 1;
        }
    });
    const segmentWidth = 100 / segments.length;
    const sectionBoundaries = segments.slice(1).map((_, i) => (i + 1) * segmentWidth);
    const currentSegIdx = segments.findIndex((seg) => index >= seg.start && index < seg.start + seg.length);
    const currentSeg = segments[currentSegIdx] ?? segments[0];
    const posInSeg = index - currentSeg.start;
    const progressPct = currentSegIdx * segmentWidth + (posInSeg / currentSeg.length) * segmentWidth;

    // Block copy/paste/cut across the entire exam
    const preventCopy = (e: React.ClipboardEvent) => {
        e.preventDefault();
        toast.warning('Copying and pasting is not allowed during the exam.', { id: 'no-copy' });
    };

    return (
        <div className="max-w-2xl mx-auto px-2 pb-10 min-h-full flex flex-col justify-center" onCopy={preventCopy} onPaste={preventCopy} onCut={preventCopy}>
            {/* Header */}
            <div className="w-full flex flex-col items-center justify-center mb-3 sticky top-0 bg-background py-2 z-10">
                <h1 className="text-3xl font-bold truncate text-center max-w-[70%] relative -top-1">{session.testTitle}</h1>
                <p className="text-sm text-muted-foreground -mt-1">{session.subjectName} · {session.totalMarks} marks</p>
            </div>

            <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm text-muted-foreground relative top-3">Question {index + 1} of {session.questions.length}</p>
                <div className="flex items-center gap-2">
                    {malpracticeWarned && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2.5 py-1.5 rounded-full">
                            <ShieldAlert size={12} /> 1 warning
                        </span>
                    )}
                    <span className={`flex items-center gap-1.5 text-base font-bold px-3.5 py-1.5 rounded-full ${secondsLeft < 60 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-white dark:bg-muted text-foreground'}`}>
                        <Clock size={16} /> {mins}:{secs.toString().padStart(2, '0')}
                    </span>
                </div>
            </div>

            {/* Progress bar */}
            <div className="relative w-full h-1 bg-muted rounded-full mb-3">
                <div className="h-1 rounded-full transition-all" style={{ width: `${progressPct}%`, background: 'linear-gradient(135deg,#E8876A,#C06040)' }} />
                {sectionBoundaries.map((pct, i) => (
                    <div key={i} className="absolute top-1/2 -translate-y-1/2 w-[4px] h-2.5 rounded-full bg-background"
                        style={{ left: `${pct}%` }} />
                ))}
            </div>

            {q.sectionTitle && (
                <div className="mb-4 pl-3 flex items-center justify-between gap-3" style={{ borderLeft: '3px solid #C06040' }}>
                    <p className="text-base">
                        <span className="font-bold text-foreground">{q.sectionTitle}{q.sectionInstruction && ' :'}</span>
                        {q.sectionInstruction && (
                            <span className="text-muted-foreground" style={{ fontSize: '15px' }}> {q.sectionInstruction}</span>
                        )}
                    </p>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        {session.questions.filter((sq) => sq.sectionId === q.sectionId).map((sq) => (
                            <span key={sq.questionId} className="w-3 h-3 rounded-full shrink-0" style={{
                                background: answers[sq.questionId] ? 'linear-gradient(135deg,#E8876A,#C06040)' : 'transparent',
                                border: '1.5px solid #C06040',
                            }} />
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5 mb-4 h-[300px] flex flex-col">
                <p className="text-base font-medium leading-relaxed mb-5">{index + 1}. {q.questionText}</p>

                <div className="flex-1 overflow-y-auto pr-2 visible-scrollbar" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.25) transparent' }}>
                {(q.images ?? []).length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                        {(q.images ?? []).map((url, ii) => (
                            <img key={ii} src={url} alt="" onClick={() => setExpandedImage(url)} className="max-w-[300px] max-h-[300px] w-auto h-auto rounded-lg object-contain border border-border cursor-zoom-in" />
                        ))}
                    </div>
                )}
                {(q.type === 'MCQ' || q.type === 'CONCEPTUAL' || q.type === 'NUMERICAL') && (
                    <div className="space-y-3">
                        {q.options.map((opt, oi) => {
                            const isSelected = answers[q.questionId] === opt;
                            return (
                                <div key={oi} className="w-full flex items-center gap-2">
                                    <button onClick={() => setAnswers((a) => ({ ...a, [q.questionId]: opt }))}
                                        className={`shrink-0 w-[18px] h-[18px] rounded-[4px] flex items-center justify-center text-white font-bold text-[11px] transition-all ${
                                        isSelected ? 'bg-[#DA7756]' : 'border-[1.5px] border-muted-foreground/40'
                                    }`}>
                                        {isSelected && '✓'}
                                    </button>
                                    <button onClick={() => setAnswers((a) => ({ ...a, [q.questionId]: opt }))}
                                        className={`flex-1 text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                                            isSelected ? 'border-[1.5px] border-[#C06040]' : 'border-border'
                                        }`}>
                                        <span className={isSelected ? 'font-semibold' : ''}>{String.fromCharCode(65 + oi)}) {opt}</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {q.type === 'TRUE_FALSE' && (
                    <div className="space-y-3">
                        {['true', 'false'].map((v, oi) => {
                            const isSelected = answers[q.questionId] === v;
                            return (
                                <div key={v} className="w-full flex items-center gap-2">
                                    <button onClick={() => setAnswers((a) => ({ ...a, [q.questionId]: v }))}
                                        className={`shrink-0 w-[18px] h-[18px] rounded-[4px] flex items-center justify-center text-white font-bold text-[11px] transition-all ${
                                        isSelected ? 'bg-[#DA7756]' : 'border-[1.5px] border-muted-foreground/40'
                                    }`}>
                                        {isSelected && '✓'}
                                    </button>
                                    <button onClick={() => setAnswers((a) => ({ ...a, [q.questionId]: v }))}
                                        className={`flex-1 text-left px-4 py-2.5 rounded-xl border text-sm capitalize transition-all ${
                                            isSelected ? 'border-[1.5px] border-[#C06040]' : 'border-border'
                                        }`}>
                                        <span className={isSelected ? 'font-semibold' : ''}>{String.fromCharCode(65 + oi)}) {v}</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {q.type === 'FILL_BLANK' && (
                    <input value={answers[q.questionId] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.questionId]: e.target.value }))}
                        placeholder="Your answer…"
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none" />
                )}

                {q.type === 'SHORT_ANSWER' && (
                    <textarea value={answers[q.questionId] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.questionId]: e.target.value }))}
                        rows={4} placeholder="Your answer…"
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none resize-none" />
                )}
                </div>
            </div>

            <div className="flex items-center justify-between gap-2">
                <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-40">
                    <ChevronLeft size={14} /> Prev
                </button>
                {isLast ? (
                    <button onClick={() => setShowSubmitConfirm(true)} disabled={submitting || !allAnswered}
                        title={!allAnswered ? `Answer all ${session.questions.length} questions to submit` : undefined}
                        className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed">
                        <CheckCircle2 size={14} /> {submitting ? 'Submitting…' : 'Submit Test'}
                    </button>
                ) : (
                    <button onClick={() => setIndex((i) => Math.min(session.questions.length - 1, i + 1))}
                        className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                        Next <ChevronRight size={14} />
                    </button>
                )}
            </div>

            {showSubmitConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5">
                        <h2 className="text-base font-bold mb-1">Submit test?</h2>
                        <p className="text-sm text-muted-foreground mb-1">
                            You've answered {Object.keys(answers).length} of {session.questions.length} questions.
                        </p>
                        {Object.keys(answers).length < session.questions.length && (
                            <p className="text-sm text-orange-600 dark:text-orange-400 mb-4">
                                {session.questions.length - Object.keys(answers).length} question(s) left unanswered. You won't be able to change answers after submitting.
                            </p>
                        )}
                        <div className="flex items-center gap-2 mt-4">
                            <button onClick={() => setShowSubmitConfirm(false)}
                                className="flex-1 py-2 rounded-xl border border-border text-sm font-medium">
                                Cancel
                            </button>
                            <button onClick={() => { setShowSubmitConfirm(false); doSubmit(false); }} disabled={submitting}
                                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 disabled:opacity-50">
                                <CheckCircle2 size={14} /> {submitting ? 'Submitting…' : 'Yes, Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {expandedImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4" onClick={() => setExpandedImage(null)}>
                    <img src={expandedImage} alt="" className="max-w-[92vw] max-h-[92vh] w-auto h-auto rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
                    <button onClick={() => setExpandedImage(null)} className="absolute top-5 right-5 text-white/90 text-2xl leading-none">✕</button>
                </div>
            )}
        </div>
    );
}
