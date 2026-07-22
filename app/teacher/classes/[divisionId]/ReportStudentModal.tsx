'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface ReportFormData {
    type: 'yellow' | 'red';
    category: string;
    title: string;
    detail: string;
    subject?: string;
    actionTaken?: string;
}

interface ReportStudentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentName: string;
    loading: boolean;
    onSubmit: (data: ReportFormData) => Promise<void>;
}

const EMPTY_FORM: ReportFormData = { type: 'yellow', category: '', title: '', detail: '', subject: '', actionTaken: '' };

export default function ReportStudentModal({ open, onOpenChange, studentName, loading, onSubmit }: ReportStudentModalProps) {
    const [form, setForm] = useState<ReportFormData>(EMPTY_FORM);

    const handleClose = (next: boolean) => {
        if (!next) setForm(EMPTY_FORM);
        onOpenChange(next);
    };

    const handleSubmit = async () => {
        if (!form.category.trim() || !form.title.trim() || !form.detail.trim()) return;
        await onSubmit({
            type: form.type,
            category: form.category.trim(),
            title: form.title.trim(),
            detail: form.detail.trim(),
            subject: form.subject?.trim() || undefined,
            actionTaken: form.actionTaken?.trim() || undefined,
        });
        setForm(EMPTY_FORM);
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
                        Log a misconduct card — this will appear in the student&apos;s Remarks section.
                    </p>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-3">
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setForm(f => ({ ...f, type: 'yellow' }))}
                            className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${form.type === 'yellow' ? 'bg-amber-100 dark:bg-amber-950 border-amber-400 text-amber-800 dark:text-amber-300' : 'border-border/50 text-muted-foreground hover:bg-muted/40'}`}>
                            <span style={{
                                width: 12, height: 16, borderRadius: 2,
                                backgroundColor: '#FCFF38',
                                transform: 'rotate(-5deg)',
                                boxShadow: '1px 2px 0px rgba(0,0,0,0.35)',
                                display: 'inline-block',
                            }} />
                            Yellow Card
                        </button>
                        <button type="button" onClick={() => setForm(f => ({ ...f, type: 'red' }))}
                            className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${form.type === 'red' ? 'bg-red-100 dark:bg-red-950 border-red-400 text-red-800 dark:text-red-300' : 'border-border/50 text-muted-foreground hover:bg-muted/40'}`}>
                            <span style={{
                                width: 12, height: 16, borderRadius: 2,
                                backgroundColor: '#DC2626',
                                transform: 'rotate(-5deg)',
                                boxShadow: '1px 2px 0px rgba(0,0,0,0.35)',
                                display: 'inline-block',
                            }} />
                            Red Card
                        </button>
                    </div>

                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Category</label>
                        <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Classroom Misconduct" className="h-8 text-sm" />
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
                        <label className="text-[11px] text-muted-foreground mb-1 font-medium block">Action Taken</label>
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
                        disabled={loading || !form.category.trim() || !form.title.trim() || !form.detail.trim()}
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
