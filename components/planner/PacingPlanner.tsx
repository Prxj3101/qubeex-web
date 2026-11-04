'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowDown, ArrowUp, Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { plannerApi, type PlanView, type PlanViewItem } from '@/lib/plannerApi';
import { getErrorMessage } from '@/lib/error';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PacingPatternEditor } from '@/components/planner/PacingPatternEditor';

interface Row {
  key: string;
  // Last server values for this row (derived numbers are only ever refreshed by the server).
  item: PlanViewItem;
  isNew: boolean;
  label: string; // buffers only
  manual: string; // '' = auto
}

const MAX_ITEMS = 250;
const MAX_LABEL = 60;
const MIN_PERIODS = 1;
const MAX_PERIODS = 400;
const NO_DAYS_LEFT = 'This academic year has no teaching days left.';

const SOURCE_LABEL = {
  TIMETABLE: 'From timetable',
  PATTERN: 'From weekly pattern',
  NONE: 'No timetable yet',
} as const;

function periodsValid(v: string): boolean {
  if (v.trim() === '') return true;
  if (!/^\d+$/.test(v.trim())) return false;
  const n = Number(v);
  return n >= MIN_PERIODS && n <= MAX_PERIODS;
}

function labelValid(l: string): boolean {
  const t = l.trim();
  return t.length >= 1 && t.length <= MAX_LABEL;
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  const dt = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function isConflict(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { response?: { status?: number } }).response?.status === 409
  );
}

function serialize(rows: Row[], target: string): string {
  return JSON.stringify([
    target,
    rows.map((r) => [r.item.kind, r.item.chapterId, r.item.removed, r.item.kind === 'BUFFER' ? r.label : null, r.manual.trim()]),
  ]);
}

