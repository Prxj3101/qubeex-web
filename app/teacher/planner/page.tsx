'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { plannerApi, type PlannerSubject } from '@/lib/plannerApi';
import { getErrorMessage } from '@/lib/error';

function SubjectCard({ subject }: { subject: PlannerSubject }) {
  const divisions = subject.divisions.map((d) => d.name).join(', ');
  return (
    <Link
      href={`/teacher/planner/${subject.subjectId}`}
      className="rounded-2xl border border-border/50 bg-card p-4 flex flex-col gap-2 hover:shadow-md hover:shadow-black/10 hover:border-border transition-all duration-200"
      data-dashboard-surface=""
    >
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
          <BookOpenCheck size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{subject.subjectName}</p>
          <p className="text-[11px] text-muted-foreground truncate">{subject.standardName}</p>
        </div>
      </div>
      {divisions && <p className="text-xs text-muted-foreground">Divisions: {divisions}</p>}
      <p
        className={`text-xs font-semibold ${
          subject.hasSyllabus ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
        }`}
      >
        {subject.hasSyllabus
          ? `Syllabus set up · ${subject.chapterCount} ${subject.chapterCount === 1 ? 'chapter' : 'chapters'}`
          : 'Not set up yet'}
      </p>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border/50 bg-card p-4 h-28 animate-pulse" />
      ))}
    </div>
  );
}

export default function PlannerPage() {
  const [subjects, setSubjects] = useState<PlannerSubject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSubjects(await plannerApi.listSubjects());
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to load subjects');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5 pt-2">
      <div>
        <h1 className="text-xl font-bold">Planner</h1>
        <p className="text-sm text-muted-foreground">Set up the syllabus for each subject you teach.</p>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <div className="rounded-2xl border border-border/50 bg-card p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={28} className="text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : !subjects || subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 flex flex-col items-center gap-2 text-center">
          <BookOpenCheck size={28} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No subjects assigned to you this year yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s) => (
            <SubjectCard key={s.subjectId} subject={s} />
          ))}
        </div>
      )}
    </div>
  );
}
