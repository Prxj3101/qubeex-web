'use client';
import { ClipboardCheck, Eye, Loader2 } from 'lucide-react';
import { inventoryDateTime } from './inventory-date-time';
import type { LedgerEntry } from './ItemRequestsPanel';

const day = (value: string) => new Date(value).toLocaleDateString('en-IN', { timeZone: 'UTC' });
const status: Record<string, string> = { PENDING: 'Pending approval', APPROVED: 'Approved', REJECTED: 'Rejected', CHANGES_REQUESTED: 'Changes requested', PARTIALLY_ISSUED: 'Partially issued', ISSUED: 'Issued', RETURN_PENDING: 'Return pending', RETURNED: 'Returned', CLOSED: 'Closed' };
const remarkColour: Record<string, string> = { PENDING: '#80530c', CHANGES_REQUESTED: '#8c5310', APPROVED: '#285c36', REJECTED: '#9e3030', PARTIALLY_ISSUED: '#274e86', ISSUED: '#274e86', RETURN_PENDING: '#80530c', RETURNED: '#285c36', CLOSED: '#5e503f' };
const ink = 'border border-[#96a58a]/55 px-3 py-3 align-top';
const number = ink + ' text-center tabular-nums font-medium';

export function LedgerRegister({ entries, loading, error, rangeLabel, page, count, search, onView, onReview, onRetry, onPage }: {
 entries: LedgerEntry[]; loading: boolean; error: string; rangeLabel: string; page: number; count: number; search: string;
 onView: (entry: LedgerEntry) => void; onReview: (entry: LedgerEntry) => void; onRetry: () => void; onPage: (page: number) => void;
}) {
 return <section data-admin-surface="" className="flex-1 min-h-0 flex flex-col rounded-sm overflow-hidden" style={{ colorScheme: 'light', color: '#1e2f43', backgroundColor: '#e2e9d5', backgroundImage: 'linear-gradient(90deg, rgba(54,72,45,0.07), transparent 18px, transparent calc(100% - 8px), rgba(54,72,45,0.025)), radial-gradient(ellipse at 30% 10%, rgba(248,253,237,0.18), transparent 80%), url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%27.65%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 opacity=%27.085%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")', boxShadow: '0 3px 12px rgba(0,0,0,0.1)'  }}>
  <div className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-4 bg-[#d5dfc5] border-b border-[#96a58a]/55">
   <div aria-hidden="true" /><div className="text-center"><div><h2 className="font-serif text-lg font-bold tracking-[0.06em] uppercase">School Material Issue & Return Ledger</h2></div></div>
   <span className="justify-self-end text-[11px] text-[#4f5c69] whitespace-nowrap">{rangeLabel} | {count} {count === 1 ? 'entry' : 'entries'} | Page {page}</span>
  </div>
  <div className="flex-1 min-h-0 overflow-auto overscroll-contain ledger-scrollbar">
   <table className="w-full min-w-[1480px] border-collapse text-left text-[13px]">
    <thead className="sticky top-0 z-10 bg-[#d5dfc5]">
     <tr className="font-serif text-[13px] text-[#293c55]">
      <th rowSpan={2} className={ink + ' w-14 text-center'}>Sr. No.</th><th rowSpan={2} className={ink + ' w-44'}>Recipient / Department</th><th rowSpan={2} className={ink + ' w-40'}>Date & Time</th><th rowSpan={2} className={ink + ' w-48'}>Particulars of Material</th>
      <th colSpan={7} className={ink + ' text-center py-2'}>Quantity Account</th><th rowSpan={2} className={ink + ' w-32'}>Issued From / By</th><th rowSpan={2} className={ink + ' w-44'}>Remarks / Status</th><th rowSpan={2} className={ink + ' w-28'}>Actions</th>
     </tr>
     <tr>{['Requested', 'Issued', 'Returned', 'To Issue', 'Pending Return', 'Damaged / Lost', 'Unit'].map(label => <th key={label} className={ink + ' text-center py-2 whitespace-nowrap'}>{label}</th>)}</tr>
    </thead>
    <tbody>{loading || error || !entries.length ? <tr><td colSpan={14} className={ink + ' py-14 text-center'}>{loading ? <><Loader2 size={16} className="inline animate-spin mr-2" />Loading ledger...</> : error ? <><p role="alert" className="text-red-500 mb-3">{error}</p><button type="button" onClick={onRetry} className="underline text-[#244888]">Retry</button></> : search ? 'No matching ledger entries.' : 'No entries for this period.'}</td></tr> : entries.flatMap((entry, entryIndex) => entry.fulfilment.map((line, lineIndex) => {
     const ids = new Set(entry.events.filter(e => e.action === 'ITEM_ISSUED' && e.lineIndex === lineIndex).map(e => e.movementId));
     const issues = entry.ledgerSource === 'DIRECT' ? entry.issues : entry.issues.filter(i => ids.has(i.id));
     const sum = (key: 'returnedQuantity' | 'outstandingQuantity' | 'damagedQuantity' | 'lostQuantity') => issues.reduce((n, i) => n + i[key], 0);
     const span = entry.fulfilment.length;
     return <tr key={`${entry.id}_${lineIndex}`} className="bg-transparent hover:bg-[#cbd8bc]/40">
      {lineIndex === 0 && <><td rowSpan={span} className={number + ' w-[58px]'}>{(page - 1) * 50 + entryIndex + 1}</td><td rowSpan={span} className={ink}><p className="font-semibold">{entry.requestedByName}</p><p className="mt-1 opacity-90">{entry.department.replaceAll('_', ' ')}</p><p className="mt-2 text-[11px] italic opacity-90">{entry.ledgerSource === 'DIRECT' ? 'Direct issue' : 'Teacher request'}</p></td></>}
      <td className={ink}><div className="space-y-3">{entry.ledgerSource !== 'DIRECT' && <div><p className="font-medium">Requested</p><p className="text-[11px] opacity-95">{inventoryDateTime(entry.createdAt)}</p></div>}{issues.map(i => <div key={i.id} className="space-y-2"><div><p className="font-medium text-[#244888]">Issued: {i.quantity} {line.unit}</p><p className="text-[11px] opacity-95">{i.occurredAt ? inventoryDateTime(i.occurredAt) : day(i.recordedOn)}</p>{!i.occurredAt && <p className="text-[11px] opacity-90">Recorded at: {inventoryDateTime(i.createdAt)}</p>}</div>{i.returns.map(r => <div key={r.id}><p className="font-medium" style={{ color: r.kind === 'RETURN' ? '#2a533d' : '#8d3d39' }}>{r.kind === 'RETURN' ? 'Returned' : r.kind === 'ISSUE_DAMAGED' ? 'Damaged' : 'Lost'}: {r.quantity} {line.unit}</p><p className="text-[11px] opacity-95">{r.occurredAt ? inventoryDateTime(r.occurredAt) : day(r.recordedOn)}</p>{!r.occurredAt && <p className="text-[11px] opacity-90">Recorded at: {inventoryDateTime(r.createdAt)}</p>}</div>)}</div>)}{!issues.length && <p className="text-[11px] opacity-90">Required: {day(entry.requiredOn)}</p>}</div></td>
      <td className={ink}><p className="font-medium">{line.name}</p>{issues.map(i => <div key={i.id} className="text-[11px] opacity-90 mt-1">{i.item.name !== line.name && `${i.item.name} - `}{i.item.code}</div>)}</td>
      <td className={number}>{entry.ledgerSource === 'DIRECT' ? '-' : line.quantity}</td><td className={number + ' text-[#244888] italic'}>{line.issued || '-'}</td><td className={number + ' text-[#2a533d] italic'}>{sum('returnedQuantity') || '-'}</td><td className={number}>{line.pending || '-'}</td><td className={number}>{issues.some(i => i.returnExpected) ? sum('outstandingQuantity') : '-'}</td><td className={number}><span className="text-[#8d3d39]">{sum('damagedQuantity')} / {sum('lostQuantity')}</span></td><td className={number}>{line.unit}</td>
      <td className={ink}>{issues.length ? issues.map(i => <div key={i.id} className="mb-2 last:mb-0"><p>{i.location.name}</p><p className="text-[11px] opacity-90 mt-1">{i.issuedByName}</p>{i.dueOn && <p className="mt-1 text-[11px]">Due: {day(i.dueOn)}</p>}</div>) : '-'}</td>
      {lineIndex === 0 && <><td rowSpan={span} className={ink}><span style={{ color: remarkColour[entry.ledgerStatus || entry.status] || '#414f63', borderColor: remarkColour[entry.ledgerStatus || entry.status] || '#414f63' }} className="inline-block border-b pb-0.5 font-serif italic font-semibold">{status[entry.ledgerStatus || entry.status] || entry.status}</span><p style={{ color: remarkColour[entry.ledgerStatus || entry.status] || '#414f63' }} className="mt-2 whitespace-pre-wrap break-words">{entry.reason || '-'}</p>{entry.linkedPurchaseRequestId && <p className="text-[11px] mt-2 text-[#654584]">Purchase request created</p>}</td><td rowSpan={span} className={ink}><div className="flex flex-col items-start gap-2"><button type="button" onClick={() => onView(entry)} className="flex items-center gap-1.5 text-[#244888] hover:underline focus-visible:outline focus-visible:outline-2"><Eye size={13} />View &amp; Edit</button>{entry.status === 'PENDING' && <button type="button" onClick={() => onReview(entry)} className="flex items-center gap-1.5 text-[#244888] hover:underline focus-visible:outline focus-visible:outline-2"><ClipboardCheck size={13} />Review</button>}</div></td></>}
     </tr>;
    }))}</tbody>
   </table>
  </div>
  <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-[#d5dfc5] border-t border-[#96a58a]/55 text-[10px] text-[#4f5c69]"><span>Pending return = quantity still with recipient. Damaged / Lost = quantities recorded separately.</span>{count > 50 && <div className="flex gap-2"><button type="button" className="text-[#244888] underline disabled:opacity-40" disabled={page === 1 || loading} onClick={() => onPage(page - 1)}>Previous</button><button type="button" className="text-[#244888] underline disabled:opacity-40" disabled={page * 50 >= count || loading} onClick={() => onPage(page + 1)}>Next</button></div>}</div>
 </section>;
}
