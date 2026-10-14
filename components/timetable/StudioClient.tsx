'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertTriangle, CalendarRange, CheckCircle2, ChevronDown, Download, GripVertical, ListChecks, Loader2, MoreHorizontal,
    Printer, Send, Sparkles, Trash2, Undo2, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useCanManageTimetable } from '@/hooks/useTimetableAccess';
import { useRemote } from '@/hooks/useRemote';
import { PrintPortal, usePrintArea } from '@/hooks/usePrintArea';
import { TimetableGrid, GridLegend, cellKey, CONFIG_DRAG_TYPE } from './TimetableGrid';
import { SessionDialog } from './SessionDialog';
import { RequirementsDialog } from './RequirementsDialog';
import { DayToolsDialog } from './DayToolsDialog';
import { ReadinessChecklist, type ReadinessTarget } from './ReadinessChecklist';
import { BulkResultDialog } from './BulkResultDialog';
import { ConflictList } from './ConflictList';
import {
    classLabel, STATUS_CLASS, STATUS_LABEL, ttApi, conflictsFromError, errMsg,
    type Conflict, type Entry, type EntrySnapshot, type GeneratePublishResult, type RearrangedItem, type Slot, type TimetableStatus, type UndoAction,
} from '@/lib/timetable';

interface GenResult { divisionId: string; divisionName: string; complete: boolean; placed: number; unplaced: number; problems: string[]; timedOut: boolean; rearranged?: RearrangedItem[] }

const MAX_UNDO = 20;
const todayDow = () => ((new Date().getDay() + 6) % 7) + 1;

