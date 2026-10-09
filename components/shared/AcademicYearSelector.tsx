'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useAcademicYear } from '@/context/AcademicYearContext';

export function AcademicYearSelector() {
  const { years, selectedYearId, setSelectedYearId, loading } = useAcademicYear();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (loading) return null;
  if (years.length === 0) {
    return <span className="text-sm text-muted-foreground px-2">Academic year unavailable</span>;
  }

  const selected = years.find((y) => y.id === selectedYearId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Academic year"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border bg-background text-xs font-medium hover:border-primary/40 transition-all"
      >
        {selected ? `${selected.label}${selected.isCurrent ? ' (current)' : ''}` : 'Academic year'}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-9 right-0 z-50 rounded-xl shadow-xl py-1 min-w-[150px] max-h-48 overflow-y-auto border border-border bg-background"
          >
            {years.map((y) => (
              <button
                key={y.id}
                type="button"
                onClick={() => {
                  setSelectedYearId(y.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${
                  y.id === selectedYearId ? 'text-primary font-semibold' : ''
                }`}
              >
                {y.label}
                {y.isCurrent ? ' (current)' : ''}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
