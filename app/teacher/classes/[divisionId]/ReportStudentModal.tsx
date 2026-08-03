'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Paperclip, X, FileText, FileSpreadsheet, FileType } from 'lucide-react';
import api from '@/lib/api';
import { validateAttachment, ATTACHMENT_ACCEPT } from '@/lib/attachmentValidation';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

const CATEGORY_OPTIONS = [
    'Attendance',
    'Discipline',
    'Poor Performance',
    'Assignment Not Submitted',
    'Misconduct',
    'Other',
];

export interface ReportFormData {
    severity: Severity;
    category: string;
    title: string;
    detail: string;
    subject?: string;
    actionTaken?: string;
    attachmentUrl?: string;
    attachmentType?: string;
    attachmentName?: string;
}

interface ReportStudentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentName: string;
    loading: boolean;
    onSubmit: (data: ReportFormData) => Promise<void>;
    /** e.g. '/teacher/campus/feed/upload' or '/admin/campus/feed/upload' — reused R2 attachment upload endpoint. */
    uploadUrl: string;
}

interface FormState {
    severity: Severity;
    category: string;
    customCategory: string;
    title: string;
    detail: string;
    subject: string;
    actionTaken: string;
}

const EMPTY_FORM: FormState = {
    severity: 'MEDIUM', category: 'Discipline', customCategory: '', title: '', detail: '', subject: '', actionTaken: '',
};

const SEVERITY_CFG: Record<Severity, { label: string; activeClass: string; dotColor: string }> = {
    LOW: { label: 'Low', activeClass: 'bg-amber-100 dark:bg-amber-950 border-amber-400 text-amber-800 dark:text-amber-300', dotColor: '#FCFF38' },
    MEDIUM: { label: 'Medium', activeClass: 'bg-orange-100 dark:bg-orange-950 border-orange-400 text-orange-800 dark:text-orange-300', dotColor: '#FB923C' },
    HIGH: { label: 'High', activeClass: 'bg-red-100 dark:bg-red-950 border-red-400 text-red-800 dark:text-red-300', dotColor: '#DC2626' },
};

function attachmentIcon(name: string, mimeType: string) {
    if (mimeType.startsWith('image/')) return null;
    if (name.endsWith('.pdf') || mimeType === 'application/pdf') return <FileText size={13} className="text-red-500" />;
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) return <FileSpreadsheet size={13} className="text-emerald-600" />;
    if (name.endsWith('.docx') || name.endsWith('.doc')) return <FileType size={13} className="text-blue-500" />;
    return <Paperclip size={13} className="text-muted-foreground" />;
}

export default function ReportStudentModal({ open, onOpenChange, studentName, loading, onSubmit, uploadUrl }: ReportStudentModalProps) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [attachment, setAttachment] = useState<{ url: string; name: string; type: string; mimeType: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setForm(EMPTY_FORM);
        setAttachment(null);
    };

    const handleClose = (next: boolean) => {
        if (!next) reset();
        onOpenChange(next);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const err = validateAttachment(file);
        if (err) { toast.error(err); return; }
        setUploading(true);
        try {
            const body = new FormData();
            body.append('file', file);
            const res = await api.post(uploadUrl, body, { headers: { 'Content-Type': 'multipart/form-data' } });
            setAttachment(res.data.data);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string; message?: string } } };
            toast.error(e?.response?.data?.error ?? e?.response?.data?.message ?? 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const resolvedCategory = form.category === 'Other' ? form.customCategory.trim() : form.category;
    const canSubmit = !!resolvedCategory && !!form.title.trim() && !!form.detail.trim() && !uploading;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        await onSubmit({
            severity: form.severity,
            category: resolvedCategory,
            title: form.title.trim(),
            detail: form.detail.trim(),
            subject: form.subject.trim() || undefined,
            actionTaken: form.actionTaken.trim() || undefined,
            ...(attachment ? {
                attachmentUrl: attachment.url,
                attachmentType: attachment.mimeType,
                attachmentName: attachment.name,
            } : {}),
        });
        reset();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className="p-0 gap-0 bg-card flex flex-col"
                style={{ width: '90vw', maxWidth: '480px', maxHeight: '85vh' }}
            >
                {/* Header */}
                <div className="px-6 pt-5 pb-3.5 border-b border-border/50 shrink-0">
                    <DialogTitle className="text-base font-semibold">Report {studentName}</DialogTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        This report will be sent to {studentName.split(' ')[0]}&apos;s class teacher for review.
                    </p>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-3">
                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Severity</label>
                        <div className="flex gap-2">
                            {(Object.keys(SEVERITY_CFG) as Severity[]).map(sev => (
                                <button key={sev} type="button" onClick={() => setForm(f => ({ ...f, severity: sev }))}
                                    className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${form.severity === sev ? SEVERITY_CFG[sev].activeClass : 'border-border/50 text-muted-foreground hover:bg-muted/40'}`}>
                                    <span style={{
                                        width: 12, height: 16, borderRadius: 2,
                                        backgroundColor: SEVERITY_CFG[sev].dotColor,
                                        transform: 'rotate(-5deg)',
                                        boxShadow: '1px 2px 0px rgba(0,0,0,0.35)',
                                        display: 'inline-block',
                                    }} />
                                    {SEVERITY_CFG[sev].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Category</label>
                        <select
                            value={form.category}
                            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                        >
                            {CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        {form.category === 'Other' && (
                            <Input
                                value={form.customCategory}
                                onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))}
                                placeholder="Describe the category"
                                className="h-8 text-sm mt-2"
                            />
                        )}
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Card Title</label>
                        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Short title" className="h-8 text-sm" />
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Incident Details</label>
                        <textarea value={form.detail} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} rows={3}
                            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all resize-none"
                            placeholder="Describe what happened" />
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Subject (optional)</label>
                        <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" className="h-8 text-sm" />
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Action Taken (optional)</label>
                        <textarea value={form.actionTaken} onChange={e => setForm(f => ({ ...f, actionTaken: e.target.value }))} rows={2}
                            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all resize-none"
                            placeholder="What action was taken" />
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Attachment (optional)</label>
                        <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleFileSelect} />
                        {!attachment && !uploading && (
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-all">
                                <Paperclip size={13} /> Attach file
                            </button>
                        )}
                        {uploading && (
                            <div className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-muted/30 text-xs text-muted-foreground w-fit">
                                <Loader2 size={13} className="animate-spin" /> Uploading...
                            </div>
                        )}
                        {attachment && !uploading && (
                            <div className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-muted/30 text-xs w-fit max-w-full">
                                {attachmentIcon(attachment.name, attachment.mimeType)}
                                <span className="truncate max-w-[220px]">{attachment.name}</span>
                                <button type="button" onClick={() => setAttachment(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                                    <X size={13} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-border/50 px-6 py-3.5 flex items-center justify-between bg-card shrink-0">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || !canSubmit}
                        className="min-w-[130px] h-8 px-5 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                    >
                        {loading ? 'Submitting...' : 'Submit Report'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
