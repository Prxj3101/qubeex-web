'use client';

import { useState } from 'react';
import { Lock, Link2, AlertTriangle, Plus, User, DoorOpen, FlaskConical } from 'lucide-react';
import { DAY_SHORT, fmtTime, type Entry, type Slot } from '@/lib/timetable';

export type GridLines = 'class' | 'teacher' | 'room' | 'subject';
export const CONFIG_DRAG_TYPE = 'application/x-tt-config';

interface Props {
    slots: Slot[];
    days: number[];
    entries: Entry[];
    lines?: GridLines;
    conflictCells?: Set<string>;   // `${day}|${slotId}`
    highlight?: Set<string>;       // cells pulsed after a conflict click
    editable?: boolean;
    compact?: boolean;             // small read-only variant for dashboard cards
    todayDow?: number;             // 1=Mon … 7=Sun → that column is highlighted
    onCellClick?: (day: number, slot: Slot, entry: Entry | undefined) => void;
    onMove?: (entry: Entry, toDay: number, toSlotId: string) => void;
    onSwap?: (a: Entry, b: Entry) => void;
    onDropConfig?: (configId: string, day: number, slot: Slot) => void;
}

export const cellKey = (day: number, slotId: string) => `${day}|${slotId}`;

/** What to print in a cell: [title, secondary, tertiary] depending on whose timetable this is. */
function cellParts(e: Entry, mode: GridLines): { title: string; a: string | null; aIcon: 'user' | 'door' | null; b: string | null } {
    const main = e.subjectName ?? e.title ?? e.sessionTypeName;
    if (mode === 'teacher') return { title: main, a: e.divisionName ?? null, aIcon: null, b: e.roomName };
    if (mode === 'room') return { title: main, a: e.divisionName ?? null, aIcon: null, b: e.teacherName };
    if (mode === 'subject') return { title: e.divisionName ?? main, a: e.teacherName, aIcon: 'user', b: e.roomName };
    return { title: main, a: e.teacherName, aIcon: 'user', b: e.roomName };
}

const tint = (hex: string | null, alpha: string) => (hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : undefined);

