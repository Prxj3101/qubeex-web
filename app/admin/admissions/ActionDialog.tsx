'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, inputCls, PrimaryButton, SecondaryButton, Segmented } from '@/app/admin/payroll/_components/ui';
import { apiError, addDaysYmd, beforeDecision, todayYmd, type ApplicationDetail } from './admissions.types';

export type ActionKind =
    | 'REGISTER' | 'REG_FEE' | 'SCHEDULE' | 'INTERACTION_DONE' | 'SELECT' | 'WAITLIST' | 'NOT_SELECTED'
    | 'WITHDRAW' | 'LAPSE' | 'REOPEN' | 'ADM_FEE' | 'ADMIT' | 'SET_SECTION' | 'PLACE';

const COPY: Record<ActionKind, { title: string; text: string; button: string }> = {
    REGISTER: { title: 'Register', text: 'Moves this enquiry to Registered. Make sure the date of birth and parent details are filled.', button: 'Register' },
    REG_FEE: { title: 'Registration fee received', text: 'Note how the registration fee was paid.', button: 'Save' },
    SCHEDULE: { title: 'Give interaction slot', text: 'The parent gets the date and time by email.', button: 'Give slot' },
    INTERACTION_DONE: { title: 'Interaction done', text: 'A short remark helps the principal decide.', button: 'Save' },
    SELECT: { title: 'Select and send offer', text: 'The parent is told the child is selected and by when to pay the admission fee.', button: 'Send offer' },
    WAITLIST: { title: 'Put on waitlist', text: 'The child goes to the end of the waitlist for this class. The parent is told the waitlist number.', button: 'Put on waitlist' },
    NOT_SELECTED: { title: 'Not selected', text: 'The application is closed and the parent gets a polite email. You can reopen it later.', button: 'Mark not selected' },
    WITHDRAW: { title: 'Withdraw', text: 'Use this when the parent no longer wants the seat. You can reopen it later.', button: 'Withdraw' },
    LAPSE: { title: 'Mark offer lapsed', text: 'The fee was not paid in time. The seat can now be offered to the waitlist.', button: 'Mark lapsed' },
    REOPEN: { title: 'Reopen', text: 'Brings this application back to where it was.', button: 'Reopen' },
    ADM_FEE: { title: 'Admission fee received', text: 'Note how the admission fee was paid. Use Waived for RTE or free seats.', button: 'Save' },
    ADMIT: { title: 'Admit', text: '', button: 'Admit' },
    SET_SECTION: { title: 'Plan section', text: 'Pick the section now if you know it. It is used when the session starts.', button: 'Save' },
    PLACE: { title: 'Add to class', text: 'The child becomes a QubeEx student in this section and gets a login.', button: 'Add to class' },
};

// Quick reasons the office can tap; they fill the reason box (office only).
const CLOSE_REASONS = ['Age not eligible', 'Seats full', 'Duplicate form', 'Wrong class chosen'];
const NOT_SELECTED_REASONS = ['Seats full', 'Did not meet the criteria', 'Age not eligible'];
const WITHDRAW_REASONS = ['Joined another school', 'Moving city', 'Changed mind'];

