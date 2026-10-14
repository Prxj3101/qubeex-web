'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, FlaskConical, Library, Loader2, Minus, Plus, Trash2, Trophy, Palette, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { classLabel, ttApi, errMsg, type ConfigRow, type CopyConfigsResult, type SessionType, type StudioData } from '@/lib/timetable';

const field = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm';

type Props = { open: boolean; onClose: () => void; studio: StudioData; yearId: string | null; onSaved: () => void };

/** Mounted only while open so the draft rows start from the saved requirements every time. */
export function RequirementsDialog(props: Props) {
    if (!props.open) return null;
    return <RequirementsForm {...props} />;
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
    return (
        <div>
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</div>
            <div className="inline-flex items-center rounded-lg border border-border bg-background">
                <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><Minus className="w-3.5 h-3.5" /></button>
                <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
                <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><Plus className="w-3.5 h-3.5" /></button>
            </div>
        </div>
    );
}

function RequirementsForm({ onClose, studio, yearId, onSaved }: Props) {
    const [rows, setRows] = useState<ConfigRow[]>(() => studio.configs.map(c => ({ ...c })));
    const [busy, setBusy] = useState(false);

    const types = studio.sessionTypes.filter(t => t.isActive);
    const typeById = useMemo(() => new Map(studio.sessionTypes.map(t => [t.id, t])), [studio.sessionTypes]);
    const subjectById = useMemo(() => new Map(studio.subjects.map(s => [s.id, s])), [studio.subjects]);
    const teacherName = useMemo(() => new Map(studio.teachers.map(t => [t.id, t.name])), [studio.teachers]);

    const upd = (i: number, patch: Partial<ConfigRow>) => setRows(r => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    const typeOfKind = (...kinds: string[]): SessionType | undefined => types.find(t => kinds.includes(t.kind));

    const newRow = (t: SessionType, over: Partial<ConfigRow> = {}): ConfigRow => ({
        subjectId: null, sessionTypeId: t.id, title: null, periodsPerWeek: 1, span: t.defaultSpan, maxPerDay: Math.max(1, t.defaultSpan),
        teacherId: null, roomId: null, roomType: t.roomType, ...over,
    });
    const addPreset = (kind: 'subject' | 'lab' | 'pe' | 'library' | 'activity' | 'custom') => {
        const map = {
            subject: { t: typeOfKind('THEORY'), title: null, per: 4 },
            lab: { t: typeOfKind('PRACTICAL', 'LAB'), title: null, per: 2 },
            pe: { t: typeOfKind('PE_SPORTS'), title: 'PT / Sports', per: 2 },
            library: { t: typeOfKind('LIBRARY'), title: 'Library', per: 1 },
            activity: { t: typeOfKind('ACTIVITY'), title: 'Activity', per: 1 },
            custom: { t: typeOfKind('CUSTOM', 'THEORY') ?? types[0], title: null, per: 1 },
        }[kind];
        if (!map.t) { toast.error('That session type is not available. Check Periods & days → Session types.'); return; }
        const needsSubject = kind === 'subject' || kind === 'lab';
        setRows(r => [...r, newRow(map.t!, { periodsPerWeek: map.per, title: needsSubject ? null : map.title })]);
    };
    const addAllSubjects = () => {
        const theory = typeOfKind('THEORY');
        if (!theory) return;
        const have = new Set(rows.filter(r => r.sessionTypeId === theory.id && r.subjectId).map(r => r.subjectId));
        const missing = studio.subjects.filter(s => !have.has(s.id));
        if (!missing.length) { toast.message('Every subject of this class is already listed.'); return; }
        setRows(r => [...r, ...missing.map(s => newRow(theory, { subjectId: s.id, periodsPerWeek: 4, maxPerDay: 1 }))]);
    };

    const total = rows.reduce((n, r) => n + (r.periodsPerWeek || 0), 0);
    const capacity = studio.slots.filter(s => s.kind === 'PERIOD').length * studio.workingDays.length;
    const pct = capacity ? Math.min(100, Math.round((total / capacity) * 100)) : 0;

    const warningsFor = (r: ConfigRow): { level: 'error' | 'warn'; text: string }[] => {
        const out: { level: 'error' | 'warn'; text: string }[] = [];
        const t = typeById.get(r.sessionTypeId);
        if (!r.subjectId && !r.title?.trim()) out.push({ level: 'error', text: 'Choose a subject or give it a title.' });
        if (r.span > r.periodsPerWeek) out.push({ level: 'error', text: '“In a row” can’t be more than periods per week.' });
        const defaultTeacher = r.subjectId ? subjectById.get(r.subjectId)?.defaultTeacherId : null;
        if (t?.requiresTeacher && !r.teacherId && !defaultTeacher) out.push({ level: 'warn', text: 'No teacher: assign one to this subject on the class page, or pick one here, or it can’t be scheduled.' });
        const rt = r.roomType ?? t?.roomType;
        if (rt && !r.roomId && !studio.rooms.some(x => x.isActive && x.type === rt)) out.push({ level: 'warn', text: `No active “${rt.toLowerCase()}” room exists yet. Add one under Rooms & teachers.` });
        else if (t?.requiresRoom && !r.roomId && !rt) out.push({ level: 'warn', text: 'This session needs a room. Pick one or set a room type.' });
        return out;
    };
    const blocking = rows.some(r => warningsFor(r).some(w => w.level === 'error')) || total > capacity;

    const save = async (applyToOthers: boolean) => {
        if (applyToOthers) {
            const names = studio.siblings.map(x => x.label).join(', ');
            if (!confirm(`Save, then apply these requirements to ${studio.siblings.length} other section(s): ${names}?\n\nMatching subjects there are updated and missing ones added. Nothing is deleted, and each section keeps its own teachers.`)) return;
        }
        setBusy(true);
        try {
            await ttApi.put(`/divisions/${studio.division.id}/configs`, yearId, {
                configs: rows.map(r => ({
                    id: r.id, subjectId: r.subjectId, sessionTypeId: r.sessionTypeId, title: r.subjectId ? null : r.title,
                    periodsPerWeek: r.periodsPerWeek, span: r.span, maxPerDay: r.maxPerDay,
                    teacherId: r.teacherId, roomId: r.roomId, roomType: r.roomType || null,
                })),
            });
            if (applyToOthers) {
                const res = await ttApi.post<CopyConfigsResult[]>(`/divisions/${studio.division.id}/configs/copy`, yearId, {});
                toast.success(`Saved and applied to ${res.length} other section${res.length === 1 ? '' : 's'}: ${res.map(r => r.divisionName).join(', ')}`);
            } else {
                toast.success('Weekly requirements saved');
            }
            onSaved();
            onClose();
        } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };

    const preset = (icon: React.ReactNode, label: string, kind: Parameters<typeof addPreset>[0]) => (
        <button type="button" onClick={() => addPreset(kind)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">{icon}{label}</button>
    );

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-4xl bg-card max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Weekly requirements — {classLabel(studio.division.standardName, studio.division.name)}</DialogTitle>
                    <p className="text-xs text-muted-foreground">How many periods each subject or activity needs every week. The generator fills the timetable from this.</p>
                </DialogHeader>

                {/* Capacity */}
                <div className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{total} of {capacity} periods used</span>
                        <span className={`text-xs ${total > capacity ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>{total > capacity ? `${total - capacity} too many` : `${capacity - total} free`}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${total > capacity ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{studio.workingDays.length} working days × {studio.slots.filter(s => s.kind === 'PERIOD').length} teaching periods a day. Free periods are normal.</p>
                </div>

                {/* Quick add */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-muted-foreground">Quick add:</span>
                    {preset(<BookOpen className="w-3.5 h-3.5" />, 'Subject', 'subject')}
                    {preset(<FlaskConical className="w-3.5 h-3.5" />, 'Lab / practical', 'lab')}
                    {preset(<Trophy className="w-3.5 h-3.5" />, 'PT / sports', 'pe')}
                    {preset(<Library className="w-3.5 h-3.5" />, 'Library', 'library')}
                    {preset(<Palette className="w-3.5 h-3.5" />, 'Activity', 'activity')}
                    {preset(<Plus className="w-3.5 h-3.5" />, 'Other', 'custom')}
                    <button type="button" onClick={addAllSubjects} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"><ListPlus className="w-3.5 h-3.5" /> Add all class subjects</button>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                    {rows.map((r, i) => {
                        const t = typeById.get(r.sessionTypeId);
                        const warns = warningsFor(r);
                        const color = (r.subjectId ? subjectById.get(r.subjectId)?.color : null) ?? t?.color ?? '#7C3AED';
                        const defaultTeacherId = r.subjectId ? subjectById.get(r.subjectId)?.defaultTeacherId : null;
                        return (
                            <div key={r.id ?? `n${i}`} className="rounded-xl border border-border/60 p-3 space-y-3" style={{ borderLeftWidth: 4, borderLeftColor: color }}>
                                <div className="flex items-start gap-2">
                                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                                        <label className="text-[11px] font-medium text-muted-foreground">Subject
                                            <select className={`${field} mt-1`} value={r.subjectId ?? ''} onChange={e => upd(i, { subjectId: e.target.value || null })}>
                                                <option value="">— none (use a title) —</option>
                                                {studio.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </label>
                                        {r.subjectId ? (
                                            <label className="text-[11px] font-medium text-muted-foreground">Session type
                                                <select className={`${field} mt-1`} value={r.sessionTypeId} onChange={e => { const nt = typeById.get(e.target.value); upd(i, { sessionTypeId: e.target.value, span: nt?.defaultSpan ?? r.span, roomType: nt?.roomType ?? null }); }}>
                                                    {studio.sessionTypes.filter(x => x.isActive || x.id === r.sessionTypeId).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                                                </select>
                                            </label>
                                        ) : (
                                            <label className="text-[11px] font-medium text-muted-foreground">Title
                                                <input className={`${field} mt-1`} placeholder="e.g. Library, Robotics club" value={r.title ?? ''} maxLength={80} onChange={e => upd(i, { title: e.target.value })} />
                                            </label>
                                        )}
                                        {!r.subjectId && (
                                            <label className="text-[11px] font-medium text-muted-foreground">Session type
                                                <select className={`${field} mt-1`} value={r.sessionTypeId} onChange={e => { const nt = typeById.get(e.target.value); upd(i, { sessionTypeId: e.target.value, span: nt?.defaultSpan ?? r.span, roomType: nt?.roomType ?? null }); }}>
                                                    {studio.sessionTypes.filter(x => x.isActive || x.id === r.sessionTypeId).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                                                </select>
                                            </label>
                                        )}
                                    </div>
                                    <button type="button" onClick={() => setRows(x => x.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-600" aria-label="Remove requirement"><Trash2 className="w-4 h-4" /></button>
                                </div>

                                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                                    <Stepper label="Periods per week" value={r.periodsPerWeek} min={1} max={60} onChange={v => upd(i, { periodsPerWeek: v, span: Math.min(r.span, v) })} />
                                    <Stepper label="In a row (1 = single)" value={r.span} min={1} max={Math.min(6, r.periodsPerWeek)} onChange={v => upd(i, { span: v, maxPerDay: Math.max(r.maxPerDay, v) })} />
                                    <Stepper label="Max per day" value={r.maxPerDay} min={1} max={10} onChange={v => upd(i, { maxPerDay: v })} />
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="text-[11px] font-medium text-muted-foreground">Teacher
                                        <select className={`${field} mt-1`} value={r.teacherId ?? ''} onChange={e => upd(i, { teacherId: e.target.value || null })}>
                                            <option value="">{r.subjectId ? (defaultTeacherId ? `Assigned teacher: ${teacherName.get(defaultTeacherId) ?? '—'}` : 'No teacher assigned yet') : '— none —'}</option>
                                            {studio.teachers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                                        </select>
                                    </label>
                                    <label className="text-[11px] font-medium text-muted-foreground">Room
                                        <select className={`${field} mt-1`} value={r.roomId ?? ''} onChange={e => upd(i, { roomId: e.target.value || null })}>
                                            <option value="">{r.roomType ?? t?.roomType ? `Any ${(r.roomType ?? t?.roomType)!.toLowerCase()} room` : 'No fixed room'}</option>
                                            {studio.rooms.filter(x => x.isActive).map(x => <option key={x.id} value={x.id}>{x.name} · {x.type.toLowerCase()}</option>)}
                                        </select>
                                    </label>
                                </div>

                                {warns.length > 0 && (
                                    <ul className="space-y-1">
                                        {warns.map((w, k) => (
                                            <li key={k} className={`flex items-start gap-1.5 text-xs ${w.level === 'error' ? 'text-red-600' : 'text-amber-600'}`}><AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />{w.text}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                    {!rows.length && (
                        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                            Nothing here yet. Tap <b>Add all class subjects</b> to start from this class&apos;s subjects, then set the periods per week.
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:justify-between">
                    <span className="self-center text-xs text-muted-foreground">{blocking ? 'Fix the red items to save.' : ''}</span>
                    <div className="flex flex-wrap justify-end gap-2">
                        {studio.siblings.length > 0 && (
                            <button type="button" disabled={busy || blocking || !rows.length} onClick={() => void save(true)} title={`Also apply to ${studio.siblings.map(x => x.label).join(', ')}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">
                                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save &amp; apply to {studio.siblings.length} other section{studio.siblings.length === 1 ? '' : 's'}
                            </button>
                        )}
                        <button type="button" disabled={busy || blocking} onClick={() => void save(false)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save requirements
                        </button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
