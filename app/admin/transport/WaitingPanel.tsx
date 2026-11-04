'use client';

import { useMemo, useState } from 'react';
import NextImage from 'next/image';
import { Check, Hourglass, Loader2, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { EmptyState, PageHeader, Pill, PrimaryButton, SecondaryButton, SmallButton, ThemedSelect } from '@/app/admin/payroll/_components/ui';
import { TransportArt } from './TransportArt';
import type { Bus, Shift, TransportRoute } from './types';

// Students who need the school bus but don't have one yet:
//  • ADMISSION: the parent said "yes" to the school bus on the admission form
//  • FEE_CARD:  bus was turned on in the fee card before buses were linked
// Give one or many of them a bus + stop here (same as adding them on the bus).
export interface WaitingStudent {
    studentId: string;
    divisionId: string | null;
    admissionNo: string;
    name: string;
    className: string;
    rollNo: string | null;
    avatarUrl: string | null;
    reason: 'ADMISSION' | 'FEE_CARD';
    note: string;
}

// same initials avatar as the class / fee screens
const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

export function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
    return (
        <span className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
            style={{ width: size, height: size, background: url ? 'transparent' : AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length] }}>
            {url ? <NextImage src={url} alt={name} fill sizes="96px" quality={95} className="object-cover" /> : initials(name)}
        </span>
    );
}

const card = 'rounded-2xl bg-card shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)]';