export function PacingPlanner({ subjectId, divisionId }: { subjectId: string; divisionId: string }) {
  const confirm = useConfirm();
  const keyCounter = useRef(0);
  const mounted = useRef(true);
  const reqId = useRef(0); // bumped by every load/save so a stale response is ignored
  const busyRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<PlanView | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [target, setTarget] = useState('');
  const [baseline, setBaseline] = useState(serialize([], ''));
  const [yearEnd, setYearEnd] = useState<string | undefined>(undefined);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState<'save' | 'pattern' | null>(null);
  const [bufLabel, setBufLabel] = useState('');
  const [bufPeriods, setBufPeriods] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyView = useCallback((v: PlanView) => {
    const next: Row[] = v.items.map((item) => ({
      key: `row-${++keyCounter.current}`,
      item,
      isNew: false,
      label: item.label ?? item.name,
      manual: item.manualPeriods != null ? String(item.manualPeriods) : '',
    }));
    const t = v.plan.targetEndDate ?? '';
    setView(v);
    setRows(next);
    setTarget(t);
    setBaseline(serialize(next, t));
    // With no target the window ends at the academic year end; remember it for the date input's max.
    if (v.plan.targetEndDate == null) setYearEnd(v.window.to);
    setConflict(false);
  }, []);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const v = await plannerApi.getPlan(divisionId, subjectId);
      if (!mounted.current || id !== reqId.current) return;
      applyView(v);
    } catch (err) {
      if (!mounted.current || id !== reqId.current) return;
      setLoadError(getErrorMessage(err, 'Failed to load pacing plan'));
    } finally {
      if (mounted.current && id === reqId.current) setLoading(false);
    }
  }, [divisionId, subjectId, applyView]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = serialize(rows, target) !== baseline;
  const kept = rows.filter((r) => !r.item.removed);

  const errors: string[] = [];
  if (kept.length > MAX_ITEMS) errors.push(`A plan can have at most ${MAX_ITEMS} items.`);
  if (kept.some((r) => !periodsValid(r.manual) || (r.item.kind === 'BUFFER' && r.manual.trim() === ''))) errors.push(`Periods must be a whole number from ${MIN_PERIODS} to ${MAX_PERIODS}.`);
  if (kept.some((r) => r.item.kind === 'BUFFER' && !labelValid(r.label))) errors.push(`A buffer needs a label of 1 to ${MAX_LABEL} characters.`);
  if (target !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(target)) errors.push('Enter a valid finish date.');
  if (yearEnd && target !== '' && target > yearEnd) errors.push('The finish date cannot be after the academic year ends.');
  const valid = errors.length === 0;

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const move = (index: number, delta: -1 | 1) =>
    setRows((rs) => {
      const t = index + delta;
      if (t < 0 || t >= rs.length) return rs;
      const copy = rs.slice();
      [copy[index], copy[t]] = [copy[t], copy[index]];
      return copy;
    });

  const removeRow = async (row: Row) => {
    if (!row.item.removed) {
      const ok = await confirm({
        title: row.item.kind === 'BUFFER' ? 'Remove this buffer?' : 'Remove this chapter from the plan?',
        message: 'It will be removed when you save.',
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setRows((rs) => rs.filter((r) => r.key !== row.key));
  };

  const addBuffer = () => {
    if (!labelValid(bufLabel) || !periodsValid(bufPeriods) || bufPeriods.trim() === '' || kept.length >= MAX_ITEMS) return;
    const label = bufLabel.trim();
    setRows((rs) => [
      ...rs,
      {
        key: `row-${++keyCounter.current}`,
        isNew: true,
        label,
        manual: bufPeriods.trim(),
        item: {
          itemId: null, kind: 'BUFFER', chapterId: null, name: label, term: null, weight: 0, manual: true,
          plannedPeriods: 0, startDate: null, endDate: null, atRisk: false, removed: false,
          label, manualPeriods: Number(bufPeriods),
        },
      },
    ]);
    setBufLabel('');
    setBufPeriods('');
  };

  const save = async () => {
    if (busyRef.current || !valid || !dirty || conflict || !view) return;
    busyRef.current = true;
    setBusy('save');
    const id = ++reqId.current;
    try {
      const next = await plannerApi.savePlan(divisionId, subjectId, {
        targetEndDate: target === '' ? null : target,
        expectedUpdatedAt: view.plan.id ? view.plan.updatedAt : null,
        items: kept.map((r) =>
          r.item.kind === 'BUFFER'
            ? { kind: 'BUFFER' as const, label: r.label.trim(), manualPeriods: r.manual.trim() === '' ? null : Number(r.manual) }
            : { kind: 'CHAPTER' as const, chapterId: r.item.chapterId, manualPeriods: r.manual.trim() === '' ? null : Number(r.manual) },
        ),
      });
      if (!mounted.current || id !== reqId.current) return;
      applyView(next);
      setLoading(false);
      toast.success('Pacing plan saved');
    } catch (err) {
      if (!mounted.current) return;
      if (isConflict(err)) setConflict(true);
      else toast.error(getErrorMessage(err, 'Failed to save pacing plan'));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(null);
    }
  };

  const reload = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Reload the plan?',
        message: 'Reloading discards your unsaved edits.',
        confirmLabel: 'Reload',
        tone: 'danger',
      });
      if (!ok) return;
    }
    await load();
  };

  // Simple safe option: a pattern save refreshes the whole plan, so unsaved edits are discarded after confirming.
  const savePattern = async (days: Record<string, number> | null) => {
    if (busyRef.current) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved plan edits?',
        message: 'Saving the weekly pattern refreshes the plan and discards your unsaved edits.',
        confirmLabel: 'Save pattern',
        tone: 'danger',
      });
      if (!ok) return;
    }
    busyRef.current = true;
    setBusy('pattern');
    const id = ++reqId.current;
    try {
      const next = await plannerApi.savePattern(divisionId, subjectId, days);
      if (!mounted.current || id !== reqId.current) return;
      applyView(next);
      setLoading(false);
      toast.success(days === null ? 'Weekly pattern cleared' : 'Weekly pattern saved');
    } catch (err) {
      if (mounted.current) toast.error(getErrorMessage(err, 'Failed to save weekly pattern'));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(null);
    }
  };

  if (loading) return <div className="rounded-2xl border border-border/50 bg-card h-64 animate-pulse" />;

  if (loadError || !view) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-8 flex flex-col items-center gap-3 text-center">
        <AlertCircle size={28} className="text-destructive" />
        <p className="text-sm text-muted-foreground">{loadError ?? 'Failed to load pacing plan'}</p>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw size={14} /> Retry
        </Button>
      </div>
    );
  }

  const emptyWindow = view.warnings.includes(NO_DAYS_LEFT);
  const otherWarnings = view.warnings.filter(
    (w) => w !== NO_DAYS_LEFT && !(w.startsWith('Needs ') && w.endsWith('to cover the syllabus.'))
  );
  const locked = busy !== null;

  return (
    <div className="space-y-4">
      {conflict && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <TriangleAlert size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Someone else changed this plan</p>
              <p className="text-xs text-muted-foreground">Your changes were not saved. Reload to see the latest version.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void reload()}>
            <RefreshCw size={14} /> Reload
          </Button>
        </div>
      )}

      {emptyWindow && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-2.5">
          <AlertCircle size={18} className="text-destructive mt-0.5 shrink-0" />
          <p className="text-sm font-semibold">{NO_DAYS_LEFT}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">
            From {fmtDate(view.window.from)} to {fmtDate(view.window.to)}
          </p>
          {!emptyWindow && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{SOURCE_LABEL[view.source]}</span>
          )}
          <span className="text-sm text-muted-foreground">
            {view.availablePeriods} {view.availablePeriods === 1 ? 'period' : 'periods'} available
          </span>
        </div>
        {view.shortfallPeriods > 0 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            Short by {view.shortfallPeriods} {view.shortfallPeriods === 1 ? 'period' : 'periods'}. No chapter has been dropped; chapters marked at risk have not been given enough time.
          </div>
        )}
        {otherWarnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
            {otherWarnings.map((w, i) => (
              <p key={i} className="text-sm">{w}</p>
            ))}
          </div>
        )}
        {view.targets.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {view.targets.map((t, i) => (
              <li key={i}>
                {t.periodsBefore} {t.periodsBefore === 1 ? 'period' : 'periods'} before {t.label} · {fmtDate(t.date)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {view.source !== 'TIMETABLE' && (
        <PacingPatternEditor pattern={view.pattern} busy={locked} onSave={(d) => void savePattern(d)} />
      )}

      {!view.hasSyllabus ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          <Link href={`/teacher/planner/${encodeURIComponent(subjectId)}`} className="font-medium text-foreground underline underline-offset-2">
            Set up the syllabus first
          </Link>
          , then come back to plan it.
        </div>
      ) : (
        <fieldset disabled={locked} className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">
              Plan <span className="text-muted-foreground font-normal">({kept.length})</span>
            </p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Finish by
              <Input
                type="date"
                value={target}
                max={yearEnd}
                onChange={(e) => setTarget(e.target.value)}
                aria-label="Finish by"
                className="w-40"
              />
              {target !== '' && (
                <Button variant="ghost" size="sm" type="button" onClick={() => setTarget('')}>
                  Year end
                </Button>
              )}
            </label>
          </div>

          {rows.length === 0 && <p className="text-sm text-muted-foreground">This plan has no items.</p>}

          <ul className="space-y-2">
            {rows.map((row, i) => {
              const it = row.item;
              const bad = !row.item.removed && (!periodsValid(row.manual) || (it.kind === 'BUFFER' && row.manual.trim() === ''));
              const labelBad = it.kind === 'BUFFER' && !labelValid(row.label);
              return (
                <li
                  key={row.key}
                  className={`rounded-xl border p-2.5 space-y-1.5 ${
                    it.removed ? 'border-destructive/40 bg-destructive/5' : it.atRisk ? 'border-amber-500/50 bg-amber-500/10' : 'border-border/50'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-6 text-xs text-muted-foreground text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-[12rem]">
                      {it.kind === 'BUFFER' && !it.removed ? (
                        <Input
                          value={row.label}
                          maxLength={MAX_LABEL + 20}
                          onChange={(e) => updateRow(row.key, { label: e.target.value })}
                          aria-label={`Buffer ${i + 1} label`}
                          aria-invalid={labelBad}
                        />
                      ) : (
                        <p className="text-sm font-medium">{it.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {it.kind === 'BUFFER' ? 'Buffer' : it.term ? `Term ${it.term}` : 'No term'}
                        {!it.removed && !row.isNew && it.startDate && it.endDate && ` · ${fmtDate(it.startDate)} to ${fmtDate(it.endDate)}`}
                        {row.isNew && ' · dates appear after you save'}
                      </p>
                    </div>
                    {it.atRisk && !it.removed && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">At risk</span>
                    )}
                    {!it.removed && (
                      <>
                        <span className="text-sm tabular-nums w-24 text-right">
                          {row.isNew ? '—' : `${it.plannedPeriods} ${it.plannedPeriods === 1 ? 'period' : 'periods'}`}
                        </span>
                        {it.kind === 'CHAPTER' && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.manual.trim() === '' ? 'Auto' : 'Manual'}</span>
                        )}
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={MIN_PERIODS}
                          max={MAX_PERIODS}
                          step={1}
                          value={row.manual}
                          placeholder={it.kind === 'BUFFER' ? 'Periods' : 'Auto'}
                          onChange={(e) => updateRow(row.key, { manual: e.target.value })}
                          aria-label={`${it.name} periods`}
                          aria-invalid={bad}
                          className="w-20"
                        />
                        {row.manual.trim() !== '' && it.kind === 'CHAPTER' && (
                          <Button variant="ghost" size="sm" type="button" onClick={() => updateRow(row.key, { manual: '' })}>
                            Back to auto
                          </Button>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                        <ArrowUp size={14} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                        <ArrowDown size={14} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => void removeRow(row)} aria-label="Remove item">
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {it.removed && (
                    <p className="pl-8 text-xs text-destructive">
                      Chapter removed from syllabus. It is left out when you save; use Remove to dismiss it.
                    </p>
                  )}
                  {bad && <p className="pl-8 text-xs text-destructive">Periods must be a whole number from {MIN_PERIODS} to {MAX_PERIODS}.</p>}
                  {labelBad && <p className="pl-8 text-xs text-destructive">Enter a label (up to {MAX_LABEL} characters).</p>}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
            <Input
              value={bufLabel}
              maxLength={MAX_LABEL + 20}
              onChange={(e) => setBufLabel(e.target.value)}
              placeholder="Buffer label (e.g. Revision)"
              aria-label="Buffer label"
              className="w-56"
            />
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_PERIODS}
              max={MAX_PERIODS}
              value={bufPeriods}
              onChange={(e) => setBufPeriods(e.target.value)}
              placeholder="Periods"
              aria-label="Buffer periods"
              className="w-24"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addBuffer}
              disabled={!labelValid(bufLabel) || bufPeriods.trim() === '' || !periodsValid(bufPeriods) || kept.length >= MAX_ITEMS}
            >
              <Plus size={14} /> Add buffer period
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {errors.length > 0 && <p className="text-xs text-destructive">{errors[0]}</p>}
            {dirty && <p className="text-xs text-muted-foreground">Numbers update after you save.</p>}
            <Button onClick={() => void save()} disabled={!valid || !dirty || locked || conflict}>
              {busy === 'save' ? 'Saving…' : 'Save plan'}
            </Button>
          </div>
          {view.plan.updatedAt && (
            <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
              Last saved {new Date(view.plan.updatedAt).toLocaleString()}
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
