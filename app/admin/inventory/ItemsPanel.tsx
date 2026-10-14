'use client';
import { StockHistoryTimeline } from './StockHistoryTimeline';
import { InventoryIconLabel } from './InventoryIconLabel';
import { CategoryArtwork } from './CategoryArtwork';
import { InventorySearch, InventoryFilters } from './InventoryHeaderControls';
import { useInventoryNavigation } from './useInventoryNavigation';
import { SupplierReturnDialog } from './SupplierReturnDialog';
import { StockAdjustmentDialog } from './StockAdjustmentDialog';
import { StockQuantityError } from './StockQuantityError';
import { TransferStockDialog } from './TransferStockDialog';

import { IssueStockDialog } from './IssueStockDialog';
import { IssuedStockDialog } from './IssuedStockDialog';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Boxes, Plus, Pencil, Trash2, Loader2, PackagePlus, Paperclip, ExternalLink, Download, PackageMinus, ClipboardList, ArrowRightLeft, SlidersHorizontal, Undo2, MoreHorizontal, History, ChevronDown, ChevronRight, X } from 'lucide-react';
import { PendingAttachmentChip } from '@/components/shared/PendingAttachmentChip';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
export interface HistoryRecord { purchaseOrder?: { number: string } | null; adjustmentType?: string | null; deliveredQuantity?: string | null; rejectedQuantity?: string; damageReason?: string; transferId?: string; transferLocationName?: string; issuedToType?: string; issuedToLabel?: string; issuedToName?: string; returnExpected?: boolean; dueOn?: string | null; attachments?: BillAttachment[]; id: string; kind: string; quantity: string; previousQuantity: string | null; correctedQuantity: string | null; notes: string; createdAt: string; recordedOn: string; createdByName: string; supplierName: string; billNumber: string; billDate: string | null; totalCost: string | null }
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