export function StudioClient({ fixedDivisionId, onChanged, onNavigate }: { fixedDivisionId?: string; onChanged?: () => void; onNavigate?: (t: ReadinessTarget) => void } = {}) {
    const embedded = !!fixedDivisionId;
    const router = useRouter();
    const params = useSearchParams();
    const { selectedYearId, loading: yearLoading } = useAcademicYear();
    const canManage = useCanManageTimetable();

    const [panel, setPanel] = useState<'requirements' | 'conflicts' | 'generation'>('requirements');
    const [dialogCell, setDialogCell] = useState<{ day: number; slotId: string; entry?: Entry } | null>(null);
    const [reqOpen, setReqOpen] = useState(false);
    const [dayToolsOpen, setDayToolsOpen] = useState(false);
    const [highlight, setHighlight] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<string | null>(null);
    const [genState, setGenState] = useState<{ division: string; results: GenResult[] } | null>(null);
    const [forceAsk, setForceAsk] = useState<{ title: string; conflicts: Conflict[]; run: () => Promise<void> } | null>(null);
    const [menu, setMenu] = useState<'generate' | 'export' | 'more' | null>(null);
    const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
    const [bulkResult, setBulkResult] = useState<{ title: string; rows: GeneratePublishResult[] } | null>(null);
    const { printing, start: startPrint } = usePrintArea();

    const divisionId = fixedDivisionId ?? params.get('div');

    const overviewQ = useRemote(selectedYearId && !embedded ? `ov:${selectedYearId}` : null, () => ttApi.overview(selectedYearId), e => toast.error(errMsg(e, 'Could not load classes')));
    const overview = useMemo(() => overviewQ.data ?? [], [overviewQ.data]);
    const studioQ = useRemote(selectedYearId && divisionId ? `st:${selectedYearId}:${divisionId}` : null, () => ttApi.studio(selectedYearId, divisionId!), e => toast.error(errMsg(e, 'Could not load timetable')));
    const studio = studioQ.data;
    const loading = studioQ.loading || (overviewQ.loading && !studio);
    const genResults = studio && genState?.division === studio.division.id ? genState.results : null;

    const standards = useMemo(() => {
        const m = new Map<string, { id: string; name: string }>();
        for (const r of overview) if (!m.has(r.standardId)) m.set(r.standardId, { id: r.standardId, name: r.standardName });
        return [...m.values()];
    }, [overview]);
    const current = overview.find(r => r.divisionId === divisionId) ?? null;
    const standardId = current?.standardId ?? standards[0]?.id ?? '';
    const sections = overview.filter(r => r.standardId === standardId);

    const select = useCallback((id: string) => { if (!embedded) router.replace(`/admin/timetable?div=${id}`); }, [router, embedded]);
    useEffect(() => {
        if (!embedded && !divisionId && overview.length) select(overview[0].divisionId);
    }, [embedded, divisionId, overview, select]);

    const reloadOverview = overviewQ.reload;
    const reloadStudio = studioQ.reload;
    const reload = useCallback(() => { reloadOverview(); reloadStudio(); onChanged?.(); }, [reloadOverview, reloadStudio, onChanged]);

    const writable = !!studio?.writable && canManage;
    const status: TimetableStatus = studio?.timetable?.status ?? 'DRAFT';
    const published = status === 'PUBLISHED';
    const periodsConfigured = !!studio && studio.workingDays.length > 0 && studio.slots.some(s => s.kind === 'PERIOD');

    const pushUndo = useCallback((u?: UndoAction) => {
        if (u) setUndoStack(s => [...s.slice(-(MAX_UNDO - 1)), u]);
    }, []);

    const undo = async () => {
        const last = undoStack[undoStack.length - 1];
        if (!last || busy) return;
        setBusy('undo');
        try {
            await last.run();
            setUndoStack(s => s.slice(0, -1));
            toast.success('Undone');
            reload();
        } catch (e) {
            // The state moved on (e.g. a slot got filled) — drop the stale step so the button doesn't stay stuck.
            setUndoStack(s => s.slice(0, -1));
            toast.error(errMsg(e, 'Could not undo that change'));
            reload();
        } finally { setBusy(null); }
    };

    const conflictCells = useMemo(() => {
        const s = new Set<string>();
        if (!studio) return s;
        for (const c of studio.conflicts) {
            if (c.severity !== 'ERROR') continue;
            for (const cell of c.cells) if (cell.divisionId === studio.division.id) s.add(cellKey(cell.dayOfWeek, cell.slotId));
        }
        return s;
    }, [studio]);
    const errors = studio?.conflicts.filter(c => c.severity === 'ERROR') ?? [];

    const dayCounts = useMemo(() => {
        const m = new Map<number, number>();
        for (const e of studio?.entries ?? []) m.set(e.dayOfWeek, (m.get(e.dayOfWeek) ?? 0) + 1);
        return m;
    }, [studio]);

    const focusConflict = (c: Conflict) => {
        if (!studio) return;
        const cells = c.cells.filter(x => x.divisionId === studio.division.id).map(x => cellKey(x.dayOfWeek, x.slotId));
        if (!cells.length) {
            if (c.type === 'REQUIREMENT_SHORTFALL') setReqOpen(true);
            return;
        }
        setHighlight(new Set(cells));
        document.querySelector(`[data-cell="${cells[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlight(new Set()), 2500);
    };

    // ── actions ────────────────────────────────────────────────────────────────
    /** Run a change; on a 409 conflict ask before forcing. `fn` returns an undo step when the change can be reversed. */
    const attempt = async (label: string, fn: (force: boolean) => Promise<UndoAction | undefined | void>, ok: string) => {
        const exec = async (force: boolean) => {
            setBusy(label);
            try {
                const u = await fn(force);
                if (u) pushUndo(u);
                toast.success(ok);
                setForceAsk(null);
                reload();
            } catch (e) {
                const c = conflictsFromError(e);
                if (c) setForceAsk({ title: errMsg(e), conflicts: c, run: () => exec(true) });
                else toast.error(errMsg(e));
            } finally { setBusy(null); }
        };
        await exec(false);
    };

    const generate = async (scope: 'division' | 'standard' | 'all') => {
        if (!studio) return;
        setMenu(null);
        setBusy('generate');
        // A new seed each click, so regenerating gives a different (still valid) arrangement.
        const variation = Math.floor(Math.random() * 1_000_000_000);
        try {
            if (scope === 'division') {
                const r = await ttApi.post<GenResult>(`/divisions/${studio.division.id}/generate`, selectedYearId, { keepLocked: true, variation });
                setGenState({ division: studio.division.id, results: [r] });
                const moved = r.rearranged?.length ?? 0;
                toast[r.complete ? 'success' : 'warning']((r.complete ? 'Timetable generated' : `Generated with ${r.unplaced} unscheduled period${r.unplaced === 1 ? '' : 's'}`) + (moved ? ` · moved ${moved} session${moved === 1 ? '' : 's'} in other unpublished sections to make room` : ''));
            } else {
                const r = await ttApi.post<GenResult[]>('/generate-bulk', selectedYearId, { keepLocked: true, variation, standardId: scope === 'standard' ? studio.division.standardId : undefined });
                setGenState({ division: studio.division.id, results: r });
                const bad = r.filter(x => !x.complete).length;
                toast[bad ? 'warning' : 'success'](bad ? `${r.length - bad}/${r.length} classes complete` : `Generated ${r.length} timetables`);
            }
            setUndoStack([]); // generation replaces the whole grid, earlier steps no longer apply
            setPanel('generation');
            reload();
        } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
    };

    /** One click: generate every unpublished section and publish the ones that come out complete and clean. */
    const generatePublish = async (scope: 'standard' | 'all') => {
        if (!studio) return;
        setMenu(null);
        const what = scope === 'standard' ? `every unpublished section of class ${studio.division.standardName}` : 'every unpublished section in the school';
        if (!confirm(`Generate ${what} and publish the ones that come out complete and conflict-free?\n\nAlready-published sections are left alone. Anything with problems stays a draft and is listed with the reason.`)) return;
        setBusy('generate');
        const variation = Math.floor(Math.random() * 1_000_000_000);
        try {
            const rows = await ttApi.post<GeneratePublishResult[]>('/generate-publish', selectedYearId, { keepLocked: true, variation, standardId: scope === 'standard' ? studio.division.standardId : undefined });
            setBulkResult({ title: scope === 'standard' ? `Generate & publish — class ${studio.division.standardName}` : 'Generate & publish — whole school', rows });
            setUndoStack([]);
            reload();
        } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
    };

    /** Publish the sections of this class that already have a timetable, without regenerating anything. */
    const publishReady = async () => {
        if (!studio) return;
        setMenu(null);
        const all = [{ id: studio.division.id, label: classLabel(studio.division.standardName, studio.division.name) }, ...studio.siblings];
        setBusy('status');
        try {
            const res = await ttApi.post<{ divisionId: string; ok: boolean; error?: string }[]>('/status-bulk', selectedYearId, { status: 'PUBLISHED', divisionIds: all.map(x => x.id) });
            const label = new Map(all.map(x => [x.id, x.label]));
            setBulkResult({
                title: `Publish — class ${studio.division.standardName}`,
                rows: res.map(r => ({
                    divisionId: r.divisionId, divisionName: label.get(r.divisionId) ?? r.divisionId, outcome: r.ok ? 'PUBLISHED' as const : 'NEEDS_ATTENTION' as const,
                    reasons: r.ok ? [] : [r.error ?? 'Could not publish'], placed: 0, unplaced: 0,
                })),
            });
            reload();
        } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
    };

    const goTo = (t: ReadinessTarget) => (onNavigate ? onNavigate(t) : router.push(t === 'setup' ? '/admin/timetable/setup' : '/admin/timetable/resources'));

    const setStatus = (next: TimetableStatus, okMsg: string) =>
        attempt('status', async force => { await ttApi.post(`/divisions/${studio!.division.id}/status`, selectedYearId, { status: next, force }); }, okMsg);

    const onMove = (e: Entry, day: number, slotId: string) => {
        const from = { day: e.dayOfWeek, slotId: e.slotId };
        return attempt('move', async force => {
            await ttApi.post('/entries/move', selectedYearId, { entryId: e.id, toDayOfWeek: day, toSlotId: slotId, force });
            return { label: 'move', run: async () => { await ttApi.post('/entries/move', selectedYearId, { entryId: e.id, toDayOfWeek: from.day, toSlotId: from.slotId, force: true }); } };
        }, 'Session moved');
    };
    const onSwap = (a: Entry, b: Entry) =>
        attempt('swap', async force => {
            await ttApi.post('/entries/swap', selectedYearId, { entryAId: a.id, entryBId: b.id, force });
            return { label: 'swap', run: async () => { await ttApi.post('/entries/swap', selectedYearId, { entryAId: a.id, entryBId: b.id, force: true }); } };
        }, 'Sessions swapped');

    // A requirement dragged from the side panel onto an empty period.
    const onDropConfig = (configId: string, day: number, slot: Slot) => {
        if (!studio) return;
        const cfg = studio.configs.find(c => c.id === configId);
        if (!cfg) return;
        if (studio.entries.some(e => e.dayOfWeek === day && e.slotId === slot.id)) { toast.error('That period already has a session. Drop onto an empty one.'); return; }
        void attempt('add', async force => {
            const res = await ttApi.post<{ entries: { id: string }[] }>(`/divisions/${studio.division.id}/entries`, selectedYearId, {
                dayOfWeek: day, slotId: slot.id, sessionTypeId: cfg.sessionTypeId, subjectId: cfg.subjectId, title: cfg.title, configId: cfg.id, span: cfg.span, force,
            });
            const ids = res.entries.map(x => x.id);
            return { label: 'add', run: async () => { await ttApi.post('/entries/bulk-delete', selectedYearId, { ids }); } };
        }, `${cfg.subjectName ?? cfg.title ?? 'Session'} added`);
    };

    const copyDay = (fromDay: number, toDays: number[], overwrite: boolean) =>
        attempt('copy', async force => {
            const res = await ttApi.post<{ createdIds: string[]; overwritten: EntrySnapshot[]; skipped: number }>(`/divisions/${studio!.division.id}/copy-day`, selectedYearId, { fromDay, toDays, overwrite, force });
            if (res.skipped) toast.message(`${res.skipped} session(s) skipped because those periods were already filled or locked.`);
            return {
                label: 'copy',
                run: async () => {
                    await ttApi.post('/entries/bulk-delete', selectedYearId, { ids: res.createdIds });
                    if (res.overwritten.length) await ttApi.post(`/divisions/${studio!.division.id}/restore`, selectedYearId, { entries: res.overwritten });
                },
            };
        }, 'Day copied');

    const clear = async (dayOfWeek?: number) => {
        await attempt('clear', async () => {
            const res = await ttApi.post<{ removed: number; snapshot: EntrySnapshot[] }>(`/divisions/${studio!.division.id}/clear`, selectedYearId, { keepLocked: true, dayOfWeek });
            if (!res.removed) return undefined;
            return { label: 'clear', run: async () => { await ttApi.post(`/divisions/${studio!.division.id}/restore`, selectedYearId, { entries: res.snapshot }); } };
        }, dayOfWeek ? 'Day cleared' : 'Timetable cleared');
    };

    const exportFile = async (format: 'pdf' | 'xlsx') => {
        setMenu(null);
        try { await ttApi.exportFile(selectedYearId, 'class', format, studio!.division.id); } catch (e) { toast.error(errMsg(e, 'Export failed')); }
    };

    // ── render ─────────────────────────────────────────────────────────────────
    if (yearLoading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    if (!embedded && !overview.length && !loading) {
        return <div className="py-16 text-center text-sm text-muted-foreground">No classes found for this academic year. Create classes and sections under Campus → Classes first.</div>;
    }

    const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';
    const menuBox = 'absolute right-0 z-30 mt-1 w-64 rounded-xl border border-border bg-card p-1 shadow-xl text-sm';
    const menuItem = 'w-full rounded-lg px-3 py-2 text-left hover:bg-muted disabled:opacity-50';
    const lastUndo = undoStack[undoStack.length - 1];

    return (
        <div className="space-y-4 print:space-y-2" onClick={() => menu && setMenu(null)}>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
                {!embedded && (<>
                    <label className="text-xs text-muted-foreground">Class
                        <select className="ml-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" value={standardId}
                            onChange={e => { const first = overview.find(r => r.standardId === e.target.value); if (first) select(first.divisionId); }}>
                            {standards.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </label>
                    <label className="text-xs text-muted-foreground">Section
                        <select className="ml-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" value={divisionId ?? ''} onChange={e => select(e.target.value)}>
                            {sections.map(s => <option key={s.divisionId} value={s.divisionId}>{s.divisionName}</option>)}
                        </select>
                    </label>
                </>)}
                {studio && <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>}
                {studio?.timetable?.publishedAt && published && <span className="text-xs text-muted-foreground">since {new Date(studio.timetable.publishedAt).toLocaleDateString('en-IN')}</span>}

                <div className="ml-auto flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                    {writable && (
                        <>
                            <button type="button" disabled={!lastUndo || !!busy} onClick={() => void undo()} className={btn} title={lastUndo ? 'Undo the last change' : 'Nothing to undo'}>
                                {busy === 'undo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Undo{undoStack.length > 1 ? ` (${undoStack.length})` : ''}
                            </button>
                            <div className="relative">
                                <button type="button" disabled={!!busy || !periodsConfigured} onClick={() => setMenu(m => (m === 'generate' ? null : 'generate'))} title={!periodsConfigured ? 'Set working days and periods first' : ''}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                                    {busy === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Generate <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                {menu === 'generate' && (
                                    <div className={menuBox}>
                                        <button className={menuItem} disabled={published} onClick={() => void generate('division')}>This section <span className="block text-xs text-muted-foreground">{published ? 'Unpublish first to regenerate' : 'New arrangement each time · keeps locked sessions · may move sessions in other unpublished sections'}</span></button>
                                        {!embedded && <button className={menuItem} onClick={() => void generate('standard')}>All sections of this class</button>}
                                        {!embedded && <button className={menuItem} onClick={() => void generate('all')}>Every class in the school</button>}
                                        <div className="my-1 border-t border-border/60" />
                                        <button className={menuItem} onClick={() => void generatePublish('standard')}>Generate &amp; publish — all sections of this class <span className="block text-xs text-muted-foreground">Publishes only the clean ones</span></button>
                                        {!embedded && <button className={menuItem} onClick={() => void generatePublish('all')}>Generate &amp; publish — whole school</button>}
                                        <button className={menuItem} onClick={() => void publishReady()}>Publish all ready sections of this class <span className="block text-xs text-muted-foreground">No regenerating</span></button>
                                    </div>
                                )}
                            </div>
                            {!published && status !== 'UNDER_REVIEW' && status !== 'DRAFT' && (
                                <button type="button" disabled={!!busy} onClick={() => void setStatus('UNDER_REVIEW', 'Marked under review')} className={btn}><ListChecks className="w-4 h-4" /> Send to review</button>
                            )}
                            {!published ? (
                                <button type="button" disabled={!!busy || !studio?.entries.length} onClick={() => void setStatus('PUBLISHED', 'Timetable published')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"><Send className="w-4 h-4" /> Publish</button>
                            ) : (
                                <button type="button" disabled={!!busy} onClick={() => void setStatus('DRAFT', 'Timetable unpublished')} className={btn}><Undo2 className="w-4 h-4" /> Unpublish</button>
                            )}
                            <div className="relative">
                                <button type="button" onClick={() => setMenu(m => (m === 'more' ? null : 'more'))} className={btn} aria-label="More actions"><MoreHorizontal className="w-4 h-4" /></button>
                                {menu === 'more' && (
                                    <div className={menuBox}>
                                        <button className={menuItem} disabled={!studio?.entries.length} onClick={() => { setMenu(null); setDayToolsOpen(true); }}><CalendarRange className="inline w-4 h-4 mr-2" />Copy or clear a day…</button>
                                        <button className={`${menuItem} text-red-600`} disabled={published || !studio?.entries.length} onClick={() => { setMenu(null); if (confirm('Remove every unlocked session from this timetable? You can undo it.')) void clear(); }}><Trash2 className="inline w-4 h-4 mr-2" />Clear all unlocked sessions</button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    <div className="relative">
                        <button type="button" onClick={() => setMenu(m => (m === 'export' ? null : 'export'))} className={btn}><Download className="w-4 h-4" /> Export</button>
                        {menu === 'export' && (
                            <div className={`${menuBox} w-40`}>
                                <button className={menuItem} onClick={() => void exportFile('pdf')}>PDF</button>
                                <button className={menuItem} onClick={() => void exportFile('xlsx')}>Excel</button>
                            </div>
                        )}
                    </div>
                    <button type="button" disabled={!studio?.entries.length} onClick={startPrint} className={btn}><Printer className="w-4 h-4" /> Print</button>
                </div>
            </div>

            {/* Section status strip */}
            {!embedded && <div className="flex flex-wrap gap-1.5 print:hidden">
                {sections.map(s => (
                    <button key={s.divisionId} onClick={() => select(s.divisionId)}
                        className={`rounded-lg border px-2.5 py-1 text-xs ${s.divisionId === divisionId ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                        {s.divisionName} · {s.status ? STATUS_LABEL[s.status] : 'Not started'}{s.entryCount ? ` · ${s.entryCount}` : ''}
                    </button>
                ))}
            </div>}

            {loading && <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

            {!loading && studio && (
                <>
                    {printing && (
                        <PrintPortal>
                            <div style={{ textAlign: 'center', marginBottom: 8 }}>
                                <div style={{ fontSize: 20, fontWeight: 700 }}>{classLabel(studio.division.standardName, studio.division.name)} Timetable</div>
                                <div style={{ fontSize: 12, color: '#555' }}>Academic year {studio.academicYear.label}{status === 'PUBLISHED' ? '' : ` · ${STATUS_LABEL[status]} (not published)`}</div>
                            </div>
                            <TimetableGrid slots={studio.slots} days={studio.workingDays} entries={studio.entries} />
                            <div style={{ marginTop: 8 }}><GridLegend entries={studio.entries} /></div>
                        </PrintPortal>
                    )}

                    <ReadinessChecklist
                        studio={studio} canManage={writable} onNavigate={goTo}
                        onEditRequirements={() => setReqOpen(true)}
                        onGenerate={() => void generate('division')}
                        onShowConflicts={() => setPanel('conflicts')}
                        onPublish={() => void setStatus('PUBLISHED', 'Timetable published')}
                    />

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] print:block">
                        <div className="min-w-0 space-y-2">
                            <TimetableGrid
                                slots={studio.slots} days={studio.workingDays} entries={studio.entries}
                                conflictCells={conflictCells} highlight={highlight} editable={writable} todayDow={studio.academicYear.isCurrent ? todayDow() : undefined}
                                onCellClick={(day, slot, entry) => {
                                    if (!entry && !writable) return;
                                    setDialogCell({ day, slotId: slot.id, entry });
                                }}
                                onMove={onMove} onSwap={onSwap} onDropConfig={onDropConfig}
                            />
                            <GridLegend entries={studio.entries} />
                            {writable && <p className="text-[11px] text-muted-foreground print:hidden">Click a cell to add or edit. Drag a session onto an empty cell to move it, or onto another session to swap. Drag a subject from <b>Requirements</b> onto an empty period to add it. Locked sessions can&apos;t be dragged.</p>}
                            {!studio.writable && <p className="text-xs text-amber-600">This academic year is closed — the timetable is read-only.</p>}
                            {studio.writable && !canManage && <p className="text-xs text-muted-foreground">You have view-only access to timetables.</p>}
                        </div>

                        <aside className="space-y-3 print:hidden">
                            <div className="flex gap-1 rounded-xl bg-muted/60 p-1 text-xs">
                                {([['requirements', 'Requirements'], ['conflicts', `Conflicts (${errors.length})`], ['generation', 'Generation']] as const).map(([k, l]) => (
                                    <button key={k} onClick={() => setPanel(k)} className={`flex-1 rounded-lg px-2 py-1.5 font-medium ${panel === k ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'} ${k === 'conflicts' && errors.length ? 'text-red-600' : ''}`}>{l}</button>
                                ))}
                            </div>

                            {panel === 'requirements' && (
                                <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-2">
                                    {studio.requirements.length === 0 && <p className="text-sm text-muted-foreground">No weekly requirements yet. Add how many periods each subject needs per week to enable generation.</p>}
                                    {studio.requirements.map(r => {
                                        const cfg = studio.configs.find(c => c.id === r.configId);
                                        const color = studio.subjects.find(s => s.id === cfg?.subjectId)?.color ?? studio.sessionTypes.find(t => t.id === cfg?.sessionTypeId)?.color ?? '#7C3AED';
                                        const remaining = r.required - r.scheduled;
                                        const canDrag = writable && remaining > 0;
                                        const pct = Math.min(100, Math.round((r.scheduled / Math.max(r.required, 1)) * 100));
                                        return (
                                            <div key={r.configId}
                                                draggable={canDrag}
                                                onDragStart={ev => { ev.dataTransfer.setData(CONFIG_DRAG_TYPE, r.configId); ev.dataTransfer.effectAllowed = 'copy'; }}
                                                className={`rounded-xl border border-border/60 p-2 ${canDrag ? 'cursor-grab active:cursor-grabbing hover:border-primary/50' : ''}`}
                                                title={canDrag ? 'Drag onto an empty period to add it' : undefined}>
                                                <div className="flex items-center justify-between gap-2 text-sm">
                                                    <span className="flex min-w-0 items-center gap-1.5">
                                                        {canDrag && <GripVertical className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                                                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                                                        <span className="truncate font-medium">{r.label}</span>
                                                    </span>
                                                    {r.status === 'COMPLETE'
                                                        ? <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600"><CheckCircle2 className="w-3 h-3" />Done</span>
                                                        : <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">{r.status === 'EXCEEDED' ? 'Too many' : `${remaining} left`}</span>}
                                                </div>
                                                <div className="mt-1.5 flex items-center gap-2">
                                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.status === 'EXCEEDED' ? '#ef4444' : color }} /></div>
                                                    <span className="text-[11px] tabular-nums text-muted-foreground">{r.scheduled}/{r.required}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {writable && <button type="button" onClick={() => setReqOpen(true)} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">Edit requirements</button>}
                                </div>
                            )}

                            {panel === 'conflicts' && (
                                <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                                    <ConflictList conflicts={studio.conflicts.filter(c => c.type !== 'REQUIREMENT_SHORTFALL')} onSelect={focusConflict} empty="No conflicts. This timetable is valid." />
                                </div>
                            )}

                            {panel === 'generation' && (
                                <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-3 max-h-[60vh] overflow-y-auto">
                                    {(genResults ?? (studio.lastGeneration ? [{ divisionId: studio.division.id, divisionName: classLabel(studio.division.standardName, studio.division.name), ...studio.lastGeneration, timedOut: false }] : [])).map(r => (
                                        <div key={r.divisionId} className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-sm font-semibold">
                                                {r.complete ? <Sparkles className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                                                {r.divisionName}
                                                <span className="text-xs font-normal text-muted-foreground">{r.placed} placed{r.unplaced ? `, ${r.unplaced} unscheduled` : ''}</span>
                                            </div>
                                            {!r.complete && (
                                                <ul className="list-disc pl-5 text-xs text-foreground/80 space-y-0.5">
                                                    {r.problems.map((p, i) => <li key={i}>{p}</li>)}
                                                </ul>
                                            )}
                                            {!!r.rearranged?.length && (
                                                <div className="rounded-lg bg-sky-500/10 px-2.5 py-2 text-xs text-sky-700 dark:text-sky-300">
                                                    <div className="font-semibold">Moved {r.rearranged.length} session{r.rearranged.length === 1 ? '' : 's'} in other unpublished sections to make room:</div>
                                                    <ul className="mt-1 list-disc pl-5 space-y-0.5">
                                                        {r.rearranged.map((m, i) => <li key={i}>{m.divisionName} · {m.subject}: {m.from} → {m.to}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {!genResults && !studio.lastGeneration && <p className="text-sm text-muted-foreground">Nothing generated yet.</p>}
                                </div>
                            )}
                        </aside>
                    </div>

                    <SessionDialog
                        open={!!dialogCell} onClose={() => setDialogCell(null)} studio={studio} yearId={selectedYearId}
                        cell={dialogCell} entry={dialogCell?.entry} writable={writable}
                        onChanged={undoStep => { pushUndo(undoStep); reload(); }}
                    />
                    <RequirementsDialog open={reqOpen} onClose={() => setReqOpen(false)} studio={studio} yearId={selectedYearId} onSaved={() => void reload()} />
                    <BulkResultDialog result={bulkResult} onClose={() => setBulkResult(null)} />
                    <DayToolsDialog open={dayToolsOpen} onClose={() => setDayToolsOpen(false)} workingDays={studio.workingDays} dayCounts={dayCounts} onCopy={copyDay} onClear={d => clear(d)} />
                </>
            )}

            {forceAsk && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-card border border-border p-4 space-y-3 shadow-xl">
                        <h3 className="font-semibold text-foreground">{forceAsk.title}</h3>
                        <div className="max-h-64 overflow-y-auto"><ConflictList conflicts={forceAsk.conflicts} /></div>
                        <div className="flex justify-end gap-2">
                            <button className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted" onClick={() => setForceAsk(null)}>Cancel</button>
                            <button className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" disabled={!!busy} onClick={() => void forceAsk.run()}>Proceed anyway</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
