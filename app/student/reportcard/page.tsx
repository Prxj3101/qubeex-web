'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { useStudentStore } from '@/store/studentStore';

const ROLL_NO = '09';

// Same subjects/colors/percentages as the Subject Performance card on the profile page.
const SUBJECTS = [
    { id: 'eng', name: 'English', color: '#DA7756', offline: 78, online: 82 },
    { id: 'hin', name: 'Hindi', color: '#EC4899', offline: 70, online: 75 },
    { id: 'mar', name: 'Marathi', color: '#0891B2', offline: 65, online: 70 },
    { id: 'alg', name: 'Algebra', color: '#7C3AED', offline: 80, online: 85 },
    { id: 'geo', name: 'Geometry', color: '#059669', offline: 72, online: 78 },
    { id: 'sc1', name: 'Science 1', color: '#0EA5E9', offline: 68, online: 74 },
    { id: 'sc2', name: 'Science 2', color: '#6366F1', offline: 75, online: 80 },
    { id: 'his', name: 'History', color: '#D97706', offline: 60, online: 66 },
    { id: 'geog', name: 'Geography', color: '#16A34A', offline: 73, online: 77 },
];

const OVERALL_RANK = { offline: 6, online: 3 };

const OFFLINE_EXAMS = [
    { id: 'ut1', name: 'Unit Test', maxMarks: 20 },
    { id: 'oral', name: 'Oral', maxMarks: 40 },
    { id: 'mid', name: 'Mid Sem', maxMarks: 40 },
    { id: 'ut2', name: 'Unit Test II', maxMarks: 40 },
    { id: 'final', name: 'Final Sem', maxMarks: 80 },
];

const ONLINE_EXAMS = [
    { id: 'ot1', name: 'Online Test 1', maxMarks: 20 },
    { id: 'ot2', name: 'Online Test 2', maxMarks: 20 },
    { id: 'ot3', name: 'Online Test 3', maxMarks: 20 },
];

const GRADED_SUBS = [
    { id: 'gs1', name: 'PT' }, { id: 'gs2', name: 'SG' }, { id: 'gs3', name: 'ICT' },
    { id: 'gs4', name: 'GK' }, { id: 'gs5', name: 'ART' }, { id: 'gs6', name: 'EVS' }, { id: 'gs7', name: 'VE' },
];

const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];

function getAvatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(n: string) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

function scoreColor(pct: number) {
    if (pct >= 75) return '#059669';
    if (pct >= 35) return '#F59E0B';
    return '#DC2626';
}

function gradeLabel(pct: number) {
    if (pct >= 75) return 'A';
    if (pct >= 60) return 'B';
    if (pct >= 45) return 'C';
    if (pct >= 35) return 'D';
    return 'F';
}