export default function ActionDialog({ kind, application: a, onClose, onDone }: { kind: ActionKind; application: ApplicationDetail; onClose: () => void; onDone: () => void | Promise<void> }) {
    const [saving, setSaving] = useState(false);
    const [mode, setMode] = useState<'COUNTER' | 'ONLINE' | 'WAIVED'>('COUNTER');
    const [ref, setRef] = useState('');
    const [amount, setAmount] = useState(kind === 'REG_FEE' && a.registrationFeeAmount != null ? String(a.registrationFeeAmount) : '');
    const [date, setDate] = useState(a.interaction?.at ? a.interaction.at.slice(0, 10) : addDaysYmd(2));
    const [time, setTime] = useState('10:00');
    const [note, setNote] = useState('');
    const [dueOn, setDueOn] = useState(addDaysYmd(7));
    const [admissionNo, setAdmissionNo] = useState(a.nextAdmissionNo ?? '');
    const [divisionId, setDivisionId] = useState(a.divisionId ?? '');
    const early = kind === 'NOT_SELECTED' && beforeDecision(a);
    const copy = early
        ? { title: 'Close application', text: 'Use this when the child cannot go ahead now, e.g. age or seats. The parent gets a polite email. You can reopen it later.', button: 'Close application' }
        : COPY[kind];
    const reasons = early ? CLOSE_REASONS : kind === 'NOT_SELECTED' ? NOT_SELECTED_REASONS : kind === 'WITHDRAW' ? WITHDRAW_REASONS : [];
    const isFee = kind === 'REG_FEE' || kind === 'ADM_FEE';
    const current = !!a.session?.isCurrent;

    const valid = (() => {
        if (kind === 'SCHEDULE') return !!date && !!time;
        if (kind === 'INTERACTION_DONE') return note.trim().length > 0;
        if (kind === 'SELECT') return dueOn >= todayYmd();
        if (kind === 'PLACE') return !!divisionId;
        if (isFee && mode !== 'WAIVED') return amount === '' || Number(amount) >= 0;
        return true;
    })();

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        try {
            if (kind === 'PLACE') {
                const res = await api.post('/admin/admissions/placement', { items: [{ id: a.id, divisionId }] });
                const r = res.data.data[0];
                if (!r?.ok) throw new Error(r?.error || 'Could not add to class');
                toast.success(`${a.childName} added to ${r.section}`);
            } else {
                const body: Record<string, unknown> = { action: kind, revision: a.revision };
                if (isFee) Object.assign(body, { mode, ref: ref.trim(), amount: mode === 'WAIVED' || amount === '' ? null : Number(amount) });
                if (kind === 'SCHEDULE') Object.assign(body, { at: new Date(`${date}T${time}:00+05:30`).toISOString(), note: note.trim() });
                if (kind === 'INTERACTION_DONE') Object.assign(body, { remark: note.trim() });
                if (kind === 'SELECT') Object.assign(body, { dueOn });
                if (kind === 'NOT_SELECTED' || kind === 'WITHDRAW') Object.assign(body, { reason: note.trim() });
                // The suggested next number is left to the server, so the register counter moves on.
                if (kind === 'ADMIT') Object.assign(body, { ...(admissionNo.trim() && admissionNo.trim() !== a.nextAdmissionNo ? { admissionNo: admissionNo.trim() } : {}), divisionId: divisionId || null });
                if (kind === 'SET_SECTION') Object.assign(body, { divisionId: divisionId || null });
                const res = await api.post(`/admin/admissions/applications/${a.id}/actions`, body);
                const placed = res.data.data?.placed, placeError = res.data.data?.placeError;
                if (kind === 'ADMIT') {
                    if (placed) toast.success(`${a.childName} admitted and added to ${placed.section}`);
                    else if (placeError) toast.warning(`Admitted. ${placeError}`);
                    else toast.success(`${a.childName} admitted`);
                } else toast.success('Saved');
            }
            await onDone();
        } catch (err) { toast.error(apiError(err, 'Could not save')); }
        finally { setSaving(false); }
    };

    const sectionPicker = (allowLater: boolean) => (
        <Field label="Section">
            <div className="flex flex-wrap gap-2">
                {allowLater && <button type="button" onClick={() => setDivisionId('')} aria-pressed={!divisionId}
                    className={`h-9 px-3 rounded-xl border text-xs font-semibold ${!divisionId ? 'border-[#DA7756] bg-[#DA7756]/10' : 'border-border hover:bg-muted/50'}`}>Decide later</button>}
                {a.sections.map(s => (
                    <button key={s.id} type="button" onClick={() => setDivisionId(s.id)} aria-pressed={divisionId === s.id}
                        className={`h-9 px-3 rounded-xl border text-xs font-semibold ${divisionId === s.id ? 'border-[#DA7756] bg-[#DA7756]/10' : 'border-border hover:bg-muted/50'}`}>{s.name.toLowerCase().startsWith(a.standardName.toLowerCase()) ? s.name : `${a.standardName} ${s.name}`}</button>
                ))}
            </div>
            {!a.sections.length && <p className="text-[11px] text-muted-foreground mt-1">This class has no sections yet. Add one in Campus first.</p>}
        </Field>
    );

    return (
        <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
            <DialogContent className="sm:max-w-md bg-card">
                <DialogHeader>
                    <DialogTitle>{copy.title}{kind === 'ADMIT' ? ` ${a.childName}` : ''}</DialogTitle>
                    {copy.text && <DialogDescription>{copy.text}</DialogDescription>}
                </DialogHeader>
                <form onSubmit={submit}>
                    <fieldset disabled={saving} className="space-y-4">
                        {isFee && (
                            <>
                                <Segmented value={mode} onChange={setMode} options={[{ value: 'COUNTER', label: 'At counter' }, { value: 'ONLINE', label: 'Online / UPI' }, { value: 'WAIVED', label: 'Waived' }]} />
                                {mode !== 'WAIVED' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Amount (Rs)"><input inputMode="decimal" className={inputCls} value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                                        <Field label={mode === 'ONLINE' ? 'Transaction ref' : 'Receipt no'}><input maxLength={80} className={inputCls} value={ref} onChange={e => setRef(e.target.value)} /></Field>
                                    </div>
                                )}
                                {mode === 'WAIVED' && <Field label="Reason (optional)"><input maxLength={80} className={inputCls} value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. RTE seat" /></Field>}
                            </>
                        )}
                        {kind === 'SCHEDULE' && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Date"><input type="date" min={todayYmd()} className={inputCls} value={date} onChange={e => setDate(e.target.value)} required /></Field>
                                    <Field label="Time"><input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} required /></Field>
                                </div>
                                <Field label="Note for parent (optional)"><input maxLength={300} className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Come to the main office, bring the birth certificate" /></Field>
                            </>
                        )}
                        {kind === 'INTERACTION_DONE' && <Field label="Remark *"><textarea maxLength={1000} className={`${inputCls} h-24 py-2 resize-none`} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Confident, knows colours and numbers" /></Field>}
                        {kind === 'SELECT' && <Field label="Admission fee to be paid by"><input type="date" min={todayYmd()} className={inputCls} value={dueOn} onChange={e => setDueOn(e.target.value)} required /></Field>}
                        {(kind === 'NOT_SELECTED' || kind === 'WITHDRAW') && (
                            <Field label={kind === 'NOT_SELECTED' ? 'Reason (the parent sees this in the email and status page)' : 'Reason (only the office sees this)'}>
                                {reasons.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {reasons.map(r => (
                                            <button key={r} type="button" onClick={() => setNote(r)}
                                                className={`h-8 px-3 rounded-full border text-xs font-medium ${note === r ? 'border-[#DA7756] bg-[#DA7756]/10' : 'border-border hover:bg-muted/50'}`}>{r}</button>
                                        ))}
                                    </div>
                                )}<input maxLength={300} className={inputCls} value={note} onChange={e => setNote(e.target.value)} /></Field>
                        )}
                        {kind === 'ADMIT' && (
                            <>
                                <Field label="Admission number" hint="Next number from your register. Change it only if the school gave a different one."><input maxLength={30} className={inputCls} value={admissionNo} onChange={e => setAdmissionNo(e.target.value)} placeholder="Next number" /></Field>
                                {sectionPicker(true)}
                                {a.docsPending.length > 0 && <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">Not seen yet: {a.docsPending.join(', ')}. The admission stays Provisional until they are ticked.</p>}
                                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                                    <li>The parent gets an admission confirmation email.</li>
                                    {current
                                        ? <li>{divisionId ? 'The child is added to the section now and gets a QubeEx login.' : 'Add them to a section later from Place in class.'}</li>
                                        : <li>The child joins in {a.session?.label}. The login is made when you place them in that session.</li>}
                                </ul>
                            </>
                        )}
                        {kind === 'SET_SECTION' && sectionPicker(true)}
                        {kind === 'PLACE' && sectionPicker(false)}
                        {kind === 'REGISTER' && !a.dob && <p className="text-xs text-red-600 dark:text-red-400">Add the date of birth first (edit the details).</p>}
                    </fieldset>
                    <div className="flex justify-end gap-2 border-t border-border/50 pt-3 mt-4">
                        <SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton>
                        <PrimaryButton type="submit" disabled={!valid || saving}>{saving ? 'Saving...' : copy.button}</PrimaryButton>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
