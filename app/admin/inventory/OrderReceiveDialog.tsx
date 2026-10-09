'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PrimaryButton, SecondaryButton, Field, inputCls } from '@/app/admin/payroll/_components/ui';
import { StockQuantityError } from './StockQuantityError';
import { stockToday } from './IssueStockDialog';
import type { PurchaseOrder } from './purchase-order.types';

export default function OrderReceiveDialog({ order, index, onClose, onSaved }: { order: PurchaseOrder; index: number; onClose: () => void; onSaved: () => void }) {
    const line = order.lines[index];
    const [requestId] = useState(() => crypto.randomUUID());
    const [delivered, setDelivered] = useState('');
    const [rejected, setRejected] = useState('0');
    const [damageReason, setDamageReason] = useState('');
    const [recordedOn, setRecordedOn] = useState(stockToday());
    const [billNumber, setBillNumber] = useState('');
    const [billDate, setBillDate] = useState('');
    const [totalCost, setTotalCost] = useState('');
    const [notes, setNotes] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [saving, setSaving] = useState(false);
    const accepted = Number(delivered) - Number(rejected);
    const valid = delivered !== '' && rejected !== '' && Number.isInteger(Number(delivered)) && Number.isInteger(Number(rejected)) && Number(delivered) >= 1 && Number(delivered) <= line.pending && Number(rejected) >= 0 && accepted >= 0 && recordedOn && (Number(rejected) === 0 || damageReason.trim());
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (!valid || saving) return;
        setSaving(true);
        try {
            const payload = new FormData();
            payload.append('payload', JSON.stringify({ requestId, purchaseOrderId: order.id, purchaseOrderLine: index, locationId: order.locationId, supplierId: order.supplierId, deliveredQuantity: delivered, rejectedQuantity: rejected, damageReason, recordedOn, billNumber, billDate: billDate || null, totalCost: totalCost || null, notes }));
            files.forEach(file => payload.append('files', file));
            await api.post(`/admin/inventory/items/${line.itemId}/receive-stock`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success(accepted ? 'Stock received against purchase order' : 'Rejected delivery recorded. Replacement remains pending.'); onSaved();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to record delivery')); }
        finally { setSaving(false); }
    };
    const attach = (added: File[]) => {
        const next = [...files, ...added];
        if (next.length > 5) { toast.error('Attach up to 5 documents'); return; }
        if (next.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024) { toast.error('Attachments must total 25 MB or less'); return; }
        for (const file of next) { const limit = file.type.startsWith('image/') ? 5 : file.type === 'application/pdf' ? 10 : 15; if (!file.size || file.size > limit * 1024 * 1024) { toast.error(`${file.name} must be non-empty and ${limit} MB or smaller`); return; } }
        setFiles(next);
    };
    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Receive stock</DialogTitle><DialogDescription>{order.number} - {line.name}</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4"><p className="text-xs text-muted-foreground">Supplier: {order.supplierSnapshot.name} | Location: {order.locationName}<br />Pending: {line.pending} {line.unit}</p><fieldset disabled={saving} className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><Field label="Delivered quantity *"><input autoFocus required type="number" min="1" max={line.pending} step="1" className={inputCls} value={delivered} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setDelivered(e.target.value); }} /><StockQuantityError value={delivered} max={line.pending} limit="pending" /></Field><Field label="Damaged/rejected quantity"><input required type="number" min="0" max={Number(delivered) || line.pending} step="1" className={inputCls} value={rejected} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setRejected(e.target.value); }} /><StockQuantityError value={rejected} min={0} max={delivered ? Number(delivered) : undefined} /></Field></div>
        {Number(rejected) > 0 && <Field label="Reason for rejected items *"><textarea required maxLength={500} className={`${inputCls} h-20 py-2 resize-none`} value={damageReason} onChange={e => setDamageReason(e.target.value)} /></Field>}<p className="text-sm font-semibold">Accepted: {Math.max(0, accepted)} {line.unit}</p><p className="text-xs text-muted-foreground">Only accepted items increase stock. Rejected items remain pending for replacement.</p>
        <Field label="Receipt date *"><input required type="date" className={inputCls} value={recordedOn} onChange={e => setRecordedOn(e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Bill number (optional)"><input maxLength={80} className={inputCls} value={billNumber} onChange={e => setBillNumber(e.target.value)} /></Field><Field label="Bill date (optional)"><input type="date" className={inputCls} value={billDate} onChange={e => setBillDate(e.target.value)} /></Field></div><Field label="Cost for this delivery (optional)"><input type="number" min="0" max="1000000000" step="0.01" className={inputCls} value={totalCost} onChange={e => setTotalCost(e.target.value)} /></Field>
        <Field label="Bill documents (optional)"><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" className="w-full text-xs" onChange={e => { attach(Array.from(e.target.files || [])); e.target.value = ''; }} /><p className="mt-1 text-xs text-muted-foreground">Up to 5 files: images 5 MB, PDFs 10 MB, other documents 15 MB each. Total 25 MB.</p>{files.map((file, i) => <div key={i} className="flex items-center justify-between gap-2 mt-2 text-xs"><span className="truncate">{file.name}</span><button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setFiles(files.filter((_, index) => index !== i))}>Remove</button></div>)}</Field><Field label="Notes (optional)"><textarea maxLength={500} className={`${inputCls} h-20 py-2 resize-none`} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
    </fieldset><div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={!valid || saving}>{saving ? 'Saving...' : 'Record delivery'}</PrimaryButton></div></form></DialogContent></Dialog>;
}