export default function ReportCardPage() {
    const router = useRouter();
    const student = useStudentStore();
    const [tab, setTab] = useState<'offline' | 'online'>('offline');
    const isOffline = tab === 'offline';
    const examList = isOffline ? OFFLINE_EXAMS : ONLINE_EXAMS;

    const overallPct = Math.round(SUBJECTS.reduce((s, sub) => s + sub[tab], 0) / SUBJECTS.length);
    const rank = OVERALL_RANK[tab];

    // Build per-subject exam scores from each subject's known offline/online %
    // (same % applied evenly across that mode's exams — mock data).
    let grandScored = 0, grandMax = 0;
    const subjectData = SUBJECTS.map(sub => {
        const pct = sub[tab];
        let scored = 0;
        const cells = examList.map(ex => {
            const val = Math.round((pct / 100) * ex.maxMarks);
            scored += val;
            const cellPct = ex.maxMarks > 0 ? Math.round((val / ex.maxMarks) * 100) : null;
            return { ex, val, pct: cellPct };
        });
        const maxTotal = examList.reduce((s, ex) => s + ex.maxMarks, 0);
        const totalPct = maxTotal > 0 ? Math.round((scored / maxTotal) * 100) : null;
        grandScored += scored;
        grandMax += maxTotal;
        return { sub, cells, scored, maxTotal, totalPct };
    });
    const grandPct = grandMax > 0 ? Math.round((grandScored / grandMax) * 100) : null;

    return (
        <div className="flex flex-col h-full">

            {/* ── Header ── */}
            <div className="flex items-center gap-3 pt-0 pb-3 shrink-0">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0"
                >
                    <ArrowLeft size={15} className="text-foreground" />
                </button>
                <p className="text-xl font-bold">Report Card</p>
            </div>
            <div className="h-px bg-border/60 shrink-0" />

            {/* ── Body: left name card, right report card ── */}
            <div className="flex-1 min-h-0 overflow-hidden flex gap-4 py-4">

                {/* ── LEFT — Name card ── */}
                <div className="w-[200px] shrink-0 bg-card border border-border/50 rounded-2xl p-4 flex flex-col items-center gap-2 h-fit">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-white/20"
                        style={{ background: getAvatarColor(student.name) }}>
                        {getInitials(student.name)}
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-bold leading-tight">{student.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Roll No. {ROLL_NO}</p>
                    </div>
                    <div className="text-center px-3 py-2 rounded-xl border border-amber-400/30 bg-amber-400/5 w-full">
                        <p className="text-[18px] font-black text-amber-500">#{rank}</p>
                        <p className="text-[9px] text-muted-foreground">Class Rank</p>
                    </div>
                    <div className="text-center w-full">
                        <p className="text-[11px] font-black" style={{ color: scoreColor(overallPct) }}>{overallPct}%</p>
                        <p className="text-[9px] text-muted-foreground">Overall</p>
                    </div>
                </div>

                {/* ── RIGHT — Report Card (exact same as teacher's marksheet) ── */}
                <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 grid grid-cols-3 items-center shrink-0">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider justify-self-start">Report Card</p>
                        <div className="flex items-baseline gap-2 justify-self-center">
                            <span className="text-[12px] font-semibold text-foreground">{student.name}</span>
                            <span className="text-[11px] text-muted-foreground">Roll No. {ROLL_NO}</span>
                        </div>
                        <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40 justify-self-end">
                            {(['offline', 'online'] as const).map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold capitalize transition-all ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0" style={{ overflowX: 'auto', overflowY: 'auto', background: '#F8F3EC', scrollbarWidth: 'thin', scrollbarColor: '#D8C4A0 #F8F3EC' }}>
                        {isOffline ? (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                {/* Offline: flat subjects table */}
                                <table className="text-[12px] border-separate border-spacing-0 min-w-max" style={{ color: '#2A1F10' }}>
                                    <thead className="sticky top-0 z-30">
                                        <tr>
                                            <th className="sticky left-0 z-40 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-left font-bold text-[#2A1F10] whitespace-nowrap min-w-[110px]">Subjects</th>
                                            {OFFLINE_EXAMS.map(ex => (
                                                <th key={ex.id} className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[60px]">
                                                    <div style={{ fontWeight: 600, fontSize: 10 }}>{ex.name}</div>
                                                    <div style={{ fontWeight: 600, fontSize: 10, opacity: 0.7 }}>/{ex.maxMarks}</div>
                                                </th>
                                            ))}
                                            <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[56px]" style={{ fontWeight: 700 }}>Total</th>
                                            <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[52px]" style={{ fontWeight: 700 }}>%</th>
                                            <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-2 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[48px]" style={{ fontWeight: 700 }}>Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjectData.map(({ sub, cells, scored, maxTotal, totalPct }) => (
                                            <tr key={sub.id}>
                                                <td className="sticky left-0 z-20 bg-[#FAF5EE] border border-[#D8C4A0] px-3 py-1.5 font-semibold text-[#2A1F10] whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sub.color }} />
                                                        {sub.name}
                                                    </div>
                                                </td>
                                                {cells.map(({ ex, val, pct }) => (
                                                    <td key={ex.id} className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold">
                                                        <span style={{ color: scoreColor(pct ?? 0) }}>{val}</span>
                                                    </td>
                                                ))}
                                                <td className="border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#FAF5EE]">
                                                    {scored}/{maxTotal}
                                                </td>
                                                <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap">
                                                    {totalPct !== null && <span style={{ color: scoreColor(totalPct), fontWeight: 700 }}>{totalPct}%</span>}
                                                </td>
                                                <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold">
                                                    {totalPct !== null && <span style={{ color: scoreColor(totalPct) }}>{gradeLabel(totalPct)}</span>}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Grand Total row */}
                                        <tr>
                                            <td className="sticky left-0 z-20 bg-[#FAF5EE] border border-[#D8C4A0] px-3 py-1.5 font-bold text-[#2A1F10] whitespace-nowrap">Grand Total</td>
                                            {OFFLINE_EXAMS.map(ex => (
                                                <td key={ex.id} className="bg-[#FAF5EE] border border-[#D8C4A0]" />
                                            ))}
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#E8DDD0]">
                                                {grandScored}/{grandMax}
                                            </td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap bg-[#E8DDD0]">
                                                {grandPct !== null && <span style={{ color: scoreColor(grandPct), fontWeight: 700 }}>{grandPct}%</span>}
                                            </td>
                                            <td className="border border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold bg-[#E8DDD0]">
                                                {grandPct !== null && <span style={{ color: scoreColor(grandPct) }}>{gradeLabel(grandPct)}</span>}
                                            </td>
                                        </tr>
                                        {/* Conduct & Remarks row */}
                                        <tr>
                                            <td className="sticky left-0 z-20 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 font-bold text-[#2A1F10] whitespace-nowrap">Conduct</td>
                                            <td className="border border-[#D8C4A0] px-3 py-1.5 text-[#2A1F10] whitespace-nowrap">Excellent</td>
                                            <td className="bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 font-bold text-[#2A1F10] whitespace-nowrap">Remarks</td>
                                            <td colSpan={OFFLINE_EXAMS.length + 1} className="border border-[#D8C4A0] px-3 py-1.5 text-[#2A1F10] italic text-[11px]">Good keep it up</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Graded Subjects table */}
                                <table className="text-[12px] border-separate border-spacing-0 min-w-max shrink-0" style={{ color: '#2A1F10' }}>
                                    <thead className="sticky top-0 z-30">
                                        <tr>
                                            <th className="sticky left-0 z-40 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-left font-semibold text-[#2A1F10] whitespace-nowrap min-w-[110px]" style={{ lineHeight: '30px', fontWeight: 700 }}>Graded Subjects</th>
                                            <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-4 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[80px]" style={{ lineHeight: '30px' }}>Term 1</th>
                                            <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-4 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[80px]" style={{ lineHeight: '30px' }}>Term 2</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {GRADED_SUBS.map(gs => (
                                            <tr key={gs.id}>
                                                <td className="sticky left-0 z-20 bg-[#FAF5EE] border border-[#D8C4A0] px-3 py-1.5 font-semibold text-[#2A1F10] whitespace-nowrap">{gs.name}</td>
                                                <td className="border border-[#D8C4A0] px-4 py-1.5 text-center whitespace-nowrap" style={{ color: '#C8B89A' }}>—</td>
                                                <td className="border border-[#D8C4A0] px-4 py-1.5 text-center whitespace-nowrap" style={{ color: '#C8B89A' }}>—</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* Online: grouped by subject */
                            <table className="text-[12px] border-separate border-spacing-0 min-w-max w-full" style={{ color: '#2A1F10' }}>
                                <thead className="sticky top-0 z-30">
                                    <tr>
                                        <th className="sticky left-0 z-40 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-left font-bold text-[#2A1F10] whitespace-nowrap min-w-[180px]">Subject / Exam</th>
                                        <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-center font-bold text-[#2A1F10] whitespace-nowrap min-w-[60px]">Score</th>
                                        <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-center font-bold text-[#2A1F10] whitespace-nowrap min-w-[52px]">Max</th>
                                        <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-center font-bold text-[#2A1F10] whitespace-nowrap min-w-[52px]">%</th>
                                        <th className="bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1.5 text-center font-bold text-[#2A1F10] whitespace-nowrap min-w-[48px]">Grade</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subjectData.map(({ sub, cells, scored, maxTotal, totalPct }) => (
                                        <Fragment key={sub.id}>
                                            <tr>
                                                <td colSpan={5} className="sticky left-0 z-20 bg-[#EDE4D6] border border-[#D8C4A0] px-3 py-1 font-bold text-[#2A1F10] whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color }} />
                                                        {sub.name}
                                                    </div>
                                                </td>
                                            </tr>
                                            {cells.map(({ ex, val, pct }) => (
                                                <tr key={ex.id}>
                                                    <td className="sticky left-0 z-20 bg-[#FAF5EE] border border-[#D8C4A0] px-3 py-1.5 text-[#2A1F10] whitespace-nowrap pl-7">{ex.name}</td>
                                                    <td className="border border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap font-semibold">
                                                        <span style={{ color: scoreColor(pct ?? 0) }}>{val}</span>
                                                    </td>
                                                    <td className="border border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap text-[#2A1F10]">{ex.maxMarks}</td>
                                                    <td className="border border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap">
                                                        {pct !== null && <span style={{ color: scoreColor(pct), fontWeight: 600 }}>{pct}%</span>}
                                                    </td>
                                                    <td className="border border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap" style={{ color: '#C8B89A' }}>—</td>
                                                </tr>
                                            ))}
                                            <tr>
                                                <td className="sticky left-0 z-20 bg-[#FAF5EE] border border-[#D8C4A0] px-3 py-1.5 font-semibold text-[#2A1F10] whitespace-nowrap pl-7 italic">Total</td>
                                                <td className="border border-[#D8C4A0] px-3 py-1.5 text-center font-bold whitespace-nowrap bg-[#FAF5EE]">{scored}</td>
                                                <td className="border border-[#D8C4A0] px-3 py-1.5 text-center font-bold whitespace-nowrap bg-[#FAF5EE]">{maxTotal}</td>
                                                <td className="border border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap">
                                                    {totalPct !== null && <span style={{ color: scoreColor(totalPct), fontWeight: 700 }}>{totalPct}%</span>}
                                                </td>
                                                <td className="border border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap font-semibold">
                                                    {totalPct !== null && <span style={{ color: scoreColor(totalPct) }}>{gradeLabel(totalPct)}</span>}
                                                </td>
                                            </tr>
                                        </Fragment>
                                    ))}
                                    <tr style={{ position: 'sticky', bottom: 0, zIndex: 25 }}>
                                        <td className="sticky left-0 z-30 bg-[#E8DDD0] border border-[#D8C4A0] px-3 py-1.5 font-bold text-[#2A1F10] whitespace-nowrap">Grand Total</td>
                                        <td className="border border-[#D8C4A0] px-3 py-1.5 text-center font-bold whitespace-nowrap bg-[#E8DDD0]">{grandScored}</td>
                                        <td className="border border-[#D8C4A0] px-3 py-1.5 text-center font-bold whitespace-nowrap bg-[#E8DDD0]">{grandMax}</td>
                                        <td className="border border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap bg-[#E8DDD0]">
                                            {grandPct !== null && <span style={{ color: scoreColor(grandPct), fontWeight: 700 }}>{grandPct}%</span>}
                                        </td>
                                        <td className="border border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap font-semibold bg-[#E8DDD0]">
                                            {grandPct !== null && <span style={{ color: scoreColor(grandPct) }}>{gradeLabel(grandPct)}</span>}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Footer legend */}
                    <div className="border-t border-border/40 bg-muted/20 px-4 py-2 shrink-0 flex items-center gap-5">
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
