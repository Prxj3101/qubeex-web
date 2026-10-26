'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserCheck, Copy, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { EmptyState, PrimaryButton, SecondaryButton, ThemedSelect, Pill } from '@/app/admin/payroll/_components/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { kidImage, scrollStyle } from './admissions.types';

const sectionName = (standard: string, section: string) => (section.toLowerCase().startsWith(standard.toLowerCase()) ? section : `${standard} ${section}`);

interface Child { id: string; revision: number; childName: string; admissionNo: string | null; divisionId: string | null; docsPending: string[]; gender?: string | null; parentName?: string }
interface Group { standardId: string; standardName: string; sections: { id: string; name: string; students: number }[]; children: Child[] }
interface Result { id: string; ok: boolean; childName?: string; studentId?: string; tempPassword?: string; section?: string; error?: string }

/**
 * Admitted children of the current session who are not in a class yet.
 * Pick a section for each (or tick several and set one section for all), then
 * add them in one go. Each one becomes a student with a QubeEx login.
 */
export default function PlacementPanel({ onOpen }: { onOpen: (id: string) => void }) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [session, setSession] = useState<{ id: string; label: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [choice, setChoice] = useState<Record<string, string>>({});
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [results, setResults] = useState<Result[] | null>(null);

    const load = useCallback((signal?: AbortSignal) => api.get('/admin/admissions/placement', { signal }).then(res => {
        if (signal?.aborted) return;
        const list = res.data.data.groups as Group[];
        setGroups(list);
        setSession(res.data.data.session);
        setChoice(Object.fromEntries(list.flatMap(g => g.children.filter(c => c.divisionId).map(c => [c.id, c.divisionId as string]))));
        setPicked(new Set());
        setError('');
    }).catch(err => { if (!signal?.aborted) setError(getErrorMessage(err, 'Could not load admitted children')); })
        .finally(() => { if (!signal?.aborted) setLoading(false); }), []);
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

    // Only ticked children with a section are added. Picking a section ticks the child.
    const ready = useMemo(() => groups.flatMap(g => g.children).filter(c => picked.has(c.id) && choice[c.id]), [groups, choice, picked]);
    const tickedNoSection = useMemo(() => groups.flatMap(g => g.children).filter(c => picked.has(c.id) && !choice[c.id]).length, [groups, choice, picked]);
    const total = groups.reduce((n, g) => n + g.children.length, 0);

    const setForPicked = (group: Group, divisionId: string) => {
        setChoice(prev => {
            const next = { ...prev };
            group.children.filter(c => picked.has(c.id)).forEach(c => { next[c.id] = divisionId; });
            return next;
        });
    };

    const place = async () => {
        if (!ready.length || saving) return;
        setSaving(true);
        try {
            const res = await api.post('/admin/admissions/placement', { items: ready.map(c => ({ id: c.id, divisionId: choice[c.id] })) });
            const list: Result[] = res.data.data;
            const ok = list.filter(r => r.ok).length;
            if (ok) toast.success(`${ok} ${ok === 1 ? 'child' : 'children'} added to class`);
            if (ok < list.length) toast.error(`${list.length - ok} could not be added. See the list.`);
            setResults(list);
            await load();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not add to class')); }
        finally { setSaving(false); }
    };

    const loginText = (list: Result[]) => list.filter(r => r.ok).map(r => `${r.childName} (${r.section}): Student ID ${r.studentId}, password ${r.tempPassword}`).join('\n');

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-3 pb-3">
            <div className="shrink-0 px-1">
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div>
                    <h1 className="text-xl font-bold">Place in class</h1>
                    <p className="text-muted-foreground text-[13px]">Admitted children of {session?.label ? `session ${session.label}` : 'this session'} who still need a section. Tick them, pick a section, then add. Each gets a QubeEx login.</p>
                    {tickedNoSection > 0 && <p className="text-[12px] font-medium text-amber-600 dark:text-amber-400">{tickedNoSection} ticked {tickedNoSection === 1 ? 'child needs' : 'children need'} a section.</p>}
                </div>
                <PrimaryButton type="button" disabled={!ready.length || saving} onClick={() => void place()} className="h-9 rounded-full">
                    <UserCheck size={14} />{saving ? 'Adding...' : ready.length ? `Add ${ready.length} to class` : 'Add to class'}
                </PrimaryButton>
            </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {error ? <EmptyState icon={UserCheck} title="Could not load" text={error}><SecondaryButton onClick={() => void load()}>Retry</SecondaryButton></EmptyState>
                : loading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
                : total === 0 ? <EmptyState icon={UserCheck} title="Everyone is placed" text="Children admitted for this session show up here until you add them to a section. Children admitted for next session show up once it starts." />
                : (
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1" style={scrollStyle}>
                        {groups.map(g => {
                            const pickedHere = g.children.filter(c => picked.has(c.id)).length;
                            const allPicked = pickedHere === g.children.length;
                            const options = g.sections.map(s => ({ value: s.id, label: sectionName(g.standardName, s.name) }));
                            return (
                                <section key={g.standardId} data-admin-surface="" className="rounded-2xl border border-border/60 bg-card p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users size={18} /></span>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-base font-bold">{g.standardName}</h2>
                                                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">{g.children.length} waiting</span>
                                                </div>
                                                <div className="mt-1 flex flex-wrap gap-1.5">
                                                    {g.sections.length ? g.sections.map(s => (
                                                        <span key={s.id} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">{sectionName(g.standardName, s.name)}</span> {s.students} students</span>
                                                    )) : <span className="text-[11px] text-muted-foreground">No sections yet. Add one in Campus.</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer">
                                                <input type="checkbox" checked={allPicked} onChange={e => setPicked(prev => { const n = new Set(prev); g.children.forEach(c => (e.target.checked ? n.add(c.id) : n.delete(c.id))); return n; })} className="w-4 h-4 accent-[#DA7756]" />
                                                Tick all
                                            </label>
                                            {pickedHere > 0 && (
                                                <>
                                                    <span className="text-muted-foreground">| Put {pickedHere} in</span>
                                                    <div className="w-36"><ThemedSelect value="" onChange={v => setForPicked(g, v)} placeholder="Pick section" options={options} /></div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
                                        {g.children.map(c => {
                                            const on = picked.has(c.id);
                                            return (
                                                <div key={c.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${on ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/40 dark:bg-white/[0.04]'}`}>
                                                    <input type="checkbox" aria-label={`Tick ${c.childName}`} checked={on} onChange={e => setPicked(prev => { const n = new Set(prev); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} className="w-4 h-4 shrink-0 accent-[#DA7756]" />
                                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_1px_6px_rgba(15,23,42,0.12)]">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={kidImage(c.gender)} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
                                                    </span>
                                                    <button type="button" onClick={() => onOpen(c.id)} className="flex-1 min-w-0 text-left">
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="truncate text-sm font-semibold hover:underline">{c.childName}</span>
                                                            {c.docsPending.length > 0 && <Pill tone="red">Provisional</Pill>}
                                                        </span>
                                                        <span className="block truncate text-[11px] text-muted-foreground">
                                                            <span className="font-mono">{c.admissionNo ?? '-'}</span>{c.parentName ? ` | Parent: ${c.parentName}` : ''}
                                                        </span>
                                                    </button>
                                                    <div className="w-36 shrink-0"><ThemedSelect value={choice[c.id] ?? ''} onChange={v => { setChoice(prev => ({ ...prev, [c.id]: v })); setPicked(prev => new Set(prev).add(c.id)); }} placeholder="Pick section" options={options} /></div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}

            <Dialog open={!!results} onOpenChange={open => { if (!open) setResults(null); }}>
                <DialogContent className="sm:max-w-lg bg-card max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader><DialogTitle>Added to class</DialogTitle><DialogDescription>Logins were emailed to parents who gave an email. Keep this list to hand out the rest.</DialogDescription></DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/40" style={scrollStyle}>
                        {results?.map(r => (
                            <div key={r.id} className="py-2 text-[13px]">
                                {r.ok ? <><span className="font-semibold">{r.childName}</span> <span className="text-muted-foreground">({r.section})</span><span className="block font-mono text-xs">ID {r.studentId} | Password {r.tempPassword}</span></>
                                    : <span className="text-red-600 dark:text-red-400">{r.error}</span>}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2 border-t border-border/50 pt-3">
                        <SecondaryButton type="button" onClick={() => { void navigator.clipboard.writeText(loginText(results ?? [])).then(() => toast.success('Logins copied')); }}><Copy size={13} />Copy all</SecondaryButton>
                        <PrimaryButton type="button" onClick={() => setResults(null)}>Done</PrimaryButton>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
