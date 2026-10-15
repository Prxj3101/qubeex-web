'use client';
import { inventoryDateTime } from './inventory-date-time';
import { InventorySearch, InventoryFilters } from './InventoryHeaderControls';

import { useCallback, useEffect, useState } from 'react';
import { Plus, ShoppingCart, Trash2, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/authStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, SmallButton, Field, inputCls, ThemedSelect, Pill } from '@/app/admin/payroll/_components/ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PurchaseTimeline, requestSteps } from './PurchaseTimeline';
import { requestTone } from './inventoryStatus';
import { StockQuantityError } from './StockQuantityError';
import { stockToday } from './IssueStockDialog';

interface Line { name: string; quantity: number; unit: string }
interface Entry { purchaseOrder?: { id: string; number: string; status: string } | null; id: string; requestedByName: string; department: string; requiredOn: string; reason: string; lines: Line[]; status: string; source: string; revision: number; createdById: string; createdAt: string; events: { action: string; reason: string; actorRole: string; at: string }[] }
interface Draft { id?: string; revision?: number; requestId: string; requestedByName: string; department: string; requiredOn: string; reason: string; lines: { name: string; quantity: string; unit: string }[] }
const labels: Record<string, string> = { PENDING: 'Pending approval', APPROVED: 'Approved', REJECTED: 'Rejected', CHANGES_REQUESTED: 'Changes requested', SUBMITTED: 'Submitted', RESUBMITTED: 'Resubmitted' };
const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { timeZone: 'UTC' });
const blankLine = () => ({ name: '', quantity: '', unit: '' });

