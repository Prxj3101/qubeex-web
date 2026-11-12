'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, Settings2, CheckCircle2, Copy, Check, Loader2, X, Lock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useIsHistoricalYear, useYearParams } from '@/context/AcademicYearContext';
import { classDivOf } from '@/components/shared/StudentIdCard';
import { FeesTab, type FeesTabHandle } from '@/app/admin/campus/classes/[standardId]/[divisionId]/fees';
import { PageHeader, EmptyState, ThemedSelect, TERRACOTTA } from '../../payroll/_components/ui';

// Fee Setup (gear button on the Fees page): each class's fee card, the same
// setup that is in the class's Fees tab, so the accountant can set up every
// class from one place.

interface Standard { id: string; name: string; order: number; divisions: { id: string; name: string }[] }

export default function FeeSetupPage() {
    return <Suspense fallback={null}><FeeSetup /></Suspense>;
}

function FeeSetup() {
    const router = useRouter();
    const params = useSearchParams();
    const yearParams = useYearParams();
    const yearKey = yearParams.academicYearId ?? '';
    const [standards, setStandards] = useState<{ key: string; list: Standard[] } | null>(null);
    const feesRef = useRef<FeesTabHandle>(null);
    const historical = useIsHistoricalYear();
    const [copyOpen, setCopyOpen] = useState(false);
    // Same save button as Admissions settings: the setup saves by itself shortly
    // after a change; the button shows the state and saves right away.
    const [status, setStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
    const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wasSaving = useRef(false);
    const onSaving = useCallback((on: boolean) => {
        if (on) { wasSaving.current = true; setStatus('saving'); return; }
        if (!wasSaving.current) return;
        wasSaving.current = false;
        setStatus('saved');
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setStatus(x => (x === 'saved' ? 'idle' : x)), 2000);
    }, []);
    const onEdit = useCallback(() => setStatus(st => (st === 'saving' ? st : 'dirty')), []);
    useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

    useEffect(() => {
        let live = true;
        api.get('/admin/campus/standards', { params: yearKey ? { academicYearId: yearKey } : {} })
            .then(r => { if (live) setStandards({ key: yearKey, list: r.data?.data ?? [] }); })
            .catch(err => { if (live) { setStandards({ key: yearKey, list: [] }); toast.error(getErrorMessage(err, 'Could not load classes')); } });
        return () => { live = false; };
    }, [yearKey]);

    const classes = (standards?.list ?? [])
        .slice().sort((a, b) => a.order - b.order)
        .flatMap(s => s.divisions.map(d => ({ id: d.id, label: classDivOf({ standard: { id: s.id, name: s.name }, division: d }).classDiv })));
    const picked = classes.find(c => c.id === params.get('class')) ?? classes[0] ?? null;
    const loading = standards?.key !== yearKey;

    return (
        <div className="space-y-3">
            <PageHeader title="Fee Setup" subtitle="Each class's fee card: fee structures, months, card design and payment details">
                {loading ? (
                    <div className="h-8 w-36 rounded-lg bg-muted/40 animate-pulse" />
                ) : classes.length > 0 && (
                    <div className="w-36">
                        <ThemedSelect value={picked?.id ?? ''} onChange={id => { wasSaving.current = false; setStatus('idle'); router.replace(`/admin/fees/setup?class=${id}`); }}
                            options={classes.map(c => ({ value: c.id, label: `Class ${c.label}` }))}
                            triggerClassName="!h-9 data-[size=default]:!h-9 rounded-full text-xs font-semibold"
                            className="max-h-72" />
                    </div>
                )}
                {picked && !historical && (
                    <button type="button" onClick={() => setCopyOpen(true)}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold border border-border bg-card hover:bg-muted/50 transition-all shrink-0">
                        <Copy size={13} /> Copy to classes
                    </button>
                )}
                {picked && (
                    <button type="button" onClick={() => feesRef.current?.save()} disabled={status === 'saving' || status === 'idle'}
                        className="flex items-center justify-center gap-1.5 h-9 w-[152px] rounded-full text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
                        style={{ background: status === 'dirty' || status === 'saving' ? TERRACOTTA : '#10b981' }}>
                        {status === 'saving' ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            : status === 'dirty' ? <Save size={13} /> : <CheckCircle2 size={13} />}
                        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'dirty' ? 'Save now' : 'All changes saved'}
                    </button>
                )}
            </PageHeader>

            {!loading && classes.length === 0 && (
                <EmptyState icon={Settings2} title="No classes yet" text="Add classes in Campus first. Then set up each class's fee card here." />
            )}

            {picked && (
                <FeesTab key={picked.id} ref={feesRef} divisionId={picked.id} divisionName={picked.label} feesSubTab="setup" onSavingChange={onSaving} onEdit={onEdit} />
            )}

            <AnimatePresence>
                {copyOpen && picked && (
                    <CopyDialog from={picked} classes={classes} onClose={() => setCopyOpen(false)}
                        beforeCopy={() => feesRef.current?.save() ?? Promise.resolve()} />
                )}
            </AnimatePresence>
        </div>
    );
}

