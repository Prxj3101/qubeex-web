'use client';
import { LedgerFilePicker, ledgerPayload } from './LedgerAttachments';
import { inventoryDateTime } from './inventory-date-time';
import { StockQuantityError } from './StockQuantityError';

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Field, inputCls, ThemedSelect, PrimaryButton, SecondaryButton, SmallButton, Pill } from '@/app/admin/payroll/_components/ui';
import type { Item } from './ItemsPanel';
import { recipientLabel, stockQuantity, stockToday, stockTime } from './IssueStockDialog';

interface IssueEntry { id: string; quantity: string; returnedQuantity: string; damagedQuantity: string; lostQuantity: string; outstandingQuantity: string; issuedToType: string; issuedToLabel?: string; issuedToName: string; location: { name: string }; occurredAt?: string | null; recordedOn: string; createdAt: string; dueOn: string | null; returnExpected: boolean; notes: string }
interface ReturnDraft { mode: string; issue: IssueEntry; requestId: string; quantity: string; recordedOn: string; recordedTime: string; notes: string }
const dateLabel = (date: string) => new Date(date).toLocaleDateString('en-IN', { timeZone: 'UTC' });

export function IssuedStockDialog({ item, issueId, onClose, onSaved }: { item: Item; issueId?: string; onClose: () => void; onSaved: (item: Item) => void }) {
    const [entries, setEntries] = useState<IssueEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState<ReturnDraft | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [saving, setSaving] = useState(false);
    const post = (url: string, payload: unknown) => api.post(url, ledgerPayload(payload, files), files.length ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
    const load = useCallback((signal?: AbortSignal) => {
        return api.get(`/admin/inventory/items/${item.id}/issues`, { signal })
            .then(res => { if (!signal?.aborted) { setEntries(issueId ? res.data.data.filter((entry: IssueEntry) => entry.id === issueId) : res.data.data); setError(''); } })
            .catch(err => { if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load issued items')); })
            .finally(() => { if (!signal?.aborted) setLoading(false); });
    }, [item.id, issueId]);
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (!draft || saving) return; setSaving(true);
        try {
            const returning = draft.mode === 'RETURN';
            const res = await post(`/admin/inventory/items/${item.id}/${returning ? 'return-stock' : 'resolve-issue'}`, { requestId: draft.requestId, issueId: draft.issue.id, quantity: draft.quantity, recordedOn: draft.recordedOn, recordedTime: draft.recordedTime, ...(returning ? { notes: draft.notes } : { resolutionType: draft.mode, reason: draft.notes }) });
            onSaved(res.data.data); setDraft(null); setFiles([]); toast.success(returning ? 'Stock returned to its original location' : 'Issued item recorded as damaged/lost'); await load();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to record return')); }
        finally { setSaving(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-6 "><DialogTitle>{draft ? draft.mode === 'RETURN' ? 'Return stock' : 'Issued item damaged/lost' : 'Given out items'}</DialogTitle><DialogDescription>{item.name}{draft ? ` - ${draft.issue.issuedToName}` : ' - recipients and pending returns.'}</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

        {draft ? <form onSubmit={save} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

            <p className="text-sm">Issued to: <span className="font-semibold">{draft.issue.issuedToName}</span></p>
            <p className="text-xs text-muted-foreground">Pending: {stockQuantity(draft.issue.outstandingQuantity)} {item.unit.abbreviation || item.unit.name}</p>
            {draft.mode !== 'RETURN' && <fieldset disabled={saving}><Field label="What happened? *"><ThemedSelect value={draft.mode} options={[{value:'DAMAGED',label:'Damaged'},{value:'LOST',label:'Lost'}]} onChange={mode => setDraft({...draft,mode})} /></Field></fieldset>}
            {draft.mode !== 'RETURN' && <p className="text-xs text-muted-foreground">Pending return will decrease. Available stock will stay the same.</p>}
            <Field label={draft.mode === 'RETURN' ? 'Return quantity *' : draft.mode === 'DAMAGED' ? 'Damaged quantity *' : 'Lost quantity *'}><input autoFocus type="number" required min="1" step="1" max={Number(draft.issue.outstandingQuantity)} disabled={saving} className={inputCls} value={draft.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setDraft({ ...draft, quantity: e.target.value }); }} /><StockQuantityError value={draft.quantity} max={Number(draft.issue.outstandingQuantity)} limit="pending" /></Field>
            <Field label={draft.mode === 'RETURN' ? 'Return date *' : 'Record date *'}><input type="date" min={draft.issue.recordedOn.slice(0, 10)} required disabled={saving} className={inputCls} value={draft.recordedOn} onChange={e => setDraft({ ...draft, recordedOn: e.target.value })} /></Field>
            <Field label="Time (IST) *"><input type="time" required disabled={saving} className={inputCls} value={draft.recordedTime} onChange={e => setDraft({ ...draft, recordedTime: e.target.value })} /></Field>
            <LedgerFilePicker files={files} onChange={setFiles} disabled={saving} />
            <Field label={draft.mode === 'RETURN' ? 'Notes (optional)' : 'Reason *'}><textarea required={draft.mode !== 'RETURN'} maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></Field>
            
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => { setDraft(null); setFiles([]); }}>Back</SecondaryButton><PrimaryButton type="submit" disabled={saving || (draft.mode !== 'RETURN' && !draft.notes.trim()) || !draft.quantity || Number(draft.quantity) <= 0 || Number(draft.quantity) > Number(draft.issue.outstandingQuantity) || !draft.recordedOn || !draft.recordedTime}>{saving ? 'Saving...' : draft.mode === 'RETURN' ? 'Record return' : 'Record damaged/lost'}</PrimaryButton></div>
        </form> : loading ? <p role="status" className="text-sm text-muted-foreground">Loading issued items...</p> : error ? <div className="space-y-3"><p role="alert" className="text-sm text-red-500">{error}</p><SecondaryButton onClick={() => { setLoading(true); void load(); }}>Retry</SecondaryButton></div> : entries.length ? <div className="divide-y divide-border/50">{entries.map(entry => {
            const pending = Number(entry.outstandingQuantity) > 0;
            const overdue = pending && entry.dueOn && entry.dueOn.slice(0, 10) < stockToday();
            return <div key={entry.id} className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold break-words">{entry.issuedToName}</p><Pill tone={overdue ? 'red' : pending ? 'amber' : 'green'}>{entry.returnExpected ? overdue ? 'Overdue' : pending ? 'Return pending' : Number(entry.damagedQuantity) + Number(entry.lostQuantity) > 0 ? 'Closed' : 'Returned' : 'Issued for use'}</Pill></div>
                <p className="text-xs text-muted-foreground">{recipientLabel(entry.issuedToType, entry.issuedToLabel)} | {entry.location.name} | {dateLabel(entry.recordedOn)}</p><p className="text-xs text-muted-foreground">Recorded: {inventoryDateTime(entry.createdAt)}</p>
                <p className="text-xs">Issued: {stockQuantity(entry.quantity)} {item.unit.abbreviation || item.unit.name}{entry.returnExpected && ` | Returned: ${stockQuantity(entry.returnedQuantity)} | Pending: ${stockQuantity(entry.outstandingQuantity)}`}</p>
                {Number(entry.damagedQuantity) + Number(entry.lostQuantity) > 0 && <p className="text-xs text-muted-foreground">Damaged: {stockQuantity(entry.damagedQuantity)} | Lost: {stockQuantity(entry.lostQuantity)}</p>}
                {entry.dueOn && <p className="text-xs text-muted-foreground">Return due: {dateLabel(entry.dueOn)}</p>}
                {entry.notes && <p className="text-xs text-muted-foreground break-words">{entry.notes}</p>}
                {entry.returnExpected && pending && <SmallButton onClick={() => setDraft({ mode: 'RETURN', issue: entry, requestId: crypto.randomUUID(), quantity: '', recordedOn: stockToday(), recordedTime: stockTime(), notes: '' })}><RotateCcw size={13} />Return stock</SmallButton>}
                {entry.returnExpected && pending && <SmallButton onClick={() => setDraft({ mode:'DAMAGED', issue:entry, requestId:crypto.randomUUID(), quantity:'', recordedOn:stockToday(), recordedTime:stockTime(), notes:'' })}><TriangleAlert size={13} />Damaged/Lost</SmallButton>}
            </div>;
        })}</div> : <p className="text-sm text-muted-foreground">No stock issued yet.</p>}
    
</div>
</DialogContent></Dialog>;
}
