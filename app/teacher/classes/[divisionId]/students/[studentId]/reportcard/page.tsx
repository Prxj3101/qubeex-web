'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { getMarksheet, resolveGrade, type MarksheetData as ClassMarksheetData } from '@/lib/marksheetApi';
import { colorForSubject } from '@/lib/subjectColors';

interface Subject { id: string; name: string; code: string | null; color: string | null; order: number }

interface ExamCol { id: string; name: string; maxMarks: number; score: number | null; isAbsent: boolean; }
interface ReportSubject {
    id: string; name: string; code: string; color: string | null;
    columns: ExamCol[];
    total: { scored: number; max: number };
    pct: number | null; grade: string;
}
interface ReportGradedSubject { id: string; name: string; term1Grade: string | null; term2Grade: string | null; }

// Fallback shape — the lightweight per-student summary endpoint (same one
// StudentProfileView's Subject Performance chart already uses successfully).
// No per-exam columns, no graded-subjects section, but real scored data.
interface SimpleSubject { id: string; name: string; code: string; color: string | null; total: { scored: number; max: number }; pct: number | null; grade: string; }
interface SimpleMarksheet { subjects: SimpleSubject[]; grandPct: number | null; classRank: number | null; classSize: number | null; }

// Must match useMarksheet.ts's getAcademicYear() exactly (plain hyphen, not en dash) —
// this string is used as an API query param and has to match what the marksheet
// was actually initialized/stored under, or getMarksheet/getAdminMarksheet 404s.
function computeAcademicYear(): string {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth();
    return mo >= 5 ? `${yr}-${String(yr + 1).slice(2)}` : `${yr - 1}-${String(yr).slice(2)}`;
}

function studentGrandPct(classData: ClassMarksheetData, subjects: Subject[], studentId: string): number | null {
    let scored = 0, enteredMax = 0;
    for (const sub of subjects) {
        const cols = classData.examColumns[sub.id] ?? [];
        for (const col of cols) {
            const entry = classData.scores[col.id]?.[studentId];
            if (entry && entry.score !== null) { scored += entry.score; enteredMax += col.maxMarks; }
        }
    }
    return enteredMax > 0 ? Math.round((scored / enteredMax) * 100) : null;
}

const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
function getAvatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(n: string) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

function scoreColor(pct: number | null) {
    if (pct === null) return '#94A3B8';
    if (pct >= 75) return '#059669';
    if (pct >= 35) return '#F59E0B';
    return '#DC2626';
}

const GRADE_COLOR_RAMP = ['#059669', '#16A34A', '#65A30D', '#CA8A04', '#D97706', '#EA580C', '#DC2626', '#B91C1C', '#991B1B'];
function gradeColor(g: string | null, scale: { grade: string; minPct: number }[]) {
    if (!g) return '#94A3B8';
    const sorted = [...scale].sort((a, b) => b.minPct - a.minPct);
    const rank = sorted.findIndex(e => e.grade.toUpperCase() === g.toUpperCase());
    if (rank === -1 || sorted.length === 0) return '#94A3B8';
    if (sorted.length <= 1) return GRADE_COLOR_RAMP[0];
    const idx = Math.round((rank / (sorted.length - 1)) * (GRADE_COLOR_RAMP.length - 1));
    return GRADE_COLOR_RAMP[idx];
}

