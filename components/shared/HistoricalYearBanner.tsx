'use client';

import { useAcademicYear } from '@/context/AcademicYearContext';

export function HistoricalYearBanner() {
  const { years, selectedYearId, isCurrentYearSelected } = useAcademicYear();
  if (isCurrentYearSelected) return null;

  const selected = years.find((y) => y.id === selectedYearId);
  if (!selected) return null;

  return (
    <div className="px-3 py-1.5 text-sm bg-amber-50 text-amber-900 border-b border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900">
      Viewing {selected.label} — read-only.
    </div>
  );
}
