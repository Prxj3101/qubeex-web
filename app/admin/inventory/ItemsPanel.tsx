'use client';
import { SupplierReturnDialog } from './SupplierReturnDialog';
import { StockAdjustmentDialog } from './StockAdjustmentDialog';
import { StockQuantityError } from './StockQuantityError';
import { TransferStockDialog } from './TransferStockDialog';

import { IssueStockDialog, recipientLabel } from './IssueStockDialog';
import { IssuedStockDialog } from './IssuedStockDialog';
import { useCallback, useEffect, useState } from 'react';
import { Boxes, Plus, Pencil, Trash2, Search, Loader2, PackagePlus, Paperclip, ExternalLink, Download, PackageMinus, ClipboardList, ArrowRightLeft, SlidersHorizontal, Undo2, MoreHorizontal, History } from 'lucide-react';
import { PendingAttachmentChip } from '@/components/shared/PendingAttachmentChip';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { PageHeader, PrimaryButton, SecondaryButton, SmallButton, EmptyState, Field, inputCls, ThemedSelect, Pill } from '@/app/admin/payroll/_components/ui';

type ItemType = 'CONSUMABLE' | 'RETURNABLE' | 'FIXED_ASSET';
interface Lookup { id: string; name: string; abbreviation?: string }
export interface Item {
    id: string; name: string; code: string; description: string; type: ItemType;
    categoryId: string; unitId: string; lowStockLevel: string;
    category: Lookup; unit: Lookup;
    balances: Balance[];
    movements: { kind: string; locationId: string }[];
}
interface Draft { id?: string; name: string; code: string; description: string; type: ItemType; categoryId: string; unitId: string; lowStockLevel: string }
interface Balance { id: string; locationId: string; quantity: string; location: Lookup }
interface Correction { item: Item; balance: Balance; quantity: string; reason: string }
interface BillAttachment { url: string; name: string; type: string; size: number }
interface HistoryRecord { purchaseOrder?: { number: string } | null; adjustmentType?: string | null; deliveredQuantity?: string | null; rejectedQuantity?: string; damageReason?: string; transferId?: string; transferLocationName?: string; issuedToType?: string; issuedToLabel?: string; issuedToName?: string; returnExpected?: boolean; dueOn?: string | null; attachments?: BillAttachment[]; id: string; kind: string; quantity: string; previousQuantity: string | null; correctedQuantity: string | null; notes: string; createdAt: string; recordedOn: string; createdByName: string; supplierName: string; billNumber: string; billDate: string | null; totalCost: string | null }
interface StockHistory { item: Item; balance: Balance; records: HistoryRecord[]; loading: boolean; error: string }
const canCorrect = (item: Item, balance: Balance) => {
    const entries = (item.movements || []).filter(m => m.locationId === balance.locationId);
    return entries.some(m => m.kind === 'OPENING') && entries.every(m => m.kind === 'OPENING' || m.kind === 'OPENING_CORRECTION');
};
interface Receipt { deliveredQuantity: string; rejectedQuantity: string; damageReason: string; files: File[]; item: Item; requestId: string; supplierId: string; locationId: string; recordedOn: string; billNumber: string; billDate: string; totalCost: string; notes: string }
interface Opening { item: Item; locationId: string; quantity: string; recordedOn: string; notes: string }
const typeOptions: { value: ItemType; label: string }[] = [
    { value: 'CONSUMABLE', label: 'Consumables' },
    { value: 'RETURNABLE', label: 'Returnable equipment' },
    { value: 'FIXED_ASSET', label: 'Fixed assets' },
];
const total = (item: Item) => item.balances.reduce((sum, b) => sum + Number(b.quantity), 0);
const formatQuantity = (value: number | string) => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function ItemsPanel({ onSetup }: { onSetup: () => void }) {
    const [supplierReturnItem, setSupplierReturnItem] = useState<Item | null>(null);
    const [adjustment, setAdjustment] = useState<{ item: Item; balance: Balance } | null>(null);
    const [transferItem, setTransferItem] = useState<Item | null>(null);
    const [issueItem, setIssueItem] = useState<Item | null>(null);
    const [issuedItem, setIssuedItem] = useState<Item | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [categories, setCategories] = useState<Lookup[]>([]);
    const [units, setUnits] = useState<Lookup[]>([]);
    const [locations, setLocations] = useState<Lookup[]>([]);
    const [suppliers, setSuppliers] = useState<Lookup[]>([]);
    const [billPreview, setBillPreview] = useState<BillAttachment | null>(null);
    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<ItemType | ''>('');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [opening, setOpening] = useState<Opening | null>(null);
    const [correction, setCorrection] = useState<Correction | null>(null);
    const [history, setHistory] = useState<StockHistory | null>(null);
    const [toDelete, setToDelete] = useState<Item | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const load = useCallback((signal?: AbortSignal) => {
        return Promise.all([
            api.get('/admin/inventory/items', { signal }), api.get('/admin/inventory/categories', { signal }),
            api.get('/admin/inventory/units', { signal }), api.get('/admin/inventory/locations', { signal }), api.get('/admin/inventory/suppliers', { signal }),
        ]).then(([i, c, u, l, s]) => {
            if (signal?.aborted) return;
            setItems(i.data.data); setCategories(c.data.data); setUnits(u.data.data); setLocations(l.data.data); setSuppliers(s.data.data); setError('');
        }).catch(err => { if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load inventory')); })
            .finally(() => { if (!signal?.aborted) setLoading(false); });
    }, []);
    useEffect(() => {
        const controller = new AbortController(); void load(controller.signal);
        return () => controller.abort();
    }, [load]);
    const replaceItem = (item: Item) => setItems(previous => [...previous.filter(i => i.id !== item.id), item].sort((a, b) => a.name.localeCompare(b.name)));
    const saveItem = async (event: React.FormEvent) => {
        event.preventDefault(); if (!draft || saving) return;
        if (!draft.name.trim() || !draft.categoryId || !draft.unitId) { toast.error('Enter a name and select a category and unit'); return; }
        setSaving(true);
        try {
            const { id, ...payload } = draft;
            const res = id ? await api.patch(`/admin/inventory/items/${id}`, payload) : await api.post('/admin/inventory/items', payload);
            replaceItem(res.data.data); setDraft(null); toast.success(id ? 'Item updated' : 'Item added');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to save item')); }
        finally { setSaving(false); }
    };
    const saveOpening = async (event: React.FormEvent) => {
        event.preventDefault(); if (!opening || saving) return;
        if (!opening.locationId || !opening.quantity) { toast.error('Select a location and enter its opening quantity'); return; }
        if (!opening.notes.trim()) { toast.error('Enter opening stock notes'); return; }
        setSaving(true);
        try {
            const { item, ...payload } = opening;
            const res = await api.post(`/admin/inventory/items/${item.id}/opening-stock`, payload);
            replaceItem(res.data.data); setOpening(null); toast.success('Opening stock recorded');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to record opening stock')); }
        finally { setSaving(false); }
    };
    const saveCorrection = async (event: React.FormEvent) => {
        event.preventDefault(); if (!correction || saving) return;
        if (!correction.reason.trim()) { toast.error('Enter a correction reason'); return; }
        setSaving(true);
        try {
            const res = await api.patch(`/admin/inventory/items/${correction.item.id}/opening-stock`, {
                locationId: correction.balance.locationId, quantity: correction.quantity,
                expectedQuantity: String(correction.balance.quantity), reason: correction.reason.trim(),
            });
            replaceItem(res.data.data); setCorrection(null); toast.success('Opening stock corrected');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to correct opening stock')); }
        finally { setSaving(false); }
    };
    const showHistory = async (item: Item, balance: Balance) => {
        setHistory({ item, balance, records: [], loading: true, error: '' });
        try {
            const res = await api.get(`/admin/inventory/items/${item.id}/stock-history`, { params: { locationId: balance.locationId } });
            setHistory(previous => previous?.item.id === item.id && previous.balance.id === balance.id ? { ...previous, records: res.data.data, loading: false } : previous);
        } catch (err) {
            setHistory(previous => previous?.item.id === item.id && previous.balance.id === balance.id ? { ...previous, error: getErrorMessage(err, 'Failed to load history'), loading: false } : previous);
        }
    };

    const acceptedReceiptQuantity = receipt ? Number(receipt.deliveredQuantity) - Number(receipt.rejectedQuantity) : 0;
    const validReceiptQuantities = !!receipt && receipt.deliveredQuantity !== '' && receipt.rejectedQuantity !== '' && Number.isInteger(Number(receipt.deliveredQuantity)) && Number.isInteger(Number(receipt.rejectedQuantity)) && Number(receipt.deliveredQuantity) >= 1 && Number(receipt.deliveredQuantity) <= 1000000000 && Number(receipt.rejectedQuantity) >= 0 && acceptedReceiptQuantity >= 0;
    const saveReceipt = async (event: React.FormEvent) => {
        event.preventDefault(); if (!receipt || saving) return;
        if (!receipt.locationId || !receipt.supplierId || !validReceiptQuantities || (Number(receipt.rejectedQuantity) > 0 && !receipt.damageReason.trim())) { toast.error('Select a supplier, location and valid delivery quantities, with a reason for rejected items'); return; }
        setSaving(true);
        try {
            const { item, files, ...input } = receipt;
            const payload = new FormData();
            payload.append('payload', JSON.stringify({ ...input, billDate: input.billDate || null, totalCost: input.totalCost || null }));
            files.forEach(file => payload.append('files', file));
            const res = await api.post(`/admin/inventory/items/${item.id}/receive-stock`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
            replaceItem(res.data.data); setReceipt(null); toast.success(acceptedReceiptQuantity > 0 ? 'Stock received' : 'Delivery recorded - all items rejected');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to receive stock')); }
        finally { setSaving(false); }
    };
    const remove = async () => {
        if (!toDelete || deleting) return; setDeleting(true);
        try {
            await api.delete(`/admin/inventory/items/${toDelete.id}`);
            setItems(previous => previous.filter(i => i.id !== toDelete.id)); setToDelete(null); toast.success('Item deleted');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to delete item')); }
        finally { setDeleting(false); }
    };
    const filtered = items.filter(i => (!filter || i.type === filter) && `${i.name} ${i.code} ${i.category.name} ${i.balances.map(b => b.location.name).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
    const ready = categories.length > 0 && units.length > 0;
    const availableLocations = opening ? locations.filter(l => !opening.item.balances.some(b => b.locationId === l.id)) : [];
    const lockedDraft = !!draft?.id && !!items.find(i => i.id === draft.id)?.balances.length;

    return <>
        <PageHeader title="Stock & Assets" subtitle="Manage your school stock and assets.">
            <div className="flex flex-wrap items-center justify-end gap-3 max-w-full">
                <div className="relative w-full sm:w-60 shrink-0"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search inventory" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item name or code..." className="w-full h-8 pl-8 pr-3 rounded-full text-xs bg-muted/50 border border-border/50 focus:outline-none focus:border-primary/50" /></div>
                <div className="max-w-full overflow-x-auto"><div className="flex shrink-0 bg-muted/50 rounded-xl p-0.5 border border-border/50">
                    {[{ value: '', label: 'All items' }, ...typeOptions].map(o => <button type="button" key={o.value} onClick={() => setFilter(o.value as ItemType | '')} aria-pressed={filter === o.value} className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${filter === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{o.label}</button>)}
                </div></div>
                <PrimaryButton disabled={loading || !!error || !ready} onClick={() => setDraft({ name: '', code: '', description: '', type: 'CONSUMABLE', categoryId: '', unitId: '', lowStockLevel: '0' })}><Plus size={14} />Add item</PrimaryButton>
            </div>
        </PageHeader>
        {!loading && !error && !ready && <EmptyState icon={Boxes} title="Complete your item setup" text="Add at least one category and unit before creating items."><SecondaryButton onClick={onSetup}>Open setup</SecondaryButton></EmptyState>}
        <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            {loading ? <div role="status" className="flex justify-center items-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading inventory...</div>
                : error ? <EmptyState icon={Boxes} title="Could not load inventory" text={error}><SecondaryButton onClick={() => { setLoading(true); void load(); }}>Retry</SecondaryButton></EmptyState>
                : filtered.length === 0 ? <EmptyState icon={Boxes} title={search || filter ? 'No matching items' : 'No items added yet'} text="Add an item, then record the quantity already available at each location." />
                : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">
                    <thead className="border-b border-border/60 text-muted-foreground"><tr>{['Item', 'Category', 'Type', 'Available', 'Locations', 'Status', 'Actions'].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
                    <tbody className="divide-y divide-border/50">{filtered.map(item => {
                        const quantity = total(item); const low = item.type === 'CONSUMABLE' && Number(item.lowStockLevel) > 0 && quantity <= Number(item.lowStockLevel);
                        return <tr key={item.id}>
                            <td className="px-4 py-3"><p className="text-sm font-medium">{item.name}</p><p className="text-muted-foreground mt-1">{item.code}</p></td>
                            <td className="px-4 py-3">{item.category.name}</td><td className="px-4 py-3">{typeOptions.find(o => o.value === item.type)?.label}</td>
                            <td className="px-4 py-3 whitespace-nowrap font-semibold">{formatQuantity(quantity)} <span className="font-normal text-muted-foreground">{item.unit.abbreviation || item.unit.name}</span></td>
                            <td className="px-4 py-3">{item.balances.length ? item.balances.map(b => <div key={b.id} className="flex items-center gap-2 py-1 whitespace-nowrap">
                                <span>{b.location.name}: {formatQuantity(b.quantity)}</span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><SmallButton aria-label={`Actions for ${item.name} at ${b.location.name}`}><MoreHorizontal size={14} /></SmallButton></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => setAdjustment({ item, balance: b })}><SlidersHorizontal size={13} className="mr-2" />Adjust stock</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => void showHistory(item, b)}><History size={13} className="mr-2" />History</DropdownMenuItem>
                                        <DropdownMenuItem disabled={!canCorrect(item, b)} onClick={() => setCorrection({ item, balance: b, quantity: String(b.quantity), reason: '' })}><Pencil size={13} className="mr-2" />Edit opening stock</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>) : <span className="text-muted-foreground">No stock recorded</span>}</td>
                            <td className="px-4 py-3 whitespace-nowrap"><Pill tone={low ? 'amber' : quantity > 0 ? 'green' : 'muted'}>{low ? 'Low stock' : quantity > 0 ? 'In stock' : 'No stock'}</Pill></td>
                            <td className="px-4 py-3"><div className="flex items-center gap-1.5">
                                <SmallButton disabled={!item.balances.some(b => Number(b.quantity) > 0)} onClick={() => setIssueItem(item)}><PackageMinus size={13} />Issue stock</SmallButton>
                                <SmallButton disabled={!locations.length || !suppliers.length} onClick={() => setReceipt({ files: [], item, requestId: crypto.randomUUID(), supplierId: '', locationId: '', deliveredQuantity: '', rejectedQuantity: '0', damageReason: '', recordedOn: today(), billNumber: '', billDate: '', totalCost: '', notes: '' })}><PackagePlus size={13} />Receive stock</SmallButton>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><SmallButton aria-label={`More actions for ${item.name}`}><MoreHorizontal size={14} /></SmallButton></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem disabled={locations.length < 2 || !item.balances.some(b => Number(b.quantity) > 0)} onClick={() => setTransferItem(item)}><ArrowRightLeft size={13} className="mr-2" />Transfer stock</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setIssuedItem(item)}><ClipboardList size={13} className="mr-2" />Issued items</DropdownMenuItem>
                                        <DropdownMenuItem disabled={!locations.some(l => !item.balances.some(b => b.locationId === l.id))} onClick={() => setOpening({ item, locationId: '', quantity: '', recordedOn: today(), notes: '' })}><PackagePlus size={13} className="mr-2" />Opening stock</DropdownMenuItem>
                                        <DropdownMenuItem disabled={!suppliers.length || !item.balances.some(b => Number(b.quantity) > 0)} onClick={() => setSupplierReturnItem(item)}><Undo2 size={13} className="mr-2" />Supplier return</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setDraft({ id: item.id, name: item.name, code: item.code, description: item.description, type: item.type, categoryId: item.categoryId, unitId: item.unitId, lowStockLevel: String(item.lowStockLevel) })}><Pencil size={13} className="mr-2" />Edit item</DropdownMenuItem>
                                        <DropdownMenuItem variant="destructive" disabled={item.balances.length > 0} onClick={() => setToDelete(item)}><Trash2 size={13} className="mr-2" />Delete item</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div></td>
                        </tr>;
                    })}</tbody>
                </table></div>}
        </section>
        {!loading && !error && ready && locations.length === 0 && <p className="text-xs text-muted-foreground">Add a location in Setup to record opening stock. <button type="button" className="text-primary underline" onClick={onSetup}>Open setup</button></p>}
        {!loading && !error && suppliers.length === 0 && <p className="text-xs text-muted-foreground">Add a supplier in Setup to receive purchased stock. <button type="button" className="text-primary underline" onClick={onSetup}>Open setup</button></p>}
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{draft?.id ? 'Edit item' : 'New item'}</DialogTitle><DialogDescription>Choose how this school item is classified and counted.</DialogDescription></DialogHeader>
            {draft && <form onSubmit={saveItem} className="space-y-4">
                <Field label="Item name"><input autoFocus required maxLength={120} disabled={saving} className={inputCls} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. A4 Paper" /></Field>
                <Field label="Item code / Serial no. (optional)" hint="Leave blank to generate a code automatically."><input maxLength={40} disabled={saving} className={inputCls} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="e.g. PAPER-A4" /></Field>
                <fieldset disabled={saving} className="grid grid-cols-2 gap-4"><Field label="Category"><ThemedSelect value={draft.categoryId} options={categories.map(c => ({ value: c.id, label: c.name }))} onChange={categoryId => setDraft({ ...draft, categoryId })} placeholder="Select category" /></Field><Field label="Unit" hint={lockedDraft ? 'Unit is fixed after recording stock.' : undefined}><fieldset disabled={lockedDraft}><ThemedSelect value={draft.unitId} options={units.map(u => ({ value: u.id, label: u.name }))} onChange={unitId => setDraft({ ...draft, unitId })} placeholder="Select unit" /></fieldset></Field></fieldset>
                <Field label="Item type" hint={lockedDraft ? 'Type is fixed after recording stock.' : 'Consumables are used up; equipment is returned; fixed assets are long-term school property.'}><fieldset disabled={saving || lockedDraft}><ThemedSelect value={draft.type} options={typeOptions} onChange={type => setDraft({ ...draft, type, lowStockLevel: type === 'CONSUMABLE' ? draft.lowStockLevel : '0' })} /></fieldset></Field>
                {draft.type === 'CONSUMABLE' && <Field label="Low stock alert at" hint="Alert when total stock reaches this quantity or below. Set 0 to disable."><input type="number" min="0" max="1000000000" step="1" required disabled={saving} className={inputCls} value={draft.lowStockLevel} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setDraft({ ...draft, lowStockLevel: e.target.value }); }} /><StockQuantityError value={draft.lowStockLevel} min={0} /></Field>}
                <Field label="Description (optional)"><textarea maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field>
                <div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !draft.name.trim() || !draft.categoryId || !draft.unitId}>{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Add item'}</PrimaryButton></div>
            </form>}
        </DialogContent></Dialog>
        <Dialog open={!!opening} onOpenChange={open => { if (!open && !saving) setOpening(null); }}><DialogContent className="sm:max-w-md bg-card max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Opening stock</DialogTitle><DialogDescription>{opening?.item.name} - record stock already available before using inventory. Each location can be recorded once.</DialogDescription></DialogHeader>
            {opening && <form onSubmit={saveOpening} className="space-y-4">
                <Field label="Location"><fieldset disabled={saving}><ThemedSelect value={opening.locationId} options={availableLocations.map(l => ({ value: l.id, label: l.name }))} onChange={locationId => setOpening({ ...opening, locationId })} placeholder="Select location" /></fieldset></Field>
                <Field label={`Quantity (${opening.item.unit.abbreviation || opening.item.unit.name})`} hint="Enter a whole number."><input autoFocus type="number" required min="1" max="1000000000" step="1" disabled={saving} className={inputCls} value={opening.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setOpening({ ...opening, quantity: e.target.value }); }} /><StockQuantityError value={opening.quantity} /></Field>
                <Field label="Stock counted on"><input type="date" required disabled={saving} className={inputCls} value={opening.recordedOn} onChange={e => setOpening({ ...opening, recordedOn: e.target.value })} /></Field>
                <Field label="Notes *"><textarea required maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={opening.notes} onChange={e => setOpening({ ...opening, notes: e.target.value })} /></Field>
                <div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setOpening(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !opening.locationId || !opening.quantity || !opening.notes.trim()}>{saving ? 'Saving...' : 'Record opening stock'}</PrimaryButton></div>
            </form>}
        </DialogContent></Dialog>
        <Dialog open={!!receipt} onOpenChange={open => { if (!open && !saving) setReceipt(null); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Receive stock</DialogTitle><DialogDescription>{receipt?.item.name} - add newly received stock to a school location.</DialogDescription></DialogHeader>
            {receipt && <form onSubmit={saveReceipt} className="space-y-4">
                <fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Supplier *"><ThemedSelect value={receipt.supplierId} options={suppliers.map(s => ({ value: s.id, label: s.name }))} onChange={supplierId => setReceipt({ ...receipt, supplierId })} placeholder="Select supplier" /></Field>
                    <Field label="Location *"><ThemedSelect value={receipt.locationId} options={locations.map(l => ({ value: l.id, label: l.name }))} onChange={locationId => setReceipt({ ...receipt, locationId })} placeholder="Select location" /></Field>
                </fieldset>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={`Delivered quantity (${receipt.item.unit.abbreviation || receipt.item.unit.name}) *`}><input autoFocus type="number" min="1" step="1" max="1000000000" required disabled={saving} className={inputCls} value={receipt.deliveredQuantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setReceipt({ ...receipt, deliveredQuantity: e.target.value }); }} /><StockQuantityError value={receipt.deliveredQuantity} /></Field>
                    <Field label="Damaged/rejected quantity"><input type="number" min="0" step="1" max={Number(receipt.deliveredQuantity) || 1000000000} required disabled={saving} className={inputCls} value={receipt.rejectedQuantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setReceipt({ ...receipt, rejectedQuantity: e.target.value, damageReason: Number(e.target.value) > 0 ? receipt.damageReason : '' }); }} /><StockQuantityError value={receipt.rejectedQuantity} min={0} max={receipt.deliveredQuantity ? Number(receipt.deliveredQuantity) : undefined} />{receipt.rejectedQuantity === '' && <p role="alert" className="mt-1 text-xs text-red-500">Enter 0 if no items were rejected.</p>}</Field>
                </div>
                {validReceiptQuantities && <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <p className="text-sm font-semibold">Accepted quantity: {formatQuantity(acceptedReceiptQuantity)} {receipt.item.unit.abbreviation || receipt.item.unit.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{acceptedReceiptQuantity > 0 ? 'Only accepted items will be added to available stock.' : 'All items were rejected. Available stock will stay the same.'}</p>
                </div>}
                {Number(receipt.rejectedQuantity) > 0 && <Field label="Damage/rejection reason *" hint="Rejected items are not kept in school stock."><textarea required maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={receipt.damageReason} onChange={e => setReceipt({ ...receipt, damageReason: e.target.value })} placeholder="e.g. 3 pens arrived broken and were rejected" /></Field>}
                <Field label="Received on *"><input type="date" required disabled={saving} className={inputCls} value={receipt.recordedOn} onChange={e => setReceipt({ ...receipt, recordedOn: e.target.value })} /></Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Bill number (optional)"><input maxLength={80} disabled={saving} className={inputCls} value={receipt.billNumber} onChange={e => setReceipt({ ...receipt, billNumber: e.target.value })} placeholder="e.g. INV-101" /></Field>
                    <Field label="Bill date (optional)"><input type="date" disabled={saving} className={inputCls} value={receipt.billDate} onChange={e => setReceipt({ ...receipt, billDate: e.target.value })} /></Field>
                </div>
                <Field label="Cost for this item (optional)" hint="Total cost in rupees for the quantity received in this entry."><input type="number" min="0" max="1000000000" step="0.01" disabled={saving} className={inputCls} value={receipt.totalCost} onChange={e => setReceipt({ ...receipt, totalCost: e.target.value })} placeholder="e.g. 250.00" /></Field>
                <Field label="Bill attachments (optional)">
                    <label className={`inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-medium ${saving ? 'opacity-50' : 'cursor-pointer hover:bg-muted/50'}`}>
                        <Paperclip size={14} />Attach bill
                        <input type="file" className="sr-only" multiple disabled={saving} accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={event => {
                            const selected = Array.from(event.target.files || []); event.target.value = '';
                            const files = [...receipt.files, ...selected];
                            if (files.length > 5) { toast.error('Attach up to 5 documents'); return; }
                            for (const file of selected) {
                                const limit = file.type.startsWith('image/') ? 5 : file.type === 'application/pdf' ? 10 : 15;
                                if (!file.size || file.size > limit * 1024 * 1024) { toast.error(`${file.name} must be non-empty and ${limit} MB or smaller`); return; }
                            }
                            if (files.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024) { toast.error('Attachments must total 25 MB or less'); return; }
                            setReceipt({ ...receipt, files });
                        }} />
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">Up to 5 files, 25 MB total. Photos: 5 MB each, PDFs: 10 MB, other documents: 15 MB.</p>
                    <fieldset disabled={saving} className="mt-2 flex flex-wrap gap-2">{receipt.files.map((file, index) => <PendingAttachmentChip key={`${file.name}-${index}`} file={file} onRemove={() => setReceipt({ ...receipt, files: receipt.files.filter((_, i) => i !== index) })} />)}</fieldset>
                </Field>
                
                <Field label="Notes (optional)"><textarea maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={receipt.notes} onChange={e => setReceipt({ ...receipt, notes: e.target.value })} /></Field>
                <div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setReceipt(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !receipt.supplierId || !receipt.locationId || !validReceiptQuantities || (Number(receipt.rejectedQuantity) > 0 && !receipt.damageReason.trim()) || !receipt.recordedOn}>{saving ? 'Saving...' : 'Receive stock'}</PrimaryButton></div>
            </form>}
        </DialogContent></Dialog>

        <Dialog open={!!correction} onOpenChange={open => { if (!open && !saving) setCorrection(null); }}><DialogContent className="sm:max-w-md bg-card">
            <DialogHeader><DialogTitle>Edit opening stock</DialogTitle><DialogDescription>{correction?.item.name} - {correction?.balance.location.name}. The original entry stays in history.</DialogDescription></DialogHeader>
            {correction && <form onSubmit={saveCorrection} className="space-y-4">
                <p className="text-sm text-muted-foreground">Current quantity: <span className="font-semibold text-foreground">{formatQuantity(correction.balance.quantity)} {correction.item.unit.abbreviation || correction.item.unit.name}</span></p>
                <Field label="Correct quantity *"><input autoFocus type="number" required min="0" max="1000000000" step="1" disabled={saving} className={inputCls} value={correction.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setCorrection({ ...correction, quantity: e.target.value }); }} /><StockQuantityError value={correction.quantity} min={0} unchangedValue={String(correction.balance.quantity)} /></Field>
                <Field label="Correction reason *"><textarea required maxLength={500} disabled={saving} className={`${inputCls} h-24 py-2 resize-none`} value={correction.reason} onChange={e => setCorrection({ ...correction, reason: e.target.value })} placeholder="e.g. Initial counting mistake" /></Field>
                <div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setCorrection(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !correction.reason.trim() || correction.quantity === '' || Number(correction.quantity) === Number(correction.balance.quantity)}>{saving ? 'Saving...' : 'Save correction'}</PrimaryButton></div>
            </form>}
        </DialogContent></Dialog>
        <Dialog open={!!history} onOpenChange={open => { if (!open) setHistory(null); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Stock history</DialogTitle><DialogDescription>{history?.item.name} - {history?.balance.location.name}</DialogDescription></DialogHeader>
            {history?.loading ? <p role="status" className="text-sm text-muted-foreground">Loading history...</p> : history?.error ? <p role="alert" className="text-sm text-red-500">{history.error}</p> : history?.records.length ? <div className="divide-y divide-border/50">{history.records.map(record => <div key={record.id} className="py-3 space-y-1">
                <p className="text-sm font-semibold">{record.kind === 'OPENING' ? 'Opening stock' : record.kind === 'OPENING_CORRECTION' ? 'Opening stock correction' : record.kind === 'ADJUSTMENT' ? 'Stock adjustment' : record.kind === 'RECEIPT' ? 'Stock received' : record.kind === 'SUPPLIER_RETURN' ? 'Returned to supplier' : record.kind === 'ISSUE' ? 'Stock issued' : record.kind === 'RETURN' ? 'Stock returned' : record.kind === 'ISSUE_DAMAGED' ? 'Issued item damaged' : record.kind === 'ISSUE_LOST' ? 'Issued item lost' : record.kind === 'TRANSFER_OUT' ? 'Stock transferred out' : record.kind === 'TRANSFER_IN' ? 'Stock transferred in' : record.kind.replaceAll('_', ' ')}</p>
                <p className="text-sm">{(record.kind === 'OPENING_CORRECTION' || record.kind === 'ADJUSTMENT') ? `${formatQuantity(record.previousQuantity!)} to ${formatQuantity(record.correctedQuantity!)}` : formatQuantity(record.quantity)} {history.item.unit.abbreviation || history.item.unit.name}</p>
                {record.kind === 'RECEIPT' && <div className="text-xs text-muted-foreground space-y-1">
                    <p>Supplier: {record.supplierName}</p>
                    {record.purchaseOrder && <p>Purchase order: {record.purchaseOrder.number}</p>}
                    <p>Delivered: {formatQuantity(record.deliveredQuantity ?? record.quantity)} | Rejected: {formatQuantity(record.rejectedQuantity ?? '0')} | Accepted: {formatQuantity(record.quantity)}</p>
                    {record.damageReason && <p className="break-words">Damage/rejection reason: {record.damageReason}</p>}
                    <p>Received on: {new Date(record.recordedOn).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</p>
                    {record.billNumber && <p>Bill: {record.billNumber}</p>}
                    {record.billDate && <p>Bill date: {new Date(record.billDate).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</p>}
                    {record.totalCost !== null && <p>Cost: {Number(record.totalCost).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>}
                </div>}
                {record.kind === 'SUPPLIER_RETURN' && <div className="text-xs text-muted-foreground space-y-1"><p>Supplier: {record.supplierName}</p><p>Return date: {new Date(record.recordedOn).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</p></div>}
                {record.kind === 'ADJUSTMENT' && <p className="text-xs text-muted-foreground">{record.adjustmentType === 'DAMAGED' ? 'Damaged' : record.adjustmentType === 'LOST' ? 'Lost' : 'Count correction'} | Adjusted on: {new Date(record.recordedOn).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</p>}
                {(record.kind === 'TRANSFER_OUT' || record.kind === 'TRANSFER_IN') && <div className="text-xs text-muted-foreground space-y-1">
                    <p>{record.kind === 'TRANSFER_OUT' ? 'To location' : 'From location'}: {record.transferLocationName}</p>
                    <p>Transfer date: {new Date(record.recordedOn).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</p>
                </div>}
                {(record.kind === 'ISSUE_DAMAGED' || record.kind === 'ISSUE_LOST') && <div className="text-xs text-muted-foreground space-y-1"><p>Issued to: {record.issuedToName} ({recipientLabel(record.issuedToType, record.issuedToLabel)})</p><p>Recorded on: {new Date(record.recordedOn).toLocaleDateString('en-IN', {timeZone:'UTC'})}</p><p>Pending return reduced. Available stock unchanged.</p></div>}
                {(record.kind === 'ISSUE' || record.kind === 'RETURN') && <div className="text-xs text-muted-foreground space-y-1">
                    <p>{record.kind === 'RETURN' ? 'Returned by' : 'Issued to'}: {record.issuedToName} ({recipientLabel(record.issuedToType, record.issuedToLabel)})</p>
                    <p>{record.kind === 'RETURN' ? 'Return date' : 'Issue date'}: {new Date(record.recordedOn).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</p>
                    {record.kind === 'ISSUE' && record.dueOn && <p>Return due: {new Date(record.dueOn).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</p>}
                </div>}
                {!!record.attachments?.length && <div className="flex flex-wrap gap-2 py-2">{record.attachments.map((attachment, index) => <SmallButton key={index} onClick={() => setBillPreview(attachment)}><Paperclip size={12} /><span className="max-w-52 truncate">{attachment.name}</span><span className="text-muted-foreground">View</span></SmallButton>)}</div>}
                <p className="text-xs text-muted-foreground break-words">{record.notes}</p>
                <p className="text-xs text-muted-foreground">{record.createdByName} | {new Date(record.createdAt).toLocaleString('en-IN')}</p>
                {record.kind === 'OPENING' && <p className="text-xs text-muted-foreground">Stock counted on: {new Date(record.recordedOn).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</p>}
            </div>)}</div> : <p className="text-sm text-muted-foreground">No stock history found.</p>}
        </DialogContent></Dialog>

        <Dialog open={!!billPreview} onOpenChange={open => { if (!open) setBillPreview(null); }}><DialogContent className="sm:max-w-4xl bg-card max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Bill attachment</DialogTitle><DialogDescription className="break-all">{billPreview?.name}</DialogDescription></DialogHeader>
            {billPreview && <>
                {billPreview.type.startsWith('image/') ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={billPreview.url} alt={billPreview.name} className="max-h-[65vh] w-full object-contain rounded-xl" />
                    : billPreview.type === 'application/pdf' ? <iframe src={billPreview.url} title={billPreview.name} className="w-full h-[60vh] rounded-xl border border-border" />
                    : <p className="text-sm text-muted-foreground">Open or download this document to view it.</p>}
                <div className="flex justify-end gap-2">
                    <a href={billPreview.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-medium"><ExternalLink size={14} />Open document</a>
                    <a href={billPreview.url} download={billPreview.name} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-medium"><Download size={14} />Download</a>
                </div>
            </>}
        </DialogContent></Dialog>

        {supplierReturnItem && <SupplierReturnDialog item={supplierReturnItem} suppliers={suppliers} onClose={() => setSupplierReturnItem(null)} onSaved={replaceItem} />}
        {adjustment && <StockAdjustmentDialog item={adjustment.item} balance={adjustment.balance} onClose={() => setAdjustment(null)} onSaved={replaceItem} />}
        {transferItem && <TransferStockDialog item={transferItem} locations={locations} onClose={() => setTransferItem(null)} onSaved={replaceItem} />}
        {issueItem && <IssueStockDialog item={issueItem} onClose={() => setIssueItem(null)} onSaved={replaceItem} />}
        {issuedItem && <IssuedStockDialog item={issuedItem} onClose={() => setIssuedItem(null)} onSaved={replaceItem} />}
        <DeleteConfirmDialog open={!!toDelete} onOpenChange={open => { if (!open && !deleting) setToDelete(null); }} label="item" name={toDelete?.name ?? ''} loading={deleting} onConfirm={() => void remove()} />
    </>;
}
