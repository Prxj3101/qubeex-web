'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Paperclip, X, FileText, FileSpreadsheet, FileType, ChevronDown } from 'lucide-react';
import api from '@/lib/api';
import { validateAttachment, ATTACHMENT_ACCEPT } from '@/lib/attachmentValidation';
import { FlagItem } from '@/lib/flags';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
export type CardType = 'YELLOW' | 'RED';

const CATEGORY_OPTIONS = [
    'Attendance',
    'Discipline',
    'Poor Performance',
    'Assignment Not Submitted',
    'Misconduct',
    'Other',
];

// Which card section this report lands in — the reporter picks this
// directly now, it's no longer inferred from a severity level. Same hand-
// holding-card artwork as the Flags & Warnings board (FlagsBoard.tsx), just
// without that board's hover/active float-bounce animation — static here.
const CARD_TYPE_CFG: Record<CardType, { label: string; sub: string; activeClass: string; img: string }> = {
    YELLOW: { label: 'Yellow Card', sub: 'Minor / cautionary', activeClass: 'bg-amber-100 dark:bg-amber-950 border-amber-400 text-amber-800 dark:text-amber-300', img: '/images/Yellowcard.png' },
    RED: { label: 'Red Card', sub: 'Serious / escalated', activeClass: 'bg-red-100 dark:bg-red-950 border-red-400 text-red-800 dark:text-red-300', img: '/images/Redcard.png' },
};

export interface ReportAttachment { url: string; name: string; type: string; }

export interface ReportFormData {
    type: CardType;
    severity: Severity;
    category: string;
    title: string;
    detail: string;
    subject?: string;
    actionTaken?: string;
    attachments?: ReportAttachment[];
}

interface ReportStudentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentName: string;
    loading: boolean;
    onSubmit: (data: ReportFormData) => Promise<void>;
    /** e.g. '/teacher/campus/feed/upload' or '/admin/campus/feed/upload' — reused R2 attachment upload endpoint. */
    uploadUrl: string;
    /** When set, the modal opens pre-filled with this card's data and submits as an edit instead of a new report. */
    editingFlag?: FlagItem | null;
}

interface FormState {
    type: CardType;
    severity: Severity;
    category: string;
    customCategory: string;
    title: string;
    detail: string;
    subject: string;
    actionTaken: string;
}

const EMPTY_FORM: FormState = {
    type: 'YELLOW', severity: 'MEDIUM', category: 'Discipline', customCategory: '', title: '', detail: '', subject: '', actionTaken: '',
};

