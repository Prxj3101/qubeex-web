'use client';

import { useAcademicYear } from '@/context/AcademicYearContext';

export function AcademicYearSelector() {
  const { years, selectedYearId, setSelectedYearId, loading } = useAcademicYear();

  if (loading) return null;
  if (years.length === 0) {
    return <span className="text-sm text-muted-foreground px-2">Academic year unavailable</span>;
  }

  return (
    <select
      value={selectedYearId ?? ''}
      onChange={(e) => setSelectedYearId(e.target.value)}
      className="text-sm rounded-md border border-border bg-background px-2 py-1"
      aria-label="Academic year"
    >
      {years.map((y) => (
        <option key={y.id} value={y.id}>
          {y.label}{y.isCurrent ? ' (current)' : ''}
        </option>
      ))}
    </select>
  );
}
