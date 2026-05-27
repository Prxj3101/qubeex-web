'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, X, Check, Users, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ... (same types as admin FeesTab)

type FeeMonth = { id: string; month: string; dueDate: string; status: 'PAID' | 'PENDING'; paidDate?: string; remark?: string; };
type FeeSubItem = { id: string; label: string; amount: number; };
type FeeItem = { id: string; label: string; amount: number; subItems: FeeSubItem[]; };

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
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

export default function TeacherFeesTab({ divisionId, divisionName }: {
    divisionId: string;
    divisionName: string;
}) {
    const [selectedStudent, setSelectedStudent] = useState<typeof MOCK_STUDENTS[0] | null>(null);
    const [studentFilter, setStudentFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [expandedFeeId, setExpandedFeeId] = useState<string[]>(['f1']);

    const [feeItems] = useState<FeeItem[]>([
        { id: 'f1', label: 'Tuition Fee', amount: 6000, subItems: [{ id: 'f1s1', label: 'Term 1', amount: 2000 }, { id: 'f1s2', label: 'Term 2', amount: 2000 }, { id: 'f1s3', label: 'Term 3', amount: 2000 }] },
        { id: 'f2', label: 'Lab Fee', amount: 500, subItems: [{ id: 'f2s1', label: 'Physics Lab', amount: 200 }, { id: 'f2s2', label: 'Chemistry Lab', amount: 300 }] },
        { id: 'f3', label: 'Library Fee', amount: 200, subItems: [] },
    ]);

    const [feeMonths, setFeeMonths] = useState<FeeMonth[]>([
        { id: 'm1', month: 'June', dueDate: '10 Jun 2026', status: 'PAID', paidDate: '8 Jun 2026' },
        { id: 'm2', month: 'July', dueDate: '10 Jul 2026', status: 'PENDING' },
        { id: 'm3', month: 'August', dueDate: '10 Aug 2026', status: 'PENDING' },
        { id: 'm4', month: 'September', dueDate: '10 Sep 2026', status: 'PENDING' },
    ]);

    const toggleFeeExpand = (id: string) => {
        setExpandedFeeId(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const totalFee = feeItems.reduce((n, f) => {
        const s = f.subItems.reduce((m, s) => m + s.amount, 0);
        return n + (s > 0 ? s : f.amount);
    }, 0);

    return (
        <div className="flex gap-3 flex-1 h-full pt-3 pb-3 px-1 overflow-hidden">

            {/* LEFT — Students List */}
            <div className="w-[25%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-3.5 py-2.5 border-b border-border/40 shrink-0">
                    <p className="text-sm font-bold flex items-center gap-2">
                        <Users size={15} /> Students ({MOCK_STUDENTS.length})
                    </p>
                </div>

                {/* Filters */}
                <div className="px-4 py-2 border-b border-border/40 shrink-0 flex gap-1 bg-background">
                    {([
                        { key: 'all' as const, label: 'All' },
                        { key: 'paid' as const, label: 'Paid' },
                        { key: 'pending' as const, label: 'Pending' },
                    ]).map(f => (
                        <button key={f.key} onClick={() => setStudentFilter(f.key)}
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${studentFilter === f.key
                                ? f.key === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                    : f.key === 'pending' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                        : 'bg-primary text-white'
                                : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto bg-background">
                    {MOCK_STUDENTS
                        .filter(s => studentFilter === 'all' ? true : studentFilter === 'paid' ? s.paid : !s.paid)
                        .map(student => {
                            const isSelected = selectedStudent?.id === student.id;
                            return (
                                <button key={student.id} onClick={() => setSelectedStudent(student)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-all hover:bg-muted/30 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                        style={{ background: getAvatarColor(student.name) }}>
                                        {getInitials(student.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">{student.name}</p>
                                        <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                                    </div>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${student.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                        {student.paid ? 'Paid' : 'Pending'}
                                    </span>
                                </button>
                            );
                        })}
                </div>
            </div>

            {/* RIGHT — Fee Details */}
            <div className="w-[75%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-3 border-b border-border/40 shrink-0">
                    <p className="text-sm font-bold">Fee Details</p>
                </div>
                <div className="flex-1 overflow-y-auto bg-background px-4 py-3">
                    {!selectedStudent ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                <Users size={20} className="text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Click any student to view fee details</p>
                        </div>
                    ) : (
                        <div className="space-y-4">

                            {/* Student Header */}
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                    style={{ background: getAvatarColor(selectedStudent.name) }}>
                                    {getInitials(selectedStudent.name)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold">{selectedStudent.name}</p>
                                    <p className="text-[11px] text-muted-foreground">Roll No. {selectedStudent.rollNo}</p>
                                </div>
                                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${selectedStudent.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                                    {selectedStudent.paid ? '✓ Paid' : '⏳ Pending'}
                                </span>
                            </div>

                            {/* Fee Card */}
                            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                                <div className="px-4 py-3 bg-muted/20 border-b border-border/40">
                                    <p className="text-sm font-bold">{selectedStudent.name}'s Fee Card</p>
                                    <p className="text-[11px] text-muted-foreground">{divisionName}</p>
                                </div>

                                {/* Student Details */}
                                <div className="px-4 py-3 border-b border-border/40">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Student Details</p>
                                    <div className="rounded-xl border border-border/40 overflow-hidden">
                                        {[
                                            { label: 'Name', value: selectedStudent.name },
                                            { label: 'Roll No', value: selectedStudent.rollNo },
                                            { label: 'Division', value: divisionName },
                                        ].map((field, i) => (
                                            <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border/20 last:border-none">
                                                <span className="text-[11px] text-muted-foreground w-24 shrink-0">{field.label}</span>
                                                <span className="text-[11px] font-medium">{field.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Fee Table — view only */}
                                <div className="px-4 py-3 border-b border-border/40">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fee Table</p>
                                    <div className="rounded-xl border border-border/40 overflow-hidden">
                                        <table className="text-xs w-full">
                                            <thead>
                                                <tr className="bg-muted/30 border-b border-border/40">
                                                    {['Month', 'Due Date', 'Paid Date', 'Status', 'Remark'].map((col, i) => (
                                                        <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/20">
                                                {feeMonths.map(m => (
                                                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                                                        <td className="px-3 py-2 text-[11px] font-semibold whitespace-nowrap">{m.month}</td>
                                                        <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.dueDate}</td>
                                                        <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.paidDate ?? '—'}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`flex items-center gap-1 w-fit h-6 px-2.5 rounded-full text-[10px] font-semibold ${STATUS_CFG[m.status].cls}`}>
                                                                {m.status === 'PAID' ? '✓' : '⏳'} {STATUS_CFG[m.status].label}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-[11px] text-muted-foreground">{m.remark ?? '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Fee Structure — view only */}
                            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 bg-muted/20 border-b border-border/40">
                                    <p className="text-sm font-bold">Fee Structure</p>
                                </div>
                                <div className="px-4 py-3 space-y-2">
                                    {feeItems.map(fee => {
                                        const subTotal = fee.subItems.reduce((n, s) => n + s.amount, 0);
                                        const displayAmount = subTotal > 0 ? subTotal : fee.amount;
                                        const isExpanded = expandedFeeId.includes(fee.id);
                                        return (
                                            <div key={fee.id} className="rounded-xl border border-border/40 overflow-hidden">
                                                <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20">
                                                    <div className="flex items-center gap-2">
                                                        {fee.subItems.length > 0 ? (
                                                            <button onClick={() => toggleFeeExpand(fee.id)}
                                                                className="text-muted-foreground hover:text-foreground transition-colors">
                                                                <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                            </button>
                                                        ) : <div className="w-3.5" />}
                                                        <span className="text-sm font-semibold">{fee.label}</span>
                                                    </div>
                                                    <span className="text-sm font-bold">₹{displayAmount.toLocaleString()}</span>
                                                </div>
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                            <div className="px-3 py-2 space-y-1 border-t border-border/30 bg-background">
                                                                {fee.subItems.map(sub => (
                                                                    <div key={sub.id} className="flex items-center justify-between py-1.5 pl-5 border-b border-border/20 last:border-none">
                                                                        <span className="text-xs text-muted-foreground">{sub.label}</span>
                                                                        <span className="text-xs font-semibold">₹{sub.amount.toLocaleString()}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                    <div className="flex items-center justify-between py-2 mt-2 border-t border-border/50">
                                        <span className="text-sm font-bold">Total</span>
                                        <span className="text-base font-black" style={{ color: '#7C3AED' }}>₹{totalFee.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}