'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Field, inputCls, ThemedSelect, PrimaryButton, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import { stockToday, stockQuantity } from './IssueStockDialog';
import { StockQuantityError } from './StockQuantityError';
import type { Item } from './ItemsPanel';

export function SupplierReturnDialog({ item, suppliers, onClose, onSaved }: { item: Item; suppliers: { id: string; name: string }[]; onClose: () => void; onSaved: (item: Item) => void }) {
    const [draft, setDraft] = useState(() => ({ requestId: crypto.randomUUID(), supplierId: '', locationId: '', quantity: '', recordedOn: stockToday(), reason: '' }));
    const [saving, setSaving] = useState(false);
    const balance = item.balances.find(b => b.locationId === draft.locationId);
    const valid = !!balance && draft.quantity !== '' && Number.isInteger(Number(draft.quantity)) && Number(draft.quantity) >= 1 && Number(draft.quantity) <= Number(balance.quantity) && Number(draft.quantity) <= 1000000000;
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (saving || !valid || !draft.supplierId || !draft.reason.trim()) return; setSaving(true);
        try {
            const res = await api.post(`/admin/inventory/items/${item.id}/supplier-return`, draft);
            onSaved(res.data.data); toast.success('Supplier return recorded'); onClose();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to record supplier return')); }
        finally { setSaving(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Supplier return</DialogTitle><DialogDescription>{item.name} - return items currently counted in available stock to a supplier.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-4">
            <fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Supplier *"><ThemedSelect value={draft.supplierId} options={suppliers.map(s => ({ value: s.id, label: s.name }))} onChange={supplierId => setDraft({ ...draft, supplierId })} placeholder="Select supplier" /></Field>
                <Field label="From location *"><ThemedSelect value={draft.locationId} options={item.balances.filter(b => Number(b.quantity) > 0).map(b => ({ value: b.locationId, label: `${b.location.name} (${stockQuantity(b.quantity)} available)` }))} onChange={locationId => setDraft({ ...draft, locationId })} placeholder="Select location" /></Field>
            </fieldset>
            {balance && <p className="text-xs text-muted-foreground">Available: <span className="font-semibold text-foreground">{stockQuantity(balance.quantity)} {item.unit.abbreviation || item.unit.name}</span></p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Return quantity *"><input autoFocus type="number" required min="1" step="1" max={balance ? Number(balance.quantity) : 1000000000} disabled={saving} className={inputCls} value={draft.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setDraft({ ...draft, quantity: e.target.value }); }} /><StockQuantityError value={draft.quantity} max={balance ? Number(balance.quantity) : undefined} limit={balance ? 'available' : undefined} /></Field>
                <Field label="Return date *"><input type="date" required disabled={saving} className={inputCls} value={draft.recordedOn} onChange={e => setDraft({ ...draft, recordedOn: e.target.value })} /></Field>
            </div>
            <Field label="Reason *"><textarea required maxLength={500} disabled={saving} className={`${inputCls} h-24 py-2 resize-none`} value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} placeholder="e.g. Pens stopped working and were returned to the supplier" /></Field>
            <div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !valid || !draft.supplierId || !draft.recordedOn || !draft.reason.trim()}>{saving ? 'Saving...' : 'Record supplier return'}</PrimaryButton></div>
        </form>
    </DialogContent></Dialog>;
}
