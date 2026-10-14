'use client';

import { ArrowLeft, Info, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useAcademicYear } from '@/context/AcademicYearContext';

const MONTH_FULL: Record<string, string> = {
    Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November',
    Dec: 'December', Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May',
};

function pctColor(p: number | null) {
    if (p === null) return 'text-muted-foreground/40';
    if (p >= 75) return 'text-emerald-500';
    if (p >= 65) return 'text-amber-500';
    return 'text-red-500';
}

interface AttendanceMonth {
    month: string; key: number; year: number;
    present: number; absent: number; leave: number; total: number;
    pct: number | null;
}
interface AttendanceApiData {
    academicYear: string; startYear: number;
    overall: { present: number; absent: number; leave: number; total: number; pct: number | null };
    monthly: AttendanceMonth[];
    daily: Record<string, string>;
    holidays: { date: string; name: string }[];
    student: { name: string; rollNo: string };
}

const DATE_COLS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function AttendanceDetailsPage() {
    const router = useRouter();
    const [data, setData] = useState<AttendanceApiData | null>(null);
    const [loading, setLoading] = useState(true);
    // Two states so hover shows the tooltip transiently while click "pins"
    // it open (stays visible after the mouse leaves, toggles off on a
    // second click) — matches the app's tap-to-pin behaviour.
    const [hoverHoliday, setHoverHoliday] = useState<{ month: string; day: number; name: string } | null>(null);
    const [pinnedHoliday, setPinnedHoliday] = useState<{ month: string; day: number; name: string } | null>(null);
    const activeHoliday = pinnedHoliday ?? hoverHoliday;
    const { selectedYearId, isCurrentYearSelected } = useAcademicYear();
    const effectiveYear = isCurrentYearSelected ? null : selectedYearId;

    useEffect(() => {
        setLoading(true);
        const qs = effectiveYear ? `?academicYearId=${effectiveYear}` : '';
        api.get(`/student/attendance${qs}`)
            .then(r => setData(r.data.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [effectiveYear]);

    // Holiday lookup: "YYYY-MM-DD" → name
    const holidayMap = useMemo(() => {
        const m: Record<string, string> = {};
        for (const h of data?.holidays ?? []) m[h.date] = h.name;
        return m;
    }, [data]);

    const monthData = useMemo(() => {
        if (!data) return [];
        return data.monthly.map(m => {
            const paddedM = String(m.key + 1).padStart(2, '0');
            const daysInMonth = new Date(m.year, m.key + 1, 0).getDate();
            const p = m.present, a = m.absent, l = m.leave, total = m.total;
            const sheetPct = total > 0 ? Math.round(((p + l) / total) * 100) : null;
            return { ...m, daysInMonth, p, a, l, total, sheetPct, paddedM };
        });
    }, [data]);

    const overallPct = data?.overall.pct ?? 0;
    const overallStatus = overallPct >= 75 ? 'safe' : overallPct >= 65 ? 'condonation' : 'defaulter';
    const totalPresent = data?.overall.present ?? 0;
    const totalTotal = data?.overall.total ?? 0;

    const now = new Date();
    const curMonthKey = now.getMonth();
    const currentMonthEntry = data?.monthly.find(m => m.key === curMonthKey);
    const currentMonthPct = currentMonthEntry?.pct ?? 0;

    if (loading) {
        return (
            <div className="flex flex-col h-full">
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
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-primary" />
                </div>
            </div>
        );
    }

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
            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row items-stretch lg:items-start gap-4 py-4">

                {/* ── LEFT — Hero + Attendance Rules (fixed, no scroll) ── */}
                <div className="w-full lg:w-[34%] shrink-0 flex flex-col gap-4">

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
                            <p className="text-4xl lg:text-5xl font-extrabold text-white leading-tight">
                                {overallPct > 0 ? `${overallPct}%` : '—'}
                            </p>
                            <p className="text-xs text-white/75">{totalPresent} of {totalTotal} classes attended</p>
                            <div className="flex gap-2 mt-2">
                                <span className="text-xs font-bold text-white px-3.5 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                    {overallStatus === 'safe' ? '✅ Good' : overallStatus === 'condonation' ? '⚠️ Condonation Zone' : '🚫 Defaulter'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-card p-3.5" data-dashboard-surface="">
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
                <div className="w-full flex-1 min-w-0 self-stretch flex flex-col gap-3 min-h-0 overflow-visible lg:overflow-y-auto pr-0 lg:pr-2"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>

                    <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                        <div className="flex flex-row sm:flex-col gap-3 w-full lg:w-[140px] shrink-0">
                            <div className="flex-1 sm:flex-none rounded-2xl border border-border/50 bg-card p-4 text-center" data-dashboard-surface="">
                                <p className={`text-2xl font-black ${pctColor(overallPct > 0 ? overallPct : null)}`}>
                                    {overallPct > 0 ? `${overallPct}%` : '—'}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-1">Overall</p>
                            </div>
                            <div className="flex-1 sm:flex-none rounded-2xl border border-border/50 bg-card p-4 text-center" data-dashboard-surface="">
                                <p className={`text-2xl font-black ${pctColor(currentMonthPct > 0 ? currentMonthPct : null)}`}>
                                    {currentMonthPct > 0 ? `${currentMonthPct}%` : '—'}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-1">This Month</p>
                            </div>
                        </div>

                        <div className="flex-1 rounded-2xl border border-border/50 bg-card overflow-hidden" data-dashboard-surface="">
                            <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Month-wise Attendance</p>
                            </div>
                            <div className="divide-y divide-border/20 overflow-y-auto" style={{ maxHeight: '140px' }}>
                                {monthData.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground text-center py-4">No attendance records yet</p>
                                ) : monthData.map(m => (
                                    <div key={m.key} className="flex items-center gap-2 px-3 py-1.5">
                                        <p className="text-[10px] font-semibold w-16 shrink-0">{MONTH_FULL[m.month]}</p>
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden relative">
                                            <div className="absolute left-[75%] top-0 bottom-0 w-px bg-muted-foreground/30 z-10" />
                                            {m.pct !== null && (
                                                <div className="h-full rounded-full" style={{
                                                    width: `${m.pct}%`,
                                                    background: m.pct >= 75 ? 'linear-gradient(90deg, #10B981, #34D399)' : m.pct >= 65 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #EF4444, #F87171)',
                                                }} />
                                            )}
                                        </div>
                                        <p className={`text-[10px] font-black w-8 text-right ${pctColor(m.pct)}`}>
                                            {m.pct !== null ? `${m.pct}%` : '—'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border/50 overflow-hidden shrink-0 flex flex-col">
                        <div className="px-4 py-2.5 border-b border-border/40 bg-card shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between relative gap-1">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Attendance Sheet</p>
                            <div className="static lg:absolute lg:left-1/2 lg:-translate-x-1/2 flex items-baseline gap-2">
                                <span className="text-[12px] font-semibold text-foreground">{data?.student.name ?? ''}</span>
                                <span className="text-[11px] text-muted-foreground">Roll No. {data?.student.rollNo ?? ''}</span>
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
                                    {monthData.map(m => (
                                        <tr key={m.month} className="bg-[#F5F8EE] hover:bg-[#E0E8C8] transition-colors">
                                            <td className="sticky left-0 z-10 border-[0.1px] border-[#BACE85]/50 px-2 py-1.5 font-semibold text-center text-[#2A3A10] bg-[#ECF3D0] whitespace-nowrap">{m.month}</td>
                                            {DATE_COLS.map(d => {
                                                const isOutOfMonth = d > m.daysInMonth;
                                                const isSunday = !isOutOfMonth && new Date(m.year, m.key, d).getDay() === 0;
                                                const dateStr = !isOutOfMonth
                                                    ? `${m.year}-${m.paddedM}-${String(d).padStart(2, '0')}`
                                                    : '';
                                                const holName = dateStr ? holidayMap[dateStr] : undefined;
                                                const isHol = !isSunday && !!holName;
                                                const status = dateStr && data ? (data.daily[dateStr] ?? null) : null;
                                                const isActive = isHol && activeHoliday?.month === m.month && activeHoliday?.day === d;
                                                return (
                                                    <td key={d}
                                                        onMouseEnter={isHol ? () => setHoverHoliday({ month: m.month, day: d, name: holName ?? 'Holiday' }) : undefined}
                                                        onMouseLeave={isHol ? () => setHoverHoliday(null) : undefined}
                                                        onClick={isHol ? () => setPinnedHoliday(prev =>
                                                            prev?.month === m.month && prev?.day === d
                                                                ? null
                                                                : { month: m.month, day: d, name: holName ?? 'Holiday' }
                                                        ) : undefined}
                                                        className={`border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center relative ${isOutOfMonth ? 'bg-[#ECF3D0]/40' : isSunday ? 'bg-[#FFF0F0]' : isHol ? 'bg-[#FEF2F2] cursor-pointer' : ''}`}>
                                                        {isOutOfMonth ? (
                                                            <span className="text-[#BACE85]/30">·</span>
                                                        ) : isHol ? (
                                                            <span style={{ color: '#FCA5A5', fontSize: '12px', lineHeight: 1 }}>×</span>
                                                        ) : status ? (
                                                            <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: '14px', fontWeight: 700, color: status === 'P' ? '#16a34a' : status === 'A' ? '#dc2626' : '#d97706', lineHeight: 1, display: 'block' }}>{status}</span>
                                                        ) : (
                                                            <span className="text-[#BACE85]">—</span>
                                                        )}
                                                        {isActive && (
                                                            <div
                                                                className="absolute z-50 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg pointer-events-none"
                                                                style={{
                                                                    background: '#141414',
                                                                    border: '1px solid rgba(148,163,184,0.2)',
                                                                    ...(m === monthData[0] ? { top: 'calc(100% + 6px)' } : { bottom: 'calc(100% + 6px)' }),
                                                                }}
                                                            >
                                                                <p className="text-[10.5px] font-semibold text-white leading-tight">{activeHoliday!.name}</p>
                                                                <p className="text-[9px] text-white/70 leading-tight mt-0.5">{m.month} {d}</p>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="sticky right-[161px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center text-emerald-700 font-bold bg-[#F5F8EE]">{m.p || '—'}</td>
                                            <td className="sticky right-[129px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center text-red-500 font-bold bg-[#F5F8EE]">{m.a || '—'}</td>
                                            <td className="sticky right-[97px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center text-amber-600 font-bold bg-[#F5F8EE]">{m.l || '—'}</td>
                                            <td className="sticky right-[52px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center font-bold text-[#2A3A10] bg-[#F5F8EE]">{m.total || '—'}</td>
                                            <td className={`sticky right-0 z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-1.5 text-center font-black bg-[#F5F8EE] ${m.sheetPct !== null ? pctColor(m.sheetPct) : 'text-[#BACE85]'}`}>
                                                {m.sheetPct !== null ? `${m.sheetPct}%` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-2 border-t border-border/40 shrink-0 flex items-center gap-4 flex-wrap bg-card">
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
