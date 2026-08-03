'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Landmark, Building2, QrCode, CreditCard, Wallet, ChevronDown, ImagePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

const FEE_CARD_THEMES = {
    yellow: { name: 'Yellow', bg: '#FFF9E0', border: '#EEDD9B' },
    green: { name: 'Pista', bg: '#F1F6E1', border: '#CBDCA0' },
    blue: { name: 'Blue', bg: '#EEF6FB', border: '#CBE2EF' },
    pink: { name: 'Pink', bg: '#FCF1F4', border: '#EDCED8' },
} as const;
type FeeCardThemeKey = keyof typeof FEE_CARD_THEMES;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Parses flexible free-text dates like "10 Aug 26", "Aug 10 2026", "10 August"
// (year defaults to current year if omitted) into a comparable Date.
function parseFlexDate(input: string | null | undefined): Date | null {
    if (!input) return null;
    const str = input.trim();
    if (!str) return null;
    const monthIdx = MONTHS.findIndex(m => new RegExp(`\\b${m.slice(0, 3)}`, 'i').test(str));
    if (monthIdx === -1) return null;
    const nums = str.match(/\d+/g);
    if (!nums || nums.length === 0) return null;
    const day = parseInt(nums[0], 10);
    if (Number.isNaN(day) || day < 1 || day > 31) return null;
    let year = new Date().getFullYear();
    if (nums.length > 1) {
        const y = parseInt(nums[1], 10);
        if (!Number.isNaN(y)) year = y < 100 ? 2000 + y : y;
    }
    const d = new Date(year, monthIdx, day);
    return Number.isNaN(d.getTime()) ? null : d;
}

// Paid date is "late" if it's strictly after the due date (day-level comparison).
function isPaidLate(dueDate: string | null | undefined, paidDate: string | null | undefined): boolean {
    const due = parseFlexDate(dueDate);
    const paid = parseFlexDate(paidDate);
    if (!due || !paid) return false;
    return paid.getTime() > due.getTime();
}

// ─── Data ─────────────────────────────────────────────────────────────────────

type FeeStructureType = 'REGULAR' | 'ADDON' | 'PENALTY' | 'ONE_TIME';

interface FeeSubItem { id: string; label: string; amount: number; }
interface FeeItem { id: string; label: string; amount: number; subItems: FeeSubItem[]; }
interface FeeStructure { id: string; name: string; type: FeeStructureType; color: string; items: FeeItem[]; }
// Base month definition (no per-student status baked in — that comes from /student/fees's `payments`)
interface FeeMonth { id: string; month: string; dueDate: string; assignedStructureIds: string[]; remark: string; }
interface FeePayment { feeMonthId: string; status: 'PAID' | 'PENDING'; paidDate: string | null; remark: string | null; extraFields: Record<string, string> | null; extraStructureIds: string[] | null; }
interface BankDetails { accountName?: string; accountNumber?: string; ifsc?: string; bankName?: string; branch?: string; upiId?: string; }
type StudentDetailField = {
    id: string;
    kind: 'default' | 'custom';
    defaultKey?: 'name' | 'rollNo' | 'studentId' | 'class' | 'division';
    label: string;
    value?: string;
};
const DEFAULT_STUDENT_FIELDS: StudentDetailField[] = [
    { id: 'f-name', kind: 'default', defaultKey: 'name', label: 'Name' },
    { id: 'f-rollno', kind: 'default', defaultKey: 'rollNo', label: 'Roll No' },
    { id: 'f-studentid', kind: 'default', defaultKey: 'studentId', label: 'Student ID' },
    { id: 'f-class', kind: 'default', defaultKey: 'class', label: 'Class' },
    { id: 'f-division', kind: 'default', defaultKey: 'division', label: 'Division' },
];

