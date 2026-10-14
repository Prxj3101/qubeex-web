'use client';
import { inventoryDateTime } from './inventory-date-time';
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, ClipboardList, History, PackagePlus, Paperclip, SlidersHorizontal, Undo2, UserRound, TriangleAlert } from 'lucide-react';
import { InventoryIconLabel } from './InventoryIconLabel';
import { recipientLabel } from './IssueStockDialog';
import { Pill, SmallButton } from '@/app/admin/payroll/_components/ui';
import type { HistoryRecord } from './ItemsPanel';

const quantity = (value: string | number) => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const actions: Record<string, { label: string; icon: typeof History; tone: 'green' | 'amber' | 'red' | 'muted' }> = {
 OPENING: { label: 'Starting stock', icon: ClipboardList, tone: 'muted' },
 OPENING_CORRECTION: { label: 'Starting stock correction', icon: SlidersHorizontal, tone: 'amber' },
 ADJUSTMENT: { label: 'Stock adjustment', icon: SlidersHorizontal, tone: 'amber' },
 RECEIPT: { label: 'Stock received', icon: PackagePlus, tone: 'green' },
 SUPPLIER_RETURN: { label: 'Returned to supplier', icon: Undo2, tone: 'amber' },
 ISSUE: { label: 'Stock issued', icon: ArrowUpRight, tone: 'muted' },
 RETURN: { label: 'Stock returned', icon: ArrowDownLeft, tone: 'green' },
 ISSUE_DAMAGED: { label: 'Issued item damaged', icon: TriangleAlert, tone: 'red' },
 ISSUE_LOST: { label: 'Issued item lost', icon: TriangleAlert, tone: 'red' },
 TRANSFER_OUT: { label: 'Stock transferred out', icon: ArrowRightLeft, tone: 'amber' },
 TRANSFER_IN: { label: 'Stock transferred in', icon: ArrowRightLeft, tone: 'green' },
};

export function StockHistoryTimeline({ records, unit, suppliers, onAttachment }: {
 records: HistoryRecord[]; unit: string; suppliers: { id: string; name: string }[];
 onAttachment: (attachment: NonNullable<HistoryRecord['attachments']>[number]) => void;
}) {
 const sorted = [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id));
 return <div className="space-y-4 pr-1">
  <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{records.length} {records.length === 1 ? 'entry' : 'entries'}</span><span className="inline-flex items-center gap-1.5"><History size={13} />Latest first</span></div>
  {sorted.map((record, index) => {
   const action = actions[record.kind] || { label: record.kind.replaceAll('_', ' '), icon: History, tone: 'muted' as const };
   const Icon = action.icon;
   const unchanged = record.kind === 'ISSUE_DAMAGED' || record.kind === 'ISSUE_LOST';
   const adjusted = record.kind === 'OPENING_CORRECTION' || record.kind === 'ADJUSTMENT';
   const sign = ['RECEIPT', 'RETURN', 'TRANSFER_IN'].includes(record.kind) ? '+' : ['ISSUE', 'SUPPLIER_RETURN', 'TRANSFER_OUT'].includes(record.kind) ? '-' : '';
   const details: { label: string; value: React.ReactNode }[] = [{ label: 'Effective date', value: date(record.recordedOn) }];
   if (record.supplierName) details.push({ label: 'Supplier', value: <InventoryIconLabel kind="suppliers" name={record.supplierName} id={suppliers.find(s => s.name === record.supplierName)?.id} /> });
   if (record.purchaseOrder) details.push({ label: 'Purchase order', value: record.purchaseOrder.number });
   if (record.issuedToName) details.push({ label: record.kind === 'RETURN' ? 'Returned by' : 'Issued to', value: `${record.issuedToName} (${recipientLabel(record.issuedToType, record.issuedToLabel)})` });
   if (record.dueOn && record.kind === 'ISSUE') details.push({ label: 'Return due', value: date(record.dueOn) });
   if (record.transferLocationName) details.push({ label: record.kind === 'TRANSFER_OUT' ? 'To location' : 'From location', value: <InventoryIconLabel kind="locations" name={record.transferLocationName} /> });
   if (record.kind === 'ADJUSTMENT') details.push({ label: 'Reason', value: record.adjustmentType === 'DAMAGED' ? 'Damaged' : record.adjustmentType === 'LOST' ? 'Lost' : 'Count correction' });
   if (record.billNumber) details.push({ label: 'Bill number', value: record.billNumber });
   if (record.billDate) details.push({ label: 'Bill date', value: date(record.billDate) });
   if (record.totalCost != null && record.totalCost !== '') details.push({ label: 'Cost', value: Number(record.totalCost).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) });
   const group = new Date(record.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
   const previousGroup = index ? new Date(sorted[index - 1].createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
   return <div key={record.id}>
    {group !== previousGroup && <p className="mb-3 text-xs font-semibold text-muted-foreground">{group}</p>}
    <article className="rounded-xl border border-border/60 bg-card overflow-hidden" data-admin-surface="">
     <div className="flex items-start gap-3 p-3 sm:p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon size={17} /></span>
      <div className="min-w-0 flex-1 space-y-1"><Pill tone={action.tone}>{action.label}</Pill><p className="text-xs text-muted-foreground">{inventoryDateTime(record.createdAt)}</p></div>
      <div className="text-right shrink-0"><p className="text-base font-semibold tabular-nums">{adjusted ? `${quantity(record.previousQuantity ?? '0')} → ${quantity(record.correctedQuantity ?? '0')}` : `${sign}${quantity(record.quantity)}`}</p><p className="text-xs text-muted-foreground">{unit}</p></div>
     </div>
     <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-3">
      {unchanged && <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Available stock unchanged. Pending return reduced by {quantity(record.quantity)} {unit}.</p>}
      {record.kind === 'RECEIPT' && <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5">{[['Delivered', record.deliveredQuantity ?? record.quantity], ['Rejected', record.rejectedQuantity ?? '0'], ['Accepted', record.quantity]].map(([label, value]) => <div key={label}><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{quantity(value)} <span className="font-normal text-xs text-muted-foreground">{unit}</span></p></div>)}</div>}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">{details.map(detail => <div key={detail.label} className="min-w-0"><dt className="text-[11px] text-muted-foreground">{detail.label}</dt><dd className="mt-1 text-xs font-medium break-words">{detail.value}</dd></div>)}</dl>
      {record.damageReason && <div><p className="text-[11px] text-muted-foreground">Damage/rejection reason</p><p className="mt-1 text-xs break-words whitespace-pre-wrap">{record.damageReason}</p></div>}
      {record.notes && <div className="border-t border-border/50 pt-3"><p className="text-[11px] text-muted-foreground">Notes</p><p className="mt-1 text-xs break-words whitespace-pre-wrap">{record.notes}</p></div>}
      {!!record.attachments?.length && <div className="space-y-2"><p className="text-[11px] text-muted-foreground">Documents ({record.attachments.length})</p><div className="flex flex-wrap gap-2">{record.attachments.map((attachment, i) => <SmallButton key={i} onClick={() => onAttachment(attachment)}><Paperclip size={12} /><span className="max-w-40 truncate">{attachment.name}</span><span className="text-muted-foreground">View</span></SmallButton>)}</div></div>}
     </div>
     <div className="flex items-start gap-2 border-t border-border/50 bg-muted/20 px-3 py-2.5 sm:px-4 text-xs text-muted-foreground"><UserRound size={13} className="shrink-0 mt-0.5" /><span className="break-words">Recorded by <span className="font-medium text-foreground">{record.createdByName || 'Unknown'}</span></span></div>
    </article>
   </div>;
  })}
 </div>;
}
