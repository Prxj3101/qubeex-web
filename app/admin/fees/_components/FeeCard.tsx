'use client';

import { Check, ImagePlus } from 'lucide-react';
import { classDivOf } from '@/components/shared/StudentIdCard';
import { type Account, billState, inr, themeOf } from '../_lib';

const INK = '#000000';
const TERRACOTTA = 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)';

/**
 * The student's fee card, drawn like the class fee card (same theme, logo and
 * student details), with what is paid and still due per month. Months that
 * still have money due can be ticked to collect.
 */
export function FeeCard({ account, selected, onToggle, canSelect }: {
    account: Account;
    selected: Set<string>;
    onToggle: (feeMonthId: string) => void;
    canSelect: boolean;
}) {
    const { student, card, bills, totals } = account;
    const fc = themeOf(card?.feeCardTheme);
    const { classNum, divLetter } = classDivOf(student);
    const fields = student.extraDetailFields ?? {};
    const studentFields = card?.studentFields?.length ? card.studentFields : [
        { id: 'f-name', kind: 'default' as const, defaultKey: 'name' as const, label: 'Name' },
        { id: 'f-roll', kind: 'default' as const, defaultKey: 'rollNo' as const, label: 'Roll No' },
        { id: 'f-id', kind: 'default' as const, defaultKey: 'studentId' as const, label: 'Student ID' },
        { id: 'f-class', kind: 'default' as const, defaultKey: 'class' as const, label: 'Class' },
    ];
    const valueOf = (f: (typeof studentFields)[number]) => {
        if (f.kind === 'custom') return fields[f.id] || '—';
        switch (f.defaultKey) {
            case 'name': return student.name || '—';
            case 'rollNo': return student.rollNo || '—';
            case 'studentId': return student.studentId;
            case 'class': return classNum || '—';
            case 'division': return divLetter || '—';
            default: return '—';
        }
    };
    const openIds = bills.filter(b => b.balance > 0).map(b => b.feeMonthId);
    const allPicked = openIds.length > 0 && openIds.every(id => selected.has(id));

    return (
        <div className="rounded-2xl border overflow-hidden" style={{ background: fc.bg, borderColor: fc.border, color: INK }}>
            {/* School header */}
            <div className="px-4 py-2.5 flex items-center gap-3" style={{ borderBottom: `1px solid ${fc.border}` }}>
                {card?.schoolLogoUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={card.schoolLogoUrl} alt="" className="w-14 h-14 rounded-lg object-contain shrink-0" />
                    : <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0 bg-white" style={{ border: `1px dashed ${fc.border}` }}><ImagePlus size={22} style={{ opacity: 0.3 }} /></div>}
                <p className="text-2xl font-bold leading-tight truncate flex-1 min-w-0">{card?.schoolName || student.institutionName || 'School'}</p>
            </div>
            <div className="px-4 py-2 border-b flex items-center justify-between gap-2" style={{ borderColor: fc.border }}>
                <p className="text-sm font-bold tracking-wide truncate">{student.name}&apos;s Fee Card</p>
                {totals.balance <= 0 && bills.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">All fees paid</span>
                )}
            </div>

            <div className="space-y-3 px-4 py-3">
                {/* Student details */}
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5">Student Details</p>
                    <div className="rounded-xl border p-2 grid grid-cols-2 gap-1.5" style={{ borderColor: fc.border }}>
                        {studentFields.map(f => {
                            if (f.kind === 'default' && f.defaultKey === 'bus') {
                                const on = fields[`${f.id}-enabled`] === 'true';
                                return (
                                    <div key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg" style={{ border: `1px solid ${fc.border}` }}>
                                        <span className="text-[11px] flex items-center gap-1">{f.label}
                                            <span className={`text-[9px] font-semibold px-1 rounded-full ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-black/5 text-black/40'}`}>{on ? 'On' : 'Off'}</span>
                                        </span>
                                        <span className="text-[11px] font-semibold truncate">{on ? `${fields[`${f.id}-number`] || '—'} · ₹${fields[`${f.id}-fee`] || 0}` : '—'}</span>
                                    </div>
                                );
                            }
                            const isId = f.kind === 'default' && f.defaultKey === 'studentId';
                            return (
                                <div key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg min-w-0" style={{ border: `1px solid ${fc.border}` }}>
                                    <span className="text-[11px] shrink-0">{f.label}</span>
                                    <span className={`text-[11px] font-semibold truncate ${isId ? 'font-mono' : ''}`} style={{ color: isId ? '#DA7756' : INK }}>{valueOf(f)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ borderTop: `1px dashed ${fc.border}` }} />

                {/* Monthly schedule */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider">Monthly Payment Schedule</p>
                        {canSelect && openIds.length > 0 && (
                            <button type="button" className="text-[10px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100"
                                onClick={() => (allPicked ? openIds : openIds.filter(id => !selected.has(id))).forEach(onToggle)}>
                                {allPicked ? 'Clear selection' : 'Select all due'}
                            </button>
                        )}
                    </div>
                    {bills.length === 0 ? (
                        <div className="py-8 text-center rounded-xl border border-dashed text-xs opacity-60" style={{ borderColor: fc.border }}>
                            No fee card for this class yet. Set it up in Campus, class Fees tab.
                        </div>
                    ) : (
                        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: fc.border, scrollbarWidth: 'thin' }}>
                            <table className="text-xs w-full min-w-[620px]">
                                <thead>
                                    <tr style={{ background: fc.bg, borderBottom: `1px solid ${fc.border}` }}>
                                        {['', 'Month', 'Fee Structures', 'Amount', 'Due Date', 'Paid', 'Balance', 'Status'].map((c, i) => (
                                            <th key={i} className={`px-2.5 py-2 text-left text-[11px] font-bold whitespace-nowrap ${i === 0 ? 'w-8' : ''}`} style={{ borderRight: i < 7 ? `1px solid ${fc.border}` : 'none' }}>{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {bills.map((b, i) => {
                                        const open = b.balance > 0;
                                        const on = selected.has(b.feeMonthId);
                                        const st = billState(b);
                                        const pickable = canSelect && open;
                                        return (
                                            <tr key={b.feeMonthId}
                                                onClick={() => pickable && onToggle(b.feeMonthId)}
                                                className={`transition-colors ${pickable ? 'cursor-pointer hover:brightness-[0.97]' : ''}`}
                                                style={{ background: on ? `${fc.border}99` : i % 2 ? fc.bg : 'rgba(255,255,255,0.45)', borderTop: `1px solid ${fc.border}` }}>
                                                <td className="px-2.5 py-2" style={{ borderRight: `1px solid ${fc.border}` }}>
                                                    {open ? (
                                                        <span className="w-4 h-4 rounded-[5px] border flex items-center justify-center transition-all"
                                                            style={on ? { background: TERRACOTTA, borderColor: '#C06040' } : { borderColor: `${INK}40`, background: '#fff', opacity: canSelect ? 1 : 0.4 }}>
                                                            {on && <Check size={11} className="text-white" strokeWidth={3} />}
                                                        </span>
                                                    ) : <Check size={13} className="text-emerald-600" strokeWidth={3} />}
                                                </td>
                                                <td className="px-2.5 py-2 font-semibold whitespace-nowrap" style={{ borderRight: `1px solid ${fc.border}` }}>{b.month}</td>
                                                <td className="px-2.5 py-2" style={{ borderRight: `1px solid ${fc.border}` }}>
                                                    <div className="flex flex-wrap gap-0.5">
                                                        {b.parts.length === 0 && <span className="opacity-40">—</span>}
                                                        {b.parts.map((p, pi) => (
                                                            <span key={pi} title={p.auto === 'late' ? 'Auto-applied: overdue' : p.auto === 'bus' ? 'Auto-applied: bus service' : p.extra ? 'Added just for this student' : `₹${p.amount}`}
                                                                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${p.extra ? 'border border-dashed' : ''}`}
                                                                style={{ background: p.color + '20', color: p.color, borderColor: p.color + '60' }}>
                                                                {p.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-2.5 py-2 font-bold whitespace-nowrap" style={{ borderRight: `1px solid ${fc.border}` }}>{b.total > 0 ? inr(b.total) : '—'}</td>
                                                <td className="px-2.5 py-2 text-[11px] whitespace-nowrap" style={{ borderRight: `1px solid ${fc.border}`, color: b.due && open ? '#DC2626' : INK, fontWeight: b.due && open ? 600 : 500 }}>{b.dueDate || '—'}</td>
                                                <td className="px-2.5 py-2 text-[11px] whitespace-nowrap" style={{ borderRight: `1px solid ${fc.border}` }}>
                                                    {b.balance <= 0 ? (b.paidDate || 'Paid') : b.received > 0 ? inr(b.received) : '—'}
                                                </td>
                                                <td className="px-2.5 py-2 font-bold whitespace-nowrap" style={{ borderRight: `1px solid ${fc.border}`, color: open ? (b.due ? '#DC2626' : INK) : '#059669' }}>{open ? inr(b.balance) : '₹0'}</td>
                                                <td className="px-2.5 py-2">
                                                    <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr style={{ background: fc.bg, borderTop: `2px solid ${fc.border}` }}>
                                        <td />
                                        <td className="px-2.5 py-2 font-bold text-[11px]" colSpan={2}>Annual Total</td>
                                        <td className="px-2.5 py-2 font-black text-[11px]">{inr(totals.total)}</td>
                                        <td />
                                        <td className="px-2.5 py-2 font-bold text-[11px] text-emerald-700">{inr(totals.paid)}</td>
                                        <td className="px-2.5 py-2 font-black text-[11px]" style={{ color: totals.balance > 0 ? '#DC2626' : '#059669' }}>{inr(totals.balance)}</td>
                                        <td />
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
