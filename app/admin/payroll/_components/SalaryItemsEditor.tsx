'use client';

// Pick salary components and give each a value, with a live monthly preview.
// Used by both Templates and a staff member's Salary screen.

import { useMemo } from 'react';
import Link from 'next/link';
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react';
import {
    SalaryComponent, StructureItem, formatINR, previewMonthly,
    paiseToInput, rupeesToPaise, bpToInput, percentToBp,
} from '@/lib/payroll';

export function SalaryItemsEditor({ items, components, onChange }: {
    items: StructureItem[];
    components: SalaryComponent[];
    onChange: (items: StructureItem[]) => void;
}) {
    const byId = useMemo(() => new Map(components.map(c => [c.id, c])), [components]);
    const used = new Set(items.map(i => i.componentId));
    const available = components.filter(c => !used.has(c.id));
    const preview = previewMonthly(items, components);

    const sorted = [...items].sort((a, b) => (byId.get(a.componentId)?.sortOrder ?? 0) - (byId.get(b.componentId)?.sortOrder ?? 0));
    const earningItems = sorted.filter(i => byId.get(i.componentId)?.type === 'EARNING');
    const deductionItems = sorted.filter(i => byId.get(i.componentId)?.type === 'DEDUCTION');
    const amountFor = (componentId: string, type: 'earnings' | 'deductions') =>
        preview[type].find(l => l.label === byId.get(componentId)?.name)?.amount ?? 0;

    const setValue = (componentId: string, text: string) => {
        const c = byId.get(componentId);
        if (!c) return;
        const value = c.calcType === 'PERCENT_OF_BASIC' ? percentToBp(text) : rupeesToPaise(text);
        onChange(items.map(i => i.componentId === componentId ? { ...i, value } : i));
    };
    const add = (c: SalaryComponent) => onChange([...items, { componentId: c.id, value: c.defaultValue }]);
    const remove = (componentId: string) => onChange(items.filter(i => i.componentId !== componentId));

    if (components.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                No salary components yet. <Link href="/admin/payroll/components" className="font-semibold text-primary">Set them up first →</Link>
            </div>
        );
    }

    const row = (it: StructureItem, type: 'earnings' | 'deductions') => {
        const c = byId.get(it.componentId);
        if (!c) return null;
        const isPercent = c.calcType === 'PERCENT_OF_BASIC';
        return (
            <div key={it.componentId} className="flex items-center gap-2 py-1.5">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {isPercent && <p className="text-[10px] text-muted-foreground">= {formatINR(amountFor(it.componentId, type))}</p>}
                </div>
                <div className="relative w-32 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{isPercent ? '%' : '₹'}</span>
                    <input
                        type="number" min={0} step="0.01"
                        className="w-full h-8 pl-6 pr-2 rounded-lg border border-border bg-background text-sm text-right focus:outline-none focus:border-foreground/30"
                        defaultValue={isPercent ? bpToInput(it.value) : paiseToInput(it.value)}
                        onChange={e => setValue(it.componentId, e.target.value)}
                    />
                </div>
                <button type="button" onClick={() => remove(it.componentId)} className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500">
                    <X size={13} />
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1"><TrendingUp size={13} /> Earnings</p>
                    {earningItems.length === 0 ? <p className="text-[11px] text-muted-foreground py-2">Nothing added</p> : earningItems.map(it => row(it, 'earnings'))}
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 mb-1"><TrendingDown size={13} /> Deductions</p>
                    {deductionItems.length === 0 ? <p className="text-[11px] text-muted-foreground py-2">Nothing added</p> : deductionItems.map(it => row(it, 'deductions'))}
                </div>
            </div>

            {available.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground mr-1">Add:</span>
                    {available.map(c => (
                        <button key={c.id} type="button" onClick={() => add(c)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-dashed border-border text-[11px] font-medium hover:border-foreground/30 hover:text-foreground transition-colors">
                            <Plus size={11} /> {c.name}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 border border-border/60 px-4 py-3">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gross / month</p>
                    <p className="text-sm font-bold">{formatINR(preview.grossPay)}</p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Deductions</p>
                    <p className="text-sm font-bold">{formatINR(preview.grossPay - preview.netPay)}</p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Take-home</p>
                    <p className="text-sm font-bold text-primary">{formatINR(preview.netPay)}</p>
                </div>
            </div>
        </div>
    );
}
