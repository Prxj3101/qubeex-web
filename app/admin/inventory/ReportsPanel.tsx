'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Download, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { PageHeader, PrimaryButton, SecondaryButton, SmallButton, ThemedSelect, EmptyState, inputCls } from '@/app/admin/payroll/_components/ui';
import { stockToday } from './IssueStockDialog';

type Report = 'stock' | 'movements' | 'returns' | 'lowstock';
interface Data { institutionAbbreviation: string; columns: string[]; rows: { id: string; cells: (string | number)[] }[]; total: number; page: number; pageSize: number }
interface Lookup { id: string; name: string }
const tabs: { value: Report; label: string }[] = [{ value: 'stock', label: 'Stock' }, { value: 'movements', label: 'Movements' }, { value: 'returns', label: 'Pending returns' }, { value: 'lowstock', label: 'Low stock' }];
const movementOptions = [{ value: 'ALL', label: 'All movements' }, ...[['OPENING','Opening stock'],['OPENING_CORRECTION','Opening correction'],['RECEIPT','Received'],['ISSUE','Issued'],['RETURN','Returned'],['TRANSFER_OUT','Transfer out'],['TRANSFER_IN','Transfer in'],['ADJUSTMENT','Adjustment'],['SUPPLIER_RETURN','Supplier return'],['ISSUE_DAMAGED','Issued item damaged'],['ISSUE_LOST','Issued item lost']].map(([value,label]) => ({ value,label }))];

