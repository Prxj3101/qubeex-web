'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, ShoppingCart, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/authStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, SmallButton, Field, inputCls, ThemedSelect, Pill } from '@/app/admin/payroll/_components/ui';
import { StockQuantityError } from './StockQuantityError';
import { stockToday } from './IssueStockDialog';

interface Line { name: string; quantity: number; unit: string }
interface Entry { purchaseOrder?: { id: string; number: string; status: string } | null; id: string; requestedByName: string; department: string; requiredOn: string; reason: string; lines: Line[]; status: string; source: string; revision: number; createdById: string; createdAt: string; events: { action: string; reason: string; actorRole: string; at: string }[] }
interface Draft { id?: string; revision?: number; requestId: string; requestedByName: string; department: string; requiredOn: string; reason: string; lines: { name: string; quantity: string; unit: string }[] }
const labels: Record<string, string> = { PENDING: 'Pending approval', APPROVED: 'Approved', REJECTED: 'Rejected', CHANGES_REQUESTED: 'Changes requested', SUBMITTED: 'Submitted', RESUBMITTED: 'Resubmitted' };
const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { timeZone: 'UTC' });
const blankLine = () => ({ name: '', quantity: '', unit: '' });

export default function PurchaseRequestsPanel({ navigation, onCreateOrder, onOrders }: { navigation: React.ReactNode; onCreateOrder: (request: Entry) => void; onOrders: (id: string) => void }) {
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
                <div className="relative w-60"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search requests on this page" className="w-full h-8 pl-8 pr-3 rounded-full text-xs bg-muted/50 border border-border/50" placeholder="Search requests on this page..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div className="w-40"><ThemedSelect value={status || 'ALL'} onChange={value => setStatus(value === 'ALL' ? '' : value)} options={[{ value: 'ALL', label: 'All statuses' }, ...['PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].map(value => ({ value, label: labels[value] }))]} /></div>
                {navigation}
                <PrimaryButton onClick={() => setDraft({ requestId: crypto.randomUUID(), requestedByName: '', department: '', reason: '', requiredOn: stockToday(), lines: [blankLine()] })}><Plus size={14} />New request</PrimaryButton>
            </div>
        </PageHeader>
        <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50"><ShoppingCart size={16} className="text-primary" /><h2 className="text-sm font-semibold">Purchase requests</h2><span className="text-xs text-muted-foreground">({count})</span></div>
            {loading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading requests...</p> : error ? <EmptyState icon={ShoppingCart} title="Could not load requests" text={error}><SecondaryButton onClick={() => void load()}>Retry</SecondaryButton></EmptyState> : !filtered.length ? <EmptyState icon={ShoppingCart} title="No purchase requests" text="Create a request with the items your school needs." /> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-muted-foreground"><tr>{['Requested by', 'Items', 'Required by', 'Source', 'Status', 'Actions'].map(heading => <th key={heading} className="px-4 py-3 text-left font-medium">{heading}</th>)}</tr></thead><tbody>{filtered.map(entry => <tr key={entry.id} className="border-t border-border/50">
                <td className="px-4 py-3"><p className="font-semibold">{entry.requestedByName}</p><p className="text-muted-foreground">{entry.department}</p></td><td className="px-4 py-3">{entry.lines.map((line, i) => <p key={i}>{line.name}: {line.quantity} {line.unit}</p>)}</td><td className="px-4 py-3 whitespace-nowrap">{date(entry.requiredOn)}</td><td className="px-4 py-3">{entry.source === 'MANUAL' ? 'Manual' : 'Teacher request'}</td><td className="px-4 py-3 whitespace-nowrap"><Pill tone={entry.status === 'APPROVED' ? 'green' : entry.status === 'REJECTED' ? 'red' : 'amber'}>{labels[entry.status]}</Pill></td><td className="px-4 py-3"><div className="flex gap-1.5"><SmallButton onClick={() => setDetail(entry)}>View</SmallButton>{entry.status === 'APPROVED' && (entry.purchaseOrder ? <SmallButton onClick={() => onOrders(entry.purchaseOrder!.id)}>View order</SmallButton> : <SmallButton onClick={() => onCreateOrder(entry)}>Create order</SmallButton>)}{['PENDING', 'CHANGES_REQUESTED'].includes(entry.status) && (user?.role === 'ADMIN' || user?.id === entry.createdById) && <SmallButton onClick={() => edit(entry)}>Edit</SmallButton>}{user?.role === 'ADMIN' && entry.status === 'PENDING' && <SmallButton onClick={() => setReview({ entry, decision: 'APPROVED', reason: '' })}>Review</SmallButton>}</div></td>
            </tr>)}</tbody></table></div>}
            {count > 50 && <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-border/50"><SecondaryButton disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(page - 1); }}>Previous</SecondaryButton><span className="text-xs">Page {page} of {Math.ceil(count / 50)}</span><SecondaryButton disabled={page * 50 >= count || loading} onClick={() => { setLoading(true); setPage(page + 1); }}>Next</SecondaryButton></div>}
        </section>
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}><DialogContent className="sm:max-w-2xl bg-card max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{draft?.id ? 'Edit purchase request' : 'New purchase request'}</DialogTitle><DialogDescription>Submit requirements for admin approval. Stock stays unchanged.</DialogDescription></DialogHeader>{draft && <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4"><Field label="Requested by *"><input required maxLength={100} disabled={saving} className={inputCls} value={draft.requestedByName} onChange={e => setDraft({ ...draft, requestedByName: e.target.value })} placeholder="Teacher or person name" /></Field><Field label="Department (optional)"><input maxLength={100} disabled={saving} className={inputCls} value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })} placeholder="e.g. Sports" /></Field></div>
            <fieldset disabled={saving} className="space-y-3"><p className="text-xs font-semibold">Items *</p>{draft.lines.map((line, index) => <div key={index} className="rounded-xl border border-border/50 p-3 space-y-2"><div className="flex items-center gap-2"><input required aria-label={`Item ${index + 1} name`} maxLength={150} className={inputCls} placeholder="Item name" value={line.name} onChange={e => setDraft({ ...draft, lines: draft.lines.map((row, i) => i === index ? { ...row, name: e.target.value } : row) })} /><SmallButton type="button" aria-label={`Remove item ${index + 1}`} disabled={draft.lines.length === 1} onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, i) => i !== index) })}><Trash2 size={13} /></SmallButton></div><div className="grid grid-cols-2 gap-3"><Field label="Quantity *"><input required type="number" step="1" min="1" max="1000000000" className={inputCls} value={line.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setDraft({ ...draft, lines: draft.lines.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row) }); }} /><StockQuantityError value={line.quantity} /></Field><Field label="Unit *"><input required maxLength={40} className={inputCls} placeholder="e.g. pcs, boxes" value={line.unit} onChange={e => setDraft({ ...draft, lines: draft.lines.map((row, i) => i === index ? { ...row, unit: e.target.value } : row) })} /></Field></div></div>)}<SecondaryButton type="button" disabled={draft.lines.length >= 20} onClick={() => setDraft({ ...draft, lines: [...draft.lines, blankLine()] })}><Plus size={13} />Add item</SecondaryButton></fieldset>
            <Field label="Required by *"><input required type="date" disabled={saving} className={inputCls} value={draft.requiredOn} onChange={e => setDraft({ ...draft, requiredOn: e.target.value })} /></Field><Field label="Reason *"><textarea required maxLength={1000} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} /></Field><div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || !valid}>{saving ? 'Submitting...' : draft.id ? 'Save and resubmit' : 'Submit request'}</PrimaryButton></div>
        </form>}</DialogContent></Dialog>
        <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Purchase request</DialogTitle><DialogDescription>{detail && `${detail.requestedByName} - ${labels[detail.status]}`}</DialogDescription></DialogHeader>{detail && <div className="space-y-4 text-sm"><p>Department: {detail.department || '-'}</p><p>Required by: {date(detail.requiredOn)}</p><div>{detail.lines.map((line, i) => <p key={i}>{line.name}: {line.quantity} {line.unit}</p>)}</div><p className="whitespace-pre-wrap break-words">Reason: {detail.reason}</p><div className="border-t border-border/50 pt-3 space-y-2"><h3 className="font-semibold">History</h3>{detail.events.map((event, i) => <div key={i} className="text-xs"><p>{labels[event.action] || event.action} - {event.actorRole === 'ADMIN' ? 'Admin' : event.actorRole === 'SUB_ADMIN' ? 'Subadmin' : 'Teacher'} - {new Date(event.at).toLocaleString('en-IN')}</p>{event.reason && <p className="text-muted-foreground whitespace-pre-wrap break-words">{event.reason}</p>}</div>)}</div></div>}</DialogContent></Dialog>
        <Dialog open={!!review} onOpenChange={open => { if (!open && !saving) setReview(null); }}><DialogContent className="sm:max-w-md bg-card"><DialogHeader><DialogTitle>Review request</DialogTitle><DialogDescription>{review?.entry.requestedByName} - confirm the decision.</DialogDescription></DialogHeader>{review && <form onSubmit={submitReview} className="space-y-4"><fieldset disabled={saving}><Field label="Decision"><ThemedSelect value={review.decision} onChange={decision => setReview({ ...review, decision })} options={['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].map(value => ({ value, label: labels[value] }))} /></Field></fieldset><Field label={review.decision === 'APPROVED' ? 'Notes (optional)' : 'Reason *'}><textarea required={review.decision !== 'APPROVED'} maxLength={1000} disabled={saving} className={`${inputCls} h-20 py-2 resize-none`} value={review.reason} onChange={e => setReview({ ...review, reason: e.target.value })} /></Field><div className="flex justify-end gap-2"><SecondaryButton type="button" disabled={saving} onClick={() => setReview(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving || (review.decision !== 'APPROVED' && !review.reason.trim())}>{saving ? 'Saving...' : 'Confirm decision'}</PrimaryButton></div></form>}</DialogContent></Dialog>
    </>;
}
