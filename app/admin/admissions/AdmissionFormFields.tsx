'use client';

import type { FormField, FormSection, FormValues } from './admissions.types';

/**
 * The school's admission form as inputs. Used by the office (dashboard look)
 * and by parents on the public page (bigger, friendlier inputs), so both fill
 * exactly the same form.
 */
export default function AdmissionFormFields({ sections, values, onChange, variant = 'admin', disabled = false }: {
    sections: FormSection[];
    values: FormValues;
    onChange: (id: string, value: string | boolean) => void;
    variant?: 'admin' | 'public';
    disabled?: boolean;
}) {
    const big = variant === 'public';
    const input = big
        ? 'w-full h-12 px-4 rounded-2xl border-2 border-slate-200 bg-white text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#DA7756] focus:ring-4 focus:ring-[#DA7756]/15 disabled:opacity-60'
        : 'w-full h-9 px-3 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';
    const area = big ? `${input} h-24 py-3 resize-none` : `${input} h-20 py-2 resize-none`;

    const control = (f: FormField) => {
        const v = values[f.id];
        const text = typeof v === 'string' ? v : '';
        const common = { id: `af-${f.id}`, disabled, required: f.required };
        switch (f.type) {
            case 'textarea': return <textarea {...common} maxLength={1000} className={area} value={text} onChange={e => onChange(f.id, e.target.value)} />;
            case 'date': return <input {...common} type="date" className={input} value={text} onChange={e => onChange(f.id, e.target.value)} />;
            case 'number': return <input {...common} inputMode="numeric" maxLength={40} className={input} value={text} onChange={e => onChange(f.id, e.target.value.replace(/[^\d.]/g, ''))} />;
            case 'select': return (
                <select {...common} className={input} value={text} onChange={e => onChange(f.id, e.target.value)}>
                    <option value="">Choose</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            );
            case 'checkbox': return (
                <label className={`flex items-center gap-2 ${big ? 'text-[15px]' : 'text-sm'}`}>
                    <input type="checkbox" disabled={disabled} checked={v === true} onChange={e => onChange(f.id, e.target.checked)} className="h-5 w-5 accent-[#DA7756]" />
                    Yes
                </label>
            );
            default: return <input {...common} maxLength={300} className={input} value={text} onChange={e => onChange(f.id, e.target.value)} />;
        }
    };

    return (
        <div className={big ? 'space-y-5' : 'space-y-4'}>
            {sections.map((s, i) => (
                <section key={s.id} className={big ? 'rounded-[28px] bg-white/95 p-5 sm:p-6 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70' : ''}>
                    <h3 className={big ? 'mb-4 flex items-center gap-2.5 text-base sm:text-lg font-bold' : 'mb-2 text-sm font-semibold'}>
                        {big && <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF1EA] text-sm font-bold text-[#C06040]">{i + 1}</span>}
                        {s.title}
                    </h3>
                    <div className={`grid gap-3 ${big ? 'sm:grid-cols-2 gap-4' : 'sm:grid-cols-2'}`}>
                        {s.fields.map(f => (
                            <div key={f.id} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                                <label htmlFor={`af-${f.id}`} className={`block font-semibold mb-1 ${big ? 'text-[13px] text-slate-700' : 'text-xs text-muted-foreground'}`}>
                                    {f.label}{f.required && <span className="text-[#DA7756]"> *</span>}
                                </label>
                                {control(f)}
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
