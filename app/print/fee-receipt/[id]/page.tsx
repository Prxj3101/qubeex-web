'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer, Scissors } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/authStore';
import { classDivOf, type StudentIdCardData } from '@/components/shared/StudentIdCard';
import { type Receipt, modeOf, prettyDay, themeOf } from '@/app/admin/fees/_lib';

// Printable fee receipt: one A4 sheet with two A5 copies (school + parent),
// a cut line between them.

interface PrintData { receipt: Receipt; student: StudentIdCardData; school: { name: string; logoUrl: string | null; theme: string | null } }

const money = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Rupees in words, Indian style (lakh, crore).
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function twoDigits(n: number) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`; }
function threeDigits(n: number) { return `${n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : ''}${n % 100 ? twoDigits(n % 100) : ''}`; }
function inWords(amount: number) {
    let n = Math.floor(amount);
    const paise = Math.round((amount - n) * 100);
    if (n === 0 && !paise) return 'Zero Rupees Only';
    const parts: string[] = [];
    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thousand = Math.floor(n / 1e3); n %= 1e3;
    if (crore) parts.push(`${threeDigits(crore)} Crore`);
    if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
    if (n) parts.push(threeDigits(n));
    return `${parts.join(' ') || 'Zero'} Rupees${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`;
}

export default function PrintFeeReceipt() {
    const { id } = useParams<{ id: string }>();
    const [d, setD] = useState<PrintData | null>(null);
    const [error, setError] = useState('');
    // Students / parents open their own receipts from their fee page.
    const role = useAuthStore(st => st.user?.role);

    useEffect(() => {
        if (!role) return;
        const url = role === 'STUDENT' ? `/student/fees/receipts/${encodeURIComponent(id)}` : `/admin/fees/receipts/${encodeURIComponent(id)}`;
        api.get(url).then(res => setD(res.data.data)).catch(err => setError(getErrorMessage(err, 'Could not open the receipt')));
    }, [id, role]);

    if (error) return <p className="p-10 text-center text-sm text-red-600">{error}</p>;
    if (!d) return <p className="p-10 text-center text-sm text-slate-500">Preparing the receipt...</p>;

    return (
        <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900" style={{ colorScheme: 'light', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
            <style>{`@page { size: A4; margin: 0; } @media print { .no-print { display: none !important; } .sheet { box-shadow: none !important; margin: 0 !important; } }`}</style>
            <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
                <p className="text-sm font-semibold">Receipt #{d.receipt.receiptNo}</p>
                <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#DA7756] px-5 text-sm font-semibold text-white hover:opacity-95"><Printer size={15} />Print</button>
            </div>
            <div className="sheet mx-auto my-6 bg-white shadow-lg" style={{ width: '210mm', height: '297mm' }}>
                <Copy d={d} label="School Copy" />
                <div className="relative h-0 border-t border-dashed border-slate-400 mx-[8mm]">
                    <Scissors size={14} className="absolute -left-1 -top-[8px] text-slate-400 bg-white" />
                </div>
                <Copy d={d} label="Parent Copy" />
            </div>
        </div>
    );
}

function Copy({ d, label }: { d: PrintData; label: string }) {
    const { receipt: r, student: s, school } = d;
    const accent = themeOf(school.theme);
    const lines = r.lines;
    return (
        <div className="relative px-[12mm] py-[9mm] flex flex-col overflow-hidden" style={{ height: '148.5mm' }}>
            {r.cancelled && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[64px] font-black tracking-[0.2em] text-red-600/15 -rotate-12 border-8 border-red-600/15 px-6 rounded-xl">CANCELLED</span>
                </div>
            )}
            {/* Header */}
            <div className="flex items-center gap-3 pb-2.5 border-b-2" style={{ borderColor: accent.border }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {school.logoUrl && <img src={school.logoUrl} alt="" className="w-14 h-14 object-contain" />}
                <div className="flex-1 min-w-0">
                    <p className="text-[19px] font-bold leading-tight">{school.name}</p>
                    <p className="text-[11px] font-semibold tracking-[0.25em] text-slate-500 mt-0.5">FEE RECEIPT</p>
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block" style={{ background: accent.bg, border: `1px solid ${accent.border}` }}>{label}</p>
                    <p className="text-[12px] font-bold mt-1">No. {r.receiptNo}</p>
                    <p className="text-[11px] text-slate-600">{prettyDay(r.day)}</p>
                </div>
            </div>

            {/* Student */}
            <div className="grid grid-cols-4 gap-x-4 gap-y-1 py-2.5 text-[11px]">
                <Field label="Student" value={s.name ?? ''} wide />
                <Field label="Class" value={classDivOf(s).classDiv} />
                <Field label="Roll No" value={s.rollNo || '-'} />
                <Field label="Student ID" value={s.studentId} mono />
                <Field label="Paid by" value={`${modeOf(r.mode).label}${r.reference ? ` (${r.reference})` : ''}`} wide />
                <Field label="Admission Year" value={s.admissionYear || '-'} />
            </div>

            {/* Lines */}
            <table className="w-full text-[11px] border" style={{ borderColor: accent.border }}>
                <thead>
                    <tr style={{ background: accent.bg }}>
                        <th className="text-left px-2 py-1.5 w-8">#</th>
                        <th className="text-left px-2 py-1.5">Month</th>
                        <th className="text-left px-2 py-1.5">Fee heads</th>
                        <th className="text-right px-2 py-1.5">Discount</th>
                        <th className="text-right px-2 py-1.5">Paid</th>
                    </tr>
                </thead>
                <tbody>
                    {lines.map((l, i) => (
                        <tr key={l.feeMonthId} className="border-t" style={{ borderColor: accent.border }}>
                            <td className="px-2 py-1.5">{i + 1}</td>
                            <td className="px-2 py-1.5 font-semibold">{l.month}{!l.markedPaid && <span className="ml-1 text-[9px] font-semibold text-amber-700">(part)</span>}</td>
                            <td className="px-2 py-1.5 text-slate-600">{l.heads.join(', ') || '-'}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{l.discount ? money(l.discount) : '-'}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{money(l.amount)}</td>
                        </tr>
                    ))}
                    <tr className="border-t-2" style={{ borderColor: accent.border, background: accent.bg }}>
                        <td colSpan={3} className="px-2 py-1.5 font-bold">Total received</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.discount ? money(r.discount) : '-'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-bold text-[13px]">{money(r.amount)}</td>
                    </tr>
                </tbody>
            </table>
            <p className="text-[11px] mt-1.5"><span className="text-slate-500">In words: </span><span className="font-semibold">{inWords(r.amount)}</span></p>
            {r.note && <p className="text-[11px] mt-0.5"><span className="text-slate-500">Note: </span>{r.note}</p>}
            {r.cancelled && <p className="text-[11px] mt-0.5 font-semibold text-red-600">Cancelled{r.cancelReason ? `: ${r.cancelReason}` : ''}</p>}

            {/* Footer */}
            <div className="mt-auto flex items-end justify-between gap-4 text-[10px] text-slate-500">
                <p>Computer generated receipt. Please keep it safe.</p>
                <div className="text-center min-w-[45mm]">
                    <p className="text-[11px] font-semibold text-slate-700 h-4">{r.collectedBy ?? ''}</p>
                    <div className="border-t border-slate-400 mt-1 pt-0.5">Received by</div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, value, wide, mono }: { label: string; value: string; wide?: boolean; mono?: boolean }) {
    return (
        <div className={wide ? 'col-span-2' : ''}>
            <p className="text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`font-semibold truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
        </div>
    );
}
