'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, X, Users, ChevronRight, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

type FeeStructureType = 'REGULAR' | 'ADDON' | 'PENALTY' | 'ONE_TIME';

interface FeeSubItem { id: string; label: string; amount: number; }
interface FeeItem { id: string; label: string; amount: number; subItems: FeeSubItem[]; }
interface FeeStructure { id: string; name: string; type: FeeStructureType; color: string; items: FeeItem[]; }
interface FeeMonth { id: string; month: string; dueDate: string; assignedStructureIds: string[]; remark: string; status: 'PAID' | 'PENDING'; paidDate?: string; }

const FEE_TYPE_CFG: Record<FeeStructureType, { label: string; color: string; bg: string; text: string; emoji: string }> = {
    REGULAR: { label: 'Regular Monthly', color: '#7C3AED', bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', emoji: '📅' },
    ADDON: { label: 'Add-on', color: '#DA7756', bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', emoji: '➕' },
    PENALTY: { label: 'Penalty / Fine', color: '#DC2626', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', emoji: '⚠️' },
    ONE_TIME: { label: 'One-time', color: '#059669', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', emoji: '⭐' },
};

const STATUS_CFG = {
    PAID: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    PENDING: { label: 'Pending', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

const MOCK_STUDENTS = [
    { id: 'st1', name: 'Aarav Mehta', rollNo: '01', paid: true },
    { id: 'st2', name: 'Priya Singh', rollNo: '02', paid: false },
    { id: 'st3', name: 'Rohan Gupta', rollNo: '03', paid: true },
    { id: 'st4', name: 'Sneha Patel', rollNo: '04', paid: false },
    { id: 'st5', name: 'Arjun Kumar', rollNo: '05', paid: true },
    { id: 'st6', name: 'Meera Sharma', rollNo: '06', paid: false },
    { id: 'st7', name: 'Karan Joshi', rollNo: '07', paid: true },
    { id: 'st8', name: 'Ananya Nair', rollNo: '08', paid: false },
    { id: 'st9', name: 'Vikram Rao', rollNo: '09', paid: true },
    { id: 'st10', name: 'Ishaan Verma', rollNo: '10', paid: false },
];

const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
function getAvatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(n: string) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

function structureTotal(s: FeeStructure) {
    return s.items.reduce((n, item) => {
        const sub = item.subItems.reduce((m, si) => m + si.amount, 0);
        return n + (sub > 0 ? sub : item.amount);
    }, 0);
}

const MOCK_FEE_STRUCTURES: FeeStructure[] = [
    {
        id: 'fs1', name: 'Regular Monthly Fee', type: 'REGULAR', color: '#7C3AED', items: [
            {
                id: 'i1', label: 'Tuition Fee', amount: 6000, subItems: [
                    { id: 's1', label: 'Term 1', amount: 2000 },
                    { id: 's2', label: 'Term 2', amount: 2000 },
                    { id: 's3', label: 'Term 3', amount: 2000 },
                ]
            },
            { id: 'i2', label: 'Library Fee', amount: 200, subItems: [] },
        ]
    },
    {
        id: 'fs2', name: 'Lab Fee', type: 'ADDON', color: '#DA7756', items: [
            { id: 'i3', label: 'Physics Lab', amount: 200, subItems: [] },
            { id: 'i4', label: 'Chemistry Lab', amount: 300, subItems: [] },
        ]
    },
];

const MOCK_FEE_MONTHS: FeeMonth[] = [
    { id: 'm1', month: 'June', dueDate: '10 Jun 2026', assignedStructureIds: ['fs1', 'fs2'], remark: '', status: 'PAID', paidDate: '8 Jun 2026' },
    { id: 'm2', month: 'July', dueDate: '10 Jul 2026', assignedStructureIds: ['fs1'], remark: '', status: 'PENDING' },
    { id: 'm3', month: 'August', dueDate: '10 Aug 2026', assignedStructureIds: ['fs1'], remark: '', status: 'PENDING' },
    { id: 'm4', month: 'September', dueDate: '10 Sep 2026', assignedStructureIds: ['fs1'], remark: '', status: 'PENDING' },
];

const MOCK_RULES = [
    { id: 'r1', text: 'Fee counter timing: Weekdays 8:30 AM to 1:30 PM, Saturday 8:00 AM to 12:00 noon.' },
    { id: 'r2', text: 'Fees are payable from 1st to 15th of every month. Thereafter the counter will remain closed.' },
    { id: 'r3', text: 'Late fee of ₹100 will be charged after the due date.' },
];

const MOCK_EXTRA_STUDENT_FIELDS = [
    { label: 'Name', value: '' },
    { label: 'Roll No', value: '' },
    { label: 'Class', value: '' },
    { label: 'Division', value: '' },
];

export default function TeacherFeesTab({ divisionId, divisionName }: {
    divisionId: string;
    divisionName: string;
}) {
    const [selectedStudent, setSelectedStudent] = useState<typeof MOCK_STUDENTS[0] | null>(MOCK_STUDENTS[0]);
    const [studentFilter, setStudentFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [showListMenu, setShowListMenu] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [studentCardFlipped, setStudentCardFlipped] = useState(false);
    const [expandedFeeIds, setExpandedFeeIds] = useState<string[]>([]);

    const feeStructures = MOCK_FEE_STRUCTURES;
    const feeMonths = MOCK_FEE_MONTHS;
    const rulesAndRegs = MOCK_RULES;

    const monthTotal = (m: FeeMonth) =>
        feeStructures.filter(s => m.assignedStructureIds.includes(s.id)).reduce((n, s) => n + structureTotal(s), 0);

    const toggleExpand = (id: string) =>
        setExpandedFeeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const generatePDF = (type: 'all' | 'pending') => {
        const students = type === 'all' ? MOCK_STUDENTS : MOCK_STUDENTS.filter(s => !s.paid);
        const blob = new Blob([`Fee List\n\n${students.map(s => `${s.rollNo}. ${s.name} — ${s.paid ? 'Paid' : 'Pending'}`).join('\n')}`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `fees-${type}.txt`; a.click();
        URL.revokeObjectURL(url); toast.success('Downloaded');
    };

    return (
        <div className="flex gap-3 flex-1 h-full overflow-hidden py-3 px-1">


            {/* LEFT — Students List */}
            <div className="w-[25%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-3.5 py-2.5 border-b border-border/40 shrink-0">
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
                                        <button onClick={() => { generatePDF('all'); setShowListMenu(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted">📋 All Students</button>
                                        <button onClick={() => { generatePDF('pending'); setShowListMenu(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted">⏳ Pending Only</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="px-3.5 py-1.5 border-b border-border/40 shrink-0 flex gap-1 bg-background">
                    {(['all', 'paid', 'pending'] as const).map(f => (
                        <button key={f} onClick={() => setStudentFilter(f)}
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-all ${studentFilter === f
                                ? f === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                    : f === 'pending' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                        : 'bg-primary text-white'
                                : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                            {f}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto bg-background">
                    {MOCK_STUDENTS.filter(s => studentFilter === 'all' ? true : studentFilter === 'paid' ? s.paid : !s.paid).map(student => (
                        <button key={student.id}
                            onClick={() => {
                                setSelectedStudent(prev => prev?.id === student.id ? null : student);
                                setSelectedMonth(null);
                                setStudentCardFlipped(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3.5 py-3 border-b border-border/20 text-left hover:bg-muted/30 transition-colors ${selectedStudent?.id === student.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                style={{ background: getAvatarColor(student.name) }}>
                                {getInitials(student.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate">{student.name}</p>
                                <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${student.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                {student.paid ? 'Paid' : 'Pending'}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* RIGHT — Fee Details */}
            <div className="flex-1 flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-3 border-b border-border/40 shrink-0">
                    <p className="text-sm font-bold">Fee Details</p>
                </div>
                <div className="flex-1 overflow-y-auto bg-background px-4 py-3">
                    {!selectedStudent ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3"><Users size={20} className="text-muted-foreground" /></div>
                            <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Click any student to view their fee card</p>
                        </div>
                    ) : (
                        <div className="space-y-4">

                            {/* Student header */}
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                    style={{ background: getAvatarColor(selectedStudent.name) }}>
                                    {getInitials(selectedStudent.name)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold">{selectedStudent.name}</p>
                                    <p className="text-[11px] text-muted-foreground">Roll No. {selectedStudent.rollNo} · {divisionName}</p>
                                </div>
                                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${selectedStudent.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                    {selectedStudent.paid ? '✓ Paid' : '⏳ Pending'}
                                </span>
                            </div>

                            {/* Fee Card with flip */}
                            <div style={{ perspective: '1200px' }}>
                                <motion.div
                                    animate={{ rotateY: studentCardFlipped ? 180 : 0 }}
                                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                                    style={{ transformStyle: 'preserve-3d', position: 'relative' }}>

                                    {/* FRONT */}
                                    <div style={{ backfaceVisibility: 'hidden' }}
                                        className={`bg-card rounded-2xl border border-border/50 shadow-sm ${studentCardFlipped ? 'invisible' : ''}`}>

                                        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-muted/20 rounded-t-2xl">
                                            <div>
                                                <p className="text-sm font-bold">{selectedStudent.name}'s Fee Card</p>
                                                <p className="text-[11px] text-muted-foreground">{divisionName}</p>
                                            </div>
                                            <button onClick={() => setStudentCardFlipped(true)}
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
                                                        { label: 'Name', value: selectedStudent.name },
                                                        { label: 'Roll No', value: selectedStudent.rollNo },
                                                        { label: 'Class', value: 'Class Name' },
                                                        { label: 'Division', value: divisionName },
                                                    ].map((f, i) => (
                                                        <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border/20 last:border-none">
                                                            <span className="text-[11px] text-muted-foreground w-24 shrink-0">{f.label}</span>
                                                            <span className="text-[11px] font-medium">{f.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="border-t border-border/40" />

                                            {/* Monthly Payment Schedule — read only */}
                                            {feeMonths.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Monthly Payment Schedule</p>
                                                    <div className="rounded-xl border border-border/40 overflow-hidden">
                                                        <table className="text-xs w-full">
                                                            <thead>
                                                                <tr className="bg-muted/10 border-b border-border/30">
                                                                    {['Month', 'Fee Structures', 'Amount (₹)', 'Due Date', 'Paid Date', 'Status', 'Remark'].map((col, i) => (
                                                                        <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border/20">
                                                                {feeMonths.map(m => {
                                                                    const total = monthTotal(m);
                                                                    const assigned = feeStructures.filter(s => m.assignedStructureIds.includes(s.id));
                                                                    return (
                                                                        <tr key={m.id} className="hover:bg-muted/10 transition-colors">
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
                                                                        ₹{feeMonths.reduce((n, m) => n + monthTotal(m), 0).toLocaleString()}
                                                                    </td>
                                                                    <td colSpan={4} />
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="border-t border-border/40" />

                                            {/* Fee Structure Breakdown */}
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                                    {selectedMonth
                                                        ? `Fee Structure Breakdown — ${feeMonths.find(m => m.id === selectedMonth)?.month}`
                                                        : 'Fee Structure Breakdown'
                                                    }
                                                </p>
                                                {!selectedMonth ? (
                                                    <div className="py-6 text-center rounded-xl border border-dashed border-border/40">
                                                        <p className="text-xs text-muted-foreground/60">Click a month row to view breakdown</p>
                                                    </div>
                                                ) : (() => {
                                                    const month = feeMonths.find(m => m.id === selectedMonth);
                                                    if (!month) return null;
                                                    const assigned = feeStructures.filter(s => month.assignedStructureIds.includes(s.id));
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
                                    <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', top: 0, left: 0, right: 0 }}
                                        className={`bg-card rounded-2xl border border-border/50 shadow-sm ${!studentCardFlipped ? 'invisible' : ''}`}>

                                        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-muted/20 rounded-t-2xl">
                                            <div>
                                                <p className="text-sm font-bold">{selectedStudent.name}'s Fee Card</p>
                                                <p className="text-[11px] text-muted-foreground">{divisionName} · Rules & Regulations</p>
                                            </div>
                                            <button onClick={() => setStudentCardFlipped(false)}
                                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all">
                                                <span style={{ fontSize: '16px', display: 'inline-block', transform: 'scaleX(-1)' }}>↺</span>
                                                View Front
                                            </button>
                                        </div>

                                        <div className="px-4 py-3 space-y-3">
                                            {rulesAndRegs.length === 0 ? (
                                                <div className="py-8 text-center rounded-xl border border-dashed border-border/40">
                                                    <p className="text-xs text-muted-foreground/60">No rules defined</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {rulesAndRegs.map((rule, i) => (
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
                    )}
                </div>
            </div>
        </div>
    );
}