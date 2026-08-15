'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import NextImage from 'next/image';
import { useStudentStore } from '@/store/studentStore';
import { colorForSubject } from '@/lib/subjectColors';

interface ExamCol { id: string; name: string; maxMarks: number; score: number | null; isAbsent: boolean; }
interface MarksheetSubject {
    id: string; name: string; code: string; color: string | null;
    columns: ExamCol[];
    total: { scored: number; max: number };
    pct: number | null; grade: string;
    onlineColumns: ExamCol[];
    onlineTotal: { scored: number; max: number };
    onlinePct: number | null; onlineGrade: string;
}
interface GradedSubject { id: string; name: string; term1Grade: string | null; term2Grade: string | null; }
interface GradeScaleEntry { grade: string; minPct: number }
interface MarksheetData {
    academicYear: string;
    gradeScale: GradeScaleEntry[];
    student: { name: string; rollNo: string };
    subjects: MarksheetSubject[];
    grandTotal: { scored: number; max: number };
    grandPct: number | null;
    grade: string;
    onlineGrandTotal: { scored: number; max: number };
    onlineGrandPct: number | null;
    onlineGrade: string;
    classRank: number | null;
    classSize: number | null;
    gradedSubjects: GradedSubject[];
    conduct: string | null;
    remarks: string | null;
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

const DEFAULT_GRADE_SCALE: GradeScaleEntry[] = [
    { grade: 'A', minPct: 75 },
    { grade: 'B', minPct: 60 },
    { grade: 'C', minPct: 45 },
    { grade: 'D', minPct: 35 },
    { grade: 'F', minPct: 0 },
];
// Best-to-worst color ramp, assigned by rank within the scale — every grade
// (including custom labels) gets its own distinct color, bottom always red.
const GRADE_COLOR_RAMP = ['#059669', '#16A34A', '#65A30D', '#CA8A04', '#D97706', '#EA580C', '#DC2626', '#B91C1C', '#991B1B'];
function gradeColor(g: string | null, scale: GradeScaleEntry[]) {
    if (!g) return '#94A3B8';
    const sorted = scale.length > 0 ? [...scale].sort((a, b) => b.minPct - a.minPct) : DEFAULT_GRADE_SCALE;
    const rank = sorted.findIndex(e => e.grade.toUpperCase() === g.toUpperCase());
    if (rank === -1) return '#94A3B8';
    if (sorted.length <= 1) return GRADE_COLOR_RAMP[0];
    const idx = Math.round((rank / (sorted.length - 1)) * (GRADE_COLOR_RAMP.length - 1));
    return GRADE_COLOR_RAMP[idx];
}

export default function ReportCardPage() {
    const router = useRouter();
    const studentPhoto = useStudentStore(s => s.photo);
    const [data, setData] = useState<MarksheetData | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'offline' | 'online'>('offline');

    useEffect(() => {
        api.get('/student/marksheet')
            .then(r => setData(r.data.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    // Build unique exam column names in order of first appearance
    const uniqueColNames = useMemo(() => {
        if (!data) return [];
        const seen = new Set<string>();
        const cols: { name: string; maxMarks: number }[] = [];
        for (const sub of data.subjects) {
            for (const col of sub.columns) {
                if (!seen.has(col.name)) {
                    seen.add(col.name);
                    cols.push({ name: col.name, maxMarks: col.maxMarks });
                }
            }
        }
        return cols;
    }, [data]);


    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 pt-0 pb-3 shrink-0">
                    <button onClick={() => router.back()} className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0">
                        <ArrowLeft size={15} className="text-foreground" />
                    </button>
                    <p className="text-xl font-bold">Report Card</p>
                </div>
                <div className="h-px bg-border/60 shrink-0" />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-primary" />
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 pt-0 pb-3 shrink-0">
                    <button onClick={() => router.back()} className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0">
                        <ArrowLeft size={15} className="text-foreground" />
                    </button>
                    <p className="text-xl font-bold">Report Card</p>
                </div>
                <div className="h-px bg-border/60 shrink-0" />
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">Results not published yet.</p>
                </div>
            </div>
        );
    }

    const studentName = data.student.name;
    const rollNo = data.student.rollNo;
    const rank = data.classRank;
    const overallPct = data.grandPct;

    return (
        <div className="flex flex-col h-full">

            {/* ── Header ── */}
            <div className="flex items-center gap-3 pt-0 pb-3 shrink-0">
                <button onClick={() => router.back()} className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0">
                    <ArrowLeft size={15} className="text-foreground" />
                </button>
                <p className="text-xl font-bold">Report Card</p>
            </div>
            <div className="h-px bg-border/60 shrink-0" />

            {/* ── Body: left name card, right report card ── */}
            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-4 py-4">

                {/* ── LEFT — Name card ── */}
                <div className="w-full lg:w-[200px] shrink-0 bg-card border border-border/50 rounded-2xl p-4 flex flex-row lg:flex-col items-center gap-2 lg:h-fit flex-wrap justify-center">
                    <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white ring-2 ring-white/20 relative"
                        style={{ background: studentPhoto ? 'transparent' : getAvatarColor(studentName) }}>
                        {studentPhoto
                            ? <NextImage src={studentPhoto} alt={studentName} fill sizes="56px" className="object-cover" unoptimized={studentPhoto.startsWith('data:')} />
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
                        <p className="text-[11px] font-black" style={{ color: scoreColor(overallPct) }}>
                            {overallPct !== null ? `${overallPct}%` : '—'}
                        </p>
                        <p className="text-[9px] text-muted-foreground">Overall</p>
                    </div>
                </div>

                {/* ── RIGHT — Report Card ── */}
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
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                {/* Main marksheet table */}
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
                                        {data.subjects.map(sub => {
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
                                        {/* Grand Total row */}
                                        <tr>
                                            <td className="sticky left-0 z-20 bg-[#E8DDD0] border border-[#D8C4A0] px-3 py-1.5 font-bold whitespace-nowrap">Grand Total</td>
                                            {uniqueColNames.map(col => (
                                                <td key={col.name} className="bg-[#E8DDD0] border border-[#D8C4A0]" />
                                            ))}
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#E8DDD0]">
                                                {data.grandTotal.scored}/{data.grandTotal.max}
                                            </td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap bg-[#E8DDD0]">
                                                {data.grandPct !== null && <span style={{ color: scoreColor(data.grandPct), fontWeight: 700 }}>{data.grandPct}%</span>}
                                            </td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold bg-[#E8DDD0]">
                                                <span style={{ color: scoreColor(data.grandPct) }}>{data.grade}</span>
                                            </td>
                                        </tr>
                                        {/* Conduct row - set by the class teacher */}
                                        {data.conduct && (
                                            <tr>
                                                <td className="sticky left-0 z-20 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 font-bold whitespace-nowrap align-top">Conduct</td>
                                                <td colSpan={uniqueColNames.length + 3} className="border border-[#D8C4A0] px-3 py-1.5 align-top">
                                                    <span className="block whitespace-pre-wrap break-words" style={{ width: '1px', minWidth: '100%' }}>{data.conduct}</span>
                                                </td>
                                            </tr>
                                        )}
                                        {/* Remarks row - set by the class teacher */}
                                        {data.remarks && (
                                            <tr>
                                                <td className="sticky left-0 z-20 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 font-bold whitespace-nowrap align-top">Remarks</td>
                                                <td colSpan={uniqueColNames.length + 3} className="border border-[#D8C4A0] px-3 py-1.5 italic text-[11px] align-top">
                                                    <span className="block whitespace-pre-wrap break-words" style={{ width: '1px', minWidth: '100%' }}>{data.remarks}</span>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {/* Graded Subjects table */}
                                {data.gradedSubjects.length > 0 && (
                                    <table className="text-[12px] border-separate border-spacing-0 min-w-max shrink-0" style={{ color: '#2A1F10' }}>
                                        <thead className="sticky top-0 z-30">
                                            <tr>
                                                <th className="sticky left-0 z-40 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-left font-bold whitespace-nowrap min-w-[120px]">Graded Subjects</th>
                                                <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-4 py-1.5 text-center font-semibold whitespace-nowrap min-w-[80px]">Term 1</th>
                                                <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-4 py-1.5 text-center font-semibold whitespace-nowrap min-w-[80px]">Term 2</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.gradedSubjects.map(gs => (
                                                <tr key={gs.id}>
                                                    <td className="sticky left-0 z-20 bg-[#FAF5EE] border border-[#D8C4A0] px-3 py-1.5 font-semibold whitespace-nowrap">{gs.name}</td>
                                                    <td className="border border-[#D8C4A0] px-4 py-1.5 text-center whitespace-nowrap font-semibold">
                                                        {gs.term1Grade
                                                            ? <span style={{ color: gradeColor(gs.term1Grade, data.gradeScale) }}>{gs.term1Grade}</span>
                                                            : <span style={{ color: '#C8B89A' }}>—</span>}
                                                    </td>
                                                    <td className="border border-[#D8C4A0] px-4 py-1.5 text-center whitespace-nowrap font-semibold">
                                                        {gs.term2Grade
                                                            ? <span style={{ color: gradeColor(gs.term2Grade, data.gradeScale) }}>{gs.term2Grade}</span>
                                                            : <span style={{ color: '#C8B89A' }}>—</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        ) : data.subjects.some(s => s.onlineTotal.max > 0) ? (
                            /* Online: subject-wise totals, not a per-test grid — different
                               subjects can have very different numbers of completed tests,
                               so there's no single shared column structure like offline has. */
                            <table className="text-[12px] border-separate border-spacing-0 min-w-max" style={{ color: '#2A1F10' }}>
                                <thead className="sticky top-0 z-30">
                                    <tr>
                                        <th className="sticky left-0 z-40 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-left font-bold whitespace-nowrap min-w-[130px]">Subjects</th>
                                        <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-semibold whitespace-nowrap min-w-[70px]">Tests</th>
                                        <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap min-w-[60px]">Total</th>
                                        <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap min-w-[52px]">%</th>
                                        <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap min-w-[48px]">Grade</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.subjects.map(sub => (
                                        <tr key={sub.id}>
                                            <td className="sticky left-0 z-20 bg-[#FAF5EE] border border-[#D8C4A0] px-3 py-1.5 font-semibold whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorForSubject(sub) }} />
                                                    {sub.name}
                                                </div>
                                            </td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap text-[#7A6A55]">
                                                {sub.onlineColumns.length}
                                            </td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#FAF5EE]">
                                                {sub.onlineTotal.max > 0 ? `${sub.onlineTotal.scored}/${sub.onlineTotal.max}` : '—'}
                                            </td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap">
                                                {sub.onlinePct !== null && <span style={{ color: scoreColor(sub.onlinePct), fontWeight: 700 }}>{sub.onlinePct}%</span>}
                                            </td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold">
                                                <span style={{ color: scoreColor(sub.onlinePct) }}>{sub.onlineGrade}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td className="sticky left-0 z-20 bg-[#E8DDD0] border border-[#D8C4A0] px-3 py-1.5 font-bold whitespace-nowrap">Grand Total</td>
                                        <td className="bg-[#E8DDD0] border border-[#D8C4A0]" />
                                        <td className="border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#E8DDD0]">
                                            {data.onlineGrandTotal.max > 0 ? `${data.onlineGrandTotal.scored}/${data.onlineGrandTotal.max}` : '—'}
                                        </td>
                                        <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap bg-[#E8DDD0]">
                                            {data.onlineGrandPct !== null && <span style={{ color: scoreColor(data.onlineGrandPct), fontWeight: 700 }}>{data.onlineGrandPct}%</span>}
                                        </td>
                                        <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold bg-[#E8DDD0]">
                                            <span style={{ color: scoreColor(data.onlineGrandPct) }}>{data.onlineGrade}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-2 text-muted-foreground p-8">
                                <p className="text-sm font-medium">No completed tests yet</p>
                                <p className="text-[11px] opacity-60">Online results appear here once a test is completed</p>
                            </div>
                        )}
                    </div>

                    {/* Footer legend */}
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
