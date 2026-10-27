'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, MoreHorizontal, Pencil } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pill, PrimaryButton, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import { beforeDecision, EVENT_LABELS, FIELD_LABELS, formatDate, formatDateTime, scrollStyle, whatsappLink, type ApplicationDetail, type FieldKey, type StandardWithSections } from './admissions.types';
import ActionDialog, { type ActionKind } from './ActionDialog';
import AdmissionFormCard from './AdmissionFormCard';
import ApplicationForm from './ApplicationForm';
import { parentMessages } from './whatsappMessages';

type Step = { name: string; sub: string; state: 'done' | 'current' | 'todo' | 'skipped' };

/** Which email "Send email again" sends: same rules as the server. */
function resendLabel(a: ApplicationDetail): string | null {
    if (a.outcome === 'WAITLIST') return 'Waitlist';
    if (a.outcome === 'NOT_SELECTED') return 'Not selected';
    if (a.outcome === 'LAPSED') return a.offer?.dueOn ? 'Offer expired' : null;
    if (a.outcome) return null;
    if (a.stage === 'ADMITTED') return a.placed && a.student?.tempPassword ? 'App login' : 'Admission confirmed';
    if (a.stage === 'SELECTED' && a.offer?.dueOn) return 'Selected, pay the fee';
    if (a.stage === 'INTERACTION' && a.interaction?.at && !a.interaction.doneAt) return 'Interaction slot';
    return 'Application received';
}

// Set NEXT_PUBLIC_PLAY_STORE_URL once the app is live; the login message then carries the download link.
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '';

/** A warm WhatsApp message with the app login (WhatsApp shows *text* in bold). */
function loginMessage(a: ApplicationDetail): string {
    const school = a.schoolName || 'our school';
    const section = a.sections.find(s => s.id === a.divisionId)?.name;
    const pronoun = a.gender === 'Female' ? 'She' : a.gender === 'Male' ? 'He' : 'They';
    return [
        `🎉 *Welcome to ${school}!* 🎒`,
        '',
        'Dear Parent,',
        `*${a.childName}*'s admission is complete.${section ? ` ${pronoun} ${pronoun === 'They' ? 'are' : 'is'} now in *${section}*. 🏫` : ''}`,
        '',
        '📱 *QubeEx app login*',
        `👤 Student ID: *${a.student?.studentId ?? ''}*`,
        ...(a.student?.tempPassword ? [`🔑 Temporary password: *${a.student.tempPassword}*`] : []),
        '',
        '*How to start:*',
        `1️⃣ Download the *QubeEx* app from the Play Store${PLAY_STORE_URL ? `:\n${PLAY_STORE_URL}` : ''}`,
        '2️⃣ Open it and log in with the Student ID and temporary password',
        '3️⃣ Set your own new password',
        '',
        'In the app you can see attendance, homework, fees and every school update. 📚',
        '',
        `Warm regards,\n*${school}* 🌟`,
    ].join('\n');
}

/** Withdrawn applications have no email to send again. */
const readOnlyOutcome = (a: ApplicationDetail) => a.outcome === 'WITHDRAWN';

function stepsFor(a: ApplicationDetail): Step[] {
    const idx = ['ENQUIRY', 'REGISTERED', 'INTERACTION', 'SELECTED', 'ADMITTED'].indexOf(a.stage);
    const talked = !!a.interaction?.doneAt;
    const offered = idx >= 3 && !!a.offer && a.outcome !== 'WAITLIST';
    const feePaid = !!a.admissionFee;
    const state = (done: boolean, current: boolean): Step['state'] => (done ? 'done' : current ? 'current' : 'todo');
    const deciding = (idx === 2 && talked) || (idx === 1 && !a.interactionStep) || (idx === 3 && !offered);
    return [
        { name: 'Enquiry', sub: formatDate(a.createdAt), state: state(idx >= 1, idx === 0) },
        { name: 'Registration', sub: a.registrationFee ? 'Fee received' : idx >= 1 ? 'Form filled' : '', state: state(idx >= 2 || (idx === 1 && !a.interactionStep), idx === 1 && a.interactionStep) },
        { name: 'Interaction', sub: talked ? 'Done' : a.interaction?.at ? formatDateTime(a.interaction.at) : '', state: a.interactionStep ? state(talked || idx >= 3, idx === 2 && !talked) : 'skipped' },
        { name: 'Selection', sub: a.outcome === 'WAITLIST' ? `Waitlist #${a.waitlistRank ?? ''}` : offered ? 'Offer sent' : '', state: state(offered || idx >= 4, deciding) },
        { name: 'Fee and documents', sub: feePaid ? (a.docsPending.length ? `${a.docsPending.length} document(s) left` : 'All done') : offered ? `Fee due ${formatDate(a.offer?.dueOn)}` : '', state: state(feePaid && !a.docsPending.length, offered && (!feePaid || (idx === 4 && a.docsPending.length > 0))) },
        { name: 'Admission', sub: a.admissionNo ? `No ${a.admissionNo}` : '', state: state(idx === 4, idx === 3 && feePaid) },
    ];
}

