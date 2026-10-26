'use client';

// Small shared building blocks for the Payroll screens. Colours come from
// theme tokens (primary / muted / border / card), except PrimaryButton, which
// uses the same terracotta gradient as the rest of the dashboard's main
// action buttons (e.g. "Add New Teacher").

import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Dashboard terracotta gradient, used for main buttons and toggles. */
export const TERRACOTTA = 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)';

export function PageHeader({ title, subtitle, children, onBack, center }: { title: string; subtitle?: string; children?: React.ReactNode; onBack?: () => void; center?: React.ReactNode }) {
    return (
        // Same header + separator layout as Support → Tickets.
        <div className="shrink-0 pt-0 pb-0 px-1 sticky top-0 z-20 bg-background">
            {/* With a `center` slot: title | center | actions, centre truly centred on wide screens. */}
            <div className={center
                ? 'flex flex-wrap items-center gap-2 pt-1 xl:grid xl:grid-cols-[1fr_auto_1fr]'
                : 'flex items-center justify-between flex-wrap gap-2 pt-1'}>
                <div className="flex items-center gap-3">
                    {onBack && (
                        // Same back button as the teacher detail page.
                        <button type="button" onClick={onBack} aria-label="Back"
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all shrink-0">
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-xl font-bold">{title}</h1>
                        {subtitle && <p className="text-muted-foreground text-[13px]">{subtitle}</p>}
                    </div>
                </div>
                {center && <div className="flex justify-center">{center}</div>}
                {children && <div className={`flex items-center gap-2 flex-wrap ${center ? 'ml-auto xl:ml-0 xl:justify-self-end' : ''}`}>{children}</div>}
            </div>
            <div className="h-px bg-border/60 mt-2" />
        </div>
    );
}

export function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={`inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:pointer-events-none ${className}`}
            style={{ background: TERRACOTTA, ...props.style }}
        >
            {children}
        </button>
    );
}

export function SecondaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={`inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted/50 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none ${className}`}
        >
            {children}
        </button>
    );
}

export function SmallButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold hover:bg-muted/50 transition-colors disabled:opacity-60 ${className}`}
        >
            {children}
        </button>
    );
}

export function EmptyState({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-14 px-6 border border-dashed border-border rounded-2xl bg-card/50">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Icon size={22} />
            </div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">{text}</p>
            {children && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div>}
        </div>
    );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            {children}
            {hint && <span className="block text-[11px] text-muted-foreground/80">{hint}</span>}
        </label>
    );
}

export const inputCls = 'w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-foreground/30';

/**
 * Themed dropdown (Radix Select) used instead of the browser's native
 * <select>. Its list renders in a portal, so it isn't clipped by a dialog's
 * scroll area. Pass value "" / null for "nothing chosen yet" (shows placeholder).
 */
export function ThemedSelect<T extends string>({ value, options, onChange, placeholder = 'Select…', className = '', triggerClassName = '' }: {
    value: T | '' | null;
    options: { value: T; label: React.ReactNode }[];
    onChange: (v: T) => void;
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
}) {
    return (
        <Select value={value || undefined} onValueChange={v => onChange(v as T)}>
            <SelectTrigger className={`w-full h-9 data-[size=default]:h-9 px-3 rounded-lg border-border bg-background text-sm focus-visible:ring-0 focus-visible:border-foreground/30 ${triggerClassName}`}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent position="popper" className={`bg-card border border-border rounded-xl shadow-xl ring-0 p-1 ${className}`}>
                {options.map(o => (
                    <SelectItem key={o.value} value={o.value} className="rounded-lg px-2.5 py-1.5 text-sm focus:bg-muted focus:text-foreground cursor-pointer">
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

// Same country codes / max digits as the phone fields elsewhere (teacher profile etc).
export const PHONE_CODES = [
    { code: '+91', flag: '🇮🇳', max: 10 },
    { code: '+1', flag: '🇺🇸', max: 10 },
    { code: '+44', flag: '🇬🇧', max: 10 },
    { code: '+61', flag: '🇦🇺', max: 9 },
    { code: '+971', flag: '🇦🇪', max: 9 },
    { code: '+65', flag: '🇸🇬', max: 8 },
];

export function parsePhone(val: string) {
    const match = (val ?? '').match(/^(\+\d+)\s*(.*)$/);
    return match ? { code: match[1], number: match[2] } : { code: '+91', number: (val ?? '').replace(/\D/g, '') };
}

// Digits only; a pasted number that starts with the country code ("+91 98765 43210") drops it.
const cleanNumber = (raw: string, code: string, max: number) => {
    let digits = raw.replace(/\D/g, '');
    const cc = code.replace(/\D/g, '');
    if (digits.length > max && digits.startsWith(cc)) digits = digits.slice(cc.length);
    return digits.slice(0, max);
};

/** True when the number part has all the digits its country code needs. */
export function phoneComplete(val: string) {
    const { code, number } = parsePhone(val);
    const max = PHONE_CODES.find(c => c.code === code)?.max ?? 10;
    return number.length === max;
}

/** Country code + digits-only number. Value is stored as "+91 9876543210" ("" when empty). */
export function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const { code, number } = parsePhone(value);
    const max = PHONE_CODES.find(c => c.code === code)?.max ?? 10;
    const emit = (c: string, n: string) => onChange(n ? `${c} ${n}` : '');
    return (
        <div className="flex gap-2">
            <ThemedSelect
                value={code}
                options={PHONE_CODES.map(c => ({ value: c.code, label: `${c.flag} ${c.code}` }))}
                onChange={c => {
                    const nextMax = PHONE_CODES.find(x => x.code === c)?.max ?? 10;
                    emit(c, number.slice(0, nextMax));
                }}
                triggerClassName="!w-[96px] shrink-0 text-xs font-medium px-2.5"
            />
            <input
                type="tel" inputMode="numeric" placeholder="98765 43210"
                className={inputCls}
                value={number}
                onChange={e => emit(code, cleanNumber(e.target.value, code, max))}
            />
        </div>
    );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="h-full flex flex-col justify-center rounded-2xl border border-border/60 bg-card px-3.5 py-2" data-admin-surface="">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{label}</p>
            <p className="text-base font-bold leading-snug">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground leading-tight truncate">{sub}</p>}
        </div>
    );
}

export function Pill({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'primary' | 'green' | 'amber' | 'red' | 'blue' }) {
    const tones: Record<string, string> = {
        muted: 'bg-muted text-muted-foreground',
        primary: 'bg-primary/10 text-primary',
        green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
        amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
        red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    };
    return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
}

/** Segmented choice (e.g. Earning / Deduction). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
    return (
        <div className="flex gap-1 bg-muted/50 rounded-full p-0.5 w-fit border border-border/50">
            {options.map(o => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${value === o.value ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    style={value === o.value ? { background: TERRACOTTA } : undefined}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
    return (
        <button type="button" onClick={() => onChange(!checked)} className="flex items-start gap-3 text-left w-full">
            <span className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? '' : 'bg-muted-foreground/30'}`}
                style={checked ? { background: TERRACOTTA } : undefined}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </span>
            <span>
                <span className="block text-sm font-medium">{label}</span>
                {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
            </span>
        </button>
    );
}
