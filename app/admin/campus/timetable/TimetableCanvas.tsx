'use client';

import { useState } from 'react';
import { Ban, Coffee, FlaskConical, Link2, Pin, UtensilsCrossed } from 'lucide-react';
import { DAY_SHORT, entryColor, entryName, hhmm, type Workspace, type WsEntry } from './ttai';

// The week grid on the left: days down, periods across. Class view shows the
// subject and teacher; teacher and room views show the subject and class.
// Click a period to change it, drag it onto another period to move or swap.

export type CanvasMode = 'class' | 'teacher' | 'room';
export interface CellHit { day: number; slotId: string; entry: WsEntry | null; rect: DOMRect }

export function TimetableCanvas({ ws, mode, targetId, glow, building, editable, onCell, onDrop }: {
    ws: Workspace;
    mode: CanvasMode;
    targetId: string | null;
    glow: Set<string>;
    building: boolean;
    editable: boolean;
    onCell?: (hit: CellHit) => void;
    onDrop?: (from: WsEntry, day: number, slotId: string, onto: WsEntry | null) => void;
}) {
    const [dragId, setDragId] = useState<string | null>(null);
    const [over, setOver] = useState<string | null>(null);
    const slots = ws.slots;
    const days = ws.workingDays;
    const teacher = new Map(ws.teachers.map(t => [t.id, t.name]));
    const label = new Map(ws.standards.flatMap(s => s.divisions.map(d => [d.id, d.label] as const)));
    // Periods in a lab (Science lab, Computer lab...) get a small flask; grounds and other rooms do not.
    const lab = new Map(ws.rooms.filter(r => r.type.includes('LAB')).map(r => [r.id, r.name]));
    const mine: WsEntry[] = ws.entries.filter(e => (mode === 'class' ? e.divisionId : mode === 'teacher' ? e.teacherId : e.roomId) === targetId);
    const at = new Map(mine.map(e => [`${e.dayOfWeek}|${e.slotId}`, e]));
    const off = new Set(mode === 'teacher' ? ws.unavailable.filter(u => u.teacherId === targetId).map(u => `${u.dayOfWeek}|${u.slotId}`) : []);
    const canDrag = editable && mode === 'class' && !building;
    let n = 0;

    if (!slots.length || !days.length) {
        return (
            <div className="grid h-full place-items-center rounded-2xl bg-muted/20 p-8 text-center">
                <div>
                    <div className="mx-auto mb-4 grid w-[260px] grid-cols-6 gap-1.5 opacity-60">
                        {Array.from({ length: 30 }, (_, i) => <span key={i} className="h-6 animate-pulse rounded-md bg-muted" style={{ animationDelay: `${(i % 6) * 120}ms` }} />)}
                    </div>
                    <p className="text-sm font-semibold">Your timetable will appear here</p>
                    <p className="mt-1 text-xs text-muted-foreground">Tell the assistant your school timings to begin.</p>
                </div>
            </div>
        );
    }

    const hit = (ev: React.MouseEvent, day: number, slotId: string, entry: WsEntry | null) => {
        if (!onCell || building) return;
        onCell({ day, slotId, entry, rect: (ev.currentTarget as HTMLElement).getBoundingClientRect() });
    };
    const dropOn = (day: number, slotId: string, onto: WsEntry | null) => {
        const from = mine.find(e => e.id === dragId);
        setDragId(null); setOver(null);
        if (!from || (from.dayOfWeek === day && from.slotId === slotId)) return;
        onDrop?.(from, day, slotId, onto);
    };
    const dropProps = (key: string, day: number, slotId: string, onto: WsEntry | null) => (canDrag ? {
        onDragOver: (ev: React.DragEvent) => { if (dragId) { ev.preventDefault(); if (over !== key) setOver(key); } },
        onDragLeave: () => setOver(o => (o === key ? null : o)),
        onDrop: (ev: React.DragEvent) => { ev.preventDefault(); dropOn(day, slotId, onto); },
    } : {});

    return (
        <div className="min-h-0 overflow-auto rounded-2xl" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full border-separate" style={{ borderSpacing: 6 }}>
                <thead>
                    <tr>
                        <th className="sticky left-0 z-10 w-14 bg-card" />
                        {slots.map(s => (
                            <th key={s.id} className={`text-left align-bottom font-medium ${s.kind === 'PERIOD' ? 'min-w-[84px]' : 'w-9'}`}>
                                {s.kind === 'PERIOD'
                                    ? <span className="block px-1"><span className="block text-[11px] font-semibold text-foreground">{s.name.replace(/^Period\s*/i, 'P')}</span><span className="block text-[10px] text-muted-foreground">{hhmm(s.startMinute)}</span></span>
                                    : <span className="sr-only">{s.name}</span>}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {days.map((d, di) => (
                        <tr key={d}>
                            <th className="sticky left-0 z-10 bg-card pr-1 text-left text-xs font-semibold text-muted-foreground">{DAY_SHORT[d]}</th>
                            {slots.map(s => {
                                if (s.kind !== 'PERIOD') {
                                    return di === 0
                                        ? <td key={s.id} rowSpan={days.length} className="rounded-xl bg-muted/50 text-center align-middle text-muted-foreground" title={`${s.name} ${hhmm(s.startMinute)}`}>
                                            <span className="flex rotate-180 flex-col items-center gap-1 py-2 text-[10px] font-semibold [writing-mode:vertical-rl]">
                                                {s.kind === 'LUNCH' ? <UtensilsCrossed size={12} className="rotate-90" /> : <Coffee size={12} className="rotate-90" />}{s.name}
                                            </span>
                                        </td>
                                        : null;
                                }
                                const key = `${d}|${s.id}`;
                                const e = at.get(key);
                                const isOver = over === key;
                                if (!e) {
                                    const isOff = off.has(key);
                                    const clickable = !!onCell && !building && (editable || mode !== 'class');
                                    return (
                                        <td key={s.id} {...dropProps(key, d, s.id, null)}
                                            onClick={clickable ? ev => hit(ev, d, s.id, null) : undefined}
                                            className={`group h-14 rounded-xl transition ${isOver ? 'bg-primary/15 ring-2 ring-primary/50' : isOff ? 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(148,163,184,0.2)_6px_8px)]' : building ? 'animate-pulse bg-muted/60' : 'bg-muted/30'} ${clickable ? 'cursor-pointer hover:bg-muted/60' : ''}`}>
                                            {isOff && <span className="flex items-center gap-1 px-2 text-[10px] font-semibold text-muted-foreground"><Ban size={10} />Not free</span>}
                                            {!isOff && clickable && <span className="block px-2 text-[10px] font-semibold text-muted-foreground opacity-0 transition group-hover:opacity-100">{mode === 'teacher' ? 'Mark not free' : mode === 'class' ? '+ Add' : ''}</span>}
                                        </td>
                                    );
                                }
                                const name = entryName(ws, e);
                                const c = entryColor(ws, e);
                                const order = n++;
                                const glowing = glow.has(e.id);
                                const second = mode === 'class' ? (e.teacherId ? teacher.get(e.teacherId) : ws.sessionTypes.find(t => t.id === e.sessionTypeId)?.requiresTeacher === false ? '' : 'No teacher') : label.get(e.divisionId);
                                return (
                                    <td key={s.id} className="h-14 p-0 align-top" {...dropProps(key, d, s.id, e)}>
                                        <div key={e.id} draggable={canDrag} onDragStart={ev => { ev.dataTransfer.effectAllowed = 'move'; setDragId(e.id); }} onDragEnd={() => { setDragId(null); setOver(null); }}
                                            onClick={ev => hit(ev, d, s.id, e)}
                                            className={`tt-pop relative h-full min-h-14 overflow-hidden rounded-xl px-2 py-1.5 ${onCell && !building ? 'cursor-pointer hover:brightness-95' : ''} ${canDrag ? 'active:cursor-grabbing' : ''} ${glowing ? 'tt-glow' : ''} ${isOver ? 'ring-2 ring-primary/60' : ''} ${dragId === e.id ? 'opacity-40' : ''}`}
                                            style={{ background: `${c}1F`, boxShadow: `inset 3px 0 0 ${c}`, animationDelay: `${Math.min(order, 60) * 18}ms` }}
                                            title={`${name}${e.teacherId ? ` - ${teacher.get(e.teacherId) ?? ''}` : ''}${mode !== 'class' ? ` - ${label.get(e.divisionId) ?? ''}` : ''}${e.roomId && lab.has(e.roomId) ? ` - ${lab.get(e.roomId)}` : ''}`}>
                                            <p className={`truncate text-[12px] font-semibold leading-tight ${e.isLocked && e.groupId ? 'pr-7' : 'pr-3'}`} style={{ color: c }}>{name}</p>
                                            <p className="mt-0.5 truncate pr-3 text-[10.5px] leading-tight text-muted-foreground">{second}</p>
                                            {(e.isLocked || e.groupId) && (
                                                <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 text-muted-foreground">
                                                    {e.groupId && <Link2 size={11} aria-label="Double period" />}
                                                    {e.isLocked && <Pin size={10} className="rotate-45" aria-label="Kept fixed" />}
                                                </span>
                                            )}
                                            {e.roomId && lab.has(e.roomId) && <FlaskConical size={11} className="absolute bottom-1.5 right-1.5" style={{ color: c }} aria-label={lab.get(e.roomId)} />}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            <style>{`
                @keyframes ttPop { from { opacity: 0; transform: translateY(6px) scale(.92); } to { opacity: 1; transform: none; } }
                .tt-pop { animation: ttPop .38s cubic-bezier(.2,.8,.2,1) both; }
                @keyframes ttGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(218,119,86,0); } 50% { box-shadow: 0 0 0 3px rgba(218,119,86,.55); } }
                .tt-glow { outline: 2px solid #DA7756; outline-offset: 1px; animation: ttPop .38s both, ttGlow 1.4s ease-in-out 3; }
                @media (prefers-reduced-motion: reduce) { .tt-pop, .tt-glow { animation: none; } }
            `}</style>
        </div>
    );
}

/** Whole school on one day: every section down, periods across. */
export function SchoolDayView({ ws, day, onDay, onOpenClass }: { ws: Workspace; day: number; onDay: (d: number) => void; onOpenClass: (divisionId: string) => void }) {
    const teacher = new Map(ws.teachers.map(t => [t.id, t.name]));
    const by = new Map(ws.entries.filter(e => e.dayOfWeek === day).map(e => [`${e.divisionId}|${e.slotId}`, e]));
    const sections = ws.standards.flatMap(s => s.divisions);
    const lab = new Map(ws.rooms.filter(r => r.type.includes('LAB')).map(r => [r.id, r.name]));
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
                {ws.workingDays.map(d => (
                    <button key={d} type="button" onClick={() => onDay(d)} aria-pressed={d === day}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${d === day ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:text-foreground'}`}>{DAY_SHORT[d]}</button>
                ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-2xl" style={{ scrollbarWidth: 'thin' }}>
                <table className="w-full border-separate" style={{ borderSpacing: 4 }}>
                    <thead>
                        <tr>
                            <th className="sticky left-0 top-0 z-20 bg-card" />
                            {ws.slots.map(s => (
                                <th key={s.id} className={`sticky top-0 z-10 bg-card text-left align-bottom ${s.kind === 'PERIOD' ? 'min-w-[88px]' : 'w-3'}`}>
                                    {s.kind === 'PERIOD' && <span className="block px-1 text-[11px] font-semibold">{s.name.replace(/^Period\s*/i, 'P')}<span className="block text-[10px] font-normal text-muted-foreground">{hhmm(s.startMinute)}</span></span>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sections.map(d => (
                            <tr key={d.id}>
                                <th className="sticky left-0 z-10 bg-card pr-1 text-left">
                                    <button type="button" onClick={() => onOpenClass(d.id)} className="whitespace-nowrap rounded-lg px-1.5 py-1 text-xs font-semibold hover:bg-muted">{d.label}</button>
                                </th>
                                {ws.slots.map(s => {
                                    if (s.kind !== 'PERIOD') return <td key={s.id} className="rounded bg-muted/40" />;
                                    const e = by.get(`${d.id}|${s.id}`);
                                    if (!e) return <td key={s.id} className="h-10 rounded-lg bg-muted/25" />;
                                    const c = entryColor(ws, e);
                                    return (
                                        <td key={s.id} className="relative h-10 rounded-lg px-1.5 py-1 pr-4 align-top" style={{ background: `${c}1A`, boxShadow: `inset 2px 0 0 ${c}` }}>
                                            <p className="truncate text-[11px] font-semibold leading-tight" style={{ color: c }} title={e.roomId ? lab.get(e.roomId) : undefined}>{entryName(ws, e)}</p>
                                            <p className="truncate text-[10px] leading-tight text-muted-foreground">{e.teacherId ? teacher.get(e.teacherId) : ''}</p>
                                            {e.roomId && lab.has(e.roomId) && <FlaskConical size={10} className="absolute bottom-1 right-1" style={{ color: c }} />}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
