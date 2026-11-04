'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { plannerApi, type SyllabusView } from '@/lib/plannerApi';
import { matchChapterIds } from '@/lib/plannerMatch';
import { getErrorMessage } from '@/lib/error';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SyllabusImport, type ImportPreview } from '@/components/planner/SyllabusImport';

interface Row {
  key: string;
  id?: string;
  name: string;
  term: number | null;
  weight: string;
  needsReview: boolean;
}

interface Meta {
  title?: string;
  medium?: string;
  sourceTemplateId?: string;
}

const MAX_CHAPTERS = 200;
const MAX_NAME = 200;
const MIN_WEIGHT = 1;
const MAX_WEIGHT = 500;

function weightValid(w: string): boolean {
  if (!/^\d+$/.test(w.trim())) return false;
  const n = Number(w);
  return n >= MIN_WEIGHT && n <= MAX_WEIGHT;
}

function nameValid(name: string): boolean {
  const t = name.trim();
  return t.length >= 1 && t.length <= MAX_NAME;
}

function serialize(rows: Row[]): string {
  return JSON.stringify(rows.map((r) => [r.id ?? null, r.name, r.term, r.weight]));
}

function isConflict(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { response?: { status?: number } }).response?.status === 409
  );
}

export function SyllabusEditor({ subjectId }: { subjectId: string }) {
  const confirm = useConfirm();
  const keyCounter = useRef(0);
  const nextKey = () => `row-${++keyCounter.current}`;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Last server state (source of truth for updatedAt); the draft below is what the teacher edits.
  const [loaded, setLoaded] = useState<SyllabusView | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [baseline, setBaseline] = useState<string>(serialize([]));
  const [meta, setMeta] = useState<Meta>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [emptyNotice, setEmptyNotice] = useState<string[] | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Latest state for async callbacks (previews resolve long after the click).
  const loadedRef = useRef<SyllabusView | null>(null);
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => {
    loadedRef.current = loaded;
    rowsRef.current = rows;
  }, [loaded, rows]);

  const hasMeta = meta.title !== undefined || meta.medium !== undefined || meta.sourceTemplateId !== undefined;
  const dirty = serialize(rows) !== baseline || hasMeta;

  const applyLoaded = useCallback((view: SyllabusView | null) => {
    const next: Row[] = (view?.chapters ?? []).map((c) => ({
      key: `row-${++keyCounter.current}`,
      id: c.id,
      name: c.name,
      term: c.term,
      weight: String(c.weight),
      needsReview: false,
    }));
    setLoaded(view);
    setRows(next);
    setBaseline(serialize(next));
    setMeta({});
    setWarnings([]);
    setEmptyNotice(null);
    setShowImport(false);
    setConflict(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { syllabus } = await plannerApi.getSyllabus(subjectId);
      applyLoaded(syllabus);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load syllabus'));
    } finally {
      setLoading(false);
    }
  }, [subjectId, applyLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const move = (index: number, delta: -1 | 1) =>
    setRows((rs) => {
      const target = index + delta;
      if (target < 0 || target >= rs.length) return rs;
      const copy = rs.slice();
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });

  const removeRow = async (row: Row) => {
    const ok = await confirm({
      title: 'Delete this chapter?',
      message: row.name.trim() ? `"${row.name.trim()}" will be removed when you save.` : 'It will be removed when you save.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setRows((rs) => rs.filter((r) => r.key !== row.key));
  };

  const addRow = () =>
    setRows((rs) =>
      rs.length >= MAX_CHAPTERS
        ? rs
        : [...rs, { key: nextKey(), name: '', term: null, weight: '1', needsReview: false }],
    );

  const handlePreview = async (r: ImportPreview) => {
    if (r.chapters.length === 0) {
      setEmptyNotice(r.warnings.length > 0 ? r.warnings : ['No chapters were found.']);
      return;
    }
    // Previewed rows carry no ids; kept chapters get theirs back via matchChapterIds so their plans survive.
    const existingChapters = loadedRef.current?.chapters ?? [];
    if (loadedRef.current || rowsRef.current.length > 0) {
      const ok = await confirm({
        title: 'Replace the current chapters?',
        message: 'Chapters that match by name or position keep their plans; the rest are replaced.',
        confirmLabel: 'Replace',
        tone: 'danger',
      });
      if (!ok) return;
    }
    const incoming = r.chapters.slice(0, MAX_CHAPTERS);
    const matched = matchChapterIds(existingChapters, incoming);
    setRows(
      matched.map((c) => ({
        key: nextKey(),
        ...(c.id ? { id: c.id } : {}),
        name: c.name,
        term: c.term,
        weight: String(c.weight),
        needsReview: c.needsReview,
      })),
    );
    setMeta({ title: r.title, medium: r.medium, sourceTemplateId: r.sourceTemplateId });
    setWarnings(r.warnings);
    setEmptyNotice(null);
    setShowImport(false);
    if (r.chapters.length > MAX_CHAPTERS) {
      toast.warning(`Only the first ${MAX_CHAPTERS} chapters were kept.`);
    }
  };

  const errors: string[] = [];
  if (rows.length < 1) errors.push('Add at least one chapter.');
  if (rows.length > MAX_CHAPTERS) errors.push(`A syllabus can have at most ${MAX_CHAPTERS} chapters.`);
  if (rows.some((r) => !nameValid(r.name))) errors.push(`Every chapter needs a name of 1 to ${MAX_NAME} characters.`);
  if (rows.some((r) => !weightValid(r.weight))) errors.push(`Weight must be a whole number from ${MIN_WEIGHT} to ${MAX_WEIGHT}.`);
  const valid = errors.length === 0;

  const save = async () => {
    if (savingRef.current || !valid || !dirty || conflict) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const view = await plannerApi.saveSyllabus(subjectId, {
        chapters: rows.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          name: r.name.trim(),
          term: r.term,
          weight: Number(r.weight),
        })),
        ...(meta.title !== undefined ? { title: meta.title } : {}),
        ...(meta.medium !== undefined ? { medium: meta.medium } : {}),
        ...(meta.sourceTemplateId !== undefined ? { sourceTemplateId: meta.sourceTemplateId } : {}),
        expectedUpdatedAt: loaded ? loaded.updatedAt : null,
      });
      applyLoaded(view);
      toast.success('Syllabus saved');
    } catch (err) {
      if (isConflict(err)) setConflict(true);
      else toast.error(getErrorMessage(err, 'Failed to save syllabus'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const reload = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Reload the syllabus?',
        message: 'Reloading discards your unsaved edits.',
        confirmLabel: 'Reload',
        tone: 'danger',
      });
      if (!ok) return;
    }
    await load();
  };

  if (loading) {
    return <div className="rounded-2xl border border-border/50 bg-card h-64 animate-pulse" />;
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-8 flex flex-col items-center gap-3 text-center">
        <AlertCircle size={28} className="text-destructive" />
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw size={14} /> Retry
        </Button>
      </div>
    );
  }

  const showEmptyImport = !loaded && rows.length === 0;

  return (
    <div className="space-y-4">
      {conflict && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <TriangleAlert size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Someone else changed this syllabus</p>
              <p className="text-xs text-muted-foreground">Your changes were not saved. Reload to see the latest version.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void reload()}>
            <RefreshCw size={14} /> Reload
          </Button>
        </div>
      )}

      {(showEmptyImport || showImport) && (
        <div className="space-y-2">
          {showImport && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Replace from…</p>
              <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>
                Cancel
              </Button>
            </div>
          )}
          <SyllabusImport subjectId={subjectId} onPreview={(r) => void handlePreview(r)} />
          {emptyNotice && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
              {emptyNotice.map((w, i) => (
                <p key={i} className="text-sm">
                  {w}
                </p>
              ))}
              <p className="text-xs text-muted-foreground">
                Nothing was changed. Try pasting the chapter list instead.
              </p>
            </div>
          )}
        </div>
      )}

      {rows.length > 0 || loaded ? (
        <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">
              Chapters <span className="text-muted-foreground font-normal">({rows.length})</span>
            </p>
            {!showImport && (
              <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
                Replace from…
              </Button>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-sm">
                  {w}
                </p>
              ))}
            </div>
          )}

          <ul className="space-y-2">
            {rows.map((row, i) => {
              const nameBad = !nameValid(row.name);
              const weightBad = !weightValid(row.weight);
              return (
                <li
                  key={row.key}
                  className={`rounded-xl border p-2.5 space-y-1.5 ${
                    row.needsReview ? 'border-amber-500/50 bg-amber-500/10' : 'border-border/50'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-6 text-xs text-muted-foreground text-right shrink-0">{i + 1}</span>
                    <Input
                      value={row.name}
                      maxLength={MAX_NAME + 50}
                      onChange={(e) => updateRow(row.key, { name: e.target.value, needsReview: false })}
                      aria-label={`Chapter ${i + 1} name`}
                      aria-invalid={nameBad}
                      placeholder="Chapter name"
                      className="flex-1 min-w-[12rem]"
                    />
                    <select
                      value={row.term ?? ''}
                      onChange={(e) => updateRow(row.key, { term: e.target.value === '' ? null : Number(e.target.value) })}
                      aria-label={`Chapter ${i + 1} term`}
                      className="h-8 rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30"
                    >
                      <option value="">No term</option>
                      {[1, 2, 3, 4].map((t) => (
                        <option key={t} value={t}>
                          Term {t}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={MIN_WEIGHT}
                      max={MAX_WEIGHT}
                      step={1}
                      value={row.weight}
                      onChange={(e) => updateRow(row.key, { weight: e.target.value })}
                      aria-label={`Chapter ${i + 1} weight`}
                      aria-invalid={weightBad}
                      className="w-20"
                    />
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                        <ArrowUp size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === rows.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown size={14} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => void removeRow(row)} aria-label="Delete chapter">
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {row.needsReview && (
                    <p className="pl-8 text-xs text-amber-700 dark:text-amber-400">Check this name</p>
                  )}
                  {nameBad && <p className="pl-8 text-xs text-destructive">Enter a name (up to {MAX_NAME} characters).</p>}
                  {weightBad && (
                    <p className="pl-8 text-xs text-destructive">
                      Weight must be a whole number from {MIN_WEIGHT} to {MAX_WEIGHT}.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Button variant="outline" size="sm" onClick={addRow} disabled={rows.length >= MAX_CHAPTERS}>
              <Plus size={14} /> Add chapter
            </Button>
            <div className="flex items-center gap-3">
              {errors.length > 0 && <p className="text-xs text-destructive">{errors[0]}</p>}
              <Button onClick={() => void save()} disabled={!valid || !dirty || saving || conflict}>
                {saving ? 'Saving…' : 'Save syllabus'}
              </Button>
            </div>
          </div>

          {loaded && (
            <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
              Last edited by {loaded.updatedByName}, {new Date(loaded.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