export default function ReportsPanel({ initialReport = 'stock', initialReturnStatus = 'pending' }: { initialReport?: Report; initialReturnStatus?: 'pending' | 'overdue' }) {
    const [report, setReport] = useState<Report>(initialReport);
    const [filters, setFilters] = useState({ search: '', locationId: 'ALL', categoryId: 'ALL', itemType: 'ALL', kind: 'ALL', returnStatus: initialReturnStatus as string, from: '', to: '' });
    const [page, setPage] = useState(1);
    const [asOf] = useState(stockToday);
    const [revision, setRevision] = useState(0);
    const [data, setData] = useState<(Data & { key: string }) | null>(null);
    const [error, setError] = useState<{ key: string; message: string } | null>(null);
    const [lookupError, setLookupError] = useState('');
    const [categories, setCategories] = useState<Lookup[]>([]);
    const [locations, setLocations] = useState<Lookup[]>([]);
    const [downloading, setDownloading] = useState(false);
    const params = { report, page, pageSize: 50, search: filters.search, asOf, ...(filters.locationId !== 'ALL' ? { locationId: filters.locationId } : {}), ...(filters.categoryId !== 'ALL' ? { categoryId: filters.categoryId } : {}), ...(filters.itemType !== 'ALL' ? { itemType: filters.itemType } : {}), ...(report === 'movements' ? { ...(filters.kind !== 'ALL' ? { kind: filters.kind } : {}), ...(filters.from ? { from: filters.from } : {}), ...(filters.to ? { to: filters.to } : {}) } : {}), ...(report === 'returns' ? { returnStatus: filters.returnStatus } : {}) };
    const key = JSON.stringify(params);
    const invalidDates = report === 'movements' && filters.from && filters.to && filters.from > filters.to;
    const current = data?.key === key ? data : null;
    const currentError = error?.key === key ? error.message : '';
    const update = (field: keyof typeof filters, value: string) => { setFilters(previous => ({ ...previous, [field]: value })); setPage(1); };
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([api.get('/admin/inventory/categories', { signal: controller.signal }), api.get('/admin/inventory/locations', { signal: controller.signal })])
            .then(([c,l]) => { if (!controller.signal.aborted) { setCategories(c.data.data); setLocations(l.data.data); setLookupError(''); } })
            .catch(err => { if (!controller.signal.aborted) setLookupError(getErrorMessage(err, 'Failed to load report filters')); });
        return () => controller.abort();
    }, [revision]);
    useEffect(() => {
        if (invalidDates) return;
        const controller = new AbortController();
        api.get('/admin/inventory/reports', { params: JSON.parse(key), signal: controller.signal })
            .then(res => { if (!controller.signal.aborted) { setData({ ...res.data.data, key }); setError(null); } })
            .catch(err => { if (!controller.signal.aborted) setError({ key, message: getErrorMessage(err, 'Failed to load report') }); });
        return () => controller.abort();
    }, [key, revision, invalidDates]);
    const download = async () => {
        if (downloading || !current) return; setDownloading(true);
        try {
            const snapshot = { ...params, page: 1, pageSize: 100 };
            const first: Data = (await api.get('/admin/inventory/reports', { params: snapshot })).data.data;
            const rows = [...first.rows];
            for (let next = 2; next <= Math.ceil(first.total / 100); next++) {
                const result: Data = (await api.get('/admin/inventory/reports', { params: { ...snapshot, page: next } })).data.data;
                if (result.total !== first.total) throw new Error('Inventory changed while downloading. Please try again.');
                rows.push(...result.rows);
            }
            if (rows.length !== first.total || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Inventory changed while downloading. Please try again.');
            const XLSX = await import('xlsx');
            const sheet = XLSX.utils.aoa_to_sheet([first.columns, ...rows.map(row => row.cells)]);
            sheet['!cols'] = first.columns.map(() => ({ wch: 24 }));
            const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Inventory');
            const abbreviation = first.institutionAbbreviation.replace(/[<>:"\/\\|?*\x00-\x1f]/g, '').trim() || 'Institution';
            const reportLabel = tabs.find(tab => tab.value === report)?.label || report;
            XLSX.writeFile(workbook, `${abbreviation} Inventory ${reportLabel} ${asOf}.xlsx`);
            toast.success('Report downloaded');
        } catch (err) { toast.error(getErrorMessage(err, 'Failed to download report')); }
        finally { setDownloading(false); }
    };
    return <>
        <PageHeader title="Reports" subtitle="View stock, inventory movements and pending returns.">
            <div className="flex flex-wrap items-center justify-end gap-3 max-w-full">
                <div className="relative w-full sm:w-52"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search report items" value={filters.search} maxLength={120} onChange={e => update('search', e.target.value)} placeholder="Search item name or code..." className="w-full h-8 pl-8 pr-3 rounded-full text-xs bg-muted/50 border border-border/50 focus:outline-none focus:border-primary/50" /></div>
                <div className="max-w-full overflow-x-auto"><div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">{tabs.map(tab => <button key={tab.value} type="button" aria-pressed={report === tab.value} onClick={() => { setReport(tab.value); setPage(1); }} className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${report === tab.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{tab.label}</button>)}</div></div>
                <PrimaryButton onClick={() => void download()} disabled={downloading || !current || !!currentError || !!invalidDates || !current.total}>{downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{downloading ? 'Downloading...' : 'Download Excel'}</PrimaryButton>
            </div>
        </PageHeader>
        <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                <div className="w-full sm:w-44"><ThemedSelect value={filters.locationId} onChange={v => update('locationId',v)} options={[{ value:'ALL',label:'All locations' },...locations.map(l => ({value:l.id,label:l.name}))]} /></div>
                <div className="w-full sm:w-44"><ThemedSelect value={filters.categoryId} onChange={v => update('categoryId',v)} options={[{ value:'ALL',label:'All categories' },...categories.map(c => ({value:c.id,label:c.name}))]} /></div>
                <div className="w-full sm:w-44"><ThemedSelect value={filters.itemType} onChange={v => update('itemType',v)} options={[{value:'ALL',label:'All item types'},{value:'CONSUMABLE',label:'Consumables'},{value:'RETURNABLE',label:'Returnable equipment'},{value:'FIXED_ASSET',label:'Fixed assets'}]} /></div>
                {report === 'movements' && <><div className="w-full sm:w-44"><ThemedSelect value={filters.kind} onChange={v => update('kind',v)} options={movementOptions} /></div><label className="flex items-center gap-2 text-xs text-muted-foreground">From<input type="date" className={`${inputCls} w-36`} value={filters.from} onChange={e => update('from',e.target.value)} /></label><label className="flex items-center gap-2 text-xs text-muted-foreground">To<input type="date" className={`${inputCls} w-36`} value={filters.to} onChange={e => update('to',e.target.value)} /></label></>}
                {report === 'returns' && <div className="w-full sm:w-44"><ThemedSelect value={filters.returnStatus} onChange={v => update('returnStatus',v)} options={[{value:'pending',label:'All pending returns'},{value:'overdue',label:'Overdue only'}]} /></div>}
                <SmallButton onClick={() => { setFilters({ search:'',locationId:'ALL',categoryId:'ALL',itemType:'ALL',kind:'ALL',returnStatus:'pending',from:'',to:'' }); setPage(1); }}>Clear filters</SmallButton>
            </div>
            {invalidDates && <p role="alert" className="text-xs text-red-500">From date must be on or before To date.</p>}
            {lookupError && <p role="alert" className="text-xs text-red-500">{lookupError} <button className="underline" onClick={() => setRevision(v => v+1)}>Retry</button></p>}
            {report === 'lowstock' && <p className="text-xs text-muted-foreground">{filters.locationId === 'ALL' ? 'Shows consumables at or below their low-stock limit. A limit of 0 disables the alert.' : 'Compares stock at the selected location with each item’s low-stock limit.'}</p>}
        </section>
        <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            {invalidDates ? <p className="py-10 text-center text-sm text-muted-foreground">Choose a valid date range to view movements.</p> : currentError ? <EmptyState icon={ClipboardList} title="Could not load report" text={currentError}><SecondaryButton onClick={() => { setError(null); setData(null); setRevision(v => v+1); }}>Retry</SecondaryButton></EmptyState> : !current ? <div role="status" className="flex justify-center items-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading report...</div> : !current.rows.length ? <EmptyState icon={ClipboardList} title="No matching records" text="Try changing the report filters." /> : <>
                <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="border-b border-border/60 text-muted-foreground"><tr>{current.columns.map(column => <th key={column} className="px-4 py-3 font-semibold whitespace-nowrap">{column}</th>)}</tr></thead><tbody className="divide-y divide-border/50">{current.rows.map(row => <tr key={row.id}>{row.cells.map((cell,index) => <td key={index} className="px-4 py-3"><span className="block min-w-16 max-w-xs break-words">{typeof cell === 'number' ? cell.toLocaleString('en-IN', {maximumFractionDigits:3}) : cell || '-'}</span></td>)}</tr>)}</tbody></table></div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border/50 text-xs text-muted-foreground"><p>{(current.page-1)*current.pageSize+1}-{Math.min(current.page*current.pageSize,current.total)} of {current.total} records</p><div className="flex gap-2"><SmallButton disabled={page<=1} onClick={() => setPage(v => v-1)}>Previous</SmallButton><SmallButton disabled={page*current.pageSize>=current.total} onClick={() => setPage(v => v+1)}>Next</SmallButton></div></div>
            </>}
        </section>
    </>;
}
