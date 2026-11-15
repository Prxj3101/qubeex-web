'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { ArrowLeft, Landmark, Building2, QrCode, CreditCard, Wallet, ChevronDown, ImagePlus, ReceiptText, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { busMonthAmount } from '@/lib/busFee';
import { useAcademicYear } from '@/context/AcademicYearContext';
import LibraryDues from '@/components/student/LibraryDues';

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

// The Late Fee Fine applies once today is strictly after the due date, AND
// either no paid date has been entered yet, or the paid date entered is
// itself after the due date (i.e. actually paid late). Once it has applied
// it stays applied — status/paid-date edits don't clear it unless the paid
// date entered is on or before the due date (meaning the student genuinely
// paid on time and the admin was just late updating the record).
function isLateFeeApplicable(dueDate: string | null | undefined, paidDate: string | null | undefined): boolean {
    const due = parseFlexDate(dueDate);
    if (!due) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    if (today.getTime() <= due.getTime()) return false;
    if (!paidDate || !paidDate.trim()) return true;
    const paid = parseFlexDate(paidDate);
    if (!paid) return true;
    paid.setHours(0, 0, 0, 0);
    return paid.getTime() > due.getTime();
}

// ─── Data ─────────────────────────────────────────────────────────────────────

type FeeStructureType = 'REGULAR' | 'ADDON' | 'PENALTY' | 'ONE_TIME' | 'BUS' | 'LATE_FEE';

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
    defaultKey?: 'name' | 'rollNo' | 'studentId' | 'class' | 'division' | 'bus';
    label: string;
    value?: string;
};
const DEFAULT_STUDENT_FIELDS: StudentDetailField[] = [
    { id: 'f-name', kind: 'default', defaultKey: 'name', label: 'Name' },
    { id: 'f-rollno', kind: 'default', defaultKey: 'rollNo', label: 'Roll No' },
    { id: 'f-studentid', kind: 'default', defaultKey: 'studentId', label: 'Student ID' },
    { id: 'f-class', kind: 'default', defaultKey: 'class', label: 'Class' },
    { id: 'f-division', kind: 'default', defaultKey: 'division', label: 'Division' },
    { id: 'f-bus', kind: 'default', defaultKey: 'bus', label: 'Bus' },
];

const FEE_TYPE_CFG: Record<FeeStructureType, { label: string; color: string; bg: string; text: string; emoji: string }> = {
    REGULAR:  { label: 'Regular Monthly', color: '#7C3AED', bg: 'bg-violet-100 dark:bg-violet-950/40',  text: 'text-violet-700 dark:text-violet-400',  emoji: '📅' },
    ADDON:    { label: 'Add-on',           color: '#DA7756', bg: 'bg-orange-100 dark:bg-orange-950/40',  text: 'text-orange-700 dark:text-orange-400',  emoji: '➕' },
    PENALTY:  { label: 'Penalty / Fine',   color: '#DC2626', bg: 'bg-red-100 dark:bg-red-950/40',        text: 'text-red-700 dark:text-red-400',        emoji: '⚠️' },
    ONE_TIME: { label: 'One-time',         color: '#059669', bg: 'bg-emerald-100 dark:bg-emerald-950/40',text: 'text-emerald-700 dark:text-emerald-400', emoji: '⭐' },
    BUS:      { label: 'Bus Fee',          color: '#0891B2', bg: 'bg-cyan-100 dark:bg-cyan-950/40',       text: 'text-cyan-700 dark:text-cyan-400',       emoji: '🚌' },
    LATE_FEE: { label: 'Late Fee Fine',    color: '#DC2626', bg: 'bg-red-100 dark:bg-red-950/40',     text: 'text-red-700 dark:text-red-400',     emoji: '⚠️' },
};

// Paid / due per month and receipts from the school's fee counter (GET /student/fees → money).
interface FeeMoney {
    bills: { feeMonthId: string; month: string; total: number; received: number; balance: number; due: boolean }[];
    totals: { total: number; paid: number; balance: number; overdue: number };
    receipts: { id: string; receiptNo: string; day: string; amount: number; discount: number; mode: string; lines: { month: string }[] }[];
}
const MODE_LABEL: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', CHEQUE: 'Cheque', CARD: 'Card', BANK: 'Bank transfer' };
const rupees = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const prettyDay = (day: string) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };

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