/** The single next thing the office should do, as one big button (plus the usual alternatives). */
type NextStep = { title: string; text: string; primary?: { label: string; kind: ActionKind }; others: { label: string; kind: ActionKind }[] };

/** The next step, plus "Registration fee received" at any open stage while it is still unpaid (parents sometimes pay late). */
function nextStep(a: ApplicationDetail): NextStep {
    const step = stepFor(a);
    const feeDue = !!a.registrationFeeAmount && !a.registrationFee && (!a.outcome || a.outcome === 'WAITLIST') && a.stage !== 'ADMITTED' && a.stage !== 'ENQUIRY';
    if (!feeDue) return step;
    // Selecting, waitlisting or admitting needs the registration fee first.
    const blocked: ActionKind[] = ['SELECT', 'WAITLIST', 'ADMIT'];
    if (step.primary && blocked.includes(step.primary.kind)) {
        return {
            title: step.title,
            text: `Take the registration fee (Rs ${a.registrationFeeAmount}) first. Then you can ${step.primary.label.toLowerCase()}.`,
            primary: { label: 'Registration fee received', kind: 'REG_FEE' },
            others: step.others.filter(o => !blocked.includes(o.kind) && o.kind !== 'REG_FEE'),
        };
    }
    if (!step.others.some(o => o.kind === 'REG_FEE')) step.others = [{ label: 'Registration fee received', kind: 'REG_FEE' }, ...step.others];
    return step;
}

