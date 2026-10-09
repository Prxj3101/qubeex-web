'use client';

import { useState } from 'react';
import { Copy, Eraser, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DAY_NAMES } from '@/lib/timetable';

type Props = {
    open: boolean; onClose: () => void; workingDays: number[]; dayCounts: Map<number, number>;
    onCopy: (fromDay: number, toDays: number[], overwrite: boolean) => Promise<void>;
    onClear: (day: number) => Promise<void>;
};

/** Mounted only while open so every open starts from fresh choices. */
export function DayToolsDialog(props: Props) {
    if (!props.open) return null;
    return <DayTools {...props} />;
}

function DayTools({ onClose, workingDays, dayCounts, onCopy, onClear }: Props) {
    const filled = workingDays.filter(d => (dayCounts.get(d) ?? 0) > 0);
    const [from, setFrom] = useState<number>(filled[0] ?? workingDays[0] ?? 1);
    const [to, setTo] = useState<number[]>([]);
    const [overwrite, setOverwrite] = useState(false);
    const [clearDay, setClearDay] = useState<number>(filled[0] ?? workingDays[0] ?? 1);
    const [busy, setBusy] = useState<'copy' | 'clear' | null>(null);

    const toggle = (d: number) => setTo(t => (t.includes(d) ? t.filter(x => x !== d) : [...t, d]));
    const doCopy = async () => { setBusy('copy'); try { await onCopy(from, to, overwrite); onClose(); } finally { setBusy(null); } };
    const doClear = async () => {
        if (!confirm(`Remove all unlocked sessions on ${DAY_NAMES[clearDay]}?`)) return;
        setBusy('clear'); try { await onClear(clearDay); onClose(); } finally { setBusy(null); }
    };

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-md bg-card">
                <DialogHeader><DialogTitle>Day tools</DialogTitle></DialogHeader>

                <section className="space-y-3">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Copy className="w-4 h-4" /> Copy a day</h3>
                    <p className="text-xs text-muted-foreground">Repeat one day&apos;s schedule on other days. Locked sessions are never overwritten.</p>
                    <label className="block text-xs font-medium text-muted-foreground">Copy from
                        <select className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" value={from} onChange={e => { setFrom(Number(e.target.value)); setTo(t => t.filter(x => x !== Number(e.target.value))); }}>
                            {workingDays.map(d => <option key={d} value={d}>{DAY_NAMES[d]} ({dayCounts.get(d) ?? 0} sessions)</option>)}
                        </select>
                    </label>
                    <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Paste onto</div>
                        <div className="flex flex-wrap gap-1.5">
                            {workingDays.filter(d => d !== from).map(d => (
                                <button key={d} type="button" onClick={() => toggle(d)} className={`rounded-lg border px-2.5 py-1 text-xs ${to.includes(d) ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground'}`}>{DAY_NAMES[d].slice(0, 3)}</button>
                            ))}
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} /> Replace existing sessions on those days</label>
                    <button type="button" disabled={!to.length || busy !== null || !(dayCounts.get(from) ?? 0)} onClick={() => void doCopy()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                        {busy === 'copy' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Copy day
                    </button>
                </section>

                <hr className="border-border/60" />

                <section className="space-y-3">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Eraser className="w-4 h-4" /> Clear a day</h3>
                    <div className="flex gap-2">
                        <select className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" value={clearDay} onChange={e => setClearDay(Number(e.target.value))}>
                            {workingDays.map(d => <option key={d} value={d}>{DAY_NAMES[d]} ({dayCounts.get(d) ?? 0} sessions)</option>)}
                        </select>
                        <button type="button" disabled={busy !== null || !(dayCounts.get(clearDay) ?? 0)} onClick={() => void doClear()} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50">
                            {busy === 'clear' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Clear
                        </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">You can undo this from the toolbar.</p>
                </section>
            </DialogContent>
        </Dialog>
    );
}
