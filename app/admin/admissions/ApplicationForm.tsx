'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, inputCls, PhoneInput, phoneComplete, PrimaryButton, SecondaryButton, Segmented, ThemedSelect } from '@/app/admin/payroll/_components/ui';
import { apiError, emptyDetails, scrollStyle, todayYmd, type ApplicationDetail, type Details, type FieldKey, type Question, type StandardWithSections } from './admissions.types';

interface Props {
    standards: StandardWithSections[];
    fields: Record<FieldKey, boolean>;
    questions: Question[];
    /** Present when editing an existing application. */
    editing?: ApplicationDetail;
    onClose: () => void;
    onSaved: (id: string) => void;
}

/** The registration form as the office fills it: for a walk-in parent, a phone enquiry, or to correct details. */
export default function ApplicationForm({ standards, fields, questions, editing, onClose, onSaved }: Props) {
    const [kind, setKind] = useState<'ENQUIRY' | 'REGISTERED'>('REGISTERED');
    const [source, setSource] = useState<'COUNTER' | 'PHONE'>('COUNTER');
    const [childName, setChildName] = useState(editing?.childName ?? '');
    const [dob, setDob] = useState(editing?.dob ?? '');
    const [gender, setGender] = useState(editing?.gender ?? '');
    const [standardId, setStandardId] = useState(editing?.standardId ?? '');
    const [d, setD] = useState<Details>({ ...emptyDetails(), ...(editing?.details ?? {}) });
    const [saving, setSaving] = useState(false);
    const set = (patch: Partial<Details>) => setD(prev => ({ ...prev, ...patch }));

    const enquiryOnly = !editing && kind === 'ENQUIRY';
    const full = !enquiryOnly;
    const parentGiven = !!(d.fatherName.trim() || d.motherName.trim() || d.guardianName.trim());
    const missingAnswer = full && questions.some(q => q.required && !d.answers[q.id]?.trim());
    const valid = childName.trim() && standardId && phoneComplete(d.phone) && (!d.altPhone || phoneComplete(d.altPhone)) && parentGiven && !!dob && !missingAnswer;

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        try {
            const details = { ...d, phone: d.phone.trim(), email: d.email.trim() };
            if (editing) {
                await api.patch(`/admin/admissions/applications/${editing.id}`, {
                    revision: editing.revision, childName: childName.trim(), dob: dob || null, gender: gender || null,
                    ...(editing.stage !== 'ADMITTED' ? { standardId } : {}), details,
                });
                onSaved(editing.id);
            } else {
                const res = await api.post('/admin/admissions/applications', {
                    stage: kind, source, childName: childName.trim(), dob: dob || null, gender: gender || null, standardId, details,
                });
                onSaved(res.data.data.id);
            }
        } catch (err) { toast.error(apiError(err, 'Could not save the application')); }
        finally { setSaving(false); }
    };

    const optional = (key: FieldKey) => full && fields[key];

    return (
        <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
            <DialogContent className="sm:max-w-2xl bg-card max-h-[88vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0 pr-6">
                    <DialogTitle>{editing ? `Edit ${editing.childName}` : 'Add application'}</DialogTitle>
                    <DialogDescription>{editing ? 'Correct the details from the registration form.' : 'For a parent at the counter or on the phone. Online forms come in by themselves.'}</DialogDescription>
                </DialogHeader>
                <form onSubmit={save} className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1" style={scrollStyle}>
                    <fieldset disabled={saving} className="min-w-0 space-y-5">
                        {!editing && (
                            <div className="flex flex-wrap items-center gap-3">
                                <Segmented value={kind} onChange={setKind} options={[{ value: 'REGISTERED', label: 'Full registration' }, { value: 'ENQUIRY', label: 'Just an enquiry' }]} />
                                <Segmented value={source} onChange={setSource} options={[{ value: 'COUNTER', label: 'At the counter' }, { value: 'PHONE', label: 'On the phone' }]} />
                            </div>
                        )}
                        {enquiryOnly && <p className="text-xs text-muted-foreground -mt-2">Note the name, class and a phone number now. The rest can be filled when the parent registers.</p>}

                        <section className="space-y-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Child</h3>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Child's full name *"><input required maxLength={100} className={inputCls} value={childName} onChange={e => setChildName(e.target.value)} /></Field>
                                <Field label="Class applying for *">
                                    {editing?.stage === 'ADMITTED'
                                        ? <input className={inputCls} value={editing.standardName} disabled />
                                        : <ThemedSelect value={standardId} onChange={setStandardId} placeholder="Pick a class" options={standards.map(s => ({ value: s.id, label: s.name }))} />}
                                </Field>
                                <Field label="Date of birth *" hint={full ? undefined : 'Needed to check the age for the class'}><input type="date" max={todayYmd()} className={inputCls} value={dob} onChange={e => setDob(e.target.value)} required /></Field>
                                <Field label="Gender"><ThemedSelect value={gender} onChange={setGender} placeholder="Select" options={[{ value: 'Male', label: 'Boy' }, { value: 'Female', label: 'Girl' }, { value: 'Other', label: 'Other' }]} /></Field>
                                {optional('bloodGroup') && <Field label="Blood group"><input maxLength={5} className={inputCls} value={d.bloodGroup} onChange={e => set({ bloodGroup: e.target.value })} placeholder="e.g. B+" /></Field>}
                                {optional('previousSchool') && <Field label="Previous school"><input maxLength={160} className={inputCls} value={d.previousSchool} onChange={e => set({ previousSchool: e.target.value })} placeholder="Leave blank if none" /></Field>}
                                {optional('motherTongue') && <Field label="Mother tongue"><input maxLength={40} className={inputCls} value={d.motherTongue} onChange={e => set({ motherTongue: e.target.value })} /></Field>}
                                {optional('religion') && <Field label="Religion"><input maxLength={40} className={inputCls} value={d.religion} onChange={e => set({ religion: e.target.value })} /></Field>}
                                {optional('category') && <Field label="Category"><ThemedSelect value={d.category} onChange={v => set({ category: v })} placeholder="Select" options={['General', 'OBC', 'SC', 'ST', 'EWS'].map(c => ({ value: c, label: c }))} /></Field>}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parents</h3>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Father's name"><input maxLength={100} className={inputCls} value={d.fatherName} onChange={e => set({ fatherName: e.target.value })} /></Field>
                                <Field label="Mother's name"><input maxLength={100} className={inputCls} value={d.motherName} onChange={e => set({ motherName: e.target.value })} /></Field>
                                {full && <Field label="Guardian (if not parents)"><input maxLength={100} className={inputCls} value={d.guardianName} onChange={e => set({ guardianName: e.target.value })} /></Field>}
                                <Field label="Phone *" hint="Used for calls and WhatsApp"><PhoneInput value={d.phone} onChange={v => set({ phone: v })} /></Field>
                                {full && <Field label="Second phone"><PhoneInput value={d.altPhone} onChange={v => set({ altPhone: v })} /></Field>}
                                <Field label="Email" hint="Status updates and the app login are sent here"><input type="email" maxLength={160} className={inputCls} value={d.email} onChange={e => set({ email: e.target.value })} /></Field>
                            </div>
                            {!parentGiven && <p className="text-[11px] text-muted-foreground">Enter at least one parent or guardian name.</p>}
                        </section>

                        {full && (optional('address') || optional('sibling') || optional('transport')) && (
                            <section className="space-y-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Home and school</h3>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {optional('address') && <div className="sm:col-span-2"><Field label="Address"><input maxLength={300} className={inputCls} value={d.address} onChange={e => set({ address: e.target.value })} /></Field></div>}
                                    {optional('address') && <Field label="City"><input maxLength={80} className={inputCls} value={d.city} onChange={e => set({ city: e.target.value })} /></Field>}
                                    {optional('address') && <Field label="PIN code"><input inputMode="numeric" maxLength={10} className={inputCls} value={d.pincode} onChange={e => set({ pincode: e.target.value })} /></Field>}
                                    {optional('sibling') && <Field label="Sibling in this school" hint="Name and class, if any"><input maxLength={160} className={inputCls} value={d.sibling} onChange={e => set({ sibling: e.target.value })} /></Field>}
                                    {optional('transport') && <Field label="School transport" hint="Pickup area, if needed"><input maxLength={160} className={inputCls} value={d.transport} onChange={e => set({ transport: e.target.value })} /></Field>}
                                </div>
                            </section>
                        )}

                        {full && questions.length > 0 && (
                            <section className="space-y-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">School&apos;s questions</h3>
                                {questions.map(q => (
                                    <Field key={q.id} label={`${q.label}${q.required ? ' *' : ''}`}>
                                        <input maxLength={500} className={inputCls} value={d.answers[q.id] ?? ''} onChange={e => set({ answers: { ...d.answers, [q.id]: e.target.value } })} />
                                    </Field>
                                ))}
                            </section>
                        )}

                        <Field label="Office note" hint="Only the office sees this"><textarea maxLength={1000} className={`${inputCls} h-16 py-2 resize-none`} value={d.notes} onChange={e => set({ notes: e.target.value })} /></Field>
                    </fieldset>
                    </div>
                    <div className="shrink-0 flex justify-end gap-2 border-t border-border/50 pt-3 mt-3">
                        <SecondaryButton type="button" disabled={saving} onClick={onClose}>Cancel</SecondaryButton>
                        <PrimaryButton type="submit" disabled={!valid || saving}>{saving ? 'Saving...' : editing ? 'Save changes' : enquiryOnly ? 'Save enquiry' : 'Register'}</PrimaryButton>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
