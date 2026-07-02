'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Clock, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';

interface StartQuestion {
    questionId: string;
    questionText: string;
    options: string[];
    type: 'MCQ' | 'FILL_BLANK' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'NUMERICAL' | 'CONCEPTUAL';
}

interface StartResponse {
    attemptId: string;
    attemptNumber: number;
    testTitle: string;
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

    // Start the attempt — check status first.
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
                    toast.warning('⚠️ Warning: Leaving the test tab has been recorded. One more time will auto-submit your exam.', { duration: 6000 });
                } else {
                    // Second strike — auto-submit and flag
                    toast.error('🚨 Malpractice detected. Your exam is being submitted automatically.', { duration: 4000 });
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

    // Block copy/paste/cut across the entire exam
    const preventCopy = (e: React.ClipboardEvent) => {
        e.preventDefault();
        toast.warning('Copying and pasting is not allowed during the exam.', { id: 'no-copy' });
    };

    return (
        <div className="max-w-2xl mx-auto px-2 pb-10" onCopy={preventCopy} onPaste={preventCopy} onCut={preventCopy}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background py-2 z-10">
                <h1 className="text-sm font-bold truncate">{session.testTitle}</h1>
                <div className="flex items-center gap-2">
                    {malpracticeWarned && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-1 rounded-full">
                            <ShieldAlert size={11} /> 1 warning
                        </span>
                    )}
                    <span className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full ${secondsLeft < 60 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-muted text-foreground'}`}>
                        <Clock size={14} /> {mins}:{secs.toString().padStart(2, '0')}
                    </span>
                </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-muted rounded-full mb-3">
                <div className="h-1 bg-primary rounded-full transition-all" style={{ width: `${((index + 1) / session.questions.length) * 100}%` }} />
            </div>

            <p className="text-xs text-muted-foreground mb-2">Question {index + 1} of {session.questions.length}</p>
            <div className="rounded-2xl border border-border bg-card p-5 mb-4">
                <p className="text-sm font-medium leading-relaxed mb-4">{q.questionText}</p>

                {(q.type === 'MCQ' || q.type === 'CONCEPTUAL' || q.type === 'NUMERICAL') && (
                    <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                            <button key={oi} onClick={() => setAnswers((a) => ({ ...a, [q.questionId]: opt }))}
                                className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                                    answers[q.questionId] === opt ? 'border-primary bg-primary/10 font-semibold' : 'border-border bg-background'
                                }`}>
                                {String.fromCharCode(65 + oi)}) {opt}
                            </button>
                        ))}
                    </div>
                )}

                {q.type === 'TRUE_FALSE' && (
                    <div className="grid grid-cols-2 gap-2">
                        {['true', 'false'].map((v) => (
                            <button key={v} onClick={() => setAnswers((a) => ({ ...a, [q.questionId]: v }))}
                                className={`py-2.5 rounded-xl border text-sm font-semibold capitalize transition-all ${
                                    answers[q.questionId] === v ? 'border-primary bg-primary/10' : 'border-border bg-background'
                                }`}>
                                {v}
                            </button>
                        ))}
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

            <div className="flex items-center gap-2">
                <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-40">
                    <ChevronLeft size={14} /> Prev
                </button>
                {isLast ? (
                    <button onClick={() => doSubmit(false)} disabled={submitting}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 disabled:opacity-50">
                        {submitting ? 'Submitting…' : 'Submit Test'}
                    </button>
                ) : (
                    <button onClick={() => setIndex((i) => Math.min(session.questions.length - 1, i + 1))}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-semibold text-white bg-primary">
                        Next <ChevronRight size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}
