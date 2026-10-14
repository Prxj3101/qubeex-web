'use client';
import { StockQuantityError } from './StockQuantityError';
import { OrderNewItem } from './OrderNewItem';
import { InventoryIconLabel } from './InventoryIconLabel';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PrimaryButton, SecondaryButton, Field, inputCls, ThemedSelect } from '@/app/admin/payroll/_components/ui';
import type { Item } from './ItemsPanel';
import { orderMoney, type PurchaseLine, type PurchaseOrder } from './purchase-order.types';

export default function OrderDraftDialog({ request, order, onClose, onSaved }: { request: { id: string; requiredOn: string; lines: PurchaseLine[] }; order?: PurchaseOrder; onClose: () => void; onSaved: () => void }) {
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [units, setUnits] = useState<{ id: string; name: string; abbreviation?: string }[]>([]);
    const [addingIndex, setAddingIndex] = useState<number | null>(null);
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
    const [lines, setLines] = useState(request.lines.map((requested, index) => ({ quantity: String(order?.lines[index].quantity ?? requested.quantity), itemId: order?.lines[index].itemId || '', unitPrice: order?.lines[index].unitPrice || '', taxPercent: order?.lines[index].taxPercent || '0' })));
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([api.get('/admin/inventory/items', { signal: controller.signal }), api.get('/admin/inventory/suppliers', { signal: controller.signal }), api.get('/admin/inventory/locations', { signal: controller.signal }), api.get('/admin/inventory/categories', { signal: controller.signal }), api.get('/admin/inventory/units', { signal: controller.signal })]).then(([i, s, l, c, u]) => {
            if (!controller.signal.aborted) { setItems(i.data.data); setSuppliers(s.data.data); setLocations(l.data.data); setCategories(c.data.data); setUnits(u.data.data); }
        }).catch(err => { if (!controller.signal.aborted) setError(getErrorMessage(err, 'Failed to load school inventory setup')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, []);
    const valid = addingIndex === null && !loading && !error && supplierId && locationId && expectedOn && lines.every(line => line.itemId && /^\d+$/.test(line.quantity) && Number(line.quantity) >= 1 && Number(line.quantity) <= 1000000000 && /^\d{1,10}(\.\d{1,2})?$/.test(line.unitPrice) && Number(line.unitPrice) <= 1000000000 && /^\d{1,10}(\.\d{1,2})?$/.test(line.taxPercent) && Number(line.taxPercent) <= 100);
    const totals = lines.map(line => { const subtotal = Math.round(Number(line.unitPrice) * Number(line.quantity) * 100) / 100; return subtotal + Math.round(subtotal * Number(line.taxPercent)) / 100; });
    const total = totals.reduce((sum, value) => sum + value, 0);
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (!valid || saving || total > 1000000000) return;
        setSaving(true);
        try {
            const payload = { supplierId, locationId, expectedOn, instructions, lines: lines.map(line => ({ ...line, quantity: Number(line.quantity) })) };
            if (order) await api.patch(`/admin/inventory/purchase-orders/${order.id}`, { ...payload, revision: order.revision });
            else await api.post('/admin/inventory/purchase-orders', { ...payload, purchaseRequestId: request.id });
            toast.success('Order submitted for admin approval'); onSaved();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to submit purchase order')); }
        finally { setSaving(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-2xl bg-card h-[85dvh] max-h-[85dvh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6 "><DialogTitle>{order ? 'Edit purchase order' : 'Create purchase order'}</DialogTitle><DialogDescription>Set the order quantities and select the inventory items that delivery will add to.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

        {loading ? <p className="text-sm text-muted-foreground" role="status">Loading setup...</p> : error ? <p role="alert" className="text-sm text-red-500">{error}</p> : <form onSubmit={save} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
<fieldset disabled={saving} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4"><Field label="Supplier *"><ThemedSelect value={supplierId} onChange={setSupplierId} options={suppliers.map(s => ({ value: s.id, label: <InventoryIconLabel kind="suppliers" name={s.name} id={s.id} /> }))} placeholder="Select supplier" /></Field><Field label="Delivery location *"><ThemedSelect value={locationId} onChange={setLocationId} options={locations.map(l => ({ value: l.id, label: <InventoryIconLabel kind="locations" name={l.name} /> }))} placeholder="Select location" /></Field></div>
            {(!suppliers.length || !locations.length) && <p role="alert" className="text-xs text-red-500">Add suppliers and locations in Setup before creating the order.</p>}
            {request.lines.map((line, index) => <div key={index} className="rounded-xl border border-border/50 p-3 space-y-3"><p className="text-sm font-semibold">{line.name}</p><p className="text-xs text-muted-foreground">Requested: {line.quantity} {line.unit}</p><Field label="Order quantity *"><input required type="number" min="1" max="1000000000" step="1" className={inputCls} value={lines[index].quantity} onChange={e => { if (/^\d*$/.test(e.target.value)) setLines(current => current.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row)); }} /><StockQuantityError value={lines[index].quantity} /></Field><Field label="Receive into inventory item *"><ThemedSelect value={lines[index].itemId} onChange={itemId => { if (itemId === '__add_new_item__') { setAddingIndex(index); return; } setLines(current => current.map((row, i) => i === index ? { ...row, itemId } : row)); }} options={[...items.filter(item => [item.unit.name, item.unit.abbreviation].some(unit => unit?.trim().toLowerCase() === line.unit.trim().toLowerCase())).map(item => ({ value: item.id, label: `${item.name} (${item.code}) - ${item.unit.abbreviation || item.unit.name}` })), ...(addingIndex === null ? [{ value: '__add_new_item__', label: <span className="font-semibold text-primary">+ Add new item</span> }] : [])]} placeholder="Select matching item and unit" /></Field>{addingIndex === index ? <OrderNewItem name={line.name} unit={line.unit} categories={categories} units={units} onCancel={() => setAddingIndex(null)} onAdded={item => { setItems(current => [...current, item]); setLines(current => current.map((row, i) => i === index ? { ...row, itemId: item.id } : row)); setAddingIndex(null); toast.success('Item added and selected'); }} /> : null}<div className="grid grid-cols-2 gap-3"><Field label="Unit price (INR) *"><input required type="number" min="0" max="1000000000" step="0.01" className={inputCls} value={lines[index].unitPrice} onChange={e => setLines(lines.map((row, i) => i === index ? { ...row, unitPrice: e.target.value } : row))} /></Field><Field label="Tax (%) *"><input required type="number" min="0" max="100" step="0.01" className={inputCls} value={lines[index].taxPercent} onChange={e => setLines(lines.map((row, i) => i === index ? { ...row, taxPercent: e.target.value } : row))} /></Field></div><p className="text-xs text-muted-foreground">Line total: {orderMoney(totals[index] || 0)}</p>{lines[index].taxPercent !== '' && (Number(lines[index].taxPercent) < 0 || Number(lines[index].taxPercent) > 100) && <p role="alert" className="text-xs text-red-500">Tax must be between 0 and 100%.</p>}{lines[index].unitPrice !== '' && (Number(lines[index].unitPrice) < 0 || Number(lines[index].unitPrice) > 1000000000) && <p role="alert" className="text-xs text-red-500">Price must be between 0 and INR 1,000,000,000.</p>}</div>)}
            <Field label="Expected delivery *"><input required type="date" className={inputCls} value={expectedOn} onChange={e => setExpectedOn(e.target.value)} /></Field><Field label="Instructions (optional)"><textarea maxLength={1000} className={`${inputCls} h-20 py-2 resize-none`} value={instructions} onChange={e => setInstructions(e.target.value)} /></Field>
        </fieldset><p className="text-sm font-semibold">Order total: {orderMoney(total || 0)}</p>{total > 1000000000 && <p role="alert" className="text-xs text-red-500">Order total must be no more than INR 1,000,000,000.</p>}
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={!valid || saving || total > 1000000000}>{saving ? 'Submitting...' : 'Submit order'}</PrimaryButton></div></form>}
    
</div>
</DialogContent></Dialog>;
}
