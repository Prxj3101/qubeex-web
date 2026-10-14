'use client';

import { AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { GeneratePublishResult } from '@/lib/timetable';

/** What happened to each section after a one-click "generate & publish" / "publish all". */
export function BulkResultDialog({ result, onClose }: { result: { title: string; rows: GeneratePublishResult[] } | null; onClose: () => void }) {
    if (!result) return null;
    const published = result.rows.filter(r => r.outcome === 'PUBLISHED').length;
    const problems = result.rows.length - published;
    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-lg bg-card max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{result.title}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        <b className="text-foreground">{published}</b> of {result.rows.length} sections published{problems ? ` · ${problems} need attention` : ' · everything is live'}.
                    </p>
                </DialogHeader>
                <ul className="space-y-2">
                    {result.rows.map(r => {
                        const ok = r.outcome === 'PUBLISHED';
                        const skipped = r.outcome === 'SKIPPED';
                        const Icon = ok ? CheckCircle2 : skipped ? MinusCircle : AlertTriangle;
                        const tone = ok ? 'text-emerald-600' : skipped ? 'text-muted-foreground' : 'text-amber-600';
                        return (
                            <li key={r.divisionId} className="rounded-xl border border-border/60 p-3">
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                    <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
                                    {r.divisionName}
                                    <span className={`ml-auto text-xs font-medium ${tone}`}>{ok ? 'Published' : skipped ? 'Skipped' : 'Not published'}</span>
                                </div>
                                {!!r.rearranged?.length && (
                                    <p className="mt-1.5 text-xs text-sky-700 dark:text-sky-300">
                                        Moved {r.rearranged.length} session{r.rearranged.length === 1 ? '' : 's'} in other unpublished sections to make room:{' '}
                                        {r.rearranged.slice(0, 4).map(m => `${m.divisionName} ${m.subject} (${m.from} → ${m.to})`).join('; ')}{r.rearranged.length > 4 ? `; +${r.rearranged.length - 4} more` : ''}
                                    </p>
                                )}
                                {r.reasons.length > 0 && (
                                    <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-xs text-foreground/80">
                                        {r.reasons.map((m, i) => <li key={i}>{m}</li>)}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {problems > 0 && <p className="text-xs text-muted-foreground">Sections that weren&apos;t published are left as drafts. Open each one to fix the reason shown, then publish it.</p>}
            </DialogContent>
        </Dialog>
    );
}
