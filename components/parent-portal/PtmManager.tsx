'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, CalendarClock, CalendarX2, Clock, MapPin, Plus, UserRound, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EmptyState, ListSkeleton, PanelHeader, Pill, Progress, StatTile } from './ui';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface TeacherSession {
    id: string;
    title: string;
    date: string;
    startMinute: number;
    endMinute: number;
    slotMinutes: number;
    location: string | null;
    note: string | null;
    cancelled: boolean;
    upcoming: boolean;
    booked: number;
    slots: { id: string; startMinute: number; endMinute: number; student: { id: string; name: string; rollNo: string | null; className: string | null } | null }[];
}

interface AdminSession {
    id: string;
    title: string;
    teacherName: string;
    date: string;
    startMinute: number;
    endMinute: number;
    location: string | null;
    cancelled: boolean;
    totalSlots: number;
    booked: number;
}

const clock = (minute: number) => {
    const h = Math.floor(minute / 60);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(minute % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const dateParts = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00+05:30`);
    return { day: d.toLocaleDateString([], { day: 'numeric' }), mon: d.toLocaleDateString([], { month: 'short' }).toUpperCase() };
};
function DateTile({ date, dim }: { date: string; dim?: boolean }) {
    const { day, mon } = dateParts(date);
    return (
        <span className={cn('inline-flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-white bg-gradient-to-br', dim ? 'from-muted-foreground/70 to-muted-foreground/40' : 'from-primary to-primary/65')}>
            <span className="text-base font-bold leading-4">{day}</span>
            <span className="text-[9px] font-semibold tracking-wider opacity-85">{mon}</span>
        </span>
    );
}
const pretty = (dateStr: string) => new Date(`${dateStr}T00:00:00+05:30`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Parent-teacher meeting slots. Teachers publish and manage; admins get a read-only overview. */
export function PtmManager({ mode }: { mode: 'teacher' | 'admin' }) {
    return mode === 'teacher' ? <TeacherPtm /> : <AdminPtm />;
}

function AdminPtm() {
    const [sessions, setSessions] = useState<AdminSession[] | null>(null);
    useEffect(() => {
        api.get<{ data: AdminSession[] }>('/admin/ptm/sessions')
            .then(r => setSessions(r.data.data))
            .catch(err => { toast.error(getErrorMessage(err, 'Could not load meetings')); setSessions([]); });
    }, []);
    return (
        <div className="rounded-2xl border border-border bg-card h-full min-h-0 flex flex-col" data-dashboard-surface="">
            <PanelHeader icon={CalendarClock} title="Upcoming parent-teacher meetings" subtitle={sessions ? `${sessions.filter(x => !x.cancelled).length} scheduled` : undefined} />
            <div className="flex-1 min-h-0 overflow-y-auto">
                {sessions === null ? <ListSkeleton /> : sessions.length === 0 ? (
                    <EmptyState icon={CalendarClock} title="No upcoming meetings" text="Meetings published by teachers will show up here." />
                ) : sessions.map(s => (
                    <div key={s.id} className={cn('flex items-center gap-3 px-4 py-3 border-b border-border/60 last:border-b-0', s.cancelled && 'opacity-50')}>
                        <DateTile date={s.date} dim={s.cancelled} />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{s.title}</p>
                                {s.cancelled && <Pill tone="bad">Cancelled</Pill>}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                                <span className="inline-flex items-center gap-1"><UserRound size={11} />{s.teacherName}</span>
                                <span className="inline-flex items-center gap-1"><Clock size={11} />{clock(s.startMinute)}–{clock(s.endMinute)}</span>
                                {s.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{s.location}</span>}
                            </p>
                        </div>
                        <div className="w-28 shrink-0">
                            <p className="text-xs font-semibold text-right">{s.booked}/{s.totalSlots} booked</p>
                            <Progress value={s.booked} total={s.totalSlots} tone={s.totalSlots > 0 && s.booked >= s.totalSlots ? 'bg-emerald-500' : 'bg-primary'} className="mt-1" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TeacherPtm() {
    const confirm = useConfirm();
    const [sessions, setSessions] = useState<TeacherSession[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await api.get<{ data: TeacherSession[] }>('/teacher/ptm/sessions');
            setSessions(res.data.data);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not load meetings')); }
        finally { setLoaded(true); }
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(load, 30_000);
        return () => clearInterval(id);
    }, [load]);

    const active = sessions.find(s => s.id === activeId) ?? null;

    const release = async (slotId: string, name: string) => {
        const ok = await confirm({
            title: 'Release this slot?',
            message: `${name} will be notified and can book another.`,
            confirmLabel: 'Release slot',
            tone: 'warning',
            icon: CalendarX2,
        });
        if (!ok) return;
        try { await api.patch(`/teacher/ptm/slots/${slotId}/release`); await load(); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not release the slot')); }
    };

    const cancel = async (id: string) => {
        const ok = await confirm({
            title: 'Cancel this meeting?',
            message: 'Parents with a booking will be notified.',
            confirmLabel: 'Cancel meeting',
            cancelLabel: 'Keep it',
            tone: 'danger',
            icon: CalendarX2,
        });
        if (!ok) return;
        try { await api.delete(`/teacher/ptm/sessions/${id}`); await load(); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not cancel the meeting')); }
    };

    const upcoming = sessions.filter(x => x.upcoming && !x.cancelled).length;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-3 h-full min-h-0">
            <div className="rounded-2xl border border-border bg-card flex flex-col min-h-0" data-dashboard-surface="">
                <PanelHeader
                    icon={CalendarClock}
                    title="Meetings"
                    subtitle={sessions.length ? `${upcoming} upcoming · ${sessions.length} total` : 'Publish slots for parents'}
                    action={<Button size="sm" className="gap-1" onClick={() => { setCreating(true); setActiveId(null); }}><Plus size={14} /> New</Button>}
                />
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {!loaded ? <ListSkeleton /> : sessions.length === 0 ? (
                        <EmptyState icon={CalendarClock} title="No meetings yet" text="Publish time slots and parents of your students can book one from Parent Mode." />
                    ) : sessions.map(s => {
                        const dim = s.cancelled || !s.upcoming;
                        return (
                            <button
                                key={s.id}
                                onClick={() => { setActiveId(s.id); setCreating(false); }}
                                className={cn('w-full text-left px-4 py-3 border-b border-border/60 flex items-center gap-3 hover:bg-muted/50 transition-colors', s.id === activeId && 'bg-primary/8', dim && 'opacity-70')}
                            >
                                <DateTile date={s.date} dim={dim} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-medium truncate">{s.title}</p>
                                        {s.cancelled ? <Pill tone="bad">Cancelled</Pill> : !s.upcoming ? <Pill tone="muted">Past</Pill> : null}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{clock(s.startMinute)}–{clock(s.endMinute)}{s.location ? ` · ${s.location}` : ''}</p>
                                    <Progress value={s.booked} total={s.slots.length} tone={s.slots.length > 0 && s.booked >= s.slots.length ? 'bg-emerald-500' : 'bg-primary'} className="mt-1.5" />
                                    <p className="text-[11px] text-muted-foreground mt-1">{s.booked} of {s.slots.length} booked</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-card min-h-0 overflow-y-auto" data-dashboard-surface="">
                {creating ? (
                    <NewSession onDone={() => { setCreating(false); load(); }} />
                ) : !active ? (
                    <EmptyState icon={Users} title="Pick a meeting" text="Select a meeting on the left to see who booked, or publish new slots." />
                ) : (
                    <div className="flex flex-col">
                        <PanelHeader
                            icon={CalendarCheck}
                            title={active.title}
                            subtitle={`${pretty(active.date)} · ${clock(active.startMinute)}–${clock(active.endMinute)} · ${active.slotMinutes} min each${active.location ? ` · ${active.location}` : ''}`}
                            action={!active.cancelled && active.upcoming ? <Button size="sm" variant="outline" className="text-red-600 border-red-500/40 hover:bg-red-500/10" onClick={() => cancel(active.id)}>Cancel meeting</Button> : undefined}
                        />
                        <div className="p-4 flex flex-col gap-4">
                            {active.note && <p className="text-sm rounded-xl bg-primary/8 px-3 py-2">{active.note}</p>}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <StatTile icon={CalendarCheck} tone="good" label="Booked" value={active.booked} />
                                <StatTile icon={Clock} tone="primary" label="Free" value={active.slots.length - active.booked} />
                                <StatTile icon={Users} tone="warn" label="Total slots" value={active.slots.length} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                {active.slots.map(sl => (
                                    <div key={sl.id} className={cn('rounded-xl border p-3 flex items-center gap-3', sl.student ? 'border-primary/30 bg-primary/8' : 'border-dashed border-border')}>
                                        <div className="shrink-0 text-center w-16">
                                            <p className="text-xs font-bold">{clock(sl.startMinute)}</p>
                                            <p className="text-[10px] text-muted-foreground">{clock(sl.endMinute)}</p>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            {sl.student ? (
                                                <>
                                                    <p className="text-sm font-medium truncate">Parent of {sl.student.name}</p>
                                                    <p className="text-[11px] text-muted-foreground truncate">{sl.student.className ?? ''}{sl.student.rollNo ? ` · Roll ${sl.student.rollNo}` : ''}</p>
                                                </>
                                            ) : <p className="text-sm text-muted-foreground">Free</p>}
                                        </div>
                                        {sl.student && !active.cancelled && active.upcoming && (
                                            <button className="text-[11px] font-semibold text-red-600 hover:underline shrink-0" onClick={() => release(sl.id, sl.student!.name)}>Release</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function NewSession({ onDone }: { onDone: () => void }) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [title, setTitle] = useState('Parent-teacher meeting');
    const [date, setDate] = useState(`${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`);
    const [startTime, setStartTime] = useState('10:00');
    const [endTime, setEndTime] = useState('12:00');
    const [slotMinutes, setSlotMinutes] = useState(15);
    const [location, setLocation] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const slots = toMin(endTime) > toMin(startTime) ? Math.floor((toMin(endTime) - toMin(startTime)) / slotMinutes) : 0;

    const submit = async () => {
        if (saving || slots < 1) return;
        setSaving(true);
        try {
            await api.post('/teacher/ptm/sessions', { title: title.trim() || 'Parent-teacher meeting', date, startTime, endTime, slotMinutes, location: location.trim() || undefined, note: note.trim() || undefined });
            toast.success('Slots published — parents have been notified');
            onDone();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not publish the meeting')); }
        finally { setSaving(false); }
    };

    const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';
    return (
        <div className="p-4 flex flex-col gap-3 max-w-xl">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">New meeting</h2>
                <button onClick={onDone} aria-label="Close"><X size={16} /></button>
            </div>
            <input className={field} value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Title" />
            <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">Date<input type="date" className={field} value={date} onChange={e => setDate(e.target.value)} /></label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">From<input type="time" className={field} value={startTime} onChange={e => setStartTime(e.target.value)} /></label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">To<input type="time" className={field} value={endTime} onChange={e => setEndTime(e.target.value)} /></label>
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Minutes per parent
                <select className={cn(field, 'w-auto')} value={slotMinutes} onChange={e => setSlotMinutes(Number(e.target.value))}>
                    {[10, 15, 20, 30].map(m => <option key={m} value={m}>{m} minutes</option>)}
                </select>
            </label>
            <p className={cn('text-xs', slots > 0 ? 'text-muted-foreground' : 'text-red-600')}>{slots > 0 ? `${slots} slots will be created` : 'The end time must be after the start time'}</p>
            <input className={field} value={location} onChange={e => setLocation(e.target.value)} maxLength={100} placeholder="Location, e.g. Room 4 (optional)" />
            <textarea className={field} rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="Note for parents (optional)" />
            <Button onClick={submit} disabled={saving || slots < 1}>Publish slots</Button>
        </div>
    );
}
