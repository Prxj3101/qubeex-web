'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, ClipboardList, Eye, X } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import ApplyShell, { HeaderChip } from '../../../_components/ApplyShell';
import { BookDoodle, StarDoodle } from '../../../_components/Doodles';
import AdmissionFormFields from '@/app/admin/admissions/AdmissionFormFields';
import type { FormSection, FormValues } from '@/app/admin/admissions/admissions.types';
import { PrintedForm, type PrintData } from '@/app/print/admission-form/PrintedForm';

// The school's admission form, opened from the link in the offer email.
// Filled once the child is selected; parents can correct it until the school
// adds the child to a class.

interface FormData {
    school: { name: string; logoUrl: string | null };
    open: boolean; applicationNo: string; childName: string; className: string; session: string;
    status: string | null; filledAt: string | null;
    form: { title: string; sections: FormSection[]; declaration: string } | null;
    values: FormValues;
    print: PrintData | null;
}

/** The form as the school prints it, with what the parent has typed so far. Fits the screen width. */
function PrintedPreview({ data, values, onClose }: { data: PrintData; values: FormValues; onClose: () => void }) {
    const box = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    useEffect(() => {
        const fit = () => { if (box.current) setZoom(Math.min(1, (box.current.clientWidth - 8) / 840)); };
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, []);
    useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);
    return createPortal(
        <div role="dialog" aria-modal="true" aria-label="Your filled form" className="fixed inset-0 z-[1000] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 bg-white px-4 py-3 shadow">
                <div>
                    <p className="text-sm font-bold">Your form, as the school will print it</p>
                    <p className="text-[12px] text-slate-500">This shows what you have filled so far. Close it to make changes.</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div ref={box} className="min-h-0 flex-1 overflow-auto">
                <div style={{ zoom }}><PrintedForm d={{ ...data, values: { ...values, ...data.values } }} toolbar={false} embedded /></div>
            </div>
        </div>,
        document.body,
    );
}

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

