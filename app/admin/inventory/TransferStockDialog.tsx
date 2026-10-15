'use client';
import { InventoryIconLabel } from './InventoryIconLabel';
import { qtyPattern, qtyStep, qtyMin, isQty } from './quantity-input';
import { StockQuantityError } from './StockQuantityError';

import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Field, inputCls, ThemedSelect, PrimaryButton, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import type { Item } from './ItemsPanel';
import { stockQuantity, stockToday } from './IssueStockDialog';

export function TransferStockDialog({ item, locations, onClose, onSaved }: { item: Item; locations: { id: string; name: string }[]; onClose: () => void; onSaved: (item: Item) => void }) {
    const [draft, setDraft] = useState(() => ({ requestId: crypto.randomUUID(), fromLocationId: '', toLocationId: '', quantity: '', recordedOn: stockToday(), notes: '' }));
    const [saving, setSaving] = useState(false);
    const source = item.balances.find(b => b.locationId === draft.fromLocationId);
    const destination = item.balances.find(b => b.locationId === draft.toLocationId);
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (saving) return;
        if (!isQty(draft.quantity, (item.type === 'CONSUMABLE')) || Number(draft.quantity) <= 0) { toast.error((item.type === 'CONSUMABLE') ? 'Enter a quantity greater than zero, up to 3 decimal places' : 'Transfer quantity must be a whole number'); return; }
        setSaving(true);
        try {
            const res = await api.post(`/admin/inventory/items/${item.id}/transfer-stock`, draft);
            onSaved(res.data.data); toast.success('Stock transferred'); onClose();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to transfer stock')); }
        finally { setSaving(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-6 "><DialogTitle>Move stock</DialogTitle><DialogDescription>{item.name} - move available stock between school locations.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

        <form onSubmit={save} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

            <fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="From location *"><ThemedSelect value={draft.fromLocationId} options={item.balances.filter(b => Number(b.quantity) > 0).map(b => ({ value: b.locationId, label: <InventoryIconLabel kind="locations" name={b.location.name}>{`${b.location.name} (${stockQuantity(b.quantity)} available)`}</InventoryIconLabel> }))} onChange={fromLocationId => setDraft({ ...draft, fromLocationId, toLocationId: draft.toLocationId === fromLocationId ? '' : draft.toLocationId })} placeholder="Select source" /></Field>
                <Field label="To location *"><ThemedSelect value={draft.toLocationId} options={locations.filter(l => l.id !== draft.fromLocationId).map(l => ({ value: l.id, label: <InventoryIconLabel kind="locations" name={l.name} /> }))} onChange={toLocationId => setDraft({ ...draft, toLocationId })} placeholder="Select destination" /></Field>
            </fieldset>
            {source && <p className="text-xs text-muted-foreground">Source available: <span className="font-semibold text-foreground">{stockQuantity(source.quantity)} {item.unit.abbreviation || item.unit.name}</span></p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Quantity *"><input autoFocus type="number" required min={qtyMin((item.type === 'CONSUMABLE'))} step={qtyStep((item.type === 'CONSUMABLE'))} max={source ? Number(source.quantity) : 1000000000} disabled={saving} className={inputCls} value={draft.quantity} onChange={e => { if (qtyPattern((item.type === 'CONSUMABLE')).test(e.target.value)) setDraft({ ...draft, quantity: e.target.value }); }} /><StockQuantityError decimals={(item.type === 'CONSUMABLE')} value={draft.quantity} max={source ? Number(source.quantity) : undefined} limit={source ? "available" : undefined} /></Field>
                <Field label="Transfer date *"><input type="date" required disabled={saving} className={inputCls} value={draft.recordedOn} onChange={e => setDraft({ ...draft, recordedOn: e.target.value })} /></Field>
            </div>
            {source && draft.toLocationId && Number(draft.quantity) > 0 && Number(draft.quantity) <= Number(source.quantity) && <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1 text-xs" data-admin-surface="">
                <p>{source.location.name}: {stockQuantity(source.quantity)} to {stockQuantity(Number(source.quantity) - Number(draft.quantity))}</p>
                <p>{locations.find(l => l.id === draft.toLocationId)?.name}: {stockQuantity(destination?.quantity || 0)} to {stockQuantity(Number(destination?.quantity || 0) + Number(draft.quantity))}</p>
                <p className="text-muted-foreground">School total stock stays the same.</p>
            </div>}
            <Field label="Notes (optional)"><textarea maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. Stock moved for classroom use" /></Field>
            
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !source || !draft.toLocationId || draft.fromLocationId === draft.toLocationId || !draft.recordedOn || !draft.quantity || Number(draft.quantity) <= 0 || !isQty(draft.quantity, (item.type === 'CONSUMABLE')) || Number(draft.quantity) > Number(source.quantity)}>{saving ? 'Saving...' : 'Move stock'}</PrimaryButton></div>
        </form>
    
</div>
</DialogContent></Dialog>;
}
