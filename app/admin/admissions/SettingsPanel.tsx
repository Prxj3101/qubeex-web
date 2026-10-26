'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Field, inputCls, SecondaryButton, TERRACOTTA, ThemedSelect, Toggle } from '@/app/admin/payroll/_components/ui';
import { dropLostBoxes, formValid } from './AdmissionFormEditor';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { apiError, FIELD_LABELS, scrollStyle, settingsBody, type AdmissionSettings, type FieldKey, type SettingsResponse } from './admissions.types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'item';
const uniqueId = (base: string, taken: string[]) => { let id = base, n = 2; while (taken.includes(id)) id = `${base}_${n++}`; return id; };

const Card = ({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) => (
    <section data-admin-surface="" className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <div><h2 className="text-sm font-semibold">{title}</h2>{text && <p className="text-xs text-muted-foreground">{text}</p>}</div>
        {children}
    </section>
);

/** How this school runs admissions. Everything has a sensible default, so most schools only check it once. */
export default function SettingsPanel({ setup, onSaved }: { setup: SettingsResponse; onSaved: (next: SettingsResponse) => void }) {
    const [s, setS] = useState<AdmissionSettings>(setup.settings);
    const [fee, setFee] = useState(setup.settings.registrationFee == null ? '' : String(setup.settings.registrationFee));
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const saving = saveStatus === 'saving';
    const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef({ s: setup.settings, fee: '' });
    const set = (patch: Partial<AdmissionSettings>) => setS(prev => ({ ...prev, ...patch }));
    // Removing a filled row asks first; an empty row goes straight away.
    const [toRemove, setToRemove] = useState<{ label: string; name: string; run: () => void } | null>(null);
    const askRemove = (label: string, name: string, run: () => void) => (name.trim() ? setToRemove({ label, name: name.trim(), run }) : run());
    const [cutMonth, cutDay] = s.ageCutoff.split('-').map(Number);
    const dirty = useMemo(() => JSON.stringify({ ...s, registrationFee: fee === '' ? null : Number(fee) }) !== JSON.stringify(setup.settings), [s, fee, setup.settings]);

    const docsValid = s.documents.every(d => d.name.trim()) && s.questions.every(q => q.label.trim()) && formValid(s.admissionForm);

    useEffect(() => { latest.current = { s, fee }; }, [s, fee]);

    // Same as attendance: saves by itself 2s after the last change; the button saves right away.
    const save = async () => {
        if (autoTimer.current) clearTimeout(autoTimer.current);
        if (saving || !docsValid || !dirty) return;
        const sent = JSON.stringify({ s, fee });
        setSaveStatus('saving');
        try {
            await api.put('/admin/admissions/settings', settingsBody({ ...s, admissionForm: dropLostBoxes(s.admissionForm) }, fee === '' ? null : Number(fee)));
            const res = await api.get('/admin/admissions/settings');
            onSaved(res.data.data);
            // Keep anything typed while saving; only take the new version number.
            const fresh = res.data.data.settings as AdmissionSettings;
            if (JSON.stringify(latest.current) === sent) setS(fresh);
            else setS(prev => ({ ...prev, revision: fresh.revision }));
            setSaveStatus('saved');
            if (savedTimer.current) clearTimeout(savedTimer.current);
            savedTimer.current = setTimeout(() => setSaveStatus(st => (st === 'saved' ? 'idle' : st)), 2000);
        } catch (err) {
            toast.error(apiError(err, 'Could not save settings'));
            setSaveStatus('error');
        }
    };

    useEffect(() => {
        if (!dirty || !docsValid || saving) return;
        if (autoTimer.current) clearTimeout(autoTimer.current);
        autoTimer.current = setTimeout(() => { void save(); }, 2000);
        return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [s, fee, docsValid]);

    const af = s.admissionForm;
    const formSummary = af.mode === 'OFFLINE' ? "Your own paper form; the office ticks it when it comes back" : [
        af.mode === 'ONLINE' ? 'Parents fill it online' : 'Paper form',
        af.template?.kind === 'UPLOAD' ? `School's own form, ${af.template.boxes.length} boxes marked` : 'General form',
        `${af.sections.reduce((n, x) => n + x.fields.length, 0)} questions`,
    ].join(' | ');

    const ruleFor = (standardId: string) => s.ageRules.find(r => r.standardId === standardId);
    const setRule = (standardId: string, years: string, months: string) => {
        const total = years === '' && months === '' ? null : (Number(years) || 0) * 12 + (Number(months) || 0);
        set({ ageRules: [...s.ageRules.filter(r => r.standardId !== standardId), ...(total == null ? [] : [{ standardId, minMonths: total }])] });
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-3 pb-3">
            <div className="shrink-0 px-1">
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div>
                    <h1 className="text-xl font-bold">Admission settings</h1>
                    <p className="text-muted-foreground text-[13px]">How your school takes admissions. Set it once; you can change it any time.</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => void save()} disabled={saving || !docsValid || (!dirty && saveStatus !== 'saved')}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                        style={{ background: saveStatus === 'saved' || (!dirty && saveStatus === 'idle') ? '#10b981' : TERRACOTTA }}>
                        {saving ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            : saveStatus === 'saved' || !dirty ? <CheckCircle2 size={13} /> : <Save size={13} />}
                        {saving ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : !dirty ? 'All changes saved' : !docsValid ? 'Fix the form to save' : 'Save now'}
                    </button>
                </div>
            </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={scrollStyle}>
                <div className="grid xl:grid-cols-2 gap-3 items-start">
                    <div className="space-y-3">
                        <Card title="Session and form" text="Which session you are taking admissions for, and whether parents can apply online.">
                            <Field label="Admissions for session">
                                <ThemedSelect value={s.academicYearId ?? setup.session.id} onChange={v => set({ academicYearId: v })}
                                    options={setup.sessions.map(x => ({ value: x.id, label: `${x.label}${x.isCurrent ? ' (current)' : ' (next)'}` }))} />
                            </Field>
                            <Toggle checked={s.formOpen} onChange={v => set({ formOpen: v })} label="Online form is open" hint="Parents can fill the registration form from the link or QR code" />
                            <Toggle checked={s.interactionStep} onChange={v => set({ interactionStep: v })} label="We hold an interaction or test" hint="Turn off if you select children straight from the form" />
                        </Card>

                        <Card title="Registration and admission fees" text="Payments are noted by the office. Online payment comes later.">
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Registration fee (Rs)" hint="Leave blank if there is none"><input inputMode="decimal" className={inputCls} value={fee} onChange={e => setFee(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                                <Field label="Days to pay the admission fee" hint="Counted from the day the offer is sent"><input type="number" min={1} max={90} className={inputCls} value={s.admissionFeeDays} onChange={e => set({ admissionFeeDays: Math.min(90, Math.max(1, Number(e.target.value) || 1)) })} /></Field>
                            </div>
                        </Card>

                        <Card title="Admission number" text="Given when a child is admitted. Continue from your register.">
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Prefix (optional)" hint="e.g. 2027/"><input maxLength={20} className={inputCls} value={s.admissionNoPrefix} onChange={e => set({ admissionNoPrefix: e.target.value })} /></Field>
                                <Field label="Next number"><input type="number" min={1} className={inputCls} value={s.nextAdmissionNo} onChange={e => set({ nextAdmissionNo: Math.max(1, Number(e.target.value) || 1) })} /></Field>
                            </div>
                            <p className="text-xs text-muted-foreground">Next admission number: <span className="font-semibold text-foreground">{s.admissionNoPrefix.trim()}{String(s.nextAdmissionNo).padStart(4, '0')}</span></p>
                        </Card>

                        <Card title="Age rules" text="Optional. Cards show a warning when a child is under age for the class. Nothing is blocked.">
                            <Field label="Age is counted as on">
                                <div className="flex gap-2">
                                    <div className="w-24"><ThemedSelect value={String(cutDay)} onChange={v => set({ ageCutoff: `${String(cutMonth).padStart(2, '0')}-${v.padStart(2, '0')}` })} options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} /></div>
                                    <div className="w-40"><ThemedSelect value={String(cutMonth)} onChange={v => set({ ageCutoff: `${v.padStart(2, '0')}-${String(cutDay).padStart(2, '0')}` })} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} /></div>
                                </div>
                            </Field>
                            <div className="divide-y divide-border/40">
                                {setup.standards.map(std => {
                                    const r = ruleFor(std.id);
                                    const years = r ? String(Math.floor(r.minMonths / 12)) : '';
                                    const months = r ? String(r.minMonths % 12) : '';
                                    return (
                                        <div key={std.id} className="flex items-center gap-3 py-2 text-sm">
                                            <span className="flex-1 font-medium">{std.name}</span>
                                            <span className="text-xs text-muted-foreground">Min age</span>
                                            <input aria-label={`${std.name} minimum years`} type="number" min={0} max={25} className={`${inputCls} w-16`} value={years} placeholder="-" onChange={e => setRule(std.id, e.target.value, months)} />
                                            <span className="text-xs text-muted-foreground">yrs</span>
                                            <input aria-label={`${std.name} minimum months`} type="number" min={0} max={11} className={`${inputCls} w-16`} value={months} placeholder="-" onChange={e => setRule(std.id, years, e.target.value)} />
                                            <span className="text-xs text-muted-foreground">mo</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-3">
                        <Card title="Admission form" text="The school's full form, filled after a child is selected and printed for signatures.">
                        <Toggle checked={s.admissionForm.enabled} onChange={v => set({ admissionForm: { ...s.admissionForm, enabled: v } })} label="Use an admission form" hint="After a child is selected, the full admission form is filled and printed for signatures" />
                        {s.admissionForm.enabled && <p className="text-[11px] text-muted-foreground">{formSummary}. Set it up in the <span className="font-semibold text-foreground">Admission form</span> tab above.</p>}
                        {!formValid(s.admissionForm) && <p className="text-xs text-red-600 dark:text-red-400">The form setup has an empty name or choice. Fix it in the Admission form tab.</p>}
                    </Card>
                        <Card title="Registration form fields" text="Name, date of birth, class, parents and phone are always asked. Pick the rest.">
                            <div className="grid sm:grid-cols-2 gap-3">
                                {(Object.keys(FIELD_LABELS) as FieldKey[]).map(k => (
                                    <Toggle key={k} checked={!!s.fields[k]} onChange={v => set({ fields: { ...s.fields, [k]: v } })} label={FIELD_LABELS[k]} />
                                ))}
                            </div>
                        </Card>

                        <Card title="Your own questions" text="Up to 10 extra questions on the form, e.g. How did you hear about us?">
                            {s.questions.map((q, i) => (
                                <div key={q.id} className="flex items-center gap-2">
                                    <input aria-label={`Question ${i + 1}`} maxLength={160} className={inputCls} value={q.label} onChange={e => set({ questions: s.questions.map(x => x.id === q.id ? { ...x, label: e.target.value } : x) })} />
                                    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap"><input type="checkbox" checked={q.required} onChange={e => set({ questions: s.questions.map(x => x.id === q.id ? { ...x, required: e.target.checked } : x) })} className="accent-[#DA7756]" />Must answer</label>
                                    <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => askRemove('question', q.label, () => set({ questions: s.questions.filter(x => x.id !== q.id) }))} className="w-8 h-8 shrink-0 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                                </div>
                            ))}
                            {s.questions.length < 10 && <SecondaryButton type="button" onClick={() => set({ questions: [...s.questions, { id: uniqueId(`q${s.questions.length + 1}`, s.questions.map(q => q.id)), label: '', required: false }] })}><Plus size={13} />Add question</SecondaryButton>}
                        </Card>

                        <Card title="Documents to check" text="The office ticks these after seeing the originals. Nothing is uploaded. Starred ones are needed for a full (not provisional) admission.">
                            <div className="space-y-2">
                                {s.documents.map((d, i) => (
                                    <div key={d.id} className="flex items-center gap-2">
                                        <input aria-label={`Document ${i + 1}`} maxLength={120} className={inputCls} value={d.name} onChange={e => set({ documents: s.documents.map(x => x.id === d.id ? { ...x, name: e.target.value } : x) })} />
                                        <label className="flex items-center gap-1.5 text-xs whitespace-nowrap"><input type="checkbox" checked={d.required} onChange={e => set({ documents: s.documents.map(x => x.id === d.id ? { ...x, required: e.target.checked } : x) })} className="accent-[#DA7756]" />Required</label>
                                        <button type="button" aria-label={`Remove ${d.name || 'document'}`} onClick={() => askRemove('document', d.name, () => set({ documents: s.documents.filter(x => x.id !== d.id) }))} className="w-8 h-8 shrink-0 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                                    </div>
                                ))}
                            </div>
                            {s.documents.length < 40 && <SecondaryButton type="button" onClick={() => set({ documents: [...s.documents, { id: uniqueId(slug(`doc ${s.documents.length + 1}`), s.documents.map(d => d.id)), name: '', required: false }] })}><Plus size={13} />Add document</SecondaryButton>}
                            {!docsValid && <p className="text-xs text-red-600 dark:text-red-400">Fill or remove the empty rows before saving.</p>}
                        </Card>
                    </div>
                </div>
            </div>
            <DeleteConfirmDialog open={!!toRemove} onOpenChange={o => { if (!o) setToRemove(null); }} confirmLabel="Remove" label={toRemove?.label ?? ''} name={toRemove?.name ?? ''}
                description="It is removed from the registration form. You can add it again any time."
                onConfirm={() => { toRemove?.run(); setToRemove(null); }} />
        </div>
    );
}