export default function TeacherStudentReportCardPage() {
    const router = useRouter();
    const params = useParams();
    const divisionId = params.divisionId as string;
    const studentId = params.studentId as string;

    const [studentName, setStudentName] = useState('');
    const [rollNo, setRollNo] = useState('');
    const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [classData, setClassData] = useState<ClassMarksheetData | null>(null);
    const [simpleData, setSimpleData] = useState<SimpleMarksheet | null>(null);
    const [loading, setLoading] = useState(true);
    const [notPublished, setNotPublished] = useState(false);
    const [tab, setTab] = useState<'offline' | 'online'>('offline');

    useEffect(() => {
        let cancelled = false;
        const academicYear = computeAcademicYear();

        // Division + student identity — needed regardless of which marksheet source is used.
        api.get(`/teacher/classes/${divisionId}`)
            .then(divRes => {
                if (cancelled) return;
                const div = divRes.data.data;
                setSubjects(div.standard?.subjects ?? div.subjects ?? []);
            })
            .catch(err => console.error('reportcard: failed to load division', err));

        api.get(`/teacher/classes/${divisionId}/students`)
            .then(studentsRes => {
                if (cancelled) return;
                const found = (studentsRes.data.data as { id: string; studentId: string; rollNo: string | null; avatarUrl: string | null; user: { name: string | null } }[]).find(s => s.id === studentId);
                setStudentName(found?.user.name ?? 'Student');
                setRollNo(found?.rollNo ?? '—');
                setStudentPhoto(found?.avatarUrl ?? null);
            })
            .catch(err => console.error('reportcard: failed to load students list', err));

        // Rich, per-exam-column source (same as student's own /student/marksheet).
        getMarksheet(divisionId, academicYear)
            .then(marksheet => {
                if (cancelled) return;
                if (marksheet) { setClassData(marksheet); return; }
                // Class-wide marksheet not initialized/published for this academic year —
                // fall back to the lightweight per-student summary (already proven to work
                // in the Profile tab's Subject Performance section).
                return api.get(`/teacher/classes/${divisionId}/students/${studentId}/marksheet`)
                    .then(res => { if (!cancelled) setSimpleData(res.data.data); })
                    .catch(err => { console.error('reportcard: fallback summary marksheet failed', err); if (!cancelled) setNotPublished(true); });
            })
            .catch(err => {
                console.error('reportcard: class marksheet fetch errored', err);
                return api.get(`/teacher/classes/${divisionId}/students/${studentId}/marksheet`)
                    .then(res => { if (!cancelled) setSimpleData(res.data.data); })
                    .catch(err2 => { console.error('reportcard: fallback summary marksheet failed', err2); if (!cancelled) setNotPublished(true); });
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [divisionId, studentId]);

    const reportSubjects: ReportSubject[] = useMemo(() => {
        if (!classData) return [];
        return [...subjects].sort((a, b) => a.order - b.order).map(sub => {
            const cols = (classData.examColumns[sub.id] ?? []).map(c => {
                const entry = classData.scores[c.id]?.[studentId];
                return { id: c.id, name: c.name, maxMarks: c.maxMarks, score: entry?.score ?? null, isAbsent: entry?.isAbsent ?? false };
            });
            const scored = cols.reduce((s, c) => s + (c.isAbsent ? 0 : (c.score ?? 0)), 0);
            const enteredMax = cols.reduce((s, c) => s + (c.score !== null && !c.isAbsent ? c.maxMarks : 0), 0);
            const pct = enteredMax > 0 ? Math.round((scored / enteredMax) * 100) : null;
            const grade = pct !== null ? resolveGrade(pct, classData.gradeScale) : '';
            return { id: sub.id, name: sub.name, code: sub.code ?? '', color: sub.color, columns: cols, total: { scored, max: enteredMax }, pct, grade };
        });
    }, [classData, subjects, studentId]);

    const gradedSubjects: ReportGradedSubject[] = useMemo(() => {
        if (!classData) return [];
        return [...classData.gradedSubjects].sort((a, b) => a.order - b.order).map(gs => {
            const entry = classData.gradedScores[gs.id]?.[studentId];
            return { id: gs.id, name: gs.name, term1Grade: entry?.term1Grade ?? null, term2Grade: entry?.term2Grade ?? null };
        });
    }, [classData, studentId]);

    const grandTotal = useMemo(() => reportSubjects.reduce((acc, s) => ({ scored: acc.scored + s.total.scored, max: acc.max + s.total.max }), { scored: 0, max: 0 }), [reportSubjects]);
    const grandPct = classData ? (grandTotal.max > 0 ? Math.round((grandTotal.scored / grandTotal.max) * 100) : null) : (simpleData?.grandPct ?? null);
    const grandGrade = classData && grandPct !== null ? resolveGrade(grandPct, classData.gradeScale) : (grandPct !== null ? resolveGrade(grandPct, []) : '');

    const rank = useMemo(() => {
        if (classData) {
            const ranked = classData.students
                .map(s => ({ id: s.id, pct: studentGrandPct(classData, subjects, s.id) }))
                .filter(s => s.pct !== null)
                .sort((a, b) => (b.pct as number) - (a.pct as number));
            const idx = ranked.findIndex(s => s.id === studentId);
            return idx === -1 ? null : idx + 1;
        }
        return simpleData?.classRank ?? null;
    }, [classData, subjects, studentId, simpleData]);

    const uniqueColNames = useMemo(() => {
        const seen = new Set<string>();
        const cols: { name: string; maxMarks: number }[] = [];
        for (const sub of reportSubjects) {
            for (const col of sub.columns) {
                if (!seen.has(col.name)) { seen.add(col.name); cols.push({ name: col.name, maxMarks: col.maxMarks }); }
            }
        }
        return cols;
    }, [reportSubjects]);

    const goBack = () => router.back();

    const hasRich = !!classData;
    const hasSimple = !hasRich && !!simpleData;

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 pt-0 pb-3 shrink-0">
                    <button onClick={goBack} className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0">
                        <ArrowLeft size={15} className="text-foreground" />
                    </button>
                    <p className="text-xl font-bold">{studentName ? `${studentName}'s Report Card` : 'Report Card'}</p>
                </div>
                <div className="h-px bg-border/60 shrink-0" />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-primary" />
                </div>
            </div>
        );
    }

    if (notPublished || (!hasRich && !hasSimple)) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 pt-0 pb-3 shrink-0">
                    <button onClick={goBack} className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0">
                        <ArrowLeft size={15} className="text-foreground" />
                    </button>
                    <p className="text-xl font-bold">{studentName ? `${studentName}'s Report Card` : 'Report Card'}</p>
                </div>
                <div className="h-px bg-border/60 shrink-0" />
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">Results not published yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">

            <div className="flex items-center gap-3 pt-0 pb-3 shrink-0">
                <button onClick={goBack} className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0">
                    <ArrowLeft size={15} className="text-foreground" />
                </button>
                <p className="text-xl font-bold">{studentName ? `${studentName}'s Report Card` : 'Report Card'}</p>
            </div>
            <div className="h-px bg-border/60 shrink-0" />

            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-4 py-4">

                <div className="w-full lg:w-[200px] shrink-0 bg-card border border-border/50 rounded-2xl p-4 flex flex-row lg:flex-col items-center gap-2 lg:h-fit flex-wrap justify-center">
                    <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white ring-2 ring-white/20 relative"
                        style={{ background: studentPhoto ? 'transparent' : getAvatarColor(studentName) }}>
                        {studentPhoto
                            ? <img src={studentPhoto} alt={studentName} className="w-full h-full object-cover" />
                            : getInitials(studentName)}
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-bold leading-tight">{studentName}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Roll No. {rollNo}</p>
                    </div>
                    <div className="text-center px-3 py-2 rounded-xl border border-amber-400/30 bg-amber-400/5 w-full">
                        <p className="text-[18px] font-black text-amber-500">{rank !== null ? `#${rank}` : '—'}</p>
                        <p className="text-[9px] text-muted-foreground">Class Rank</p>
                    </div>
                    <div className="text-center w-full">
                        <p className="text-[11px] font-black" style={{ color: scoreColor(grandPct) }}>
                            {grandPct !== null ? `${grandPct}%` : '—'}
                        </p>
                        <p className="text-[9px] text-muted-foreground">Overall</p>
                    </div>
                </div>

                <div className="flex-1 min-w-0 min-h-[420px] lg:min-h-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex flex-col gap-2 lg:grid lg:grid-cols-3 items-center shrink-0">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider self-start lg:justify-self-start">Report Card</p>
                        <div className="flex items-baseline gap-2 lg:justify-self-center">
                            <span className="text-[12px] font-semibold text-foreground">{studentName}</span>
                            <span className="text-[11px] text-muted-foreground">Roll No. {rollNo}</span>
                        </div>
                        <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40 lg:justify-self-end">
                            {(['offline', 'online'] as const).map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold capitalize transition-all ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0" style={{ overflowX: 'auto', overflowY: 'auto', background: '#F8F3EC', scrollbarWidth: 'thin', scrollbarColor: '#D8C4A0 #F8F3EC' }}>
                        {tab === 'offline' ? (
                            hasRich ? (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <table className="text-[12px] border-separate border-spacing-0 min-w-max" style={{ color: '#2A1F10' }}>
                                        <thead className="sticky top-0 z-30">
                                            <tr>
                                                <th className="sticky left-0 z-40 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-left font-bold whitespace-nowrap min-w-[130px]">Subjects</th>
                                                {uniqueColNames.map(col => (
                                                    <th key={col.name} className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-semibold whitespace-nowrap min-w-[60px]">
                                                        <div style={{ fontWeight: 600, fontSize: 10 }}>{col.name}</div>
                                                        <div style={{ fontWeight: 600, fontSize: 10, opacity: 0.7 }}>/{col.maxMarks}</div>
                                                    </th>
                                                ))}
                                                <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap min-w-[60px]">Total</th>
                                                <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap min-w-[52px]">%</th>
                                                <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap min-w-[48px]">Grade</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportSubjects.map(sub => {
                                                const byName = new Map(sub.columns.map(c => [c.name, c]));
                                                return (
                                                    <tr key={sub.id}>
                                                        <td className="sticky left-0 z-20 bg-[#FAF5EE] border border-[#D8C4A0] px-3 py-1.5 font-semibold whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorForSubject(sub) }} />
                                                                {sub.name}
                                                            </div>
                                                        </td>
                                                        {uniqueColNames.map(col => {
                                                            const c = byName.get(col.name);
                                                            if (!c) return <td key={col.name} className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap text-[#C8B89A]">—</td>;
                                                            if (c.isAbsent) return <td key={col.name} className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold" style={{ color: '#DC2626' }}>Ab</td>;
                                                            if (c.score === null) return <td key={col.name} className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap text-[#C8B89A]">—</td>;
                                                            const cellPct = c.maxMarks > 0 ? Math.round((c.score / c.maxMarks) * 100) : null;
                                                            return (
                                                                <td key={col.name} className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold">
                                                                    <span style={{ color: scoreColor(cellPct) }}>{c.score}</span>
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#FAF5EE]">
                                                            {sub.total.scored}/{sub.total.max}
                                                        </td>
                                                        <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap">
                                                            {sub.pct !== null && <span style={{ color: scoreColor(sub.pct), fontWeight: 700 }}>{sub.pct}%</span>}
                                                        </td>
                                                        <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold">
                                                            <span style={{ color: scoreColor(sub.pct) }}>{sub.grade}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            <tr>
                                                <td className="sticky left-0 z-20 bg-[#E8DDD0] border border-[#D8C4A0] px-3 py-1.5 font-bold whitespace-nowrap">Grand Total</td>
                                                {uniqueColNames.map(col => (
                                                    <td key={col.name} className="bg-[#E8DDD0] border border-[#D8C4A0]" />
                                                ))}
                                                <td className="border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#E8DDD0]">
                                                    {grandTotal.scored}/{grandTotal.max}
                                                </td>
                                                <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap bg-[#E8DDD0]">
                                                    {grandPct !== null && <span style={{ color: scoreColor(grandPct), fontWeight: 700 }}>{grandPct}%</span>}
                                                </td>
                                                <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold bg-[#E8DDD0]">
                                                    <span style={{ color: scoreColor(grandPct) }}>{grandGrade}</span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {gradedSubjects.length > 0 && (
                                        <table className="text-[12px] border-separate border-spacing-0 min-w-max shrink-0" style={{ color: '#2A1F10' }}>
                                            <thead className="sticky top-0 z-30">
                                                <tr>
                                                    <th className="sticky left-0 z-40 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-left font-bold whitespace-nowrap min-w-[120px]">Graded Subjects</th>
                                                    <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-4 py-1.5 text-center font-semibold whitespace-nowrap min-w-[80px]">Term 1</th>
                                                    <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-4 py-1.5 text-center font-semibold whitespace-nowrap min-w-[80px]">Term 2</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {gradedSubjects.map(gs => (
                                                    <tr key={gs.id}>
                                                        <td className="sticky left-0 z-20 bg-[#FAF5EE] border border-[#D8C4A0] px-3 py-1.5 font-semibold whitespace-nowrap">{gs.name}</td>
                                                        <td className="border border-[#D8C4A0] px-4 py-1.5 text-center whitespace-nowrap font-semibold">
                                                            {gs.term1Grade
                                                                ? <span style={{ color: gradeColor(gs.term1Grade, classData!.gradeScale) }}>{gs.term1Grade}</span>
                                                                : <span style={{ color: '#C8B89A' }}>—</span>}
                                                        </td>
                                                        <td className="border border-[#D8C4A0] px-4 py-1.5 text-center whitespace-nowrap font-semibold">
                                                            {gs.term2Grade
                                                                ? <span style={{ color: gradeColor(gs.term2Grade, classData!.gradeScale) }}>{gs.term2Grade}</span>
                                                                : <span style={{ color: '#C8B89A' }}>—</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            ) : (
                                <table className="text-[12px] border-separate border-spacing-0 min-w-max" style={{ color: '#2A1F10' }}>
                                    <thead className="sticky top-0 z-30">
                                        <tr>
                                            <th className="sticky left-0 z-40 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-left font-bold whitespace-nowrap min-w-[130px]">Subjects</th>
                                            <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap min-w-[60px]">Total</th>
                                            <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap min-w-[52px]">%</th>
                                            <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap min-w-[48px]">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(simpleData?.subjects ?? []).map(sub => (
                                            <tr key={sub.id}>
                                                <td className="sticky left-0 z-20 bg-[#FAF5EE] border border-[#D8C4A0] px-3 py-1.5 font-semibold whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorForSubject(sub) }} />
                                                        {sub.name}
                                                    </div>
                                                </td>
                                                <td className="border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#FAF5EE]">
                                                    {sub.total.scored}/{sub.total.max}
                                                </td>
                                                <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap">
                                                    {sub.pct !== null && <span style={{ color: scoreColor(sub.pct), fontWeight: 700 }}>{sub.pct}%</span>}
                                                </td>
                                                <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold">
                                                    <span style={{ color: scoreColor(sub.pct) }}>{sub.grade}</span>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr>
                                            <td className="sticky left-0 z-20 bg-[#E8DDD0] border border-[#D8C4A0] px-3 py-1.5 font-bold whitespace-nowrap">Grand Total</td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#E8DDD0]">
                                                {(simpleData?.subjects ?? []).reduce((s, x) => s + x.total.scored, 0)}/{(simpleData?.subjects ?? []).reduce((s, x) => s + x.total.max, 0)}
                                            </td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap bg-[#E8DDD0]">
                                                {grandPct !== null && <span style={{ color: scoreColor(grandPct), fontWeight: 700 }}>{grandPct}%</span>}
                                            </td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold bg-[#E8DDD0]">
                                                <span style={{ color: scoreColor(grandPct) }}>{grandGrade}</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-2 text-muted-foreground p-8">
                                <p className="text-sm font-medium">Online results not yet available</p>
                                <p className="text-[11px] opacity-60">Online exam module is coming soon</p>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-border/40 bg-muted/20 px-4 py-2 shrink-0 flex items-center gap-5 flex-wrap">
                        {[
                            { label: '≥75% Pass', color: '#059669', sample: 75 },
                            { label: '35–74% Pass', color: '#F59E0B', sample: 36 },
                            { label: '<35% Fail', color: '#DC2626', sample: 17 },
                        ].map(item => (
                            <div key={item.label} className="flex items-center gap-1.5">
                                <span style={{ fontSize: 11, fontWeight: 600, color: item.color }}>{item.sample}%</span>
                                <span className="text-[10px] text-muted-foreground">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