export default function ItemsPanel({ onSetup, navigation }: { onSetup: () => void; navigation?: React.ReactNode }) {
    const [supplierReturnItem, setSupplierReturnItem] = useState<Item | null>(null);
    const [adjustment, setAdjustment] = useState<{ item: Item; balance: Balance } | null>(null);
    const [transferItem, setTransferItem] = useState<Item | null>(null);
    const [issueItem, setIssueItem] = useState<Item | null>(null);
    const [issuedItem, setIssuedItem] = useState<Item | null>(null);
    const [receiptMore, setReceiptMore] = useState(false);
    const [panelId, setPanelId] = useState<string | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const openPanel = (id: string) => { setPanelId(id); setPanelOpen(true); };
    const headRef = useRef<HTMLDivElement>(null);
    const [panelBox, setPanelBox] = useState({ top: 0, left: 0, right: 0 });
    // The side panel starts right under the page heading's separator line, within the content column.
    useLayoutEffect(() => {
        if (!panelId || !panelOpen) return;
        const measure = () => {
            const head = headRef.current?.previousElementSibling as HTMLElement | null;
            if (!head) return;
            const r = head.getBoundingClientRect();
            setPanelBox({ top: r.bottom, left: r.left, right: Math.max(0, window.innerWidth - r.right) });
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [panelId, panelOpen]);
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
    const [filter, setFilter] = useInventoryNavigation<ItemType | ''>('itemType', ['', 'CONSUMABLE', 'RETURNABLE', 'FIXED_ASSET'], '');
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
        if (!opening.notes.trim()) { toast.error('Enter starting stock notes'); return; }
        setSaving(true);
        try {
            const { item, ...payload } = opening;
            const res = await api.post(`/admin/inventory/items/${item.id}/opening-stock`, payload);
            replaceItem(res.data.data); setOpening(null); toast.success('Starting stock recorded');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to record starting stock')); }
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
            replaceItem(res.data.data); setCorrection(null); toast.success('Starting stock corrected');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to correct starting stock')); }
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
    const showReceiptMore = receiptMore || (!!receipt && (receipt.rejectedQuantity === '' || Number(receipt.rejectedQuantity) > 0));
    const validReceiptQuantities =!!receipt && receipt.deliveredQuantity !== '' && receipt.rejectedQuantity !== '' && Number.isInteger(Number(receipt.deliveredQuantity)) && Number.isInteger(Number(receipt.rejectedQuantity)) && Number(receipt.deliveredQuantity) >= 1 && Number(receipt.deliveredQuantity) <= 1000000000 && Number(receipt.rejectedQuantity) >= 0 && acceptedReceiptQuantity >= 0;
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
    const panelItem = panelId ? items.find(i => i.id === panelId) : undefined;
    const lockedDraft =!!draft?.id && !!items.find(i => i.id === draft.id)?.balances.length;

    return <>
        <PageHeader title="Ledger & Stock" subtitle="Manage your school stock and assets." center={navigation}>
            <div className="flex flex-wrap items-center justify-end gap-3 max-w-full">
                <InventorySearch value={search} onChange={setSearch} label="Search inventory" placeholder="Search item name or code..." />
                <InventoryFilters activeCount={filter ? 1 : 0}>
                    <Field label="Item type"><ThemedSelect value={filter || 'ALL'} onChange={value => setFilter(value === 'ALL' ? '' : value as ItemType)} options={[{ value: 'ALL', label: 'All items' }, ...typeOptions]} /></Field>
                </InventoryFilters>
                <PrimaryButton disabled={loading || !!error || !ready} onClick={() => setDraft({ name: '', code: '', description: '', type: 'CONSUMABLE', categoryId: '', unitId: '', lowStockLevel: '0' })}><Plus size={14} />Add item</PrimaryButton>
            </div>
        </PageHeader>
        <div ref={headRef} className="hidden" aria-hidden="true" />
        {!loading && !error && !ready && <EmptyState icon={Boxes} title="Complete your item setup" text="Add at least one category and unit before creating items."><SecondaryButton onClick={onSetup}>Open setup</SecondaryButton></EmptyState>}
        <section className="flex-1 min-h-0 flex flex-col rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] overflow-hidden" data-admin-surface="">
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain visible-scrollbar">
            {loading ? <div role="status" className="flex justify-center items-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading inventory...</div>
                : error ? <EmptyState icon={Boxes} title="Could not load inventory" text={error}><SecondaryButton onClick={() => { setLoading(true); void load(); }}>Retry</SecondaryButton></EmptyState>
                : filtered.length === 0 ? <EmptyState icon={Boxes} title={search || filter ? 'No matching items' : 'No items added yet'} text="Add an item, then record the quantity already available at each location." />
                : <div><table className="w-full min-w-[900px] text-left text-xs [&_td]:align-top">
                    <thead className="sticky top-0 z-10 bg-card border-b border-border/60 text-muted-foreground"><tr>{['Item', 'Category', 'Type', 'Available', 'Locations', 'Status', ''].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
                    <tbody className="divide-y divide-border/50">{filtered.map(item => {
                        const quantity = total(item); const low = item.type === 'CONSUMABLE' && Number(item.lowStockLevel) > 0 && quantity <= Number(item.lowStockLevel);
                        return <tr key={item.id} onClick={() => openPanel(item.id)} className="cursor-pointer hover:bg-muted/30 [&>td]:align-top">
                            <td className="px-4 py-3"><p className="text-sm font-medium">{item.name}</p><p className="text-muted-foreground mt-1">{item.code}</p></td>
                            <td className="px-4 py-3"><div className="flex items-center gap-2"><CategoryArtwork name={item.category.name} size={24} /><span>{item.category.name}</span></div></td><td className="px-4 py-3">{typeOptions.find(o => o.value === item.type)?.label}</td>
                            <td className="px-4 py-3 whitespace-nowrap font-semibold">{formatQuantity(quantity)} <span className="font-normal text-muted-foreground">{item.unit.abbreviation || item.unit.name}</span></td>
                            <td className="px-4 py-3 text-muted-foreground">{item.balances.length ? <span className="flex flex-col gap-1">{item.balances.map(b => <InventoryIconLabel key={b.id} kind="locations" name={b.location.name}>{`${b.location.name}: ${formatQuantity(b.quantity)}`}</InventoryIconLabel>)}</span> : 'No stock recorded'}</td>
                            <td className="px-4 py-3 whitespace-nowrap"><Pill tone={low ? 'amber' : quantity > 0 ? 'green' : item.type === 'CONSUMABLE' ? 'red' : 'muted'}>{low ? 'Low stock' : quantity > 0 ? 'In stock' : 'No stock'}</Pill></td>
                            <td className="px-4 py-3 text-right"><SmallButton aria-label={`Manage ${item.name}`} onClick={e => { e.stopPropagation(); openPanel(item.id); }}>Manage<ChevronRight size={13} /></SmallButton></td>
                        </tr>;
                    })}</tbody>
                </table></div>}
            </div>
        </section>
        <AnimatePresence>{panelOpen && panelItem && (() => {
            const item = panelItem; const quantity = total(item); const unitLabel = item.unit.abbreviation || item.unit.name;
            const low = item.type === 'CONSUMABLE' && Number(item.lowStockLevel) > 0 && quantity <= Number(item.lowStockLevel);
            const hasStock = item.balances.some(b => Number(b.quantity) > 0);
            const rowBtn = 'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left hover:bg-muted/60 disabled:opacity-40 disabled:pointer-events-none';
            return <motion.div key="item-panel" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1 }} transition={{ duration: 0.25 }} className="fixed bottom-0 z-40 flex justify-end overflow-hidden" style={{ top: panelBox.top, left: panelBox.left, right: panelBox.right }}>
                <motion.div className="absolute inset-0 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={() => setPanelOpen(false)} />
                <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', ease: 'easeOut', duration: 0.25 }} role="complementary" aria-label={`${item.name} details`} className="relative h-full w-full sm:w-[420px] bg-card border-l border-border/60 shadow-xl flex flex-col">
                    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/60">
                        <div className="min-w-0"><p className="text-base font-semibold break-words">{item.name}</p><div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2"><span>{item.code}</span><InventoryIconLabel kind="categories" name={item.category.name} /><span>{typeOptions.find(o => o.value === item.type)?.label}</span></div></div>
                        <button type="button" aria-label="Close" onClick={() => setPanelOpen(false)} className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={16} /></button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
                        <div className="flex items-end justify-between gap-3">
                            <div><p className="text-xs text-muted-foreground">Available</p><p className="text-3xl font-bold">{formatQuantity(quantity)} <span className="text-base font-normal text-muted-foreground">{unitLabel}</span></p></div>
                            <Pill tone={low ? 'amber' : quantity > 0 ? 'green' : item.type === 'CONSUMABLE' ? 'red' : 'muted'}>{low ? 'Low stock' : quantity > 0 ? 'In stock' : 'No stock'}</Pill>
                        </div>
                        {item.type === 'CONSUMABLE' && Number(item.lowStockLevel) > 0 && <p className="text-xs text-muted-foreground -mt-3">Alert when stock is {formatQuantity(item.lowStockLevel)} or below.</p>}
                        <div className="grid grid-cols-2 gap-2">
                            <PrimaryButton disabled={!hasStock} onClick={() => setIssueItem(item)}><PackageMinus size={14} />Give out stock</PrimaryButton>
                            <PrimaryButton disabled={!locations.length || !suppliers.length} onClick={() => { setReceiptMore(false); setReceipt({ files: [], item, requestId: crypto.randomUUID(), supplierId: '', locationId: '', deliveredQuantity: '', rejectedQuantity: '0', damageReason: '', recordedOn: today(), billNumber: '', billDate: '', totalCost: '', notes: '' }); }}><PackagePlus size={14} />Add stock</PrimaryButton>
                        </div>
                        <section>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Where it is</p>
                            {item.balances.length ? <div className="rounded-xl border border-border/60 divide-y divide-border/50">{item.balances.map(b => <div key={b.id} className="px-3 py-2.5">
                                <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium"><InventoryIconLabel kind="locations" name={b.location.name} /></span><span className="text-sm font-semibold">{formatQuantity(b.quantity)} <span className="font-normal text-muted-foreground">{unitLabel}</span></span></div>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    <SmallButton onClick={() => void showHistory(item, b)}><History size={13} />History</SmallButton>
                                    <SmallButton onClick={() => setAdjustment({ item, balance: b })}><SlidersHorizontal size={13} />Correct stock count</SmallButton>
                                    {canCorrect(item, b) && <SmallButton onClick={() => setCorrection({ item, balance: b, quantity: String(b.quantity), reason: '' })}><Pencil size={13} />Edit starting stock</SmallButton>}
                                </div>
                            </div>)}</div> : <p className="text-sm text-muted-foreground">No stock recorded yet. Use Starting stock below to record what is already available.</p>}
                        </section>
                        <section>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">More actions</p>
                            <button type="button" className={rowBtn} disabled={locations.length < 2 || !hasStock} onClick={() => setTransferItem(item)}><ArrowRightLeft size={14} />Move stock</button>
                            <button type="button" className={rowBtn} onClick={() => setIssuedItem(item)}><ClipboardList size={14} />Given out items</button>
                            <button type="button" className={rowBtn} disabled={!locations.some(l => !item.balances.some(b => b.locationId === l.id))} onClick={() => setOpening({ item, locationId: '', quantity: '', recordedOn: today(), notes: '' })}><PackagePlus size={14} />Starting stock</button>
                            <button type="button" className={rowBtn} disabled={!suppliers.length || !hasStock} onClick={() => setSupplierReturnItem(item)}><Undo2 size={14} />Return to supplier</button>
                        </section>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border/60">
                        <SecondaryButton onClick={() => setDraft({ id: item.id, name: item.name, code: item.code, description: item.description, type: item.type, categoryId: item.categoryId, unitId: item.unitId, lowStockLevel: String(item.lowStockLevel) })}><Pencil size={13} />Edit item</SecondaryButton>
                        <button type="button" disabled={item.balances.length > 0} title={item.balances.length > 0 ? 'Items with recorded stock cannot be deleted' : undefined} onClick={() => setToDelete(item)} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:pointer-events-none"><Trash2 size={13} />Delete item</button>
                    </div>
                </motion.aside>
            </motion.div>;
        })()}</AnimatePresence>
        {!loading && !error && ready && locations.length === 0 &&<p className="text-xs text-muted-foreground">Add a location in Setup to record starting stock. <button type="button" className="text-primary underline" onClick={onSetup}>Open setup</button></p>}
        {!loading && !error && suppliers.length === 0 && <p className="text-xs text-muted-foreground">Add a supplier in Setup to receive purchased stock. <button type="button" className="text-primary underline" onClick={onSetup}>Open setup</button></p>}
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0 pr-6"><DialogTitle>{draft?.id ? 'Edit item' : 'New item'}</DialogTitle><DialogDescription>Choose how this school item is classified and counted.</DialogDescription></DialogHeader>
            {draft && <form onSubmit={saveItem} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
                <Field label="Item name"><input autoFocus required maxLength={120} disabled={saving} className={inputCls} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. A4 Paper" /></Field>
                <Field label="Item code / Serial no. (optional)" hint="Leave blank to generate a code automatically."><input maxLength={40} disabled={saving} className={inputCls} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="e.g. PAPER-A4" /></Field>
                <fieldset disabled={saving} className="grid grid-cols-2 gap-4"><Field label="Category"><ThemedSelect value={draft.categoryId} options={categories.map(c => ({ value: c.id, label: <InventoryIconLabel kind="categories" name={c.name} /> }))} onChange={categoryId => setDraft({ ...draft, categoryId })} placeholder="Select category" /></Field><Field label="Unit" hint={lockedDraft ? 'Unit is fixed after recording stock.' : undefined}><fieldset disabled={lockedDraft}><ThemedSelect value={draft.unitId} options={units.map(u => ({ value: u.id, label: u.name }))} onChange={unitId => setDraft({ ...draft, unitId })} placeholder="Select unit" /></fieldset></Field></fieldset>
                <Field label="Item type" hint={lockedDraft ? 'Type is fixed after recording stock.' : 'Consumables are used up; equipment is returned; fixed assets are long-term school property.'}><fieldset disabled={saving || lockedDraft}><ThemedSelect value={draft.type} options={typeOptions} onChange={type => setDraft({ ...draft, type, lowStockLevel: type === 'CONSUMABLE' ? draft.lowStockLevel : '0' })} /></fieldset></Field>
                {draft.type === 'CONSUMABLE' && <Field label="Low stock alert at" hint="Alert when total stock reaches this quantity or below. Set 0 to disable."><input type="number" min="0" max="1000000000" step="1" required disabled={saving} className={inputCls} value={draft.lowStockLevel} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setDraft({ ...draft, lowStockLevel: e.target.value }); }} /><StockQuantityError value={draft.lowStockLevel} min={0} /></Field>}
                <Field label="Description (optional)"><textarea maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field>
                </div>
                <div className="shrink-0 flex justify-end gap-2 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !draft.name.trim() || !draft.categoryId || !draft.unitId}>{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Add item'}</PrimaryButton></div>
            </form>}
        </DialogContent></Dialog>
        <Dialog open={!!opening} onOpenChange={open => { if (!open && !saving) setOpening(null); }}><DialogContent className="sm:max-w-md bg-card max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0 pr-6 "><DialogTitle>Starting stock</DialogTitle><DialogDescription>{opening?.item.name} - record stock already available before using inventory. Each location can be recorded once.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

            {opening && <form onSubmit={saveOpening} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

                <Field label="Location"><fieldset disabled={saving}><ThemedSelect value={opening.locationId} options={availableLocations.map(l => ({ value: l.id, label: <InventoryIconLabel kind="locations" name={l.name} /> }))} onChange={locationId => setOpening({ ...opening, locationId })} placeholder="Select location" /></fieldset></Field>
                <Field label={`Quantity (${opening.item.unit.abbreviation || opening.item.unit.name})`} hint="Enter a whole number."><input autoFocus type="number" required min="1" max="1000000000" step="1" disabled={saving} className={inputCls} value={opening.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setOpening({ ...opening, quantity: e.target.value }); }} /><StockQuantityError value={opening.quantity} /></Field>
                <Field label="Stock counted on"><input type="date" required disabled={saving} className={inputCls} value={opening.recordedOn} onChange={e => setOpening({ ...opening, recordedOn: e.target.value })} /></Field>
                <Field label="Notes *"><textarea required maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={opening.notes} onChange={e => setOpening({ ...opening, notes: e.target.value })} /></Field>
                
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setOpening(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !opening.locationId || !opening.quantity || !opening.notes.trim()}>{saving ? 'Saving...' : 'Record starting stock'}</PrimaryButton></div>
            </form>}
        
