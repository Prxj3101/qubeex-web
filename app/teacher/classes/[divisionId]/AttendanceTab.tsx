'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2,
    MessageSquare, Save, ChevronDown, X, Flag, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────────────
type AttendanceStatus = 'P' | 'A' | 'L' | null;
type SheetEntry = Record<string, AttendanceStatus>;
interface Student { id: string; name: string; rollNo: string; }

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_STUDENTS: Student[] = [
    { id: 'st1', name: 'Aarav Mehta', rollNo: '01' },
    { id: 'st2', name: 'Priya Singh', rollNo: '02' },
    { id: 'st3', name: 'Rohan Gupta', rollNo: '03' },
    { id: 'st4', name: 'Sneha Patel', rollNo: '04' },
    { id: 'st5', name: 'Arjun Kumar', rollNo: '05' },
    { id: 'st6', name: 'Meera Sharma', rollNo: '06' },
    { id: 'st7', name: 'Karan Joshi', rollNo: '07' },
    { id: 'st8', name: 'Ananya Nair', rollNo: '08' },
    { id: 'st9', name: 'Vikram Rao', rollNo: '09' },
    { id: 'st10', name: 'Ishaan Verma', rollNo: '10' },
    { id: 'st11', name: 'Divya Reddy', rollNo: '11' },
    { id: 'st12', name: 'Sahil Khan', rollNo: '12' },
];

const MOCK_OVERALL: Record<string, number> = {
    st1: 92, st2: 78, st3: 85, st4: 61, st5: 95,
    st6: 73, st7: 88, st8: 55, st9: 91, st10: 69,
    st11: 82, st12: 77,
};

