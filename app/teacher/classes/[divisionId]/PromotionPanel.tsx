'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Trophy, RotateCcw, GraduationCap, LogOut as LeaveIcon, History } from 'lucide-react';

export type PromotionOutcomeChoice = 'PROMOTED' | 'REPEATED' | 'GRADUATED' | 'WITHDRAWN';

export interface PreviewStudent { id: string; studentId: string; name: string | null; rollNo: string | null }
export interface PreviewTarget { divisionId: string; name: string; currentHeadcount: number; capacity: number | null }
export interface PreviewData {
    sourceDivision: { id: string; name: string; standardName: string };
    students: PreviewStudent[];
    isHighestStandard: boolean;
    targets: PreviewTarget[];
}
export interface BatchSummary {
    id: string;
    academicYear: string;
    createdAt: string;
    undoneAt: string | null;
    fromStandard: { name: string };
    fromDivision: { name: string };
    toDivision: { name: string } | null;
    counts: { promoted: number; repeated: number; graduated: number; withdrawn: number };
}

interface PromotionPanelProps {
    divisionId: string;
    fetchPreview: () => Promise<PreviewData>;
    fetchBatches: () => Promise<BatchSummary[]>;
    submitOutcomes: (outcomes: { studentId: string; outcome: PromotionOutcomeChoice }[], targetDivisionId?: string) => Promise<{ warning?: string }>;
    undoBatch: (batchId: string) => Promise<void>;
}

const OUTCOME_OPTIONS: { key: PromotionOutcomeChoice; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: 'PROMOTED', label: 'Promote', icon: Trophy },
    { key: 'REPEATED', label: 'Repeat', icon: RotateCcw },
    { key: 'GRADUATED', label: 'Graduate', icon: GraduationCap },
    { key: 'WITHDRAWN', label: 'Leaving', icon: LeaveIcon },
];

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isWithin48h(iso: string) {
    return Date.now() - new Date(iso).getTime() < 48 * 60 * 60 * 1000;
}

