'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Trash2, Send, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';

interface LineItem { label: string; amount: number; }
interface Payslip {
    id: string; teacherId: string; teacherName: string;
    earnings: LineItem[]; deductions: LineItem[];
    grossPay: number; netPay: number;
    status: 'PENDING' | 'PAID'; pdfUrl: string | null;
}
interface RunDetail { id: string; month: string; status: 'DRAFT' | 'PUBLISHED'; payslips: Payslip[]; }

export default function PayrollRunDetailPage() {
    const params = useParams<{ id: string }>();
    const [run, setRun] = useState<RunDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);

    const fetchRun = useCallback(() => {
        api.get(`/admin/payroll/runs/${params.id}`)
            .then(res => setRun(res.data.data))
            .catch(() => setRun(null))
            .finally(() => setLoading(false));
    }, [params.id]);

    useEffect(() => { fetchRun(); }, [fetchRun]);

    const removePayslip = async (payslipId: string) => {
        try {
            await api.delete(`/admin/payroll/runs/${params.id}/payslips/${payslipId}`);
            toast.success('Removed from this run');
            fetchRun();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to remove'));
        }
    };

    const publish = async () => {
        if (!confirm('Publish this payroll run? Payslips will be locked and teachers notified.')) return;
        setPublishing(true);
        try {
            await api.post(`/admin/payroll/runs/${params.id}/publish`);
            toast.success('Payroll run published');
            fetchRun();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to publish'));
        } finally {
            setPublishing(false);
        }
    };

    const markPaid = async (payslipId: string) => {
        try {
            await api.patch(`/admin/payroll/payslips/${payslipId}/mark-paid`, { paymentMethod: 'Bank Transfer' });
            toast.success('Marked as paid');
            fetchRun();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to mark paid'));
        }
    };

    if (loading) return <div className="h-40 rounded-xl bg-muted/40 animate-pulse" />;
    if (!run) return <div className="py-12 text-center text-sm text-muted-foreground">Payroll run not found.</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">{run.month} Payroll</h1>
                    <p className="text-muted-foreground text-[13px]">{run.payslips.length} teacher{run.payslips.length !== 1 ? 's' : ''}</p>
                </div>
                {run.status === 'DRAFT' ? (
                    <button onClick={publish} disabled={publishing || run.payslips.length === 0}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        <Send size={14} /> {publishing ? 'Publishing…' : 'Publish'}
                    </button>
                ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">Published</span>
                )}
            </div>

            <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden">
                {run.payslips.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                            <p className="text-sm font-medium">{p.teacherName}</p>
                            <p className="text-[11px] text-muted-foreground">Gross ₹{p.grossPay.toLocaleString('en-IN')} · Net ₹{p.netPay.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {run.status === 'PUBLISHED' && (
                                p.status === 'PAID' ? (
                                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle2 size={12} /> Paid</span>
                                ) : (
                                    <button onClick={() => markPaid(p.id)} className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold">Mark Paid</button>
                                )
                            )}
                            {p.pdfUrl && (
                                <a href={p.pdfUrl} target="_blank" rel="noopener noreferrer" className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold flex items-center">View PDF</a>
                            )}
                            {run.status === 'DRAFT' && (
                                <button onClick={() => removePayslip(p.id)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                            )}
                        </div>
                    </div>
                ))}
                {run.payslips.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">No teachers have a salary structure assigned yet.</div>
                )}
            </div>
        </div>
    );
}
