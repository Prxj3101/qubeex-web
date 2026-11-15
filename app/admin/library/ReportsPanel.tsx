'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileBarChart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { EmptyState, Field, SecondaryButton, SmallButton, inputCls } from '@/app/admin/payroll/_components/ui';

type ReportKey = 'overdue' | 'most-issued' | 'never-issued' | 'stock' | 'fines' | 'member';
const REPORTS: { key: ReportKey; label: string; text: string }[] = [
    { key: 'overdue', label: 'Overdue', text: 'Books past their due date' },
    { key: 'most-issued', label: 'Most issued', text: 'Popular books' },
    { key: 'never-issued', label: 'Never issued', text: 'Books nobody has borrowed' },
    { key: 'stock', label: 'Stock', text: 'Copies by status' },
    { key: 'fines', label: 'Fines', text: 'Totals by status' },
    { key: 'member', label: 'Member history', text: 'Everything a member has borrowed' },
];
const PAGE_SIZE = 50;

interface ReportData { columns: string[]; rows: Record<string, string | number | null>[]; total?: number; extra?: { member?: { name: string; code: string } } }

const heading = (column: string) => column.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace('Paise', '(paise)');

export default function ReportsPanel() {
    const [report, setReport] = useState<ReportKey>('overdue');
    const [page, setPage] = useState(1);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [code, setCode] = useState('');

    const request = useCallback((format?: 'csv') => {
        const path = report === 'member' ? `/admin/library/reports/member/${encodeURIComponent(code.trim())}` : `/admin/library/reports/${report}`;
        return api.get(path, {
            params: { page, pageSize: PAGE_SIZE, format, from: report === 'most-issued' && from ? from : undefined, to: report === 'most-issued' && to ? to : undefined },
            responseType: format === 'csv' ? 'blob' : 'json',
        });
    }, [report, page, from, to, code]);

    const idle = report === 'member' && !code.trim();
    const key = `${report}|${page}|${from}|${to}|${code.trim()}`;
    const [result, setResult] = useState<{ key: string; data: ReportData | null } | null>(null);

    useEffect(() => {
        if (idle) return;
        let live = true;
        request()
            .then((res) => { if (live) setResult({ key, data: res.data.data as ReportData }); })
            .catch((err) => { if (live) { setResult({ key, data: null }); toast.error(getErrorMessage(err, 'Could not load the report')); } });
        return () => { live = false; };
    }, [request, key, idle]);

    const loading = !idle && result?.key !== key;
    const data = !idle && result?.key === key ? result.data : null;

    const download = async () => {
        try {
            const res = await request('csv');
            const url = URL.createObjectURL(res.data as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `library-${report}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not download the report')); }
    };

    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

    return (
        <div className="space-y-3 pb-10">
            <div className="flex flex-wrap gap-1.5">
                {REPORTS.map((r) => (
                    <button key={r.key} type="button" title={r.text} onClick={() => { setReport(r.key); setPage(1); }} aria-pressed={report === r.key}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${report === r.key ? 'bg-primary text-white border-primary' : 'border-border bg-card hover:bg-muted/50'}`}>{r.label}</button>
                ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
                {report === 'most-issued' && <>
                    <Field label="From"><input type="date" className={inputCls} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></Field>
                    <Field label="To"><input type="date" className={inputCls} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></Field>
                </>}
                {report === 'member' && <Field label="Member ID"><input className={inputCls} value={code} onChange={(e) => { setCode(e.target.value); setPage(1); }} placeholder="e.g. student ID" /></Field>}
                <SecondaryButton onClick={() => void download()} disabled={loading || !data}><Download size={14} /> Download CSV</SecondaryButton>
            </div>

            {report === 'member' && data?.extra?.member && <p className="text-sm font-semibold">{data.extra.member.name} · {data.extra.member.code}</p>}

            {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
                : !data ? <EmptyState icon={FileBarChart} title={report === 'member' ? 'Enter a member ID' : 'No data'} text={report === 'member' ? 'Type a student, teacher or staff ID to see their borrowing history.' : 'Nothing to show for this report.'} />
                : data.rows.length === 0 ? <EmptyState icon={FileBarChart} title="Nothing here" text="This report has no rows right now." />
                : (
                    <div className="rounded-2xl border border-border bg-card overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50"><tr>{data.columns.map((c) => <th key={c} className="text-left px-3 py-2 text-xs font-semibold whitespace-nowrap">{heading(c)}</th>)}</tr></thead>
                            <tbody>
                                {data.rows.map((row, i) => (
                                    <tr key={i} className="border-t border-border/60">{data.columns.map((c) => <td key={c} className="px-3 py-2 whitespace-nowrap">{row[c] ?? '—'}</td>)}</tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

            {data?.total !== undefined && totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 text-xs">
                    <SmallButton type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={12} /> Prev</SmallButton>
                    <span>Page {page} of {totalPages}</span>
                    <SmallButton type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight size={12} /></SmallButton>
                </div>
            )}
        </div>
    );
}