export default function PromotionPanel({ divisionId, fetchPreview, fetchBatches, submitOutcomes, undoBatch }: PromotionPanelProps) {
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [batches, setBatches] = useState<BatchSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [choices, setChoices] = useState<Record<string, PromotionOutcomeChoice>>({});
    const [targetDivisionId, setTargetDivisionId] = useState<string>('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [undoingId, setUndoingId] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        Promise.all([fetchPreview(), fetchBatches()])
            .then(([p, b]) => {
                setPreview(p);
                setBatches(b);
                const defaults: Record<string, PromotionOutcomeChoice> = {};
                for (const s of p.students) defaults[s.id] = p.isHighestStandard ? 'GRADUATED' : 'PROMOTED';
                setChoices(defaults);
                if (p.targets.length > 0) setTargetDivisionId(p.targets[0].divisionId);
            })
            .catch(() => toast.error('Failed to load promotion data'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [divisionId]);

    if (loading) {
        return <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Loading...</div>;
    }
    if (!preview) {
        return <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Could not load promotion data.</div>;
    }

    const hasPromoted = Object.values(choices).some(c => c === 'PROMOTED');
    const counts = { promoted: 0, repeated: 0, graduated: 0, withdrawn: 0 };
    for (const c of Object.values(choices)) {
        if (c === 'PROMOTED') counts.promoted++;
        else if (c === 'REPEATED') counts.repeated++;
        else if (c === 'GRADUATED') counts.graduated++;
        else counts.withdrawn++;
    }

    const canSubmit = preview.students.length > 0 && (!hasPromoted || !!targetDivisionId);

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            const outcomes = preview.students.map(s => ({ studentId: s.id, outcome: choices[s.id] }));
            const result = await submitOutcomes(outcomes, hasPromoted ? targetDivisionId : undefined);
            toast.success('Promotion applied');
            if (result.warning) toast.warning(result.warning);
            setShowConfirm(false);
            load();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            toast.error(e?.response?.data?.error ?? 'Failed to apply promotion');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUndo = async (batchId: string) => {
        setUndoingId(batchId);
        try {
            await undoBatch(batchId);
            toast.success('Promotion undone');
            load();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            toast.error(e?.response?.data?.error ?? 'Failed to undo');
        } finally {
            setUndoingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                    <p className="text-sm font-bold">{preview.sourceDivision.standardName} - {preview.sourceDivision.name} — {preview.students.length} active students</p>
                    {preview.targets.length > 0 && hasPromoted && (
                        <select value={targetDivisionId} onChange={e => setTargetDivisionId(e.target.value)}
                            className="h-8 px-2 rounded-lg border border-border/50 bg-background text-xs">
                            {preview.targets.map(t => (
                                <option key={t.divisionId} value={t.divisionId}>
                                    {t.name} — {t.currentHeadcount}/{t.capacity ?? '∞'}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {preview.students.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No active students in this division.</p>
                ) : (
                    <>
                        {preview.targets.length === 0 && !preview.isHighestStandard && (
                            <p className="text-[11px] text-amber-600 px-4 pt-3">No target division set up for the next standard yet — contact your admin.</p>
                        )}
                        <div className="divide-y divide-border/30">
                            {preview.students.map(s => (
                                <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                        <p className="text-xs font-semibold">{s.name ?? '—'}</p>
                                        <p className="text-[10px] text-muted-foreground">{s.studentId}{s.rollNo ? ` · Roll ${s.rollNo}` : ''}</p>
                                    </div>
                                    <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/40">
                                        {OUTCOME_OPTIONS.map(opt => {
                                            const isActive = choices[s.id] === opt.key;
                                            return (
                                                <button key={opt.key}
                                                    onClick={() => setChoices(prev => ({ ...prev, [s.id]: opt.key }))}
                                                    className={`px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-all ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                    <opt.icon size={11} /> {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-4 py-3 border-t border-border/40 flex justify-end">
                            <button onClick={() => setShowConfirm(true)} disabled={!canSubmit}
                                className="h-8 px-4 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                Review &amp; Promote
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
                    <History size={13} className="text-muted-foreground" />
                    <p className="text-xs font-semibold">Promotion History</p>
                </div>
                {batches.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No promotions yet.</p>
                ) : (
                    <div className="divide-y divide-border/30">
                        {batches.map(b => (
                            <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                                <div>
                                    <p className="text-xs font-medium">
                                        {b.fromStandard.name} {b.fromDivision.name} → {b.toDivision ? b.toDivision.name : '—'}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {formatDate(b.createdAt)} · {b.counts.promoted} promoted · {b.counts.repeated} repeated · {b.counts.graduated} graduated · {b.counts.withdrawn} leaving
                                    </p>
                                </div>
                                {b.undoneAt ? (
                                    <span className="text-[10px] text-muted-foreground">Undone</span>
                                ) : isWithin48h(b.createdAt) ? (
                                    <button onClick={() => handleUndo(b.id)} disabled={undoingId === b.id}
                                        className="text-[10px] font-semibold text-red-500 hover:underline disabled:opacity-50">
                                        {undoingId === b.id ? 'Undoing...' : 'Undo'}
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground">Expired</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full space-y-4">
                        <p className="text-sm font-bold">Confirm Promotion</p>
                        <p className="text-xs text-muted-foreground">
                            {counts.promoted} promoted{hasPromoted && targetDivisionId ? ` to ${preview.targets.find(t => t.divisionId === targetDivisionId)?.name}` : ''} ·{' '}
                            {counts.repeated} repeating · {counts.graduated} graduating · {counts.withdrawn} leaving.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowConfirm(false)} disabled={submitting}
                                className="h-8 px-4 rounded-lg text-xs font-semibold border border-border/50">
                                Cancel
                            </button>
                            <button onClick={handleConfirm} disabled={submitting}
                                className="h-8 px-4 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                {submitting ? 'Applying...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
