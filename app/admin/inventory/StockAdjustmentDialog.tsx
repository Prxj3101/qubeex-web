'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Field, inputCls, ThemedSelect, PrimaryButton, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import { stockQuantity, stockToday } from './IssueStockDialog';
import { StockQuantityError } from './StockQuantityError';
import type { Item } from './ItemsPanel';

const types = [{ value: 'COUNT_CORRECTION', label: 'Count correction' }, { value: 'DAMAGED', label: 'Damaged' }, { value: 'LOST', label: 'Lost' }];

export function StockAdjustmentDialog({ item, balance, onClose, onSaved }: { item: Item; balance: Item['balances'][number]; onClose: () => void; onSaved: (item: Item) => void }) {
    const [draft, setDraft] = useState(() => ({ requestId: crypto.randomUUID(), adjustmentType: 'COUNT_CORRECTION', quantity: '', recordedOn: stockToday(), reason: '' }));
    const [saving, setSaving] = useState(false);
    const countCorrection = draft.adjustmentType === 'COUNT_CORRECTION';
    const currentQuantity = Number(balance.quantity);
    const updatedQuantity = countCorrection ? Number(draft.quantity) : currentQuantity - Number(draft.quantity);
    const valid = draft.quantity !== '' && Number.isInteger(Number(draft.quantity)) && Number(draft.quantity) >= (countCorrection ? 0 : 1) && Number(draft.quantity) <= (countCorrection ? 1000000000 : currentQuantity) && updatedQuantity >= 0 && updatedQuantity !== currentQuantity;
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (saving || !valid || !draft.reason.trim()) return; setSaving(true);
        try {
            const res = await api.post(`/admin/inventory/items/${item.id}/adjust-stock`, { ...draft, locationId: balance.locationId, expectedQuantity: String(balance.quantity) });
            onSaved(res.data.data); toast.success('Stock adjusted'); onClose();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to adjust stock')); }
        finally { setSaving(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-md bg-card max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-6 "><DialogTitle>Stock adjustment</DialogTitle><DialogDescription>{item.name} - {balance.location.name}</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

        <form onSubmit={save} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

            <p className="text-sm text-muted-foreground">Current stock: <span className="font-semibold text-foreground">{stockQuantity(balance.quantity)} {item.unit.abbreviation || item.unit.name}</span></p>
            <fieldset disabled={saving}><Field label="Adjustment type *"><ThemedSelect value={draft.adjustmentType} options={types} onChange={adjustmentType => setDraft({ ...draft, adjustmentType, quantity: '' })} /></Field></fieldset>
            <Field label={countCorrection ? 'Actual counted quantity *' : draft.adjustmentType === 'DAMAGED' ? 'Damaged quantity *' : 'Lost quantity *'} hint={countCorrection ? 'Enter the total counted stock at this location.' : `Enter how many available items were ${draft.adjustmentType === 'DAMAGED' ? 'damaged' : 'lost'}.`}>
                <input autoFocus type="number" required min={countCorrection ? 0 : 1} max={countCorrection ? 1000000000 : currentQuantity} step="1" disabled={saving} className={inputCls} value={draft.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setDraft({ ...draft, quantity: e.target.value }); }} />
                <StockQuantityError value={draft.quantity} min={countCorrection ? 0 : 1} max={countCorrection ? 1000000000 : currentQuantity} limit={countCorrection ? undefined : 'available'} unchangedValue={countCorrection ? String(balance.quantity) : undefined} />
            </Field>
            {valid && <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1" data-admin-surface=""><p className="text-sm font-semibold">Updated stock: {stockQuantity(updatedQuantity)} {item.unit.abbreviation || item.unit.name}</p><p className="text-xs text-muted-foreground">{updatedQuantity > currentQuantity ? 'Stock increase' : 'Stock decrease'}: {stockQuantity(Math.abs(updatedQuantity - currentQuantity))}</p></div>}
            <Field label="Adjustment date *"><input type="date" required disabled={saving} className={inputCls} value={draft.recordedOn} onChange={e => setDraft({ ...draft, recordedOn: e.target.value })} /></Field>
            <Field label="Reason *"><textarea required maxLength={500} disabled={saving} className={`${inputCls} h-24 py-2 resize-none`} value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} placeholder={countCorrection ? 'e.g. Extra stock found during counting' : draft.adjustmentType === 'DAMAGED' ? 'e.g. 3 pens are broken and unusable' : 'e.g. 2 pens were lost'} /></Field>
            
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !valid || !draft.reason.trim() || !draft.recordedOn}>{saving ? 'Saving...' : 'Save adjustment'}</PrimaryButton></div>
        </form>
    
</div>
</DialogContent></Dialog>;
}
