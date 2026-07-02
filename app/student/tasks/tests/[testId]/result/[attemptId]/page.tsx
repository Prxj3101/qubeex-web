'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import api from '@/lib/api';

interface AttemptAnswer {
    questionId: string;
    generatedQuestion: string;
    generatedOptions: string[] | null;
    studentAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
}

interface AttemptResult {
    id: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    test: { title: string; totalMarks: number };
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

    return (
        <div className="max-w-2xl mx-auto px-2 pb-10">
            <div className="rounded-2xl border border-border bg-card p-5 mb-5 text-center">
                <p className="text-xs text-muted-foreground mb-1">{result.test.title}</p>
                <div className="text-3xl font-bold">{result.totalScore}/{result.maxScore}</div>
                <div className="text-sm text-muted-foreground">{result.percentage}%</div>
            </div>

            <div className="space-y-3">
                {result.answers.map((a, i) => (
                    <div key={a.questionId} className="rounded-2xl border border-border bg-card p-4">
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
                ))}
            </div>

            <button onClick={() => router.replace('/student/tasks')}
                className="w-full mt-5 py-2.5 rounded-xl text-sm font-semibold border border-border">
                Back to Tests
            </button>
        </div>
    );
}
