'use client';

import { useEffect, useState } from 'react';
import { Trophy, FileDown, GraduationCap } from 'lucide-react';
import api from '@/lib/api';

interface ExamColumnResult {
    id: string;
    name: string;
    maxMarks: number;
    score: number | null;
    isAbsent: boolean;
}
interface SubjectResult {
    id: string;
    name: string;
    code: string;
    columns: ExamColumnResult[];
    total: { scored: number; max: number };
    pct: number | null;
    grade: string;
}
interface GradedResult {
    id: string;
    name: string;
    term1Grade: string | null;
    term2Grade: string | null;
}
interface StudentMarksheet {
    academicYear: string;
    gradedSectionTitle: string;
    standardName: string;
    divisionName: string;
    student: { name: string; rollNo: string };
    subjects: SubjectResult[];
    grandTotal: { scored: number; max: number };
    grandPct: number | null;
    grade: string;
    gradedSubjects: GradedResult[];
    pdfUrl: string | null;
}

function gradeColor(grade: string): string {
    switch (grade) {
        case 'A': return '#16A34A';
        case 'B': return '#65A30D';
        case 'C': return '#CA8A04';
        case 'D': return '#EA580C';
        case 'F': return '#DC2626';
        default: return '#94A3B8';
    }
}

export default function StudentMarksheetPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<StudentMarksheet | null>(null);
    const [notPublished, setNotPublished] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/student/marksheet', { validateStatus: (s) => s === 200 || s === 404 });
                if (cancelled) return;
                if (res.status === 404) { setNotPublished(true); return; }
                setData(res.data.data as StudentMarksheet);
            } catch {
                if (!cancelled) setNotPublished(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading results…</div>;
    }

    if (notPublished || !data) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
                <GraduationCap size={48} className="text-muted-foreground/50" />
                <p className="text-base font-semibold">Results not published yet</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Your class teacher hasn&apos;t published the marksheet for this academic year. Check back later.
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-2 pb-10">
            {/* Header */}
            <div className="rounded-2xl border border-border bg-card p-5 mb-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-lg font-bold">{data.student.name}</h1>
                        <p className="text-sm text-muted-foreground">
                            {data.standardName} - {data.divisionName} · Roll {data.student.rollNo} · {data.academicYear}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-2xl font-bold" style={{ color: data.grandPct !== null ? gradeColor(data.grade) : '#94A3B8' }}>
                                {data.grandPct !== null ? `${data.grandPct}%` : '—'}
                            </div>
                            <div className="text-[11px] text-muted-foreground">Overall · Grade {data.grade}</div>
                        </div>
                        {data.pdfUrl && (
                            <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold text-white"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                <FileDown size={14} /> Class PDF
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Subjects */}
            <div className="space-y-3">
                {data.subjects.map((sub) => (
                    <div key={sub.id} className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">{sub.name}</span>
                                <span className="text-[11px] text-muted-foreground">({sub.code})</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{sub.total.scored}/{sub.total.max}</span>
                                <span className="text-sm font-bold" style={{ color: sub.pct !== null ? gradeColor(sub.grade) : '#94A3B8' }}>
                                    {sub.pct !== null ? `${sub.pct}%` : '—'}
                                </span>
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
                                    style={{ color: gradeColor(sub.grade), background: `${gradeColor(sub.grade)}1A` }}>
                                    {sub.grade}
                                </span>
                            </div>
                        </div>
                        {sub.columns.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">No exams recorded.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {sub.columns.map((c) => (
                                    <div key={c.id} className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-muted/50 min-w-[64px]">
                                        <span className="text-[10px] text-muted-foreground">{c.name}</span>
                                        <span className="text-sm font-semibold">
                                            {c.isAbsent ? 'AB' : c.score !== null ? c.score : '—'}
                                            <span className="text-[10px] text-muted-foreground font-normal">/{c.maxMarks}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Graded section */}
            {data.gradedSubjects.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Trophy size={15} className="text-amber-500" />
                        <span className="text-sm font-bold">{data.gradedSectionTitle}</span>
                    </div>
                    <div className="space-y-2">
                        {data.gradedSubjects.map((gs) => (
                            <div key={gs.id} className="flex items-center justify-between text-sm">
                                <span>{gs.name}</span>
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="text-muted-foreground">T1: <b className="text-foreground">{gs.term1Grade ?? '—'}</b></span>
                                    <span className="text-muted-foreground">T2: <b className="text-foreground">{gs.term2Grade ?? '—'}</b></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
