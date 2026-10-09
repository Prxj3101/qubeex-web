'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PrimaryButton, SecondaryButton, Field, inputCls, ThemedSelect } from '@/app/admin/payroll/_components/ui';
import type { Item } from './ItemsPanel';
import { orderMoney, type PurchaseLine, type PurchaseOrder } from './purchase-order.types';

export default function OrderDraftDialog({ request, order, onClose, onSaved }: { request: { id: string; requiredOn: string; lines: PurchaseLine[] }; order?: PurchaseOrder; onClose: () => void; onSaved: () => void }) {
    const [items, setItems] = useState<Item[]>([]);
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
    const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [supplierId, setSupplierId] = useState(order?.supplierId || '');
    const [locationId, setLocationId] = useState(order?.locationId || '');
    const [expectedOn, setExpectedOn] = useState((order?.expectedOn || request.requiredOn).slice(0, 10));
    const [instructions, setInstructions] = useState(order?.instructions || '');
    const [lines, setLines] = useState(request.lines.map((_, index) => ({ itemId: order?.lines[index].itemId || '', unitPrice: order?.lines[index].unitPrice || '', taxPercent: order?.lines[index].taxPercent || '0' })));
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([api.get('/admin/inventory/items', { signal: controller.signal }), api.get('/admin/inventory/suppliers', { signal: controller.signal }), api.get('/admin/inventory/locations', { signal: controller.signal })]).then(([i, s, l]) => {
            if (!controller.signal.aborted) { setItems(i.data.data); setSuppliers(s.data.data); setLocations(l.data.data); }
        }).catch(err => { if (!controller.signal.aborted) setError(getErrorMessage(err, 'Failed to load school inventory setup')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, []);
    const valid = !loading && !error && supplierId && locationId && expectedOn && lines.every(line => line.itemId && /^\d{1,10}(\.\d{1,2})?$/.test(line.unitPrice) && Number(line.unitPrice) <= 1000000000 && /^\d{1,10}(\.\d{1,2})?$/.test(line.taxPercent) && Number(line.taxPercent) <= 100);
    const totals = lines.map((line, i) => { const subtotal = Math.round(Number(line.unitPrice) * request.lines[i].quantity * 100) / 100; return subtotal + Math.round(subtotal * Number(line.taxPercent)) / 100; });
    const total = totals.reduce((sum, value) => sum + value, 0);
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (!valid || saving || total > 1000000000) return;
        setSaving(true);
        try {
            const payload = { supplierId, locationId, expectedOn, instructions, lines };
            if (order) await api.patch(`/admin/inventory/purchase-orders/${order.id}`, { ...payload, revision: order.revision });
            else await api.post('/admin/inventory/purchase-orders', { ...payload, purchaseRequestId: request.id });
            toast.success('Order submitted for admin approval'); onSaved();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to submit purchase order')); }
        finally { setSaving(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-2xl bg-card max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{order ? 'Edit purchase order' : 'Create purchase order'}</DialogTitle><DialogDescription>Use the approved quantities. Select the inventory item that each delivery will add to.</DialogDescription></DialogHeader>
        {loading ? <p className="text-sm text-muted-foreground" role="status">Loading setup...</p> : error ? <p role="alert" className="text-sm text-red-500">{error}</p> : <form onSubmit={save} className="space-y-4"><fieldset disabled={saving} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4"><Field label="Supplier *"><ThemedSelect value={supplierId} onChange={setSupplierId} options={suppliers.map(s => ({ value: s.id, label: s.name }))} placeholder="Select supplier" /></Field><Field label="Delivery location *"><ThemedSelect value={locationId} onChange={setLocationId} options={locations.map(l => ({ value: l.id, label: l.name }))} placeholder="Select location" /></Field></div>
            {(!suppliers.length || !locations.length || !items.length) && <p role="alert" className="text-xs text-red-500">Add suppliers and locations in Setup, and items in Stock &amp; Assets before creating the order.</p>}
            {request.lines.map((line, index) => <div key={index} className="rounded-xl border border-border/50 p-3 space-y-3"><p className="text-sm font-semibold">{line.name} - {line.quantity} {line.unit}</p><Field label="Receive into inventory item *"><ThemedSelect value={lines[index].itemId} onChange={itemId => setLines(lines.map((row, i) => i === index ? { ...row, itemId } : row))} options={items.map(item => ({ value: item.id, label: `${item.name} (${item.code}) - ${item.unit.abbreviation || item.unit.name}` }))} placeholder="Select matching item and unit" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Unit price (INR) *"><input required type="number" min="0" max="1000000000" step="0.01" className={inputCls} value={lines[index].unitPrice} onChange={e => setLines(lines.map((row, i) => i === index ? { ...row, unitPrice: e.target.value } : row))} /></Field><Field label="Tax (%) *"><input required type="number" min="0" max="100" step="0.01" className={inputCls} value={lines[index].taxPercent} onChange={e => setLines(lines.map((row, i) => i === index ? { ...row, taxPercent: e.target.value } : row))} /></Field></div><p className="text-xs text-muted-foreground">Line total: {orderMoney(totals[index] || 0)}</p>{lines[index].taxPercent !== '' && (Number(lines[index].taxPercent) < 0 || Number(lines[index].taxPercent) > 100) && <p role="alert" className="text-xs text-red-500">Tax must be between 0 and 100%.</p>}{lines[index].unitPrice !== '' && (Number(lines[index].unitPrice) < 0 || Number(lines[index].unitPrice) > 1000000000) && <p role="alert" className="text-xs text-red-500">Price must be between 0 and INR 1,000,000,000.</p>}</div>)}
            <Field label="Expected delivery *"><input required type="date" className={inputCls} value={expectedOn} onChange={e => setExpectedOn(e.target.value)} /></Field><Field label="Instructions (optional)"><textarea maxLength={1000} className={`${inputCls} h-20 py-2 resize-none`} value={instructions} onChange={e => setInstructions(e.target.value)} /></Field>
        </fieldset><p className="text-sm font-semibold">Order total: {orderMoney(total || 0)}</p>{total > 1000000000 && <p role="alert" className="text-xs text-red-500">Order total must be no more than INR 1,000,000,000.</p>}<div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={!valid || saving || total > 1000000000}>{saving ? 'Submitting...' : 'Submit order'}</PrimaryButton></div></form>}
    </DialogContent></Dialog>;
}
