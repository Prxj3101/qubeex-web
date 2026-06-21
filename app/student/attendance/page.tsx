'use client';

import { ArrowLeft, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useMemo } from 'react';
import { useStudentStore } from '@/store/studentStore';

const ROLL_NO = '09';

// ── Mock data — same monthly values as the attendance trend on the profile page ──
const MONTHLY = [
    { month: 'Jun', key: 5, pct: 62 },
    { month: 'Jul', key: 6, pct: 70 },
    { month: 'Aug', key: 7, pct: 88 },
    { month: 'Sep', key: 8, pct: 95 },
    { month: 'Oct', key: 9, pct: 82 },
    { month: 'Nov', key: 10, pct: 80 },
    { month: 'Dec', key: 11, pct: 65 },
    { month: 'Jan', key: 0, pct: 72 },
    { month: 'Feb', key: 1, pct: 82 },
    { month: 'Mar', key: 2, pct: 90 },
    { month: 'Apr', key: 3, pct: 76 },
    { month: 'May', key: 4, pct: 84 },
];
const YEAR = 2025; // academic year 2025-26 (Jun 2025 – May 2026) for the sheet grid

const MONTH_FULL: Record<string, string> = {
    Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November',
    Dec: 'December', Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May',
};

// Mock holiday calendar — keyed by month (0-indexed) then day, value is the
// holiday name shown in the tooltip. Same idea as the teacher dashboard's
// holidaysByMonthDay.
const HOLIDAYS_BY_MONTH_DAY: Record<number, Record<number, string>> = {
    7: { 15: 'Independence Day' },   // Aug
    9: { 2: 'Gandhi Jayanti' },      // Oct
    10: { 1: 'Diwali' },             // Nov
    11: { 25: 'Christmas' },        // Dec
    0: { 26: 'Republic Day' },       // Jan
    4: { 1: 'Maharashtra Day' },     // May
};

function pctColor(p: number | null) {
    if (p === null) return 'text-muted-foreground/40';
    if (p >= 75) return 'text-emerald-500';
    if (p >= 65) return 'text-amber-500';
    return 'text-red-500';
}

// Deterministic mock day-status generator — distributes P/A/L across a
// month's non-Sunday, non-holiday days so the totals roughly match the
// target % above.
function makeMonthStatuses(year: number, monthKey: number, targetPct: number) {
    const daysInMonth = new Date(year, monthKey + 1, 0).getDate();
    const workDays: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const isSunday = new Date(year, monthKey, d).getDay() === 0;
        const isHol = !!HOLIDAYS_BY_MONTH_DAY[monthKey]?.[d];
        if (!isSunday && !isHol) workDays.push(d);
    }
    const presentCount = Math.round((targetPct / 100) * workDays.length);
    const lateCount = Math.min(2, workDays.length - presentCount);
    const statuses: Record<number, 'P' | 'A' | 'L'> = {};
    workDays.forEach((d, i) => {
        if (i < presentCount) statuses[d] = 'P';
        else if (i < presentCount + lateCount) statuses[d] = 'L';
        else statuses[d] = 'A';
    });
    return statuses;
}