export default function PurchaseRequestsPanel({ banner, navigation, onCreateOrder, onOrders }: { banner?: React.ReactNode; navigation: React.ReactNode; onCreateOrder: (request: Entry) => void; onOrders: (id: string) => void }) {
    const user = useAuthStore(s => s.user);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [count, setCount] = useState(0);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [detail, setDetail] = useState<Entry | null>(null);
    const [review, setReview] = useState<{ entry: Entry; decision: string; reason: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const load = useCallback((signal?: AbortSignal) => api.get('/admin/inventory/purchase-requests', { params: { page }, signal }).then(res => {
        if (!signal?.aborted) { setEntries(res.data.data); setCount(res.data.count); setError(''); }
    }).catch(err => { if (!signal?.aborted) setError(getErrorMessage(err, 'Failed to load purchase requests')); }).finally(() => { if (!signal?.aborted) setLoading(false); }), [page]);
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
    const valid = draft && draft.requestedByName.trim() && draft.reason.trim() && draft.requiredOn && draft.lines.every(line => line.name.trim() && line.unit.trim() && /^\d+$/.test(line.quantity) && Number(line.quantity) >= 1 && Number(line.quantity) <= 1000000000);
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (!draft || !valid || saving) return;
        setSaving(true);
        try {
            const payload = { requestedByName: draft.requestedByName.trim(), department: draft.department.trim(), requiredOn: draft.requiredOn, reason: draft.reason.trim(), lines: draft.lines.map(line => ({ name: line.name.trim(), unit: line.unit.trim(), quantity: Number(line.quantity) })) };
            if (draft.id) await api.patch(`/admin/inventory/purchase-requests/${draft.id}`, { ...payload, revision: draft.revision });
            else await api.post('/admin/inventory/purchase-requests', { ...payload, requestId: draft.requestId });
            setDraft(null); toast.success('Request submitted for approval'); await load();
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to submit request')); }
        finally { setSaving(false); }
    };
    const submitReview = async (event: React.FormEvent) => {
        event.preventDefault(); if (!review || saving || (review.decision !== 'APPROVED' && !review.reason.trim())) return;
        setSaving(true);
        try { await api.post(`/admin/inventory/purchase-requests/${review.entry.id}/review`, { revision: review.entry.revision, decision: review.decision, reason: review.reason.trim() }); setReview(null); setDetail(null); toast.success('Request reviewed'); await load(); }
        catch (err) { toast.error(getErrorMessage(err, 'Failed to review request')); }
        finally { setSaving(false); }
    };
    const edit = (entry: Entry) => setDraft({ ...entry, requiredOn: entry.requiredOn.slice(0, 10), requestId: crypto.randomUUID(), lines: entry.lines.map(line => ({ ...line, quantity: String(line.quantity) })) });
    const filtered = entries.filter(entry => (!status || entry.status === status) && `${entry.requestedByName} ${entry.department} ${entry.reason} ${entry.lines.map(line => line.name).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
    return <>
        <PageHeader title="Purchases" subtitle="Request school supplies and review them before placing an order.">
            <div className="flex flex-wrap items-center gap-3">
                <InventorySearch value={search} onChange={setSearch} label="Search requests on this page" placeholder="Search requests on this page..." />
                <InventoryFilters activeCount={status ? 1 : 0}><div className="w-full"><ThemedSelect value={status || 'ALL'} onChange={value => setStatus(value === 'ALL' ? '' : value)} options={[{ value: 'ALL', label: 'All statuses' }, ...['PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].map(value => ({ value, label: labels[value] }))]} /></div><SmallButton onClick={() => setStatus('')}>Clear filters</SmallButton></InventoryFilters>
                {navigation}
                <PrimaryButton onClick={() => setDraft({ requestId: crypto.randomUUID(), requestedByName: '', department: '', reason: '', requiredOn: stockToday(), lines: [blankLine()] })}><Plus size={14} />New request</PrimaryButton>
            </div>
        </PageHeader>
        {banner}
        <section className="flex-1 min-h-0 flex flex-col rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] overflow-hidden" data-admin-surface="">
            <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border/50"><ShoppingCart size={16} className="text-primary" /><h2 className="text-sm font-semibold">Purchase requests</h2><span className="text-xs text-muted-foreground">({count})</span></div>
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain visible-scrollbar">
            {loading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading requests...</p> : error ? <EmptyState icon={ShoppingCart} title="Could not load requests" text={error}><SecondaryButton onClick={() => void load()}>Retry</SecondaryButton></EmptyState> : !filtered.length ? <EmptyState icon={ShoppingCart} title="No purchase requests" text="Create a request with the items your school needs." /> : <div><table className="w-full min-w-[750px] text-left text-xs [&_td]:align-top"><thead className="sticky top-0 z-10 bg-card border-b border-border/60 text-muted-foreground"><tr>{['Requested by', 'Items', 'Required by', 'Source', 'Status', 'Actions'].map(heading => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-border/50">{filtered.map(entry => <tr key={entry.id} className="hover:bg-muted/30">
                <td className="px-4 py-3"><p className="font-semibold">{entry.requestedByName}</p><p className="text-muted-foreground">{entry.department}</p></td><td className="px-4 py-3">{entry.lines.map((line, i) => <p key={i}>{line.name}: {line.quantity} {line.unit}</p>)}</td><td className="px-4 py-3 whitespace-nowrap">{date(entry.requiredOn)}<p className="mt-1 text-[11px] text-muted-foreground whitespace-normal">Submitted: {inventoryDateTime(entry.events[0]?.at)}</p></td><td className="px-4 py-3">{entry.source === 'ITEM_REQUEST_PURCHASE' ? 'From item request' : 'Manual'}</td><td className="px-4 py-3 whitespace-nowrap"><Pill tone={requestTone(entry.status)}>{labels[entry.status]}</Pill></td><td className="px-4 py-3">{(() => {
                    const canEdit = ['PENDING', 'CHANGES_REQUESTED'].includes(entry.status) && (user?.role === 'ADMIN' || user?.id === entry.createdById);
                    const canReview = user?.role === 'ADMIN' && entry.status === 'PENDING';
                    const main = canReview ? 'review' : entry.status === 'APPROVED' ? (entry.purchaseOrder ? 'order' : 'create') : entry.status === 'CHANGES_REQUESTED' && canEdit ? 'edit' : 'view';
                    return <div className="flex items-center gap-1.5">
                        {main === 'review' && <SmallButton onClick={() => setReview({ entry, decision: 'APPROVED', reason: '' })}>Review</SmallButton>}
                        {main === 'create' && <SmallButton onClick={() => onCreateOrder(entry)}>Create order</SmallButton>}
                        {main === 'order' && <SmallButton onClick={() => onOrders(entry.purchaseOrder!.id)}>View order</SmallButton>}
                        {main === 'edit' && <SmallButton onClick={() => edit(entry)}>Edit</SmallButton>}
                        {main === 'view' && <SmallButton onClick={() => setDetail(entry)}>View</SmallButton>}
                        {(main !== 'view' || (canEdit && main !== 'edit') || !!entry.purchaseOrder || canReview) && <DropdownMenu>
                            <DropdownMenuTrigger asChild><SmallButton aria-label="More actions"><MoreHorizontal size={14} /></SmallButton></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                {main !== 'view' && <DropdownMenuItem onClick={() => setDetail(entry)}>View details</DropdownMenuItem>}
                                {canEdit && main !== 'edit' && <DropdownMenuItem onClick={() => edit(entry)}>Edit</DropdownMenuItem>}
                                {entry.purchaseOrder && main !== 'order' && <DropdownMenuItem onClick={() => onOrders(entry.purchaseOrder!.id)}>View order</DropdownMenuItem>}
                                {canReview && main !== 'review' && <DropdownMenuItem onClick={() => setReview({ entry, decision: 'APPROVED', reason: '' })}>Review</DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>}
                    </div>;
                })()}</td>
            </tr>)}</tbody></table></div>}
            </div>
            {count > 50 && <div className="shrink-0 flex items-center justify-end gap-3 px-4 py-3 border-t border-border/50"><SecondaryButton disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(page - 1); }}>Previous</SecondaryButton><span className="text-xs">Page {page} of {Math.ceil(count / 50)}</span><SecondaryButton disabled={page * 50 >= count || loading} onClick={() => { setLoading(true); setPage(page + 1); }}>Next</SecondaryButton></div>}
        </section>
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}><DialogContent className="sm:max-w-2xl bg-card max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6 "><DialogTitle>{draft?.id ? 'Edit purchase request' : 'New purchase request'}</DialogTitle><DialogDescription>Submit requirements for admin approval. Stock stays unchanged.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
{draft && <form onSubmit={save} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>

            <div className="grid sm:grid-cols-2 gap-4"><Field label="Requested by *"><input required maxLength={100} disabled={saving} className={inputCls} value={draft.requestedByName} onChange={e => setDraft({ ...draft, requestedByName: e.target.value })} placeholder="Teacher or person name" /></Field><Field label="Department (optional)"><input maxLength={100} disabled={saving} className={inputCls} value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })} placeholder="e.g. Sports" /></Field></div>
            <fieldset disabled={saving} className="space-y-3"><p className="text-xs font-semibold">Items *</p>{draft.lines.map((line, index) => <div key={index} className="rounded-xl border border-border/50 p-3 space-y-2"><div className="flex items-center gap-2"><input required aria-label={`Item ${index + 1} name`} maxLength={150} className={inputCls} placeholder="Item name" value={line.name} onChange={e => setDraft({ ...draft, lines: draft.lines.map((row, i) => i === index ? { ...row, name: e.target.value } : row) })} /><SmallButton type="button" aria-label={`Remove item ${index + 1}`} disabled={draft.lines.length === 1} onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, i) => i !== index) })}><Trash2 size={13} /></SmallButton></div><div className="grid grid-cols-2 gap-3"><Field label="Quantity *"><input required type="number" step="1" min="1" max="1000000000" className={inputCls} value={line.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setDraft({ ...draft, lines: draft.lines.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row) }); }} /><StockQuantityError value={line.quantity} /></Field><Field label="Unit *"><input required maxLength={40} className={inputCls} placeholder="e.g. pcs, boxes" value={line.unit} onChange={e => setDraft({ ...draft, lines: draft.lines.map((row, i) => i === index ? { ...row, unit: e.target.value } : row) })} /></Field></div></div>)}<SecondaryButton type="button" disabled={draft.lines.length >= 20} onClick={() => setDraft({ ...draft, lines: [...draft.lines, blankLine()] })}><Plus size={13} />Add item</SecondaryButton></fieldset>
            <Field label="Required by *"><input required type="date" disabled={saving} className={inputCls} value={draft.requiredOn} onChange={e => setDraft({ ...draft, requiredOn: e.target.value })} /></Field><Field label="Reason *"><textarea required maxLength={1000} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} /></Field>
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !valid}>{saving ? 'Submitting...' : draft.id ? 'Save and resubmit' : 'Submit request'}</PrimaryButton></div>
        </form>}
</div>
</DialogContent></Dialog>
        <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6 "><DialogTitle>Purchase request</DialogTitle><DialogDescription>{detail && `${detail.requestedByName} - ${labels[detail.status]}`}</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
{detail && <div className="space-y-4 text-sm"><div className="rounded-xl border border-border/50 bg-muted/20 px-2 py-3" data-admin-surface=""><PurchaseTimeline steps={requestSteps(detail.status, detail.events, !!detail.purchaseOrder)} /></div><p>Department: {detail.department || '-'}</p><p>Required by: {date(detail.requiredOn)}</p><div>{detail.lines.map((line, i) => <p key={i}>{line.name}: {line.quantity} {line.unit}</p>)}</div><p className="whitespace-pre-wrap break-words">Reason: {detail.reason}</p><div className="border-t border-border/50 pt-3 space-y-2"><h3 className="font-semibold">History</h3>{detail.events.map((event, i) => <div key={i} className="text-xs"><p>{labels[event.action] || event.action} - {event.actorRole === 'ADMIN' ? 'Admin' : event.actorRole === 'SUB_ADMIN' ? 'Subadmin' : 'Teacher'} - {inventoryDateTime(event.at)}</p>{event.reason && <p className="text-muted-foreground whitespace-pre-wrap break-words">{event.reason}</p>}</div>)}</div></div>}
</div>
</DialogContent></Dialog>
        <Dialog open={!!review} onOpenChange={open => { if (!open && !saving) setReview(null); }}><DialogContent className="sm:max-w-md bg-card max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6 "><DialogTitle>Review request</DialogTitle><DialogDescription>{review?.entry.requestedByName} - confirm the decision.</DialogDescription></DialogHeader>
<div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
{review && <form onSubmit={submitReview} className="flex flex-col flex-1 min-h-0 overflow-hidden">
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}>
<fieldset disabled={saving}><Field label="Decision"><ThemedSelect value={review.decision} onChange={decision => setReview({ ...review, decision })} options={['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].map(value => ({ value, label: labels[value] }))} /></Field></fieldset><Field label={review.decision === 'APPROVED' ? 'Notes (optional)' : 'Reason *'}><textarea required={review.decision !== 'APPROVED'} maxLength={1000} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={review.reason} onChange={e => setReview({ ...review, reason: e.target.value })} /></Field>
</div>
<div className="flex justify-end gap-2 shrink-0 border-t border-border/50 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setReview(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || (review.decision !== 'APPROVED' && !review.reason.trim())}>{saving ? 'Saving...' : 'Confirm decision'}</PrimaryButton></div></form>}
</div>
</DialogContent></Dialog>
    </>;
}