function stepFor(a: ApplicationDetail): NextStep {
    if (a.outcome && a.outcome !== 'WAITLIST') {
        const why = a.outcome === 'NOT_SELECTED' ? 'This child was not selected.' : a.outcome === 'WITHDRAWN' ? 'The parent withdrew this application.' : 'The admission fee was not paid in time, so the offer lapsed.';
        return { title: 'Closed', text: why, primary: { label: 'Reopen', kind: 'REOPEN' }, others: [] };
    }
    switch (a.stage) {
        case 'ENQUIRY':
            return { title: 'Register the child', text: 'When the parent fills the full form, register it here.', primary: { label: 'Register', kind: 'REGISTER' }, others: [{ label: 'Withdraw', kind: 'WITHDRAW' }] };
        case 'REGISTERED': {
            const fee = a.registrationFeeAmount && !a.registrationFee ? [{ label: 'Registration fee received', kind: 'REG_FEE' as ActionKind }] : [];
            return a.interactionStep
                ? { title: 'Give an interaction slot', text: 'Pick a date and time. The parent gets it by email.', primary: { label: 'Give slot', kind: 'SCHEDULE' }, others: fee }
                : { title: 'Decide', text: 'Select the child to send the offer, or put them on the waitlist.', primary: { label: 'Select and send offer', kind: 'SELECT' }, others: [...fee, { label: 'Waitlist', kind: 'WAITLIST' }, { label: 'Not selected', kind: 'NOT_SELECTED' }] };
        }
        case 'INTERACTION':
            return a.interaction?.doneAt
                ? { title: 'Decide', text: `Interaction remark: "${a.interaction.remark ?? ''}"`, primary: { label: 'Select and send offer', kind: 'SELECT' }, others: [{ label: 'Waitlist', kind: 'WAITLIST' }, { label: 'Not selected', kind: 'NOT_SELECTED' }] }
                : { title: `Interaction on ${formatDateTime(a.interaction?.at)}`, text: 'After meeting the child, write a short remark.', primary: { label: 'Mark interaction done', kind: 'INTERACTION_DONE' }, others: [{ label: 'Change slot', kind: 'SCHEDULE' }] };
        case 'SELECTED':
            if (a.outcome === 'WAITLIST') return { title: `On the waitlist (#${a.waitlistRank})`, text: 'When a seat frees up, offer it here.', primary: { label: 'Offer a seat', kind: 'SELECT' }, others: [{ label: 'Not selected', kind: 'NOT_SELECTED' }] };
            if (!a.admissionFee) return { title: 'Waiting for the admission fee', text: `Offer sent. Fee due by ${formatDate(a.offer?.dueOn)}.`, primary: { label: 'Admission fee received', kind: 'ADM_FEE' }, others: [{ label: 'Mark offer lapsed', kind: 'LAPSE' }, { label: 'Withdraw', kind: 'WITHDRAW' }] };
            if (a.admissionForm && a.admissionForm.config.requiredForAdmit && a.admissionForm.status === 'PENDING') return { title: a.admissionForm.config.mode === 'ONLINE' ? 'Waiting for the admission form' : 'Waiting for the paper admission form', text: a.admissionForm.config.mode === 'ONLINE' ? 'Fee received. The parent still has to fill the admission form (or fill it below).' : 'Fee received. Tick the admission form below when the parent brings it back.', others: [{ label: 'Withdraw', kind: 'WITHDRAW' }] };
            return { title: 'Ready to admit', text: a.docsPending.length ? `${a.docsPending.length} required document(s) not seen yet. You can admit now and tick them later.` : 'Fee received and documents seen.', primary: { label: 'Admit', kind: 'ADMIT' }, others: [{ label: 'Withdraw', kind: 'WITHDRAW' }] };
        case 'ADMITTED':
            if (a.placed) return { title: 'In class', text: 'This child is a QubeEx student now.', others: [] };
            if (a.session?.isCurrent) return { title: 'Add to a class', text: 'Pick the section. The child gets a QubeEx login right away.', primary: { label: 'Add to class', kind: 'PLACE' }, others: [{ label: 'Withdraw', kind: 'WITHDRAW' }] };
            return { title: `Joins in ${a.session?.label ?? 'the next session'}`, text: 'They get a section and a login when that session starts, from Place in class.', primary: { label: 'Plan section', kind: 'SET_SECTION' }, others: [{ label: 'Withdraw', kind: 'WITHDRAW' }] };
    }
}

