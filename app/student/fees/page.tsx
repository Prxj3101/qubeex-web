'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Landmark, Building2, QrCode, CreditCard, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Data ─────────────────────────────────────────────────────────────────────

type FeeStructureType = 'REGULAR' | 'ADDON' | 'PENALTY' | 'ONE_TIME';

interface FeeSubItem { id: string; label: string; amount: number; }
interface FeeItem { id: string; label: string; amount: number; subItems: FeeSubItem[]; }
interface FeeStructure { id: string; name: string; type: FeeStructureType; color: string; items: FeeItem[]; }
interface FeeMonth { id: string; month: string; dueDate: string; assignedStructureIds: string[]; remark: string; status: 'PAID' | 'PENDING'; paidDate?: string; }

const FEE_TYPE_CFG: Record<FeeStructureType, { label: string; color: string; bg: string; text: string; emoji: string }> = {
    REGULAR:  { label: 'Regular Monthly', color: '#7C3AED', bg: 'bg-violet-100 dark:bg-violet-950/40',  text: 'text-violet-700 dark:text-violet-400',  emoji: '📅' },
    ADDON:    { label: 'Add-on',           color: '#DA7756', bg: 'bg-orange-100 dark:bg-orange-950/40',  text: 'text-orange-700 dark:text-orange-400',  emoji: '➕' },
    PENALTY:  { label: 'Penalty / Fine',   color: '#DC2626', bg: 'bg-red-100 dark:bg-red-950/40',        text: 'text-red-700 dark:text-red-400',        emoji: '⚠️' },
    ONE_TIME: { label: 'One-time',         color: '#059669', bg: 'bg-emerald-100 dark:bg-emerald-950/40',text: 'text-emerald-700 dark:text-emerald-400', emoji: '⭐' },
};