const FEE_TYPE_CFG: Record<FeeStructureType, { label: string; color: string; bg: string; text: string; emoji: string }> = {
    REGULAR:  { label: 'Regular Monthly', color: '#7C3AED', bg: 'bg-violet-100 dark:bg-violet-950/40',  text: 'text-violet-700 dark:text-violet-400',  emoji: '📅' },
    ADDON:    { label: 'Add-on',           color: '#DA7756', bg: 'bg-orange-100 dark:bg-orange-950/40',  text: 'text-orange-700 dark:text-orange-400',  emoji: '➕' },
    PENALTY:  { label: 'Penalty / Fine',   color: '#DC2626', bg: 'bg-red-100 dark:bg-red-950/40',        text: 'text-red-700 dark:text-red-400',        emoji: '⚠️' },
    ONE_TIME: { label: 'One-time',         color: '#059669', bg: 'bg-emerald-100 dark:bg-emerald-950/40',text: 'text-emerald-700 dark:text-emerald-400', emoji: '⭐' },
};

const STATUS_CFG = {
    PAID:    { label: 'Paid',    cls: 'bg-emerald-100 text-emerald-700' },
    PENDING: { label: 'Pending', cls: 'bg-red-100 text-red-700' },
};

function structureTotal(s: FeeStructure) {
    return s.items.reduce((n, item) => {
        const sub = item.subItems.reduce((m, si) => m + si.amount, 0);
        return n + (sub > 0 ? sub : item.amount);
    }, 0);
}