const StepDot = ({ state, n }: { state: Step['state']; n: number }) => (
    <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border ${state === 'done' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400' : state === 'current' ? 'text-white border-transparent' : 'bg-muted text-muted-foreground border-border'}`}
        style={state === 'current' ? { background: '#DA7756' } : undefined}>{state === 'done' ? <Check size={12} /> : n}</span>
);

const Row = ({ k, v }: { k: string; v?: string | null }) => v ? (
    <div className="flex justify-between gap-4 py-1.5 border-t border-border/40 text-[13px]"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right break-words">{v}</span></div>
) : null;

export default function ApplicationDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
    const [a, setA] = useState<ApplicationDetail | null>(null);
    const [standards, setStandards] = useState<StandardWithSections[]>([]);
    const [error, setError] = useState('');
    const [action, setAction] = useState<ActionKind | null>(null);
    const [editing, setEditing] = useState(false);
    const [savingDoc, setSavingDoc] = useState('');

    const load = useCallback((signal?: AbortSignal) => api.get(`/admin/admissions/applications/${id}`, { signal }).then(res => {
        if (!signal?.aborted) { setA(res.data.data); setError(''); }
    }).catch(err => { if (!signal?.aborted) setError(getErrorMessage(err, 'Could not load this application')); }), [id]);
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
    useEffect(() => {
        if (!editing || standards.length) return;
        api.get('/admin/admissions/settings').then(res => setStandards(res.data.data.standards)).catch(() => {});
    }, [editing, standards.length]);

    const changed = async () => { await load(); onChanged(); };

    const toggleDoc = async (docId: string, seen: boolean) => {
        if (!a || savingDoc) return;
        setSavingDoc(docId);
        try {
            await api.post(`/admin/admissions/applications/${a.id}/actions`, { action: 'DOCUMENTS', revision: a.revision, items: [{ id: docId, seen }] });
            await changed();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not update the document')); await load(); }
        finally { setSavingDoc(''); }
    };

    const [resending, setResending] = useState(false);
    const resendEmail = async () => {
        if (resending) return;
        setResending(true);
        try {
            const res = await api.post(`/admin/admissions/applications/${id}/resend-email`);
            toast.success(`"${res.data.data.label}" email sent again to ${res.data.data.email}`);
            await load();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not send the email')); }
        finally { setResending(false); }
    };
    // WhatsApp opens with the message ready; the history notes that it was opened (WhatsApp cannot tell us it was sent).
    const [waTo, setWaTo] = useState<'phone' | 'altPhone'>('phone');
    const waPhone = (waTo === 'altPhone' ? a?.details?.altPhone : a?.details?.phone) || a?.details?.phone || a?.details?.altPhone;
    const logWhatsapp = async (label: string) => {
        try { await api.post(`/admin/admissions/applications/${id}/whatsapp`, { label: label.slice(0, 60), to: waPhone ?? '' }); await load(); } catch { /* only the history note; the message still opens */ }
    };
    const copy = (text: string, what: string) => { void navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error('Could not copy')); };

    const step = a ? nextStep(a) : null;
    const details = a?.details;
    const shownFields = a ? (Object.keys(FIELD_LABELS) as FieldKey[]).filter(k => a.fields[k] && k !== 'address') : [];

    return (
        <>
            <Dialog open onOpenChange={open => { if (!open && !action && !editing) onClose(); }}>
                <DialogContent className="sm:max-w-4xl bg-card max-h-[90vh] flex flex-col overflow-hidden p-0">
                    {!a ? (
                        <div className="p-6"><DialogHeader><DialogTitle>Application</DialogTitle><DialogDescription>{error || 'Loading...'}</DialogDescription></DialogHeader>
                            {error && <SecondaryButton className="mt-4" onClick={() => void load()}>Retry</SecondaryButton>}</div>
                    ) : (
                        <>
                            <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border/50">
                                <DialogHeader className="pr-8">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <DialogTitle className="text-xl">{a.childName}</DialogTitle>
                                        {a.ageWarning && a.stage !== 'ADMITTED' && <Pill tone="red">{a.ageWarning}</Pill>}
                                        {a.stage === 'ADMITTED' && a.docsPending.length > 0 && <Pill tone="red">Provisional</Pill>}
                                    </div>
                                    <DialogDescription>{a.applicationNo} | {a.standardName} | Session {a.session?.label ?? ''} | {a.source === 'ONLINE' ? 'Online form' : a.source === 'PHONE' ? 'Phone enquiry' : 'At the counter'}</DialogDescription>
                                </DialogHeader>
                                <ol aria-label="Admission steps" className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                    {stepsFor(a).filter(s => s.state !== 'skipped').map((s, i) => (
                                        <li key={s.name} className="flex items-center gap-2 min-w-0">
                                            <StepDot state={s.state} n={i + 1} />
                                            <span className="min-w-0"><span className={`block text-xs font-semibold truncate ${s.state === 'todo' ? 'text-muted-foreground' : ''}`}>{s.name}</span><span className="block text-[10px] text-muted-foreground truncate">{s.sub}</span></span>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4" style={scrollStyle}>
                                {step && (
                                    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Next step</p>
                                            <p className="mt-0.5 text-base font-semibold">{step.title}</p>
                                            <p className="text-[13px] text-muted-foreground">{step.text}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {step.others.map(o => <SecondaryButton key={o.kind} type="button" onClick={() => setAction(o.kind)}>{o.label}</SecondaryButton>)}
                                            {step.primary && <PrimaryButton type="button" className="h-9 px-5" onClick={() => setAction(step.primary!.kind)}>{step.primary.label}<ArrowRight size={14} /></PrimaryButton>}
                                        </div>
                                    </section>
                                )}

                                {a.placed && a.student && (
                                    <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-[13px]">
                                            <p className="font-semibold">QubeEx login</p>
                                            <p className="text-muted-foreground">Student ID <span className="font-mono text-foreground">{a.student.studentId}</span>{a.student.tempPassword && <> | Temporary password <span className="font-mono text-foreground">{a.student.tempPassword}</span></>}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <SecondaryButton type="button" onClick={() => copy(`Student ID: ${a.student!.studentId}${a.student!.tempPassword ? `\nTemporary password: ${a.student!.tempPassword}` : ''}`, 'Login')}><Copy size={13} />Copy</SecondaryButton>
                                            <a href={whatsappLink(loginMessage(a), details?.phone)} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted/50"><FaWhatsapp size={15} className="text-[#25D366]" />Send on WhatsApp</a>
                                        </div>
                                    </section>
                                )}

                                <AdmissionFormCard a={a} phone={details?.phone} onChanged={changed} />

                                <div className="grid lg:grid-cols-2 gap-4">
                                    <section data-admin-surface="" className="rounded-2xl border border-border/60 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-semibold">Child and parents</h3>
                                            <div className="flex items-center gap-1">
                                                {(details?.phone || details?.altPhone) && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button type="button" title="Message the parent on WhatsApp" aria-label="Message the parent on WhatsApp"
                                                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-xs font-semibold hover:bg-muted/50"><FaWhatsapp size={15} className="text-[#25D366]" />WhatsApp</button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-72">
                                                            {details.phone && details.altPhone && <>
                                                                <DropdownMenuLabel className="text-[11px] text-muted-foreground">Send to</DropdownMenuLabel>
                                                                <DropdownMenuRadioGroup value={waTo} onValueChange={v => setWaTo(v as 'phone' | 'altPhone')}>
                                                                    <DropdownMenuRadioItem value="phone" onSelect={e => e.preventDefault()}>{details.phone}</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="altPhone" onSelect={e => e.preventDefault()}>{details.altPhone}</DropdownMenuRadioItem>
                                                                </DropdownMenuRadioGroup>
                                                                <DropdownMenuSeparator />
                                                            </>}
                                                            {parentMessages(a).map(m => (
                                                                <DropdownMenuItem key={m.key} asChild>
                                                                    <a href={whatsappLink(m.text, waPhone)} target="_blank" rel="noopener noreferrer" onClick={() => void logWhatsapp(m.label)}>
                                                                        <span className="flex-1">{m.label}</span>
                                                                        {m.recommended && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Now</span>}
                                                                    </a>
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                                {!a.placed && <button type="button" onClick={() => setEditing(true)} title="Edit details" aria-label="Edit details" className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"><Pencil size={13} /></button>}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><button type="button" aria-label="More" className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"><MoreHorizontal size={14} /></button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-72">
                                                        {details?.email && !readOnlyOutcome(a) && resendLabel(a) && (
                                                            <DropdownMenuItem disabled={resending} onClick={() => void resendEmail()}>
                                                                {resending ? 'Sending email...' : <>Send email again <span className="text-muted-foreground">({resendLabel(a)})</span></>}
                                                            </DropdownMenuItem>
                                                        )}
                                                        {a.statusLink && <DropdownMenuItem onClick={() => copy(a.statusLink!, 'Status link')}>Copy parent status link</DropdownMenuItem>}
                                                        {!a.outcome && a.stage !== 'ADMITTED' && <DropdownMenuItem onClick={() => setAction('NOT_SELECTED')}>{beforeDecision(a) ? 'Close application' : 'Not selected'}</DropdownMenuItem>}
                                                        {!a.placed && a.outcome !== 'WITHDRAWN' && <DropdownMenuItem onClick={() => setAction('WITHDRAW')}>Withdraw</DropdownMenuItem>}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                        <Row k="Date of birth" v={formatDate(a.dob)} />
                                        <Row k="Gender" v={a.gender === 'Male' ? 'Boy' : a.gender === 'Female' ? 'Girl' : a.gender} />
                                        <Row k="Father" v={details?.fatherName} />
                                        <Row k="Mother" v={details?.motherName} />
                                        <Row k="Guardian" v={details?.guardianName} />
                                        <Row k="Phone" v={[details?.phone, details?.altPhone].filter(Boolean).join(', ')} />
                                        <Row k="Email" v={details?.email} />
                                        <Row k="Address" v={[details?.address, details?.city, details?.pincode].filter(Boolean).join(', ')} />
                                        {shownFields.map(k => <Row key={k} k={FIELD_LABELS[k]} v={details?.[k] as string} />)}
                                        {a.questions.map(q => <Row key={q.id} k={q.label} v={details?.answers[q.id]} />)}
                                        <Row k="Office note" v={details?.notes} />
                                    </section>

                                    <div className="space-y-4">
                                        <section data-admin-surface="" className="rounded-2xl border border-border/60 p-4">
                                            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Documents</h3><span className="text-[11px] text-muted-foreground">{a.documents.filter(d => d.seen).length} of {a.documents.length} seen</span></div>
                                            <p className="mt-1 mb-2 text-[11px] text-muted-foreground">Check the originals at the counter and tick them. Nothing is uploaded or stored.</p>
                                            <div className="max-h-64 overflow-y-auto pr-1" style={scrollStyle}>
                                                {a.documents.map(doc => (
                                                    <label key={doc.id} className="flex items-center gap-3 py-2 border-t border-border/40 cursor-pointer">
                                                        <input type="checkbox" checked={doc.seen} disabled={!!savingDoc || (!!a.outcome && a.outcome !== 'WAITLIST')} onChange={e => void toggleDoc(doc.id, e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                                                        <span className="flex-1 min-w-0">
                                                            <span className="block text-[13px] font-medium">{doc.name}{doc.required && <span className="text-red-500"> *</span>}</span>
                                                            <span className="block text-[11px] text-muted-foreground">{doc.seen ? `Seen by ${doc.seenBy ?? 'office'}, ${formatDate(doc.seenAt)}` : 'Not seen yet'}</span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </section>

                                        <section data-admin-surface="" className="rounded-2xl border border-border/60 p-4">
                                            <h3 className="text-sm font-semibold mb-1">Fees and interaction</h3>
                                            <Row k="Registration fee" v={a.registrationFee ? `${a.registrationFee.status === 'WAIVED' ? 'Waived' : 'Received'}${a.registrationFee.amount != null ? `, Rs ${a.registrationFee.amount}` : ''}${a.registrationFee.ref ? ` (${a.registrationFee.ref})` : ''}` : a.registrationFeeAmount ? `Not received (Rs ${a.registrationFeeAmount})` : 'Not set'} />
                                            <Row k="Interaction" v={a.interaction?.at ? `${formatDateTime(a.interaction.at)}${a.interaction.doneAt ? ', done' : ''}` : a.interactionStep ? 'Not given yet' : 'Not needed'} />
                                            <Row k="Remark" v={a.interaction?.remark} />
                                            <Row k="Offer" v={a.offer ? `Sent ${formatDate(a.offer.sentAt)}, fee due ${formatDate(a.offer.dueOn)}` : null} />
                                            <Row k="Admission fee" v={a.admissionFee ? `${a.admissionFee.status === 'WAIVED' ? 'Waived' : 'Received'}${a.admissionFee.amount != null ? `, Rs ${a.admissionFee.amount}` : ''}${a.admissionFee.ref ? ` (${a.admissionFee.ref})` : ''}` : null} />
                                            <Row k="Admission number" v={a.admissionNo} />
                                        </section>
                                    </div>
                                </div>

                                <section data-admin-surface="" className="rounded-2xl border border-border/60 p-4">
                                    <h3 className="text-sm font-semibold mb-2">History{a.events.length > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({a.events.length})</span>}</h3>
                                    {/* About 6-7 entries show; the rest scroll. */}
                                    <ol className="space-y-2 max-h-[290px] overflow-y-auto overscroll-contain pr-1" style={scrollStyle}>
                                        {[...a.events].reverse().map((e, i) => (
                                            <li key={i} className="flex gap-3 text-[13px]">
                                                <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-muted-foreground/40" />
                                                <span><span className="font-medium">{EVENT_LABELS[e.action] ?? e.action}</span>{e.note && e.action !== 'SCHEDULE' && <span className="text-muted-foreground"> - {e.note}</span>}{e.action === 'SCHEDULE' && e.note && <span className="text-muted-foreground"> - {formatDateTime(e.note)}</span>}
                                                    <span className="block text-[11px] text-muted-foreground">{formatDateTime(e.at)} by {e.by}</span></span>
                                            </li>
                                        ))}
                                    </ol>
                                </section>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
            {a && action && <ActionDialog kind={action} application={a} onClose={() => setAction(null)} onDone={async () => { setAction(null); await changed(); }} />}
            {a && editing && standards.length > 0 && (
                <ApplicationForm standards={standards} fields={a.fields} questions={a.questions} editing={a}
                    onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); toast.success('Details saved'); await changed(); }} />
            )}
        </>
    );
}
