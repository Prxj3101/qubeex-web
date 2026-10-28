'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
        <div className="rounded-2xl border border-border bg-card overflow-x-auto" data-dashboard-surface="">
            <p className="px-4 py-3 text-sm font-semibold border-b border-border flex items-center gap-2"><CalendarClock size={15} /> Upcoming parent-teacher meetings</p>
            {sessions === null ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : sessions.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No upcoming meetings.</p>
            ) : (
                <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-muted-foreground"><th className="px-4 py-2">Teacher</th><th>Meeting</th><th>When</th><th>Location</th><th>Booked</th></tr></thead>
                    <tbody>
                        {sessions.map(s => (
                            <tr key={s.id} className={cn('border-t border-border/60', s.cancelled && 'opacity-50 line-through')}>
                                <td className="px-4 py-2">{s.teacherName}</td>
                                <td>{s.title}</td>
                                <td>{pretty(s.date)} · {clock(s.startMinute)}–{clock(s.endMinute)}</td>
                                <td className="text-muted-foreground">{s.location ?? '—'}</td>
                                <td className="font-medium">{s.booked}/{s.totalSlots}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

function TeacherPtm() {
    const [sessions, setSessions] = useState<TeacherSession[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await api.get<{ data: TeacherSession[] }>('/teacher/ptm/sessions');
            setSessions(res.data.data);
        } catch (err) { toast.error(getErrorMessage(err, 'Could not load meetings')); }
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(load, 30_000);
        return () => clearInterval(id);
    }, [load]);

    const active = sessions.find(s => s.id === activeId) ?? null;

    const release = async (slotId: string, name: string) => {
        if (!window.confirm(`Release this slot? ${name} will be notified and can book another.`)) return;
        try { await api.patch(`/teacher/ptm/slots/${slotId}/release`); await load(); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not release the slot')); }
    };

    const cancel = async (id: string) => {
        if (!window.confirm('Cancel this meeting? Parents with a booking will be notified.')) return;
        try { await api.delete(`/teacher/ptm/sessions/${id}`); await load(); }
        catch (err) { toast.error(getErrorMessage(err, 'Could not cancel the meeting')); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3">
            <div className="rounded-2xl border border-border bg-card overflow-y-auto max-h-[70vh]" data-dashboard-surface="">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold">Meetings</p>
                    <Button size="sm" className="gap-1" onClick={() => { setCreating(true); setActiveId(null); }}><Plus size={14} /> New</Button>
                </div>
                {sessions.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No meetings yet.</p> : sessions.map(s => (
                    <button
                        key={s.id}
                        onClick={() => { setActiveId(s.id); setCreating(false); }}
                        className={cn('w-full text-left px-4 py-3 border-b border-border/60 hover:bg-muted/50', s.id === activeId && 'bg-muted/60', (s.cancelled || !s.upcoming) && 'opacity-60')}
                    >
                        <p className="text-sm font-medium truncate">{s.title}{s.cancelled ? ' · Cancelled' : ''}</p>
                        <p className="text-xs text-muted-foreground">{pretty(s.date)} · {clock(s.startMinute)}–{clock(s.endMinute)}</p>
                        <p className="text-xs text-primary">{s.booked} of {s.slots.length} booked</p>
                    </button>
                ))}
            </div>

            <div className="rounded-2xl border border-border bg-card max-h-[70vh] overflow-y-auto" data-dashboard-surface="">
                {creating ? (
                    <NewSession onDone={() => { setCreating(false); load(); }} />
                ) : !active ? (
                    <div className="p-6 text-sm text-muted-foreground text-center">Select a meeting to see who booked, or publish new slots.</div>
                ) : (
                    <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-base font-semibold">{active.title}</h2>
                                <p className="text-xs text-muted-foreground">{pretty(active.date)} · {clock(active.startMinute)}–{clock(active.endMinute)} · {active.slotMinutes} min each{active.location ? ` · ${active.location}` : ''}</p>
                                {active.note && <p className="text-sm mt-1">{active.note}</p>}
                            </div>
                            {!active.cancelled && active.upcoming && <Button size="sm" variant="outline" onClick={() => cancel(active.id)}>Cancel meeting</Button>}
                        </div>
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Time</th><th>Parent of</th><th>Class</th><th /></tr></thead>
                            <tbody>
                                {active.slots.map(sl => (
                                    <tr key={sl.id} className="border-t border-border/60">
                                        <td className="py-1.5 font-medium">{clock(sl.startMinute)}</td>
                                        <td className={sl.student ? '' : 'text-muted-foreground'}>{sl.student ? sl.student.name : 'Free'}</td>
                                        <td className="text-muted-foreground">{sl.student?.className ?? ''}</td>
                                        <td className="text-right">
                                            {sl.student && !active.cancelled && active.upcoming && (
                                                <button className="text-xs text-red-600 hover:underline" onClick={() => release(sl.id, sl.student!.name)}>Release</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