const DATE_COLS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function AttendanceDetailsPage() {
    const router = useRouter();
    const student = useStudentStore();

    const overallPct = Math.round(MONTHLY.reduce((s, m) => s + m.pct, 0) / MONTHLY.length);
    const overallStatus = overallPct >= 75 ? 'safe' : overallPct >= 65 ? 'condonation' : 'defaulter';
    const totalClasses = 620;
    const totalAttended = Math.round((overallPct / 100) * totalClasses);
    const currentMonthPct = MONTHLY[0].pct;

    const monthData = useMemo(() => MONTHLY.map(m => ({
        ...m,
        statuses: makeMonthStatuses(YEAR, m.key, m.pct),
        daysInMonth: new Date(YEAR, m.key + 1, 0).getDate(),
    })), []);

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
                <p className="text-xl font-bold">Attendance Details</p>
            </div>
            <div className="h-px bg-border/60 shrink-0" />

            {/* ── Body: left hero+rules, right month-wise + sheet ── */}
            <div className="flex-1 min-h-0 overflow-hidden flex items-start gap-4 py-4">

                {/* ── LEFT — Hero + Attendance Rules (fixed, no scroll) ── */}
                <div className="w-[34%] shrink-0 flex flex-col gap-4">

                    <div className={`rounded-2xl overflow-hidden flex items-center px-4 bg-gradient-to-br ${
                            overallStatus === 'safe'
                                ? 'from-emerald-500 to-emerald-600 dark:from-emerald-900 dark:to-emerald-800'
                                : overallStatus === 'condonation'
                                    ? 'from-amber-500 to-amber-600 dark:from-amber-900 dark:to-amber-800'
                                    : 'from-red-500 to-red-600 dark:from-red-900 dark:to-red-800'
                        }`}
                        style={{ minHeight: 220 }}>
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <Image
                                src="/images/attendance.png"
                                alt=""
                                width={360}
                                height={360}
                                priority
                                unoptimized
                                style={{ width: 180, height: 180 }}
                            />
                        </motion.div>
                        <div className="flex-1 flex flex-col items-center">
                            <p className="text-xs font-semibold text-white/75">Overall Attendance</p>
                            <p className="text-5xl font-extrabold text-white leading-tight">{overallPct}%</p>
                            <p className="text-xs text-white/75">{totalAttended} of {totalClasses} classes attended</p>
                            <div className="flex gap-2 mt-2">
                                <span className="text-xs font-bold text-white px-3.5 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                    {overallStatus === 'safe' ? '✅ Good' : overallStatus === 'condonation' ? '⚠️ Condonation Zone' : '🚫 Defaulter'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-card p-3.5">
                        <div className="flex items-center gap-1.5">
                            <Info size={13} className="text-primary" />
                            <p className="text-xs font-semibold text-primary">Attendance Rules</p>
                        </div>
                        <div className="flex flex-wrap gap-2.5 mt-2.5">
                            {[
                                { label: 'Good', range: '≥ 75%', emoji: '✅', cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40' },
                                { label: 'Condonation', range: '65–74%', emoji: '⚠️', cls: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40' },
                                { label: 'Defaulter', range: '< 65%', emoji: '🚫', cls: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/40' },
                            ].map(item => (
                                <span key={item.label} className={`text-[10.5px] font-semibold px-2.5 py-1.5 rounded-full flex items-center gap-1 ${item.cls}`}>
                                    {item.emoji} {item.label} ({item.range})
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT — Month-wise + Attendance Sheet (this side scrolls) ── */}
                <div className="flex-1 min-w-0 self-stretch flex flex-col gap-3 min-h-0 overflow-y-auto pr-2"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>

                    <div className="flex gap-3 shrink-0">
                        <div className="flex flex-col gap-3 w-[140px] shrink-0">
                            <div className="rounded-2xl border border-border/50 bg-card p-4 text-center">
                                <p className={`text-2xl font-black ${pctColor(overallPct)}`}>{overallPct}%</p>
                                <p className="text-[11px] text-muted-foreground mt-1">Overall</p>
                            </div>
                            <div className="rounded-2xl border border-border/50 bg-card p-4 text-center">
                                <p className={`text-2xl font-black ${pctColor(currentMonthPct)}`}>{currentMonthPct}%</p>
                                <p className="text-[11px] text-muted-foreground mt-1">This Month</p>
                            </div>
                        </div>

                        <div className="flex-1 rounded-2xl border border-border/50 bg-card overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Month-wise Attendance</p>
                            </div>
                            <div className="divide-y divide-border/20 overflow-y-auto" style={{ maxHeight: '140px' }}>
                                {MONTHLY.map(m => (
                                    <div key={m.key} className="flex items-center gap-2 px-3 py-1.5">
                                        <p className="text-[10px] font-semibold w-16 shrink-0">{MONTH_FULL[m.month]}</p>
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden relative">
                                            <div className="absolute left-[75%] top-0 bottom-0 w-px bg-muted-foreground/30 z-10" />
                                            <div className="h-full rounded-full" style={{
                                                width: `${m.pct}%`,
                                                background: m.pct >= 75 ? 'linear-gradient(90deg, #10B981, #34D399)' : m.pct >= 65 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #EF4444, #F87171)',
                                            }} />
                                        </div>
                                        <p className={`text-[10px] font-black w-8 text-right ${pctColor(m.pct)}`}>{m.pct}%</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border/50 overflow-hidden shrink-0 flex flex-col">
                        <div className="px-4 py-2.5 border-b border-border/40 bg-card shrink-0 flex items-center justify-between relative">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Attendance Sheet</p>
                            <div className="absolute left-1/2 -translate-x-1/2 flex items-baseline gap-2">
                                <span className="text-[12px] font-semibold text-foreground">{student.name}</span>
                                <span className="text-[11px] text-muted-foreground">Roll No. {ROLL_NO}</span>
                            </div>
                        </div>
                        <div style={{ overflowX: 'scroll', overflowY: 'visible', background: '#F5F8EE', scrollbarWidth: 'thin', scrollbarColor: '#BACE85 #F5F8EE' }}>
                            <table className="text-[10px] border-separate border-spacing-0 min-w-max">
                                <thead className="sticky top-0 z-30">
                                    <tr>
                                        <th className="sticky left-0 z-40 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-2 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap min-w-[40px]">Month</th>
                                        {DATE_COLS.map(d => (
                                            <th key={d} className="bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap min-w-[26px]">{d}</th>
                                        ))}
                                        <th title="Total Present" className="sticky right-[161px] z-40 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-emerald-700 whitespace-nowrap min-w-[32px]">P</th>
                                        <th title="Total Absent" className="sticky right-[129px] z-40 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-red-500 whitespace-nowrap min-w-[32px]">A</th>
                                        <th title="Total Late" className="sticky right-[97px] z-40 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-amber-600 whitespace-nowrap min-w-[32px]">L</th>
                                        <th title="Total Working Days" className="sticky right-[52px] z-40 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap min-w-[45px]">T</th>
                                        <th title="Attendance %" className="sticky right-0 z-40 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap min-w-[52px]">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthData.map(m => {
                                        const counts = Object.values(m.statuses);
                                        const p = counts.filter(s => s === 'P').length;
                                        const a = counts.filter(s => s === 'A').length;
                                        const l = counts.filter(s => s === 'L').length;
                                        const total = p + a + l;
                                        const pct = total > 0 ? Math.round(((p + l) / total) * 100) : null;
                                        return (
                                            <tr key={m.month} className="bg-[#F5F8EE] hover:bg-[#E0E8C8] transition-colors">
                                                <td className="sticky left-0 z-10 border-[0.1px] border-[#BACE85]/50 px-2 py-1.5 font-semibold text-center text-[#2A3A10] bg-[#ECF3D0] whitespace-nowrap">{m.month}</td>
                                                {DATE_COLS.map(d => {
                                                    const isOutOfMonth = d > m.daysInMonth;
                                                    const isSunday = !isOutOfMonth && new Date(YEAR, m.key, d).getDay() === 0;
                                                    const holName = !isOutOfMonth ? HOLIDAYS_BY_MONTH_DAY[m.key]?.[d] : undefined;
                                                    const isHol = !isSunday && !!holName;
                                                    const status = m.statuses[d] ?? null;
                                                    return (
                                                        <td key={d}
                                                            title={holName ?? undefined}
                                                            className={`border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center relative ${isOutOfMonth ? 'bg-[#ECF3D0]/40' : isSunday ? 'bg-[#FFF0F0]' : isHol ? 'bg-[#FEF2F2]' : ''}`}>
                                                            {isOutOfMonth ? (
                                                                <span className="text-[#BACE85]/30">·</span>
                                                            ) : isHol ? (
                                                                <span style={{ color: '#FCA5A5', fontSize: '12px', lineHeight: 1 }}>×</span>
                                                            ) : status ? (
                                                                <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: '14px', fontWeight: 700, color: status === 'P' ? '#16a34a' : status === 'A' ? '#dc2626' : '#d97706', lineHeight: 1, display: 'block' }}>{status}</span>
                                                            ) : (
                                                                <span className="text-[#BACE85]">—</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="sticky right-[161px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center text-emerald-700 font-bold bg-[#F5F8EE]">{p || '—'}</td>
                                                <td className="sticky right-[129px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center text-red-500 font-bold bg-[#F5F8EE]">{a || '—'}</td>
                                                <td className="sticky right-[97px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center text-amber-600 font-bold bg-[#F5F8EE]">{l || '—'}</td>
                                                <td className="sticky right-[52px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center font-bold text-[#2A3A10] bg-[#F5F8EE]">{total || '—'}</td>
                                                <td className={`sticky right-0 z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center font-black bg-[#F5F8EE] ${pct !== null ? pctColor(pct) : 'text-[#BACE85]'}`}>{pct !== null ? `${pct}%` : '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-2 border-t border-border/40 shrink-0 flex items-center gap-4 bg-card">
                            {['Present', 'Absent', 'Late'].map(label => (
                                <div key={label} className="flex items-center gap-1.5">
                                    <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: '16px', fontWeight: 700, lineHeight: 1, color: label === 'Present' ? '#16a34a' : label === 'Absent' ? '#dc2626' : '#d97706' }}>{label[0]}</span>
                                    <span className="text-[10px] text-muted-foreground">{label}</span>
                                </div>
                            ))}
                            <span className="text-[10px] text-muted-foreground/50 ml-auto italic">% = (P + L) / Total</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