export default function WaitingPanel({ waiting, buses, routes, onChanged }: {
    waiting: WaitingStudent[] | null;
    buses: Bus[];
    routes: TransportRoute[];
    onChanged: () => void;
}) {
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [giveTo, setGiveTo] = useState<WaitingStudent[] | null>(null);
    const [busId, setBusId] = useState('');
    const [stopId, setStopId] = useState('');
    const [shift, setShift] = useState<Shift>('MORNING');
    const [saving, setSaving] = useState(false);
    const [notNeeded, setNotNeeded] = useState<WaitingStudent | null>(null);
    const [removing, setRemoving] = useState(false);
    // Which fee months carry the bus fee (only when everyone picked is in the same class,
    // since each class has its own fee months). null = loading / not shown.
    const [feeMonths, setFeeMonths] = useState<{ id: string; month: string; due: boolean; paid: boolean }[] | null>(null);
    const [months, setMonths] = useState<string[]>([]);
    const [monthsNote, setMonthsNote] = useState('');

    const list = useMemo(() => waiting ?? [], [waiting]);
    const allPicked = list.length > 0 && list.every(w => picked.has(w.studentId));
    const toggle = (id: string) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    const bus = buses.find(b => b.id === busId) ?? null;
    const stops = routes.find(r => r.id === bus?.routeId)?.stops ?? [];

    const open = (students: WaitingStudent[]) => {
        const first = buses[0];
        setBusId(first?.id ?? '');
        setStopId('');
        setShift(first && !first.morningShift ? 'AFTERNOON' : 'MORNING');
        setGiveTo(students);
        setFeeMonths(null);
        setMonths([]);
        setMonthsNote('');
        const classes = new Set(students.map(s => s.divisionId ?? ''));
        if (classes.size > 1) { setMonthsNote('They are in different classes, so the bus fee starts from each class\'s next due month. Change months later in their fee cards.'); return; }
        api.get(`/admin/transport/students/${students[0].studentId}/fee-months`)
            .then(res => {
                const d = res.data.data as { months: { id: string; month: string; due: boolean; paid: boolean }[]; selected: string[] };
                setFeeMonths(d.months);
                setMonths(d.selected);
                if (!d.months.length) setMonthsNote('No fee months set up for this class yet. The bus fee can be set later in the fee card.');
            })
            .catch(() => setMonthsNote('Could not load the fee months. The bus fee starts from the next due month.'));
    };

    const give = async () => {
        if (!giveTo || saving) return;
        if (!busId) { toast.error('Pick a bus'); return; }
        setSaving(true);
        let done = 0;
        try {
            for (const w of giveTo) {
                await api.put(`/admin/transport/students/${w.studentId}`, { busId, stopId: stopId || null, shift, ...(feeMonths?.length ? { months } : {}) });
                done++;
            }
            toast.success(`${done === 1 ? giveTo[0].name || '1 student' : `${done} students`} put on ${bus?.name ?? 'the bus'}`);
            setGiveTo(null);
            setPicked(new Set());
        } catch (err) {
            toast.error(getErrorMessage(err, done ? `Saved ${done}, then something went wrong` : 'Could not give the bus'));
        } finally {
            setSaving(false);
            onChanged();
        }
    };

    const removeFromList = async () => {
        if (!notNeeded) return;
        setRemoving(true);
        try {
            await api.delete(`/admin/transport/waiting/${notNeeded.studentId}`);
            toast.success('Taken off the waiting list');
            setNotNeeded(null);
            onChanged();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not update')); }
        finally { setRemoving(false); }
    };

    return <>
        <div className="flex-1 min-h-0 overflow-y-auto visible-scrollbar px-1 pb-6 space-y-3">
            <PageHeader title="Waiting list" subtitle="Students who need the school bus but haven't been given one yet">
                {picked.size > 0 && <PrimaryButton onClick={() => open(list.filter(w => picked.has(w.studentId)))}>Give bus to {picked.size}</PrimaryButton>}
            </PageHeader>

            {!waiting
                ? <div className="flex justify-center py-16"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
                : !list.length
                    ? <EmptyState icon={Hourglass} title="No one is waiting" text="Students who ask for the school bus at admission show up here, ready to be given a bus and stop." />
                    : <section className={`${card} overflow-hidden`} data-admin-surface="">
                        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <button type="button" aria-label={allPicked ? 'Unselect all' : 'Select all'} onClick={() => setPicked(allPicked ? new Set() : new Set(list.map(w => w.studentId)))}
                                className={`grid h-4 w-4 place-items-center rounded border ${allPicked ? 'border-primary bg-primary text-white' : 'border-border'}`}>
                                {allPicked && <Check size={11} />}
                            </button>
                            <span>{list.length} {list.length === 1 ? 'student' : 'students'}</span>
                        </div>
                        <ul className="divide-y divide-border/50">
                            {list.map(w => {
                                const on = picked.has(w.studentId);
                                return (
                                    <li key={w.studentId} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${on ? 'bg-primary/5' : ''}`}>
                                        <button type="button" aria-label={on ? `Unselect ${w.name}` : `Select ${w.name}`} onClick={() => toggle(w.studentId)}
                                            className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? 'border-primary bg-primary text-white' : 'border-border'}`}>
                                            {on && <Check size={11} />}
                                        </button>
                                        <Avatar name={w.name || w.admissionNo} url={w.avatarUrl} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold truncate">{w.name || w.admissionNo}</p>
                                            <p className="text-[11px] text-muted-foreground truncate">
                                                {w.className || 'No class'}{w.rollNo ? ` · Roll ${w.rollNo}` : ''} · <span className="font-mono" style={{ color: '#DA7756' }}>{w.admissionNo}</span>
                                            </p>
                                        </div>
                                        <div className="flex min-w-0 flex-col items-start gap-0.5 sm:w-56">
                                            {w.reason === 'ADMISSION' ? <Pill tone="blue">Asked at admission</Pill> : <Pill tone="amber">From fee card</Pill>}
                                            {w.note && <span className="max-w-full truncate text-[11px] text-muted-foreground" title={w.note}>{w.reason === 'ADMISSION' ? `Pickup: ${w.note}` : w.note}</span>}
                                        </div>
                                        <div className="flex shrink-0 gap-1">
                                            <SmallButton onClick={() => open([w])}><TransportArt kind="bus" size={16} />Give bus</SmallButton>
                                            <SmallButton onClick={() => setNotNeeded(w)} aria-label={`${w.name} doesn't need a bus`} title="Doesn't need a bus" className="text-red-600"><UserMinus size={12} /></SmallButton>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>}
        </div>

        <Dialog open={!!giveTo} onOpenChange={o => { if (!o && !saving) setGiveTo(null); }}>
            <DialogContent className="sm:max-w-md bg-card">
                <DialogHeader>
                    <DialogTitle>{giveTo?.length === 1 ? `Bus for ${giveTo[0].name || giveTo[0].admissionNo}` : `Bus for ${giveTo?.length ?? 0} students`}</DialogTitle>
                    <DialogDescription>Their fee card gets the bus too, with the stop&apos;s monthly fee.</DialogDescription>
                </DialogHeader>
                {!buses.length
                    ? <p className="text-sm text-muted-foreground">No buses yet. Add one in the Buses tab first.</p>
                    : <div className="space-y-3">
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">Bus</span>
                            <ThemedSelect value={busId} placeholder="Pick a bus"
                                options={buses.map(b => ({ value: b.id, label: `${b.name}${b.route ? ` · ${b.route.name}` : ' · no route yet'}` }))}
                                onChange={v => {
                                    const next = buses.find(b => b.id === v);
                                    setBusId(v);
                                    setStopId('');
                                    if (next && !next.afternoonShift) setShift('MORNING');
                                    else if (next && !next.morningShift) setShift('AFTERNOON');
                                }} />
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">Stop</span>
                            {stops.length
                                ? <ThemedSelect value={stopId} placeholder="Pick the stop"
                                    options={stops.map((s, i) => ({ value: s.id as string, label: `${i + 1}. ${s.name}${s.monthlyFee != null ? ` · ₹${s.monthlyFee.toLocaleString('en-IN')}/month` : ''}` }))}
                                    onChange={setStopId} />
                                : <p className="text-xs text-muted-foreground">This bus has no route or stops yet. Add them in Routes &amp; stops.</p>}
                            {giveTo && giveTo.length > 1 && <p className="text-[11px] text-muted-foreground">Everyone picked gets this stop. Give different stops one by one.</p>}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground">Bus fee months</span>
                                {!!feeMonths?.length && <button type="button" className="text-[11px] font-semibold text-primary hover:underline"
                                    onClick={() => setMonths(months.length === feeMonths.length ? [] : feeMonths.map(m => m.id))}>
                                    {months.length === feeMonths.length ? 'Deselect all' : 'Select all'}
                                </button>}
                            </div>
                            {monthsNote ? <p className="text-[11px] text-muted-foreground">{monthsNote}</p>
                                : !feeMonths ? <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 size={12} className="animate-spin" />Loading months...</div>
                                    : <>
                                        <div className="flex flex-wrap gap-1.5">
                                            {feeMonths.map(m => {
                                                const on = months.includes(m.id);
                                                return (
                                                    <button key={m.id} type="button" onClick={() => setMonths(on ? months.filter(x => x !== m.id) : [...months, m.id])}
                                                        title={m.paid ? 'Already paid' : m.due ? 'Already due' : undefined}
                                                        className={`flex h-7 items-center gap-1 rounded-xl border-2 px-2.5 text-[11px] font-semibold transition-all ${on ? 'border-[#0891B2] bg-[#0891B2]/10 text-[#0891B2]' : 'border-border text-muted-foreground'}`}>
                                                        {on && <Check size={10} />}{m.month}{(m.paid || m.due) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">Months still to come are ticked. <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" /> already due or paid.</p>
                                    </>}
                        </div>
                        {bus?.morningShift && bus.afternoonShift && (
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-muted-foreground">Shift</span>
                                <div className="flex gap-1.5">
                                    {(['MORNING', 'AFTERNOON'] as const).map(sh => (
                                        <button key={sh} type="button" onClick={() => setShift(sh)}
                                            className={`flex-1 h-8 rounded-xl border-2 text-xs font-semibold transition-all ${shift === sh ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                                            {sh === 'MORNING' ? '🌅 Morning' : '☀️ Afternoon'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>}
                <div className="flex justify-end gap-2 pt-1">
                    <SecondaryButton onClick={() => setGiveTo(null)} disabled={saving}>Cancel</SecondaryButton>
                    {!!buses.length && <PrimaryButton onClick={give} disabled={saving}>{saving && <Loader2 size={13} className="animate-spin" />}Give bus</PrimaryButton>}
                </div>
            </DialogContent>
        </Dialog>

        <DeleteConfirmDialog
            open={!!notNeeded}
            onOpenChange={o => { if (!o) setNotNeeded(null); }}
            confirmLabel="Remove"
            label="from waiting list"
            name={notNeeded?.name || notNeeded?.admissionNo || ''}
            description={notNeeded?.reason === 'FEE_CARD'
                ? 'They don\'t need the bus: it is turned off on their fee card. Months already due or paid keep their bus fee.'
                : 'They don\'t need the school bus after all. You can still give them a bus later from the bus or their fee card.'}
            loading={removing}
            onConfirm={removeFromList}
        />
    </>;
}
