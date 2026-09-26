'use client';

import { useState, useEffect } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import { FaFilePdf } from 'react-icons/fa';
import api from '@/lib/api';
import { formatINR } from '@/lib/payroll';

interface Payslip {
    id: string; grossPay: number; netPay: number; status: 'PENDING' | 'PAID';
    payrollRun: { month: string; publishedAt: string };
}

function monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function MyPayslipsPage() {
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        api.get('/teacher/payroll/payslips')
            .then(res => setPayslips(res.data.data ?? []))
            .catch(() => setPayslips([]))
            .finally(() => setLoading(false));
    }, []);

    const handleDownloadPdf = async (payslipId: string) => {
        setDownloadingId(payslipId);
        try {
            const res = await api.get(`/teacher/payroll/payslips/${payslipId}/pdf`, { responseType: 'blob' });
            const blob = res.data as Blob;
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Failed to download payslip:', error);
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2"><Wallet size={20} /> My Payslips</h1>
                <p className="text-muted-foreground text-[13px]">View and download your published payslips</p>
            </div>

            {loading ? (
                <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
            ) : payslips.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No payslips published yet.</div>
            ) : (
                <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden">
                    {payslips.map(p => (
                        <div key={p.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                                <p className="text-sm font-medium">{monthLabel(p.payrollRun.month)}</p>
                                <p className="text-[11px] text-muted-foreground">Net Pay: {formatINR(p.netPay)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}`}>
                                    {p.status === 'PAID' ? 'Paid' : 'Pending'}
                                </span>
                                <button
                                    onClick={() => handleDownloadPdf(p.id)}
                                    disabled={downloadingId === p.id}
                                    title="Download payslip PDF"
                                    className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/50 disabled:opacity-50"
                                >
                                    {downloadingId === p.id ? <Loader2 size={13} className="animate-spin text-muted-foreground" /> : <FaFilePdf size={16} className="text-red-600 dark:text-red-400" />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
