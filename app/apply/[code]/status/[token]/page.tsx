'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Award, CalendarClock, Check, ChevronRight, ClipboardList, FileCheck2, FileText, GraduationCap, MessagesSquare, PartyPopper, Wallet, X } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import ApplyShell, { HeaderChip, SectionCard } from '../../../_components/ApplyShell';
import { BookDoodle, StarDoodle } from '../../../_components/Doodles';

// Status page a parent reaches from the emailed link. Read-only, no login.

interface Status {
    school: { name: string; logoUrl: string | null };
    applicationNo: string; childName: string; className: string; session: string; status: string;
    stage: 'ENQUIRY' | 'REGISTERED' | 'INTERACTION' | 'SELECTED' | 'ADMITTED'; outcome: string | null;
    interactionStep: boolean; waitlistRank: number | null; interactionAt: string | null; interactionNote?: string | null; interactionDone?: boolean; closedReason?: string | null;
    admissionForm?: { status: 'PENDING' | 'FILLED' | 'RECEIVED'; title: string } | null; feeDueOn: string | null; admissionNo: string | null;
    formStep?: { mode: 'ONLINE' | 'OFFLINE'; status: 'PENDING' | 'FILLED' | 'RECEIVED'; required: boolean; open: boolean; title: string } | null;
    documentsToBring: { name: string; required: boolean }[];
    /** What the parent saw right after sending the form. */
    receipt?: { submittedAt: string; registrationFee: number | null; documents: { name: string; required: boolean }[] };
}