</div>
</DialogContent></Dialog>
        <Dialog open={!!receipt} onOpenChange={open => { if (!open && !saving) setReceipt(null); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0 pr-6 "><DialogTitle>Add stock</DialogTitle><DialogDescription>{receipt?.item.name} - add newly received stock to a school location.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

            {receipt && <form onSubmit={saveReceipt} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

                <fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Supplier *"><ThemedSelect value={receipt.supplierId} options={suppliers.map(s => ({ value: s.id, label: <InventoryIconLabel kind="suppliers" name={s.name} id={s.id} /> }))} onChange={supplierId => setReceipt({ ...receipt, supplierId })} placeholder="Select supplier" /></Field>
                    <Field label="Location *"><ThemedSelect value={receipt.locationId} options={locations.map(l => ({ value: l.id, label: <InventoryIconLabel kind="locations" name={l.name} /> }))} onChange={locationId => setReceipt({ ...receipt, locationId })} placeholder="Select location" /></Field>
                </fieldset>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={`Delivered quantity (${receipt.item.unit.abbreviation || receipt.item.unit.name}) *`}><input autoFocus type="number" min="1" step="1" max="1000000000" required disabled={saving} className={inputCls} value={receipt.deliveredQuantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setReceipt({ ...receipt, deliveredQuantity: e.target.value }); }} /><StockQuantityError value={receipt.deliveredQuantity} /></Field>
                    <Field label="Received on *"><input type="date" required disabled={saving} className={inputCls} value={receipt.recordedOn} onChange={e => setReceipt({ ...receipt, recordedOn: e.target.value })} /></Field>
                </div>
                <button type="button" onClick={() => setReceiptMore(v => !v)} aria-expanded={showReceiptMore} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    <ChevronDown size={14} className={`transition-transform ${showReceiptMore ? 'rotate-180' : ''}`} />{showReceiptMore ? 'Hide extra details' : 'Add more details (damaged items, bill, cost, notes)'}
                </button>
                {showReceiptMore && <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 p-3" data-admin-surface="">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Damaged/rejected quantity"><input type="number" min="0" step="1" max={Number(receipt.deliveredQuantity) || 1000000000} required disabled={saving} className={inputCls} value={receipt.rejectedQuantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setReceipt({ ...receipt, rejectedQuantity: e.target.value, damageReason: Number(e.target.value) > 0 ? receipt.damageReason : '' }); }} /><StockQuantityError value={receipt.rejectedQuantity} min={0} max={receipt.deliveredQuantity ? Number(receipt.deliveredQuantity) : undefined} />{receipt.rejectedQuantity === '' && <p role="alert" className="mt-1 text-xs text-red-500">Enter 0 if no items were rejected.</p>}</Field>
                </div>
                {validReceiptQuantities && <div className="rounded-xl border border-border/50 bg-muted/30 p-3" data-admin-surface="">
                    <p className="text-sm font-semibold">Accepted quantity: {formatQuantity(acceptedReceiptQuantity)} {receipt.item.unit.abbreviation || receipt.item.unit.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{acceptedReceiptQuantity > 0 ? 'Only accepted items will be added to available stock.' : 'All items were rejected. Available stock will stay the same.'}</p>
                </div>}
                {Number(receipt.rejectedQuantity) > 0 && <Field label="Damage/rejection reason *" hint="Rejected items are not kept in school stock."><textarea required maxLength={500} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={receipt.damageReason} onChange={e => setReceipt({ ...receipt, damageReason: e.target.value })} placeholder="e.g. 3 pens arrived broken and were rejected" /></Field>}
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
                </div>}
                
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setReceipt(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !receipt.supplierId || !receipt.locationId || !validReceiptQuantities || (Number(receipt.rejectedQuantity) > 0 && !receipt.damageReason.trim()) || !receipt.recordedOn}>{saving ? 'Saving...' : 'Add stock'}</PrimaryButton></div>
            </form>}
        
</div>
</DialogContent></Dialog>

        <Dialog open={!!correction} onOpenChange={open => { if (!open && !saving) setCorrection(null); }}><DialogContent className="sm:max-w-md bg-card max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0 pr-6 "><DialogTitle>Edit starting stock</DialogTitle><DialogDescription>{correction?.item.name} - {correction?.balance.location.name}. The original entry stays in history.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

            {correction && <form onSubmit={saveCorrection} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

                <p className="text-sm text-muted-foreground">Current quantity: <span className="font-semibold text-foreground">{formatQuantity(correction.balance.quantity)} {correction.item.unit.abbreviation || correction.item.unit.name}</span></p>
                <Field label="Correct quantity *"><input autoFocus type="number" required min="0" max="1000000000" step="1" disabled={saving} className={inputCls} value={correction.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setCorrection({ ...correction, quantity: e.target.value }); }} /><StockQuantityError value={correction.quantity} min={0} unchangedValue={String(correction.balance.quantity)} /></Field>
                <Field label="Correction reason *"><textarea required maxLength={500} disabled={saving} className={`${inputCls} h-24 py-2 resize-none`} value={correction.reason} onChange={e => setCorrection({ ...correction, reason: e.target.value })} placeholder="e.g. Initial counting mistake" /></Field>
                
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setCorrection(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !correction.reason.trim() || correction.quantity === '' || Number(correction.quantity) === Number(correction.balance.quantity)}>{saving ? 'Saving...' : 'Save correction'}</PrimaryButton></div>
            </form>}
        
