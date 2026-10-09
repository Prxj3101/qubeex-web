'use client';

import { useMemo, useState } from 'react';
import { Loader2, Lock, LockOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConflictList } from './ConflictList';
import {
    classLabel, DAY_NAMES, fmtTime, snapshotOf, ttApi, conflictsFromError, errMsg,
    type Conflict, type Entry, type StudioData, type UndoAction,
} from '@/lib/timetable';

const AUTO = '';
const NONE = '__none';

const field = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm';

type Props = {
    open: boolean; onClose: () => void; studio: StudioData; yearId: string | null;
    cell: { day: number; slotId: string } | null; entry?: Entry; writable: boolean; onChanged: (undo?: UndoAction) => void;
};

/** Mounted only while open, so every open starts from fresh state (no reset effects needed). */
export function SessionDialog(props: Props) {
    if (!props.open || !props.cell) return null;
    return <SessionForm key={`${props.cell.day}|${props.cell.slotId}|${props.entry?.id ?? 'new'}`} {...props} />;
}

function SessionForm({ onClose, studio, yearId, cell: cellOrNull, entry, writable, onChanged }: Props) {
    const cell = cellOrNull!;
    const types = studio.sessionTypes.filter(t => t.isActive || t.id === entry?.sessionTypeId);
    const [sessionTypeId, setSessionTypeId] = useState(entry?.sessionTypeId ?? (types.find(t => t.kind === 'THEORY') ?? types[0])?.id ?? '');
    const [subjectId, setSubjectId] = useState(entry?.subjectId ?? '');
    const [title, setTitle] = useState(entry?.title ?? '');
    const [teacherId, setTeacherId] = useState(entry ? (entry.teacherId ?? NONE) : AUTO);
    const [roomId, setRoomId] = useState(entry ? (entry.roomId ?? NONE) : AUTO);
    const [spanOverride, setSpanOverride] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [conflicts, setConflicts] = useState<Conflict[] | null>(null);

    const type = types.find(t => t.id === sessionTypeId);
    const slot = studio.slots.find(s => s.id === cell.slotId);
    const cfg = useMemo(
        () => studio.configs.find(c => c.sessionTypeId === sessionTypeId && (c.subjectId ?? '') === subjectId && (subjectId || (c.title ?? '') === title)),
        [studio.configs, sessionTypeId, subjectId, title]
    );
    // Same span the generator would use for this requirement; the admin can override it.
    const span = spanOverride ?? cfg?.span ?? type?.defaultSpan ?? 1;

    if (!slot) return null;
    const where = `${DAY_NAMES[cell.day]} · ${slot.name} (${fmtTime(slot.startMinute)} – ${fmtTime(slot.endMinute)})`;

    const resolveRef = (v: string): string | null | undefined => (v === AUTO ? undefined : v === NONE ? null : v);

    const run = async (fn: () => Promise<UndoAction | undefined>, okMsg: string) => {
        setBusy(true);
        try {
            const undo = await fn();
            toast.success(okMsg);
            setConflicts(null);
            onChanged(undo);
            onClose();
        } catch (e) {
            const c = conflictsFromError(e);
            if (c) setConflicts(c);
            else toast.error(errMsg(e));
        } finally { setBusy(false); }
    };

    const save = (force = false) => run(async () => {
        if (entry) {
            const before = {
                sessionTypeId: entry.sessionTypeId, subjectId: entry.subjectId, title: entry.title,
                teacherId: entry.teacherId, roomId: entry.roomId,
            };
            await ttApi.patch(`/entries/${entry.id}`, yearId, {
                sessionTypeId, subjectId: subjectId || null, title: title || null,
                teacherId: teacherId === AUTO ? undefined : resolveRef(teacherId), roomId: roomId === AUTO ? undefined : resolveRef(roomId), force,
            });
            return { label: 'edit', run: async () => { await ttApi.patch(`/entries/${entry.id}`, yearId, { ...before, force: true }); } };
        }
        const res = await ttApi.post<{ entries: { id: string }[] }>(`/divisions/${studio.division.id}/entries`, yearId, {
            dayOfWeek: cell.day, slotId: cell.slotId, sessionTypeId, subjectId: subjectId || null, title: title || null,
            teacherId: resolveRef(teacherId), roomId: resolveRef(roomId), configId: cfg?.id ?? null, span, force,
        });
        const ids = res.entries.map(x => x.id);
        return { label: 'add', run: async () => { await ttApi.post('/entries/bulk-delete', yearId, { ids }); } };
    }, entry ? 'Session updated' : 'Session added');

    const remove = () => run(async () => {
        const members = entry!.groupId ? studio.entries.filter(x => x.groupId === entry!.groupId) : [entry!];
        const snapshot = members.map(snapshotOf);
        await ttApi.del(`/entries/${entry!.id}`, yearId);
        return { label: 'remove', run: async () => { await ttApi.post(`/divisions/${studio.division.id}/restore`, yearId, { entries: snapshot }); } };
    }, 'Session removed');

    const toggleLock = () => run(async () => {
        const wasLocked = entry!.isLocked;
        await ttApi.post(`/entries/${entry!.id}/${wasLocked ? 'unlock' : 'lock'}`, yearId);
        return { label: 'lock', run: async () => { await ttApi.post(`/entries/${entry!.id}/${wasLocked ? 'lock' : 'unlock'}`, yearId); } };
    }, entry?.isLocked ? 'Unlocked' : 'Locked');

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-md bg-card">
                <DialogHeader>
                    <DialogTitle>{entry ? 'Edit session' : 'Add session'}</DialogTitle>
                    <p className="text-xs text-muted-foreground">{classLabel(studio.division.standardName, studio.division.name)} · {where}</p>
                </DialogHeader>

                <div className="space-y-3">
                    <label className="block text-xs font-medium text-muted-foreground">Session type
                        <select className={field} value={sessionTypeId} disabled={!writable} onChange={e => setSessionTypeId(e.target.value)}>
                            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-xs font-medium text-muted-foreground">Subject
                        <select className={field} value={subjectId} disabled={!writable} onChange={e => setSubjectId(e.target.value)}>
                            <option value="">— none —</option>
                            {studio.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </label>
                    {!subjectId && (
                        <label className="block text-xs font-medium text-muted-foreground">Title
                            <input className={field} value={title} disabled={!writable} maxLength={80} placeholder="e.g. Assembly, Robotics club" onChange={e => setTitle(e.target.value)} />
                        </label>
                    )}
                    {(type?.requiresTeacher ?? true) && (
                        <label className="block text-xs font-medium text-muted-foreground">Teacher
                            <select className={field} value={teacherId} disabled={!writable} onChange={e => setTeacherId(e.target.value)}>
                                {!entry && <option value={AUTO}>Default (assigned teacher)</option>}
                                <option value={NONE}>— none —</option>
                                {studio.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </label>
                    )}
                    <label className="block text-xs font-medium text-muted-foreground">Room
                        <select className={field} value={roomId} disabled={!writable} onChange={e => setRoomId(e.target.value)}>
                            {!entry && <option value={AUTO}>Default (from requirement)</option>}
                            <option value={NONE}>— none —</option>
                            {studio.rooms.filter(r => r.isActive).map(r => (
                                <option key={r.id} value={r.id}>{r.name} · {r.type.toLowerCase()}</option>
                            ))}
                        </select>
                        {type?.roomType && <span className="text-[10px] text-muted-foreground">This session type expects a {type.roomType.toLowerCase()} room.</span>}
                    </label>
                    {!entry && (
                        <label className="block text-xs font-medium text-muted-foreground">Consecutive periods
                            <input type="number" min={1} max={6} className={field} value={span} onChange={e => setSpanOverride(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} />
                        </label>
                    )}
                    {entry?.isLocked && <p className="text-xs text-amber-600 flex items-center gap-1"><Lock className="w-3 h-3" /> Locked: regeneration will not move this session.</p>}

                    {conflicts && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-2 space-y-2">
                            <p className="text-xs font-semibold text-red-600">This change creates conflicts:</p>
                            <ConflictList conflicts={conflicts} />
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:justify-between">
                    <div className="flex gap-2">
                        {entry && writable && (
                            <>
                                <button type="button" disabled={busy} onClick={remove} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
                                <button type="button" disabled={busy} onClick={toggleLock} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted">
                                    {entry.isLocked ? <><LockOpen className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
                                </button>
                            </>
                        )}
                    </div>
                    {writable && (
                        <div className="flex gap-2">
                            {conflicts && (
                                <button type="button" disabled={busy} onClick={() => save(true)} className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-500/10">Save anyway</button>
                            )}
                            <button type="button" disabled={busy || !sessionTypeId} onClick={() => save(false)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {entry ? 'Save' : 'Add'}
                            </button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
