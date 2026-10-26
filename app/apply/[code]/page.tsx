'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, FileText, House, MessageCircleQuestion, PartyPopper, Smile, Users } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import ApplyShell, { HeaderChip, PhoneField, SectionCard, fieldCls, phoneComplete } from '../_components/ApplyShell';
import { BackpackDoodle, BookDoodle, StarDoodle } from '../_components/Doodles';

// Public registration form a school shares with parents (link or QR code).
// No login. Phone first, only the fields the school turned on.

type FieldKey = 'bloodGroup' | 'previousSchool' | 'address' | 'sibling' | 'transport' | 'religion' | 'category' | 'motherTongue';
interface FormInfo {
    school: { name: string; logoUrl: string | null };
    open: boolean;
    session: string;
    classes: { id: string; name: string }[];
    fields: Record<FieldKey, boolean>;
    questions: { id: string; label: string; required: boolean }[];
    documents: { id: string; name: string; required: boolean }[];
    registrationFee: number | null;
}

function Q({ title, children, hint, required }: { title: string; children: React.ReactNode; hint?: string; required?: boolean }) {
    return (
        <label className="block">
            <span className="block text-[13px] font-semibold text-slate-700 mb-1.5">{title}{required && <span className="text-[#DA7756]"> *</span>}</span>
            {children}
            {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
        </label>
    );
}

function Chips<T extends string>({ value, options, onChange, label }: { value: T | ''; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
    return (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
            {options.map(o => {
                const on = value === o.value;
                return (
                    <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
                        className={`h-11 px-4 rounded-2xl border-2 text-sm font-semibold transition ${on ? 'border-[#DA7756] bg-[#FFF1EA] text-[#B4532F]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                        {on && <Check size={14} className="inline -mt-0.5 mr-1" />}{o.label}
                    </button>
                );
            })}
        </div>
    );
}

export default function ApplyPage() {
    const { code } = useParams<{ code: string }>();
    const [info, setInfo] = useState<FormInfo | null>(null);
    const [loadError, setLoadError] = useState('');
    const [f, setF] = useState({
        childName: '', dob: '', gender: '', standardId: '', fatherName: '', motherName: '', guardianName: '', phone: '', altPhone: '', email: '',
        address: '', city: '', pincode: '', bloodGroup: '', previousSchool: '', sibling: '', transport: '', religion: '', category: '', motherTongue: '', website: '',
    });
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [consent, setConsent] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState<{ applicationNo: string; statusToken: string } | null>(null);
    const set = (patch: Partial<typeof f>) => setF(prev => ({ ...prev, ...patch }));

    useEffect(() => {
        api.get(`/public/admissions/${encodeURIComponent(code)}`)
            .then(res => setInfo(res.data.data))
            .catch(err => setLoadError(getErrorMessage(err, 'This form could not be opened')));
    }, [code]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sending || !info) return;
        setError('');
        if (!f.standardId) { setError('Please pick the class you are applying for.'); return; }
        if (!f.fatherName.trim() && !f.motherName.trim() && !f.guardianName.trim()) { setError("Please enter at least one parent's or guardian's name."); return; }
        setSending(true);
        try {
            const res = await api.post(`/public/admissions/${encodeURIComponent(code)}/applications`, {
                childName: f.childName.trim(), dob: f.dob, gender: f.gender || null, standardId: f.standardId, consent: true, website: f.website,
                details: {
                    phone: f.phone.trim(), email: f.email.trim(), fatherName: f.fatherName.trim(), motherName: f.motherName.trim(), guardianName: f.guardianName.trim(),
                    altPhone: f.altPhone.trim(), address: f.address.trim(), city: f.city.trim(), pincode: f.pincode.trim(), bloodGroup: f.bloodGroup.trim(),
                    previousSchool: f.previousSchool.trim(), sibling: f.sibling.trim(), transport: f.transport.trim(), religion: f.religion.trim(),
                    category: f.category, motherTongue: f.motherTongue.trim(), answers,
                },
            });
            setDone(res.data.data);
            window.scrollTo({ top: 0 });
        } catch (err) {
            const data = (err as { response?: { data?: { errors?: { message: string }[] } } }).response?.data;
            setError(data?.errors?.[0]?.message ?? getErrorMessage(err, 'Could not send the form. Please try again.'));
        } finally { setSending(false); }
    };

    const subtitle = info ? `Admission registration | Session ${info.session}` : undefined;

    if (loadError) {
        return (
            <ApplyShell school={null}>
                <div className="rounded-[28px] bg-white/95 p-8 text-center shadow-lg ring-1 ring-slate-200/70">
                    <BookDoodle className="mx-auto w-20" />
                    <p className="mt-4 text-lg font-bold">This form could not be opened</p>
                    <p className="mt-1 text-sm text-slate-500">{loadError}. Please check the link with the school office.</p>
                </div>
            </ApplyShell>
        );
    }
    if (!info) {
        return <ApplyShell school={null}><p role="status" className="py-20 text-center text-sm text-slate-500">Opening the form...</p></ApplyShell>;
    }

    if (done) {
        return (
            <ApplyShell school={info.school} subtitle={subtitle}
                left={<HeaderChip icon="🎒" title="Admissions open" text={`Session ${info.session}`} />}
                right={<HeaderChip icon="✅" title="Form sent" text={`Application ${done.applicationNo}`} />}>
                <div className="space-y-5">
                    <section className="relative overflow-hidden rounded-[28px] bg-white/95 p-7 text-center shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70">
                        <StarDoodle className="absolute left-5 top-5 w-8 -rotate-12" />
                        <StarDoodle className="absolute right-6 top-10 w-6 rotate-12" />
                        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#DCFCE7] text-emerald-600 ring-8 ring-[#DCFCE7]/50"><PartyPopper size={30} /></span>
                        <h1 className="mt-4 text-2xl font-extrabold">Form received!</h1>
                        <p className="mt-1 text-sm text-slate-500">Thank you. Please keep your application number.</p>
                        <div className="mx-auto mt-5 w-fit rounded-2xl border-2 border-dashed border-[#DA7756]/60 bg-[#FFF7ED] px-6 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4532F]">Application number</p>
                            <p className="mt-0.5 text-2xl font-extrabold tracking-wide">{done.applicationNo}</p>
                        </div>
                        <p className="mt-5 text-sm text-slate-600">We have emailed you a link to check the status. The school office will contact you about the next step.</p>
                        <Link href={`/apply/${encodeURIComponent(code)}/status/${done.statusToken}`} className="mt-5 inline-flex h-12 items-center rounded-full px-7 text-[15px] font-semibold text-white shadow-md transition hover:opacity-95" style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 45%, #C06040 100%)' }}>See application status</Link>
                    </section>
                    {(info.registrationFee || info.documents.length > 0) && (
                        <SectionCard n={1} color="#60A5FA" icon={<FileText size={20} />} title="What to bring to the school" hint="You do not upload anything. The office only looks at the originals.">
                            {info.registrationFee ? <p className="rounded-2xl bg-[#FFF7ED] px-4 py-3 text-sm">Registration fee: <span className="font-bold">Rs {info.registrationFee}</span>, paid at the school office.</p> : null}
                            {info.documents.length > 0 && (
                                <ul className="grid sm:grid-cols-2 gap-2">
                                    {info.documents.map(d => (
                                        <li key={d.id} className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px]">
                                            <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" /><span>{d.name}{d.required && <span className="text-[#DA7756] font-semibold"> (needed)</span>}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </SectionCard>
                    )}
                </div>
            </ApplyShell>
        );
    }

    if (!info.open) {
        return (
            <ApplyShell school={info.school} subtitle={subtitle}>
                <div className="rounded-[28px] bg-white/95 p-8 text-center shadow-lg ring-1 ring-slate-200/70">
                    <BackpackDoodle className="mx-auto w-16" />
                    <p className="mt-4 text-lg font-bold">Admissions are closed right now</p>
                    <p className="mt-1 text-sm text-slate-500">Please contact the school office to know when they open.</p>
                </div>
            </ApplyShell>
        );
    }

    const on = (k: FieldKey) => !!info.fields[k];
    const useChips = info.classes.length <= 16;
    let n = 0;
    const next = () => ++n;

    const footer = (
        <div className="space-y-2">
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700 ring-1 ring-red-200">{error}</p>}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="flex items-start gap-3 text-[12px] sm:text-[13px] text-slate-600 flex-1 cursor-pointer">
                <input type="checkbox" form="admission-form" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#DA7756]" />
                <span>I am the parent or guardian. The details are correct, and I agree that {info.school.name} may use them for this admission.</span>
            </label>
            <button type="submit" form="admission-form" disabled={sending || !consent}
                className="h-12 shrink-0 rounded-full px-8 text-[15px] font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 45%, #C06040 100%)' }}>
                {sending ? 'Sending...' : 'Send form'}
            </button>
        </div>
        </div>
    );

    // Needed fields filled so far, for the header progress.
    const needed = [
        !!f.childName.trim(), !!f.standardId, !!f.dob,
        !!(f.fatherName.trim() || f.motherName.trim() || f.guardianName.trim()),
        phoneComplete(f.phone), /^\S+@\S+\.\S+$/.test(f.email.trim()),
        ...info.questions.filter(q => q.required).map(q => !!answers[q.id]?.trim()),
        consent,
    ];
    const filled = needed.filter(Boolean).length;
    const progress = filled / needed.length;

    return (
        <ApplyShell school={info.school} subtitle={subtitle} footer={footer} progress={progress}
            left={<HeaderChip icon="🎒" title="Admissions open" text={`Session ${info.session} | About 3 minutes`} />}
            right={<HeaderChip icon={filled === needed.length ? '✅' : '📝'} title={filled === needed.length ? 'All set, send the form' : `${filled} of ${needed.length} needed filled`}
                text={<span className="inline-flex items-center gap-2"><span className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></span>{Math.round(progress * 100)}%</span>} />}>
            <form id="admission-form" onSubmit={submit} className="space-y-5">
                <div className="rounded-[28px] bg-gradient-to-br from-[#FFF1EA] to-white p-5 ring-1 ring-[#F5C2B0]/60 flex items-center gap-4">
                    <BackpackDoodle className="w-12 shrink-0 -rotate-6" />
                    <div>
                        <p className="font-bold">Welcome! Let&apos;s get your child registered.</p>
                        <p className="text-[13px] text-slate-600">It takes about 3 minutes. Fields with <span className="text-[#DA7756] font-semibold">*</span> are needed.</p>
                    </div>
                </div>

                <fieldset disabled={sending} className="space-y-5">
                    <SectionCard n={next()} color="#DA7756" icon={<Smile size={20} />} title="About your child">
                        <Q title="Child's full name" required><input required maxLength={100} className={fieldCls} value={f.childName} onChange={e => set({ childName: e.target.value })} autoComplete="off" placeholder="As on the birth certificate" /></Q>
                        <div>
                            <span className="block text-[13px] font-semibold text-slate-700 mb-1.5">Class applying for<span className="text-[#DA7756]"> *</span></span>
                            {useChips
                                ? <Chips label="Class applying for" value={f.standardId} onChange={v => set({ standardId: v })} options={info.classes.map(c => ({ value: c.id, label: c.name }))} />
                                : <select required className={fieldCls} value={f.standardId} onChange={e => set({ standardId: e.target.value })}><option value="" disabled>Pick a class</option>{info.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Q title="Date of birth" required><input required type="date" className={fieldCls} value={f.dob} onChange={e => set({ dob: e.target.value })} /></Q>
                            <div>
                                <span className="block text-[13px] font-semibold text-slate-700 mb-1.5">Gender</span>
                                <Chips label="Gender" value={f.gender as 'Male' | 'Female' | 'Other' | ''} onChange={v => set({ gender: v })} options={[{ value: 'Male', label: 'Boy' }, { value: 'Female', label: 'Girl' }, { value: 'Other', label: 'Other' }]} />
                            </div>
                        </div>
                        {on('previousSchool') && <Q title="Previous school" hint="Leave blank if this is the first school"><input maxLength={160} className={fieldCls} value={f.previousSchool} onChange={e => set({ previousSchool: e.target.value })} /></Q>}
                        {(on('bloodGroup') || on('motherTongue') || on('religion') || on('category')) && (
                            <div className="grid sm:grid-cols-2 gap-4">
                                {on('bloodGroup') && <Q title="Blood group"><input maxLength={5} className={fieldCls} value={f.bloodGroup} onChange={e => set({ bloodGroup: e.target.value })} placeholder="e.g. B+" /></Q>}
                                {on('motherTongue') && <Q title="Mother tongue"><input maxLength={40} className={fieldCls} value={f.motherTongue} onChange={e => set({ motherTongue: e.target.value })} /></Q>}
                                {on('religion') && <Q title="Religion"><input maxLength={40} className={fieldCls} value={f.religion} onChange={e => set({ religion: e.target.value })} /></Q>}
                                {on('category') && <Q title="Category"><select className={fieldCls} value={f.category} onChange={e => set({ category: e.target.value })}><option value="">Select</option>{['General', 'OBC', 'SC', 'ST', 'EWS'].map(c => <option key={c} value={c}>{c}</option>)}</select></Q>}
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard n={next()} color="#60A5FA" icon={<Users size={20} />} title="Parents" hint="At least one parent or guardian">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Q title="Father's name"><input maxLength={100} className={fieldCls} value={f.fatherName} onChange={e => set({ fatherName: e.target.value })} autoComplete="off" /></Q>
                            <Q title="Mother's name"><input maxLength={100} className={fieldCls} value={f.motherName} onChange={e => set({ motherName: e.target.value })} autoComplete="off" /></Q>
                        </div>
                        <Q title="Guardian" hint="Only if the child lives with someone other than the parents"><input maxLength={100} className={fieldCls} value={f.guardianName} onChange={e => set({ guardianName: e.target.value })} autoComplete="off" /></Q>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Q title="Phone" required><PhoneField required value={f.phone} onChange={v => set({ phone: v })} autoComplete="tel-national" /></Q>
                            <Q title="Second phone"><PhoneField value={f.altPhone} onChange={v => set({ altPhone: v })} /></Q>
                        </div>
                        <Q title="Email" required hint="We send the status and every update here"><input required type="email" maxLength={160} className={fieldCls} value={f.email} onChange={e => set({ email: e.target.value })} autoComplete="email" placeholder="name@example.com" /></Q>
                    </SectionCard>

                    {(on('address') || on('sibling') || on('transport')) && (
                        <SectionCard n={next()} color="#34D399" icon={<House size={20} />} title="Home and school">
                            {on('address') && <Q title="Home address"><input maxLength={300} className={fieldCls} value={f.address} onChange={e => set({ address: e.target.value })} autoComplete="street-address" /></Q>}
                            {on('address') && <div className="grid grid-cols-2 gap-4"><Q title="City"><input maxLength={80} className={fieldCls} value={f.city} onChange={e => set({ city: e.target.value })} /></Q><Q title="PIN code"><input inputMode="numeric" maxLength={10} className={fieldCls} value={f.pincode} onChange={e => set({ pincode: e.target.value })} /></Q></div>}
                            {on('sibling') && <Q title="Brother or sister in this school?" hint="Name and class, if any"><input maxLength={160} className={fieldCls} value={f.sibling} onChange={e => set({ sibling: e.target.value })} /></Q>}
                            {on('transport') && <Q title="Need the school bus?" hint="Your pickup area, if yes"><input maxLength={160} className={fieldCls} value={f.transport} onChange={e => set({ transport: e.target.value })} /></Q>}
                        </SectionCard>
                    )}

                    {info.questions.length > 0 && (
                        <SectionCard n={next()} color="#A78BFA" icon={<MessageCircleQuestion size={20} />} title="A few more questions">
                            {info.questions.map(q => (
                                <Q key={q.id} title={q.label} required={q.required}><input required={q.required} maxLength={500} className={fieldCls} value={answers[q.id] ?? ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} /></Q>
                            ))}
                        </SectionCard>
                    )}

                    {/* Honeypot for bots: hidden from people and screen readers. */}
                    <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={f.website} onChange={e => set({ website: e.target.value })} />
                </fieldset>

                <p className="text-center text-[11px] text-slate-500">Powered by QubeEx</p>
            </form>
        </ApplyShell>
    );
}
