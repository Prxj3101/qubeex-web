'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, CalendarRange, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { formatINR, monthLabel } from '@/lib/payroll';
import { PageHeader, PrimaryButton, EmptyState, Pill, StatCard, TERRACOTTA } from '../_components/ui';

interface PayrollRun {
    id: string; month: string; status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED'; publishState?: 'RUNNING' | 'FAILED' | null; publishedAt: string | null;
    staffCount: number; totalNetPay: number; paidCount: number;
}

function currentMonthValue(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function PayrollRunsPage() {
    const router = useRouter();
    const [runs, setRuns] = useState<PayrollRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newMonth, setNewMonth] = useState(currentMonthValue());
    const [toDelete, setToDelete] = useState<PayrollRun | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchRuns = useCallback(() => {
        api.get('/admin/payroll/runs')
            .then(res => setRuns(res.data.data ?? []))
            .catch(() => setRuns([]))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { fetchRuns(); }, [fetchRuns]);

    const existing = runs.find(r => r.month === newMonth);

    const createRun = async () => {
        if (existing) { router.push(`/admin/payroll/runs/${existing.id}`); return; }
        setCreating(true);
        try {
            const res = await api.post('/admin/payroll/runs', { month: newMonth });
            toast.success(`Payroll ready for ${monthLabel(newMonth)}`);
            // Keep the "working" state on until the run page opens.
            router.push(`/admin/payroll/runs/${res.data.data.id}`);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to start payroll'));
            setCreating(false);
        }
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/payroll/runs/${toDelete.id}`);
            toast.success('Draft deleted');
            setToDelete(null);
            fetchRuns();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to delete'));
        } finally {
            setDeleting(false);
        }
    };

    const latestPublished = runs.find(r => r.status === 'PUBLISHED');
    const drafts = runs.filter(r => r.status !== 'PUBLISHED').length;
    const waiting = runs.filter(r => r.status === 'PENDING_APPROVAL').length;

    return (
        <div className="space-y-3">
            <PageHeader title="Payroll Runs" subtitle="One run per month: check salaries, then publish payslips">
                <input type="month" value={newMonth} onChange={e => setNewMonth(e.target.value)} disabled={creating}
                    className="h-8 px-3 rounded-xl border border-border bg-background text-xs focus:outline-none focus:border-foreground/30" />
                <PrimaryButton onClick={createRun} disabled={creating || !newMonth}>
                    {existing ? <>Open {monthLabel(newMonth)} <ChevronRight size={14} /></> : creating ? <><Loader2 size={14} className="animate-spin" /> Running payroll…</> : <><Plus size={14} /> Run Payroll</>}
                </PrimaryButton>
            </PageHeader>

            {/* Shown while the run is being created (salaries are worked out on the server). */}
            {creating && (
                <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                        <Loader2 size={18} className="animate-spin text-muted-foreground shrink-0" />
                        <div>
                            <p className="text-sm font-semibold">Running payroll for {monthLabel(newMonth)}…</p>
                            <p className="text-xs text-muted-foreground">Working out salaries for all active staff. This takes a few seconds, please keep this page open.</p>
                        </div>
                    </div>
                    <div className="h-1 bg-muted overflow-hidden">
                        <div className="h-full w-1/3 rounded-full animate-[payroll-progress_1.2s_ease-in-out_infinite]" style={{ background: TERRACOTTA }} />
                    </div>
                    <style>{`@keyframes payroll-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
                </div>
            )}

            {!loading && runs.length > 0 && (
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                    <StatCard label="Last paid month" value={latestPublished ? monthLabel(latestPublished.month) : 'None yet'} sub={latestPublished ? `${formatINR(latestPublished.totalNetPay)} to ${latestPublished.staffCount} staff` : undefined} />
                    <StatCard label="Not published yet" value={String(drafts)} sub={waiting ? `${waiting} waiting for approval` : drafts ? 'Being prepared' : 'Nothing pending'} />
                    <StatCard label="Runs so far" value={String(runs.length)} />
                </div>
            )}

            {loading ? (
                <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />)}</div>
            ) : runs.length === 0 ? (
                <EmptyState icon={CalendarRange} title="No payroll runs yet"
                    text="Pick a month above and press Run Payroll. Salaries are worked out for all active staff automatically." />
            ) : (
                <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/40 overflow-hidden">
                    {runs.map(run => (
                        <div key={run.id} role="button" tabIndex={0}
                            onClick={() => router.push(`/admin/payroll/runs/${run.id}`)}
                            onKeyDown={e => e.key === 'Enter' && router.push(`/admin/payroll/runs/${run.id}`)}
                            className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center shrink-0 leading-none">
                                <span className="text-[9px] font-bold uppercase">{new Date(`${run.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</span>
                                <span className="text-[10px] font-semibold mt-0.5">{run.month.slice(0, 4)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold flex items-center gap-1.5">
                                    {monthLabel(run.month)}
                                    {run.publishState === 'RUNNING' ? <Pill tone="amber">Publishing…</Pill>
                                        : run.publishState === 'FAILED' ? <Pill tone="red">Publish stopped</Pill>
                                        : run.status === 'PUBLISHED' ? <Pill tone="green">Published</Pill>
                                        : run.status === 'APPROVED' ? <Pill tone="primary">Approved</Pill>
                                        : run.status === 'PENDING_APPROVAL' ? <Pill tone="amber">Waiting for approval</Pill>
                                        : <Pill>Draft</Pill>}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    {run.staffCount} staff
                                    {run.status === 'PUBLISHED' && ` · ${run.paidCount} of ${run.staffCount} paid`}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold">{formatINR(run.totalNetPay)}</p>
                                <p className="text-[10px] text-muted-foreground">total take-home</p>
                            </div>
                            {run.status === 'DRAFT' && (
                                <button title="Delete draft" onClick={e => { e.stopPropagation(); setToDelete(run); }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500">
                                    <Trash2 size={13} />
                                </button>
                            )}
                            <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground" />
                        </div>
                    ))}
                </div>
            )}

            <DeleteConfirmDialog
                open={!!toDelete}
                onOpenChange={o => !o && setToDelete(null)}
                label="draft payroll"
                name={toDelete ? monthLabel(toDelete.month) : ''}
                loading={deleting}
                onConfirm={confirmDelete}
                description="All draft payslips in this run are removed. You can run this month again afterwards."
            />
        </div>
    );
}