</div>
</DialogContent></Dialog>
        <Dialog open={!!history} onOpenChange={open => { if (!open) setHistory(null); }}><DialogContent className="sm:max-w-2xl bg-card max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0 pr-6 "><DialogTitle>Stock history</DialogTitle><DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>{history?.item.name} ({history?.item.code})</span>{history && <InventoryIconLabel kind="locations" name={history.balance.location.name} />}</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

            {history?.loading ? <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading history...</div> : history?.error ? <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">{history.error}</p> : history?.records.length ? <StockHistoryTimeline records={history.records} unit={history.item.unit.abbreviation || history.item.unit.name} suppliers={suppliers} onAttachment={setBillPreview} /> : <div className="py-12 text-center space-y-2"><History size={24} className="mx-auto text-muted-foreground" /><p className="text-sm font-medium">No stock history found</p><p className="text-xs text-muted-foreground">Recorded stock activity will appear here.</p></div>}
        
</div>
</DialogContent></Dialog>

        <Dialog open={!!billPreview} onOpenChange={open => { if (!open) setBillPreview(null); }}><DialogContent className="sm:max-w-4xl bg-card max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0 pr-6 "><DialogTitle>Bill attachment</DialogTitle><DialogDescription className="break-all">{billPreview?.name}</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

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
        
</div>
</DialogContent></Dialog>

        {supplierReturnItem && <SupplierReturnDialog item={supplierReturnItem} suppliers={suppliers} onClose={() => setSupplierReturnItem(null)} onSaved={replaceItem} />}
        {adjustment && <StockAdjustmentDialog item={adjustment.item} balance={adjustment.balance} onClose={() => setAdjustment(null)} onSaved={replaceItem} />}
        {transferItem && <TransferStockDialog item={transferItem} locations={locations} onClose={() => setTransferItem(null)} onSaved={replaceItem} />}
        {issueItem && <IssueStockDialog item={issueItem} onClose={() => setIssueItem(null)} onSaved={replaceItem} />}
        {issuedItem && <IssuedStockDialog item={issuedItem} onClose={() => setIssuedItem(null)} onSaved={replaceItem} />}
        <DeleteConfirmDialog open={!!toDelete} onOpenChange={open => { if (!open && !deleting) setToDelete(null); }} label="item" name={toDelete?.name ?? ''} loading={deleting} onConfirm={() => void remove()} />
    </>;
}
