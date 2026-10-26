'use client';

import { School } from 'lucide-react';
import { DoodleBackground } from './Doodles';

// Shared frame for the parents' admission pages (form, success, status).
// Always light and friendly, whatever theme the browser or dashboard uses.

export const fieldCls = 'w-full h-12 px-4 rounded-2xl border-2 border-slate-200 bg-white text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#DA7756] focus:ring-4 focus:ring-[#DA7756]/15 disabled:opacity-60';

// Same country codes and digit counts as the phone fields in the dashboard.
const PHONE_CODES = [
    { code: '+91', flag: '🇮🇳', max: 10 },
    { code: '+1', flag: '🇺🇸', max: 10 },
    { code: '+44', flag: '🇬🇧', max: 10 },
    { code: '+61', flag: '🇦🇺', max: 9 },
    { code: '+971', flag: '🇦🇪', max: 9 },
    { code: '+65', flag: '🇸🇬', max: 8 },
];
function splitPhone(val: string) {
    const m = (val ?? '').match(/^(\+\d+)\s*(.*)$/);
    return m ? { code: m[1], number: m[2] } : { code: '+91', number: (val ?? '').replace(/\D/g, '') };
}
// Digits only; a pasted number that starts with the country code ("+91 98765 43210") drops it.
const cleanNumber = (raw: string, code: string, max: number) => {
    let digits = raw.replace(/\D/g, '');
    const cc = code.replace(/\D/g, '');
    if (digits.length > max && digits.startsWith(cc)) digits = digits.slice(cc.length);
    return digits.slice(0, max);
};

/** True when the number has every digit its country code needs. */
export function phoneComplete(val: string) {
    const { code, number } = splitPhone(val);
    return number.length === (PHONE_CODES.find(c => c.code === code)?.max ?? 10);
}

/** Country code + mobile number, stored as "+91 9876543210" ("" when empty). */
export function PhoneField({ value, onChange, required, autoComplete }: { value: string; onChange: (v: string) => void; required?: boolean; autoComplete?: string }) {
    const { code, number } = splitPhone(value);
    const max = PHONE_CODES.find(c => c.code === code)?.max ?? 10;
    const emit = (c: string, n: string) => onChange(n ? `${c} ${n}` : '');
    return (
        <div className="flex gap-2">
            <select aria-label="Country code" value={code}
                onChange={e => { const c = e.target.value; emit(c, number.slice(0, PHONE_CODES.find(x => x.code === c)?.max ?? 10)); }}
                className={`${fieldCls} !w-[104px] shrink-0 !px-3 font-semibold`}>
                {PHONE_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <input type="tel" inputMode="numeric" required={required} autoComplete={autoComplete}
                pattern={`\\d{${max}}`} title={`Enter a ${max} digit mobile number`}
                placeholder={`${max} digit mobile`} className={fieldCls} value={number}
                onChange={e => emit(code, cleanNumber(e.target.value, code, max))} />
        </div>
    );
}

export function SchoolBadge({ name, logoUrl, size = 'md' }: { name: string; logoUrl: string | null; size?: 'md' | 'lg' }) {
    const box = size === 'lg' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl';
    return logoUrl
        ? <img src={logoUrl} alt={`${name} logo`} className={`${box} object-contain bg-white shadow-sm ring-1 ring-slate-200`} />
        : <span className={`${box} flex items-center justify-center bg-[#FDE2D8] text-[#C06040] ring-1 ring-[#F5C2B0]`}><School size={size === 'lg' ? 30 : 22} /></span>;
}

export default function ApplyShell({ school, subtitle, left, right, progress, footer, children }: {
    school: { name: string; logoUrl: string | null } | null;
    subtitle?: string;
    /** Shown on wide screens beside the school name, so the header space is used. */
    left?: React.ReactNode;
    right?: React.ReactNode;
    /** 0 to 1: a thin bar along the bottom of the header (form filling progress). */
    progress?: number;
    /** Sticky bar at the bottom (the form's consent + send button). */
    footer?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="relative min-h-screen text-slate-900" style={{ colorScheme: 'light', fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
            <DoodleBackground lift={!!footer} />
            <header className="sticky top-0 z-30 border-b border-white/60 bg-white/75 backdrop-blur-md">
                <div className="mx-auto max-w-6xl px-4 py-2.5 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div className="hidden lg:flex justify-start min-w-0">{left}</div>
                    <div className="flex items-center justify-center gap-3 min-w-0">
                        {school ? <SchoolBadge name={school.name} logoUrl={school.logoUrl} /> : <span className="w-12 h-12 shrink-0 rounded-xl bg-slate-200 animate-pulse" />}
                        <div className="min-w-0 text-left">
                            <p className="truncate text-lg sm:text-xl font-extrabold leading-tight tracking-tight">{school?.name ?? 'Loading...'}</p>
                            {subtitle && <p className="truncate text-[12px] sm:text-[13px] font-medium text-slate-500">{subtitle}</p>}
                        </div>
                    </div>
                    <div className="hidden lg:flex justify-end min-w-0">{right}</div>
                </div>
                {progress !== undefined && (
                    <div className="h-1 w-full bg-slate-200/60" role="progressbar" aria-label="Form progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full rounded-r-full transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%`, background: 'linear-gradient(90deg, #34D399, #10B981)' }} />
                    </div>
                )}
            </header>

            <main className={`relative z-10 mx-auto max-w-2xl px-4 pt-6 ${footer ? 'pb-48 md:pb-56' : 'pb-48 md:pb-60'}`}>
                {children}
            </main>

            {footer && (
                <div className="fixed bottom-0 inset-x-0 z-30 border-t border-white/60 bg-white/85 backdrop-blur-md shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]">
                    <div className="mx-auto max-w-2xl px-4 py-3">{footer}</div>
                </div>
            )}
        </div>
    );
}

/** Small rounded info chip for the header sides. */
export function HeaderChip({ icon, title, text }: { icon: React.ReactNode; title: string; text?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-slate-200/70">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF1EA] text-[16px]">{icon}</span>
            <div className="min-w-0">
                <p className="truncate text-[13px] font-bold leading-tight">{title}</p>
                {text && <div className="truncate text-[11px] text-slate-500">{text}</div>}
            </div>
        </div>
    );
}

/** A white form card with a coloured number badge and a title. */
export function SectionCard({ n, color, icon, title, hint, children }: { n: number; color: string; icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section className="rounded-[28px] bg-white/95 p-5 sm:p-6 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70">
            <div className="flex items-center gap-3 mb-4">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: color }}>
                    {icon}
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">{n}</span>
                </span>
                <div>
                    <h2 className="text-base sm:text-lg font-bold leading-tight">{title}</h2>
                    {hint && <p className="text-[12px] text-slate-500">{hint}</p>}
                </div>
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );
}
