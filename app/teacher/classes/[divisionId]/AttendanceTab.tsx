'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2,
    MessageSquare, Save, ChevronDown, X, Flag, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import NextImage from 'next/image';

// ── Types ─────────────────────────────────────────────────────────────────────
type AttendanceStatus = 'P' | 'A' | 'L' | null;
type SheetEntry = Record<string, AttendanceStatus>;

interface AttendanceStudent {
    id: string;
    studentId: string;
    name: string;
    rollNo: string;
    overallPct: number | null;
    avatarUrl?: string | null;
    /** monthKey (YYYY-MM) → cumulative % from the start of the academic session through that month. */
    cumulativeByMonth?: Record<string, number | null>;
}

interface SummaryStudent {
    studentId: string;
    name: string;
    rollNo: string;
    avatarUrl?: string | null;
    overallPct: number | null;
    currentMonthPct: number | null;
    monthlyStats: { monthKey: string; p: number; a: number; l: number; pct: number | null; cumulativePct: number | null }[];
}

interface ClassStats {
    overallPct: number | null;
    currentMonthPct: number | null;
    monthlyStats: { monthKey: string; avg: number | null; cumulativeAvg: number | null }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
function getAvatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(n: string) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

function pctColor(p: number | null) {
    if (p === null) return 'text-muted-foreground/40';
    if (p >= 75) return 'text-emerald-500';
    if (p >= 65) return 'text-amber-500';
    return 'text-red-500';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(d: Date) {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function dateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function makeDateKey(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
// Parse "YYYY-MM" → { short: "Jun", monthIndex: 5 }
function parseMonthKey(mk: string): { short: string; monthIndex: number } {
    const mm = parseInt(mk.split('-')[1]) - 1;
    return { short: MONTHS_S[mm], monthIndex: mm };
}

// ── Sheet config ──────────────────────────────────────────────────────────────
const STATUS_CELL_CFG = {
    P: { label: 'P', cls: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black' },
    A: { label: 'A', cls: 'bg-red-500/20 text-red-600 dark:text-red-400 font-black' },
    L: { label: 'L', cls: 'bg-amber-400/20 text-amber-600 dark:text-amber-400 font-black' },
};

const SHEET_MONTHS = [
    { key: 5, short: 'Jun' }, { key: 6, short: 'Jul' }, { key: 7, short: 'Aug' }, { key: 8, short: 'Sep' },
    { key: 9, short: 'Oct' }, { key: 10, short: 'Nov' }, { key: 11, short: 'Dec' },
    { key: 0, short: 'Jan' }, { key: 1, short: 'Feb' }, { key: 2, short: 'Mar' }, { key: 3, short: 'Apr' }, { key: 4, short: 'May' },
];

// ── Status Button ─────────────────────────────────────────────────────────────
function StatusBtn({ label, active, onClick, disabled }: {
    label: 'P' | 'A' | 'L'; active: boolean; onClick: () => void; disabled?: boolean;
}) {
    const cfg = {
        P: { active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'border-border/50 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600', tooltip: 'Present' },
        A: { active: 'bg-red-500 text-white border-red-500', inactive: 'border-border/50 text-muted-foreground hover:border-red-400 hover:text-red-600', tooltip: 'Absent' },
        L: { active: 'bg-amber-400 text-white border-amber-400', inactive: 'border-border/50 text-muted-foreground hover:border-amber-400 hover:text-amber-500', tooltip: 'Late' },
    };
    return (
        <button title={cfg[label].tooltip} onClick={onClick} disabled={disabled}
            className={`w-7 h-7 rounded-lg border-2 text-[11px] font-black transition-all flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${active ? cfg[label].active : cfg[label].inactive}`}>
            {label}
        </button>
    );
}

// ── Attendance Sheet (Right Panel) ────────────────────────────────────────────
function AttendanceSheet({ students, selectedDate, attendance, holidays, dateRemarks, onHolidayChange, onRemarkChange, divisionName, divisionId, refreshKey, attBase, readOnly }: {
    students: AttendanceStudent[];
    selectedDate: Date;
    attendance: Record<string, { status: AttendanceStatus; remark: string }>;
    holidays: Record<string, string>;
    dateRemarks: Record<string, string>;
    divisionName: string;
    divisionId: string;
    refreshKey: number;
    attBase: string;
    readOnly?: boolean;
    onHolidayChange: (dk: string, name: string | null) => void;
    onRemarkChange: (dk: string, remark: string) => void;
}) {
    const today = new Date();
    const [activeMonth, setActiveMonth] = useState(selectedDate.getMonth());
    const [monthOffset, setMonthOffset] = useState(0);
    const [monthlyRecords, setMonthlyRecords] = useState<Record<string, AttendanceStatus>>({});

    // ── Popup + Modal state ───────────────────────────────────────────────────
    const [popupDate, setPopupDate] = useState<number | null>(null);
    const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
    const popupRef = useRef<HTMLDivElement>(null);
    const [holidayModalDk, setHolidayModalDk] = useState<string | null>(null);
    const [holidayInput, setHolidayInput] = useState('');
    const [remarkModalDk, setRemarkModalDk] = useState<string | null>(null);
    const [remarkInput, setRemarkInput] = useState('');

    const currentKey = dateKey(selectedDate);
    const startYear = today.getMonth() >= 5 ? today.getFullYear() : today.getFullYear() - 1;
    const year = activeMonth >= 5 ? startYear : startYear + 1;
    const daysInMonth = new Date(year, activeMonth + 1, 0).getDate();
    const visibleDates = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    // The "Σ%" column is the cumulative % from the start of the academic
    // session (June) through the currently active month — it must be looked
    // up per-month, not a single frozen value.
    const activeMonthKey = `${year}-${String(activeMonth + 1).padStart(2, '0')}`;
    const cumulativePctFor = (student: AttendanceStudent) => student.cumulativeByMonth?.[activeMonthKey] ?? null;

    const isWeekend = (d: number) => new Date(year, activeMonth, d).getDay() === 0;
    const isSelectedDateCell = (d: number) => d === selectedDate.getDate() && activeMonth === selectedDate.getMonth();

    // ── Fetch monthly data when activeMonth or refreshKey changes ─────────────
    useEffect(() => {
        const monthStr = `${year}-${String(activeMonth + 1).padStart(2, '0')}`;
        api.get(`${attBase}/monthly?month=${monthStr}`)
            .then(res => {
                const recs: Record<string, AttendanceStatus> = {};
                res.data.data.records.forEach((r: { studentId: string; date: string; status: string }) => {
                    recs[`${r.studentId}::${r.date}`] = r.status as AttendanceStatus;
                });
                setMonthlyRecords(recs);
            })
            .catch(() => setMonthlyRecords({}));
    }, [activeMonth, divisionId, year, refreshKey]);

    // ── Live data getters ─────────────────────────────────────────────────────
    const getLiveStatus = (studentId: string, dk: string): AttendanceStatus => {
        if (dk === currentKey) return attendance[studentId]?.status ?? null;
        return monthlyRecords[`${studentId}::${dk}`] ?? null;
    };

    const getLiveRemark = (studentId: string, dk: string): string => {
        if (dk === currentKey) return attendance[studentId]?.remark ?? '';
        return '';
    };

    // ── Export state ──────────────────────────────────────────────────────────
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showMonthSelector, setShowMonthSelector] = useState(false);
    const [selectedExportMonths, setSelectedExportMonths] = useState<number[]>([]);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const exportMonthSheet = (monthKey: number) => {
        const exportYear = monthKey >= 5 ? startYear : startYear + 1;
        const days = new Date(exportYear, monthKey + 1, 0).getDate();
        const dates = Array.from({ length: days }, (_, i) => i + 1);
        const exportMonthStr = `${exportYear}-${String(monthKey + 1).padStart(2, '0')}`;
        const headers = ['Roll No.', 'Name', 'Student ID', ...dates.map(String), 'P', 'A', 'L', '%', 'Cumulative %'];
        const rows = students.map(student => {
            let p = 0, a = 0, l = 0;
            const dateCells = dates.map(d => {
                const dk = makeDateKey(exportYear, monthKey, d);
                if (holidays[dk]) return 'H';
                const status = getLiveStatus(student.id, dk);
                if (status === 'P') p++;
                else if (status === 'A') a++;
                else if (status === 'L') l++;
                return status ?? '—';
            });
            const total = p + a + l;
            const pct = total > 0 ? `${Math.round(((p + l) / total) * 100)}%` : '—';
            const cumulativePct = student.cumulativeByMonth?.[exportMonthStr] ?? null;
            return [student.rollNo, student.name, student.studentId, ...dateCells, p || '—', a || '—', l || '—', pct, cumulativePct !== null ? `${cumulativePct}%` : '—'];
        });
        return { headers, rows, sheetName: MONTHS_S[monthKey], exportYear };
    };

    const handleExportThisMonth = async () => {
        const XLSX = await import('xlsx');
        const { headers, rows, sheetName, exportYear } = exportMonthSheet(activeMonth);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${sheetName} Attendance`);
        XLSX.writeFile(wb, `Attendance_${sheetName}_${exportYear}.xlsx`);
        setShowExportMenu(false);
    };

    const handleExportSelectedMonths = async () => {
        if (selectedExportMonths.length === 0) return;
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        selectedExportMonths.forEach(monthKey => {
            const { headers, rows, sheetName, exportYear } = exportMonthSheet(monthKey);
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, `${sheetName} ${exportYear} Attendance`);
        });
        XLSX.writeFile(wb, `Attendance_${year}_Selected.xlsx`);
        setShowMonthSelector(false);
        setSelectedExportMonths([]);
    };

    // ── Close popup on outside click ──────────────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                setPopupDate(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleDateClick = (d: number, e: React.MouseEvent) => {
        if (readOnly) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPopupPos({ x: rect.left, y: rect.bottom + 4 });
        setPopupDate(prev => prev === d ? null : d);
    };

    const academicYear = activeMonth >= 5
        ? `${year}–${String(year + 1).slice(2)}`
        : `${year - 1}–${String(year).slice(2)}`;

    return (
        <div className="w-full lg:w-[65%] h-[500px] lg:h-auto shrink-0 lg:shrink flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl shadow-sm shadow-black/5">

            {/* Header — Month navigator */}
            <div className="px-4 py-2.5 border-b border-border/40 shrink-0 flex items-center gap-3">
                <div className="shrink-0">
                    <p className="text-[14px] font-bold flex items-center gap-2">
                        <CalendarDays size={14} /> {divisionName} Attendance Sheet
                    </p>
                    <p className="px-6 text-[10.5px] text-muted-foreground">
                        Academic Year {academicYear}
                    </p>
                </div>

                {/* Month navigator */}
                <div className="flex items-center gap-1">
                    <button onClick={() => setMonthOffset(v => Math.max(0, v - 1))} disabled={monthOffset === 0}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all">
                        <ChevronLeft size={13} />
                    </button>
                    <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-border/40">
                        {SHEET_MONTHS.slice(monthOffset, monthOffset + 3).map(m => {
                            const isActive = activeMonth === m.key;
                            const hasSelectedDate = selectedDate.getMonth() === m.key;
                            return (
                                <button key={m.key} onClick={() => setActiveMonth(m.key)}
                                    className={`relative px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {m.short}
                                    {hasSelectedDate && !isActive && (
                                        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#DA7756]" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button onClick={() => setMonthOffset(v => Math.min(SHEET_MONTHS.length - 3, v + 1))} disabled={monthOffset >= SHEET_MONTHS.length - 3}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all">
                        <ChevronRight size={13} />
                    </button>
                </div>

                {/* Export button */}
                <div className="ml-auto relative" ref={exportMenuRef}>
                    <button onClick={() => setShowExportMenu(v => !v)}
                        className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        ⬇ Export <ChevronDown size={11} />
                    </button>
                    <AnimatePresence>
                        {showExportMenu && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                className="absolute right-0 top-9 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
                                <button onClick={handleExportThisMonth}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2">
                                    <span>📅</span><span>This Month ({MONTHS_S[activeMonth]})</span>
                                </button>
                                <button onClick={() => { setShowExportMenu(false); setShowMonthSelector(true); setSelectedExportMonths([]); }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2">
                                    <span>🗓️</span><span>Select Months</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Month selector modal */}
            <AnimatePresence>
                {showMonthSelector && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold">🗓️ Select Months to Export</p>
                                <button onClick={() => setShowMonthSelector(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {SHEET_MONTHS.map(m => {
                                    const isChecked = selectedExportMonths.includes(m.key);
                                    return (
                                        <button key={m.key}
                                            onClick={() => setSelectedExportMonths(prev =>
                                                prev.includes(m.key) ? prev.filter(k => k !== m.key) : [...prev, m.key]
                                            )}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all
                                    ${isChecked ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border-2 transition-all
                                    ${isChecked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                                                {isChecked && <span className="text-white text-[8px] font-black">✓</span>}
                                            </div>
                                            {m.short}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2 mb-4">
                                <button onClick={() => setSelectedExportMonths(SHEET_MONTHS.map(m => m.key))}
                                    className="flex-1 h-7 rounded-lg border border-border/50 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Select All
                                </button>
                                <button onClick={() => setSelectedExportMonths([])}
                                    className="flex-1 h-7 rounded-lg border border-border/50 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Clear
                                </button>
                            </div>
                            <button onClick={handleExportSelectedMonths} disabled={selectedExportMonths.length === 0}
                                className="w-full h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                ⬇ Download {selectedExportMonths.length > 0 ? `(${selectedExportMonths.length} month${selectedExportMonths.length > 1 ? 's' : ''})` : ''}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Sheet table */}
            <div style={{ flex: 1, minHeight: 0, overflowX: 'scroll', overflowY: 'auto', background: '#F5F8EE', scrollbarWidth: 'thin', scrollbarColor: '#BACE85 #F5F8EE' }}>
                <table className="text-[10px] border-separate border-spacing-0" style={{ tableLayout: 'fixed' }}>
                    <thead className="sticky top-0 z-30">
                        <tr className="text-[11.5px]">
                            <th className="sticky left-[0px] z-20 bg-[#ECF3D0] border border-[#BACE85]/50 px-2 py-1 text-left text-[11px] font-semibold text-[#2A3A10] whitespace-nowrap w-[68px] min-w-[68px]">Roll No.</th>
                            <th className="sticky left-[68px] z-20 bg-[#ECF3D0] border border-[#BACE85]/50 px-2 py-1 text-left text-[11px] font-semibold text-[#2A3A10] whitespace-nowrap w-[140px] min-w-[140px]">Name</th>
                            <th className="bg-[#ECF3D0] border border-[#BACE85]/50 px-2 py-1 text-left text-[11px] font-semibold text-[#2A3A10] whitespace-nowrap w-[95px] min-w-[95px]">Student ID</th>
                            {visibleDates.map(d => {
                                const dk = makeDateKey(year, activeMonth, d);
                                const isSelected = isSelectedDateCell(d);
                                const weekend = isWeekend(d);
                                const isHoliday = !!holidays[dk];
                                const hasRemark = !!dateRemarks[dk];
                                return (
                                    <th key={d} onClick={(e) => handleDateClick(d, e)}
                                        className={`border border-[#BACE85]/50 px-1 py-2 text-center font-semibold whitespace-nowrap w-[30px] min-w-[30px] cursor-pointer relative select-none
                                            ${isHoliday ? 'bg-[#FFF0F0] text-red-500'
                                                : isSelected ? 'bg-[#EEF4FF] text-[#4A6FA5]'
                                                    : weekend ? 'bg-[#FFF0F0] text-red-500'
                                                        : 'bg-[#ECF3D0] text-[#2A3A10]'}`}>
                                        {d}
                                        {hasRemark && !isHoliday && (
                                            <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-[#DA7756]" />
                                        )}
                                    </th>
                                );
                            })}
                            <th title="Total Present" className="sticky right-[239px] z-20 bg-[#ECF3D0] border border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-emerald-700 whitespace-nowrap w-[40px] min-w-[40px]">P</th>
                            <th title="Total Absent" className="sticky right-[199px] z-20 bg-[#ECF3D0] border border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-red-500 whitespace-nowrap w-[40px] min-w-[40px]">A</th>
                            <th title="Total Late" className="sticky right-[159px] z-20 bg-[#ECF3D0] border border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-amber-600 whitespace-nowrap w-[40px] min-w-[40px]">L</th>
                            <th title="Total Working Days" className="sticky right-[114px] z-20 bg-[#ECF3D0] border border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap w-[45px] min-w-[45px]">T</th>
                            <th title="Current Month %" className="sticky right-[58px] z-20 bg-[#ECF3D0] border border-[#BACE85]/50 px-2 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap w-[56px] min-w-[56px]">%</th>
                            <th title="Cumulative % — start of session through this month" className="sticky right-0 z-20 bg-[#ECF3D0] border border-[#BACE85]/50 px-2 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap w-[58px] min-w-[58px]">&#x2211;%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, si) => {
                            let p = 0, a = 0, l = 0;
                            visibleDates.forEach(d => {
                                const dk = makeDateKey(year, activeMonth, d);
                                if (holidays[dk]) return;
                                const status = getLiveStatus(student.id, dk);
                                if (status === 'P') p++;
                                else if (status === 'A') a++;
                                else if (status === 'L') l++;
                            });
                            const total = p + a + l;
                            const pct = total > 0 ? Math.round(((p + l) / total) * 100) : null;

                            return (
                                <tr key={student.id} className="bg-[#F5F8EE] hover:bg-[#E0E8C8] transition-colors">
                                    <td className="sticky left-0 z-10 border border-[#BACE85]/50 px-2 py-2 text-[11px] font-semibold text-center text-[#2A3A10] bg-[#F5F8EE] w-[68px]">{student.rollNo}</td>
                                    <td className="sticky left-[68px] z-10 border border-[#BACE85]/50 px-2 py-1.5 text-[11px] font-medium whitespace-nowrap text-[#2A3A10] bg-[#F5F8EE] w-[140px] overflow-hidden">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-[9px] font-bold text-white shrink-0 relative"
                                                style={{ background: student.avatarUrl ? 'transparent' : getAvatarColor(student.name) }}>
                                                {student.avatarUrl
                                                    ? <NextImage src={student.avatarUrl} alt={student.name} fill sizes="20px" className="object-cover" />
                                                    : getInitials(student.name)}
                                            </div>
                                            <span className="truncate">{student.name}</span>
                                        </div>
                                    </td>
                                    <td className="border border-[#BACE85]/50 px-2 py-2 font-mono text-[12px] whitespace-nowrap bg-[#F5F8EE]" style={{ color: '#DA7756' }}>
                                        {student.studentId}
                                    </td>
                                    {visibleDates.map(d => {
                                        const dk = makeDateKey(year, activeMonth, d);
                                        const status = getLiveStatus(student.id, dk);
                                        const remark = getLiveRemark(student.id, dk);
                                        const isSelected = isSelectedDateCell(d);
                                        const weekend = isWeekend(d);
                                        const isHoliday = !!holidays[dk];
                                        if (isHoliday) {
                                            if (si === 0) {
                                                return (
                                                    <td key={d} rowSpan={students.length}
                                                        className="border border-red-200 text-center align-middle relative"
                                                        style={{ background: '#FEF2F2', minWidth: '30px', fontFamily: 'Arial, "Segoe UI", sans-serif' }}>
                                                        <div className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: 'Arial, "Segoe UI", sans-serif' }}>
                                                            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                                                                <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#FCA5A5" strokeWidth="1" />
                                                            </svg>
                                                            <span style={{
                                                                color: '#ef4444', fontWeight: '700',
                                                                whiteSpace: 'nowrap', writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                                                                background: '#FEF2F2', padding: '2px 0', position: 'relative', zIndex: 1,
                                                                fontFamily: 'Arial, "Segoe UI", sans-serif', letterSpacing: '0.5px', fontSize: '11px',
                                                            }}>
                                                                {holidays[dk] ? `Holiday — ${holidays[dk]}` : 'Holiday'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            return null;
                                        }
                                        return (
                                            <td key={d}
                                                onClick={() => { if (remark) { setRemarkInput(remark); setRemarkModalDk(`${student.id}::${dk}`); } }}
                                                className={`border border-[#BACE85]/50 px-1 py-2 text-center relative
                                                    ${remark ? 'cursor-pointer' : 'cursor-default'}
                                                    ${isSelected ? 'bg-[#EEF4FF]' : weekend ? 'bg-[#FFF5F5]' : ''}`}>
                                                {status ? (
                                                    <span style={{
                                                        fontFamily: "'Patrick Hand', cursive", fontSize: '16px', fontWeight: '700',
                                                        color: status === 'P' ? '#16a34a' : status === 'A' ? '#dc2626' : '#d97706',
                                                        lineHeight: 1, display: 'block',
                                                    }}>{status}</span>
                                                ) : (
                                                    <span className="text-[#BACE85]">—</span>
                                                )}
                                                {remark && <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-[#DA7756]" />}
                                            </td>
                                        );
                                    })}
                                    <td className="sticky right-[239px] z-10 border border-[#BACE85]/50 px-1 py-2 text-center text-[11.5px] text-emerald-700 font-bold bg-[#F5F8EE] w-[40px]">{p || '—'}</td>
                                    <td className="sticky right-[199px] z-10 border border-[#BACE85]/50 px-1 py-2 text-center text-[11.5px] text-red-500 font-bold bg-[#F5F8EE] w-[40px]">{a || '—'}</td>
                                    <td className="sticky right-[159px] z-10 border border-[#BACE85]/50 px-1 py-2 text-center text-[11.5px] text-amber-600 font-bold bg-[#F5F8EE] w-[40px]">{l || '—'}</td>
                                    <td className="sticky right-[114px] z-10 border border-[#BACE85]/50 px-1 py-2 text-center text-[11.5px] font-bold text-[#2A3A10] bg-[#F5F8EE] w-[45px]">{total || '—'}</td>
                                    <td className={`sticky right-[58px] z-10 border border-[#BACE85]/50 px-2 py-2 text-center text-[11.5px] font-black bg-[#F5F8EE] w-[56px] ${pct !== null ? pctColor(pct) : 'text-[#BACE85]'}`}>
                                        {pct !== null ? `${pct}%` : '—'}
                                    </td>
                                    <td title="Cumulative % — start of session through this month" className={`sticky right-0 z-10 border border-[#BACE85]/50 px-2 py-2 text-center text-[11.5px] font-black bg-[#F5F8EE] w-[58px] ${pctColor(cumulativePctFor(student))}`}>
                                        {cumulativePctFor(student) !== null ? `${cumulativePctFor(student)}%` : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer — Legend */}
            <div className="px-4 py-2 border-t border-border/40 shrink-0 flex items-center gap-4 bg-card">
                {[
                    { label: 'Present', cls: 'bg-emerald-500/20 text-emerald-600' },
                    { label: 'Absent', cls: 'bg-red-500/20 text-red-500' },
                    { label: 'Late', cls: 'bg-amber-400/20 text-amber-500' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: '16px', fontWeight: '700', lineHeight: 1, color: item.label === 'Present' ? '#16a34a' : item.label === 'Absent' ? '#dc2626' : '#d97706' }}>
                            {item.label[0]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{item.label}</span>
                    </div>
                ))}
                <span className="text-[10px] text-muted-foreground/40 ml-1 italic">Click any date header for options</span>
                <span className="text-[10px] text-muted-foreground/50 ml-auto italic">% = (P + L) / Total</span>
            </div>

            {/* Date header click popup */}
            <AnimatePresence>
                {popupDate !== null && (
                    <motion.div ref={popupRef}
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        className="fixed z-[100] bg-card border border-border rounded-xl shadow-2xl py-1 min-w-[190px]"
                        style={{ top: popupPos.y, left: Math.min(popupPos.x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 200) }}>
                        <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground border-b border-border/40">
                            {popupDate} {MONTHS_S[activeMonth]}, {year}
                        </p>
                        <button onClick={() => {
                            const dk = makeDateKey(year, activeMonth, popupDate);
                            if (holidays[dk]) { onHolidayChange(dk, null); }
                            else { setHolidayInput(''); setHolidayModalDk(dk); }
                            setPopupDate(null);
                        }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2">
                            <span>🏖️</span>
                            <span>{holidays[makeDateKey(year, activeMonth, popupDate)] ? 'Remove Holiday' : 'Mark as Holiday'}</span>
                        </button>
                        <button onClick={() => {
                            const dk = makeDateKey(year, activeMonth, popupDate);
                            setRemarkInput(dateRemarks[dk] ?? '');
                            setRemarkModalDk(dk);
                            setPopupDate(null);
                        }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2">
                            <span>💬</span><span>View / Edit Remark</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Holiday name modal */}
            <AnimatePresence>
                {holidayModalDk && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-bold">🏖️ Mark as Holiday</p>
                                <button onClick={() => setHolidayModalDk(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"><X size={14} /></button>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">Enter holiday name (e.g. Maharashtra Day)</p>
                            <input autoFocus value={holidayInput} onChange={e => setHolidayInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { onHolidayChange(holidayModalDk, holidayInput.trim() || 'Holiday'); setHolidayModalDk(null); } }}
                                placeholder="e.g. Maharashtra Day, Diwali..."
                                className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all mb-3" />
                            <button onClick={() => { onHolidayChange(holidayModalDk, holidayInput.trim() || 'Holiday'); setHolidayModalDk(null); }}
                                className="w-full h-9 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                style={{ background: '#ef4444' }}>
                                Mark as Holiday
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Remark modal */}
            <AnimatePresence>
                {remarkModalDk && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-bold">💬 {remarkModalDk.includes('::') ? 'Student Remark' : 'Date Note'}</p>
                                <button onClick={() => setRemarkModalDk(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"><X size={14} /></button>
                            </div>
                            {remarkModalDk.includes('::') ? (
                                <p className="text-xs text-muted-foreground mb-3">This remark is read-only in the sheet view. Edit it from the daily attendance list.</p>
                            ) : (
                                <p className="text-xs text-muted-foreground mb-3">Note for this date (saved instantly).</p>
                            )}
                            <textarea
                                autoFocus
                                value={remarkInput}
                                onChange={e => setRemarkInput(e.target.value)}
                                readOnly={remarkModalDk.includes('::')}
                                placeholder="Write remark..."
                                rows={3}
                                className="w-full px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all mb-3 resize-none disabled:opacity-60" />
                            <div className="flex gap-2">
                                <button onClick={() => setRemarkModalDk(null)}
                                    className="flex-1 h-9 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    {remarkModalDk.includes('::') ? 'Close' : 'Cancel'}
                                </button>
                                {!remarkModalDk.includes('::') && (
                                    <button onClick={() => { onRemarkChange(remarkModalDk, remarkInput); setRemarkModalDk(null); }}
                                        className="flex-1 h-9 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        Save Note
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Overall Tab ───────────────────────────────────────────────────────────────
function OverallTab({ divisionName, divisionId, holidays, onSwitchToDaily, onStatsLoad, attBase }: {
    divisionName: string;
    divisionId: string;
    holidays: Record<string, string>;
    onSwitchToDaily: () => void;
    onStatsLoad?: (stats: { overall: number | null; thisMonth: number | null }) => void;
    attBase: string;
}) {
    const [summaryStudents, setSummaryStudents] = useState<SummaryStudent[]>([]);
    const [classStats, setClassStats] = useState<ClassStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState<SummaryStudent | null>(null);
    const [showListMenu, setShowListMenu] = useState(false);
    const [overallRightTab, setOverallRightTab] = useState<'class' | 'student'>('class');
    const [shortTab, setShortTab] = useState<'month' | 'overall'>('month');
    const [studentRecords, setStudentRecords] = useState<Record<string, AttendanceStatus>>({});
    const [loadingStudentRec, setLoadingStudentRec] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.get(`${attBase}/summary`)
            .then(res => {
                if (cancelled) return;
                const { students, classStats: cs } = res.data.data;
                setSummaryStudents(students);
                setClassStats(cs);
                if (students.length > 0) setSelectedStudent(students[0]);
                onStatsLoad?.({ overall: cs.overallPct ?? null, thisMonth: cs.currentMonthPct ?? null });
            })
            .catch(err => { if (!cancelled) console.error(err); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [divisionId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch student records when selected student changes — use full academic year range
    useEffect(() => {
        if (!selectedStudent) return;
        setLoadingStudentRec(true);
        const now = new Date();
        const sy = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
        api.get(`${attBase}/student-records/${selectedStudent.studentId}?startDate=${sy}-06-01&endDate=${sy + 1}-05-31`)
            .then(res => {
                const recs: Record<string, AttendanceStatus> = {};
                res.data.data.records.forEach((r: { date: string; status: string }) => {
                    recs[r.date] = r.status as AttendanceStatus;
                });
                setStudentRecords(recs);
            })
            .catch(console.error)
            .finally(() => setLoadingStudentRec(false));
    }, [selectedStudent?.studentId, divisionId]);

    // Convert holidays to month/day format for the student sheet
    const holidaysByMonthDay: Record<number, Record<number, string>> = {};
    Object.entries(holidays).forEach(([date, name]) => {
        const parts = date.split('-');
        const mm = parseInt(parts[1]) - 1;
        const dd = parseInt(parts[2]);
        if (!holidaysByMonthDay[mm]) holidaysByMonthDay[mm] = {};
        holidaysByMonthDay[mm][dd] = name;
    });

    const now = new Date();
    const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
    const year = now.getFullYear(); // calendar year — kept for month-key calculations in class stats

    const generateList = (type: 'all' | 'current') => {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthShort = MONTHS_S[now.getMonth()];
        const lines: string[] = [];

        if (type === 'all') {
            const allMonths = new Set<string>();
            summaryStudents.forEach(s => s.monthlyStats.forEach(m => allMonths.add(m.monthKey)));
            const monthKeys = Array.from(allMonths).sort();
            lines.push(`Attendance Report — All Months\n`);
            lines.push(`${'Roll'.padEnd(6)}${'Name'.padEnd(22)}${monthKeys.map(mk => parseMonthKey(mk).short.padEnd(8)).join('')}Overall`);
            lines.push('─'.repeat(70));
            summaryStudents.forEach(s => {
                const monthCols = monthKeys.map(mk => {
                    const m = s.monthlyStats.find(ms => ms.monthKey === mk);
                    return `${m?.pct ?? '—'}%`.padEnd(8);
                }).join('');
                lines.push(`${s.rollNo.padEnd(6)}${s.name.padEnd(22)}${monthCols}${s.overallPct ?? '—'}%`);
            });
        } else {
            lines.push(`Attendance Report — ${currentMonthShort} (Current Month)\n`);
            lines.push(`${'Roll'.padEnd(6)}${'Name'.padEnd(22)}${currentMonthShort.padEnd(10)}Overall`);
            lines.push('─'.repeat(45));
            summaryStudents.forEach(s => {
                const m = s.monthlyStats.find(ms => ms.monthKey === currentMonthKey);
                lines.push(`${s.rollNo.padEnd(6)}${s.name.padEnd(22)}${`${m?.pct ?? '—'}%`.padEnd(10)}${s.overallPct ?? '—'}%`);
            });
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `attendance-${type}.txt`; a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return (
        <div className="flex flex-col lg:flex-row gap-3 h-full min-h-0 overflow-y-auto lg:overflow-visible">

            {/* LEFT — Students list */}
            <div className="w-full lg:w-[30%] h-[380px] lg:h-auto shrink-0 lg:shrink flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-3.5 border-b border-border/40 shrink-0">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold flex items-center gap-2"><Users size={14} /> Students ({summaryStudents.length})</p>
                        <div className="relative">
                            <button onClick={() => setShowListMenu(v => !v)}
                                className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                Get List <ChevronDown size={11} />
                            </button>
                            <AnimatePresence>
                                {showListMenu && (
                                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                        className="absolute right-0 top-8 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                                        <button onClick={() => { generateList('all'); setShowListMenu(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted">📋 All Months</button>
                                        <button onClick={() => { generateList('current'); setShowListMenu(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted">📅 Current Month</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto bg-background">
                    {summaryStudents.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">No students found</p>
                    ) : summaryStudents.map(student => {
                        const isSelected = selectedStudent?.studentId === student.studentId;
                        return (
                            <button key={student.studentId} onClick={() => {
                                setSelectedStudent(prev => prev?.studentId === student.studentId ? null : student);
                                setOverallRightTab('student');
                            }}
                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-colors hover:bg-muted/30 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold text-white shrink-0 relative" style={{ background: student.avatarUrl ? 'transparent' : getAvatarColor(student.name) }}>
                                    {student.avatarUrl
                                        ? <NextImage src={student.avatarUrl} alt={student.name} fill sizes="28px" className="object-cover" />
                                        : getInitials(student.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate">{student.name}</p>
                                    <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="text-right">
                                        <p className={`text-[11px] font-black ${pctColor(student.overallPct)}`}>{student.overallPct !== null ? `${student.overallPct}%` : '—'}</p>
                                        <p className="text-[9px] text-muted-foreground/60">overall</p>
                                    </div>
                                    <div className="w-px h-6 bg-border/40" />
                                    <div className="text-right">
                                        <p className={`text-[11px] font-black ${pctColor(student.currentMonthPct)}`}>{student.currentMonthPct !== null ? `${student.currentMonthPct}%` : '—'}</p>
                                        <p className="text-[9px] text-muted-foreground/60">this month</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT — Attendance details */}
            <div className="w-full lg:flex-1 h-[65vh] lg:h-auto flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-2.5 border-b border-border/40 shrink-0 flex items-center gap-3">
                    <p className="text-sm font-bold shrink-0 flex items-center gap-1.5">
                        <CalendarDays size={14} /> {divisionName}
                    </p>
                    <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/40">
                        {([
                            { key: 'class' as const, label: 'Class Overview' },
                            { key: 'student' as const, label: 'Student Details' },
                        ]).map(tab => {
                            const isActive = overallRightTab === tab.key;
                            return (
                                <button key={tab.key} onClick={() => setOverallRightTab(tab.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                    <AnimatePresence>
                        {overallRightTab === 'student' && selectedStudent && (
                            <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                                className="flex items-center gap-2 ml-auto">
                                <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-red-500 hover:border-red-400/50 transition-all">
                                    <Flag size={11} /> Report
                                </button>
                                <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                                    <ExternalLink size={10} /> View Profile
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="flex-1 overflow-y-auto bg-background px-4 py-3">
                    {overallRightTab === 'class' ? (
                        <div className="space-y-4">
                            {/* Class overall stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-border/50 bg-card p-4 text-center">
                                    <p className={`text-2xl font-black ${pctColor(classStats?.overallPct ?? null)}`}>
                                        {classStats?.overallPct !== null && classStats?.overallPct !== undefined ? `${classStats.overallPct}%` : '—'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">Class Overall</p>
                                </div>
                                <div className="rounded-2xl border border-border/50 bg-card p-4 text-center">
                                    <p className={`text-2xl font-black ${pctColor(classStats?.currentMonthPct ?? null)}`}>
                                        {classStats?.currentMonthPct !== null && classStats?.currentMonthPct !== undefined ? `${classStats.currentMonthPct}%` : '—'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">This Month Avg</p>
                                </div>
                            </div>

                            {/* Month wise breakdown */}
                            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Month-wise Class Average</p>
                                    <button onClick={onSwitchToDaily}
                                        className="flex items-center gap-1.5 h-6 px-2.5 rounded-lg border border-border/50 text-[10px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                                        <CalendarDays size={10} /> View Daily
                                    </button>
                                </div>
                                <div className="divide-y divide-border/20 max-h-[160px] overflow-y-auto">
                                    {[
                                        { month: 'June', key: '06' }, { month: 'July', key: '07' },
                                        { month: 'August', key: '08' }, { month: 'September', key: '09' },
                                        { month: 'October', key: '10' }, { month: 'November', key: '11' },
                                        { month: 'December', key: '12' }, { month: 'January', key: '01' },
                                        { month: 'February', key: '02' }, { month: 'March', key: '03' },
                                        { month: 'April', key: '04' }, { month: 'May', key: '05' },
                                    ].map(m => {
                                        const yr = parseInt(m.key) >= 6 ? year : year + 1;
                                        const mk = `${yr}-${m.key}`;
                                        const stat = classStats?.monthlyStats.find(s => s.monthKey === mk);
                                        const avg = stat?.avg ?? null;
                                        return (
                                            <div key={m.key} className="flex items-center gap-3 px-4 py-2.5">
                                                <p className="text-xs font-semibold w-24 shrink-0">{m.month}</p>
                                                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                                    {avg !== null ? (
                                                        <div className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${avg}%`,
                                                                background: avg >= 75 ? 'linear-gradient(90deg, #10B981, #34D399)' : avg >= 65 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #EF4444, #F87171)'
                                                            }} />
                                                    ) : <div className="h-full w-0" />}
                                                </div>
                                                <p className={`text-xs font-black w-10 text-right ${avg !== null ? pctColor(avg) : 'text-muted-foreground/40'}`}>
                                                    {avg !== null ? `${avg}%` : '—'}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Short Attendance */}
                            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center gap-2">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">Short Attendance</p>
                                    <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-border/40">
                                        {([
                                            { key: 'month' as const, label: 'This Month' },
                                            { key: 'overall' as const, label: 'Overall' },
                                        ]).map(t => (
                                            <button key={t.key} onClick={() => setShortTab(t.key)}
                                                className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-all ${shortTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-[11px] font-bold text-red-500 shrink-0">
                                        {summaryStudents.filter(s => shortTab === 'month' ? (s.currentMonthPct ?? 100) < 75 : (s.overallPct ?? 100) < 75).length} students
                                    </span>
                                </div>
                                <div className="divide-y divide-border/20 overflow-y-auto" style={{ maxHeight: '176px' }}>
                                    {(() => {
                                        const filtered = summaryStudents.filter(s =>
                                            shortTab === 'month' ? (s.currentMonthPct ?? 100) < 75 : (s.overallPct ?? 100) < 75
                                        );
                                        if (filtered.length === 0) {
                                            return <p className="px-4 py-3 text-xs text-emerald-500 font-semibold text-center">✓ All students above 75%</p>;
                                        }
                                        return filtered.map(student => {
                                            const pct = shortTab === 'month' ? student.currentMonthPct : student.overallPct;
                                            return (
                                                <div key={student.studentId} className="flex items-center gap-3 px-4 py-2.5">
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                        style={{ background: getAvatarColor(student.name) }}>
                                                        {getInitials(student.name)}
                                                    </div>
                                                    <p className="text-xs font-semibold flex-1 truncate">{student.name}</p>
                                                    <p className="text-[11px] text-muted-foreground">Roll {student.rollNo}</p>
                                                    <p className={`text-xs font-black ${pctColor(pct)}`}>{pct !== null ? `${pct}%` : '—'}</p>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    ) : (
                        selectedStudent ? (
                            <div className="space-y-4">
                                {/* Top section — stats left, monthwise right */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex flex-row sm:flex-col gap-3 w-full sm:w-[140px] shrink-0">
                                        <div className="rounded-2xl border border-border/50 bg-card p-4 text-center">
                                            <p className={`text-2xl font-black ${pctColor(selectedStudent.overallPct)}`}>
                                                {selectedStudent.overallPct !== null ? `${selectedStudent.overallPct}%` : '—'}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-1">Overall</p>
                                        </div>
                                        <div className="rounded-2xl border border-border/50 bg-card p-4 text-center">
                                            <p className={`text-2xl font-black ${pctColor(selectedStudent.currentMonthPct)}`}>
                                                {selectedStudent.currentMonthPct !== null ? `${selectedStudent.currentMonthPct}%` : '—'}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-1">This Month</p>
                                        </div>
                                    </div>

                                    {/* Month-wise bars */}
                                    <div className="flex-1 rounded-2xl border border-border/50 bg-card overflow-hidden">
                                        <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Month-wise Attendance</p>
                                        </div>
                                        <div className="divide-y divide-border/20 overflow-y-auto" style={{ maxHeight: '140px' }}>
                                            {[
                                                { month: 'June', key: '06' }, { month: 'July', key: '07' },
                                                { month: 'August', key: '08' }, { month: 'September', key: '09' },
                                                { month: 'October', key: '10' }, { month: 'November', key: '11' },
                                                { month: 'December', key: '12' }, { month: 'January', key: '01' },
                                                { month: 'February', key: '02' }, { month: 'March', key: '03' },
                                                { month: 'April', key: '04' }, { month: 'May', key: '05' },
                                            ].map(m => {
                                                const yr = parseInt(m.key) >= 6 ? year : year + 1;
                                                const mk = `${yr}-${m.key}`;
                                                const stat = selectedStudent.monthlyStats.find(s => s.monthKey === mk);
                                                const pct = stat?.pct ?? null;
                                                return (
                                                    <div key={m.key} className="flex items-center gap-2 px-3 py-1.5">
                                                        <p className="text-[10px] font-semibold w-16 shrink-0">{m.month}</p>
                                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                                            {pct !== null ? (
                                                                <div className="h-full rounded-full"
                                                                    style={{
                                                                        width: `${pct}%`,
                                                                        background: pct >= 75 ? 'linear-gradient(90deg, #10B981, #34D399)' : pct >= 65 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #EF4444, #F87171)'
                                                                    }} />
                                                            ) : <div className="h-full w-0" />}
                                                        </div>
                                                        <p className={`text-[10px] font-black w-8 text-right ${pct !== null ? pctColor(pct) : 'text-muted-foreground/40'}`}>
                                                            {pct !== null ? `${pct}%` : '—'}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Individual Student Sheet */}
                                <div className="rounded-2xl border border-border/50 overflow-hidden">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-card flex items-center justify-between relative">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Attendance Sheet</p>
                                        <div className="absolute left-1/2 -translate-x-1/2 flex items-baseline gap-2">
                                            <span className="text-[12px] font-semibold text-foreground">{selectedStudent.name}</span>
                                            <span className="text-[11px] text-muted-foreground">Roll No. {selectedStudent.rollNo}</span>
                                        </div>
                                    </div>
                                    {loadingStudentRec ? (
                                        <div className="flex items-center justify-center py-8">
                                            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'scroll', overflowY: 'auto', background: '#F5F8EE', scrollbarWidth: 'thin', scrollbarColor: '#BACE85 #F5F8EE', height: '375px' }}>
                                            <table className="text-[10px] border-separate border-spacing-0 min-w-max">
                                                <thead className="sticky top-0 z-30">
                                                    <tr>
                                                        {/* Sticky left — Month */}
                                                        <th className="sticky left-0 z-40 bg-[#ECF3D0] border border-[#BACE85]/50 px-2 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap min-w-[40px]">Month</th>
                                                        {/* Date columns 1-31 */}
                                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                            <th key={d} className="bg-[#ECF3D0] border border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap min-w-[26px]">
                                                                {d}
                                                            </th>
                                                        ))}
                                                        {/* Sticky right summary */}
                                                        <th title="Total Present" className="sticky right-[161px] z-40 bg-[#ECF3D0] border border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-emerald-700 whitespace-nowrap min-w-[32px]">P</th>
                                                        <th title="Total Absent" className="sticky right-[129px] z-40 bg-[#ECF3D0] border border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-red-500 whitespace-nowrap min-w-[32px]">A</th>
                                                        <th title="Total Late" className="sticky right-[97px] z-40 bg-[#ECF3D0] border border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-amber-600 whitespace-nowrap min-w-[32px]">L</th>
                                                        <th title="Total Working Days" className="sticky right-[52px] z-40 bg-[#ECF3D0] border border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap min-w-[45px]">T</th>
                                                        <th title="Attendance %" className="sticky right-0 z-40 bg-[#ECF3D0] border border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap min-w-[52px]">%</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[
                                                        { month: 'Jun', key: 5 },
                                                        { month: 'Jul', key: 6 },
                                                        { month: 'Aug', key: 7 },
                                                        { month: 'Sep', key: 8 },
                                                        { month: 'Oct', key: 9 },
                                                        { month: 'Nov', key: 10 },
                                                        { month: 'Dec', key: 11 },
                                                        { month: 'Jan', key: 0 },
                                                        { month: 'Feb', key: 1 },
                                                        { month: 'Mar', key: 2 },
                                                        { month: 'Apr', key: 3 },
                                                        { month: 'May', key: 4 },
                                                    ].map(m => {
                                                        const mYear = m.key >= 5 ? startYear : startYear + 1;
                                                        const daysInMonth = new Date(mYear, m.key + 1, 0).getDate();
                                                        let p = 0, a = 0, l = 0;

                                                        Array.from({ length: 31 }, (_, i) => i + 1).forEach(d => {
                                                            const isOutOfMonth = d > daysInMonth;
                                                            const isSunday = !isOutOfMonth && new Date(mYear, m.key, d).getDay() === 0;
                                                            const isHol = !isOutOfMonth && !isSunday && !!holidaysByMonthDay[m.key]?.[d];
                                                            const dateStr = makeDateKey(mYear, m.key, d);
                                                            const st: AttendanceStatus = !isOutOfMonth && !isSunday && !isHol
                                                                ? (studentRecords[dateStr] ?? null)
                                                                : null;
                                                            if (st === 'P') p++;
                                                            else if (st === 'A') a++;
                                                            else if (st === 'L') l++;
                                                        });

                                                        const total = p + a + l;
                                                        const pct = total > 0 ? Math.round(((p + l) / total) * 100) : null;
                                                        return (
                                                            <tr key={m.month} className="bg-[#F5F8EE] hover:bg-[#E0E8C8] transition-colors">
                                                                {/* Month name — sticky left */}
                                                                <td className="sticky left-0 z-10 border border-[#BACE85]/50 px-2 py-1.5 font-semibold text-center text-[#2A3A10] bg-[#ECF3D0] whitespace-nowrap">
                                                                    {m.month}
                                                                </td>

                                                                {/* Date cells 1-31 */}
                                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                                                                    const isOutOfMonth = d > daysInMonth;
                                                                    const isSunday = !isOutOfMonth && new Date(mYear, m.key, d).getDay() === 0;
                                                                    const isHol = !isOutOfMonth && !isSunday && !!holidaysByMonthDay[m.key]?.[d];
                                                                    const holName = holidaysByMonthDay[m.key]?.[d];
                                                                    const dateStr = makeDateKey(mYear, m.key, d);
                                                                    const status: AttendanceStatus = !isOutOfMonth && !isSunday && !isHol
                                                                        ? (studentRecords[dateStr] ?? null)
                                                                        : null;

                                                                    return (
                                                                        <td key={d}
                                                                            title={holName ?? undefined}
                                                                            className={`border border-[#BACE85]/50 px-1 py-1.5 text-center relative
                                                                                ${isOutOfMonth ? 'bg-[#ECF3D0]/40' : isSunday ? 'bg-[#FFF0F0]' : isHol ? 'bg-[#FEF2F2]' : ''}`}>
                                                                            {isOutOfMonth ? (
                                                                                <span className="text-[#BACE85]/30">·</span>
                                                                            ) : isHol ? (
                                                                                <span style={{ color: '#FCA5A5', fontSize: '12px', lineHeight: 1 }}>×</span>
                                                                            ) : status ? (
                                                                                <span style={{
                                                                                    fontFamily: "'Patrick Hand', cursive",
                                                                                    fontSize: '14px',
                                                                                    fontWeight: '700',
                                                                                    color: status === 'P' ? '#16a34a' : status === 'A' ? '#dc2626' : '#d97706',
                                                                                    lineHeight: 1,
                                                                                    display: 'block',
                                                                                }}>{status}</span>
                                                                            ) : (
                                                                                <span className="text-[#BACE85]">—</span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}

                                                                {/* Sticky right — P A L T % */}
                                                                <td className="sticky right-[161px] z-10 border border-[#BACE85]/50 px-1 py-1.5 text-center text-emerald-700 font-bold bg-[#F5F8EE]">{p || '—'}</td>
                                                                <td className="sticky right-[129px] z-10 border border-[#BACE85]/50 px-1 py-1.5 text-center text-red-500 font-bold bg-[#F5F8EE]">{a || '—'}</td>
                                                                <td className="sticky right-[97px] z-10 border border-[#BACE85]/50 px-1 py-1.5 text-center text-amber-600 font-bold bg-[#F5F8EE]">{l || '—'}</td>
                                                                <td className="sticky right-[52px] z-10 border border-[#BACE85]/50 px-1 py-1.5 text-center font-bold text-[#2A3A10] bg-[#F5F8EE]">{total || '—'}</td>
                                                                <td className={`sticky right-0 z-10 border border-[#BACE85]/50 px-1 py-1.5 text-center font-black bg-[#F5F8EE] ${pct !== null ? pctColor(pct) : 'text-[#BACE85]'}`}>
                                                                    {pct !== null ? `${pct}%` : '—'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {/* Footer — Legend */}
                                    <div className="px-4 py-2 border-t border-border/40 shrink-0 flex items-center gap-4 bg-card">
                                        {[
                                            { label: 'Present' },
                                            { label: 'Absent' },
                                            { label: 'Late' },
                                        ].map(item => (
                                            <div key={item.label} className="flex items-center gap-1.5">
                                                <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: '16px', fontWeight: '700', lineHeight: 1, color: item.label === 'Present' ? '#16a34a' : item.label === 'Absent' ? '#dc2626' : '#d97706' }}>
                                                    {item.label[0]}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">{item.label}</span>
                                            </div>
                                        ))}
                                        <span className="text-[10px] text-muted-foreground/50 ml-auto italic">% = (P + L) / Total</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                    <Users size={20} className="text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Click any student from the list</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Daily Attendance Tab ──────────────────────────────────────────────────────
function DailyAttendanceTab({ divisionName, divisionId, students, holidays, onHolidayChange, onAttendanceSaved, attBase, readOnly }: {
    divisionName: string;
    divisionId: string;
    students: AttendanceStudent[];
    holidays: Record<string, string>;
    attBase: string;
    readOnly?: boolean;
    onHolidayChange: (dk: string, name: string | null) => void;
    onAttendanceSaved?: () => void;
}) {
    const today = new Date();
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [refreshKey, setRefreshKey] = useState(0);
    const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; name: string } | null>(null);

    const [attendance, setAttendance] = useState<Record<string, { status: AttendanceStatus; remark: string }>>({});
    const [remarkOpen, setRemarkOpen] = useState<string | null>(null);
    const [globalRemark, setGlobalRemark] = useState('');
    const [dateRemarks, setDateRemarks] = useState<Record<string, string>>({});
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [loadingDate, setLoadingDate] = useState(false);

    // Initialize attendance state when students load
    useEffect(() => {
        if (students.length === 0) return;
        setAttendance(Object.fromEntries(students.map(s => [s.id, { status: null, remark: '' }])));
    }, [students]);

    // Fetch attendance when date or students change
    const currentDk = dateKey(selectedDate);
    useEffect(() => {
        if (students.length === 0) return;
        setLoadingDate(true);
        api.get(`${attBase}/daily?date=${currentDk}`)
            .then(res => {
                const { records, dateNote } = res.data.data;
                const newAtt = Object.fromEntries(students.map(s => [s.id, { status: null as AttendanceStatus, remark: '' }]));
                records.forEach((r: { studentId: string; status: string; remark?: string }) => {
                    if (newAtt[r.studentId] !== undefined) {
                        newAtt[r.studentId] = { status: r.status as AttendanceStatus, remark: r.remark ?? '' };
                    }
                });
                setAttendance(newAtt);
                setGlobalRemark(dateNote ?? '');
                if (dateNote) setDateRemarks(prev => ({ ...prev, [currentDk]: dateNote }));
            })
            .catch(() => {
                setAttendance(Object.fromEntries(students.map(s => [s.id, { status: null as AttendanceStatus, remark: '' }])));
                setGlobalRemark('');
            })
            .finally(() => setLoadingDate(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDk, divisionId, students.length]);

    const isCurrentDaySunday = selectedDate.getDay() === 0;
    const isCurrentDayHoliday = !!holidays[currentDk];

    const handleHolidayChange = async (dk: string, name: string | null) => {
        onHolidayChange(dk, name);
        if (readOnly) return;
        try {
            await api.post(`/teacher/attendance/${divisionId}/holidays`, { date: dk, name });
        } catch (err) {
            console.error('Failed to save holiday', err);
            onHolidayChange(dk, name === null ? (holidays[dk] ?? null) : null);
        }
    };

    const handleRemarkChange = (dk: string, remark: string) => {
        if (dk.includes('::')) return;
        setDateRemarks(prev => ({ ...prev, [dk]: remark }));
        if (dk === currentDk) {
            setGlobalRemark(remark);
        } else if (!readOnly) {
            api.post(`/teacher/attendance/${divisionId}/daily`, {
                date: dk,
                records: [],
                dateNote: remark,
            }).catch(err => console.error('Failed to save date remark', err));
        }
    };

    const setStatus = (id: string, status: AttendanceStatus) => {
        setAttendance(prev => ({ ...prev, [id]: { ...prev[id], status: prev[id]?.status === status ? null : status } }));
    };
    const setRemark = (id: string, remark: string) => {
        setAttendance(prev => ({ ...prev, [id]: { ...prev[id], remark } }));
    };

    const handleSave = async () => {
        setSaveStatus('saving');
        try {
            const records = students
                .filter(s => attendance[s.id]?.status !== null)
                .map(s => ({
                    studentId: s.id,
                    status: attendance[s.id].status as 'P' | 'A' | 'L',
                    remark: attendance[s.id].remark ?? '',
                }));
            await api.post(`/teacher/attendance/${divisionId}/daily`, {
                date: currentDk,
                records,
                dateNote: globalRemark || undefined,
            });
            setSaveStatus('saved');
            setRefreshKey(k => k + 1);
            onAttendanceSaved?.();
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            console.error('Failed to save attendance', err);
            setSaveStatus('idle');
        }
    };

    const markAllPresent = () => {
        const allPresent = Object.values(attendance).every(a => a.status === 'P');
        setAttendance(prev => Object.fromEntries(Object.entries(prev).map(([id, v]) => [id, { ...v, status: allPresent ? null : 'P' as AttendanceStatus }])));
    };

    const present = Object.values(attendance).filter(a => a.status === 'P').length;
    const absent = Object.values(attendance).filter(a => a.status === 'A').length;
    const late = Object.values(attendance).filter(a => a.status === 'L').length;
    const unmarked = students.filter(s => !attendance[s.id]?.status).length;

    // Auto-save: 2s debounce after attendance changes, triggers as soon as at least one student is marked
    useEffect(() => {
        if (readOnly || students.length === 0) return;
        if (!Object.values(attendance).some(a => a.status)) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => { handleSave(); }, 2000);
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attendance, globalRemark]);

    // Calendar cells
    const startOffset = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);

    const prevCal = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
    const nextCal = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };
    const isToday = (d: number) => d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const isSelected = (d: number) => d === selectedDate.getDate() && calMonth === selectedDate.getMonth() && calYear === selectedDate.getFullYear();

    return (
        <div className="flex flex-col lg:flex-row gap-3 h-full min-h-0 overflow-y-auto lg:overflow-visible">

            {/* ── LEFT (35%) — Date picker + Students list ── */}
            <div className="w-full lg:w-[35%] h-[500px] lg:h-auto shrink-0 lg:shrink flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">

                {/* Header — Date + Remark + All P */}
                <div className="px-3 py-2 border-b border-border/40 shrink-0 space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Attendance Date</p>
                    <div className="flex items-center gap-2">
                        <div className="relative w-[140px] shrink-0">
                            <button onClick={() => setShowDatePicker(v => !v)}
                                className={`w-full flex flex-col justify-center px-3 rounded-xl border transition-all text-left h-10
                                    ${isCurrentDayHoliday || isCurrentDaySunday ? 'border-red-300 bg-red-50' : 'border-border/50 bg-muted/40 hover:border-primary/40'}`}>
                                <div className="flex items-center gap-2">
                                    <CalendarDays size={13} className={isCurrentDayHoliday || isCurrentDaySunday ? 'text-red-400 shrink-0' : 'text-muted-foreground shrink-0'} />
                                    <span className={`flex-1 text-xs font-semibold ${isCurrentDayHoliday || isCurrentDaySunday ? 'text-red-600' : ''}`}>{formatDate(selectedDate)}</span>
                                    <ChevronDown size={12} className="text-muted-foreground" />
                                </div>
                                <p className={`text-[10px] pl-5 ${isCurrentDayHoliday || isCurrentDaySunday ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                                    {isCurrentDayHoliday ? `🏖️ ${holidays[currentDk]}` : isCurrentDaySunday ? '🔴 Sunday' : selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                                </p>
                            </button>

                            <AnimatePresence>
                                {showDatePicker && (
                                    <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                        className="absolute top-12 left-0 z-50 bg-card border border-border rounded-2xl shadow-2xl p-3 min-w-[240px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <button onClick={prevCal} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"><ChevronLeft size={13} /></button>
                                            <span className="text-xs font-bold">{MONTHS[calMonth]} {calYear}</span>
                                            <button onClick={() => { const n = new Date(calYear, calMonth + 1, 1); if (n > today) return; nextCal(); }} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"><ChevronRight size={13} /></button>
                                        </div>
                                        <div className="grid grid-cols-7 mb-1">
                                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                                                <div key={i} className={`text-center text-[9px] font-semibold py-0.5 ${i === 6 ? 'text-red-500' : 'text-muted-foreground'}`}>{d}</div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-0.5">
                                            {cells.map((d, i) => {
                                                if (!d) return <div key={i} />;
                                                const weekend = (i % 7) === 6;
                                                const isFuture = new Date(calYear, calMonth, d) > today;
                                                const dk = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                const isHol = !!holidays[dk];
                                                return (
                                                    <button key={i}
                                                        onClick={() => {
                                                            if (isFuture) return;
                                                            setSelectedDate(new Date(calYear, calMonth, d));
                                                            setShowDatePicker(false);
                                                        }}
                                                        className={`aspect-square rounded-lg text-[10px] font-medium transition-all flex items-center justify-center
                                                            ${isFuture ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}
                                                            ${isHol ? 'bg-red-100 text-red-500 font-bold' : ''}
                                                            ${isSelected(d) && !isHol ? 'bg-primary text-white font-bold' : ''}
                                                            ${isToday(d) && !isSelected(d) && !isHol ? 'ring-2 ring-[#DA7756] text-[#DA7756] font-bold' : ''}
                                                            ${weekend && !isSelected(d) && !isToday(d) && !isHol ? 'text-red-400' : ''}
                                                            ${!isSelected(d) && !isToday(d) && !weekend && !isHol ? 'text-foreground hover:bg-muted' : !isHol ? 'hover:bg-muted/60' : ''}`}>
                                                        {d}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {!readOnly && (
                            <div className="flex-1 flex items-center gap-2 h-8 px-3 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 transition-all">
                                <MessageSquare size={12} className="text-muted-foreground shrink-0" />
                                <input value={globalRemark} onChange={e => { setGlobalRemark(e.target.value); setDateRemarks(prev => ({ ...prev, [currentDk]: e.target.value })); }}
                                    placeholder="Remark for this day..."
                                    className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground/50 focus:outline-none" />
                            </div>
                        )}

                        {!readOnly && (
                            <button onClick={markAllPresent} disabled={isCurrentDayHoliday || isCurrentDaySunday || students.length === 0}
                                className="flex items-center gap-1 h-8 px-2.5 rounded-xl text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 hover:opacity-80 transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
                                <CheckCircle2 size={11} /> All P
                            </button>
                        )}
                    </div>

                    {isCurrentDayHoliday && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold">
                            🏖️ Holiday — {holidays[currentDk]}
                        </div>
                    )}
                </div>

                {/* Students list */}
                <div className="flex-1 overflow-y-auto bg-background relative">
                    {loadingDate && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
                            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                    )}
                    {students.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">Loading students...</p>
                    ) : students.map(student => {
                        const rec = attendance[student.id] ?? { status: null, remark: '' };
                        return (
                            <div key={student.id} className="border-b border-border/20 last:border-none">
                                <div className="flex items-center gap-3 px-4 py-2.5">
                                    <div onClick={() => student.avatarUrl && setExpandedPhoto({ url: student.avatarUrl, name: student.name })}
                                        className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold text-white shrink-0 relative ${student.avatarUrl ? 'cursor-pointer' : ''}`}
                                        style={{ background: student.avatarUrl ? 'transparent' : getAvatarColor(student.name) }}>
                                        {student.avatarUrl
                                            ? <NextImage src={student.avatarUrl} alt={student.name} fill sizes="28px" className="object-cover" />
                                            : getInitials(student.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">{student.name}</p>
                                        <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <StatusBtn label="P" active={rec.status === 'P'} onClick={() => setStatus(student.id, 'P')} disabled={readOnly || isCurrentDayHoliday || isCurrentDaySunday} />
                                        <StatusBtn label="A" active={rec.status === 'A'} onClick={() => setStatus(student.id, 'A')} disabled={readOnly || isCurrentDayHoliday || isCurrentDaySunday} />
                                        <StatusBtn label="L" active={rec.status === 'L'} onClick={() => setStatus(student.id, 'L')} disabled={readOnly || isCurrentDayHoliday || isCurrentDaySunday} />
                                    </div>
                                    {!readOnly && (
                                        <button onClick={() => setRemarkOpen(prev => prev === student.id ? null : student.id)}
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${rec.remark ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted border border-border/40'}`}>
                                            <MessageSquare size={12} />
                                        </button>
                                    )}
                                </div>
                                {!readOnly && (
                                    <AnimatePresence>
                                        {remarkOpen === student.id && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <div className="px-4 pb-2.5">
                                                    <input autoFocus value={rec.remark} onChange={e => setRemark(student.id, e.target.value)}
                                                        placeholder={`Remark for ${student.name}...`}
                                                        className="w-full h-7 px-3 rounded-lg border border-border/40 bg-muted/30 text-xs focus:outline-none focus:border-primary/50 transition-all" />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer — Stats + Save */}
                <div className="px-3 py-1.5 border-t border-border/40 shrink-0 bg-card relative">
                    <div className="flex items-center justify-between mb-0">
                        <span className="text-[11px] text-muted-foreground/60">Total: {students.length}</span>
                        <div className="flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2">
                            {[
                                { label: 'P', count: present, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
                                { label: 'A', count: absent, cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
                                { label: 'L', count: late, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
                                { label: '—', count: unmarked, cls: 'bg-muted text-muted-foreground' },
                            ].map(s => (
                                <span key={s.label} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}: {s.count}</span>
                            ))}
                        </div>
                        {!readOnly && (
                            <button onClick={handleSave} disabled={saveStatus === 'saving' || students.length === 0 || !Object.values(attendance).some(a => a.status)}
                                className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                                style={{ background: saveStatus === 'saved' ? '#10b981' : 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                {saveStatus === 'saving'
                                    ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                    : saveStatus === 'saved'
                                        ? <CheckCircle2 size={12} />
                                        : <Save size={12} />}
                                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save Attendance'}
                            </button>
                        )}
                    </div>
                    {!readOnly && (
                        <p className="text-[11px] text-muted-foreground">
                            {isCurrentDayHoliday
                                ? <span className="text-red-500 font-semibold">🏖️ Holiday — no attendance</span>
                                : isCurrentDaySunday
                                    ? <span className="text-red-500 font-semibold">🔴 Sunday — no attendance</span>
                                    : unmarked > 0
                                        ? <span className="text-amber-500 font-semibold">{unmarked} student{unmarked > 1 ? 's' : ''} unmarked</span>
                                        : <span className="text-emerald-500 font-semibold">All students marked ✓</span>
                            }
                        </p>
                    )}
                </div>
            </div>

            {/* ── RIGHT (60%) — Attendance Sheet ── */}
            <AttendanceSheet
                students={students}
                selectedDate={selectedDate}
                attendance={attendance}
                holidays={holidays}
                dateRemarks={dateRemarks}
                onHolidayChange={handleHolidayChange}
                onRemarkChange={handleRemarkChange}
                divisionName={divisionName}
                divisionId={divisionId}
                refreshKey={refreshKey}
                attBase={attBase}
                readOnly={readOnly}
            />

            {/* Expanded student photo — same treatment as My Profile's avatar zoom */}
            <AnimatePresence>
                {expandedPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => setExpandedPhoto(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <img src={expandedPhoto.url} alt={expandedPhoto.name} className="w-full h-full object-cover" />
                            <button
                                onClick={() => setExpandedPhoto(null)}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                                <X size={14} className="text-white" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export type AttendanceSubTab = 'overall' | 'daily';

export default function AttendanceTab({
    divisionId, divisionName, isClassTeacher, attendanceSubTab, onAttendanceSubTabChange, onHeaderStatsLoad, readOnly,
}: {
    divisionId: string;
    divisionName: string;
    isClassTeacher: boolean;
    attendanceSubTab: AttendanceSubTab;
    onAttendanceSubTabChange: (tab: AttendanceSubTab) => void;
    onHeaderStatsLoad?: (stats: { overall: number | null; thisMonth: number | null }) => void;
    readOnly?: boolean;
}) {
    const attBase = readOnly
        ? `/admin/campus/divisions/${divisionId}/attendance`
        : `/teacher/attendance/${divisionId}`;
    const studentsUrl = readOnly
        ? `/admin/campus/divisions/${divisionId}/students`
        : `/teacher/classes/${divisionId}/students`;

    const [students, setStudents] = useState<AttendanceStudent[]>([]);
    const [holidays, setHolidays] = useState<Record<string, string>>({});

    // Re-fetches just the cumulative/summary figures (not the whole student
    // list) — called on mount and again after every attendance save, since
    // saving changes the cumulative % for the current and all later months.
    const refreshSummary = useCallback(() => {
        return api.get(`${attBase}/summary`).then(summaryRes => {
            const summaryByStudentId = new Map<string, SummaryStudent>(
                (summaryRes.data.data.students as SummaryStudent[]).map(ss => [ss.studentId, ss])
            );
            setStudents(prev => prev.map(s => {
                const summary = summaryByStudentId.get(s.id);
                const cumulativeByMonth: Record<string, number | null> = {};
                summary?.monthlyStats.forEach(m => { cumulativeByMonth[m.monthKey] = m.cumulativePct; });
                return { ...s, overallPct: summary?.overallPct ?? null, cumulativeByMonth };
            }));
            const cs = summaryRes.data.data.classStats;
            onHeaderStatsLoad?.({ overall: cs?.overallPct ?? null, thisMonth: cs?.currentMonthPct ?? null });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attBase]);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            api.get(studentsUrl),
            api.get(`${attBase}/holidays`),
            api.get(`${attBase}/summary`),
        ]).then(([studRes, holRes, summaryRes]) => {
            if (cancelled) return;
            const summaryByStudentId = new Map<string, SummaryStudent>(
                (summaryRes.data.data.students as SummaryStudent[]).map(ss => [ss.studentId, ss])
            );
            const s: AttendanceStudent[] = studRes.data.data.map((st: {
                id: string; studentId: string; user: { name: string }; rollNo: string | null; avatarUrl?: string | null;
            }) => {
                const summary = summaryByStudentId.get(st.id);
                const cumulativeByMonth: Record<string, number | null> = {};
                summary?.monthlyStats.forEach(m => { cumulativeByMonth[m.monthKey] = m.cumulativePct; });
                return {
                    id: st.id,
                    studentId: st.studentId,
                    name: st.user.name,
                    rollNo: st.rollNo ?? '',
                    avatarUrl: st.avatarUrl ?? null,
                    overallPct: summary?.overallPct ?? null,
                    cumulativeByMonth,
                };
            });
            setStudents(s);
            const h: Record<string, string> = {};
            holRes.data.data.forEach((hol: { date: string; name: string }) => { h[hol.date] = hol.name; });
            setHolidays(h);
            const cs = summaryRes.data.data.classStats;
            onHeaderStatsLoad?.({ overall: cs?.overallPct ?? null, thisMonth: cs?.currentMonthPct ?? null });
        }).catch(err => { if (!cancelled) console.error('Failed to load attendance base data', err); });
        return () => { cancelled = true; };
    }, [divisionId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleHolidayChange = (dk: string, name: string | null) => {
        setHolidays(prev => {
            const next = { ...prev };
            if (name === null) delete next[dk];
            else next[dk] = name;
            return next;
        });
    };

    return (
        <div className="flex flex-col h-full pt-3 pb-3 px-1 min-h-0">
            <AnimatePresence mode="wait">
                {attendanceSubTab === 'overall' ? (
                    <motion.div key="overall" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                        <OverallTab
                            divisionName={divisionName}
                            divisionId={divisionId}
                            holidays={holidays}
                            onSwitchToDaily={() => onAttendanceSubTabChange('daily')}
                            onStatsLoad={onHeaderStatsLoad}
                            attBase={attBase}
                        />
                    </motion.div>
                ) : (
                    <motion.div key="daily" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full min-h-0 flex flex-col">
                        <DailyAttendanceTab
                            divisionName={divisionName}
                            divisionId={divisionId}
                            students={students}
                            holidays={holidays}
                            onHolidayChange={handleHolidayChange}
                            onAttendanceSaved={refreshSummary}
                            attBase={attBase}
                            readOnly={readOnly}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