// Themed dropdown (matches the app's other custom selects, e.g. AddStudentModal's)
// — replaces the native browser <select> which doesn't pick up the app's theme.
function Dropdown({ value, options, placeholder, onChange }: {
    value: string;
    options: string[];
    placeholder: string;
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen(v => !v)}
                className="w-full h-8 px-3 rounded-md border border-input bg-background text-sm text-left flex items-center justify-between hover:bg-muted transition-all">
                <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
                    {value || placeholder}
                </span>
                <ChevronDown size={13} className="text-muted-foreground" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute top-9 left-0 z-50 w-full bg-card border border-border rounded-xl shadow-xl py-1 max-h-40 overflow-y-auto">
                        {options.map(o => (
                            <button key={o} type="button"
                                onClick={() => { onChange(o); setOpen(false); }}
                                className={`w-full px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors ${value === o ? 'text-primary font-semibold' : 'text-foreground'}`}>
                                {o}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function attachmentIcon(name: string, mimeType: string) {
    if (mimeType.startsWith('image/')) return null;
    if (name.endsWith('.pdf') || mimeType === 'application/pdf') return <FileText size={13} className="text-red-500" />;
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) return <FileSpreadsheet size={13} className="text-emerald-600" />;
    if (name.endsWith('.docx') || name.endsWith('.doc')) return <FileType size={13} className="text-blue-500" />;
    return <Paperclip size={13} className="text-muted-foreground" />;
}

export default function ReportStudentModal({ open, onOpenChange, studentName, loading, onSubmit, uploadUrl, editingFlag }: ReportStudentModalProps) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    // Multiple attachments — images, files, or videos — instead of just one.
    const [attachments, setAttachments] = useState<{ url: string; name: string; type: string; mimeType: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isEdit = !!editingFlag;

    const reset = () => {
        setForm(EMPTY_FORM);
        setAttachments([]);
    };

    // Pre-fill the form from the card being edited whenever the modal opens
    // in edit mode; reset back to blank when opening fresh for a new report.
    useEffect(() => {
        if (!open) return;
        if (editingFlag) {
            const knownCategory = CATEGORY_OPTIONS.includes(editingFlag.category);
            setForm({
                type: editingFlag.type.toUpperCase() as CardType,
                severity: editingFlag.severity.toUpperCase() as Severity,
                category: knownCategory ? editingFlag.category : 'Other',
                customCategory: knownCategory ? '' : editingFlag.category,
                title: editingFlag.title,
                detail: editingFlag.detail,
                subject: editingFlag.subject ?? '',
                actionTaken: editingFlag.actionTaken ?? '',
            });
            setAttachments(editingFlag.attachments.map(a => ({ url: a.url, name: a.name, type: a.type, mimeType: a.type })));
        } else {
            reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingFlag]);

    const handleClose = (next: boolean) => {
        if (!next) reset();
        onOpenChange(next);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (files.length === 0) return;

        const valid: File[] = [];
        for (const file of files) {
            const err = validateAttachment(file);
            if (err) { toast.error(`${file.name}: ${err}`); continue; }
            valid.push(file);
        }
        if (valid.length === 0) return;

        setUploading(true);
        try {
            // Upload one at a time — the shared attachment endpoint takes a single
            // file per request, and sequential keeps error reporting per-file clear.
            for (const file of valid) {
                try {
                    const body = new FormData();
                    body.append('file', file);
                    const res = await api.post(uploadUrl, body, { headers: { 'Content-Type': 'multipart/form-data' } });
                    setAttachments(prev => [...prev, res.data.data]);
                } catch (err: unknown) {
                    const e = err as { response?: { data?: { error?: string; message?: string } } };
                    toast.error(`${file.name}: ${e?.response?.data?.error ?? e?.response?.data?.message ?? 'Upload failed'}`);
                }
            }
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

    const resolvedCategory = form.category === 'Other' ? form.customCategory.trim() : form.category;
    const canSubmit = !!resolvedCategory && !!form.title.trim() && !!form.detail.trim() && !uploading;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        await onSubmit({
            type: form.type,
            severity: form.severity,
            category: resolvedCategory,
            title: form.title.trim(),
            detail: form.detail.trim(),
            subject: form.subject.trim() || undefined,
            actionTaken: form.actionTaken.trim() || undefined,
            attachments: attachments.length > 0
                ? attachments.map(a => ({ url: a.url, name: a.name, type: a.mimeType }))
                : undefined,
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
                    <DialogTitle className="text-base font-semibold">{isEdit ? `Edit Report — ${studentName}` : `Report ${studentName}`}</DialogTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isEdit
                            ? 'Update the details of this report card.'
                            : `This report will be sent to ${studentName.split(' ')[0]}'s class teacher for review.`}
                    </p>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-3">
                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Card <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                            {(Object.keys(CARD_TYPE_CFG) as CardType[]).map(ct => (
                                <button key={ct} type="button" onClick={() => setForm(f => ({ ...f, type: ct }))}
                                    className={`flex-1 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-0.5 py-2 ${form.type === ct ? CARD_TYPE_CFG[ct].activeClass : 'border-border/50 text-muted-foreground hover:bg-muted/40'}`}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={CARD_TYPE_CFG[ct].img} alt={CARD_TYPE_CFG[ct].label} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                                    <span>{CARD_TYPE_CFG[ct].label}</span>
                                    <span className="text-[10px] font-normal opacity-70">{CARD_TYPE_CFG[ct].sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Category <span className="text-red-500">*</span></label>
                        <Dropdown value={form.category} options={CATEGORY_OPTIONS} placeholder="Select" onChange={v => setForm(f => ({ ...f, category: v }))} />
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
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Card Title <span className="text-red-500">*</span></label>
                        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Short title" className="h-8 text-sm" />
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Incident Details <span className="text-red-500">*</span></label>
                        <textarea value={form.detail} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} rows={3}
                            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all resize-none"
                            placeholder="Describe what happened" />
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Attachments (optional)</label>
                        <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} multiple className="hidden" onChange={handleFileSelect} />

                        {attachments.length > 0 && (
                            <div className="flex flex-col gap-1.5 mb-2">
                                {attachments.map((a, i) => (
                                    <div key={i} className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-muted/30 text-xs w-fit max-w-full">
                                        {attachmentIcon(a.name, a.mimeType)}
                                        <span className="truncate max-w-[220px]">{a.name}</span>
                                        <button type="button" onClick={() => removeAttachment(i)} className="shrink-0 text-muted-foreground hover:text-foreground">
                                            <X size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {uploading && (
                            <div className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-muted/30 text-xs text-muted-foreground w-fit">
                                <Loader2 size={13} className="animate-spin" /> Uploading...
                            </div>
                        )}

                        {!uploading && (
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-all">
                                <Paperclip size={13} /> {attachments.length > 0 ? 'Attach another file' : 'Attach file'}
                            </button>
                        )}
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
                        {loading ? (isEdit ? 'Saving...' : 'Submitting...') : (isEdit ? 'Save Changes' : 'Submit Report')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
