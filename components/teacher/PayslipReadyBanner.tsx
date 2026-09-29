'use client';

// Overview strip: "October payslip ready" for a few days after payroll is published.
// Silent when the teacher isn't on payroll or nothing new was published.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, X, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { formatINR } from '@/lib/payroll';

interface Slip { id: string; netPay: number; payrollRun: { month: string; publishedAt: string | null } }

const SHOW_FOR_DAYS = 7;
const DISMISS_KEY = 'qx-payslip-banner-dismissed';

export default function PayslipReadyBanner() {
    const [slip, setSlip] = useState<Slip | null>(null);

    useEffect(() => {
        api.get('/teacher/payroll/payslips')
            .then(res => {
                const latest: Slip | undefined = (res.data.data ?? [])[0];
                if (!latest?.payrollRun.publishedAt) return;
                const age = Date.now() - new Date(latest.payrollRun.publishedAt).getTime();
                if (age > SHOW_FOR_DAYS * 86400000) return;
                let dismissed: string | null = null;
                try { dismissed = localStorage.getItem(DISMISS_KEY); } catch { /* storage blocked */ }
                if (dismissed !== latest.id) setSlip(latest);
            })
            .catch(() => { /* not on payroll - show nothing */ });
    }, []);

    const dismiss = () => {
        if (slip) { try { localStorage.setItem(DISMISS_KEY, slip.id); } catch { /* ignore */ } }
        setSlip(null);
    };

    const month = slip ? (() => { const [y, m] = slip.payrollRun.month.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long' }); })() : '';

    return (
        <AnimatePresence>
            {slip && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                    <Wallet size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 flex-1 leading-none">
                        Your {month} payslip is ready · <b>{formatINR(slip.netPay)}</b> take-home
                    </p>
                    <Link href="/teacher/profile?tab=payroll" onClick={dismiss}
                        className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline leading-none">
                        View <ChevronRight size={13} />
                    </Link>
                    <button onClick={dismiss} title="Dismiss" className="text-emerald-500 hover:text-emerald-700 transition-colors">
                        <X size={13} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
