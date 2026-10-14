'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, Circle } from 'lucide-react';
import type { StudioData } from '@/lib/timetable';

export type ReadinessTarget = 'setup' | 'resources';

interface Item {
    key: string;
    label: string;
    done: boolean;
    detail?: string;
    action?: { label: string; run: () => void };
}

/**
 * "Is this class ready?" — every step from days and periods to Publish, with what's missing and a button
 * that goes straight to the fix, so nobody has to know the order of things.
 */
export function ReadinessChecklist({ studio, canManage, onNavigate, onEditRequirements, onGenerate, onShowConflicts, onPublish }: {
    studio: StudioData;
    canManage: boolean;
    onNavigate: (t: ReadinessTarget) => void;
    onEditRequirements: () => void;
    onGenerate: () => void;
    onShowConflicts: () => void;
    onPublish: () => void;
}) {
    const hasDays = studio.workingDays.length > 0;
    const hasPeriods = studio.slots.some(s => s.kind === 'PERIOD');
    const hasConfigs = studio.configs.length > 0;

    const typeById = new Map(studio.sessionTypes.map(t => [t.id, t]));
    const needsTeacher = studio.configs.filter(c => typeById.get(c.sessionTypeId)?.requiresTeacher && !c.resolvedTeacherId);
    const missingRoomTypes = [...new Set(studio.configs.flatMap(c => {
        const t = typeById.get(c.sessionTypeId);
        const rt = c.roomType ?? t?.roomType;
        return rt && !c.roomId && !studio.rooms.some(r => r.isActive && r.type === rt) ? [rt] : [];
    }))];
    const generated = studio.entries.length > 0;
    const incomplete = studio.requirements.filter(r => r.status !== 'COMPLETE');
    const errors = studio.conflicts.filter(c => c.severity === 'ERROR');
    const published = studio.timetable?.status === 'PUBLISHED';

    const items: Item[] = [
        { key: 'days', label: 'Working days set', done: hasDays, action: { label: 'Set days', run: () => onNavigate('setup') } },
        { key: 'periods', label: 'Periods & breaks set', done: hasPeriods, action: { label: 'Add periods', run: () => onNavigate('setup') } },
        { key: 'req', label: 'Weekly requirements added', done: hasConfigs, detail: hasConfigs ? `${studio.configs.length} subjects/activities` : 'How many periods each subject needs per week', action: { label: 'Add requirements', run: onEditRequirements } },
        {
            key: 'teachers', label: 'Every subject has a teacher', done: hasConfigs && needsTeacher.length === 0,
            detail: needsTeacher.length ? `No teacher for: ${needsTeacher.map(c => c.label || c.subjectName || c.title || 'a session').join(', ')}. Assign them under Campus → Classes → this class → Manage, or pick one in Edit requirements.` : undefined,
            action: needsTeacher.length ? { label: 'Pick teachers', run: onEditRequirements } : undefined,
        },
        {
            key: 'rooms', label: 'Rooms exist for labs & practicals', done: missingRoomTypes.length === 0,
            detail: missingRoomTypes.length ? `No active ${missingRoomTypes.map(t => t.toLowerCase()).join(', ')} room yet.` : undefined,
            action: missingRoomTypes.length ? { label: 'Add rooms', run: () => onNavigate('resources') } : undefined,
        },
        { key: 'gen', label: 'Timetable generated', done: generated, action: { label: 'Generate', run: onGenerate } },
        {
            key: 'complete', label: 'Every subject fully scheduled', done: generated && incomplete.length === 0,
            detail: generated && incomplete.length ? `${incomplete.map(r => `${r.label} ${r.scheduled}/${r.required}`).join(', ')}` : undefined,
            action: generated && incomplete.length ? { label: 'Regenerate', run: onGenerate } : undefined,
        },
        { key: 'conf', label: 'No conflicts', done: errors.length === 0, detail: errors.length ? `${errors.length} to resolve` : undefined, action: errors.length ? { label: 'Show conflicts', run: onShowConflicts } : undefined },
        { key: 'pub', label: 'Published to teachers & students', done: published, action: { label: 'Publish', run: onPublish } },
    ];

    const doneCount = items.filter(i => i.done).length;
    const allDone = doneCount === items.length;
    const next = items.find(i => !i.done);
    const [open, setOpen] = useState(!allDone);
    const pct = Math.round((doneCount / items.length) * 100);

    return (
        <section className="rounded-2xl border border-border/60 bg-card print:hidden">
            <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
                {allDone ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="h-5 w-5 shrink-0 text-primary" />}
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{allDone ? 'All set — this timetable is live' : `Getting ready: ${doneCount} of ${items.length} done`}</div>
                    <div className="truncate text-xs text-muted-foreground">{allDone ? 'Teachers and students can see it.' : next ? `Next: ${next.label}` : ''}</div>
                </div>
                <div className="hidden w-32 sm:block"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${allDone ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div></div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ul className="divide-y divide-border/50 border-t border-border/50">
                    {items.map(i => (
                        <li key={i.key} className="flex items-start gap-3 px-4 py-2.5">
                            {i.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${i === next ? 'text-primary' : 'text-muted-foreground/60'}`} />}
                            <div className="min-w-0 flex-1">
                                <div className={`text-sm ${i.done ? 'text-muted-foreground' : 'font-medium'}`}>{i.label}</div>
                                {i.detail && <div className="text-xs text-muted-foreground">{i.detail}</div>}
                            </div>
                            {!i.done && i.action && canManage && (
                                <button type="button" onClick={i.action.run} className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold ${i === next ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}>{i.action.label}</button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