const MOCK_MONTH: Record<string, number> = {
    st1: 88, st2: 72, st3: 80, st4: 58, st5: 96,
    st6: 68, st7: 84, st8: 50, st9: 89, st10: 65,
    st11: 79, st12: 74,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
function getAvatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(n: string) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

function pctColor(p: number) {
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
function getStudentId(rollNo: string, year: number) {
    return `STU-${year}-${rollNo.padStart(4, '0')}`;
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
function AttendanceSheet({ students, selectedDate, attendance, holidays, dateRemarks, onHolidayChange, onRemarkChange, divisionName }: {
    students: Student[];
    selectedDate: Date;
    attendance: Record<string, { status: AttendanceStatus; remark: string }>;
    holidays: Record<string, string>;
    dateRemarks: Record<string, string>;
    divisionName: string;
    onHolidayChange: (dk: string, name: string | null) => void;
    onRemarkChange: (dk: string, remark: string) => void;
}) {
    const today = new Date();
    const [activeMonth, setActiveMonth] = useState(selectedDate.getMonth());
    const [monthOffset, setMonthOffset] = useState(0);
    const [sheetData] = useState<Record<string, SheetEntry>>(() =>
        Object.fromEntries(students.map(s => [s.id, {}]))
    );

    // ── Popup + Modal state ───────────────────────────────────────────────────
    const [popupDate, setPopupDate] = useState<number | null>(null);
    const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
    const popupRef = useRef<HTMLDivElement>(null);
    const [holidayModalDk, setHolidayModalDk] = useState<string | null>(null);
    const [holidayInput, setHolidayInput] = useState('');
    const [remarkModalDk, setRemarkModalDk] = useState<string | null>(null);
    const [remarkInput, setRemarkInput] = useState('');

    const currentKey = dateKey(selectedDate);
    const year = today.getFullYear();
    const daysInMonth = new Date(year, activeMonth + 1, 0).getDate();
    const visibleDates = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const isWeekend = (d: number) => new Date(year, activeMonth, d).getDay() === 0;
    const isSelectedDateCell = (d: number) => d === selectedDate.getDate() && activeMonth === selectedDate.getMonth();

    // ── Live data getters ─────────────────────────────────────────────────────
    const getLiveStatus = (studentId: string, dk: string): AttendanceStatus => {
        if (dk === currentKey) return attendance[studentId]?.status ?? null;
        return sheetData[studentId]?.[dk] ?? null;
    };

    const getLiveRemark = (studentId: string, dk: string): string => {
        if (dk === currentKey) return attendance[studentId]?.remark ?? '';
        return '';
    };

    const exportToExcel = () => {
        const headers = ['Roll No.', 'Name', 'Student ID', ...visibleDates.map(d => String(d)), 'P', 'A', 'L', '%', 'Overall %'];

        const rows = students.map(student => {
            let p = 0, a = 0, l = 0;
            const dateCells = visibleDates.map(d => {
                const dk = makeDateKey(year, activeMonth, d);
                if (holidays[dk]) return 'H';
                const status = getLiveStatus(student.id, dk);
                if (status === 'P') p++;
                else if (status === 'A') a++;
                else if (status === 'L') l++;
                return status ?? '—';
            });
            const total = p + a + l;
            const pct = total > 0 ? `${Math.round(((p + l) / total) * 100)}%` : '—';
            return [
                student.rollNo,
                student.name,
                getStudentId(student.rollNo, year),
                ...dateCells,
                p || '—', a || '—', l || '—',
                pct,
                MOCK_OVERALL[student.id] !== undefined ? `${MOCK_OVERALL[student.id]}%` : '—',
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${MONTHS_S[activeMonth]} Attendance`);
        XLSX.writeFile(wb, `Attendance_${MONTHS_S[activeMonth]}_${year}.xlsx`);
    };

    // ── Export state ──────────────────────────────────────────────────────────────
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showMonthSelector, setShowMonthSelector] = useState(false);
    const [selectedExportMonths, setSelectedExportMonths] = useState<number[]>([]);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Close export menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Export function ───────────────────────────────────────────────────────────
    const exportMonthSheet = (monthKey: number) => {
        const days = new Date(year, monthKey + 1, 0).getDate();
        const dates = Array.from({ length: days }, (_, i) => i + 1);
        const headers = ['Roll No.', 'Name', 'Student ID', ...dates.map(String), 'P', 'A', 'L', '%', 'Overall %'];
        const rows = students.map(student => {
            let p = 0, a = 0, l = 0;
            const dateCells = dates.map(d => {
                const dk = makeDateKey(year, monthKey, d);
                if (holidays[dk]) return 'H';
                const status = getLiveStatus(student.id, dk);
                if (status === 'P') p++;
                else if (status === 'A') a++;
                else if (status === 'L') l++;
                return status ?? '—';
            });
            const total = p + a + l;
            const pct = total > 0 ? `${Math.round(((p + l) / total) * 100)}%` : '—';
            return [student.rollNo, student.name, getStudentId(student.rollNo, year), ...dateCells, p || '—', a || '—', l || '—', pct, MOCK_OVERALL[student.id] !== undefined ? `${MOCK_OVERALL[student.id]}%` : '—'];
        });
        return { headers, rows, sheetName: MONTHS_S[monthKey] };
    };

    const handleExportThisMonth = async () => {
        const XLSX = await import('xlsx');
        const { headers, rows, sheetName } = exportMonthSheet(activeMonth);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${sheetName} Attendance`);
        XLSX.writeFile(wb, `Attendance_${sheetName}_${year}.xlsx`);
        setShowExportMenu(false);
    };

    const handleExportSelectedMonths = async () => {
        if (selectedExportMonths.length === 0) return;
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        selectedExportMonths.forEach(monthKey => {
            const { headers, rows, sheetName } = exportMonthSheet(monthKey);
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, `${sheetName} Attendance`);
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
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPopupPos({ x: rect.left, y: rect.bottom + 4 });
        setPopupDate(prev => prev === d ? null : d);
    };

    // Academic year auto detect — June se May tak hota hai
    const academicYear = activeMonth >= 5
        ? `${year}–${String(year + 1).slice(2)}`
        : `${year - 1}–${String(year).slice(2)}`;

    return (
        <div className="w-[60%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl shadow-sm shadow-black/5">

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

                    {/* Export dropdown */}
                    <AnimatePresence>
                        {showExportMenu && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                className="absolute right-0 top-9 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
                                {/* This Month */}
                                <button onClick={handleExportThisMonth}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2">
                                    <span>📅</span>
                                    <span>This Month ({MONTHS_S[activeMonth]})</span>
                                </button>
                                {/* Select Month */}
                                <button onClick={() => { setShowExportMenu(false); setShowMonthSelector(true); setSelectedExportMonths([]); }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2">
                                    <span>🗓️</span>
                                    <span>Select Months</span>
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

                            {/* Month checkboxes */}
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

                            {/* Select all / Clear */}
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

                            {/* Download button */}
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
                <table className="text-[10px] border-separate border-spacing-0 min-w-max">
                    <thead className="sticky top-0 z-30">
                        <tr>
                            {/* Sticky left columns */}
                            <th className="sticky left-[0px] z-20 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-2 py-1 text-left font-semibold text-[#2A3A10] whitespace-nowrap min-w-[55px]">Roll No.</th>
                            <th className="sticky left-[55px] z-20 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-2 py-1 text-left font-semibold text-[#2A3A10] whitespace-nowrap min-w-[120px]">Name</th>
                            <th className="bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-2 py-1 text-left font-semibold text-[#2A3A10] whitespace-nowrap min-w-[95px]">Student ID</th>

                            {/* Date columns — clickable */}
                            {visibleDates.map(d => {
                                const dk = makeDateKey(year, activeMonth, d);
                                const isSelected = isSelectedDateCell(d);
                                const weekend = isWeekend(d);
                                const isHoliday = !!holidays[dk];
                                const hasRemark = !!dateRemarks[dk];
                                return (
                                    <th key={d} onClick={(e) => handleDateClick(d, e)}
                                        className={`border-[0.1px] border-[#BACE85]/50 px-1 py-2 text-center font-semibold whitespace-nowrap min-w-[30px] cursor-pointer relative select-none
                                            ${isHoliday ? 'bg-[#FFF0F0] text-red-500'
                                                : isSelected ? 'bg-[#EEF4FF] text-[#4A6FA5]'
                                                    : weekend ? 'bg-[#FFF0F0] text-red-500'
                                                        : 'bg-[#ECF3D0] text-[#2A3A10]'}`}>
                                        {d}
                                        {/* Date remark dot */}
                                        {hasRemark && !isHoliday && (
                                            <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-[#DA7756]" />
                                        )}
                                    </th>
                                );
                            })}

                            {/* Sticky right summary columns */}
                            <th className="sticky right-[169px] z-20 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-emerald-700 whitespace-nowrap w-[36px] min-w-[36px]">P</th>
                            <th className="sticky right-[133px] z-20 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-red-500 whitespace-nowrap w-[36px] min-w-[36px]">A</th>
                            <th className="sticky right-[97px] z-20 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-1 py-1 text-center font-semibold text-amber-600 whitespace-nowrap w-[36px] min-w-[36px]">L</th>
                            <th title="Current Month %" className="sticky right-[52px] z-20 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-2 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap min-w-[45px]">%</th>
                            <th title="Overall %" className="sticky right-0 z-20 bg-[#ECF3D0] border-[0.1px] border-[#BACE85]/50 px-2 py-1 text-center font-semibold text-[#2A3A10] whitespace-nowrap min-w-[52px]">&#x2211;%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, si) => {
                            // ── Count P/A/L for this month (skip holidays) ────
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

                                    {/* Sticky left — Roll No */}
                                    <td className="sticky left-0 z-10 border-[0.1px] border-[#BACE85]/50 px-2 py-2 font-semibold text-center text-[#2A3A10] bg-[#F5F8EE] w-[55px]">{student.rollNo}</td>

                                    {/* Sticky left — Name */}
                                    <td className="sticky left-[55px] z-10 border-[0.1px] border-[#BACE85]/50 px-2 py-1.5 font-medium whitespace-nowrap text-[#2A3A10] bg-[#F5F8EE]">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                style={{ background: getAvatarColor(student.name) }}>
                                                {getInitials(student.name)}
                                            </div>
                                            {student.name}
                                        </div>
                                    </td>

                                    {/* Student ID */}
                                    <td className="border-[0.1px] border-[#BACE85]/50 px-2 py-2 font-mono text-[11px] whitespace-nowrap bg-[#F5F8EE]" style={{ color: '#DA7756' }}>
                                        {getStudentId(student.rollNo, year)}
                                    </td>

                                    {/* Date cells */}
                                    {visibleDates.map(d => {
                                        const dk = makeDateKey(year, activeMonth, d);
                                        const status = getLiveStatus(student.id, dk);
                                        const remark = getLiveRemark(student.id, dk);
                                        const isSelected = isSelectedDateCell(d);
                                        const weekend = isWeekend(d);
                                        const isHoliday = !!holidays[dk];

                                        // ── Holiday column — rowSpan for first student ──
                                        if (isHoliday) {
                                            if (si === 0) {
                                                return (
                                                    <td key={d} rowSpan={students.length}
                                                        className="border-[0.1px] border-red-200 text-center align-middle relative"
                                                        style={{ background: '#FEF2F2', minWidth: '30px' }}>
                                                        {/* Center vertical line */}
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                                                                <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#FCA5A5" strokeWidth="1" />
                                                            </svg>
                                                            {/* Rotated holiday text */}
                                                            <span style={{
                                                                color: '#ef4444',
                                                                fontSize: '10px',
                                                                fontWeight: '700',
                                                                whiteSpace: 'nowrap',
                                                                writingMode: 'vertical-rl',
                                                                transform: 'rotate(180deg)',
                                                                background: '#FEF2F2',
                                                                padding: '2px 0',
                                                                position: 'relative',
                                                                zIndex: 1,
                                                                fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
                                                                letterSpacing: '0.5px',
                                                            }}>
                                                                {holidays[dk] ? `Holiday — ${holidays[dk]}` : 'Holiday'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            return null; // other rows handled by rowSpan
                                        }

                                        // ── Normal attendance cell ────────────
                                        return (
                                            <td key={d}
                                                onClick={() => {
                                                    if (remark) {
                                                        setRemarkInput(remark);
                                                        setRemarkModalDk(`${student.id}::${dk}`);
                                                    }
                                                }}
                                                className={`border-[0.1px] border-[#BACE85]/50 px-1 py-2 text-center relative
                                                    ${remark ? 'cursor-pointer' : 'cursor-default'}
                                                    ${isSelected ? 'bg-[#EEF4FF]' : weekend ? 'bg-[#FFF5F5]' : ''}`}>
                                                {status ? (
                                                    <span style={{
                                                        fontFamily: "'Patrick Hand', cursive",
                                                        fontSize: '17px',
                                                        fontWeight: '700',
                                                        color: status === 'P' ? '#16a34a' : status === 'A' ? '#dc2626' : '#d97706',
                                                        lineHeight: 1,
                                                        display: 'block',
                                                    }}>
                                                        {status}
                                                    </span>
                                                ) : (
                                                    <span className="text-[#BACE85]">—</span>
                                                )}
                                                {/* Student remark dot */}
                                                {remark && (
                                                    <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-[#DA7756]" />
                                                )}
                                            </td>
                                        );
                                    })}

                                    {/* Sticky right — Summary columns */}
                                    <td className="sticky right-[169px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-2 text-center text-emerald-700 font-bold bg-[#F5F8EE] w-[36px]">{p || '—'}</td>
                                    <td className="sticky right-[133px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-2 text-center text-red-500 font-bold bg-[#F5F8EE] w-[36px]">{a || '—'}</td>
                                    <td className="sticky right-[97px] z-10 border-[0.1px] border-[#BACE85]/50 px-1 py-2 text-center text-amber-600 font-bold bg-[#F5F8EE] w-[36px]">{l || '—'}</td>
                                    <td className={`sticky right-[52px] z-10 border-[0.1px] border-[#BACE85]/50 px-2 py-2 text-center font-black bg-[#F5F8EE] ${pct !== null ? pctColor(pct) : 'text-[#BACE85]'}`}>
                                        {pct !== null ? `${pct}%` : '—'}
                                    </td>
                                    <td className={`sticky right-0 z-10 border-[0.1px] border-[#BACE85]/50 px-2 py-2 text-center font-black bg-[#F5F8EE] ${MOCK_OVERALL[student.id] !== undefined ? pctColor(MOCK_OVERALL[student.id]) : 'text-[#BACE85]'}`}>
                                        {MOCK_OVERALL[student.id] !== undefined ? `${MOCK_OVERALL[student.id]}%` : '—'}
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
                        {/* Mark / Remove Holiday */}
                        <button onClick={() => {
                            const dk = makeDateKey(year, activeMonth, popupDate);
                            if (holidays[dk]) {
                                onHolidayChange(dk, null);
                            } else {
                                setHolidayInput('');
                                setHolidayModalDk(dk);
                            }
                            setPopupDate(null);
                        }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2">
                            <span>🏖️</span>
                            <span>{holidays[makeDateKey(year, activeMonth, popupDate)] ? 'Remove Holiday' : 'Mark as Holiday'}</span>
                        </button>
                        {/* View / Edit Date Remark */}
                        <button onClick={() => {
                            const dk = makeDateKey(year, activeMonth, popupDate);
                            setRemarkInput(dateRemarks[dk] ?? '');
                            setRemarkModalDk(dk);
                            setPopupDate(null);
                        }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2">
                            <span>💬</span>
                            <span>View / Edit Remark</span>
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
                                <button onClick={() => setHolidayModalDk(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                                    <X size={14} />
                                </button>
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

            {/* Remark modal — for both date remarks and student remarks */}
            <AnimatePresence>
                {remarkModalDk && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-bold">💬 Remark</p>
                                <button onClick={() => setRemarkModalDk(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                                    <X size={14} />
                                </button>
                            </div>
                            <textarea autoFocus value={remarkInput} onChange={e => setRemarkInput(e.target.value)}
                                placeholder="Write remark..."
                                rows={3}
                                className="w-full px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all mb-3 resize-none" />
                            <div className="flex gap-2">
                                <button onClick={() => setRemarkModalDk(null)}
                                    className="flex-1 h-9 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => { onRemarkChange(remarkModalDk, remarkInput); setRemarkModalDk(null); }}
                                    className="flex-1 h-9 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    Save Remark
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Overall Tab ───────────────────────────────────────────────────────────────
function OverallTab({ divisionName }: { divisionName: string }) {
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(MOCK_STUDENTS[0]);
    const [showListMenu, setShowListMenu] = useState(false);
    const [overallRightTab, setOverallRightTab] = useState<'class' | 'student'>('class');
    const [shortTab, setShortTab] = useState<'month' | 'overall'>('month');

    const MOCK_MONTHS_DATA: Record<string, Record<string, number>> = {
        st1: { Jun: 95, Jul: 90, Aug: 88, Sep: 92 },
        st2: { Jun: 80, Jul: 75, Aug: 72, Sep: 78 },
        st3: { Jun: 88, Jul: 82, Aug: 80, Sep: 85 },
        st4: { Jun: 65, Jul: 60, Aug: 58, Sep: 61 },
        st5: { Jun: 98, Jul: 95, Aug: 96, Sep: 95 },
        st6: { Jun: 75, Jul: 70, Aug: 68, Sep: 73 },
        st7: { Jun: 90, Jul: 88, Aug: 84, Sep: 88 },
        st8: { Jun: 60, Jul: 55, Aug: 50, Sep: 55 },
        st9: { Jun: 94, Jul: 90, Aug: 89, Sep: 91 },
        st10: { Jun: 72, Jul: 68, Aug: 65, Sep: 69 },
        st11: { Jun: 85, Jul: 82, Aug: 79, Sep: 82 },
        st12: { Jun: 80, Jul: 76, Aug: 74, Sep: 77 },
    };
    const CURRENT_MONTH = 'Sep';

    const generateList = (type: 'all' | 'current') => {
        const months = Object.keys(MOCK_MONTHS_DATA['st1']);
        const lines: string[] = [];
        if (type === 'all') {
            lines.push(`Attendance Report — All Months\n`);
            lines.push(`${'Roll'.padEnd(6)}${'Name'.padEnd(22)}${months.map(m => m.padEnd(8)).join('')}Overall`);
            lines.push('─'.repeat(70));
            MOCK_STUDENTS.forEach(s => {
                const mData = MOCK_MONTHS_DATA[s.id];
                const monthCols = months.map(m => `${mData[m]}%`.padEnd(8)).join('');
                lines.push(`${s.rollNo.padEnd(6)}${s.name.padEnd(22)}${monthCols}${MOCK_OVERALL[s.id]}%`);
            });
        } else {
            lines.push(`Attendance Report — ${CURRENT_MONTH} (Current Month)\n`);
            lines.push(`${'Roll'.padEnd(6)}${'Name'.padEnd(22)}${CURRENT_MONTH.padEnd(10)}Overall`);
            lines.push('─'.repeat(45));
            MOCK_STUDENTS.forEach(s => {
                const mData = MOCK_MONTHS_DATA[s.id];
                lines.push(`${s.rollNo.padEnd(6)}${s.name.padEnd(22)}${`${mData[CURRENT_MONTH]}%`.padEnd(10)}${MOCK_OVERALL[s.id]}%`);
            });
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `attendance-${type}.txt`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex gap-3 h-full min-h-0">

            {/* LEFT — Students list */}
            <div className="w-[30%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-3.5 border-b border-border/40 shrink-0">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold flex items-center gap-2"><Users size={14} /> Students ({MOCK_STUDENTS.length})</p>
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
                    {MOCK_STUDENTS.map(student => {
                        const overall = MOCK_OVERALL[student.id] ?? 0;
                        const month = MOCK_MONTH[student.id] ?? 0;
                        const isSelected = selectedStudent?.id === student.id;
                        return (
                            <button key={student.id} onClick={() => setSelectedStudent(prev => prev?.id === student.id ? null : student)}
                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-all hover:bg-muted/30 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: getAvatarColor(student.name) }}>
                                    {getInitials(student.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate">{student.name}</p>
                                    <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="text-right">
                                        <p className={`text-[11px] font-black ${pctColor(overall)}`}>{overall}%</p>
                                        <p className="text-[9px] text-muted-foreground/60">overall</p>
                                    </div>
                                    <div className="w-px h-6 bg-border/40" />
                                    <div className="text-right">
                                        <p className={`text-[11px] font-black ${pctColor(month)}`}>{month}%</p>
                                        <p className="text-[9px] text-muted-foreground/60">this month</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT — Attendance details */}
            <div className="flex-1 flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
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

                    {/* Report + View Details buttons — student tab active aur student selected hone pe */}
                    <AnimatePresence>
                        {overallRightTab === 'student' && selectedStudent && (
                            <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                                className="flex items-center gap-2 ml-auto">
                                <button
                                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-red-500 hover:border-red-400/50 transition-all">
                                    <Flag size={11} /> Report
                                </button>
                                <button
                                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                                    <ExternalLink size={10} /> View Profile
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="flex-1 overflow-y-auto bg-background px-4 py-3">
                    {overallRightTab === 'class' ? (
                        <div className="space-y-4">

                            {/* Overall class stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-border/50 bg-background p-4 text-center">
                                    <p className={`text-2xl font-black ${pctColor(Math.round(Object.values(MOCK_OVERALL).reduce((a, b) => a + b, 0) / MOCK_STUDENTS.length))}`}>
                                        {Math.round(Object.values(MOCK_OVERALL).reduce((a, b) => a + b, 0) / MOCK_STUDENTS.length)}%
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">Class Overall</p>
                                </div>
                                <div className="rounded-2xl border border-border/50 bg-background p-4 text-center">
                                    <p className={`text-2xl font-black ${pctColor(Math.round(Object.values(MOCK_MONTH).reduce((a, b) => a + b, 0) / MOCK_STUDENTS.length))}`}>
                                        {Math.round(Object.values(MOCK_MONTH).reduce((a, b) => a + b, 0) / MOCK_STUDENTS.length)}%
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">This Month Avg</p>
                                </div>
                            </div>

                            {/* Month wise breakdown */}
                            <div className="rounded-2xl border border-border/50 bg-background overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Month-wise Class Average</p>
                                </div>
                                <div className="divide-y divide-border/20 max-h-[160px] overflow-y-auto">
                                    {[
                                        { month: 'June', key: 'Jun' },
                                        { month: 'July', key: 'Jul' },
                                        { month: 'August', key: 'Aug' },
                                        { month: 'September', key: 'Sep' },
                                        { month: 'October', key: 'Oct' },
                                        { month: 'November', key: 'Nov' },
                                        { month: 'December', key: 'Dec' },
                                        { month: 'January', key: 'Jan' },
                                        { month: 'February', key: 'Feb' },
                                        { month: 'March', key: 'Mar' },
                                        { month: 'April', key: 'Apr' },
                                        { month: 'May', key: 'May' },
                                    ].map(m => {
                                        const monthData = Object.values(MOCK_MONTHS_DATA);
                                        const hasData = monthData[0]?.[m.key] !== undefined;
                                        const avg = hasData
                                            ? Math.round(monthData.reduce((s, d) => s + (d[m.key] ?? 0), 0) / MOCK_STUDENTS.length)
                                            : null;
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
                                                    ) : (
                                                        <div className="h-full w-0" />
                                                    )}
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
                            <div className="rounded-2xl border border-border/50 bg-background overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center gap-2">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">Short Attendance</p>
                                    {/* Toggle */}
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
                                        {shortTab === 'month'
                                            ? MOCK_STUDENTS.filter(s => MOCK_MONTH[s.id] < 75).length
                                            : MOCK_STUDENTS.filter(s => MOCK_OVERALL[s.id] < 75).length
                                        } students
                                    </span>
                                </div>
                                {/* List — max 4 rows visible */}
                                <div className="divide-y divide-border/20 overflow-y-auto" style={{ maxHeight: '176px' }}>
                                    {(shortTab === 'month'
                                        ? MOCK_STUDENTS.filter(s => MOCK_MONTH[s.id] < 75)
                                        : MOCK_STUDENTS.filter(s => MOCK_OVERALL[s.id] < 75)
                                    ).map(student => {
                                        const pct = shortTab === 'month' ? MOCK_MONTH[student.id] : MOCK_OVERALL[student.id];
                                        return (
                                            <div key={student.id} className="flex items-center gap-3 px-4 py-2.5">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                    style={{ background: getAvatarColor(student.name) }}>
                                                    {getInitials(student.name)}
                                                </div>
                                                <p className="text-xs font-semibold flex-1 truncate">{student.name}</p>
                                                <p className="text-[11px] text-muted-foreground">Roll {student.rollNo}</p>
                                                <p className={`text-xs font-black ${pctColor(pct)}`}>{pct}%</p>
                                            </div>
                                        );
                                    })}
                                    {(shortTab === 'month'
                                        ? MOCK_STUDENTS.filter(s => MOCK_MONTH[s.id] < 75).length === 0
                                        : MOCK_STUDENTS.filter(s => MOCK_OVERALL[s.id] < 75).length === 0
                                    ) && (
                                            <p className="px-4 py-3 text-xs text-emerald-500 font-semibold text-center">✓ All students above 75%</p>
                                        )}
                                </div>
                            </div>

                        </div>
                    ) : (
                        /* Student Details tab placeholder */
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                <Users size={20} className="text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Click any student from the list</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Daily Attendance Tab ──────────────────────────────────────────────────────
function DailyAttendanceTab({ divisionName }: { divisionName: string }) {
    const today = new Date();
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());

    // ── Per-student attendance state ──────────────────────────────────────────
    const [attendance, setAttendance] = useState<Record<string, { status: AttendanceStatus; remark: string }>>(() =>
        Object.fromEntries(MOCK_STUDENTS.map(s => [s.id, { status: null, remark: '' }]))
    );
    const [remarkOpen, setRemarkOpen] = useState<string | null>(null);
    const [globalRemark, setGlobalRemark] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // ── Holiday + date remark state ───────────────────────────────────────────
    const [holidays, setHolidays] = useState<Record<string, string>>({});
    const [dateRemarks, setDateRemarks] = useState<Record<string, string>>({});

    const currentDk = dateKey(selectedDate);
    const isCurrentDayHoliday = !!holidays[currentDk];

    const handleHolidayChange = (dk: string, name: string | null) => {
        setHolidays(prev => {
            const next = { ...prev };
            if (name === null) delete next[dk];
            else next[dk] = name;
            return next;
        });
    };

    const handleRemarkChange = (dk: string, remark: string) => {
        // If it's a student remark (format: "studentId::dateKey"), ignore — handled locally
        // If it's a date remark, update dateRemarks
        if (!dk.includes('::')) {
            setDateRemarks(prev => ({ ...prev, [dk]: remark }));
            if (dk === currentDk) setGlobalRemark(remark);
        }
    };

    const setStatus = (id: string, status: AttendanceStatus) => {
        setAttendance(prev => ({ ...prev, [id]: { ...prev[id], status: prev[id].status === status ? null : status } }));
    };
    const setRemark = (id: string, remark: string) => {
        setAttendance(prev => ({ ...prev, [id]: { ...prev[id], remark } }));
    };
    const handleSave = async () => {
        setSaving(true);
        await new Promise(r => setTimeout(r, 800));
        setSaving(false); setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };
    const markAllPresent = () => {
        const allPresent = Object.values(attendance).every(a => a.status === 'P');
        setAttendance(prev => Object.fromEntries(Object.entries(prev).map(([id, v]) => [id, { ...v, status: allPresent ? null : 'P' as AttendanceStatus }])));
    };

    const present = Object.values(attendance).filter(a => a.status === 'P').length;
    const absent = Object.values(attendance).filter(a => a.status === 'A').length;
    const late = Object.values(attendance).filter(a => a.status === 'L').length;
    const unmarked = Object.values(attendance).filter(a => a.status === null).length;

    // ── Calendar cells ────────────────────────────────────────────────────────
    const startOffset = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);

    const prevCal = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
    const nextCal = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };
    const isToday = (d: number) => d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const isSelected = (d: number) => d === selectedDate.getDate() && calMonth === selectedDate.getMonth() && calYear === selectedDate.getFullYear();

    return (
        <div className="flex gap-3 h-full min-h-0">

            {/* ── LEFT (40%) — Date picker + Students list ── */}
            <div className="w-[40%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">

                {/* Header — Date + Remark + All P */}
                <div className="px-3 py-2 border-b border-border/40 shrink-0 space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Attendance Date</p>
                    <div className="flex items-center gap-2">

                        {/* Date picker button */}
                        <div className="relative w-[140px] shrink-0">
                            <button onClick={() => setShowDatePicker(v => !v)}
                                className={`w-full flex flex-col justify-center px-3 rounded-xl border transition-all text-left h-10
                                    ${isCurrentDayHoliday ? 'border-red-300 bg-red-50' : 'border-border/50 bg-muted/40 hover:border-primary/40'}`}>
                                <div className="flex items-center gap-2">
                                    <CalendarDays size={13} className={isCurrentDayHoliday ? 'text-red-400 shrink-0' : 'text-muted-foreground shrink-0'} />
                                    <span className={`flex-1 text-xs font-semibold ${isCurrentDayHoliday ? 'text-red-600' : ''}`}>{formatDate(selectedDate)}</span>
                                    <ChevronDown size={12} className="text-muted-foreground" />
                                </div>
                                <p className={`text-[10px] pl-5 ${isCurrentDayHoliday ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                                    {isCurrentDayHoliday ? `🏖️ ${holidays[currentDk]}` : selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                                </p>
                            </button>

                            {/* Calendar dropdown */}
                            <AnimatePresence>
                                {showDatePicker && (
                                    <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                        className="absolute top-12 left-0 z-50 bg-card border border-border rounded-2xl shadow-2xl p-3 min-w-[240px]">
                                        {/* Month nav */}
                                        <div className="flex items-center justify-between mb-2">
                                            <button onClick={prevCal} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"><ChevronLeft size={13} /></button>
                                            <span className="text-xs font-bold">{MONTHS[calMonth]} {calYear}</span>
                                            <button onClick={() => { const n = new Date(calYear, calMonth + 1, 1); if (n > today) return; nextCal(); }} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"><ChevronRight size={13} /></button>
                                        </div>
                                        {/* Day headers */}
                                        <div className="grid grid-cols-7 mb-1">
                                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                                                <div key={i} className={`text-center text-[9px] font-semibold py-0.5 ${i === 6 ? 'text-red-500' : 'text-muted-foreground'}`}>{d}</div>
                                            ))}
                                        </div>
                                        {/* Calendar grid */}
                                        <div className="grid grid-cols-7 gap-0.5">
                                            {cells.map((d, i) => {
                                                if (!d) return <div key={i} />;
                                                const weekend = (i % 7) === 6;
                                                const isFuture = new Date(calYear, calMonth, d) > today;
                                                const dk = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                const isHol = !!holidays[dk];
                                                return (
                                                    <button key={i}
                                                        onClick={() => { if (isFuture) return; setSelectedDate(new Date(calYear, calMonth, d)); setShowDatePicker(false); setAttendance(Object.fromEntries(MOCK_STUDENTS.map(s => [s.id, { status: null, remark: '' }]))); }}
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

                        {/* Global remark input */}
                        <div className="flex-1 flex items-center gap-2 h-8 px-3 rounded-xl border border-border/40 bg-muted/30 focus-within:border-primary/50 transition-all">
                            <MessageSquare size={12} className="text-muted-foreground shrink-0" />
                            <input value={globalRemark} onChange={e => { setGlobalRemark(e.target.value); setDateRemarks(prev => ({ ...prev, [currentDk]: e.target.value })); }}
                                placeholder="Remark for this day..."
                                className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground/50 focus:outline-none" />
                        </div>

                        {/* Mark all present */}
                        <button onClick={markAllPresent} disabled={isCurrentDayHoliday}
                            className="flex items-center gap-1 h-8 px-2.5 rounded-xl text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 hover:opacity-80 transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
                            <CheckCircle2 size={11} /> All P
                        </button>
                    </div>

                    {/* Holiday banner */}
                    {isCurrentDayHoliday && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold">
                            🏖️ Holiday — {holidays[currentDk]}
                        </div>
                    )}
                </div>

                {/* Students list */}
                <div className="flex-1 overflow-y-auto bg-background">
                    {MOCK_STUDENTS.map(student => {
                        const rec = attendance[student.id];
                        return (
                            <div key={student.id} className="border-b border-border/20 last:border-none">
                                <div className="flex items-center gap-3 px-4 py-2.5">
                                    {/* Avatar */}
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: getAvatarColor(student.name) }}>
                                        {getInitials(student.name)}
                                    </div>
                                    {/* Name + Roll */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">{student.name}</p>
                                        <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                                    </div>
                                    {/* P / A / L buttons */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <StatusBtn label="P" active={rec.status === 'P'} onClick={() => setStatus(student.id, 'P')} disabled={isCurrentDayHoliday} />
                                        <StatusBtn label="A" active={rec.status === 'A'} onClick={() => setStatus(student.id, 'A')} disabled={isCurrentDayHoliday} />
                                        <StatusBtn label="L" active={rec.status === 'L'} onClick={() => setStatus(student.id, 'L')} disabled={isCurrentDayHoliday} />
                                    </div>
                                    {/* Individual remark toggle */}
                                    <button onClick={() => setRemarkOpen(prev => prev === student.id ? null : student.id)}
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${rec.remark ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted border border-border/40'}`}>
                                        <MessageSquare size={12} />
                                    </button>
                                </div>
                                {/* Inline remark input */}
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
                            </div>
                        );
                    })}
                </div>

                {/* Footer — Stats + Save */}
                <div className="px-3 py-1.5 border-t border-border/40 shrink-0 bg-card relative">
                    <div className="flex items-center justify-between mb-0">
                        {/* Total */}
                        <span className="text-[11px] text-muted-foreground/60">Total: {MOCK_STUDENTS.length}</span>
                        {/* P A L pills — center */}
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
                        {/* Save button */}
                        <button onClick={handleSave} disabled={saving || (unmarked > 0 && !isCurrentDayHoliday)}
                            className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                            style={{ background: saved ? '#10b981' : 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            {saving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Attendance'}
                        </button>
                    </div>
                    {/* Unmarked status text */}
                    <p className="text-[11px] text-muted-foreground">
                        {isCurrentDayHoliday
                            ? <span className="text-red-500 font-semibold">🏖️ Holiday — no attendance</span>
                            : unmarked > 0
                                ? <span className="text-amber-500 font-semibold">{unmarked} student{unmarked > 1 ? 's' : ''} unmarked</span>
                                : <span className="text-emerald-500 font-semibold">All students marked ✓</span>
                        }
                    </p>
                </div>
            </div>

            {/* ── RIGHT (60%) — Attendance Sheet ── */}
            <AttendanceSheet
                students={MOCK_STUDENTS}
                selectedDate={selectedDate}
                attendance={attendance}
                holidays={holidays}
                dateRemarks={dateRemarks}
                onHolidayChange={handleHolidayChange}
                onRemarkChange={handleRemarkChange}
                divisionName={divisionName}
            />
        </div>
    );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export type AttendanceSubTab = 'overall' | 'daily';

export default function AttendanceTab({
    divisionId, divisionName, isClassTeacher, attendanceSubTab,
}: {
    divisionId: string; divisionName: string; isClassTeacher: boolean; attendanceSubTab: AttendanceSubTab;
}) {
    return (
        <div className="flex flex-col h-full pt-3 pb-3 px-1 min-h-0">
            <AnimatePresence mode="wait">
                {attendanceSubTab === 'overall' ? (
                    <motion.div key="overall" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                        <OverallTab divisionName={divisionName} />
                    </motion.div>
                ) : (
                    <motion.div key="daily" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full min-h-0 flex flex-col">
                        <DailyAttendanceTab divisionName={divisionName} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}