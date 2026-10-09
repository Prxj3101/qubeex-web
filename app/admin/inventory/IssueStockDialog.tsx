'use client';
import { StockQuantityError } from './StockQuantityError';

import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Field, inputCls, ThemedSelect, PrimaryButton, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import type { Item } from './ItemsPanel';

export const stockToday = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const recipientOptions = [{"value":"PRINCIPAL","label":"Principal"},{"value":"VICE_PRINCIPAL","label":"Vice Principal"},{"value":"HEAD_MASTER","label":"Head Master"},{"value":"HEAD_MISTRESS","label":"Head Mistress"},{"value":"DIRECTOR","label":"Director"},{"value":"ADMINISTRATOR","label":"Administrator"},{"value":"COORDINATOR","label":"Coordinator"},{"value":"DEAN","label":"Dean"},{"value":"RECTOR","label":"Rector"},{"value":"SUPERINTENDENT","label":"Superintendent"},{"value":"CHAIRMAN","label":"Chairman"},{"value":"SECRETARY","label":"Secretary"},{"value":"TRUSTEE","label":"Trustee"},{"value":"TEACHER","label":"Teacher"},{"value":"STUDENT","label":"Student"},{"value":"LIBRARIAN","label":"Librarian"},{"value":"ACCOUNTANT","label":"Accountant"},{"value":"CLERK","label":"Clerk"},{"value":"RECEPTIONIST","label":"Receptionist"},{"value":"LAB_ASSISTANT","label":"Lab Assistant"},{"value":"SPORTS_COACH","label":"Sports Coach"},{"value":"IT_STAFF","label":"IT Staff"},{"value":"PEON","label":"Peon"},{"value":"DRIVER","label":"Driver"},{"value":"SECURITY_GUARD","label":"Security Guard"},{"value":"HOUSEKEEPING","label":"Housekeeping"},{"value":"CLASSROOM","label":"Classroom"},{"value":"DEPARTMENT","label":"Department"},{"value":"CUSTOM","label":"Custom"}];
export const recipientLabel = (type: string | undefined, custom?: string) => type === 'CUSTOM' ? custom || 'Custom' : recipientOptions.find(o => o.value === type)?.label || type || 'Recipient';
export const stockQuantity = (value: string | number) => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export function IssueStockDialog({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: (item: Item) => void }) {
    const [draft, setDraft] = useState(() => ({ requestId: crypto.randomUUID(), locationId: '', quantity: '', issuedToType: '', issuedToLabel: '', issuedToName: '', recordedOn: stockToday(), dueOn: '', notes: '' }));
    const [saving, setSaving] = useState(false);
    const balance = item.balances.find(b => b.locationId === draft.locationId);
    const returnable = item.type !== 'CONSUMABLE';
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (saving) return;
        setSaving(true);
        try {
            const res = await api.post(`/admin/inventory/items/${item.id}/issue-stock`, { ...draft, dueOn: returnable && draft.dueOn ? draft.dueOn : null });
            onSaved(res.data.data); toast.success('Stock issued'); onClose();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to issue stock')); }
        finally { setSaving(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Issue stock</DialogTitle><DialogDescription>{item.name} - record who receives this item and reduce available stock.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-4">
            <fieldset disabled={saving}><Field label="From location *"><ThemedSelect value={draft.locationId} onChange={locationId => setDraft({ ...draft, locationId })} options={item.balances.filter(b => Number(b.quantity) > 0).map(b => ({ value: b.locationId, label: `${b.location.name} (${stockQuantity(b.quantity)} available)` }))} placeholder="Select location" /></Field></fieldset>
            {balance && <p className="text-xs text-muted-foreground">Available: <span className="font-semibold text-foreground">{stockQuantity(balance.quantity)} {item.unit.abbreviation || item.unit.name}</span></p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Quantity *"><input autoFocus type="number" required min="1" step="1" max={balance ? Number(balance.quantity) : 1000000000} disabled={saving} className={inputCls} value={draft.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setDraft({ ...draft, quantity: e.target.value }); }} /><StockQuantityError value={draft.quantity} max={balance ? Number(balance.quantity) : undefined} limit={balance ? "available" : undefined} /></Field>
                <Field label="Issue date *"><input type="date" required disabled={saving} className={inputCls} value={draft.recordedOn} onChange={e => setDraft({ ...draft, recordedOn: e.target.value })} /></Field>
            </div>
            <fieldset disabled={saving}><Field label="Issue to *"><ThemedSelect value={draft.issuedToType} onChange={issuedToType => setDraft({ ...draft, issuedToType, issuedToLabel: '', issuedToName: '' })} options={recipientOptions} placeholder="Select recipient type" /></Field></fieldset>
            {draft.issuedToType === 'CUSTOM' && <Field label="Custom recipient type *"><input required maxLength={80} disabled={saving} className={inputCls} value={draft.issuedToLabel} onChange={e => setDraft({ ...draft, issuedToLabel: e.target.value })} placeholder="e.g. Visiting trainer, Vendor" /></Field>}
            <Field label={draft.issuedToType === 'CUSTOM' ? 'Recipient name *' : `${recipientLabel(draft.issuedToType)} name *`}><input required maxLength={120} disabled={saving} className={inputCls} value={draft.issuedToName} onChange={e => setDraft({ ...draft, issuedToName: e.target.value })} placeholder={draft.issuedToType === 'TEACHER' ? 'e.g. Sunita Sharma' : draft.issuedToType === 'STUDENT' ? 'e.g. Aarav Patil, Class 5A' : draft.issuedToType === 'CLASSROOM' ? 'e.g. Class 5A' : draft.issuedToType === 'DEPARTMENT' ? 'e.g. Science department' : 'Enter recipient name'} /></Field>
            {returnable ? <Field label="Return due date (optional)"><input type="date" min={draft.recordedOn} disabled={saving} className={inputCls} value={draft.dueOn} onChange={e => setDraft({ ...draft, dueOn: e.target.value })} /></Field> : <p className="text-xs text-muted-foreground">Consumables are issued for use and do not need to be returned.</p>}
            <Field label="Notes (optional)"><textarea maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. Required for the science activity" /></Field>
            <div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !draft.issuedToType || !balance || !draft.issuedToName.trim() || (draft.issuedToType === 'CUSTOM' && !draft.issuedToLabel.trim()) || !draft.recordedOn || Number(draft.quantity) <= 0 || !draft.quantity || Number(draft.quantity) > Number(balance.quantity)}>{saving ? 'Saving...' : 'Issue stock'}</PrimaryButton></div>
        </form>
    </DialogContent></Dialog>;
}
