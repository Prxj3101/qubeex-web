'use client';
import { InventoryIconLabel } from './InventoryIconLabel';

import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Field, inputCls, ThemedSelect, PrimaryButton, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import { stockToday, stockQuantity } from './IssueStockDialog';
import { qtyPattern, qtyStep, qtyMin, isQty } from './quantity-input';
import { StockQuantityError } from './StockQuantityError';
import type { Item } from './ItemsPanel';

export function SupplierReturnDialog({ item, suppliers, onClose, onSaved }: { item: Item; suppliers: { id: string; name: string }[]; onClose: () => void; onSaved: (item: Item) => void }) {
    const [draft, setDraft] = useState(() => ({ requestId: crypto.randomUUID(), supplierId: '', locationId: '', quantity: '', recordedOn: stockToday(), reason: '' }));
    const [saving, setSaving] = useState(false);
    const balance = item.balances.find(b => b.locationId === draft.locationId);
    const valid = !!balance && draft.quantity !== '' && isQty(draft.quantity, (item.type === 'CONSUMABLE')) && Number(draft.quantity) > 0 && Number(draft.quantity) <= Number(balance.quantity) && Number(draft.quantity) <= 1000000000;
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (saving || !valid || !draft.supplierId || !draft.reason.trim()) return; setSaving(true);
        try {
            const res = await api.post(`/admin/inventory/items/${item.id}/supplier-return`, draft);
            onSaved(res.data.data); toast.success('Return to supplier recorded'); onClose();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to record supplier return')); }
        finally { setSaving(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-6 "><DialogTitle>Return to supplier</DialogTitle><DialogDescription>{item.name} - return items currently counted in available stock to a supplier.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

        <form onSubmit={save} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

            <fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Supplier *"><ThemedSelect value={draft.supplierId} options={suppliers.map(s => ({ value: s.id, label: <InventoryIconLabel kind="suppliers" name={s.name} id={s.id} /> }))} onChange={supplierId => setDraft({ ...draft, supplierId })} placeholder="Select supplier" /></Field>
                <Field label="From location *"><ThemedSelect value={draft.locationId} options={item.balances.filter(b => Number(b.quantity) > 0).map(b => ({ value: b.locationId, label: <InventoryIconLabel kind="locations" name={b.location.name}>{`${b.location.name} (${stockQuantity(b.quantity)} available)`}</InventoryIconLabel> }))} onChange={locationId => setDraft({ ...draft, locationId })} placeholder="Select location" /></Field>
            </fieldset>
            {balance && <p className="text-xs text-muted-foreground">Available: <span className="font-semibold text-foreground">{stockQuantity(balance.quantity)} {item.unit.abbreviation || item.unit.name}</span></p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Return quantity *"><input autoFocus type="number" required min={qtyMin((item.type === 'CONSUMABLE'))} step={qtyStep((item.type === 'CONSUMABLE'))} max={balance ? Number(balance.quantity) : 1000000000} disabled={saving} className={inputCls} value={draft.quantity} onChange={e => { if (qtyPattern((item.type === 'CONSUMABLE')).test(e.target.value)) setDraft({ ...draft, quantity: e.target.value }); }} /><StockQuantityError decimals={(item.type === 'CONSUMABLE')} value={draft.quantity} max={balance ? Number(balance.quantity) : undefined} limit={balance ? 'available' : undefined} /></Field>
                <Field label="Return date *"><input type="date" required disabled={saving} className={inputCls} value={draft.recordedOn} onChange={e => setDraft({ ...draft, recordedOn: e.target.value })} /></Field>
            </div>
            <Field label="Reason *"><textarea required maxLength={500} disabled={saving} className={`${inputCls} h-24 py-2 resize-none`} value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} placeholder="e.g. Pens stopped working and were returned to the supplier" /></Field>
            
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !valid || !draft.supplierId || !draft.recordedOn || !draft.reason.trim()}>{saving ? 'Saving...' : 'Record supplier return'}</PrimaryButton></div>
        </form>
    
</div>
</DialogContent></Dialog>;
}
