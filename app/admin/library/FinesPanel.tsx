'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, HandCoins, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, Field, Pill, PrimaryButton, SmallButton, inputCls } from '@/app/admin/payroll/_components/ui';
import { dateLabel, rupees, type Fine } from './types';

interface FineItem extends Fine { createdAt: string; member: { name: string; code: string | null } }
type Status = 'PENDING' | 'PAID' | 'WAIVED';
const PAGE_SIZE = 20;
const TONE: Record<Status, 'amber' | 'green' | 'muted'> = { PENDING: 'amber', PAID: 'green', WAIVED: 'muted' };

export default function FinesPanel() {
    const [status, setStatus] = useState<Status>('PENDING');
    const [items, setItems] = useState<FineItem[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [waiving, setWaiving] = useState<FineItem | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const [tick, setTick] = useState(0);
    const load = useCallback(() => setTick((t) => t + 1), []);
    useEffect(() => {
        let live = true;
        api.get('/admin/library/fines', { params: { status, page, pageSize: PAGE_SIZE } })
            .then((res) => { if (live) { setItems(res.data.data.items as FineItem[]); setTotal(res.data.data.total as number); } })
            .catch((err) => { if (live) toast.error(getErrorMessage(err, 'Could not load fines')); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [status, page, tick]);

    const collect = async (f: FineItem) => {
        setBusy(true);
        try {
            await api.post(`/admin/library/fines/${f.id}/collect`);
            toast.success(`Marked ${rupees(f.amountPaise)} as paid`);
            await load();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not mark as paid')); } finally { setBusy(false); }
    };

    const waive = async () => {
        if (!waiving) return;
        if (!reason.trim()) { toast.error('Give a reason for waiving this fine'); return; }
        setBusy(true);
        try {
            await api.post(`/admin/library/fines/${waiving.id}/waive`, { reason: reason.trim() });
            toast.success('Fine waived');
            setWaiving(null);
            setReason('');
            await load();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not waive the fine')); } finally { setBusy(false); }
    };

    return (
        <div className="space-y-3 pb-10">
            <div className="flex gap-1.5">
                {(['PENDING', 'PAID', 'WAIVED'] as Status[]).map((s) => (
                    <button key={s} type="button" onClick={() => { setStatus(s); setPage(1); }} aria-pressed={status === s}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${status === s ? 'bg-primary text-white border-primary' : 'border-border bg-card hover:bg-muted/50'}`}>{s.charAt(0) + s.slice(1).toLowerCase()}</button>
                ))}
            </div>

            {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
                : items.length === 0 ? <EmptyState icon={HandCoins} title={`No ${status.toLowerCase()} fines`} text="Fines appear here when a book is returned late, lost or damaged, if fines are turned on in Settings." />
                : (
                    <ul className="rounded-2xl border border-border bg-card divide-y divide-border/60">
                        {items.map((f) => (
                            <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold truncate">{f.member.name}{f.member.code ? ` · ${f.member.code}` : ''}</p>
                                    <p className="text-xs text-muted-foreground truncate">{f.kind.toLowerCase()} · {f.loan?.copy.book.title ?? 'Book'} · {dateLabel(f.createdAt)}</p>
                                </div>
                                <Pill tone={f.collectedVia === 'FEES' ? 'blue' : 'muted'}>{f.collectedVia === 'FEES' ? 'Added to fees' : 'Pay at library'}</Pill>
                                <span className="text-sm font-semibold">{rupees(f.amountPaise)}</span>
                                <Pill tone={TONE[(f.status ?? 'PENDING') as Status]}>{(f.status ?? 'PENDING').toLowerCase()}</Pill>
                                {f.status === 'PENDING' && <>
                                    <SmallButton type="button" disabled={busy} onClick={() => void collect(f)}><Check size={12} /> Mark paid</SmallButton>
                                    <SmallButton type="button" disabled={busy} onClick={() => { setWaiving(f); setReason(''); }}>Waive</SmallButton>
                                </>}
                            </li>
                        ))}
                    </ul>
                )}

            {Math.ceil(total / PAGE_SIZE) > 1 && (
                <div className="flex items-center justify-center gap-3 text-xs">
                    <SmallButton type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={12} /> Prev</SmallButton>
                    <span>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
                    <SmallButton type="button" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight size={12} /></SmallButton>
                </div>
            )}

            <Dialog open={!!waiving} onOpenChange={(open) => { if (!open && !busy) setWaiving(null); }}>
                <DialogContent className="sm:max-w-sm bg-card">
                    <DialogHeader>
                        <DialogTitle>Waive fine</DialogTitle>
                        <DialogDescription>{waiving ? `${waiving.member.name} will not have to pay ${rupees(waiving.amountPaise)}. This is recorded in the audit log.` : ''}</DialogDescription>
                    </DialogHeader>
                    <Field label="Reason"><input className={inputCls} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                    <PrimaryButton onClick={() => void waive()} disabled={busy} className="h-9 px-5 w-fit">{busy && <Loader2 size={14} className="animate-spin" />}Waive fine</PrimaryButton>
                </DialogContent>
            </Dialog>
        </div>
    );
}