// Bus Fee / Late Fee Fine are fixed system types with a fixed color scheme —
// structures saved before that color scheme changed still have the old hex
// baked into their saved `color` field, so normalize it against the current
// config whenever structures are loaded, instead of showing stale colors.
function normalizeStructureColors(structures: FeeStructure[]): FeeStructure[] {
    return structures.map(s => (s.type === 'BUS' || s.type === 'LATE_FEE') && s.color !== FEE_TYPE_CFG[s.type].color
        ? { ...s, color: FEE_TYPE_CFG[s.type].color }
        : s);
}

const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
function getAvatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(n: string) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

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
    const { selectedYearId, isCurrentYearSelected } = useAcademicYear();
    const effectiveYear = isCurrentYearSelected ? null : selectedYearId;
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [cardFlipped, setCardFlipped] = useState(false);
    const [expandedBreakdownItemIds, setExpandedBreakdownItemIds] = useState<Set<string>>(new Set());
    const [feeCardTheme, setFeeCardTheme] = useState<FeeCardThemeKey>('yellow');
    const fc = FEE_CARD_THEMES[feeCardTheme];
    const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null);
    const [schoolName, setSchoolName] = useState('');

    const [student, setStudent] = useState<{ name: string; rollNo: string; studentId: string; standardName: string; divisionName: string; avatarUrl: string | null } | null>(null);
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [feeMonths, setFeeMonths] = useState<FeeMonth[]>([]);
    const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
    const [rulesAndRegs, setRulesAndRegs] = useState<{ id: string; text: string }[]>([]);
    const [extraColumns, setExtraColumns] = useState<{ label: string }[]>([]);
    const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
    const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
    const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
    const [qrDownloading, setQrDownloading] = useState(false);
    const [studentFields, setStudentFields] = useState<StudentDetailField[]>(DEFAULT_STUDENT_FIELDS);
    const [extraDetailFields, setExtraDetailFields] = useState<Record<string, string> | null>(null);
    const [money, setMoney] = useState<FeeMoney | null>(null);

    useEffect(() => {
        setLoading(true);
        const qs = effectiveYear ? `?academicYearId=${effectiveYear}` : '';
        Promise.all([
            api.get('/student/me').catch(() => ({ data: { data: null } })),
            api.get(`/student/fees${qs}`).catch(() => ({ data: { data: { structure: null, payments: [] } } })),
        ]).then(([meRes, feesRes]) => {
            const me = meRes.data?.data;
            if (me) {
                setStudent({
                    name: me.user?.name ?? '',
                    rollNo: me.rollNo ?? '—',
                    studentId: me.studentId ?? '—',
                    standardName: me.standard?.name ?? '',
                    divisionName: me.division?.name ?? '',
                    avatarUrl: me.avatarUrl ?? null,
                });
            }

            const structure = feesRes.data?.data?.structure;
            setFeeStructures(normalizeStructureColors(structure?.feeStructures ?? []));
            setFeeMonths(structure?.feeMonths ?? []);
            setRulesAndRegs(structure?.rulesAndRegs ?? []);
            setExtraColumns(structure?.extraColumns ?? []);
            setBankDetails(structure?.bankDetails ?? null);
            setQrImageUrl(structure?.qrImageUrl ?? null);
            const theme = structure?.feeCardTheme;
            setFeeCardTheme(theme && theme in FEE_CARD_THEMES ? theme as FeeCardThemeKey : 'yellow');
            setSchoolLogoUrl(structure?.schoolLogoUrl ?? null);
            setSchoolName(structure?.schoolName ?? '');
            if (structure?.studentFields && structure.studentFields.length > 0) {
                const hasBus = structure.studentFields.some((f: StudentDetailField) => f.kind === 'default' && f.defaultKey === 'bus');
                setStudentFields(hasBus ? structure.studentFields : [...structure.studentFields, { id: 'f-bus', kind: 'default' as const, defaultKey: 'bus' as const, label: 'Bus' }]);
            } else {
                setStudentFields(DEFAULT_STUDENT_FIELDS);
            }
            setExtraDetailFields(feesRes.data?.data?.extraDetailFields ?? null);

            setFeePayments(feesRes.data?.data?.payments ?? []);
            setMoney(feesRes.data?.data?.money ?? null);
        }).finally(() => setLoading(false));
    }, [effectiveYear]);

    const downloadQrCode = async () => {
        if (!qrImageUrl) return;
        setQrDownloading(true);
        try {
            const res = await fetch(qrImageUrl);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'payment-qr-code.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            window.open(qrImageUrl, '_blank');
        } finally {
            setQrDownloading(false);
        }
    };

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

    // If the payment for month `m` is overdue (past due date, no paid date,
    // still Pending), the Late Fee Fine structure auto-applies — this isn't
    // stored anywhere, it's derived live from dates so it clears itself
    // automatically the moment the payment is marked paid/paid-date set.
    const getAutoLateFee = (m: FeeMonth): FeeStructure | null => {
        const payment = getPayment(m.id);
        if (!isLateFeeApplicable(m.dueDate, payment.paidDate)) return null;
        const lateFee = feeStructures.find(s => s.type === 'LATE_FEE');
        if (!lateFee) return null;
        if (m.assignedStructureIds.includes(lateFee.id)) return null;
        if ((payment.extraStructureIds ?? []).includes(lateFee.id)) return null;
        return lateFee;
    };

    // Once the Bus toggle is ON, the admin explicitly picks which months get
    // the Bus Fee structure via the month picker — it only applies to the
    // months chosen, not automatically to every month going forward. Its
    // amount isn't the shared structure's own items total (that's
    // empty/variable), it's this student's own Bus Fee amount entered by the
    // admin in the Student Details box, since bus fee varies per student by
    // pickup location.
    const getAutoBusFee = (m: FeeMonth): { structure: FeeStructure; amount: number } | null => {
        const busField = studentFields.find(f => f.kind === 'default' && f.defaultKey === 'bus');
        if (!busField) return null;
        // months locked at an old amount still count after the bus is turned off (lib/busFee)
        const amount = busMonthAmount(extraDetailFields, busField.id, m.id);
        if (amount == null) return null;
        const busStructure = feeStructures.find(s => s.type === 'BUS');
        if (!busStructure) return null;
        if (m.assignedStructureIds.includes(busStructure.id)) return null;
        return { structure: busStructure, amount };
    };

    // Shared month total plus this student's own extra structures (e.g. a Penalty
    // added just for them this month, on top of the division's shared set), plus
    // the auto-applied Late Fee Fine when this month is overdue & unpaid, plus the
    // auto-applied Bus Fee once the Bus toggle is on.
    const studentMonthTotal = (m: FeeMonth) => {
        const extraIds = (getPayment(m.id).extraStructureIds ?? []).filter(id => !m.assignedStructureIds.includes(id));
        const extra = feeStructures.filter(s => extraIds.includes(s.id)).reduce((n, s) => n + structureTotal(s), 0);
        const autoLateFee = getAutoLateFee(m);
        const autoBusFee = getAutoBusFee(m);
        return monthTotal(m) + extra + (autoLateFee ? structureTotal(autoLateFee) : 0) + (autoBusFee ? autoBusFee.amount : 0);
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
                        <h1 className="text-xl font-bold leading-tight">Fee Details</h1>
                        <p className="text-[13px] text-muted-foreground">Your fee records & payment history</p>
                    </div>
                </div>
                <div className="h-px bg-border/60" />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-4 pb-3">

                {/* ── LEFT: Fee Details (same as teacher fees tab) ── */}
                <div className="order-2 w-full lg:w-[60%] lg:shrink-0 h-[70vh] lg:h-auto flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5" data-dashboard-surface="">
                    <div className="px-4 py-3 border-b border-border/40 shrink-0 flex items-center gap-2">
                        <Wallet size={14} className="text-muted-foreground" />
                        <p className="text-sm font-bold">Fee Details</p>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-background px-4 py-3">
                        <div className="space-y-4">

                            {/* Student header */}
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-white dark:bg-muted/20" data-dashboard-surface="">
                                <div className="w-10 h-10 rounded-xl overflow-hidden relative flex items-center justify-center text-sm font-bold text-white shrink-0"
                                    style={{ background: student?.avatarUrl ? 'transparent' : getAvatarColor(student?.name ?? '') }}>
                                    {student?.avatarUrl
                                        ? <NextImage src={student.avatarUrl} alt={student.name} fill sizes="80px" quality={90} className="object-cover" />
                                        : getInitials(student?.name ?? '')}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold">{student?.name ?? '—'}</p>
                                    <p className="text-[11px] text-muted-foreground">Roll No. {student?.rollNo ?? '—'} · {student?.divisionName ?? '—'}</p>
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
                                                        const isBus = f.kind === 'default' && f.defaultKey === 'bus';
                                                        if (isBus) {
                                                            const busEnabled = extraDetailFields?.[`${f.id}-enabled`] === 'true';
                                                            const busNumber = extraDetailFields?.[`${f.id}-number`] || '—';
                                                            const busFee = extraDetailFields?.[`${f.id}-fee`] || '0';
                                                            return (
                                                                <div key={f.id} className="flex items-center justify-between gap-1 px-2.5 py-2 rounded-lg basis-[calc(50%-4px)] grow-0 shrink-0" style={{ border: `1px solid ${fc.border}` }}>
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <span className="text-[11px]" style={{ color: '#000000' }}>{f.label}</span>
                                                                        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full ${busEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                                                                            {busEnabled ? 'On' : 'Off'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <div className="flex items-center gap-0.5 shrink-0">
                                                                            <span className="text-[11px]" style={{ color: '#000000', opacity: busEnabled ? 0.6 : 0.3 }}>Bus No.</span>
                                                                            <span className="text-[11px] font-semibold" style={{ color: '#000000' }}>{busEnabled ? (busNumber || '—') : '—'}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-0.5 shrink-0">
                                                                            <span className="text-[11px]" style={{ color: '#000000', opacity: busEnabled ? 0.6 : 0.3 }}>Bus Fee ₹</span>
                                                                            <span className="text-[11px] font-semibold" style={{ color: '#000000' }}>{busEnabled ? busFee : '—'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        const value = f.kind === 'default'
                                                            ? f.defaultKey === 'name' ? (student?.name ?? '—')
                                                                : f.defaultKey === 'rollNo' ? (student?.rollNo ?? '—')
                                                                    : f.defaultKey === 'studentId' ? (student?.studentId ?? '—')
                                                                        : f.defaultKey === 'class' ? (student?.divisionName?.split('-')[0] ?? student?.divisionName ?? '—')
                                                                            : (student?.divisionName?.split('-')[1] ?? '—')
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
                                                <div className="rounded-xl border overflow-x-auto overflow-y-auto max-h-[340px]" style={{ borderColor: fc.border, scrollbarWidth: 'thin', scrollbarColor: `${fc.border} transparent` }}>
                                                    <table className="text-xs w-full min-w-[640px] lg:min-w-0" style={{ color: '#000000' }}>
                                                        <thead className="sticky top-0 z-10">
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
                                                                const autoLateFee = getAutoLateFee(m);
                                                                const autoBusFee = getAutoBusFee(m);
                                                                return (
                                                                    <tr key={m.id} className="transition-colors" style={{ background: selectedMonth === m.id ? `${fc.border}80` : mi % 2 === 1 ? fc.bg : 'transparent', borderTop: `1px solid ${fc.border}` }}>
                                                                        <td className="px-3 py-2 font-semibold whitespace-nowrap cursor-pointer" style={{ borderRight: `1px solid ${fc.border}` }}
                                                                            onClick={() => setSelectedMonth(prev => prev === m.id ? null : m.id)}>
                                                                            {m.month}
                                                                        </td>
                                                                        <td className="px-3 py-2 cursor-pointer" style={{ borderRight: `1px solid ${fc.border}` }}
                                                                            onClick={() => setSelectedMonth(prev => prev === m.id ? null : m.id)}>
                                                                            <div className="flex flex-wrap gap-0.5">
                                                                                {assigned.length === 0 && extraStructures.length === 0 && !autoLateFee && !autoBusFee
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
                                                                                {autoLateFee && (
                                                                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                                                                        style={{ background: autoLateFee.color + '20', color: autoLateFee.color }}
                                                                                        title="Auto-applied: payment is overdue and unpaid">
                                                                                        {autoLateFee.name}
                                                                                    </span>
                                                                                )}
                                                                                {autoBusFee && (
                                                                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                                                                        style={{ background: autoBusFee.structure.color + '20', color: autoBusFee.structure.color }}
                                                                                        title="Auto-applied: your Bus service is on">
                                                                                        {autoBusFee.structure.name}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-2 font-bold" style={{ borderRight: `1px solid ${fc.border}` }}>{total > 0 ? `₹${total.toLocaleString()}` : '—'}</td>
                                                                        <td className="px-3 py-2 text-[11px] font-medium" style={{ color: '#000000', borderRight: `1px solid ${fc.border}` }}>{m.dueDate}</td>
                                                                        <td className="px-3 py-2 text-[11px] font-medium" style={{ color: isPaidLate(m.dueDate, payment.paidDate) ? '#DC2626' : '#000000', fontWeight: isPaidLate(m.dueDate, payment.paidDate) ? 600 : undefined, borderRight: `1px solid ${fc.border}` }}>{payment.paidDate || '—'}</td>
                                                                        <td className="px-3 py-2" style={{ borderRight: `1px solid ${fc.border}` }}>
                                                                            {(() => {
                                                                                // Part paid at the fee counter: show it, with what is left.
                                                                                const bill = money?.bills.find(b => b.feeMonthId === m.id);
                                                                                if (payment.status !== 'PAID' && bill && bill.received > 0 && bill.balance > 0) return (
                                                                                    <span className="flex flex-col w-fit">
                                                                                        <span className="flex items-center gap-1 w-fit h-6 px-2 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">◐ Partial</span>
                                                                                        <span className="text-[9.5px] font-semibold mt-0.5" style={{ color: '#B45309' }}>{rupees(bill.balance)} left</span>
                                                                                    </span>
                                                                                );
                                                                                return (
                                                                                    <span className={`flex items-center gap-1 w-fit h-6 px-2 rounded-full text-[10px] font-semibold ${STATUS_CFG[payment.status].cls}`}>
                                                                                        {payment.status === 'PAID' ? '✓' : '⏳'} {STATUS_CFG[payment.status].label}
                                                                                    </span>
                                                                                );
                                                                            })()}
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
                                                    const autoLateFee = getAutoLateFee(month);
                                                    const autoBusFee = getAutoBusFee(month);
                                                    const assigned = feeStructures.filter(s => sharedIds.has(s.id) || extraIds.includes(s.id) || s.id === autoLateFee?.id || s.id === autoBusFee?.structure.id);
                                                    if (assigned.length === 0) return (
                                                        <div className="py-6 text-center rounded-xl border border-dashed" style={{ borderColor: fc.border }}>
                                                            <p className="text-xs" style={{ color: '#000000' }}>No fee structures assigned to {month.month}</p>
                                                        </div>
                                                    );
                                                    return (
                                                        <div className="space-y-2">
                                                            {assigned.map(fs => {
                                                                const isAutoBusFee = fs.id === autoBusFee?.structure.id;
                                                                const total = isAutoBusFee && autoBusFee ? autoBusFee.amount : structureTotal(fs);
                                                                const cfg = FEE_TYPE_CFG[fs.type];
                                                                const isExtra = extraIds.includes(fs.id);
                                                                const isAutoLateFee = fs.id === autoLateFee?.id;
                                                                return (
                                                                    <div key={fs.id} className="rounded-xl border overflow-hidden" style={(isExtra || isAutoLateFee || isAutoBusFee) ? { borderColor: fs.color + '60', borderStyle: 'dashed' } : { borderColor: fc.border }}>
                                                                        <div className="flex items-center gap-2 px-3 py-2" style={{ background: fc.bg }}>
                                                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: fs.color }} />
                                                                            <span className="flex-1 text-xs font-semibold" style={{ color: '#000000' }}>{fs.name}</span>
                                                                            {isExtra && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: fs.color + '20', color: fs.color }}>For you</span>}
                                                                            {isAutoLateFee && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: fs.color + '20', color: fs.color }}>Auto-applied</span>}
                                                                            {isAutoBusFee && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: fs.color + '20', color: fs.color }}>Auto-applied</span>}
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
                <div className="order-1 w-full lg:flex-1 lg:min-w-0 h-[500px] lg:h-auto flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5" data-dashboard-surface="">
                    <div className="px-4 py-3 border-b border-border/40 shrink-0 flex items-center gap-2">
                        <Landmark size={14} className="text-muted-foreground" />
                        <p className="text-sm font-bold">Pay Fees</p>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-background px-4 py-3 space-y-3 divide-y divide-border/30"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>

                        {/* This year's fees at a glance */}
                        {money && money.totals.total > 0 && (
                            <div className="pb-3">
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Paid', value: money.totals.paid, cls: 'text-emerald-600' },
                                        { label: 'Still due', value: money.totals.balance, cls: '' },
                                        { label: 'Overdue', value: money.totals.overdue, cls: money.totals.overdue > 0 ? 'text-red-600' : '' },
                                    ].map(x => (
                                        <div key={x.label} className="rounded-xl border border-border/50 bg-card px-2.5 py-2">
                                            <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">{x.label}</p>
                                            <p className={`text-sm font-bold tabular-nums ${x.cls}`}>{rupees(x.value)}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (money.totals.paid / money.totals.total) * 100)}%` }} />
                                </div>
                            </div>
                        )}

                        {/* Receipts from the school's fee counter */}
                        {money && (
                            <div className="py-3">
                                <p className="text-xs font-semibold flex items-center gap-1.5 mb-2"><ReceiptText size={14} /> Receipts</p>
                                {money.receipts.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground">No payments this year yet.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {money.receipts.map(r => (
                                            <div key={r.id} className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card px-3 py-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold tabular-nums">{rupees(r.amount)} <span className="font-medium text-muted-foreground">· {MODE_LABEL[r.mode] ?? r.mode}</span></p>
                                                    <p className="text-[10.5px] text-muted-foreground truncate">#{r.receiptNo} · {prettyDay(r.day)} · {r.lines.map(l => l.month.slice(0, 3)).join(', ')}</p>
                                                </div>
                                                <button type="button" title="Print / save receipt" onClick={() => window.open(`/print/fee-receipt/${r.id}`, '_blank', 'noopener')}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground shrink-0">
                                                    <Printer size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Bank Details */}
                        <div className="py-3">
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
                                    <button type="button" onClick={() => setQrPreviewOpen(true)}
                                        className="group relative w-36 h-36 rounded-xl overflow-hidden border border-border/50">
                                        <img src={qrImageUrl} alt="QR" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                            <span className="opacity-0 group-hover:opacity-100 text-[11px] font-semibold text-white transition-all">Tap to enlarge</span>
                                        </div>
                                    </button>
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

            <LibraryDues />

            {/* QR Code enlarge + download */}
            <AnimatePresence>
                {qrPreviewOpen && qrImageUrl && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setQrPreviewOpen(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()} data-dashboard-surface="">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-bold flex items-center gap-1.5"><QrCode size={14} /> Payment QR Code</p>
                                <button onClick={() => setQrPreviewOpen(false)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                                    ✕
                                </button>
                            </div>
                            <img src={qrImageUrl} alt="QR" className="w-full aspect-square rounded-xl object-contain border border-border/50 bg-white" />
                            <button onClick={downloadQrCode} disabled={qrDownloading}
                                className="mt-4 w-full h-10 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-60"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                {qrDownloading ? 'Downloading…' : 'Download QR Code'}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
