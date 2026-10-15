'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, Plus, Trash2, Eye, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PrimaryButton, SecondaryButton, SmallButton, Field, inputCls, Pill } from '@/app/admin/payroll/_components/ui';
import { InventorySearch } from '@/app/admin/inventory/InventoryHeaderControls';
import { inventoryDateTime } from '@/app/admin/inventory/inventory-date-time';
import { requestTone } from '@/app/admin/inventory/inventoryStatus';
import { StockQuantityError } from '@/app/admin/inventory/StockQuantityError';
import { stockToday } from '@/app/admin/inventory/IssueStockDialog';

type Line = { name: string; quantity: number; unit: string };
type Entry = { ledgerStatus?: string; fulfilment?: (Line & { issued: number; pending: number })[]; linkedPurchaseRequestId?: string | null; id: string; revision: number; department: string; requiredOn: string; reason: string; lines: Line[]; status: string; createdAt: string; events: { action: string; reason: string; at: string }[]; purchaseOrder?: { number: string; status: string } | null };
type CatalogueItem = { id: string; name: string; unit: string; unitAbbreviation: string };
type Draft = { id?: string; revision?: number; requestId: string; department: string; requiredOn: string; reason: string; lines: { name: string; quantity: string; unit: string }[] };
const labels: Record<string, string> = { RETURN_PENDING: 'Return pending', RETURNED: 'Returned', CLOSED: 'Closed', PENDING: 'Pending approval', APPROVED: 'Approved', REJECTED: 'Rejected', CHANGES_REQUESTED: 'Changes requested', SUBMITTED: 'Submitted', RESUBMITTED: 'Resubmitted', PARTIALLY_ISSUED: 'Partially issued', ISSUED: 'Issued', ITEM_CORRECTED: 'Issue corrected', ITEM_ISSUED: 'Stock issued', PURCHASE_REQUEST_CREATED: 'Purchase request created' };
const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const blankLine = () => ({ name: '', quantity: '', unit: '' });
const scrollStyle = { scrollbarWidth: 'thin' as const, scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' };

// Item name field with suggestions from the school's item list. Typing a name that is not in the list still works.
function ItemNameInput({ index, value, catalogue, onType, onPick }: { index: number; value: string; catalogue: CatalogueItem[]; onType: (name: string) => void; onPick: (item: CatalogueItem) => void }) {
 const [open, setOpen] = useState(false);
 const [active, setActive] = useState(0);
 const wrapper = useRef<HTMLDivElement>(null);
 const query = value.trim().toLowerCase();
 const matches = catalogue.filter(item => !query || item.name.toLowerCase().includes(query)).slice(0, 8);
 const exact = catalogue.some(item => item.name.toLowerCase() === query);
 const show = open && matches.length > 0 && !exact;
 useEffect(() => {
  const close = (event: MouseEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
  document.addEventListener('mousedown', close);
  return () => document.removeEventListener('mousedown', close);
 }, []);
 const pick = (item: CatalogueItem) => { onPick(item); setOpen(false); };
 return <div ref={wrapper} className="relative flex-1">
  <input aria-label={`Item ${index + 1} name`} role="combobox" aria-expanded={show} aria-autocomplete="list" autoComplete="off" required maxLength={150} className={inputCls} placeholder="Item name (pick from list or type)" value={value}
   onFocus={() => { setActive(0); setOpen(true); }}
   onChange={e => { onType(e.target.value); setActive(0); setOpen(true); }}
   onKeyDown={e => {
    if (!show) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
   }} />
  {show && <ul role="listbox" className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg py-1" style={scrollStyle}>
   {matches.map((item, i) => <li key={item.id} role="option" aria-selected={i === active} onMouseDown={e => { e.preventDefault(); pick(item); }} onMouseEnter={() => setActive(i)} className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between gap-3 ${i === active ? 'bg-muted' : ''}`}><span className="font-medium truncate">{item.name}</span><span className="text-muted-foreground shrink-0">{item.unit}</span></li>)}
  </ul>}
 </div>;
}

export default function TeacherInventoryPage() {
 const [entries, setEntries] = useState<Entry[]>([]);
 const [page, setPage] = useState(1);
 const [count, setCount] = useState(0);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [search, setSearch] = useState('');
 const [draft, setDraft] = useState<Draft | null>(null);
 const [detail, setDetail] = useState<Entry | null>(null);
 const [saving, setSaving] = useState(false);
 const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
 useEffect(() => {
  const controller = new AbortController();
  api.get('/teacher/inventory/item-catalogue', { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setCatalogue(result.data.data); }).catch(() => { /* the list is optional, typing a name still works */ });
  return () => controller.abort();
 }, []);
 const load = useCallback(async (signal?: AbortSignal) => {
  try {
   const result = await api.get('/teacher/inventory/item-requests', { params: { page }, signal });
   if (!signal?.aborted) { setEntries(result.data.data); setCount(result.data.count); setError(''); }
  } catch (err) { if (!signal?.aborted) setError(getErrorMessage(err, 'Could not load your requests')); }
  finally { if (!signal?.aborted) setLoading(false); }
 }, [page]);
 useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => { if (!controller.signal.aborted) return load(controller.signal); }); return () => controller.abort(); }, [load]);
 const refresh = () => { setLoading(true); void load(); };
 const newRequest = () => setDraft({ requestId: crypto.randomUUID(), department: '', requiredOn: stockToday(), reason: '', lines: [blankLine()] });
 const edit = (entry: Entry) => setDraft({ id: entry.id, revision: entry.revision, requestId: crypto.randomUUID(), department: entry.department, requiredOn: entry.requiredOn.slice(0, 10), reason: entry.reason, lines: entry.lines.map(line => ({ ...line, quantity: String(line.quantity) })) });
 const valid = !!draft && !!draft.requiredOn && !!draft.reason.trim() && draft.lines.every(line => line.name.trim() && line.unit.trim() && /^\d+$/.test(line.quantity) && Number(line.quantity) >= 1 && Number(line.quantity) <= 1000000000);
 const save = async (event: React.FormEvent) => {
  event.preventDefault(); if (!draft || !valid || saving) return;
  setSaving(true);
  try {
   const payload = { department: draft.department.trim(), requiredOn: draft.requiredOn, reason: draft.reason.trim(), lines: draft.lines.map(line => ({ name: line.name.trim(), unit: line.unit.trim(), quantity: Number(line.quantity) })) };
   if (draft.id) await api.patch(`/teacher/inventory/item-requests/${draft.id}`, { ...payload, revision: draft.revision });
   else await api.post('/teacher/inventory/item-requests', { ...payload, requestId: draft.requestId });
   setDraft(null); toast.success(draft.id ? 'Request resubmitted' : 'Request sent to school inventory');
   if (page !== 1) { setLoading(true); setPage(1); } else refresh();
  } catch (err) { toast.error(getErrorMessage(err, 'Could not submit request')); }
  finally { setSaving(false); }
 };
 const filtered = entries.filter(entry => `${entry.department} ${entry.reason} ${entry.lines.map(line => line.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="h-full min-h-0 flex flex-col pb-3">
  <div className="shrink-0 px-1 pb-3"><div className="flex items-center justify-between flex-wrap gap-2"><div><h1 className="text-xl font-bold flex items-center gap-2"><Boxes size={21} />Inventory</h1><p className="text-[13px] text-muted-foreground">Request school supplies and track your requests.</p></div><div className="flex items-center gap-2"><InventorySearch value={search} onChange={setSearch} placeholder="Search this page..." label="Search your requests" /><PrimaryButton onClick={newRequest}><Plus size={14} />New Request</PrimaryButton></div></div><div className="h-px bg-border/60 mt-2" /></div>
  <section data-dashboard-surface="" className="flex-1 min-h-0 flex flex-col rounded-2xl bg-card overflow-hidden">
   <div className="flex-1 min-h-0 overflow-auto" style={scrollStyle}><table className="w-full min-w-[650px] text-left text-xs [&_td]:align-top">
    <thead className="sticky top-0 z-10 bg-card border-b border-border/40 text-muted-foreground"><tr>{['Items', 'Required by', 'Submitted', 'Status', 'Actions'].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
    <tbody className="divide-y divide-border/40">{loading ? <tr><td colSpan={5} className="py-12 text-center"><span className="inline-flex gap-2 items-center text-muted-foreground"><Loader2 size={15} className="animate-spin" />Loading requests...</span></td></tr> : error ? <tr><td colSpan={5} className="py-12 text-center"><p role="alert" className="text-red-500 mb-3">{error}</p><SecondaryButton onClick={refresh}>Retry</SecondaryButton></td></tr> : !filtered.length ? <tr><td colSpan={5} className="py-12 text-center"><Boxes size={25} className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm font-medium">{search ? 'No matching requests' : 'No requests yet'}</p><p className="mt-1 text-muted-foreground">{search ? 'Try another item name.' : 'Use New Request to ask for supplies.'}</p></td></tr> : filtered.map(entry => <tr key={entry.id} className="hover:bg-muted/30">
     <td className="px-4 py-3"><div className="space-y-1">{entry.lines.map((line, i) => <p key={i}><span className="font-medium">{line.name}</span> - {line.quantity} {line.unit}{entry.fulfilment?.[i] && <span className="block mt-1 text-muted-foreground">Issued: {entry.fulfilment[i].issued} | Pending: {entry.fulfilment[i].pending}</span>}</p>)}</div>{entry.department && <p className="text-muted-foreground mt-2">{entry.department}</p>}</td><td className="px-4 py-3 whitespace-nowrap">{date(entry.requiredOn)}</td><td className="px-4 py-3">{inventoryDateTime(entry.createdAt)}</td><td className="px-4 py-3"><Pill tone={requestTone(entry.ledgerStatus || entry.status)}>{labels[entry.ledgerStatus || entry.status] || entry.status}</Pill>{entry.purchaseOrder && <p className="mt-2 text-muted-foreground">Order: {entry.purchaseOrder.number}</p>}</td><td className="px-4 py-3"><div className="flex gap-2"><SmallButton onClick={() => setDetail(entry)}><Eye size={13} />View</SmallButton>{['PENDING', 'CHANGES_REQUESTED'].includes(entry.status) && <SmallButton onClick={() => edit(entry)}><Pencil size={13} />Edit</SmallButton>}</div></td>
    </tr>)}</tbody>
   </table></div>
   {count > 50 && <div className="shrink-0 flex justify-between items-center gap-3 border-t border-border/40 px-4 py-3 text-xs"><span>Page {page} of {Math.ceil(count / 50)}</span><div className="flex gap-2"><SecondaryButton disabled={page === 1 || loading} onClick={() => { setLoading(true); setPage(page - 1); }}>Previous</SecondaryButton><SecondaryButton disabled={page * 50 >= count || loading} onClick={() => { setLoading(true); setPage(page + 1); }}>Next</SecondaryButton></div></div>}
  </section>
  <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}><DialogContent className="sm:max-w-xl bg-card max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6"><DialogTitle>{draft?.id ? 'Edit Request' : 'New Request'}</DialogTitle><DialogDescription>Your school inventory team will receive this request.</DialogDescription></DialogHeader>
   {draft && <form onSubmit={save} className="flex-1 min-h-0 flex flex-col overflow-hidden"><div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4" style={scrollStyle}><fieldset disabled={saving} className="space-y-4">
    <div className="grid sm:grid-cols-2 gap-3"><Field label="Department / purpose (optional)"><input maxLength={100} className={inputCls} value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })} placeholder="e.g. Science lab" /></Field><Field label="Required by *"><input required type="date" className={inputCls} value={draft.requiredOn} onChange={e => setDraft({ ...draft, requiredOn: e.target.value })} /></Field></div>
    <div className="space-y-3"><p className="text-xs font-semibold">Items *</p>{draft.lines.map((line, i) => <div key={i} className="rounded-xl bg-muted/30 p-3 space-y-3"><div className="flex gap-2"><ItemNameInput index={i} value={line.name} catalogue={catalogue} onType={name => setDraft({ ...draft, lines: draft.lines.map((row, index) => { if (index !== i) return row; const match = catalogue.find(item => item.name.toLowerCase() === name.trim().toLowerCase()); return { ...row, name, unit: match && !row.unit.trim() ? match.unit : row.unit }; }) })} onPick={item => setDraft({ ...draft, lines: draft.lines.map((row, index) => index === i ? { ...row, name: item.name, unit: item.unit } : row) })} /><SmallButton type="button" aria-label={`Remove item ${i + 1}`} disabled={draft.lines.length === 1} onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, index) => i !== index) })}><Trash2 size={14} /></SmallButton></div><div className="grid grid-cols-2 gap-3"><Field label="Quantity *"><input required type="number" min="1" max="1000000000" step="1" className={inputCls} value={line.quantity} onChange={e => { if (/^-?\d*$/.test(e.target.value)) setDraft({ ...draft, lines: draft.lines.map((row, index) => index === i ? { ...row, quantity: e.target.value } : row) }); }} /><StockQuantityError value={line.quantity} /></Field><Field label="Unit *"><input required maxLength={40} className={inputCls} value={line.unit} placeholder="e.g. pcs, boxes" onChange={e => setDraft({ ...draft, lines: draft.lines.map((row, index) => index === i ? { ...row, unit: e.target.value } : row) })} /></Field></div></div>)}<SecondaryButton type="button" disabled={draft.lines.length >= 20} onClick={() => setDraft({ ...draft, lines: [...draft.lines, blankLine()] })}><Plus size={13} />Add item</SecondaryButton></div>
    <Field label="Reason *"><textarea required maxLength={1000} className={`${inputCls} h-24 py-2 resize-none`} value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} placeholder="Why do you need these items?" /></Field>
   </fieldset></div><div className="shrink-0 flex justify-end gap-2 border-t border-border/40 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={!valid || saving}>{saving ? 'Sending...' : draft.id ? 'Resubmit Request' : 'Send Request'}</PrimaryButton></div></form>}
  </DialogContent></Dialog>
  <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="sm:max-w-lg bg-card max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6"><DialogTitle>Request details</DialogTitle><DialogDescription>{detail && `Submitted ${inventoryDateTime(detail.createdAt)}`}</DialogDescription></DialogHeader>{detail && <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 text-sm" style={scrollStyle}><Pill tone={requestTone(detail.ledgerStatus || detail.status)}>{labels[detail.ledgerStatus || detail.status] || detail.status}</Pill><div><p className="text-xs text-muted-foreground">Required by</p><p>{date(detail.requiredOn)}</p></div>{detail.department && <p>Department / purpose: {detail.department}</p>}<div className="rounded-xl bg-muted/30 p-3 space-y-2">{detail.lines.map((line, i) => <p key={i}>{line.name}: {line.quantity} {line.unit}{detail.fulfilment?.[i] && <span className="block mt-1 text-xs text-muted-foreground">Issued: {detail.fulfilment[i].issued} | Pending: {detail.fulfilment[i].pending}</span>}</p>)}</div><div><p className="text-xs text-muted-foreground">Reason</p><p className="whitespace-pre-wrap break-words mt-1">{detail.reason}</p></div>{detail.purchaseOrder && <p>Purchase order: {detail.purchaseOrder.number}</p>}{detail.linkedPurchaseRequestId && <p className="text-xs text-muted-foreground">A purchase request has been created for your remaining items.</p>}<div className="border-t border-border/40 pt-3 space-y-3"><h3 className="font-semibold">History</h3>{detail.events.map((event, i) => <div key={i}><p className="text-xs font-medium">{labels[event.action] || event.action}</p><p className="text-xs text-muted-foreground">{inventoryDateTime(event.at)}</p>{event.reason && <p className="text-xs mt-1 whitespace-pre-wrap break-words">{event.reason}</p>}</div>)}</div></div>}</DialogContent></Dialog>
 </div>;
}
