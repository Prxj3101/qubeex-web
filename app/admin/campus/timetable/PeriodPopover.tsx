'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Pin, PinOff, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { conflictsFromError, type Conflict } from '@/lib/timetable';
import { ThemedSelect } from '@/app/admin/payroll/_components/ui';
import { DAY_SHORT, entryColor, entryName, hhmm, type Workspace } from './ttai';
import type { CanvasMode, CellHit } from './TimetableCanvas';

// The small card that opens when a period is clicked: change the subject or
// teacher, keep it fixed when building again, remove it, or add one to an
// empty period. Clashes are shown with a "Do it anyway" choice.

const W = 300;
const NO_TEACHER = '__none__';

export function PeriodPopover({ ws, hit, mode, divisionId, editable, params, onClose, onChanged, onOpenClass }: {
    ws: Workspace;
    hit: CellHit;
    mode: CanvasMode;
    divisionId: string | null;
    editable: boolean;
    params: Record<string, string>;
    onClose: () => void;
    onChanged: () => void;
    onOpenClass: (divisionId: string) => void;
}) {
    const box = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: 0, top: 0 });
    const [busy, setBusy] = useState(false);
    const [clash, setClash] = useState<{ conflicts: Conflict[]; retry: () => Promise<void> } | null>(null);
    const [sure, setSure] = useState(false);
    const e = hit.entry;
    const slot = ws.slots.find(s => s.id === hit.slotId);
    const divId = e?.divisionId ?? divisionId;
    const section = ws.standards.flatMap(s => s.divisions).find(d => d.id === divId);
    const configs = ws.configs.filter(c => c.divisionId === divId);
    const canEdit = editable && mode === 'class';

    useLayoutEffect(() => {
        const h = box.current?.offsetHeight ?? 260;
        const left = Math.max(8, Math.min(hit.rect.left, window.innerWidth - W - 8));
        const below = hit.rect.bottom + 6;
        const top = below + h > window.innerHeight - 8 ? Math.max(8, hit.rect.top - h - 6) : below;
        setPos({ left, top });
    }, [hit, clash, sure]);

    useEffect(() => {
        // Dropdown lists open in a portal outside this card: clicks there must not close it.
        const down = (ev: MouseEvent) => {
            const t = ev.target as HTMLElement;
            if (t.closest?.('[data-radix-popper-content-wrapper], [role="listbox"]')) return;
            if (box.current && !box.current.contains(t)) onClose();
        };
        const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !document.querySelector('[role="listbox"]')) onClose(); };
        const t = window.setTimeout(() => document.addEventListener('mousedown', down), 0);
        document.addEventListener('keydown', key);
        return () => { window.clearTimeout(t); document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
    }, [onClose]);

    /** Runs a change; on a clash shows it and offers to force. */
    const run = async (fn: (force: boolean) => Promise<unknown>, ok: string) => {
        setBusy(true);
        try {
            await fn(false);
            toast.success(ok);
            onChanged();
            onClose();
        } catch (err) {
            const c = conflictsFromError(err);
            if (c) setClash({ conflicts: c, retry: async () => { setBusy(true); try { await fn(true); toast.success(ok); onChanged(); onClose(); } catch (x) { toast.error(getErrorMessage(x, 'Could not save')); } finally { setBusy(false); } } });
            else toast.error(getErrorMessage(err, 'Could not save'));
        } finally { setBusy(false); }
    };

    type Cfg = (typeof configs)[number];
    const roomType = (roomId: string | null) => (roomId ? ws.rooms.find(r => r.id === roomId)?.type ?? null : null);
    const labRoomOf = (type: string) => ws.rooms.find(r => r.isActive && r.type === type)?.id ?? null;
    const optionOf = (c: Cfg) => {
        const name = c.subjectId ? ws.subjects.find(s => s.id === c.subjectId)?.name ?? 'Subject' : c.title ?? 'Activity';
        return { value: c.id, label: `${name}${c.subjectId && c.roomType ? ' (lab)' : ''}${c.span > 1 ? ' (double)' : ''}` };
    };
    /** A subject can have a class-room part and a lab part: a period belongs to the lab part when it is in that kind of room. */
    const belongs = (x: { subjectId: string | null; title: string | null; roomId: string | null; configId?: string | null }, c: Cfg) => {
        const same = (o: Cfg) => (o.subjectId ? x.subjectId === o.subjectId : !x.subjectId && x.title === o.title);
        if (!same(c)) return false;
        // The saved link to a requirement counts only while it still matches the subject (changing the subject keeps the old link).
        const linked = x.configId ? configs.find(o => o.id === x.configId) : undefined;
        if (linked && same(linked)) return linked.id === c.id;
        if (!c.subjectId) return true;
        const lab = configs.find(o => o.subjectId === c.subjectId && o.roomType);
        return c.roomType ? roomType(x.roomId) === c.roomType : !lab || roomType(x.roomId) !== lab.roomType;
    };
    const placed = (configId: string) => {
        const c = configs.find(x => x.id === configId);
        return c ? ws.entries.filter(x => x.divisionId === divId && belongs(x, c)).length : 0;
    };
    const currentConfig = e ? configs.find(c => belongs(e, c)) : undefined;

    const changeTo = (configId: string) => {
        const c = configs.find(x => x.id === configId);
        if (!c || !e) return;
        void run(force => api.patch(`/admin/timetable/entries/${e.id}`, { sessionTypeId: c.sessionTypeId, subjectId: c.subjectId, title: c.subjectId ? null : c.title, teacherId: c.teacherId, roomId: c.roomType ? labRoomOf(c.roomType) : null, force }, { params }), 'Period changed');
    };
    const add = (configId: string) => {
        const c = configs.find(x => x.id === configId);
        if (!c || !divId) return;
        void run(force => api.post(`/admin/timetable/divisions/${divId}/entries`, { dayOfWeek: hit.day, slotId: hit.slotId, sessionTypeId: c.sessionTypeId, subjectId: c.subjectId, title: c.subjectId ? null : c.title, teacherId: c.teacherId, roomId: c.roomType ? labRoomOf(c.roomType) : null, configId: c.id, force }, { params }), 'Period added');
    };
    const OWN_ROOM = '__own__';
    const places = ws.rooms.filter(r => r.isActive && r.type !== 'CLASSROOM');
    const placeName = (roomId: string | null) => (roomId ? ws.rooms.find(r => r.id === roomId)?.name ?? 'Room' : 'Own classroom');
    const setRoom = (v: string) => {
        if (!e) return;
        void run(force => api.patch(`/admin/timetable/entries/${e.id}`, { roomId: v === OWN_ROOM ? null : v, force }, { params }), 'Place changed');
    };
    const setTeacher = (v: string) => {
        if (!e) return;
        void run(force => api.patch(`/admin/timetable/entries/${e.id}`, { teacherId: v === NO_TEACHER ? null : v, force }, { params }), 'Teacher changed');
    };
    const lock = () => e && void run(() => api.post(`/admin/timetable/entries/${e.id}/${e.isLocked ? 'unlock' : 'lock'}`, {}, { params }), e.isLocked ? 'It can move again when you build' : 'Kept fixed. Building again will not move it.');
    const remove = () => e && void run(() => api.delete(`/admin/timetable/entries/${e.id}`, { params }), 'Period removed');

    const color = e ? entryColor(ws, e) : 'var(--primary)';
    return (
        <div ref={box} role="dialog" aria-label="Period" className="fixed z-[60] rounded-2xl bg-card p-3.5 text-sm shadow-2xl ring-1 ring-black/5 dark:ring-white/10" style={{ left: pos.left, top: pos.top, width: W }}>
            <div className="flex items-start gap-2">
                <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ background: color }} />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e ? entryName(ws, e) : 'Free period'}</p>
                    <p className="text-[11px] text-muted-foreground">{section?.label} - {DAY_SHORT[hit.day]}, {slot?.name}{slot ? ` (${hhmm(slot.startMinute)})` : ''}</p>
                </div>
                <button type="button" aria-label="Close" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X size={14} /></button>
            </div>

            {clash ? (
                <div className="mt-3 rounded-xl bg-red-500/10 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400"><AlertTriangle size={13} />This makes a clash</p>
                    <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">{clash.conflicts.slice(0, 4).map((c, i) => <li key={i}>{c.message}</li>)}</ul>
                    <div className="mt-2.5 flex gap-2">
                        <button type="button" disabled={busy} onClick={() => void clash.retry()} className="h-8 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-50">Do it anyway</button>
                        <button type="button" onClick={() => setClash(null)} className="h-8 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:bg-muted">Go back</button>
                    </div>
                </div>
            ) : !canEdit ? (
                <div className="mt-3 space-y-2">
                    {e && <p className="text-[12px] text-muted-foreground">{e.teacherId ? ws.teachers.find(t => t.id === e.teacherId)?.name : 'No teacher'} - {placeName(e.roomId)}</p>}
                    {e && mode !== 'class' && (
                        <button type="button" onClick={() => { onOpenClass(e.divisionId); onClose(); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><ExternalLink size={12} />Open {section?.label}</button>
                    )}
                </div>
            ) : e ? (
                <div className="mt-3 space-y-2.5">
                    <div>
                        <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Subject</p>
                        <ThemedSelect className="z-[80]" value={currentConfig?.id ?? ''} placeholder={entryName(ws, e)} onChange={changeTo} options={configs.map(optionOf)} />
                    </div>
                    <div>
                        <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Teacher</p>
                        <ThemedSelect className="z-[80]" value={e.teacherId ?? NO_TEACHER} onChange={setTeacher} options={[{ value: NO_TEACHER, label: 'No teacher' }, ...ws.teachers.map(t => ({ value: t.id, label: t.name }))]} />
                    </div>
                    <div>
                        <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Where</p>
                        <ThemedSelect className="z-[80]" value={e.roomId ?? OWN_ROOM} onChange={setRoom} options={[{ value: OWN_ROOM, label: 'Own classroom' }, ...places.map(r => ({ value: r.id, label: r.name }))]} />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        <button type="button" disabled={busy} onClick={lock} className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold ${e.isLocked ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-foreground hover:bg-muted'}`}>
                            {e.isLocked ? <><PinOff size={13} />Let it move</> : <><Pin size={13} />Keep fixed</>}
                        </button>
                        {sure
                            ? <button type="button" disabled={busy} onClick={remove} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white">Yes, remove</button>
                            : <button type="button" onClick={() => setSure(true)} aria-label="Remove period" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-600"><Trash2 size={14} /></button>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{e.isLocked ? 'Fixed: building again keeps it here.' : 'Tip: drag it onto another period to move or swap.'}</p>
                </div>
            ) : (
                <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Put a subject here</p>
                    {!configs.length && <p className="text-xs text-muted-foreground">Set the subjects for this class first.</p>}
                    <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {configs.map(c => {
                            const o = optionOf(c);
                            const n = placed(c.id);
                            const short = n < c.periodsPerWeek;
                            return (
                                <button key={c.id} type="button" disabled={busy} onClick={() => add(c.id)}
                                    className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${short ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-muted/60 text-muted-foreground hover:text-foreground'}`}>
                                    {o.label} <span className="font-normal tabular-nums">{n}/{c.periodsPerWeek}</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">Highlighted ones still need periods this week.</p>
                </div>
            )}
        </div>
    );
}
