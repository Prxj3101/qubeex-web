'use client';

import { useMemo, useState } from 'react';
import { Calendar, Expand, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useCanManageTimetable } from '@/hooks/useTimetableAccess';
import { useRemote } from '@/hooks/useRemote';
import { TimetableGrid } from './TimetableGrid';
import { ClassTimetableEditor } from './ClassTimetableEditor';
import { STATUS_CLASS, STATUS_LABEL, selfApi, ttApi, type Entry, type Slot, type TimetableStatus, type WeekData } from '@/lib/timetable';
import api from '@/lib/api';

type Mode = 'admin' | 'teacher' | 'student';

interface Model {
    slots: Slot[];
    days: number[];
    entries: Entry[];
    status: TimetableStatus | null;     // admin only (teachers/students only ever see published data)
    writable: boolean;
    hasContent: boolean;
}

// A published week (teacher/student payload) → the same entry shape the grid renders.
function fromWeek(w: WeekData, divisionId: string): Model {
    const entries: Entry[] = [];
    for (const d of w.days) {
        for (const s of d.sessions) {
            const base = s.subjectName ?? s.title ?? s.sessionTypeName;
            entries.push({
                id: `${s.date}-${s.slotId}-${s.divisionId}`, divisionId, dayOfWeek: d.dayOfWeek, slotId: s.slotId,
                sessionTypeId: '', sessionTypeName: s.sessionTypeName, sessionKind: s.sessionKind, color: s.color,
                subjectId: null, subjectName: s.status === 'CANCELLED' ? `${base} (cancelled)` : base, title: s.title,
                teacherId: s.teacherId, teacherName: s.teacherName, roomId: null, roomName: s.roomName,
                configId: null, groupId: null, isLocked: false, divisionName: s.divisionName,
            });
        }
    }
    return { slots: w.slots, days: w.workingDays, entries, status: w.published ? 'PUBLISHED' : null, writable: false, hasContent: w.published && entries.length > 0 };
}

/**
 * The "Timetable" card on a class page. Shows the live weekly grid when the class has one and falls back to
 * the old uploaded image otherwise. Admins get an Edit button that opens the full studio for just this class.
 */
export function ClassTimetableCard({ mode, divisionId, divisionLabel, imageUrl, onOpenImage, headerExtra }: {
    mode: Mode; divisionId: string; divisionLabel: string; imageUrl: string | null; onOpenImage?: () => void; headerExtra?: React.ReactNode;
}) {
    const { selectedYearId } = useAcademicYear();
    const canManage = useCanManageTimetable();
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);

    // Student/teacher cards read the current year; the admin page honours the selected academic year.
    const yearId = mode === 'student' ? undefined : selectedYearId;
    const ready = mode === 'student' || !!selectedYearId;
    const q = useRemote<Model | null>(ready ? `card:${mode}:${divisionId}:${yearId ?? 'cur'}` : null, async () => {
        try {
            if (mode === 'admin') {
                const st = await ttApi.studio(yearId, divisionId);
                return { slots: st.slots, days: st.workingDays, entries: st.entries, status: st.timetable?.status ?? null, writable: st.writable, hasContent: st.entries.length > 0 };
            }
            if (mode === 'student') return fromWeek(await selfApi.week('student', undefined), divisionId);
            const res = await api.get(`/teacher/timetable/division/${divisionId}`, { params: yearId ? { academicYearId: yearId } : {} });
            return fromWeek(res.data.data as WeekData, divisionId);
        } catch {
            return null; // no access / not configured → fall back to the image
        }
    });
    const m = q.data;
    const canEdit = mode === 'admin' && canManage && !!m?.writable;
    const showGrid = !!m && m.hasContent;
    const unpublished = mode === 'admin' && m?.status && m.status !== 'PUBLISHED';

    const grid = useMemo(() => (m ? (
        <TimetableGrid slots={m.slots} days={m.days} entries={m.entries} compact />
    ) : null), [m]);

    return (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
            <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-border/40 bg-muted/20">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={12} /> Timetable
                    {mode === 'admin' && m?.status && (
                        <span className={`ml-1 rounded-full border px-1.5 py-0 text-[9px] normal-case ${STATUS_CLASS[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                    )}
                </span>
                <span className="flex items-center gap-1.5">
                    {headerExtra}
                    {showGrid && (
                        <button type="button" onClick={() => setExpanded(true)} className="inline-flex items-center gap-1 rounded-lg border border-border/50 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted" aria-label="Expand timetable">
                            <Expand size={11} /> View
                        </button>
                    )}
                    {canEdit && (
                        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90">
                            <Pencil size={11} /> Edit timetable
                        </button>
                    )}
                </span>
            </div>

            {q.loading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
            ) : showGrid ? (
                <div className="p-2">
                    {grid}
                    {unpublished && <p className="px-1 pt-2 text-[10px] text-amber-600">Not published yet — students and teachers can&apos;t see this.</p>}
                </div>
            ) : imageUrl ? (
                <div className="p-2 cursor-pointer" onClick={onOpenImage}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Timetable" className={`w-full rounded-xl object-contain hover:opacity-90 transition-opacity ${mode === 'student' ? 'max-h-[320px]' : 'max-h-84'}`} />
                </div>
            ) : (
                <div className="px-4 py-8 text-center">
                    <p className="text-[12px] text-muted-foreground">
                        {mode === 'admin' ? (canEdit ? 'No timetable yet. Use Edit timetable to build one.' : 'No timetable yet.') : 'Timetable not published yet'}
                    </p>
                </div>
            )}

            {showGrid && m && (
                <Dialog open={expanded} onOpenChange={setExpanded}>
                    <DialogContent className="sm:max-w-5xl bg-card">
                        <DialogHeader><DialogTitle>Timetable — {divisionLabel}</DialogTitle></DialogHeader>
                        <div className="max-h-[75vh] overflow-auto">
                            <TimetableGrid slots={m.slots} days={m.days} entries={m.entries} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {editing && (
                <Dialog open onOpenChange={o => { if (!o) { setEditing(false); q.reload(); } }}>
                    <DialogContent className="sm:max-w-[1400px] w-[96vw] h-[92vh] overflow-y-auto bg-card content-start">
                        <DialogHeader><DialogTitle>Timetable — {divisionLabel}</DialogTitle></DialogHeader>
                        <ClassTimetableEditor divisionId={divisionId} onChanged={q.reload} />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
