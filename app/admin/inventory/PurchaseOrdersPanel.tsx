'use client';
import { useCallback, useEffect, useState } from 'react';
import { ShoppingCart, Search, Download } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/authStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, SmallButton, Field, inputCls, ThemedSelect, Pill } from '@/app/admin/payroll/_components/ui';
import OrderDraftDialog from './OrderDraftDialog';
import OrderReceiveDialog from './OrderReceiveDialog';
import { orderDate, orderLabels, orderMoney, type PurchaseOrder } from './purchase-order.types';

export default function PurchaseOrdersPanel({ navigation, onRequests, initialOrderId }: { initialOrderId?: string | null; navigation: React.ReactNode; onRequests: () => void }) {
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
        <PageHeader title="Purchases" subtitle="Approve supplier orders and track deliveries against them."><div className="flex flex-wrap items-center gap-3"><div className="relative w-60"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search orders on this page" className="w-full h-8 pl-8 pr-3 rounded-full text-xs bg-muted/50 border border-border/50" placeholder="Search orders on this page..." value={search} onChange={e => setSearch(e.target.value)} /></div>{navigation}<PrimaryButton onClick={onRequests}>Create from request</PrimaryButton></div></PageHeader>
        <section className="rounded-2xl border border-border/60 bg-card overflow-hidden"><div className="flex items-center gap-2 px-4 py-3 border-b border-border/50"><ShoppingCart size={16} className="text-primary" /><h2 className="text-sm font-semibold">Purchase orders</h2><span className="text-xs text-muted-foreground">({count})</span></div>
            {loading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading orders...</p> : error ? <EmptyState icon={ShoppingCart} title="Could not load orders" text={error}><SecondaryButton onClick={() => void load()}>Retry</SecondaryButton></EmptyState> : !filtered.length ? <EmptyState icon={ShoppingCart} title="No purchase orders" text="Create an order from an approved purchase request." /> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-muted-foreground"><tr>{['Order', 'Supplier', 'Expected delivery', 'Total', 'Status', 'Actions'].map(label => <th key={label} className="px-4 py-3 text-left font-medium">{label}</th>)}</tr></thead><tbody>{filtered.map(order => <tr key={order.id} className="border-t border-border/50"><td className="px-4 py-3 font-semibold whitespace-nowrap">{order.number}</td><td className="px-4 py-3">{order.supplierSnapshot.name}</td><td className="px-4 py-3 whitespace-nowrap">{orderDate(order.expectedOn)}</td><td className="px-4 py-3 whitespace-nowrap">{orderMoney(order.total)}</td><td className="px-4 py-3 whitespace-nowrap"><Pill tone={['APPROVED', 'COMPLETED'].includes(order.status) ? 'green' : order.status === 'REJECTED' ? 'red' : 'amber'}>{orderLabels[order.status]}</Pill></td><td className="px-4 py-3"><div className="flex gap-1.5 flex-wrap"><SmallButton onClick={() => setDetail(order)}>View</SmallButton>{['PENDING', 'REJECTED'].includes(order.status) && (user?.role === 'ADMIN' || order.createdById === user?.id) && <SmallButton onClick={() => setEditing(order)}>Edit</SmallButton>}{order.status === 'PENDING' && user?.role === 'ADMIN' && <SmallButton onClick={() => setReview({ order, decision: 'APPROVED', reason: '' })}>Review</SmallButton>}{!['PENDING', 'REJECTED'].includes(order.status) && <SmallButton disabled={!!downloading} onClick={() => void download(order)}><Download size={12} />{downloading === order.id ? 'Downloading...' : 'PDF'}</SmallButton>}{['APPROVED', 'PARTIALLY_RECEIVED'].includes(order.status) && <SmallButton onClick={() => setDetail(order)}>Receive stock</SmallButton>}</div></td></tr>)}</tbody></table></div>}
            {count > 50 && <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-border/50"><SecondaryButton disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(page - 1); }}>Previous</SecondaryButton><span className="text-xs">Page {page} of {Math.ceil(count / 50)}</span><SecondaryButton disabled={page * 50 >= count || loading} onClick={() => { setLoading(true); setPage(page + 1); }}>Next</SecondaryButton></div>}
        </section>
        <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="sm:max-w-2xl bg-card max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{detail?.number}</DialogTitle><DialogDescription>{detail && `${detail.supplierSnapshot.name} - ${orderLabels[detail.status]}`}</DialogDescription></DialogHeader>{detail && <div className="space-y-4"><p className="text-xs text-muted-foreground">Delivery: {detail.locationName} | Expected: {orderDate(detail.expectedOn)}</p>{detail.lines.map((line, index) => <div key={index} className="rounded-xl border border-border/50 p-3 space-y-2"><p className="text-sm font-semibold">{line.name} ({line.code})</p>{line.name !== line.requestedName && <p className="text-xs text-muted-foreground">Requested as: {line.requestedName}</p>}<p className="text-xs">Ordered: {line.quantity} {line.unit} | Accepted: {line.accepted} | Pending: {line.pending}{line.cancelledQuantity > 0 && ` | Cancelled: ${line.cancelledQuantity}`}</p><p className="text-xs text-muted-foreground">Delivered: {line.delivered} | Rejected: {line.rejected}<br />Unit price: {orderMoney(line.unitPrice)} | Tax: {line.taxPercent}% | Total: {orderMoney(line.total)}</p>{line.pending > 0 && ['APPROVED', 'PARTIALLY_RECEIVED'].includes(detail.status) && <SmallButton onClick={() => { setReceiving({ order: detail, index }); setDetail(null); }}>Receive this item</SmallButton>}</div>)}<p className="text-sm font-semibold">Order total: {orderMoney(detail.total)}</p>{detail.instructions && <p className="text-xs whitespace-pre-wrap break-words">Instructions: {detail.instructions}</p>}
            {detail.receipts.length > 0 && <div className="border-t border-border/50 pt-3 space-y-3"><h3 className="text-sm font-semibold">Deliveries</h3>{detail.receipts.map(receipt => <div key={receipt.id} className="text-xs space-y-1"><p className="font-semibold">{detail.lines[receipt.purchaseOrderLine]?.name} - {orderDate(receipt.recordedOn)}</p><p>Delivered: {receipt.deliveredQuantity} | Accepted: {receipt.quantity} | Rejected: {receipt.rejectedQuantity}</p>{receipt.damageReason && <p className="text-muted-foreground">{receipt.damageReason}</p>}{receipt.billNumber && <p>Bill: {receipt.billNumber}</p>}{receipt.notes && <p className="whitespace-pre-wrap break-words">{receipt.notes}</p>}{receipt.attachments.map((file, i) => <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" className="block text-primary underline break-words">{file.name}</a>)}</div>)}</div>}
            <div className="border-t border-border/50 pt-3 space-y-2"><h3 className="text-sm font-semibold">History</h3>{detail.events.map((event, index) => <div key={index} className="text-xs"><p>{orderLabels[event.action] || event.action} - {event.actorRole === 'ADMIN' ? 'Admin' : 'Subadmin'} - {new Date(event.at).toLocaleString('en-IN')}</p>{event.reason && <p className="text-muted-foreground whitespace-pre-wrap break-words">{event.reason}</p>}</div>)}</div>
            {user?.role === 'ADMIN' && ['APPROVED', 'PARTIALLY_RECEIVED'].includes(detail.status) && <SecondaryButton onClick={() => { setClosing({ order: detail, reason: '' }); setDetail(null); }}>Cancel remaining quantity</SecondaryButton>}
        </div>}</DialogContent></Dialog>
        {editing && <OrderDraftDialog order={editing} request={{ id: editing.purchaseRequestId, requiredOn: editing.expectedOn, lines: editing.lines }} onClose={() => setEditing(null)} onSaved={saved} />}
        {receiving && <OrderReceiveDialog {...receiving} onClose={() => setReceiving(null)} onSaved={saved} />}
        <Dialog open={!!review} onOpenChange={open => { if (!open && !saving) setReview(null); }}><DialogContent className="sm:max-w-md bg-card"><DialogHeader><DialogTitle>Review purchase order</DialogTitle><DialogDescription>{review && `${review.order.number} - ${orderMoney(review.order.total)}`}</DialogDescription></DialogHeader>{review && <form onSubmit={reviewOrder} className="space-y-4"><fieldset disabled={saving}><Field label="Decision"><ThemedSelect value={review.decision} onChange={decision => setReview({ ...review, decision })} options={[{ value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }]} /></Field></fieldset><Field label={review.decision === 'REJECTED' ? 'Reason *' : 'Notes (optional)'}><textarea required={review.decision === 'REJECTED'} disabled={saving} maxLength={1000} className={`${inputCls} h-20 py-2 resize-none`} value={review.reason} onChange={e => setReview({ ...review, reason: e.target.value })} /></Field><div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setReview(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || (review.decision === 'REJECTED' && !review.reason.trim())}>{saving ? 'Saving...' : 'Confirm decision'}</PrimaryButton></div></form>}</DialogContent></Dialog>
        <Dialog open={!!closing} onOpenChange={open => { if (!open && !saving) setClosing(null); }}><DialogContent className="sm:max-w-md bg-card"><DialogHeader><DialogTitle>Cancel remaining quantity</DialogTitle><DialogDescription>{closing?.order.number} - pending quantities will be cancelled. Received stock stays unchanged.</DialogDescription></DialogHeader>{closing && <form onSubmit={closeOrder} className="space-y-4"><Field label="Reason *"><textarea required disabled={saving} maxLength={1000} className={`${inputCls} h-20 py-2 resize-none`} value={closing.reason} onChange={e => setClosing({ ...closing, reason: e.target.value })} /></Field><div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setClosing(null)}>Back</SecondaryButton><PrimaryButton type="submit" disabled={saving || !closing.reason.trim()}>{saving ? 'Saving...' : 'Cancel remaining and close'}</PrimaryButton></div></form>}</DialogContent></Dialog>
    </>;
}
