'use client';

import { useState } from 'react';
import { ClipboardList, Copy, Pencil, Printer } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pill, PrimaryButton, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import AdmissionFormFields from './AdmissionFormFields';
import { apiError, formatDateTime, scrollStyle, whatsappLink, type ApplicationDetail, type FormValues } from './admissions.types';

/** Admission form status in the drawer: fill / print (online), or print / received (paper). */
export default function AdmissionFormCard({ a, phone, onChanged }: { a: ApplicationDetail; phone?: string; onChanged: () => void | Promise<void> }) {
    const form = a.admissionForm;
    const [editing, setEditing] = useState(false);
    const [values, setValues] = useState<FormValues>({});
    const [saving, setSaving] = useState(false);
    if (!form) return null;

    const cfg = form.config;
    const open = !a.outcome && (a.stage === 'SELECTED' || a.stage === 'ADMITTED');
    const link = a.statusLink ? a.statusLink.replace('/status/', '/admission-form/') : '';
    const done = form.status !== 'PENDING';
    const printUrl = `/print/admission-form/${a.id}`;

    const markReceived = async (received: boolean) => {
        setSaving(true);
        try {
            await api.post(`/admin/admissions/applications/${a.id}/admission-form/received`, { revision: a.revision, received });
            toast.success(received ? 'Admission form marked as received' : 'Marked as not received');
            await onChanged();
        } catch (err) { toast.error(apiError(err, 'Could not update')); }
        finally { setSaving(false); }
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put(`/admin/admissions/applications/${a.id}/admission-form`, { revision: a.revision, values });
            toast.success('Admission form saved');
            setEditing(false);
            await onChanged();
        } catch (err) { toast.error(apiError(err, 'Could not save the form')); }
        finally { setSaving(false); }
    };

    const btn = 'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted/50';
    const status = form.status === 'FILLED' ? <Pill tone="green">Filled</Pill> : form.status === 'RECEIVED' ? <Pill tone="green">Form received</Pill> : <Pill tone="amber">{cfg.mode === 'ONLINE' ? 'Not filled yet' : 'Not received yet'}</Pill>;

    return (
        <section data-admin-surface="" className="rounded-2xl border border-border/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList size={17} /></span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{cfg.title}</h3>{open && status}</div>
                        <p className="text-[11px] text-muted-foreground">
                            {!open ? 'Opens after the child is selected.'
                                : done ? `${form.status === 'FILLED' ? 'Filled' : 'Received'} ${form.by ? `by ${form.by} ` : ''}${form.at ? `on ${formatDateTime(form.at)}` : ''}`
                                : cfg.mode === 'ONLINE' ? 'The parent got a link with the offer. You can also fill it here.' : 'Give your admission form to the parent. Tick it here when it comes back filled.'}
                        </p>
                    </div>
                </div>
                {open && (
                    <div className="flex flex-wrap gap-2">
                        {cfg.mode === 'ONLINE' && <a href={printUrl} target="_blank" rel="noopener noreferrer" className={btn}><Printer size={13} />Print</a>}
                        {cfg.mode === 'ONLINE' && link && <>
                            <button type="button" className={btn} onClick={() => { void navigator.clipboard.writeText(link).then(() => toast.success('Form link copied')); }}><Copy size={13} />Copy link</button>
                            {phone && <a href={whatsappLink(`📝 *${cfg.title}*\n\nPlease fill ${a.childName}'s admission form here:\n${link}`, phone)} target="_blank" rel="noopener noreferrer" className={btn}><FaWhatsapp size={14} className="text-[#25D366]" />WhatsApp</a>}
                        </>}
                        {cfg.mode === 'ONLINE' && <button type="button" className={btn} onClick={() => { setValues(form.values); setEditing(true); }}><Pencil size={13} />{done ? 'Edit' : 'Fill here'}</button>}
                        {cfg.mode === 'OFFLINE' && (form.status === 'RECEIVED'
                            ? <SecondaryButton type="button" disabled={saving} onClick={() => void markReceived(false)}>Undo received</SecondaryButton>
                            : <PrimaryButton type="button" disabled={saving} onClick={() => void markReceived(true)}>Form received</PrimaryButton>)}
                    </div>
                )}
            </div>

            <Dialog open={editing} onOpenChange={o => { if (!o && !saving) setEditing(false); }}>
                <DialogContent className="sm:max-w-3xl bg-card max-h-[88vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>{cfg.title}: {a.childName}</DialogTitle>
                        <DialogDescription>Details from the registration form are already filled. Fields with * are needed.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={save} className="flex-1 min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1" style={scrollStyle}>
                            <AdmissionFormFields sections={cfg.sections} values={values} disabled={saving} onChange={(id, v) => setValues(prev => ({ ...prev, [id]: v }))} />
                        </div>
                        <div className="shrink-0 flex justify-end gap-2 border-t border-border/50 pt-3 mt-3">
                            <SecondaryButton type="button" disabled={saving} onClick={() => setEditing(false)}>Cancel</SecondaryButton>
                            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save form'}</PrimaryButton>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </section>
    );
}
