'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, MinusCircle, ShieldAlert, Timer, Layers, Calendar, ArrowLeft, Award } from 'lucide-react';
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
    test: { title: string; totalMarks: number; durationMinutes?: number; maxAttempts?: number };
    answers: AttemptAnswer[];
}

export default function TestResultPage() {
    const router = useRouter();
    const params = useParams();
    const attemptId = params.attemptId as string;

    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<AttemptResult | null>(null);

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

    return (
        <div className="max-w-2xl mx-auto px-2 pb-10">
            <div className="sticky top-0 z-10 bg-background pt-2 pb-1">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => router.replace('/student/tasks')} className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0">
                        <ArrowLeft size={15} className="text-foreground" />
                    </button>
                    <p className="text-xl font-bold flex items-center gap-2"><Award size={21} /> Results</p>
                </div>
                <div className="relative rounded-2xl border border-border bg-card p-4">
                    <div className="absolute top-3 right-4 flex flex-col items-end gap-1">
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
                        {result.endTime && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-1 rounded-lg whitespace-nowrap" style={{ background: 'rgba(192,96,64,0.12)' }}>
                                <Calendar size={10} />
                                <span className="font-semibold text-foreground/70">Given at :</span>
                                {new Date(result.endTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {new Date(result.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 pr-24">
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
                    <div className="flex items-center gap-2 mt-3">
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

            <button onClick={() => router.replace('/student/tasks')}
                className="w-full mt-5 py-2.5 rounded-xl text-sm font-semibold border border-border">
                Back to Tests
            </button>
        </div>
    );
}
