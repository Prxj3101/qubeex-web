'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';

interface PayrollRun { id: string; month: string; status: 'DRAFT' | 'PUBLISHED'; publishedAt: string | null; }

function monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
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

    useEffect(() => {
        api.get('/admin/payroll/runs')
            .then(res => setRuns(res.data.data ?? []))
            .catch(() => setRuns([]))
            .finally(() => setLoading(false));
    }, []);

    const createRun = async () => {
        setCreating(true);
        try {
            const res = await api.post('/admin/payroll/runs', { month: newMonth });
            toast.success(`Payroll run created for ${monthLabel(newMonth)}`);
            router.push(`/admin/payroll/runs/${res.data.data.id}`);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to create payroll run'));
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Payroll</h1>
                    <p className="text-muted-foreground text-[13px]">Run monthly payroll and manage payslips</p>
                </div>
                <div className="flex items-center gap-2">
                    <input type="month" value={newMonth} onChange={e => setNewMonth(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-border bg-background text-sm" />
                    <button onClick={createRun} disabled={creating}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        <Plus size={14} /> {creating ? 'Creating…' : 'Run Payroll'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}</div>
            ) : runs.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No payroll runs yet.</div>
            ) : (
                <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden">
                    {runs.map(run => (
                        <button key={run.id} onClick={() => router.push(`/admin/payroll/runs/${run.id}`)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 text-left">
                            <span className="text-sm font-medium">{monthLabel(run.month)}</span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${run.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                {run.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