const STATUS_CFG = {
    PAID:    { label: 'Paid',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    PENDING: { label: 'Pending', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

const STUDENT = { name: 'Prajwal Jagdish Kotian', rollNo: '09', division: '10-A', paid: false };

// Read-only payment info (mirrors admin "Payment Methods" tab)
const BANK_DETAILS = [
    { label: 'Account Name', value: 'Greenwood High School' },
    { label: 'Account No.', value: '1234 5678 9012' },
    { label: 'IFSC', value: 'HDFC0001234' },
    { label: 'Bank', value: 'HDFC Bank' },
    { label: 'Branch', value: 'Andheri West' },
    { label: 'UPI ID', value: 'greenwood@hdfcbank' },
];
const QR_IMAGE_URL: string | null = null;

const FEE_STRUCTURES: FeeStructure[] = [
    {
        id: 'fs1', name: 'Regular Monthly Fee', type: 'REGULAR', color: '#7C3AED', items: [
            { id: 'i1', label: 'Tuition Fee', amount: 6000, subItems: [
                { id: 's1', label: 'Term 1', amount: 2000 },
                { id: 's2', label: 'Term 2', amount: 2000 },
                { id: 's3', label: 'Term 3', amount: 2000 },
            ]},
            { id: 'i2', label: 'Library Fee', amount: 200, subItems: [] },
        ]
    },
    {
        id: 'fs2', name: 'Lab Fee', type: 'ADDON', color: '#DA7756', items: [
            { id: 'i3', label: 'Physics Lab',   amount: 200, subItems: [] },
            { id: 'i4', label: 'Chemistry Lab', amount: 300, subItems: [] },
        ]
    },
];

const FEE_MONTHS: FeeMonth[] = [
    { id: 'm1', month: 'June',      dueDate: '10 Jun 2026', assignedStructureIds: ['fs1', 'fs2'], remark: '', status: 'PAID',    paidDate: '8 Jun 2026' },
    { id: 'm2', month: 'July',      dueDate: '10 Jul 2026', assignedStructureIds: ['fs1'],         remark: '', status: 'PENDING' },
    { id: 'm3', month: 'August',    dueDate: '10 Aug 2026', assignedStructureIds: ['fs1'],         remark: '', status: 'PENDING' },
    { id: 'm4', month: 'September', dueDate: '10 Sep 2026', assignedStructureIds: ['fs1'],         remark: '', status: 'PENDING' },
];

const RULES = [
    { id: 'r1', text: 'Fee counter timing: Weekdays 8:30 AM to 1:30 PM, Saturday 8:00 AM to 12:00 noon.' },
    { id: 'r2', text: 'Fees are payable from 1st to 15th of every month. Thereafter the counter will remain closed.' },
    { id: 'r3', text: 'Late fee of ₹100 will be charged after the due date.' },
];

function structureTotal(s: FeeStructure) {
    return s.items.reduce((n, item) => {
        const sub = item.subItems.reduce((m, si) => m + si.amount, 0);
        return n + (sub > 0 ? sub : item.amount);
    }, 0);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeesPage() {
    const router = useRouter();
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [cardFlipped, setCardFlipped] = useState(false);

    const monthTotal = (m: FeeMonth) =>
        FEE_STRUCTURES.filter(s => m.assignedStructureIds.includes(s.id)).reduce((n, s) => n + structureTotal(s), 0);

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
                                    {STUDENT.name.split(' ').slice(0, 2).map(w => w[0]).join('')}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold">{STUDENT.name}</p>
                                    <p className="text-[11px] text-muted-foreground">Roll No. {STUDENT.rollNo} · {STUDENT.division}</p>
                                </div>
                                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STUDENT.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                    {STUDENT.paid ? '✓ Paid' : '⏳ Pending'}
                                </span>
                            </div>

                            {/* Fee Card with flip */}
                            <div style={{ perspective: '1200px' }}>
                                <motion.div
                                    animate={{ rotateY: cardFlipped ? 180 : 0 }}
                                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                                    style={{ transformStyle: 'preserve-3d', position: 'relative' }}>

                                    {/* FRONT */}
                                    <div style={{ backfaceVisibility: 'hidden' }}
                                        className={`bg-card rounded-2xl border border-border/50 shadow-sm ${cardFlipped ? 'invisible' : ''}`}>

                                        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-muted/20 rounded-t-2xl">
                                            <div>
                                                <p className="text-sm font-bold">{STUDENT.name}'s Fee Card</p>
                                                <p className="text-[11px] text-muted-foreground">{STUDENT.division}</p>
                                            </div>
                                            <button onClick={() => setCardFlipped(true)}
                                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all">
                                                <span style={{ fontSize: '16px', display: 'inline-block' }}>↺</span>
                                                View Back
                                            </button>
                                        </div>

                                        <div className="space-y-4 px-4 py-3">

                                            {/* Student Details */}
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Student Details</p>
                                                <div className="rounded-xl border border-border/40 overflow-hidden">
                                                    {[
                                                        { label: 'Name',     value: STUDENT.name },
                                                        { label: 'Roll No',  value: STUDENT.rollNo },
                                                        { label: 'Class',    value: '10' },
                                                        { label: 'Division', value: 'A' },
                                                    ].map((f, i) => (
                                                        <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border/20 last:border-none">
                                                            <span className="text-[11px] text-muted-foreground w-24 shrink-0">{f.label}</span>
                                                            <span className="text-[11px] font-medium">{f.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="border-t border-border/40" />

                                            {/* Monthly Payment Schedule */}
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Monthly Payment Schedule</p>
                                                <div className="rounded-xl border border-border/40 overflow-hidden overflow-x-auto">
                                                    <table className="text-xs w-full min-w-[640px] lg:min-w-0">
                                                        <thead>
                                                            <tr className="bg-muted/10 border-b border-border/30">
                                                                {['Month', 'Fee Structures', 'Amount (₹)', 'Due Date', 'Paid Date', 'Status', 'Remark'].map((col, i) => (
                                                                    <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border/20">
                                                            {FEE_MONTHS.map(m => {
                                                                const total = monthTotal(m);
                                                                const assigned = FEE_STRUCTURES.filter(s => m.assignedStructureIds.includes(s.id));
                                                                return (
                                                                    <tr key={m.id} className={`transition-colors ${selectedMonth === m.id ? 'bg-violet-100 dark:bg-violet-950/40' : 'hover:bg-muted/10'}`}>
                                                                        <td className="px-3 py-2 font-semibold whitespace-nowrap cursor-pointer"
                                                                            onClick={() => setSelectedMonth(prev => prev === m.id ? null : m.id)}>
                                                                            {m.month}
                                                                        </td>
                                                                        <td className="px-3 py-2 cursor-pointer"
                                                                            onClick={() => setSelectedMonth(prev => prev === m.id ? null : m.id)}>
                                                                            <div className="flex flex-wrap gap-0.5">
                                                                                {assigned.length === 0
                                                                                    ? <span className="text-[10px] text-muted-foreground/50 italic">—</span>
                                                                                    : assigned.map(s => (
                                                                                        <span key={s.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                                                                            style={{ background: s.color + '20', color: s.color }}>
                                                                                            {s.name}
                                                                                        </span>
                                                                                    ))
                                                                                }
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-2 font-bold text-[11px]">{total > 0 ? `₹${total.toLocaleString()}` : '—'}</td>
                                                                        <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.dueDate}</td>
                                                                        <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.paidDate ?? '—'}</td>
                                                                        <td className="px-3 py-2">
                                                                            <span className={`flex items-center gap-1 w-fit h-6 px-2 rounded-full text-[10px] font-semibold ${STATUS_CFG[m.status].cls}`}>
                                                                                {m.status === 'PAID' ? '✓' : '⏳'} {STATUS_CFG[m.status].label}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.remark || '—'}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            <tr className="bg-muted/20 border-t-2 border-border/40">
                                                                <td className="px-3 py-2 font-bold text-[11px]">Annual Total</td>
                                                                <td />
                                                                <td className="px-3 py-2 text-[11px] font-black" style={{ color: '#7C3AED' }}>
                                                                    ₹{FEE_MONTHS.reduce((n, m) => n + monthTotal(m), 0).toLocaleString()}
                                                                </td>
                                                                <td colSpan={4} />
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="border-t border-border/40" />

                                            {/* Fee Structure Breakdown */}
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                                    {selectedMonth
                                                        ? `Fee Structure Breakdown — ${FEE_MONTHS.find(m => m.id === selectedMonth)?.month}`
                                                        : 'Fee Structure Breakdown'
                                                    }
                                                </p>
                                                {!selectedMonth ? (
                                                    <div className="py-6 text-center rounded-xl border border-dashed border-border/40">
                                                        <p className="text-xs text-muted-foreground/60">Click a month row to view breakdown</p>
                                                    </div>
                                                ) : (() => {
                                                    const month = FEE_MONTHS.find(m => m.id === selectedMonth);
                                                    if (!month) return null;
                                                    const assigned = FEE_STRUCTURES.filter(s => month.assignedStructureIds.includes(s.id));
                                                    if (assigned.length === 0) return (
                                                        <div className="py-6 text-center rounded-xl border border-dashed border-border/40">
                                                            <p className="text-xs text-muted-foreground/60">No fee structures assigned to {month.month}</p>
                                                        </div>
                                                    );
                                                    return (
                                                        <div className="space-y-2">
                                                            {assigned.map(fs => {
                                                                const total = structureTotal(fs);
                                                                const cfg = FEE_TYPE_CFG[fs.type];
                                                                return (
                                                                    <div key={fs.id} className="rounded-xl border border-border/40 overflow-hidden">
                                                                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                                                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: fs.color }} />
                                                                            <span className="flex-1 text-xs font-semibold">{fs.name}</span>
                                                                            <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.emoji} {cfg.label}</span>
                                                                            <span className="text-xs font-bold">₹{total.toLocaleString()}</span>
                                                                        </div>
                                                                        {fs.items.map(item => (
                                                                            <div key={item.id} className="flex items-center justify-between px-3 py-1.5 pl-5 border-t border-border/20 bg-background">
                                                                                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                                                                                <span className="text-[11px] font-medium">₹{(item.subItems.reduce((n, s) => n + s.amount, 0) || item.amount).toLocaleString()}</span>
                                                                            </div>
                                                                        ))}
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
                                    <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                        className={`bg-card rounded-2xl border border-border/50 shadow-sm ${!cardFlipped ? 'invisible' : ''}`}>

                                        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-muted/20 rounded-t-2xl">
                                            <div>
                                                <p className="text-sm font-bold">{STUDENT.name}'s Fee Card</p>
                                                <p className="text-[11px] text-muted-foreground">{STUDENT.division} · Rules & Regulations</p>
                                            </div>
                                            <button onClick={() => setCardFlipped(false)}
                                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all">
                                                <span style={{ fontSize: '16px', display: 'inline-block', transform: 'scaleX(-1)' }}>↺</span>
                                                View Front
                                            </button>
                                        </div>

                                        <div className="px-4 py-3 space-y-3">
                                            {RULES.length === 0 ? (
                                                <div className="py-8 text-center rounded-xl border border-dashed border-border/40">
                                                    <p className="text-xs text-muted-foreground/60">No rules defined</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {RULES.map((rule, i) => (
                                                        <div key={rule.id} className="flex items-start gap-2">
                                                            <span className="text-[11px] font-bold text-muted-foreground mt-0.5 w-5 shrink-0">{i + 1}.</span>
                                                            <p className="text-xs text-foreground leading-relaxed">{rule.text}</p>
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
                                {BANK_DETAILS.map(({ label, value }) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <span className="text-[11px] text-muted-foreground">{label}</span>
                                        <span className="text-[11px] font-semibold">{value || '—'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* QR Code */}
                        <div className="pt-3 pb-4">
                            <p className="text-xs font-semibold flex items-center gap-1.5 mb-2"><QrCode size={14} /> QR Code</p>
                            <div className="flex justify-center">
                                {QR_IMAGE_URL ? (
                                    <img src={QR_IMAGE_URL} alt="QR" className="w-36 h-36 rounded-xl object-cover border border-border/50" />
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
