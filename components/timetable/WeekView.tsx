'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRemote } from '@/hooks/useRemote';
import { ChevronLeft, ChevronRight, Clock, FlaskConical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { DAY_NAMES, DAY_SHORT, fmtTime, selfApi, errMsg, type Slot, type WeekData, type WeekSession } from '@/lib/timetable';

const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function badge(s: WeekSession, role: 'teacher' | 'student'): { text: string; cls: string } | null {
    switch (s.status) {
        case 'CANCELLED': return { text: 'Cancelled', cls: 'bg-red-500/10 text-red-600' };
        case 'CHANGED': return { text: 'Changed', cls: 'bg-amber-500/10 text-amber-600' };
        case 'SUBSTITUTED': return role === 'teacher'
            ? { text: `Covered by ${s.teacherName ?? 'substitute'}`, cls: 'bg-sky-500/10 text-sky-600' }
            : { text: `Substitute: ${s.teacherName ?? ''}`, cls: 'bg-sky-500/10 text-sky-600' };
        case 'COVERING': return { text: 'Substitute duty', cls: 'bg-violet-500/10 text-violet-600' };
        case 'REASSIGNED': return { text: 'Reassigned', cls: 'bg-zinc-500/10 text-zinc-500' };
        default: return null;
    }
}

function title(s: WeekSession) { return s.subjectName ?? s.title ?? s.sessionTypeName; }

function SessionCard({ s, role, now, next }: { s: WeekSession; role: 'teacher' | 'student'; now?: boolean; next?: boolean }) {
    const b = badge(s, role);
    const dim = s.status === 'CANCELLED' || s.status === 'REASSIGNED';
    const sub = role === 'teacher' ? [s.divisionName, s.roomName] : [s.status === 'SUBSTITUTED' ? null : s.teacherName, s.roomName];
    return (
        <div className={`rounded-xl border p-3 ${now ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : next ? 'border-primary/40' : 'border-border/60'} bg-card ${dim ? 'opacity-60' : ''}`}
            style={{ borderLeftWidth: 4, borderLeftColor: s.color ?? 'var(--primary)' }}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className={`font-semibold text-foreground truncate ${s.status === 'CANCELLED' ? 'line-through' : ''}`}>{title(s)}</div>
                    <div className="text-xs text-muted-foreground truncate">{sub.filter(Boolean).join(' · ') || s.sessionTypeName}</div>
                    {s.status === 'CHANGED' && s.originalSubjectName && <div className="text-[11px] text-muted-foreground">was {s.originalSubjectName}</div>}
                    {s.status === 'SUBSTITUTED' && s.originalTeacherName && role === 'student' && <div className="text-[11px] text-muted-foreground">instead of {s.originalTeacherName}</div>}
                    {s.note && <div className="text-[11px] text-muted-foreground italic">{s.note}</div>}
                </div>
                <div className="text-right shrink-0">
                    <div className="text-xs font-medium">{s.slotName}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtTime(s.startMinute)} – {fmtTime(s.endMinute)}</div>
                    {s.roomIsLab && <FlaskConical className="ml-auto mt-1 h-3.5 w-3.5" style={{ color: s.color ?? 'var(--primary)' }} aria-label="In a lab" />}
                    {now && <div className="text-[10px] font-bold text-primary">NOW</div>}
                    {next && !now && <div className="text-[10px] font-bold text-primary/80">NEXT</div>}
                </div>
            </div>
            {b && <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.cls}`}>{b.text}</span>}
        </div>
    );
}

function DayList({ date, slots, sessions, role, data }: { date: string; slots: Slot[]; sessions: WeekSession[]; role: 'teacher' | 'student'; data: WeekData }) {
    const isToday = date === data.today;
    return (
        <div className="space-y-2">
            {slots.map(slot => {
                const list = sessions.filter(s => s.slotId === slot.id);
                if (!list.length) {
                    if (slot.kind !== 'PERIOD') {
                        return <div key={slot.id} className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><span className="flex-1 border-t border-dashed border-border" />{slot.name} · {fmtTime(slot.startMinute)} – {fmtTime(slot.endMinute)}<span className="flex-1 border-t border-dashed border-border" /></div>;
                    }
                    return role === 'student'
                        ? <div key={slot.id} className="rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground flex justify-between"><span>{slot.name} · Free</span><span>{fmtTime(slot.startMinute)} – {fmtTime(slot.endMinute)}</span></div>
                        : null;
                }
                return list.map(s => (
                    <SessionCard key={`${s.slotId}-${s.divisionId}`} s={s} role={role}
                        now={isToday && data.current?.slotId === s.slotId && data.current.divisionId === s.divisionId}
                        next={isToday && data.next?.slotId === s.slotId && data.next.divisionId === s.divisionId} />
                ));
            })}
        </div>
    );
}

export function WeekView({ role }: { role: 'teacher' | 'student' }) {
    const { selectedYearId, loading: yl } = useAcademicYear();
    const [anchor, setAnchor] = useState<string | undefined>(undefined);
    const [mode, setMode] = useState<'day' | 'week'>('day');
    const [dayPick, setDayPick] = useState<string | null>(null);

    const q = useRemote(selectedYearId ? `wk:${role}:${selectedYearId}:${anchor ?? 'now'}` : null, () => selfApi.week(role, selectedYearId, anchor), e => toast.error(errMsg(e, 'Could not load timetable')));
    const data = q.data;
    const reload = q.reload;
    // Refresh every minute so "now/next" stays accurate and published changes show up quickly.
    useEffect(() => { const t = setInterval(reload, 60_000); return () => clearInterval(t); }, [reload]);

    const dates = data?.days.map(d => d.date) ?? [];
    const dayIdx = dayPick && dates.includes(dayPick) ? dayPick : data && dates.includes(data.today) ? data.today : dates[0] ?? null;
    const setDayIdx = setDayPick;

    const sessionsByDate = useMemo(() => new Map(data?.days.map(d => [d.date, d.sessions]) ?? []), [data]);

    if (yl || q.loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    if (!data) return <p className="py-10 text-center text-sm text-muted-foreground">Timetable unavailable.</p>;

    const empty = !data.published;
    const weekEnd = addDays(data.weekStart, 6);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl font-bold text-foreground">My Timetable</h1>
                    <p className="text-xs text-muted-foreground">{data.academicYear.label}{data.division ? ` · ${data.division}` : ''} · {fmtDay(data.weekStart)} – {fmtDay(weekEnd)}</p>
                </div>
                <div className="flex items-center gap-1">
                    <button className="p-2 rounded-lg border border-border hover:bg-muted" aria-label="Previous week" onClick={() => setAnchor(addDays(data.weekStart, -7))}><ChevronLeft className="w-4 h-4" /></button>
                    <button className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted" onClick={() => setAnchor(undefined)}>Today</button>
                    <button className="p-2 rounded-lg border border-border hover:bg-muted" aria-label="Next week" onClick={() => setAnchor(addDays(data.weekStart, 7))}><ChevronRight className="w-4 h-4" /></button>
                    <div className="ml-2 flex rounded-lg bg-muted/60 p-0.5 text-sm">
                        {(['day', 'week'] as const).map(m => <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded-md ${mode === m ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}>{m === 'day' ? 'Day' : 'Week'}</button>)}
                    </div>
                </div>
            </div>

            {!data.academicYear.isCurrent && <div className="px-3 py-2 text-sm rounded-lg bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900">Showing {data.academicYear.label} (past year, read-only).</div>}

            {data.academicYear.isCurrent && (data.current || data.next) && (
                <div className="grid gap-2 sm:grid-cols-2">
                    {data.current && <div><div className="mb-1 text-[11px] font-bold text-primary flex items-center gap-1"><Clock className="w-3 h-3" /> CURRENT PERIOD</div><SessionCard s={data.current} role={role} now /></div>}
                    {data.next && <div><div className="mb-1 text-[11px] font-bold text-muted-foreground">UPCOMING</div><SessionCard s={data.next} role={role} next /></div>}
                </div>
            )}

            {empty ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                    {role === 'teacher' ? 'No published timetable for you yet. It will appear here once your school publishes it.' : "Your class timetable hasn't been published yet."}
                </div>
            ) : mode === 'day' ? (
                <>
                    <div className="flex gap-1 overflow-x-auto pb-1">
                        {data.days.map(d => (
                            <button key={d.date} onClick={() => setDayIdx(d.date)}
                                className={`shrink-0 rounded-xl border px-3 py-1.5 text-center text-sm ${dayIdx === d.date ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground'}`}>
                                <div>{DAY_SHORT[d.dayOfWeek]}</div>
                                <div className="text-[10px]">{fmtDay(d.date)}{d.date === data.today ? ' · today' : ''}</div>
                            </button>
                        ))}
                    </div>
                    {dayIdx && <DayList date={dayIdx} slots={data.slots} sessions={sessionsByDate.get(dayIdx) ?? []} role={role} data={data} />}
                </>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
                    <table className="w-full min-w-[720px] table-fixed border-collapse text-xs">
                        <thead><tr className="bg-muted/50"><th className="w-24 px-2 py-2 text-left">Period</th>
                            {data.days.map(d => <th key={d.date} className={`px-2 py-2 ${d.date === data.today ? 'text-primary' : ''}`}>{DAY_NAMES[d.dayOfWeek].slice(0, 3)}<div className="font-normal text-[10px] text-muted-foreground">{fmtDay(d.date)}</div></th>)}</tr></thead>
                        <tbody>
                            {data.slots.map(slot => (
                                <tr key={slot.id} className={slot.kind === 'PERIOD' ? '' : 'bg-muted/30'}>
                                    <td className="px-2 py-1.5 border-t border-border/50 align-top"><div className="font-semibold">{slot.name}</div><div className="text-[10px] text-muted-foreground">{fmtTime(slot.startMinute)}</div></td>
                                    {data.days.map(d => {
                                        const s = d.sessions.find(x => x.slotId === slot.id);
                                        const b = s ? badge(s, role) : null;
                                        return (
                                            <td key={d.date} className="border-t border-l border-border/50 p-1 align-top h-[60px]">
                                                {s && (
                                                    <div className={`relative h-full rounded-lg bg-muted/40 px-1.5 py-1 border-l-[3px] ${s.status === 'CANCELLED' ? 'opacity-60' : ''}`} style={{ borderLeftColor: s.color ?? 'var(--primary)' }}>
                                                        {s.roomIsLab && <FlaskConical className="absolute bottom-1 right-1 h-3 w-3" style={{ color: s.color ?? 'var(--primary)' }} aria-label="In a lab" />}
                                                        <div className={`font-semibold truncate ${s.status === 'CANCELLED' ? 'line-through' : ''}`}>{title(s)}</div>
                                                        <div className="text-[10px] text-muted-foreground truncate">{(role === 'teacher' ? [s.divisionName, s.roomName] : [s.teacherName, s.roomName]).filter(Boolean).join(' · ')}</div>
                                                        {b && <div className={`mt-0.5 inline-block rounded px-1 text-[9px] font-semibold ${b.cls}`}>{b.text}</div>}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
