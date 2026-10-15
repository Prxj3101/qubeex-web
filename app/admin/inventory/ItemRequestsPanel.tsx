'use client';
import { LedgerAttachmentList } from './LedgerAttachments';
import { LedgerCorrectionDialog, LedgerCorrectionHistory, type EditableMovement } from './LedgerCorrectionDialog';
import { useCallback, useEffect, useState } from 'react';
import { PackageMinus, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader, SmallButton, PrimaryButton, SecondaryButton, Field, ThemedSelect, inputCls } from '@/app/admin/payroll/_components/ui';
import { InventorySearch } from './InventoryHeaderControls';
import { inventoryDateTime } from './inventory-date-time';
import { LedgerRegister } from './LedgerRegister';
import { IssuedStockDialog } from './IssuedStockDialog';
import { stockToday } from './IssueStockDialog';
import { IssueStockDialog } from './IssueStockDialog';
import { updateInventoryNavigation } from './useInventoryNavigation';
import type { Item } from './ItemsPanel';

type Line = { name: string; unit: string; quantity: number; issued: number; pending: number };
type LedgerIssue = EditableMovement & { id: string; item: Item; location: { name: string }; quantity: string; returnExpected: boolean; occurredAt?: string | null; recordedOn: string; createdAt: string; dueOn: string | null; notes: string; issuedByName: string; returnedQuantity: number; damagedQuantity: number; lostQuantity: number; outstandingQuantity: number; returns: (EditableMovement & { id: string; kind: string; quantity: string; occurredAt?: string | null; recordedOn: string; createdAt: string; notes: string; recordedByName: string })[] };
export type LedgerEntry = { ledgerStatus?: string; ledgerSource: string; issues: LedgerIssue[]; id: string; revision: number; requestedByName: string; department: string; requiredOn: string; reason: string; status: string; createdAt: string; fulfilment: Line[]; linkedPurchaseRequestId?: string | null; purchaseOrder?: { number: string } | null; events: { action: string; reason: string; at: string; lineIndex?: number; quantity?: number; movementId?: string }[] };
type Entry = LedgerEntry;
const labels: Record<string, string> = { RETURN_PENDING: 'Return pending', RETURNED: 'Returned', CLOSED: 'Closed', PENDING: 'Pending approval', APPROVED: 'Approved', REJECTED: 'Rejected', CHANGES_REQUESTED: 'Changes requested', PARTIALLY_ISSUED: 'Partially issued', ISSUED: 'Issued', SUBMITTED: 'Submitted', RESUBMITTED: 'Resubmitted', ITEM_CORRECTED: 'Issue corrected', ITEM_ISSUED: 'Stock issued', PURCHASE_REQUEST_CREATED: 'Purchase request created' };
const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { timeZone: 'UTC' });
const style = { scrollbarWidth: 'thin' as const, scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' };
const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export default function ItemRequestsPanel({ navigation, onPending }: { navigation: React.ReactNode; onPending: (count: number) => void }) {
 const [correction, setCorrection] = useState<{ movement: EditableMovement; locations: { id: string; name: string }[]; allowRecipient: boolean; allowLocation: boolean } | null>(null);
 const [returnIssue, setReturnIssue] = useState<LedgerIssue | null>(null);
 const [entries, setEntries] = useState<Entry[]>([]);
 const [page, setPage] = useState(1);
 const [count, setCount] = useState(0);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [search, setSearch] = useState('');
 const [from, setFrom] = useState(stockToday);
 const [to, setTo] = useState(stockToday);
 const rangeLabel = !from && !to ? 'All dates' : from === to ? new Date(from + 'T12:00:00Z').toLocaleDateString('en-IN', { timeZone: 'UTC' }) : `${from ? new Date(from + 'T12:00:00Z').toLocaleDateString('en-IN', { timeZone: 'UTC' }) : 'Start'} to ${to ? new Date(to + 'T12:00:00Z').toLocaleDateString('en-IN', { timeZone: 'UTC' }) : 'today'}`;
 const setRange = (start: string, end: string) => { setFrom(start); setTo(end); setPage(1); setLoading(true); };
 const today = stockToday();
 const [detail, setDetail] = useState<Entry | null>(null);
 const [review, setReview] = useState<Entry | null>(null);
 const [decision, setDecision] = useState('APPROVED');
 const [reason, setReason] = useState('');
 const [saving, setSaving] = useState(false);
 const [pick, setPick] = useState<{ entry: Entry; lineIndex: number } | null>(null);
 const [items, setItems] = useState<Item[]>([]);
 const [itemId, setItemId] = useState('');
 const [itemsLoading, setItemsLoading] = useState(false);
 const [itemsError, setItemsError] = useState('');
 const [issue, setIssue] = useState<{ item: Item; entry: Entry; lineIndex: number } | null>(null);
 const load = useCallback(async (signal?: AbortSignal) => {
  try { const res = await api.get('/admin/inventory/ledger', { params: { page, from: from || undefined, to: to || undefined }, signal }); if (!signal?.aborted) { setEntries(res.data.data); setCount(res.data.count); onPending(res.data.pendingCount); setError(''); } }
  catch (err) { if (!signal?.aborted) setError(getErrorMessage(err, 'Could not load ledger')); }
  finally { if (!signal?.aborted) setLoading(false); }
 }, [page, from, to, onPending]);
 useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => { if (!controller.signal.aborted) return load(controller.signal); }); return () => controller.abort(); }, [load]);
 const refresh = () => { setLoading(true); void load(); };
 const reviewRequest = async (event: React.FormEvent) => {
  event.preventDefault(); if (!review || saving) return; setSaving(true);
  try { await api.post(`/admin/inventory/item-requests/${review.id}/review`, { revision: review.revision, decision, reason }); setReview(null); toast.success('Request reviewed'); refresh(); }
  catch (err) { toast.error(getErrorMessage(err, 'Could not review request')); } finally { setSaving(false); }
 };
 const purchase = async (entry: Entry) => {
  if (saving) return; setSaving(true);
  try { await api.post(`/admin/inventory/item-requests/${entry.id}/create-purchase-request`, { requestId: crypto.randomUUID(), revision: entry.revision }); setDetail(null); toast.success('Purchase request created for the remaining quantity'); updateInventoryNavigation({ tab: 'purchases', purchaseTab: 'requests' }); }
  catch (err) { toast.error(getErrorMessage(err, 'Could not create purchase request')); refresh(); } finally { setSaving(false); }
 };
 const chooseItem = async (entry: Entry, lineIndex: number) => {
  setDetail(null); setPick({ entry, lineIndex }); setItemId(''); setItemsLoading(true); setItemsError('');
  try { const res = await api.get('/admin/inventory/items'); setItems(res.data.data); }
  catch (err) { setItemsError(getErrorMessage(err, 'Could not load available items')); } finally { setItemsLoading(false); }
 };
 const selected = items.find(item => item.id === itemId);
 const candidates = pick ? items.filter(item => [item.unit.name, item.unit.abbreviation].filter(Boolean).some(value => norm(value!) === norm(pick.entry.fulfilment[pick.lineIndex].unit)) && item.balances.some(balance => Number(balance.quantity) > 0)) : [];
 const filtered = entries.filter(entry => `${entry.requestedByName} ${entry.department} ${entry.fulfilment.map(line => line.name).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
 const canIssue = (entry: Entry) => entry.ledgerSource !== 'DIRECT' && ['APPROVED', 'PARTIALLY_ISSUED'].includes(entry.status);
 return <>
  <PageHeader title="Ledger" subtitle="Track requests, items given out and returns by date." center={navigation}><div className="flex items-center gap-3 flex-wrap"><InventorySearch value={search} onChange={setSearch} label="Search ledger" placeholder="Search this page..." /><div className="flex items-center gap-1.5"><input aria-label="From date" type="date" value={from} max={to || undefined} className={inputCls + ' w-36 h-[30px]'} onChange={e => setRange(e.target.value, to)} /><span className="text-xs text-muted-foreground">to</span><input aria-label="To date" type="date" value={to} min={from || undefined} className={inputCls + ' w-36 h-[30px]'} onChange={e => setRange(from, e.target.value)} /></div><div className="flex gap-1">{[{ label: 'Today', start: today, end: today }, { label: 'This month', start: today.slice(0, 8) + '01', end: today }, { label: 'All', start: '', end: '' }].map(chip => <SmallButton key={chip.label} onClick={() => setRange(chip.start, chip.end)}>{chip.label}</SmallButton>)}</div></div></PageHeader>
  <LedgerRegister entries={filtered} loading={loading} error={error} rangeLabel={rangeLabel} page={page} count={count} search={search} onView={setDetail} onReview={entry => { setReview(entry); setDecision('APPROVED'); setReason(''); }} onRetry={refresh} onPage={value => { setLoading(true); setPage(value); }} />
  <Dialog open={!!detail} onOpenChange={open => { if (!open && !saving) setDetail(null); }}><DialogContent className="sm:max-w-xl max-h-[85vh] bg-card flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6"><DialogTitle>Ledger entry</DialogTitle><DialogDescription>{detail?.requestedByName} - {detail && labels[detail.ledgerStatus || detail.status]}</DialogDescription></DialogHeader>{detail && <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1" style={style}><p className="text-xs text-muted-foreground">{detail.ledgerSource === 'DIRECT' ? 'Issue date' : 'Required by'}: {date(detail.requiredOn)}{detail.department && ` | ${detail.department}`}</p><p className="text-sm whitespace-pre-wrap break-words">{detail.reason}</p>{detail.fulfilment.map((line, index) => <div key={index} className="rounded-xl bg-muted/30 p-3 space-y-2"><p className="text-sm font-semibold">{line.name}</p><p className="text-xs text-muted-foreground">{detail.ledgerSource === 'DIRECT' ? 'Quantity' : 'Requested'}: {line.quantity} {line.unit} | Issued: {line.issued} | Pending: {line.pending}</p>{canIssue(detail) && line.pending > 0 && <SmallButton disabled={saving} onClick={() => void chooseItem(detail, index)}><PackageMinus size={13} />Issue stock</SmallButton>}</div>)}{detail.issues.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold">Issue and return register</h3>{detail.issues.map(stock => <div key={stock.id} className="rounded-xl bg-muted/30 p-3 space-y-2"><p className="text-sm font-semibold">{stock.item.name} ({stock.item.code})</p><p className="text-xs">Given out: {stock.quantity} {stock.item.unit.abbreviation || stock.item.unit.name} | From: {stock.location.name}</p><p className="text-xs text-muted-foreground">Issue: {stock.occurredAt ? inventoryDateTime(stock.occurredAt) : date(stock.recordedOn)} | Recorded at: {inventoryDateTime(stock.createdAt)}</p><p className="text-xs text-muted-foreground">Issued by: {stock.issuedByName}{stock.dueOn && (' | Return due: ' + date(stock.dueOn))}</p>{stock.notes && <p className="text-xs whitespace-pre-wrap">{stock.notes}</p>}<LedgerAttachmentList attachments={stock.attachments} /><SmallButton onClick={() => { setDetail(null); setCorrection({ movement: stock, locations: Array.from(new Map([...stock.item.balances.filter(b => Number(b.quantity) > 0).map(b => [b.locationId, { id: b.locationId, name: b.location.name }] as const), [stock.locationId, { id: stock.locationId, name: stock.location.name }] as const]).values()), allowRecipient: detail.ledgerSource === 'DIRECT', allowLocation: !stock.returns.length }); }}>Edit entry / Attachments</SmallButton><LedgerCorrectionHistory corrections={stock.corrections} />{stock.returnExpected ? <><p className="text-xs">Returned: {stock.returnedQuantity} | Pending return: {stock.outstandingQuantity} | Damaged: {stock.damagedQuantity} | Lost: {stock.lostQuantity}</p>{stock.outstandingQuantity > 0 && <SmallButton onClick={() => { setDetail(null); setReturnIssue(stock); }}>Return / Damaged / Lost</SmallButton>}</> : <p className="text-xs text-muted-foreground">Consumable - no return expected.</p>}{stock.returns.map(record => <div key={record.id} className="border-t border-border/40 pt-2 text-xs space-y-1"><p className="font-medium">{record.kind === 'RETURN' ? 'Returned' : record.kind === 'ISSUE_DAMAGED' ? 'Damaged' : 'Lost'}: {record.quantity}</p><p className="text-muted-foreground">Date: {record.occurredAt ? inventoryDateTime(record.occurredAt) : date(record.recordedOn)} | Recorded at: {inventoryDateTime(record.createdAt)}</p><p className="text-muted-foreground">Recorded by: {record.recordedByName}</p>{record.notes && <p className="whitespace-pre-wrap">{record.notes}</p>}<LedgerAttachmentList attachments={record.attachments} /><SmallButton onClick={() => { setDetail(null); setCorrection({ movement: { ...record, issuedToName: stock.issuedToName }, locations: [{ id: record.locationId, name: stock.location.name }], allowRecipient: false, allowLocation: false }); }}>Edit entry / Attachments</SmallButton><LedgerCorrectionHistory corrections={record.corrections} /></div>)}</div>)}</div>}{canIssue(detail) && !detail.linkedPurchaseRequestId && !detail.purchaseOrder && <div className="space-y-2"><p className="text-xs text-muted-foreground">Need to buy the remaining items? Create a purchase request for approval.</p><SecondaryButton disabled={saving} onClick={() => void purchase(detail)}><ShoppingCart size={14} />{saving ? 'Creating...' : 'Create Purchase Request'}</SecondaryButton></div>}{detail.linkedPurchaseRequestId && <SmallButton onClick={() => updateInventoryNavigation({ tab: 'purchases', purchaseTab: 'requests' })}>View Purchases</SmallButton>}{detail.ledgerSource !== 'DIRECT' && <div className="border-t border-border/40 pt-3 space-y-3"><h3 className="text-sm font-semibold">Request history</h3>{detail.events.map((event, i) => <div key={i} className="text-xs"><p className="font-medium">{labels[event.action] || event.action}{event.action === 'ITEM_ISSUED' && event.lineIndex != null && `: ${detail.fulfilment[event.lineIndex]?.name} - ${event.quantity}`}</p><p className="text-muted-foreground">{inventoryDateTime(event.at)}</p>{event.reason && <p className="mt-1 whitespace-pre-wrap break-words">{event.reason}</p>}</div>)}</div>}</div>}</DialogContent></Dialog>
  <Dialog open={!!review} onOpenChange={open => { if (!open && !saving) setReview(null); }}><DialogContent className="sm:max-w-md bg-card max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-6"><DialogTitle>Review item request</DialogTitle><DialogDescription>{review?.requestedByName}</DialogDescription></DialogHeader><form onSubmit={reviewRequest} className="flex-1 min-h-0 flex flex-col overflow-hidden"><div className="flex-1 min-h-0 overflow-y-auto space-y-4" style={style}><fieldset disabled={saving} className="space-y-4"><Field label="Decision"><ThemedSelect value={decision} onChange={setDecision} options={[{ value: 'APPROVED', label: 'Approve' }, { value: 'CHANGES_REQUESTED', label: 'Request changes' }, { value: 'REJECTED', label: 'Reject' }]} /></Field><Field label={decision === 'APPROVED' ? 'Notes (optional)' : 'Reason *'}><textarea required={decision !== 'APPROVED'} maxLength={1000} className={`${inputCls} h-24 py-2 resize-none`} value={reason} onChange={e => setReason(e.target.value)} /></Field></fieldset></div><div className="shrink-0 flex justify-end gap-2 border-t border-border/40 pt-3 mt-4"><SecondaryButton type="button" disabled={saving} onClick={() => setReview(null)}>Cancel</SecondaryButton><PrimaryButton disabled={saving || (decision !== 'APPROVED' && !reason.trim())} type="submit">{saving ? 'Saving...' : 'Confirm'}</PrimaryButton></div></form></DialogContent></Dialog>
  <Dialog open={!!pick} onOpenChange={open => { if (!open) setPick(null); }}><DialogContent className="sm:max-w-lg bg-card"><DialogHeader><DialogTitle>Choose stock to issue</DialogTitle><DialogDescription>{pick && `${pick.entry.fulfilment[pick.lineIndex].name} - ${pick.entry.fulfilment[pick.lineIndex].pending} ${pick.entry.fulfilment[pick.lineIndex].unit} pending`}</DialogDescription></DialogHeader>{itemsLoading ? <p className="text-sm text-muted-foreground">Loading available stock...</p> : itemsError ? <p role="alert" className="text-sm text-red-500">{itemsError}</p> : <><Field label="Inventory item"><ThemedSelect value={itemId} onChange={setItemId} options={candidates.map(item => ({ value: item.id, label: `${item.name} (${item.code}) - ${item.balances.reduce((sum, b) => sum + Number(b.quantity), 0)} ${item.unit.abbreviation || item.unit.name} available` }))} placeholder="Select matching stock item" /></Field>{!candidates.length && <p className="text-xs text-muted-foreground">No stock is available with the requested unit. Return to the request and create a purchase request if needed.</p>}<div className="flex justify-end gap-2"><SecondaryButton onClick={() => setPick(null)}>Cancel</SecondaryButton><PrimaryButton disabled={!selected || !pick} onClick={() => { if (selected && pick) { setIssue({ item: selected, ...pick }); setPick(null); } }}>Continue</PrimaryButton></div></>}</DialogContent></Dialog>
  {correction && <LedgerCorrectionDialog {...correction} onClose={() => setCorrection(null)} onSaved={refresh} />}
  {returnIssue && <IssuedStockDialog item={returnIssue.item} issueId={returnIssue.id} onClose={() => setReturnIssue(null)} onSaved={() => { refresh(); }} />}
  {issue && <IssueStockDialog item={issue.item} request={{ id: issue.entry.id, revision: issue.entry.revision, lineIndex: issue.lineIndex, pending: issue.entry.fulfilment[issue.lineIndex].pending, teacherName: issue.entry.requestedByName }} onClose={() => setIssue(null)} onSaved={() => { setIssue(null); refresh(); }} />}
 </>;
}
