'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DAYS: Array<{ key: string; label: string }> = [
  { key: '1', label: 'Mon' },
  { key: '2', label: 'Tue' },
  { key: '3', label: 'Wed' },
  { key: '4', label: 'Thu' },
  { key: '5', label: 'Fri' },
  { key: '6', label: 'Sat' },
  { key: '7', label: 'Sun' },
];

const MAX_PER_DAY = 8;

function toDraft(pattern: Record<string, number> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of DAYS) out[d.key] = pattern && pattern[d.key] ? String(pattern[d.key]) : '';
  return out;
}

function valid(v: string): boolean {
  if (v.trim() === '') return true;
  if (!/^\d+$/.test(v.trim())) return false;
  return Number(v) <= MAX_PER_DAY;
}

interface Props {
  pattern: Record<string, number> | null;
  busy: boolean;
  onSave: (days: Record<string, number> | null) => void;
}

export function PacingPatternEditor({ pattern, busy, onSave }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(pattern));
  // Reset only when the pattern's content changes, not on every new view object (a plan save returns a new one).
  const patternKey = JSON.stringify(toDraft(pattern));
  useEffect(() => setDraft(JSON.parse(patternKey) as Record<string, string>), [patternKey]);

  const allValid = DAYS.every((d) => valid(draft[d.key]));
  const toDays = (): Record<string, number> => {
    const days: Record<string, number> = {};
    for (const d of DAYS) {
      const v = draft[d.key].trim();
      if (v !== '') days[d.key] = Number(v);
    }
    return days;
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-bold">Weekly pattern</p>
        <p className="text-xs text-muted-foreground">
          No published timetable is used, so enter how many periods you teach this subject on each weekday (0 to {MAX_PER_DAY}).
        </p>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {DAYS.map((d) => (
          <label key={d.key} className="space-y-1 text-xs text-muted-foreground">
            {d.label}
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_PER_DAY}
              step={1}
              value={draft[d.key]}
              disabled={busy}
              aria-invalid={!valid(draft[d.key])}
              onChange={(e) => setDraft((p) => ({ ...p, [d.key]: e.target.value }))}
              placeholder="0"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!allValid && <p className="text-xs text-destructive">Use whole numbers from 0 to {MAX_PER_DAY}.</p>}
        <Button variant="outline" size="sm" disabled={busy || pattern === null} onClick={() => onSave(null)}>
          Clear pattern
        </Button>
        <Button size="sm" disabled={busy || !allValid} onClick={() => onSave(toDays())}>
          Save pattern
        </Button>
      </div>
    </div>
  );
}
