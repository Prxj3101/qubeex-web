'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FormRow {
    id: string;
    kind: 'SLIP' | 'POLL';
    title: string;
    deadline: string | null;
    closed: boolean;
    createdByName: string;
    audience: number;
    answered: number;
}

interface Results {
    id: string;
    kind: 'SLIP' | 'POLL';
    title: string;
    description: string | null;
    options: string[];
    deadline: string | null;
    closed: boolean;
    counts: { label: string; count: number }[];
    total: number;
    answered: number;
    students: { studentId: string; name: string; rollNo: string | null; className: string | null; optionIndex: number | null; comment: string | null; changes: number }[];
}

interface Target { id: string; label: string }

const fmt = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Permission slips & polls. `apiBase` is `/teacher/parent-forms` or `/admin/parent-forms`. */
export function FormsManager({ apiBase, canSendSchoolWide }: { apiBase: string; canSendSchoolWide: boolean }) {
    const [forms, setForms] = useState<FormRow[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [results, setResults] = useState<Results | null>(null);
    const [creating, setCreating] = useState(false);

    const loadList = useCallback(async () => {
        try {
            const res = await api.get<{ data: FormRow[] }>(apiBase);
            setForms(res.data.data);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not load forms')); }
    }, [apiBase]);

    const loadResults = useCallback(async (id: string) => {
        try {
            const res = await api.get<{ data: Results }>(`${apiBase}/${id}`);
            setResults(res.data.data);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not load results')); }
    }, [apiBase]);

    useEffect(() => {
        loadList();
        const id = setInterval(loadList, 30_000);
        return () => clearInterval(id);
    }, [loadList]);

    useEffect(() => {
        if (!activeId) { setResults(null); return; }
        loadResults(activeId);
        const id = setInterval(() => loadResults(activeId), 30_000);
        return () => clearInterval(id);
    }, [activeId, loadResults]);

    const close = async () => {
        if (!activeId || !window.confirm('Close this form? Parents will no longer be able to answer.')) return;
        try {
            await api.patch(`${apiBase}/${activeId}/close`);
            await Promise.all([loadList(), loadResults(activeId)]);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not close the form')); }
    };

    const remind = async () => {
        if (!activeId) return;
        try {
            const res = await api.post<{ data: { reminded: number } }>(`${apiBase}/${activeId}/remind`);
            toast.success(`Reminder sent to ${res.data.data.reminded} parent${res.data.data.reminded === 1 ? '' : 's'}`);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not send the reminder')); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3">
            <div className="rounded-2xl border border-border bg-card overflow-y-auto max-h-[70vh]" data-dashboard-surface="">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold">Forms &amp; polls</p>
                    <Button size="sm" className="gap-1" onClick={() => { setCreating(true); setActiveId(null); }}><Plus size={14} /> New</Button>
                </div>
                {forms.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No forms sent yet.</p>
                ) : forms.map(f => (
                    <button
                        key={f.id}
                        onClick={() => { setActiveId(f.id); setCreating(false); }}
                        className={cn('w-full text-left px-4 py-3 border-b border-border/60 hover:bg-muted/50', f.id === activeId && 'bg-muted/60')}
                    >
                        <p className="text-[11px] font-semibold text-primary">{f.kind === 'SLIP' ? 'Permission slip' : 'Poll'}{f.closed ? ' · Closed' : ''}</p>
                        <p className="text-sm font-medium truncate">{f.title}</p>
                        <p className="text-xs text-muted-foreground">{f.answered} of {f.audience} answered · {f.createdByName}</p>
                    </button>
                ))}
            </div>

            <div className="rounded-2xl border border-border bg-card max-h-[70vh] overflow-y-auto" data-dashboard-surface="">
                {creating ? (
                    <NewForm apiBase={apiBase} canSendSchoolWide={canSendSchoolWide} onDone={() => { setCreating(false); loadList(); }} />
                ) : !results ? (
                    <div className="p-6 text-sm text-muted-foreground text-center">Select a form to see responses, or create a new one.</div>
                ) : (
                    <div className="p-4 flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-base font-semibold">{results.title}</h2>
                                {results.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{results.description}</p>}
                                <p className="text-xs text-muted-foreground mt-1">
                                    {results.answered} of {results.total} answered{results.deadline ? ` · reply by ${fmt(results.deadline)}` : ''}{results.closed ? ' · Closed' : ''}
                                </p>
                            </div>
                            {!results.closed && (
                                <div className="flex gap-2 shrink-0">
                                    {results.total - results.answered > 0 && (
                                        <Button size="sm" variant="outline" onClick={remind}>Remind {results.total - results.answered}</Button>
                                    )}
                                    <Button size="sm" variant="outline" onClick={close}>Close form</Button>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            {results.counts.map(c => (
                                <div key={c.label}>
                                    <div className="flex justify-between text-sm"><span>{c.label}</span><span className="font-semibold">{c.count}</span></div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full bg-primary" style={{ width: `${results.total ? (c.count / results.total) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Student</th><th>Class</th><th>Answer</th><th>Note</th></tr></thead>
                            <tbody>
                                {results.students.map(s => (
                                    <tr key={s.studentId} className="border-t border-border/60">
                                        <td className="py-1.5">{s.name}{s.rollNo ? <span className="text-muted-foreground"> · {s.rollNo}</span> : null}</td>
                                        <td className="text-muted-foreground">{s.className ?? '—'}</td>
                                        <td className={s.optionIndex === null ? 'text-red-600' : 'font-medium'}>
                                            {s.optionIndex === null ? 'No reply' : results.options[s.optionIndex]}
                                            {s.changes > 0 && <span className="text-[10px] text-muted-foreground font-normal"> (changed {s.changes}×)</span>}
                                        </td>
                                        <td className="text-muted-foreground">{s.comment ?? ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function NewForm({ apiBase, canSendSchoolWide, onDone }: { apiBase: string; canSendSchoolWide: boolean; onDone: () => void }) {
    const [kind, setKind] = useState<'SLIP' | 'POLL'>('SLIP');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [allowComment, setAllowComment] = useState(true);
    const [deadline, setDeadline] = useState('');
    const [targets, setTargets] = useState<Target[]>([]);
    const [picked, setPicked] = useState<string[]>([]);
    const [schoolWide, setSchoolWide] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get<{ data: Target[] }>(`${apiBase}/targets`)
            .then(r => { setTargets(r.data.data); if (!canSendSchoolWide) setPicked(r.data.data.map(d => d.id)); })
            .catch(() => setTargets([]));
    }, [apiBase, canSendSchoolWide]);

    const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
    const nothingSelected = !schoolWide && picked.length === 0;

    const submit = async () => {
        if (!title.trim() || saving || nothingSelected) return;
        setSaving(true);
        try {
            await api.post(apiBase, {
                kind,
                title: title.trim(),
                description: description.trim() || undefined,
                options: kind === 'POLL' ? options.map(o => o.trim()).filter(Boolean) : undefined,
                allowComment,
                deadline: deadline ? new Date(deadline).toISOString() : undefined,
                allDivisions: schoolWide || undefined,
                divisionIds: schoolWide ? undefined : picked,
            });
            toast.success('Sent to parents');
            onDone();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not send the form')); }
        finally { setSaving(false); }
    };

    const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

    return (
        <div className="p-4 flex flex-col gap-3 max-w-xl">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">New form</h2>
                <button onClick={onDone} aria-label="Close"><X size={16} /></button>
            </div>
            {!canSendSchoolWide && targets.length === 0 && (
                <p className="text-sm text-red-600">Only a class teacher can send forms to parents.</p>
            )}
            <div className="flex gap-2">
                {(['SLIP', 'POLL'] as const).map(k => (
                    <button key={k} onClick={() => setKind(k)} className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', kind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>
                        {k === 'SLIP' ? 'Permission slip' : 'Poll'}
                    </button>
                ))}
            </div>
            <input className={field} value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={kind === 'SLIP' ? 'e.g. Museum trip on Friday' : 'e.g. Pick a date for the picnic'} />
            <textarea className={field} rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} placeholder="Details (optional)" />
            {kind === 'SLIP' ? (
                <p className="text-xs text-muted-foreground">Parents answer Yes or No.</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {options.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <input className={field} value={o} onChange={e => setOptions(prev => prev.map((x, j) => (j === i ? e.target.value : x)))} maxLength={80} placeholder={`Option ${i + 1}`} />
                            {options.length > 2 && <button onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))} aria-label="Remove option"><X size={14} /></button>}
                        </div>
                    ))}
                    {options.length < 6 && <button className="text-left text-sm font-medium text-primary" onClick={() => setOptions(prev => [...prev, ''])}>+ Add option</button>}
                </div>
            )}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowComment} onChange={e => setAllowComment(e.target.checked)} /> Let parents add a note</label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Reply by (optional)
                <input type="datetime-local" className={cn(field, 'w-auto')} value={deadline} onChange={e => setDeadline(e.target.value)} />
            </label>
            <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Send to</p>
                {canSendSchoolWide && (
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={schoolWide} onChange={e => setSchoolWide(e.target.checked)} /> Whole school</label>
                )}
                {!schoolWide && (
                    <div className="flex flex-wrap gap-2">
                        {targets.map(d => (
                            <button key={d.id} onClick={() => toggle(d.id)} className={cn('rounded-full border px-3 py-1 text-xs font-medium', picked.includes(d.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>
                                {d.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <Button onClick={submit} disabled={!title.trim() || saving || nothingSelected}>Send to parents</Button>
        </div>
    );
}