const BANK_LABELS: { key: keyof BankDetails; label: string }[] = [
    { key: 'accountName', label: 'Account Name' },
    { key: 'accountNumber', label: 'Account No.' },
    { key: 'ifsc', label: 'IFSC' },
    { key: 'bankName', label: 'Bank' },
    { key: 'branch', label: 'Branch' },
    { key: 'upiId', label: 'UPI ID' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeesPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [cardFlipped, setCardFlipped] = useState(false);
    const [expandedBreakdownItemIds, setExpandedBreakdownItemIds] = useState<Set<string>>(new Set());
    const [feeCardTheme, setFeeCardTheme] = useState<FeeCardThemeKey>('yellow');
    const fc = FEE_CARD_THEMES[feeCardTheme];
    const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null);
    const [schoolName, setSchoolName] = useState('');

    const [student, setStudent] = useState<{ name: string; rollNo: string; studentId: string; standardName: string; divisionName: string } | null>(null);
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [feeMonths, setFeeMonths] = useState<FeeMonth[]>([]);
    const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
    const [rulesAndRegs, setRulesAndRegs] = useState<{ id: string; text: string }[]>([]);
    const [extraColumns, setExtraColumns] = useState<{ label: string }[]>([]);
    const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
    const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
    const [studentFields, setStudentFields] = useState<StudentDetailField[]>(DEFAULT_STUDENT_FIELDS);
    const [extraDetailFields, setExtraDetailFields] = useState<Record<string, string> | null>(null);

    useEffect(() => {
        Promise.all([
            api.get('/student/me').catch(() => ({ data: { data: null } })),
            api.get('/student/fees').catch(() => ({ data: { data: { structure: null, payments: [] } } })),
        ]).then(([meRes, feesRes]) => {
            const me = meRes.data?.data;
            if (me) {
                setStudent({
                    name: me.user?.name ?? '',
                    rollNo: me.rollNo ?? '—',
                    studentId: me.studentId ?? '—',
                    standardName: me.standard?.name ?? '',
                    divisionName: me.division?.name ?? '',
                });
            }

            const structure = feesRes.data?.data?.structure;
            setFeeStructures(structure?.feeStructures ?? []);
            setFeeMonths(structure?.feeMonths ?? []);
            setRulesAndRegs(structure?.rulesAndRegs ?? []);
            setExtraColumns(structure?.extraColumns ?? []);
            setBankDetails(structure?.bankDetails ?? null);
            setQrImageUrl(structure?.qrImageUrl ?? null);
            const theme = structure?.feeCardTheme;
            setFeeCardTheme(theme && theme in FEE_CARD_THEMES ? theme as FeeCardThemeKey : 'yellow');
            setSchoolLogoUrl(structure?.schoolLogoUrl ?? null);
            setSchoolName(structure?.schoolName ?? '');
            setStudentFields(structure?.studentFields && structure.studentFields.length > 0 ? structure.studentFields : DEFAULT_STUDENT_FIELDS);
            setExtraDetailFields(feesRes.data?.data?.extraDetailFields ?? null);

            setFeePayments(feesRes.data?.data?.payments ?? []);
        }).finally(() => setLoading(false));
    }, []);

    const getPayment = (feeMonthId: string): FeePayment =>
        feePayments.find(p => p.feeMonthId === feeMonthId) ?? { feeMonthId, status: 'PENDING', paidDate: null, remark: null, extraFields: null, extraStructureIds: null };

    // Overall paid/pending status tracks only the CURRENT calendar month's fee status
    // (the most recently applicable configured month, at or before "now") — not every
    // month ever added. e.g. if it's August and August is paid, overall = Paid, even if
    // an older month like April is still pending. Once September starts, September's
    // status takes over.
    const isPaid = (() => {
        if (feeMonths.length === 0) return false;
        const currentMonthIndex = new Date().getMonth();
        const withIdx = feeMonths
            .map(m => ({ m, idx: MONTHS.indexOf(m.month) }))
            .filter(x => x.idx !== -1);
        if (withIdx.length === 0) return false;
        const pastOrCurrent = withIdx.filter(x => x.idx <= currentMonthIndex).sort((a, b) => b.idx - a.idx)[0];
        const target = pastOrCurrent ?? [...withIdx].sort((a, b) => a.idx - b.idx)[0];
        return getPayment(target.m.id).status === 'PAID';
    })();

    const monthTotal = (m: FeeMonth) =>
        feeStructures.filter(s => m.assignedStructureIds.includes(s.id)).reduce((n, s) => n + structureTotal(s), 0);

    // Shared month total plus this student's own extra structures (e.g. a Penalty
    // added just for them this month, on top of the division's shared set).
    const studentMonthTotal = (m: FeeMonth) => {
        const extraIds = (getPayment(m.id).extraStructureIds ?? []).filter(id => !m.assignedStructureIds.includes(id));
        const extra = feeStructures.filter(s => extraIds.includes(s.id)).reduce((n, s) => n + structureTotal(s), 0);
        return monthTotal(m) + extra;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full py-24">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto lg:overflow-hidden">

            {/* Header */}
            <div className="shrink-0 px-1 pb-3">
                <div className="flex items-center gap-3 pb-3">
                    <button
                        onClick={() => router.back()}
                        className="w-8 h-8 rounded-xl flex items-center justify-center border border-border/50 bg-card hover:bg-muted transition-all shrink-0"
                    >
                        <ArrowLeft size={15} className="text-foreground" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold leading-tight">Fees Detail</h1>
                        <p className="text-[13px] text-muted-foreground">Your fee records & payment history</p>
                    </div>
                </div>
                <div className="h-px bg-border/60" />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-4 pb-3">

                {/* ── LEFT: Fee Details (same as teacher fees tab) ── */}
                <div className="w-full lg:w-[55%] lg:shrink-0 h-[70vh] lg:h-auto flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                    <div className="px-4 py-3 border-b border-border/40 shrink-0 flex items-center gap-2">
                        <Wallet size={14} className="text-muted-foreground" />
                        <p className="text-sm font-bold">Fee Details</p>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-background px-4 py-3">
                        <div className="space-y-4">

                            {/* Student header */}
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-white dark:bg-muted/20">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}>
                                    {(student?.name ?? '').split(' ').slice(0, 2).map(w => w[0]).join('')}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold">{student?.name ?? '—'}</p>
                                    <p className="text-[11px] text-muted-foreground">Roll No. {student?.rollNo ?? '—'} · {student?.standardName}-{student?.divisionName}</p>
                                </div>
                                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${isPaid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                    {isPaid ? '✓ Paid' : '⏳ Pending'}
                                </span>
                            </div>

                            {/* Fee Card with flip */}
                            <div style={{ perspective: '1200px' }}>
                                <motion.div
                                    animate={{ rotateY: cardFlipped ? 180 : 0 }}
                                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                                    style={{ transformStyle: 'preserve-3d', position: 'relative' }}>

                                    {/* FRONT */}
                                    <div style={{ backfaceVisibility: 'hidden', background: fc.bg, borderColor: fc.border }}
                                        className={`rounded-2xl border ${cardFlipped ? 'invisible' : ''}`}>

                                        <div className="px-4 py-2.5 flex items-center justify-between gap-2.5 rounded-t-2xl" style={{ background: fc.bg, borderBottom: `1px solid ${fc.border}` }}>
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {schoolLogoUrl
                                                    ? <img src={schoolLogoUrl} alt="School logo" className="w-20 h-20 rounded-lg object-contain shrink-0" style={{ background: fc.bg }} />
                                                    : <div className="w-20 h-20 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FFFFFF', border: `1px dashed ${fc.border}` }}><ImagePlus size={30} style={{ color: '#000000', opacity: 0.3 }} /></div>}
                                                {schoolName
                                                    ? <p className="text-3xl font-bold" style={{ color: '#000000' }}>{schoolName}</p>
                                                    : <p className="text-xs italic" style={{ color: '#000000', opacity: 0.4 }}>School name not added yet</p>}
                                            </div>
                                            <button onClick={() => setCardFlipped(true)}
                                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium border transition-all hover:bg-white/40 shrink-0"
                                                style={{ borderColor: fc.border, color: '#000000' }}>
                                                <span style={{ fontSize: '16px', display: 'inline-block' }}>↺</span>
                                                View Back
                                            </button>
                                        </div>

                                        {/* Strip — student name's fee card */}
                                        <div className="px-4 py-2 border-b" style={{ borderColor: fc.border }}>
                                            <p className="text-sm font-bold tracking-wide" style={{ color: '#000000' }}>{student?.name ?? '—'}&apos;s Fee Card</p>
                                        </div>

                                        <div className="space-y-4 px-4 py-3" style={{ color: '#000000' }}>

                                            {/* Student Details */}
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#000000' }}>Student Details</p>
                                                <div className="rounded-xl border p-2 flex flex-wrap gap-2" style={{ borderColor: fc.border }}>
                                                    {studentFields.map((f) => {
                                                        const value = f.kind === 'default'
                                                            ? f.defaultKey === 'name' ? (student?.name ?? '—')
                                                                : f.defaultKey === 'rollNo' ? (student?.rollNo ?? '—')
                                                                    : f.defaultKey === 'studentId' ? (student?.studentId ?? '—')
                                                                        : f.defaultKey === 'class' ? (student?.standardName ?? '—')
                                                                            : (student?.divisionName ?? '—')
                                                            : (extraDetailFields?.[f.id] || '—');
                                                        const isStudentId = f.kind === 'default' && f.defaultKey === 'studentId';
                                                        return (
                                                            <div key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg basis-[calc(50%-4px)] grow-0 shrink-0" style={{ border: `1px solid ${fc.border}` }}>
                                                                <span className="text-[11px] shrink-0" style={{ color: '#000000' }}>{f.label}</span>
                                                                <span className={`text-[11px] font-semibold truncate ${isStudentId ? 'font-mono' : ''}`} style={{ color: isStudentId ? '#DA7756' : '#000000' }}>{value}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div style={{ borderTop: `1px dashed ${fc.border}` }} />

                                            {/* Monthly Payment Schedule */}
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#000000' }}>Monthly Payment Schedule</p>
                                                <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: fc.border }}>
                                                    <table className="text-xs w-full min-w-[640px] lg:min-w-0" style={{ color: '#000000' }}>
                                                        <thead>
                                                            <tr style={{ background: fc.bg, borderBottom: `1px solid ${fc.border}` }}>
                                                                {['Month', 'Fee Structures', 'Amount (₹)', 'Due Date', 'Paid Date', 'Status', 'Remark', ...extraColumns.map(c => c.label)].map((col, i) => (
                                                                    <th key={i} className="px-3 py-2 text-left text-[11px] font-bold whitespace-nowrap" style={{ color: '#000000', borderRight: `1px solid ${fc.border}` }}>{col}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {feeMonths.map((m, mi) => {
                                                                const total = studentMonthTotal(m);
                                                                const assigned = feeStructures.filter(s => m.assignedStructureIds.includes(s.id));
                                                                const payment = getPayment(m.id);
                                                                const extraIds = (payment.extraStructureIds ?? []).filter(id => !m.assignedStructureIds.includes(id));
                                                                const extraStructures = extraIds.map(id => feeStructures.find(s => s.id === id)).filter((s): s is FeeStructure => !!s);
                                                                return (
                                                                    <tr key={m.id} className="transition-colors" style={{ background: selectedMonth === m.id ? `${fc.border}80` : mi % 2 === 1 ? fc.bg : 'transparent', borderTop: `1px solid ${fc.border}` }}>
                                                                        <td className="px-3 py-2 font-semibold whitespace-nowrap cursor-pointer" style={{ borderRight: `1px solid ${fc.border}` }}
                                                                            onClick={() => setSelectedMonth(prev => prev === m.id ? null : m.id)}>
                                                                            {m.month}
                                                                        </td>
                                                                        <td className="px-3 py-2 cursor-pointer" style={{ borderRight: `1px solid ${fc.border}` }}
                                                                            onClick={() => setSelectedMonth(prev => prev === m.id ? null : m.id)}>
                                                                            <div className="flex flex-wrap gap-0.5">
                                                                                {assigned.length === 0 && extraStructures.length === 0
                                                                                    ? <span className="text-[10px] italic" style={{ color: '#000000', opacity: 0.4 }}>—</span>
                                                                                    : null
                                                                                }
                                                                                {assigned.map(s => (
                                                                                    <span key={s.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                                                                        style={{ background: s.color + '20', color: s.color }}>
                                                                                        {s.name}
                                                                                    </span>
                                                                                ))}
                                                                                {extraStructures.map(s => (
                                                                                    <span key={s.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-dashed"
                                                                                        style={{ background: s.color + '15', color: s.color, borderColor: s.color + '60' }}
                                                                                        title="Added just for you">
                                                                                        {s.name}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-2 font-bold" style={{ borderRight: `1px solid ${fc.border}` }}>{total > 0 ? `₹${total.toLocaleString()}` : '—'}</td>
                                                                        <td className="px-3 py-2 text-[11px] font-medium" style={{ color: '#000000', borderRight: `1px solid ${fc.border}` }}>{m.dueDate}</td>
                                                                        <td className="px-3 py-2 text-[11px] font-medium" style={{ color: isPaidLate(m.dueDate, payment.paidDate) ? '#DC2626' : '#000000', fontWeight: isPaidLate(m.dueDate, payment.paidDate) ? 600 : undefined, borderRight: `1px solid ${fc.border}` }}>{payment.paidDate || '—'}</td>
                                                                        <td className="px-3 py-2" style={{ borderRight: `1px solid ${fc.border}` }}>
                                                                            <span className={`flex items-center gap-1 w-fit h-6 px-2 rounded-full text-[10px] font-semibold ${STATUS_CFG[payment.status].cls}`}>
                                                                                {payment.status === 'PAID' ? '✓' : '⏳'} {STATUS_CFG[payment.status].label}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2 text-[11px] font-medium" style={{ color: '#000000', borderRight: extraColumns.length > 0 ? `1px solid ${fc.border}` : 'none' }}>{payment.remark || '—'}</td>
                                                                        {extraColumns.map((col, ci) => (
                                                                            <td key={ci} className="px-3 py-2 text-[11px]" style={{ color: '#000000', borderRight: ci === extraColumns.length - 1 ? 'none' : `1px solid ${fc.border}` }}>{payment.extraFields?.[col.label] || '—'}</td>
                                                                        ))}
                                                                    </tr>
                                                                );
                                                            })}
                                                            <tr style={{ background: fc.bg, borderTop: `2px solid ${fc.border}` }}>
                                                                <td className="px-3 py-2 font-bold text-[11px]" style={{ color: '#000000' }}>Annual Total</td>
                                                                <td />
                                                                <td className="px-3 py-2 text-[11px] font-black" style={{ color: '#000000' }}>
                                                                    ₹{feeMonths.reduce((n, m) => n + studentMonthTotal(m), 0).toLocaleString()}
                                                                </td>
                                                                <td colSpan={4 + extraColumns.length} />
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div style={{ borderTop: `1px dashed ${fc.border}` }} />

                                            {/* Fee Structure Breakdown */}
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#000000' }}>
                                                    {selectedMonth
                                                        ? `Fee Structure Breakdown - ${feeMonths.find(m => m.id === selectedMonth)?.month}`
                                                        : 'Fee Structure Breakdown'
                                                    }
                                                </p>
                                                {!selectedMonth ? (
                                                    <div className="py-6 text-center rounded-xl border border-dashed" style={{ borderColor: fc.border }}>
                                                        <p className="text-xs" style={{ color: '#000000' }}>Click a month row to view breakdown</p>
                                                    </div>
                                                ) : (() => {
                                                    const month = feeMonths.find(m => m.id === selectedMonth);
                                                    if (!month) return null;
                                                    const sharedIds = new Set(month.assignedStructureIds);
                                                    const extraIds = (getPayment(month.id).extraStructureIds ?? []).filter(id => !sharedIds.has(id));
                                                    const assigned = feeStructures.filter(s => sharedIds.has(s.id) || extraIds.includes(s.id));
                                                    if (assigned.length === 0) return (
                                                        <div className="py-6 text-center rounded-xl border border-dashed" style={{ borderColor: fc.border }}>
                                                            <p className="text-xs" style={{ color: '#000000' }}>No fee structures assigned to {month.month}</p>
                                                        </div>
                                                    );
                                                    return (
                                                        <div className="space-y-2">
                                                            {assigned.map(fs => {
                                                                const total = structureTotal(fs);
                                                                const cfg = FEE_TYPE_CFG[fs.type];
                                                                const isExtra = extraIds.includes(fs.id);
                                                                return (
                                                                    <div key={fs.id} className="rounded-xl border overflow-hidden" style={isExtra ? { borderColor: fs.color + '60', borderStyle: 'dashed' } : { borderColor: fc.border }}>
                                                                        <div className="flex items-center gap-2 px-3 py-2" style={{ background: fc.bg }}>
                                                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: fs.color }} />
                                                                            <span className="flex-1 text-xs font-semibold" style={{ color: '#000000' }}>{fs.name}</span>
                                                                            {isExtra && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: fs.color + '20', color: fs.color }}>For you</span>}
                                                                            <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.emoji} {cfg.label}</span>
                                                                            <span className="text-xs font-bold" style={{ color: '#000000' }}>₹{total.toLocaleString()}</span>
                                                                        </div>
                                                                        {fs.items.map(item => {
                                                                            const subTotal = item.subItems.reduce((n, s) => n + s.amount, 0);
                                                                            const hasSub = item.subItems.length > 0;
                                                                            const isOpen = expandedBreakdownItemIds.has(item.id);
                                                                            const Row = hasSub ? 'button' : 'div';
                                                                            return (
                                                                                <div key={item.id}>
                                                                                    <Row type={hasSub ? 'button' : undefined}
                                                                                        onClick={hasSub ? () => setExpandedBreakdownItemIds(prev => {
                                                                                            const next = new Set(prev);
                                                                                            if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                                                                            return next;
                                                                                        }) : undefined}
                                                                                        className="w-full flex items-center justify-between px-3 py-1.5 pl-5 text-left" style={{ borderTop: `1px solid ${fc.border}`, background: fc.bg }}>
                                                                                        <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: '#000000' }}>
                                                                                            {item.label}
                                                                                            {hasSub && <ChevronDown size={11} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ opacity: 0.5 }} />}
                                                                                        </span>
                                                                                        <span className="text-[11px] font-semibold" style={{ color: '#000000' }}>₹{(subTotal || item.amount).toLocaleString()}</span>
                                                                                    </Row>
                                                                                    <AnimatePresence>
                                                                                        {hasSub && isOpen && (
                                                                                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                                                                {item.subItems.map(si => (
                                                                                                    <div key={si.id} className="flex items-center justify-between px-3 py-1 pl-8" style={{ borderTop: `1px solid ${fc.border}`, background: 'rgba(255,255,255,0.35)' }}>
                                                                                                        <span className="text-[10px]" style={{ color: '#000000', opacity: 0.65 }}>{si.label}</span>
                                                                                                        <span className="text-[10px]" style={{ color: '#000000', opacity: 0.65 }}>₹{si.amount.toLocaleString()}</span>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </motion.div>
                                                                                        )}
                                                                                    </AnimatePresence>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                        </div>
                                    </div>

                                    {/* BACK — Rules & Regulations */}
                                    <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: fc.bg, borderColor: fc.border }}
                                        className={`rounded-2xl border ${!cardFlipped ? 'invisible' : ''}`}>

                                        <div className="px-4 py-2.5 flex items-center justify-between gap-2.5 rounded-t-2xl" style={{ background: fc.bg, borderBottom: `1px solid ${fc.border}` }}>
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {schoolLogoUrl
                                                    ? <img src={schoolLogoUrl} alt="School logo" className="w-20 h-20 rounded-lg object-contain shrink-0" style={{ background: fc.bg }} />
                                                    : <div className="w-20 h-20 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FFFFFF', border: `1px dashed ${fc.border}` }}><ImagePlus size={30} style={{ color: '#000000', opacity: 0.3 }} /></div>}
                                                {schoolName
                                                    ? <p className="text-3xl font-bold" style={{ color: '#000000' }}>{schoolName}</p>
                                                    : <p className="text-xs italic" style={{ color: '#000000', opacity: 0.4 }}>School name not added yet</p>}
                                            </div>
                                            <button onClick={() => setCardFlipped(false)}
                                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium border transition-all hover:bg-white/40 shrink-0"
                                                style={{ borderColor: fc.border, color: '#000000' }}>
                                                <span style={{ fontSize: '16px', display: 'inline-block', transform: 'scaleX(-1)' }}>↺</span>
                                                View Front
                                            </button>
                                        </div>

                                        {/* Strip — student name's fee card / rules & regulations */}
                                        <div className="px-4 py-2 border-b" style={{ borderColor: fc.border }}>
                                            <p className="text-sm font-bold tracking-wide" style={{ color: '#000000' }}>{student?.name ?? '—'}&apos;s Fee Card</p>
                                            <p className="text-[11px]" style={{ color: '#000000', opacity: 0.7 }}>Rules & Regulations</p>
                                        </div>

                                        <div className="px-4 py-3 space-y-3">
                                            {rulesAndRegs.length === 0 ? (
                                                <div className="py-8 text-center rounded-xl border border-dashed" style={{ borderColor: fc.border }}>
                                                    <p className="text-xs" style={{ color: '#000000' }}>No rules defined</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2.5">
                                                    {rulesAndRegs.map((rule, i) => (
                                                        <div key={rule.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.4)', border: `1px solid ${fc.border}` }}>
                                                            <span className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0" style={{ background: fc.border, color: '#000000' }}>{i + 1}</span>
                                                            <p className="text-sm leading-relaxed flex-1 pt-0.5" style={{ color: '#000000' }}>{rule.text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </motion.div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Pay Fees (read-only, mirrors admin Payment Methods) ── */}
                <div className="w-full lg:flex-1 lg:min-w-0 h-[500px] lg:h-auto flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                    <div className="px-4 py-3 border-b border-border/40 shrink-0 flex items-center gap-2">
                        <Landmark size={14} className="text-muted-foreground" />
                        <p className="text-sm font-bold">Pay Fees</p>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-background px-4 py-3 space-y-3 divide-y divide-border/30"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>

                        {/* Bank Details */}
                        <div className="pb-3">
                            <p className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Building2 size={14} /> Bank Details</p>
                            <div className="space-y-1">
                                {BANK_LABELS.map(({ key, label }) => (
                                    <div key={key} className="flex items-center justify-between">
                                        <span className="text-[11px] text-muted-foreground">{label}</span>
                                        <span className="text-[11px] font-semibold">{bankDetails?.[key] || '—'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* QR Code */}
                        <div className="pt-3 pb-4">
                            <p className="text-xs font-semibold flex items-center gap-1.5 mb-2"><QrCode size={14} /> QR Code</p>
                            <div className="flex justify-center">
                                {qrImageUrl ? (
                                    <img src={qrImageUrl} alt="QR" className="w-36 h-36 rounded-xl object-cover border border-border/50" />
                                ) : (
                                    <div className="w-36 h-36 rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2">
                                        <QrCode size={28} className="text-muted-foreground/40" />
                                        <p className="text-[10px] text-muted-foreground/60">No QR uploaded</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment Gateway placeholder */}
                        <div className="pt-3">
                            <p className="text-xs font-semibold flex items-center gap-1.5 mb-2"><CreditCard size={14} /> Payment Gateway</p>
                            <div className="rounded-xl border-2 border-dashed border-border/40 px-4 py-4 flex flex-col items-center gap-1.5">
                                <CreditCard size={18} className="text-muted-foreground/30" />
                                <p className="text-xs text-muted-foreground">Coming Soon</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
