'use client';

import { Printer } from 'lucide-react';
import type { AdmissionFormConfig, FormField, FormValues } from '@/app/admin/admissions/admissions.types';
import { BoxText, PageBackground, boxTexts, boxValue } from '@/app/admin/admissions/formTemplate';

// The admission form as it is printed: the school's own pages with the answers
// on top, or the general A4 layout. Used by the print page and by the parent's
// online form (to see it filled before sending).

export interface PrintData {
    school: { name: string; logoUrl: string | null; address: string; phone: string; email: string };
    session: string;
    config: AdmissionFormConfig;
    application: { applicationNo: string; admissionNo: string | null; childName: string; className: string } | null;
    values: FormValues;
}

const showDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v);

function Value({ field, value }: { field: FormField; value: string | boolean | undefined }) {
    if (field.type === 'checkbox') return <span className="text-[13px]">{value === true ? '☑ Yes   ☐ No' : value === false ? '☐ Yes   ☐ No' : '☐ Yes   ☐ No'}</span>;
    if (field.type === 'select' && !value) return <span className="text-[11px] text-slate-500">{field.options.map(o => `☐ ${o}`).join('    ')}</span>;
    const text = typeof value === 'string' ? (field.type === 'date' ? showDate(value) : value) : '';
    return <span className={`block min-h-[20px] text-[13px] font-semibold ${field.type === 'textarea' ? 'min-h-[40px] whitespace-pre-wrap' : ''}`}>{text || ' '}</span>;
}

/** `toolbar` shows the Print bar (print page); `embedded` fits it inside another page. */
export function PrintedForm({ d, toolbar = true, embedded = false }: { d: PrintData; toolbar?: boolean; embedded?: boolean }) {
    const { school, config: cfg, application: app, values } = d;
    const own = cfg.template?.kind === 'UPLOAD' && cfg.template.pages.length > 0;

    // The school's own form: each page exactly as uploaded, answers on top.
    if (own) {
        const fields = cfg.sections.flatMap(s => s.fields);
        return (
            <div className={`${embedded ? '' : 'min-h-screen'} bg-slate-100 print:bg-white text-slate-900`} style={{ colorScheme: 'light' }}>
                <style>{`@page { size: auto; margin: 0; } @media print { .no-print { display: none !important; } .own-sheet { box-shadow: none !important; margin: 0 !important; break-after: page; } .own-sheet:last-child { break-after: auto; } }`}</style>
                {toolbar && <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
                    <p className="text-sm font-semibold">{cfg.title}{app ? ` - ${app.childName}` : ' (blank)'}</p>
                    <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#DA7756] px-5 text-sm font-semibold text-white hover:opacity-95"><Printer size={15} />Print</button>
                </div>}
                {cfg.template.pages.map((pg, i) => {
                    const px = pg.width * (96 / 72);
                    const texts = boxTexts(cfg.template.boxes, cfg.template.pages, b => boxValue(b, fields.find(f => f.id === b.fieldId), values[b.fieldId]));
                    return (
                        <div key={i} className="own-sheet relative mx-auto my-6 overflow-hidden bg-white shadow-lg" style={{ width: `${pg.width}pt`, height: `${pg.height}pt` }}>
                            <PageBackground page={pg} width={px} sharpness={2.5} />
                            {cfg.template.boxes.filter(b => b.page === i).map(b => <BoxText key={b.id} box={b} text={texts.get(b.id) ?? ''} page={pg} pageWidthPx={px} />)}
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className={`${embedded ? '' : 'min-h-screen'} bg-slate-100 print:bg-white text-slate-900`} style={{ colorScheme: 'light', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
            <style>{`@page { size: A4; margin: 10mm; } @media print { .no-print { display: none !important; } .sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; padding: 0 !important; } .avoid-break { break-inside: avoid; } }`}</style>

            {toolbar && <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
                <p className="text-sm font-semibold">{cfg.title}{app ? ` - ${app.childName}` : ' (blank)'}</p>
                <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#DA7756] px-5 text-sm font-semibold text-white hover:opacity-95"><Printer size={15} />Print</button>
            </div>}

            <div className="sheet mx-auto my-6 w-[210mm] bg-white p-[12mm] shadow-lg">
                {/* Header */}
                <header className="flex items-start gap-4 border-b-2 border-slate-800 pb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {school.logoUrl ? <img src={school.logoUrl} alt="" className="h-20 w-20 object-contain" /> : <div className="h-20 w-20" />}
                    <div className="flex-1 text-center">
                        <h1 className="text-2xl font-extrabold uppercase tracking-wide">{school.name}</h1>
                        {school.address && <p className="text-[12px] text-slate-600">{school.address}</p>}
                        {(school.phone || school.email) && <p className="text-[12px] text-slate-600">{[school.phone && `Phone: ${school.phone}`, school.email && `Email: ${school.email}`].filter(Boolean).join(' | ')}</p>}
                        <p className="mt-2 inline-block rounded border border-slate-800 px-4 py-0.5 text-[15px] font-bold uppercase tracking-wider">{cfg.title} {d.session && `(${d.session})`}</p>
                    </div>
                    {cfg.photoBox ? (
                        <div className="flex h-[45mm] w-[35mm] shrink-0 items-center justify-center border-2 border-dashed border-slate-500 p-2 text-center text-[10px] text-slate-500">Paste a recent passport size photo</div>
                    ) : <div className="h-20 w-20" />}
                </header>

                <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                    <p>Application no: <span className="font-bold">{app?.applicationNo ?? '__________'}</span></p>
                    <p>Admission no: <span className="font-bold">{app?.admissionNo ?? '__________'}</span></p>
                    <p>Class: <span className="font-bold">{app?.className ?? '__________'}</span></p>
                </div>

                {/* Sections */}
                {cfg.sections.map((s, i) => (
                    <section key={s.id} className="avoid-break mt-4">
                        <h2 className="bg-slate-800 px-2 py-1 text-[12px] font-bold uppercase tracking-wider text-white">{i + 1}. {s.title}</h2>
                        <div className="grid grid-cols-2 border-l border-t border-slate-400">
                            {s.fields.map(f => (
                                <div key={f.id} className={`border-b border-r border-slate-400 px-2 py-1.5 ${f.type === 'textarea' ? 'col-span-2' : ''}`}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{f.label}{f.required && ' *'}</p>
                                    <Value field={f} value={values[f.id]} />
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                {/* Declaration and signatures */}
                <section className="avoid-break mt-5">
                    {cfg.declaration && <>
                        <h2 className="text-[12px] font-bold uppercase tracking-wider">Declaration</h2>
                        <p className="mt-1 text-[12px] leading-relaxed">{cfg.declaration}</p>
                    </>}
                    <div className="mt-3 grid grid-cols-2 gap-4 text-[12px]">
                        <p>Date: ____________________</p>
                        <p>Place: ____________________</p>
                    </div>
                    {cfg.signatures.length > 0 && (
                        <div className="mt-10 grid gap-6" style={{ gridTemplateColumns: `repeat(${cfg.signatures.length}, minmax(0, 1fr))` }}>
                            {cfg.signatures.map(sig => (
                                <div key={sig} className="border-t border-slate-800 pt-1 text-center text-[11px] font-semibold">Signature of {sig}</div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="avoid-break mt-6 border-2 border-slate-800 p-2">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider">For office use</h2>
                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-[11px]">
                        <p>Admitted to class / section: ______________</p>
                        <p>Admission fee receipt no: ______________</p>
                        <p>Documents checked by: ______________</p>
                        <p>Date: ______________</p>
                    </div>
                </section>
            </div>
        </div>
    );
}