const STEPS = [
    // label/hint while the step is coming or going on; doneLabel/doneHint once it is finished.
    { key: 'REGISTERED', label: 'Form received', hint: 'The school has your application', doneLabel: 'Form received', doneHint: 'The school has your application', icon: FileCheck2 },
    { key: 'INTERACTION', label: 'Interaction', hint: 'The school will give you a date and time', doneLabel: 'Interaction done', doneHint: 'You met the school', icon: MessagesSquare },
    { key: 'SELECTED', label: 'Selection', hint: 'The school is deciding', doneLabel: 'Selected', doneHint: 'Seat offered - pay the fee, show documents', icon: Award },
    { key: 'FORM', label: 'Admission form', hint: 'Filled after the child is selected', doneLabel: 'Admission form sent', doneHint: 'The school has your admission form', icon: ClipboardList },
    { key: 'ADMITTED', label: 'Admission', hint: 'Pay the fee and show the originals', doneLabel: 'Admitted', doneHint: 'Welcome to the school!', icon: GraduationCap },
];
const ORDER = ['ENQUIRY', 'REGISTERED', 'INTERACTION', 'SELECTED', 'ADMITTED'];

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
const day = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function ApplicationStatusPage() {
    const { code, token } = useParams<{ code: string; token: string }>();
    const [s, setS] = useState<Status | null>(null);
    const [error, setError] = useState('');
    const [receiptOpen, setReceiptOpen] = useState(false);

    useEffect(() => {
        if (!receiptOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setReceiptOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [receiptOpen]);

    useEffect(() => {
        api.get(`/public/admissions/${encodeURIComponent(code)}/status/${encodeURIComponent(token)}`)
            .then(res => setS(res.data.data))
            .catch(err => setError(getErrorMessage(err, 'This link is not valid')));
    }, [code, token]);

    if (error) {
        return (
            <ApplyShell school={null}>
                <div className="rounded-[28px] bg-white/95 p-8 text-center shadow-lg ring-1 ring-slate-200/70">
                    <BookDoodle className="mx-auto w-20" />
                    <p className="mt-4 text-lg font-bold">Application not found</p>
                    <p className="mt-1 text-sm text-slate-500">{error}. Please use the link from your email, or contact the school office.</p>
                </div>
            </ApplyShell>
        );
    }
    if (!s) return <ApplyShell school={null}><p role="status" className="py-20 text-center text-sm text-slate-500">Loading...</p></ApplyShell>;

    const at = ORDER.indexOf(s.stage);
    const closed = !!s.outcome && s.outcome !== 'WAITLIST';
    const admitted = s.stage === 'ADMITTED' && !s.outcome;
    // Selected and no fee date left to show = the fee has been paid.
    const feeReceived = s.stage === 'SELECTED' && !s.outcome && !s.feeDueOn;

    let next = '';
    if (s.outcome === 'WAITLIST') next = `${s.childName} is number ${s.waitlistRank ?? ''} on the waitlist. We will email you if a seat becomes free.`;
    else if (closed) next = s.outcome === 'LAPSED' ? 'The admission fee was not paid in time. Please contact the school office.' : 'Please contact the school office for any question.';
    else if (admitted) next = `Welcome to ${s.school.name}! You will get the QubeEx app login once the class and section are assigned.`;
    else if (s.feeDueOn) next = `Please pay the admission fee by ${day(s.feeDueOn)} and bring the original documents to the school office.`;
    else if (feeReceived) next = 'Thank you, the admission fee is received. The school will confirm the admission soon.';
    else if (s.interactionAt) next = `Please come to the school with ${s.childName} on ${when(s.interactionAt)}.`;
    else if (s.stage === 'INTERACTION' && s.interactionDone) next = `Thank you for coming to the interaction. The school will let you know the result soon.`;
    else next = 'The school office will contact you about the next step.';

    // Same colours and emoji as the badge in the parent's emails.
    const tone = closed ? { cls: 'bg-slate-100 text-slate-600', emoji: '✉️' }
        : s.outcome === 'WAITLIST' ? { cls: 'bg-amber-100 text-amber-700', emoji: '⏳' }
        : admitted || s.stage === 'SELECTED' ? { cls: 'bg-emerald-100 text-emerald-700', emoji: '🎉' }
        : s.stage === 'INTERACTION' ? { cls: 'bg-blue-100 text-blue-700', emoji: '📅' }
        : { cls: 'bg-[#FFF1EA] text-[#B4532F]', emoji: '📝' };
    // Not shown once the child is in a class without the form (the school did not need it).
    const showFormStep = !!s.formStep && !(s.formStep.status === 'PENDING' && s.stage === 'ADMITTED' && !s.formStep.open);
    const steps = STEPS.filter(step => (step.key !== 'INTERACTION' || s.interactionStep) && (step.key !== 'FORM' || showFormStep));
    const formHref = `/apply/${encodeURIComponent(code)}/admission-form/${encodeURIComponent(token)}`;

    return (
        <>
        <ApplyShell school={s.school} subtitle={`Application ${s.applicationNo} | Session ${s.session}`}
            left={<HeaderChip icon="🧒" title={s.childName} text={`${s.className} | Session ${s.session}`} />}
            right={<HeaderChip icon={tone.emoji} title={s.status} text="Latest status" />}>
            <div className="space-y-5">
                <section className="relative overflow-hidden rounded-[28px] bg-white/95 p-6 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70">
                    {admitted && <><StarDoodle className="absolute right-5 top-5 w-8 rotate-12" /><StarDoodle className="absolute right-16 top-12 w-5 -rotate-12" /></>}
                    <p className="text-[13px] font-medium text-slate-500">{s.className}</p>
                    <h1 className="mt-0.5 text-2xl font-extrabold">{s.childName}</h1>
                    <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${tone.cls}`}>{tone.emoji} {s.status}</span>
                    {admitted && s.admissionNo && <p className="mt-3 text-sm">Admission number <span className="font-extrabold">{s.admissionNo}</span></p>}
                    {s.stage === 'SELECTED' && !s.outcome && (
                        <div className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-[#FFF7ED] px-4 py-3 ring-1 ring-emerald-200">
                            <p className="text-[13px] font-semibold text-emerald-700">🎉 Congratulations!</p>
                            <p className="mt-0.5 text-lg font-extrabold leading-snug text-slate-900">{s.childName} has been selected! 🥳</p>
                        </div>
                    )}
                    <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-[15px] leading-relaxed">{next}</p>
                    {closed && s.closedReason && (
                        <p className="mt-3 rounded-2xl border-l-4 border-red-600 bg-red-50 px-4 py-3 text-[15px] font-bold text-red-900">
                            <span className="text-red-600">*</span> <span className="tracking-wide text-red-700">REASON:</span> {s.closedReason}
                        </p>
                    )}
                    {closed && s.receipt && <button type="button" onClick={() => setReceiptOpen(true)} className="mt-3 inline-flex items-center gap-0.5 text-[13px] font-semibold text-[#C06040] hover:underline">See form receipt<ChevronRight size={14} /></button>}
                </section>

                {s.admissionForm && (
                    s.admissionForm.status === 'PENDING' ? (
                        <section className="rounded-[28px] bg-gradient-to-br from-[#FFF1EA] to-white p-5 sm:p-6 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-[#F5C2B0]/70">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: '#DA7756' }}><ClipboardList size={20} /></span>
                                    <div>
                                        <h2 className="text-base sm:text-lg font-bold leading-tight">Fill the {s.admissionForm.title.toLowerCase()}</h2>
                                        <p className="text-[13px] text-slate-600">Needed for the admission. Most details are already filled.</p>
                                    </div>
                                </div>
                                <Link href={`/apply/${encodeURIComponent(code)}/admission-form/${encodeURIComponent(token)}`} className="inline-flex h-11 items-center rounded-full px-6 text-[14px] font-bold text-white shadow-md hover:opacity-95" style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 45%, #C06040 100%)' }}>Fill the form</Link>
                            </div>
                        </section>
                    ) : null
                )}

                {s.interactionAt && !closed && (
                    <SectionCard n={1} color="#3B82F6" icon={<CalendarClock size={20} />} title="Interaction">
                        <p className="text-[15px]">{when(s.interactionAt)}</p>
                        {s.interactionNote && (
                            <p className="rounded-2xl border-l-4 border-red-600 bg-red-50 px-4 py-3 text-[15px] font-bold text-red-900">
                                <span className="text-red-600">*</span> <span className="tracking-wide text-red-700">NOTE:</span> {s.interactionNote}
                            </p>
                        )}
                    </SectionCard>
                )}
                {s.feeDueOn && (
                    <SectionCard n={s.interactionAt ? 2 : 1} color="#34D399" icon={<Wallet size={20} />} title="Admission fee">
                        <p className="text-[15px]">Please pay by <span className="font-bold">{day(s.feeDueOn)}</span> at the school office.</p>
                    </SectionCard>
                )}
                {s.documentsToBring.length > 0 && (
                    <SectionCard n={(s.interactionAt ? 1 : 0) + (s.feeDueOn ? 1 : 0) + 1} color="#60A5FA" icon={<FileText size={20} />} title="Originals to bring" hint="You do not upload anything. The office only looks at the originals.">
                        <ul className="grid sm:grid-cols-2 gap-2">
                            {s.documentsToBring.map(d => (
                                <li key={d.name} className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px]">
                                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" /><span>{d.name}{d.required && <span className="text-[#DA7756] font-semibold"> (needed)</span>}</span>
                                </li>
                            ))}
                        </ul>
                    </SectionCard>
                )}

                {!closed && (() => {
                    // Reaching Registered / Selected / Admitted means that step is done.
                    // Interaction is only done once the stage moves past it (a slot
                    // given is still "now"). The current step is the first not done.
                    const doneSteps = steps.map(step => {
                        // The admission form is done once filled online or received on paper.
                        if (step.key === 'FORM') return !!s.formStep && s.formStep.status !== 'PENDING';
                        const idx = ORDER.indexOf(step.key);
                        if (step.key === 'SELECTED' && s.outcome === 'WAITLIST') return false; // waitlisted, not selected yet
                        if (step.key === 'INTERACTION' && at === idx) return !!s.interactionDone; // done once the school marks it
                        return at > idx || (at === idx && step.key !== 'INTERACTION');
                    });
                    const currentIdx = doneSteps.indexOf(false);
                    const rows = steps.map((step, i) => ({
                        ...step, done: doneSteps[i], current: i === currentIdx,
                        label: step.key === 'FORM' && doneSteps[i] && s.formStep?.mode === 'OFFLINE' ? 'Admission form received' : doneSteps[i] ? step.doneLabel : step.label,
                        hint: step.key === 'FORM' ? formHint(s, doneSteps[i], i === currentIdx)
                            : doneSteps[i] ? step.doneHint
                            : step.key === 'ADMITTED' && feeReceived ? 'Fee received - the school is confirming the admission'
                            : step.key === 'INTERACTION' && s.interactionAt ? `Meet the school with your child on ${when(s.interactionAt)}`
                            : step.hint,
                    }));
                    const doneCount = rows.filter(r => r.done).length;
                    const pct = Math.round((doneCount / rows.length) * 100);
                    return (
                        <section className="rounded-[28px] bg-white/95 p-5 sm:p-6 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70">
                            <div className="mb-5">
                                <div className="flex items-baseline justify-between">
                                    <h2 className="text-base sm:text-lg font-bold">Admission journey</h2>
                                    <span className="text-[12px] font-semibold text-slate-500">{doneCount} of {rows.length} done</span>
                                </div>
                                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 6)}%`, background: 'linear-gradient(90deg, #34D399, #10B981)' }} />
                                </div>
                            </div>
                            <ol aria-label="Steps" className="space-y-0">
                                {rows.map((r, i) => {
                                    const Icon = r.icon;
                                    const last = i === rows.length - 1;
                                    return (
                                        <li key={r.key} className="relative flex gap-4 pb-4 last:pb-0" aria-current={r.current ? 'step' : undefined}>
                                            {!last && (
                                                <span aria-hidden="true" className={`absolute left-[21px] top-11 bottom-0 w-[3px] rounded-full ${r.done ? 'bg-emerald-400' : 'bg-[repeating-linear-gradient(to_bottom,#CBD5E1_0_6px,transparent_6px_11px)]'}`} />
                                            )}
                                            <span className="relative z-10 shrink-0 self-start">
                                                <span className={`relative flex h-11 w-11 items-center justify-center rounded-2xl ring-4 ring-white shadow-sm ${r.done ? 'bg-emerald-500 text-white' : r.current ? 'text-white' : 'bg-slate-100 text-slate-400'}`}
                                                    style={r.current ? { background: 'linear-gradient(135deg, #E8896A, #C9603F)' } : undefined}>
                                                    <Icon size={20} />
                                                </span>
                                                {r.done && <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 ring-1 ring-emerald-200"><Check size={12} strokeWidth={3} /></span>}
                                            </span>
                                            {(() => {
                                                const clickable = r.key === 'REGISTERED' && !!s.receipt;
                                                const cls = `flex-1 min-w-0 rounded-2xl px-3.5 py-2.5 ${r.current ? 'bg-[#FFF5F0] ring-1 ring-[#DA7756]/25' : ''}`;
                                                const body = (<>
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`text-[15px] font-bold ${r.done || r.current ? 'text-slate-900' : 'text-slate-400'}`}>{r.label}</p>
                                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${r.done ? 'bg-emerald-50 text-emerald-600' : r.current ? 'bg-[#DA7756] text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                        {r.done ? 'Done' : r.current ? 'Now' : 'Next'}
                                                    </span>
                                                </div>
                                                <p className={`mt-0.5 text-[13px] ${r.done || r.current ? 'text-slate-500' : 'text-slate-400'}`}>{r.hint}</p>
                                                </>);
                                                // Online form open: fill it / correct it, or see it as the school prints it.
                                                if (r.key === 'FORM' && s.formStep?.mode === 'ONLINE' && s.formStep.open && (r.current || r.done)) {
                                                    return (
                                                        <div className={cls}>
                                                            {body}
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                <Link href={formHref} className="inline-flex h-9 items-center gap-1 rounded-full px-4 text-[13px] font-semibold text-white shadow-sm hover:opacity-95" style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 45%, #C06040 100%)' }}>
                                                                    {r.done ? 'See or correct it' : 'Fill the form'}<ChevronRight size={14} />
                                                                </Link>
                                                                <Link href={`${formHref}?view=printed`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-[#C06040] ring-1 ring-[#F5C2B0] hover:bg-[#FFF5F0]">
                                                                    <FileText size={14} />See it as printed
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return clickable ? (
                                                    <button type="button" onClick={() => setReceiptOpen(true)} className={`${cls} w-full text-left transition hover:bg-slate-50 hover:ring-1 hover:ring-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DA7756]/40`}>
                                                        {body}
                                                        <span className="mt-1.5 inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#C06040]">See form receipt and documents<ChevronRight size={14} /></span>
                                                    </button>
                                                ) : <div className={cls}>{body}</div>;
                                            })()}
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                    );
                })()}
                <p className="text-center text-[11px] text-slate-500">Powered by QubeEx</p>
            </div>
        </ApplyShell>
        {receiptOpen && s.receipt && <ReceiptDialog s={s} receipt={s.receipt} onClose={() => setReceiptOpen(false)} />}
        </>
    );
}

/** What the admission form step says, online or on paper. */
function formHint(s: Status, done: boolean, current: boolean): string {
    const f = s.formStep;
    if (!f) return '';
    if (done) return f.mode === 'ONLINE' ? 'The school has your admission form. You can still correct it.' : 'The school has your admission form';
    if (!current) return f.mode === 'ONLINE' ? 'Filled online after the child is selected' : "Filled on the school's paper form after the child is selected";
    return f.mode === 'ONLINE' ? 'Please fill the admission form online' : 'Collect the admission form from the school office, fill it and bring it back with the documents';
}

/** The "Form received" page again: application number and what to bring. */
function ReceiptDialog({ s, receipt, onClose }: { s: Status; receipt: NonNullable<Status['receipt']>; onClose: () => void }) {
    const sent = new Date(receipt.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" style={{ colorScheme: 'light' }} onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="receipt-title" onClick={e => e.stopPropagation()}
                className="relative w-full max-w-lg max-h-[86vh] overflow-y-auto rounded-[28px] bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200">
                <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={18} /></button>
                <div className="relative px-6 pt-8 pb-6 text-center">
                    <StarDoodle className="absolute left-5 top-5 w-7 -rotate-12" />
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#DCFCE7] text-emerald-600 ring-8 ring-[#DCFCE7]/50"><PartyPopper size={26} /></span>
                    <h2 id="receipt-title" className="mt-4 text-xl font-extrabold">Form received</h2>
                    <p className="mt-0.5 text-[13px] text-slate-500">Sent on {sent}</p>
                    <div className="mx-auto mt-4 w-fit rounded-2xl border-2 border-dashed border-[#DA7756]/60 bg-[#FFF7ED] px-6 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4532F]">Application number</p>
                        <p className="mt-0.5 text-2xl font-extrabold tracking-wide">{s.applicationNo}</p>
                    </div>
                    <dl className="mx-auto mt-4 grid max-w-xs grid-cols-3 gap-2 text-left">
                        {[['Child', s.childName], ['Class', s.className], ['Session', s.session]].map(([k, v]) => (
                            <div key={k} className="rounded-2xl bg-slate-50 px-3 py-2"><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k}</dt><dd className="truncate text-[13px] font-bold">{v}</dd></div>
                        ))}
                    </dl>
                </div>
                {(receipt.registrationFee || receipt.documents.length > 0) && (
                    <div className="border-t border-slate-100 px-6 py-5">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#60A5FA] text-white"><FileText size={18} /></span>
                            <div>
                                <p className="text-base font-bold leading-tight">What to bring to the school</p>
                                <p className="text-[12px] text-slate-500">You do not upload anything. The office only looks at the originals.</p>
                            </div>
                        </div>
                        {receipt.registrationFee ? <p className="mb-3 rounded-2xl bg-[#FFF7ED] px-4 py-3 text-sm">Registration fee: <span className="font-bold">Rs {receipt.registrationFee}</span>, paid at the school office.</p> : null}
                        {receipt.documents.length > 0 && (
                            <ul className="grid sm:grid-cols-2 gap-2">
                                {receipt.documents.map(d => (
                                    <li key={d.name} className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px]">
                                        <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" /><span>{d.name}{d.required && <span className="text-[#DA7756] font-semibold"> (needed)</span>}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
