'use client';
import { inventoryDateTime } from './inventory-date-time';
import { InventoryIconLabel } from './InventoryIconLabel';
import { InventorySearch } from './InventoryHeaderControls';
import { useCallback, useEffect, useState } from 'react';
import { ShoppingCart, Download, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/authStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, SmallButton, Field, inputCls, ThemedSelect, Pill } from '@/app/admin/payroll/_components/ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PurchaseTimeline, orderSteps } from './PurchaseTimeline';
import { orderTone } from './inventoryStatus';
import OrderDraftDialog from './OrderDraftDialog';
import OrderReceiveDialog from './OrderReceiveDialog';
import { orderDate, orderLabels, orderMoney, type PurchaseOrder } from './purchase-order.types';

export default function PurchaseOrdersPanel({ banner, navigation, onRequests, initialOrderId }: { banner?: React.ReactNode; initialOrderId?: string | null; navigation: React.ReactNode; onRequests: () => void }) {
    const user = useAuthStore(s => s.user);
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [count, setCount] = useState(0);
    const [search, setSearch] = useState('');
    const [detail, setDetail] = useState<PurchaseOrder | null>(null);
    const [editing, setEditing] = useState<PurchaseOrder | null>(null);
    const [receiving, setReceiving] = useState<{ order: PurchaseOrder; index: number } | null>(null);
    const [review, setReview] = useState<{ order: PurchaseOrder; decision: string; reason: string } | null>(null);
    const [closing, setClosing] = useState<{ order: PurchaseOrder; reason: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState('');
    const load = useCallback((signal?: AbortSignal) => api.get('/admin/inventory/purchase-orders', { signal, params: { page } }).then(res => { if (!signal?.aborted) { setOrders(res.data.data); setCount(res.data.count); setError(''); } }).catch(err => { if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load purchase orders')); }).finally(() => { if (!signal?.aborted) setLoading(false); }), [page]);
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
    useEffect(() => {
        if (!initialOrderId) return;
        const controller = new AbortController();
        api.get('/admin/inventory/purchase-orders/' + initialOrderId, { signal: controller.signal }).then(res => { if (!controller.signal.aborted) setDetail(res.data.data); }).catch(err => { if (!controller.signal.aborted) toast.error(getErrorMessage(err, 'Could not open order')); });
        return () => controller.abort();
    }, [initialOrderId]);
    const reviewOrder = async (event: React.FormEvent) => {
        event.preventDefault(); if (!review || saving || (review.decision === 'REJECTED' && !review.reason.trim())) return;
        setSaving(true);
        try { await api.post(`/admin/inventory/purchase-orders/${review.order.id}/review`, { revision: review.order.revision, decision: review.decision, reason: review.reason.trim() }); setReview(null); toast.success('Order reviewed'); await load(); }
        catch (err) { toast.error(getErrorMessage(err, 'Failed to review order')); }
        finally { setSaving(false); }
    };
    const closeOrder = async (event: React.FormEvent) => {
        event.preventDefault(); if (!closing || saving || !closing.reason.trim()) return;
        setSaving(true);
        try { await api.post(`/admin/inventory/purchase-orders/${closing.order.id}/close`, { revision: closing.order.revision, reason: closing.reason.trim() }); setClosing(null); setDetail(null); toast.success('Remaining quantities cancelled. Order closed.'); await load(); }
        catch (err) { toast.error(getErrorMessage(err, 'Failed to close order')); }
        finally { setSaving(false); }
    };
    const download = async (order: PurchaseOrder) => {
        if (downloading) return;
        setDownloading(order.id);
        try { const res = await api.get(`/admin/inventory/purchase-orders/${order.id}/pdf`, { responseType: 'blob' }); const url = URL.createObjectURL(res.data); const link = document.createElement('a'); link.href = url; link.download = `${order.number}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not download purchase order')); }
        finally { setDownloading(''); }
    };
    const saved = () => { setEditing(null); setReceiving(null); setDetail(null); void load(); };
    const filtered = orders.filter(order => `${order.number} ${order.supplierSnapshot.name} ${order.lines.map(line => line.name).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
    return <>
        <PageHeader title="Purchases" subtitle="Approve supplier orders and track deliveries against them."><div className="flex flex-wrap items-center gap-3"><InventorySearch value={search} onChange={setSearch} label="Search orders on this page" placeholder="Search orders on this page..." />{navigation}<PrimaryButton onClick={onRequests}>Create from request</PrimaryButton></div></PageHeader>
        {banner}
        <section className="flex-1 min-h-0 flex flex-col rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] overflow-hidden" data-admin-surface=""><div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border/50"><ShoppingCart size={16} className="text-primary" /><h2 className="text-sm font-semibold">Purchase orders</h2><span className="text-xs text-muted-foreground">({count})</span></div>
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain visible-scrollbar">
            {loading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading orders...</p> : error ? <EmptyState icon={ShoppingCart} title="Could not load orders" text={error}><SecondaryButton onClick={() => void load()}>Retry</SecondaryButton></EmptyState> : !filtered.length ? <EmptyState icon={ShoppingCart} title="No purchase orders" text="Create an order from an approved purchase request." /> : <div><table className="w-full min-w-[750px] text-left text-xs [&_td]:align-top"><thead className="sticky top-0 z-10 bg-card border-b border-border/60 text-muted-foreground"><tr>{['Order', 'Supplier', 'Expected delivery', 'Total', 'Status', 'Actions'].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/50">{filtered.map(order => <tr key={order.id} className="hover:bg-muted/30"><td className="px-4 py-3 font-semibold whitespace-nowrap">{order.number}</td><td className="px-4 py-3">{<InventoryIconLabel kind="suppliers" id={order.supplierId} name={order.supplierSnapshot.name} />}</td><td className="px-4 py-3 whitespace-nowrap">{orderDate(order.expectedOn)}<p className="mt-1 text-[11px] text-muted-foreground whitespace-normal">Placed: {inventoryDateTime(order.events[0]?.at)}</p></td><td className="px-4 py-3 whitespace-nowrap">{orderMoney(order.total)}</td><td className="px-4 py-3 whitespace-nowrap"><Pill tone={orderTone(order.status)}>{orderLabels[order.status]}</Pill></td><td className="px-4 py-3">{(() => {
                const canEdit = ['PENDING', 'REJECTED'].includes(order.status) && (user?.role === 'ADMIN' || order.createdById === user?.id);
                const canReview = order.status === 'PENDING' && user?.role === 'ADMIN';
                const canReceive = ['APPROVED', 'PARTIALLY_RECEIVED'].includes(order.status);
                const hasPdf = !['PENDING', 'REJECTED'].includes(order.status);
                const main = canReview ? 'review' : canReceive ? 'receive' : canEdit && order.status === 'REJECTED' ? 'edit' : 'view';
                return <div className="flex items-center gap-1.5">
                    {main === 'review' && <SmallButton onClick={() => setReview({ order, decision: 'APPROVED', reason: '' })}>Review</SmallButton>}
                    {main === 'receive' && <SmallButton onClick={() => setDetail(order)}>Add stock</SmallButton>}
                    {main === 'edit' && <SmallButton onClick={() => setEditing(order)}>Edit</SmallButton>}
                    {main === 'view' && <SmallButton onClick={() => setDetail(order)}>View</SmallButton>}
                    {(main !== 'view' || (canEdit && main !== 'edit') || canReview || hasPdf) && <DropdownMenu>
                        <DropdownMenuTrigger asChild><SmallButton aria-label="More actions"><MoreHorizontal size={14} /></SmallButton></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            {main !== 'view' && <DropdownMenuItem onClick={() => setDetail(order)}>View details</DropdownMenuItem>}
                            {canEdit && main !== 'edit' && <DropdownMenuItem onClick={() => setEditing(order)}>Edit</DropdownMenuItem>}
                            {canReview && main !== 'review' && <DropdownMenuItem onClick={() => setReview({ order, decision: 'APPROVED', reason: '' })}>Review</DropdownMenuItem>}
                            {hasPdf && <DropdownMenuItem disabled={!!downloading} onClick={() => void download(order)}><Download size={13} className="mr-2" />{downloading === order.id ? 'Downloading...' : 'Download PDF'}</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>}
                </div>;
            })()}</td></tr>)}</tbody></table></div>}
            </div>
            {count > 50 && <div className="shrink-0 flex items-center justify-end gap-3 px-4 py-3 border-t border-border/50"><SecondaryButton disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(page - 1); }}>Previous</SecondaryButton><span className="text-xs">Page {page} of {Math.ceil(count / 50)}</span><SecondaryButton disabled={page * 50 >= count || loading} onClick={() => { setLoading(true); setPage(page + 1); }}>Next</SecondaryButton></div>}
        </section>
        <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="sm:max-w-2xl bg-card max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6 "><DialogTitle>{detail?.number}</DialogTitle><DialogDescription>{detail && `${detail.supplierSnapshot.name} - ${orderLabels[detail.status]}`}</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
{detail && <div className="space-y-4"><div className="rounded-xl border border-border/50 bg-muted/20 px-2 py-3" data-admin-surface=""><PurchaseTimeline steps={orderSteps(detail.status, detail.events)} /></div><div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2"><InventoryIconLabel kind="suppliers" id={detail.supplierId} name={detail.supplierSnapshot.name} /><InventoryIconLabel kind="locations" name={detail.locationName} /><span>Expected: {orderDate(detail.expectedOn)}</span></div>{detail.lines.map((line, index) => <div key={index} className="rounded-xl border border-border/50 p-3 space-y-2"><p className="text-sm font-semibold">{line.name} ({line.code})</p>{line.name !== line.requestedName && <p className="text-xs text-muted-foreground">Requested as: {line.requestedName}</p>}<p className="text-xs">Ordered: {line.quantity} {line.unit} | Accepted: {line.accepted} | Pending: {line.pending}{line.cancelledQuantity > 0 && ` | Cancelled: ${line.cancelledQuantity}`}</p><p className="text-xs text-muted-foreground">Delivered: {line.delivered} | Rejected: {line.rejected}<br />Unit price: {orderMoney(line.unitPrice)} | Tax: {line.taxPercent}% | Total: {orderMoney(line.total)}</p>{line.pending > 0 && ['APPROVED', 'PARTIALLY_RECEIVED'].includes(detail.status) && <SmallButton onClick={() => { setReceiving({ order: detail, index }); setDetail(null); }}>Add this item to stock</SmallButton>}</div>)}<p className="text-sm font-semibold">Order total: {orderMoney(detail.total)}</p>{detail.instructions && <p className="text-xs whitespace-pre-wrap break-words">Instructions: {detail.instructions}</p>}
            {detail.receipts.length > 0 && <div className="border-t border-border/50 pt-3 space-y-3"><h3 className="text-sm font-semibold">Deliveries</h3>{detail.receipts.map(receipt => <div key={receipt.id} className="text-xs space-y-1"><p className="font-semibold">{detail.lines[receipt.purchaseOrderLine]?.name} - {orderDate(receipt.recordedOn)}</p><p className="text-muted-foreground">Recorded: {inventoryDateTime(receipt.createdAt)}</p><p>Delivered: {receipt.deliveredQuantity} | Accepted: {receipt.quantity} | Rejected: {receipt.rejectedQuantity}</p>{receipt.damageReason && <p className="text-muted-foreground">{receipt.damageReason}</p>}{receipt.billNumber && <p>Bill: {receipt.billNumber}</p>}{receipt.notes && <p className="whitespace-pre-wrap break-words">{receipt.notes}</p>}{receipt.attachments.map((file, i) => <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" className="block text-primary underline break-words">{file.name}</a>)}</div>)}</div>}
            <div className="border-t border-border/50 pt-3 space-y-2"><h3 className="text-sm font-semibold">History</h3>{detail.events.map((event, index) => <div key={index} className="text-xs"><p>{orderLabels[event.action] || event.action} - {event.actorRole === 'ADMIN' ? 'Admin' : 'Subadmin'} - {inventoryDateTime(event.at)}</p>{event.reason && <p className="text-muted-foreground whitespace-pre-wrap break-words">{event.reason}</p>}</div>)}</div>
            {user?.role === 'ADMIN' && ['APPROVED', 'PARTIALLY_RECEIVED'].includes(detail.status) && <SecondaryButton onClick={() => { setClosing({ order: detail, reason: '' }); setDetail(null); }}>Cancel remaining quantity</SecondaryButton>}
        </div>}
</div>
</DialogContent></Dialog>
        {editing && <OrderDraftDialog order={editing} request={{ id: editing.purchaseRequestId, requiredOn: editing.expectedOn, lines: editing.lines }} onClose={() => setEditing(null)} onSaved={saved} />}
        {receiving && <OrderReceiveDialog {...receiving} onClose={() => setReceiving(null)} onSaved={saved} />}
        <Dialog open={!!review} onOpenChange={open => { if (!open && !saving) setReview(null); }}><DialogContent className="sm:max-w-md bg-card max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6 "><DialogTitle>Review purchase order</DialogTitle><DialogDescription>{review && `${review.order.number} - ${orderMoney(review.order.total)}`}</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
{review && <form onSubmit={reviewOrder} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
<fieldset disabled={saving}><Field label="Decision"><ThemedSelect value={review.decision} onChange={decision => setReview({ ...review, decision })} options={[{ value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }]} /></Field></fieldset><Field label={review.decision === 'REJECTED' ? 'Reason *' : 'Notes (optional)'}><textarea required={review.decision === 'REJECTED'} disabled={saving} maxLength={1000} className={`${inputCls} h-20 py-2 resize-none`} value={review.reason} onChange={e => setReview({ ...review, reason: e.target.value })} /></Field>
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setReview(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || (review.decision === 'REJECTED' && !review.reason.trim())}>{saving ? 'Saving...' : 'Confirm decision'}</PrimaryButton></div></form>}
</div>
</DialogContent></Dialog>
        <Dialog open={!!closing} onOpenChange={open => { if (!open && !saving) setClosing(null); }}><DialogContent className="sm:max-w-md bg-card max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6 "><DialogTitle>Cancel remaining quantity</DialogTitle><DialogDescription>{closing?.order.number} - pending quantities will be cancelled. Received stock stays unchanged.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
{closing && <form onSubmit={closeOrder} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
<Field label="Reason *"><textarea required disabled={saving} maxLength={1000} className={`${inputCls} h-20 py-2 resize-none`} value={closing.reason} onChange={e => setClosing({ ...closing, reason: e.target.value })} /></Field>
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setClosing(null)}>Back</SecondaryButton><PrimaryButton type="submit" disabled={saving || !closing.reason.trim()}>{saving ? 'Saving...' : 'Cancel remaining and close'}</PrimaryButton></div></form>}
</div>
</DialogContent></Dialog>
    </>;
}