interface SetupState { divisionId: string; months: number; hasPayments: boolean }

/** Copy the open class's fee setup to other classes. Classes where fees are already paid are locked. */
function CopyDialog({ from, classes, onClose, beforeCopy }: {
    from: { id: string; label: string };
    classes: { id: string; label: string }[];
    onClose: () => void;
    beforeCopy: () => Promise<void>;
}) {
    const [status, setStatus] = useState<Map<string, SetupState> | null>(null);
    const [picked, setPicked] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        api.get('/admin/fees/setup/status')
            .then(r => setStatus(new Map((r.data.data as SetupState[]).map(x => [x.divisionId, x]))))
            .catch(err => { toast.error(getErrorMessage(err, 'Could not load classes')); setStatus(new Map()); });
    }, []);
    const others = classes.filter(c => c.id !== from.id);
    const lockedOf = (id: string) => !!status?.get(id)?.hasPayments;
    const open = others.filter(c => !lockedOf(c.id));
    const empty = open.filter(c => !status?.get(c.id));
    const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
    const replacing = picked.filter(id => status?.get(id)).length;

    const copy = async () => {
        setBusy(true);
        try {
            await beforeCopy();
            const r = await api.post('/admin/fees/setup/copy', { fromDivisionId: from.id, toDivisionIds: picked });
            const { copied, skipped } = r.data.data as { copied: string[]; skipped: { divisionId: string; reason: string }[] };
            toast.success(`Fee setup copied to ${copied.length} class${copied.length === 1 ? '' : 'es'}`);
            if (skipped.length) toast.warning(`${skipped.length} class${skipped.length === 1 ? '' : 'es'} skipped: ${skipped[0].reason}`);
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not copy the fee setup'));
            setBusy(false);
        }
    };

    return (
        <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                initial={{ scale: 0.97, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97 }} onClick={e => e.stopPropagation()}>
                <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-base font-bold">Copy {from.label}&apos;s fee setup</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Structures, months, card design, bank and QR, rules. Pick the classes to copy it to.</p>
                    </div>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0"><X size={16} /></button>
                </div>

                {!status ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Checking classes...</div>
                ) : (
                    <>
                        <div className="px-5 pb-2 flex items-center gap-3 text-[11px] font-semibold">
                            {empty.length > 0 && <button type="button" onClick={() => setPicked(empty.map(c => c.id))} className="text-primary hover:underline">Not set up yet ({empty.length})</button>}
                            {open.length > 0 && <button type="button" onClick={() => setPicked(picked.length === open.length ? [] : open.map(c => c.id))} className="text-primary hover:underline">{picked.length === open.length ? 'Clear' : `All (${open.length})`}</button>}
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 grid grid-cols-2 gap-1.5 content-start" style={{ scrollbarWidth: 'thin' }}>
                            {others.map(c => {
                                const st = status.get(c.id);
                                const locked = lockedOf(c.id);
                                const on = picked.includes(c.id);
                                return (
                                    <button key={c.id} type="button" disabled={locked} onClick={() => toggle(c.id)}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${on ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}>
                                        <span className="w-4 h-4 rounded-[5px] border-2 flex items-center justify-center shrink-0"
                                            style={on ? { background: 'var(--primary)', borderColor: 'var(--primary)' } : undefined}>
                                            {on && <Check size={11} strokeWidth={3} className="text-white" />}
                                            {locked && <Lock size={9} className="text-muted-foreground" />}
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm font-semibold">{c.label}</span>
                                            <span className={`block text-[10px] ${locked ? 'text-muted-foreground' : st ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {locked ? 'Fees paid, locked' : st ? 'Set up, will be replaced' : 'Not set up yet'}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="px-5 py-4 border-t border-border/50 space-y-2">
                            {replacing > 0 && <p className="text-[11px] text-amber-600">{replacing} class{replacing === 1 ? '' : 'es'} already set up will get {from.label}&apos;s setup instead.</p>}
                            <button type="button" onClick={copy} disabled={busy || !picked.length}
                                className="w-full h-10 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 disabled:pointer-events-none"
                                style={{ background: TERRACOTTA }}>
                                {busy ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
                                {picked.length ? `Copy to ${picked.length} class${picked.length === 1 ? '' : 'es'}` : 'Pick classes'}
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}