export default function AdmissionFormPage() {
    const { code, token } = useParams<{ code: string; token: string }>();
    const [data, setData] = useState<FormData | null>(null);
    const [values, setValues] = useState<FormValues>({});
    const [error, setError] = useState('');
    const [consent, setConsent] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');
    const [sent, setSent] = useState(false);
    const [printed, setPrinted] = useState(false);
    const statusHref = `/apply/${encodeURIComponent(code)}/status/${encodeURIComponent(token)}`;

    useEffect(() => {
        api.get(`/public/admissions/${encodeURIComponent(code)}/admission-form/${encodeURIComponent(token)}`)
            .then(res => {
                setData(res.data.data); setValues(res.data.data.values ?? {});
                // Opened from "See it as printed" on the status page.
                if (res.data.data.print && new URLSearchParams(window.location.search).get('view') === 'printed') setPrinted(true);
            })
            .catch(err => setError(getErrorMessage(err, 'This link is not valid')));
    }, [code, token]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sending) return;
        setSendError('');
        setSending(true);
        try {
            await api.post(`/public/admissions/${encodeURIComponent(code)}/admission-form/${encodeURIComponent(token)}`, { values, consent: true });
            setSent(true);
            window.scrollTo({ top: 0 });
        } catch (err) {
            setSendError(getErrorMessage(err, 'Could not send the form. Please try again.'));
        } finally { setSending(false); }
    };

    if (error) {
        return (
            <ApplyShell school={null}>
                <div className="rounded-[28px] bg-white/95 p-8 text-center shadow-lg ring-1 ring-slate-200/70">
                    <BookDoodle className="mx-auto w-20" />
                    <p className="mt-4 text-lg font-bold">Form not found</p>
                    <p className="mt-1 text-sm text-slate-500">{error}. Please use the link from your email, or contact the school office.</p>
                </div>
            </ApplyShell>
        );
    }
    if (!data) return <ApplyShell school={null}><p role="status" className="py-20 text-center text-sm text-slate-500">Opening the form...</p></ApplyShell>;

    const subtitle = `${data.form?.title ?? 'Admission form'} | Session ${data.session}`;
    const left = <HeaderChip icon="🧒" title={data.childName} text={`${data.className} | Session ${data.session}`} />;

    if (sent) {
        return (
            <ApplyShell school={data.school} subtitle={subtitle} left={left} right={<HeaderChip icon="✅" title="Form sent" text={`Application ${data.applicationNo}`} />}>
                <section className="relative overflow-hidden rounded-[28px] bg-white/95 p-7 text-center shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70">
                    <StarDoodle className="absolute left-5 top-5 w-8 -rotate-12" />
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#DCFCE7] text-emerald-600 ring-8 ring-[#DCFCE7]/50"><CheckCircle2 size={30} /></span>
                    <h1 className="mt-4 text-2xl font-extrabold">Admission form sent!</h1>
                    <p className="mt-1 text-sm text-slate-600">Thank you. The school office will print it for your signature when you come with the fee and documents.</p>
                    <Link href={statusHref} className="mt-5 inline-flex h-12 items-center rounded-full px-7 text-[15px] font-semibold text-white shadow-md hover:opacity-95" style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 45%, #C06040 100%)' }}>See application status</Link>
                </section>
            </ApplyShell>
        );
    }

    if (!data.open || !data.form) {
        return (
            <ApplyShell school={data.school} subtitle={subtitle} left={left}>
                <div className="rounded-[28px] bg-white/95 p-8 text-center shadow-lg ring-1 ring-slate-200/70">
                    <ClipboardList className="mx-auto h-12 w-12 text-[#DA7756]" />
                    <p className="mt-4 text-lg font-bold">{data.status ? 'The admission form is done' : 'The admission form is not open'}</p>
                    <p className="mt-1 text-sm text-slate-500">{data.status ? 'The school has your form. For any change, please contact the school office.' : 'It opens after your child is selected. Please contact the school office for any question.'}</p>
                    <Link href={statusHref} className="mt-5 inline-block text-sm font-semibold text-[#C06040] hover:underline">See application status</Link>
                </div>
            </ApplyShell>
        );
    }

    const footer = (
        <div className="space-y-2">
            {sendError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700 ring-1 ring-red-200">{sendError}</p>}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="flex items-start gap-3 text-[12px] sm:text-[13px] text-slate-600 flex-1 cursor-pointer">
                    <input type="checkbox" form="admission-full-form" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#DA7756]" />
                    <span>{data.form.declaration || `I am the parent or guardian and the details are correct.`}</span>
                </label>
                <button type="submit" form="admission-full-form" disabled={sending || !consent}
                    className="h-12 shrink-0 rounded-full px-8 text-[15px] font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 45%, #C06040 100%)' }}>
                    {sending ? 'Sending...' : data.status ? 'Update form' : 'Send form'}
                </button>
            </div>
        </div>
    );

    return (
        <ApplyShell school={data.school} subtitle={subtitle} footer={footer} left={left}
            right={<HeaderChip icon={data.status ? '✅' : '📝'} title={data.status ? 'Form sent' : 'Admission form'} text={data.status && data.filledAt ? `Sent ${when(data.filledAt)}` : `Application ${data.applicationNo}`} />}>
            <form id="admission-full-form" onSubmit={submit} className="space-y-5">
                <div className="rounded-[28px] bg-gradient-to-br from-[#DCFCE7] to-white p-5 ring-1 ring-emerald-200 flex flex-wrap items-center gap-4">
                    <span className="text-3xl" aria-hidden="true">🎉</span>
                    <div className="min-w-[200px] flex-1">
                        <p className="font-bold">{data.childName} has been selected! Please fill the admission form.</p>
                        <p className="text-[13px] text-slate-600">What you gave in the registration form is already filled. Fields with <span className="text-[#DA7756] font-semibold">*</span> are needed.{data.status ? ' You already sent it; you can correct it and send again.' : ''}</p>
                    </div>
                    {data.print && (
                        <button type="button" onClick={() => setPrinted(true)} className="inline-flex h-10 w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#C06040] shadow-sm ring-1 ring-[#F5C2B0] hover:bg-[#FFF5F0]">
                            <Eye size={15} />See it as printed
                        </button>
                    )}
                </div>
                <fieldset disabled={sending} className="min-w-0">
                    <AdmissionFormFields variant="public" sections={data.form.sections} values={values} onChange={(id, v) => setValues(prev => ({ ...prev, [id]: v }))} />
                </fieldset>
            </form>
            {printed && data.print && <PrintedPreview data={data.print} values={values} onClose={() => setPrinted(false)} />}
        </ApplyShell>
    );
}
