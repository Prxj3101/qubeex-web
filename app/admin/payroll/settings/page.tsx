'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Check, Save } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';
import { DayBasis, formatINR } from '@/lib/payroll';
import { PageHeader, PrimaryButton, Field, inputCls, TERRACOTTA } from '../_components/ui';

const BASIS_OPTIONS: { value: DayBasis; title: string; text: string }[] = [
    { value: 'CALENDAR', title: 'Actual days in month', text: 'One day = monthly salary ÷ 28 / 30 / 31, depending on the month.' },
    { value: 'FIXED_30', title: 'Fixed 30 days', text: 'One day = monthly salary ÷ 30, every month.' },
    { value: 'FIXED_26', title: 'Fixed 26 days', text: 'One day = monthly salary ÷ 26 (Sundays not counted).' },
];

// Worked example shown under the choice so the accountant sees what it means.
const EXAMPLE_SALARY = 3000000; // ₹30,000

export default function PayrollSettingsPage() {
    const [dayBasis, setDayBasis] = useState<DayBasis>('CALENDAR');
    // Kept as text so the field can be cleared and typed into freely;
    // validated (1 to 28) only on blur / save.
    const [payDay, setPayDay] = useState('1');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/admin/payroll/settings')
            .then(res => { setDayBasis(res.data.data.dayBasis); setPayDay(String(res.data.data.payDay)); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const payDayNum = Number(payDay);
    const payDayValid = Number.isInteger(payDayNum) && payDayNum >= 1 && payDayNum <= 28;

    const save = async () => {
        if (!payDayValid) { toast.error('Salary day must be between 1 and 28'); return; }
        setSaving(true);
        try {
            await api.put('/admin/payroll/settings', { dayBasis, payDay: payDayNum });
            toast.success('Payroll settings saved');
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to save settings'));
        } finally {
            setSaving(false);
        }
    };

    const exampleDays = dayBasis === 'FIXED_26' ? 26 : 30;
    const perDay = Math.round(EXAMPLE_SALARY / exampleDays);

    if (loading) return <div className="h-64 rounded-2xl bg-muted/40 animate-pulse" />;

    return (
        <div className="space-y-3">
            <PageHeader title="Payroll Settings" subtitle="How salary is worked out for your school">
                <PrimaryButton onClick={save} disabled={saving}><Save size={14} /> {saving ? 'Saving…' : 'Save'}</PrimaryButton>
            </PageHeader>

            <div className="grid gap-4 lg:grid-cols-3">
            <section className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <div>
                    <p className="text-sm font-semibold">One day&apos;s salary</p>
                    <p className="text-xs text-muted-foreground">Used when someone takes unpaid leave (LOP) or joins / leaves in the middle of a month.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    {BASIS_OPTIONS.map(opt => {
                        const active = dayBasis === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setDayBasis(opt.value)}
                                className={`relative text-left rounded-xl border p-3.5 transition-all ${active ? 'border-foreground/40 bg-muted/40' : 'border-border hover:border-foreground/30'}`}
                            >
                                {active && <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full text-white flex items-center justify-center" style={{ background: TERRACOTTA }}><Check size={12} /></span>}
                                <p className="text-sm font-semibold pr-6">{opt.title}</p>
                                <p className="text-[11px] text-muted-foreground mt-1">{opt.text}</p>
                            </button>
                        );
                    })}
                </div>
                <div className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                    Example: salary {formatINR(EXAMPLE_SALARY)}, 2 days unpaid leave in a 30-day month →
                    one day = <span className="font-semibold text-foreground">{formatINR(perDay)}</span>, cut =
                    <span className="font-semibold text-foreground"> {formatINR(perDay * 2)}</span>.
                </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-primary" />
                    <p className="text-sm font-semibold">Salary day</p>
                </div>
                <Field label="Salary is usually paid on" hint="Day of the month (1 to 28)">
                    <input type="text" inputMode="numeric" maxLength={2} placeholder="1 to 28"
                        className={`${inputCls} ${payDay !== '' && !payDayValid ? 'border-red-500 focus:ring-red-500/30' : ''}`}
                        value={payDay}
                        onChange={e => setPayDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        onBlur={() => { if (payDay !== '' && !payDayValid) setPayDay(String(Math.min(28, Math.max(1, payDayNum)))); }} />
                </Field>
            </section>
            </div>
        </div>
    );
}
