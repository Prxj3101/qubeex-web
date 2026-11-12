'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Printer, Ban, Loader2, BookOpenText, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/authStore';
import { classDivOf, type StudentIdCardData } from '@/components/shared/StudentIdCard';
import { PageHeader, SecondaryButton, EmptyState, TERRACOTTA } from '../../payroll/_components/ui';
import { type Mode, type Receipt, MODES, inr, modeOf, prettyDay, shiftDay, timeOf, todayIST } from '../_lib';

type Row = Receipt & { student: StudentIdCardData | null };
interface DayBook { day: string; receipts: Row[]; totals: { amount: number; discount: number; count: number; cancelled: number; byMode: Record<Mode, number> } }

export default function DayBookPage() {
    const router = useRouter();
    const isAdmin = useAuthStore(s => s.user?.role) === 'ADMIN';
    const [day, setDay] = useState(todayIST());
    const [data, setData] = useState<DayBook | null>(null);
    const [reload, setReload] = useState(0);
    const [cancelling, setCancelling] = useState<Row | null>(null);

    useEffect(() => {
        let live = true;
        api.get('/admin/fees/day-book', { params: { date: day } })
            .then(r => { if (live) setData(r.data.data); })
            .catch(err => { if (live) toast.error(getErrorMessage(err, 'Could not load the day book')); });
        return () => { live = false; };
    }, [day, reload]);
    const loading = data?.day !== day;
    const isToday = day === todayIST();
    const max = Math.max(1, ...MODES.map(m => data?.totals.byMode[m.key] ?? 0));

    const exportCsv = () => {
        if (!data) return;
        const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [
            ['Receipt No', 'Time', 'Student', 'Student ID', 'Class', 'Months', 'Mode', 'Reference', 'Discount', 'Amount', 'Received by', 'Status'].map(esc).join(','),
            ...data.receipts.map(r => [
                r.receiptNo, timeOf(r.createdAt), r.student?.name, r.student?.studentId, r.student ? classDivOf(r.student).classDiv : '',
                r.lines.map(l => l.month).join(' + '), modeOf(r.mode).label, r.reference, r.discount, r.amount, r.collectedBy, r.cancelled ? 'Cancelled' : 'Paid',
            ].map(esc).join(',')),
        ];
        const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }));
        const a = document.createElement('a'); a.href = url; a.download = `day-book-${day}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-3">
            <PageHeader title="Day Book" subtitle="Every receipt of the day, and the cash to hand over">
                {!isToday && <button type="button" onClick={() => setDay(todayIST())} className="h-8 px-3 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10">Back to today</button>}
                <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setDay(d => shiftDay(d, -1))} className="w-8 h-8 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted"><ChevronLeft size={15} /></button>
                    <label className="relative h-8 px-3 rounded-xl border border-border bg-card flex items-center gap-2 text-sm font-semibold cursor-pointer">
                        {isToday ? 'Today' : prettyDay(day)}
                        <span className="text-xs text-muted-foreground font-medium">{isToday ? prettyDay(day) : new Date(day).toLocaleDateString('en-IN', { weekday: 'long' })}</span>
                        <input type="date" value={day} max={todayIST()} onChange={e => e.target.value && setDay(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </label>
                    <button type="button" disabled={isToday} onClick={() => setDay(d => shiftDay(d, 1))} className="w-8 h-8 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted disabled:opacity-40"><ChevronRight size={15} /></button>
                </div>
                <SecondaryButton onClick={exportCsv} disabled={!data?.receipts.length}><Download size={14} /> Export</SecondaryButton>
            </PageHeader>

            {/* Totals: grand total + one bar per payment mode */}
            <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
                <div className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ background: TERRACOTTA }}>
                    <div className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-white/10" />
                    <div className="absolute -left-6 -bottom-14 w-32 h-32 rounded-full bg-black/10" />
                    <p className="relative text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">Collected {isToday ? 'today' : 'that day'}</p>
                    <p className="relative text-3xl font-bold tabular-nums mt-0.5" style={{ fontFamily: 'var(--font-poppins)' }}>{inr(data?.totals.amount ?? 0)}</p>
                    <p className="relative text-[11px] text-white/85 mt-1">
                        {data?.totals.count ?? 0} receipts
                        {(data?.totals.discount ?? 0) > 0 && ` · ${inr(data!.totals.discount)} discount`}
                        {(data?.totals.cancelled ?? 0) > 0 && ` · ${data!.totals.cancelled} cancelled`}
                    </p>
                    <p className="relative mt-3 text-[11px] font-semibold bg-white/15 rounded-lg px-2.5 py-1.5 inline-block">
                        Cash in the drawer: {inr(data?.totals.byMode.CASH ?? 0)}
                    </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-4 grid gap-4 grid-cols-2 sm:grid-cols-5" data-admin-surface="">
                    {MODES.map(m => {
                        const v = data?.totals.byMode[m.key] ?? 0;
                        const Icon = m.icon;
                        return (
                            <div key={m.key} className="flex flex-col justify-between gap-2 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${m.color}15`, color: m.color }}><Icon size={12} /></span>
                                    <span className="text-[11px] font-semibold text-muted-foreground">{m.label}</span>
                                </div>
                                <p className="text-base font-bold tabular-nums truncate">{inr(v)}</p>
                                <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                                    <motion.div className="h-full rounded-full" style={{ background: m.color }}
                                        initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }} transition={{ duration: 0.6 }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Receipts */}
            {loading ? (
                <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-14 rounded-2xl bg-muted/40 animate-pulse" />)}</div>
            ) : !data?.receipts.length ? (
                <EmptyState icon={BookOpenText} title={isToday ? 'No receipts yet today' : 'No receipts that day'} text="Fees collected at the counter show up here with the time, mode and who took them." />
            ) : (
                <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" data-admin-surface="">
                    {data.receipts.map((r, i) => {
                        const m = modeOf(r.mode);
                        const Icon = m.icon;
                        const st = r.student;
                        return (
                            <motion.div key={r.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.02 }}
                                className={`group flex items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-border/40' : ''} hover:bg-muted/30`}>
                                <div className="w-14 shrink-0">
                                    <p className="text-[11px] font-bold tabular-nums">{timeOf(r.createdAt)}</p>
                                    <p className="text-[10px] font-mono text-muted-foreground">#{r.number}</p>
                                </div>
                                <button type="button" onClick={() => st && router.push(`/admin/fees/collect?student=${st.id}`)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-primary/15 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                                        {st?.avatarUrl
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={st.avatarUrl} alt="" className="w-full h-full object-cover" />
                                            : (st?.name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-semibold truncate ${r.cancelled ? 'line-through text-muted-foreground' : ''}`}>{st?.name ?? 'Student'}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {st ? `${classDivOf(st).classDiv} · ` : ''}{r.lines.map(l => l.month).join(', ')}
                                            {r.cancelled && r.cancelReason ? ` · Cancelled: ${r.cancelReason}` : ''}
                                        </p>
                                    </div>
                                </button>
                                {r.cancelled && (
                                    // Rubber stamp, like on the paper receipts.
                                    <span className="shrink-0 px-2 pt-[3px] pb-[2px] rounded-[4px] text-center leading-none select-none"
                                        style={{ color: '#D93025', border: '2px solid #D93025', boxShadow: 'inset 0 0 0 1px var(--card), inset 0 0 0 2.5px #D93025', transform: 'rotate(-8deg)', opacity: 0.85 }}>
                                        <span className="block text-[10.5px] font-extrabold tracking-[0.14em]">CANCELLED</span>
                                        <span className="block text-[7.5px] font-bold tracking-[0.12em] mt-[2px]">PAID {inr(r.amount)}</span>
                                    </span>
                                )}
                                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 bg-muted text-foreground">
                                    <Icon size={11} style={{ color: m.color }} /> {m.label}{r.reference ? ` · ${r.reference}` : ''}
                                </span>
                                <span className="hidden md:block text-[11px] text-muted-foreground w-28 truncate text-right shrink-0">{r.collectedBy ?? ''}</span>
                                <div className="text-right w-24 shrink-0">
                                    <p className={`text-sm font-bold tabular-nums ${r.cancelled ? 'line-through text-muted-foreground' : ''}`}>{inr(r.amount)}</p>
                                    {r.discount > 0 && <p className="text-[10px] text-muted-foreground">+{inr(r.discount)} off</p>}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <button type="button" title="Print" onClick={() => window.open(`/print/fee-receipt/${r.id}`, '_blank', 'noopener')}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"><Printer size={13} /></button>
                                    {isAdmin && !r.cancelled && (
                                        <button type="button" title="Cancel receipt" onClick={() => setCancelling(r)}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-600"><Ban size={13} /></button>
                                    )}
                                    {isAdmin && r.cancelled && <span className="w-7 h-7" />}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <AnimatePresence>
                {cancelling && <CancelDialog receipt={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); setReload(n => n + 1); }} />}
            </AnimatePresence>
        </div>
    );
}

function CancelDialog({ receipt, onClose, onDone }: { receipt: Row; onClose: () => void; onDone: () => void }) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const go = async () => {
        setBusy(true);
        try {
            await api.post(`/admin/fees/receipts/${receipt.id}/cancel`, { reason: reason.trim() });
            toast.success(`Receipt #${receipt.receiptNo} cancelled`);
            onDone();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not cancel the receipt'));
            setBusy(false);
        }
    };
    return (
        <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-xl p-5" initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }} onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-base font-bold">Cancel receipt #{receipt.receiptNo}?</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {inr(receipt.amount)} from {receipt.student?.name ?? 'this student'}. The months it paid ({receipt.lines.map(l => l.month).join(', ')}) will show as due again.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0"><X size={14} /></button>
                </div>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} autoFocus placeholder="Reason (e.g. wrong student, cheque bounced)"
                    className="mt-3 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:border-foreground/30" />
                <div className="mt-3 flex justify-end gap-2">
                    <SecondaryButton onClick={onClose}>Keep it</SecondaryButton>
                    <button type="button" disabled={busy || reason.trim().length < 3} onClick={go}
                        className="inline-flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />} Cancel receipt
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