export function TimetableGrid({ slots, days, entries, lines = 'class', conflictCells, highlight, editable, compact, todayDow, onCellClick, onMove, onSwap, onDropConfig }: Props) {
    const [dragId, setDragId] = useState<string | null>(null);
    const [over, setOver] = useState<string | null>(null);
    const byCell = new Map<string, Entry[]>();
    for (const e of entries) {
        const k = cellKey(e.dayOfWeek, e.slotId);
        byCell.set(k, [...(byCell.get(k) ?? []), e]);
    }
    const byId = new Map(entries.map(e => [e.id, e]));
    const slotOrder = new Map(slots.map(s => [s.id, s.order]));

    // A multi-period session is dragged by its first period, whichever period is grabbed.
    const dragRoot = (e: Entry): Entry => {
        if (!e.groupId) return e;
        const members = entries.filter(x => x.groupId === e.groupId).sort((a, b) => (slotOrder.get(a.slotId) ?? 0) - (slotOrder.get(b.slotId) ?? 0));
        return members[0] ?? e;
    };

    const drop = (ev: React.DragEvent, day: number, slot: Slot) => {
        const configId = ev.dataTransfer.getData(CONFIG_DRAG_TYPE);
        setOver(null);
        if (configId) { onDropConfig?.(configId, day, slot); return; }
        const src = dragId ? byId.get(dragId) : undefined;
        setDragId(null);
        if (!src) return;
        const root = dragRoot(src);
        const target = byCell.get(cellKey(day, slot.id))?.[0];
        if (target && target.id === root.id) return;
        if (target) onSwap?.(root, dragRoot(target));
        else onMove?.(root, day, slot.id);
    };

    const rowH = compact ? 'h-8' : 'h-[84px]';

    return (
        <div className="overflow-auto rounded-2xl border border-border/60 bg-card">
            <table className={`w-full border-separate border-spacing-0 table-fixed ${compact ? 'text-[10px]' : 'text-xs min-w-[720px]'}`}>
                <thead>
                    <tr>
                        <th className={`${compact ? 'w-11' : 'w-28'} sticky left-0 top-0 z-20 bg-muted/70 backdrop-blur px-2 ${compact ? 'py-1' : 'py-2.5'} text-left font-semibold text-muted-foreground`}>{compact ? '' : 'Period'}</th>
                        {days.map(d => (
                            <th key={d} className={`sticky top-0 z-10 px-1 ${compact ? 'py-1' : 'py-2.5'} text-center font-semibold backdrop-blur ${todayDow === d ? 'bg-primary/15 text-primary' : 'bg-muted/70 text-foreground'}`}>
                                {DAY_SHORT[d]}{!compact && todayDow === d && <span className="ml-1 text-[10px] font-medium opacity-80">today</span>}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {slots.map(slot => {
                        const teaching = slot.kind === 'PERIOD';
                        return (
                            <tr key={slot.id} className={teaching ? '' : 'bg-muted/30'}>
                                <td className="sticky left-0 z-10 bg-card px-2 py-1.5 align-middle border-t border-border/50">
                                    <div className="font-semibold text-foreground truncate">{compact ? slot.name.replace(/^Period\s*/i, 'P') : slot.name}</div>
                                    {!compact && <div className="text-[10px] text-muted-foreground leading-tight">{fmtTime(slot.startMinute)}<br />{fmtTime(slot.endMinute)}</div>}
                                    {!teaching && !compact && <div className="mt-0.5 inline-block rounded bg-muted px-1 text-[9px] uppercase tracking-wide text-muted-foreground">{slot.kind.toLowerCase()}</div>}
                                </td>
                                {days.map(day => {
                                    const k = cellKey(day, slot.id);
                                    const list = byCell.get(k) ?? [];
                                    const e = list[0];
                                    const bad = conflictCells?.has(k);
                                    const hl = highlight?.has(k);
                                    const isOver = over === k;
                                    const color = e?.color ?? '#7C3AED';
                                    const parts = e ? cellParts(e, lines) : null;
                                    return (
                                        <td
                                            key={day}
                                            data-cell={k}
                                            onDragOver={editable ? ev => { ev.preventDefault(); setOver(k); } : undefined}
                                            onDragLeave={editable ? () => setOver(o => (o === k ? null : o)) : undefined}
                                            onDrop={editable ? ev => { ev.preventDefault(); drop(ev, day, slot); } : undefined}
                                            onClick={() => onCellClick?.(day, slot, e)}
                                            className={`group relative border-t border-l border-border/50 align-top transition-colors ${compact ? 'p-0.5' : 'p-1'} ${rowH} ${todayDow === day ? 'bg-primary/[0.04]' : ''} ${onCellClick ? 'cursor-pointer hover:bg-muted/40' : ''} ${isOver ? '!bg-primary/15 ring-2 ring-inset ring-primary/60' : ''} ${hl ? 'ring-2 ring-inset ring-amber-400 animate-pulse' : ''}`}
                                        >
                                            {e && parts && (
                                                <div
                                                    draggable={editable && !e.isLocked}
                                                    onDragStart={ev => { ev.dataTransfer.effectAllowed = 'move'; setDragId(e.id); }}
                                                    onDragEnd={() => { setDragId(null); setOver(null); }}
                                                    className={`h-full overflow-hidden rounded-lg border-l-[4px] ${compact ? 'px-1 py-0.5' : 'px-2 py-1.5'} ${bad ? 'outline outline-1 outline-red-500/60' : ''} ${dragId === e.id ? 'opacity-40' : ''} ${editable && !e.isLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                                    style={{ borderLeftColor: color, background: bad ? 'rgba(239,68,68,0.10)' : tint(color, '1A') ?? 'var(--muted)' }}
                                                    title={[parts.title, parts.a, parts.b].filter(Boolean).join(' · ')}
                                                >
                                                    <div className={`font-semibold leading-tight text-foreground ${compact ? 'truncate' : 'line-clamp-2'}`}>{parts.title}</div>
                                                    {!compact && parts.a && (
                                                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-foreground/70 truncate">
                                                            {parts.aIcon === 'user' && <User className="w-3 h-3 shrink-0" />}<span className="truncate">{parts.a}</span>
                                                        </div>
                                                    )}
                                                    {!compact && parts.b && (
                                                        <div className="flex items-center gap-1 text-[11px] text-foreground/60 truncate">
                                                            <DoorOpen className="w-3 h-3 shrink-0" /><span className="truncate">{parts.b}</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 text-muted-foreground">
                                                        {bad && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                                                        {e.groupId && <Link2 className="w-3 h-3" />}
                                                        {e.isLocked && <Lock className="w-3 h-3 text-amber-500" />}
                                                    </div>
                                                    {list.length > 1 && <div className="text-[10px] text-primary">+{list.length - 1} more</div>}
                                                    {e.roomIsLab && <FlaskConical className="absolute bottom-1.5 right-1.5 w-3 h-3" style={{ color }} aria-label="In a lab" />}
                                                </div>
                                            )}
                                            {!e && editable && teaching && (
                                                <div className="h-full w-full rounded-lg border border-dashed border-transparent group-hover:border-border flex items-center justify-center text-muted-foreground/0 group-hover:text-muted-foreground/70">
                                                    <Plus className="w-4 h-4" />
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/** Color key for the subjects/sessions that appear in a grid. */
export function GridLegend({ entries }: { entries: Entry[] }) {
    const seen = new Map<string, string>();
    for (const e of entries) {
        const name = e.subjectName ?? e.title ?? e.sessionTypeName;
        if (name && !seen.has(name)) seen.set(name, e.color ?? '#7C3AED');
    }
    if (!seen.size) return null;
    return (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {[...seen.entries()].map(([name, color]) => (
                <span key={name} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{name}</span>
            ))}
        </div>
    );
}
