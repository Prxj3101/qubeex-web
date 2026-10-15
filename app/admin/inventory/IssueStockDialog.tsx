'use client';
import { LedgerFilePicker, ledgerPayload } from './LedgerAttachments';
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

export const stockToday = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const stockTime = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
export const recipientOptions = [{"value":"PRINCIPAL","label":"Principal"},{"value":"VICE_PRINCIPAL","label":"Vice Principal"},{"value":"HEAD_MASTER","label":"Head Master"},{"value":"HEAD_MISTRESS","label":"Head Mistress"},{"value":"DIRECTOR","label":"Director"},{"value":"ADMINISTRATOR","label":"Administrator"},{"value":"COORDINATOR","label":"Coordinator"},{"value":"DEAN","label":"Dean"},{"value":"RECTOR","label":"Rector"},{"value":"SUPERINTENDENT","label":"Superintendent"},{"value":"CHAIRMAN","label":"Chairman"},{"value":"SECRETARY","label":"Secretary"},{"value":"TRUSTEE","label":"Trustee"},{"value":"TEACHER","label":"Teacher"},{"value":"STUDENT","label":"Student"},{"value":"LIBRARIAN","label":"Librarian"},{"value":"ACCOUNTANT","label":"Accountant"},{"value":"CLERK","label":"Clerk"},{"value":"RECEPTIONIST","label":"Receptionist"},{"value":"LAB_ASSISTANT","label":"Lab Assistant"},{"value":"SPORTS_COACH","label":"Sports Coach"},{"value":"IT_STAFF","label":"IT Staff"},{"value":"PEON","label":"Peon"},{"value":"DRIVER","label":"Driver"},{"value":"SECURITY_GUARD","label":"Security Guard"},{"value":"HOUSEKEEPING","label":"Housekeeping"},{"value":"CLASSROOM","label":"Classroom"},{"value":"DEPARTMENT","label":"Department"},{"value":"CUSTOM","label":"Custom"}];
export const recipientLabel = (type: string | undefined, custom?: string) => type === 'CUSTOM' ? custom || 'Custom' : recipientOptions.find(o => o.value === type)?.label || type || 'Recipient';
export const stockQuantity = (value: string | number) => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export function IssueStockDialog({ item, request, onClose, onSaved }: { item: Item; request?: { id: string; revision: number; lineIndex: number; pending: number; teacherName: string }; onClose: () => void; onSaved: (item: Item) => void }) {
    const [draft, setDraft] = useState(() => ({ requestId: crypto.randomUUID(), locationId: '', quantity: request ? String(request.pending) : '', issuedToType: request ? 'TEACHER' : '', issuedToLabel: '', issuedToName: request?.teacherName || '', recordedOn: stockToday(), recordedTime: stockTime(), dueOn: '', notes: '' }));
    const [files, setFiles] = useState<File[]>([]);
    const [saving, setSaving] = useState(false);
    const post = (url: string, payload: unknown) => api.post(url, ledgerPayload(payload, files), files.length ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
    const balance = item.balances.find(b => b.locationId === draft.locationId);
    const returnable = item.type !== 'CONSUMABLE';
    const maximum = Math.min(Number(balance?.quantity || 0), request?.pending ?? Infinity);
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (saving) return;
        setSaving(true);
        try {
            const res = request ? await post(`/admin/inventory/item-requests/${request.id}/issue`, { requestId: draft.requestId, revision: request.revision, lineIndex: request.lineIndex, itemId: item.id, locationId: draft.locationId, quantity: draft.quantity, recordedOn: draft.recordedOn, recordedTime: draft.recordedTime, dueOn: returnable && draft.dueOn ? draft.dueOn : null, notes: draft.notes }) : await post(`/admin/inventory/items/${item.id}/issue-stock`, { ...draft, dueOn: returnable && draft.dueOn ? draft.dueOn : null });
            onSaved(res.data.data); toast.success('Stock issued'); onClose();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to issue stock')); }
        finally { setSaving(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-6 "><DialogTitle>Give out stock</DialogTitle><DialogDescription>{item.name} - record who receives this item and reduce available stock.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

        <form onSubmit={save} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

            <fieldset disabled={saving}><Field label="From location *"><ThemedSelect value={draft.locationId} onChange={locationId => setDraft({ ...draft, locationId })} options={item.balances.filter(b => Number(b.quantity) > 0).map(b => ({ value: b.locationId, label: <InventoryIconLabel kind="locations" name={b.location.name}>{`${b.location.name} (${stockQuantity(b.quantity)} available)`}</InventoryIconLabel> }))} placeholder="Select location" /></Field></fieldset>
            {balance && <p className="text-xs text-muted-foreground">Available: <span className="font-semibold text-foreground">{stockQuantity(balance.quantity)} {item.unit.abbreviation || item.unit.name}</span></p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Quantity *"><input autoFocus type="number" required min={qtyMin((item.type === 'CONSUMABLE' && !request))} step={qtyStep((item.type === 'CONSUMABLE' && !request))} max={balance ? maximum : 1000000000} disabled={saving} className={inputCls} value={draft.quantity} onChange={e => { if (qtyPattern((item.type === 'CONSUMABLE' && !request)).test(e.target.value)) setDraft({ ...draft, quantity: e.target.value }); }} /><StockQuantityError decimals={(item.type === 'CONSUMABLE' && !request)} value={draft.quantity} max={balance ? maximum : undefined} limit={balance ? "available" : undefined} /></Field>
                <Field label="Issue date *"><input type="date" required disabled={saving} className={inputCls} value={draft.recordedOn} onChange={e => setDraft({ ...draft, recordedOn: e.target.value })} /></Field>
            </div>
            <Field label="Issue time (IST) *"><input type="time" required disabled={saving} className={inputCls} value={draft.recordedTime} onChange={e => setDraft({ ...draft, recordedTime: e.target.value })} /></Field>
            <fieldset disabled={saving || !!request}><Field label="Issue to *"><ThemedSelect value={draft.issuedToType} onChange={issuedToType => setDraft({ ...draft, issuedToType, issuedToLabel: '', issuedToName: '' })} options={recipientOptions} placeholder="Select recipient type" /></Field></fieldset>
            {draft.issuedToType === 'CUSTOM' && <Field label="Custom recipient type *"><input required maxLength={80} disabled={saving} className={inputCls} value={draft.issuedToLabel} onChange={e => setDraft({ ...draft, issuedToLabel: e.target.value })} placeholder="e.g. Visiting trainer, Vendor" /></Field>}
            <Field label={draft.issuedToType === 'CUSTOM' ? 'Recipient name *' : `${recipientLabel(draft.issuedToType)} name *`}><input required maxLength={120} disabled={saving || !!request} className={inputCls} value={draft.issuedToName} onChange={e => setDraft({ ...draft, issuedToName: e.target.value })} placeholder={draft.issuedToType === 'TEACHER' ? 'e.g. Sunita Sharma' : draft.issuedToType === 'STUDENT' ? 'e.g. Aarav Patil, Class 5A' : draft.issuedToType === 'CLASSROOM' ? 'e.g. Class 5A' : draft.issuedToType === 'DEPARTMENT' ? 'e.g. Science department' : 'Enter recipient name'} /></Field>
            {returnable ? <Field label="Return due date (optional)"><input type="date" min={draft.recordedOn} disabled={saving} className={inputCls} value={draft.dueOn} onChange={e => setDraft({ ...draft, dueOn: e.target.value })} /></Field> : <p className="text-xs text-muted-foreground">Consumables are issued for use and do not need to be returned.</p>}
            <LedgerFilePicker files={files} onChange={setFiles} disabled={saving} />
            <Field label="Notes (optional)"><textarea maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. Required for the science activity" /></Field>
            
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !draft.issuedToType || !balance || !draft.issuedToName.trim() || (draft.issuedToType === 'CUSTOM' && !draft.issuedToLabel.trim()) || !draft.recordedOn || !draft.recordedTime || Number(draft.quantity) <= 0 || !draft.quantity || Number(draft.quantity) > maximum}>{saving ? 'Saving...' : 'Give out stock'}</PrimaryButton></div>
        </form>
    
</div>
</DialogContent></Dialog>;
}
