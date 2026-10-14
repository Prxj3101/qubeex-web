'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, ClipboardList, Loader2, Pencil, Plus } from 'lucide-react';
import api from '@/lib/api';

interface PTMNote {
    id: string;
    note: string;
    createdByName: string;
    createdAt: string;
    acknowledgedAt: string | null;
}

interface PTMNotesCardProps {
    divisionId: string;
    studentId: string;
}

// Parent-Teacher Meeting notes: a teacher jots a quick discussion point here
// during a PTM, and it shows up in the parent's "Parent Mode" screen on the
// student app (same login, toggled view) with an Acknowledge action.
export default function PTMNotesCard({ divisionId, studentId }: PTMNotesCardProps) {
    const [notes, setNotes] = useState<PTMNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/teacher/classes/${divisionId}/students/${studentId}/ptm-notes`);
            setNotes(res.data.data);
        } catch {
            // silent — card just stays empty
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [divisionId, studentId]);

    const openAdd = () => {
        setEditingNoteId(null);
        setText('');
        setOpen(true);
    };

    const openEdit = (note: PTMNote) => {
        setEditingNoteId(note.id);
        setText(note.note);
        setOpen(true);
    };

    const submit = async () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setSubmitting(true);
        try {
            if (editingNoteId) {
                await api.patch(`/teacher/classes/${divisionId}/students/${studentId}/ptm-notes/${editingNoteId}`, { note: trimmed });
                toast.success('Note updated');
            } else {
                await api.post(`/teacher/classes/${divisionId}/students/${studentId}/ptm-notes`, { note: trimmed });
                toast.success('Note added');
            }
            setText('');
            setEditingNoteId(null);
            setOpen(false);
            load();
        } catch (err) {
            const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(message || (editingNoteId ? 'Could not update note' : 'Could not add note'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden h-full" data-admin-surface="">
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50 bg-muted/20 flex-wrap gap-2 lg:px-5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <ClipboardList size={15} style={{ color: '#7C3AED' }} />
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PTM Notes</p>
                    </div>
                    <button
                        onClick={openAdd}
                        className="flex items-center gap-1.5 text-xs font-semibold leading-none px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all"
                    >
                        <Plus size={12} />
                        <span className="leading-none">Add Note</span>
                    </button>
                </div>
                <div className="p-4 lg:p-5">
                    {loading ? (
                        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
                    ) : notes.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-xs text-muted-foreground">No PTM notes yet — add one during a parent-teacher meeting.</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {notes.map((n) => (
                                <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-900/50">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-foreground">{n.note}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {n.createdByName} · {new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {n.acknowledgedAt ? (
                                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                <CheckCircle2 size={13} /> Seen
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground">Pending</span>
                                        )}
                                        <button
                                            onClick={() => openEdit(n)}
                                            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                            title="Edit note"
                                        >
                                            <Pencil size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingNoteId(null); }}>
                <DialogContent className="sm:max-w-md bg-card">
                    <DialogTitle>{editingNoteId ? 'Edit PTM Note' : 'Add PTM Note'}</DialogTitle>
                    <p className="text-xs text-muted-foreground -mt-2 mb-1">
                        This shows up in the parent&apos;s Parent Mode screen for them to acknowledge.
                    </p>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="e.g. Needs extra practice in Algebra this term"
                        rows={4}
                        maxLength={1000}
                        className="w-full rounded-lg border border-border/60 bg-background p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            onClick={() => { setOpen(false); setEditingNoteId(null); }}
                            disabled={submitting}
                            className="h-8 px-4 rounded-md border border-input bg-background text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-all disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submit}
                            disabled={submitting || !text.trim()}
                            className="min-w-[100px] h-8 px-5 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                        >
                            {submitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : editingNoteId ? 'Update Note' : 'Save Note'}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
