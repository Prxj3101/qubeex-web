'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BookOpenCheck, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { plannerApi, type PlannerSubject } from '@/lib/plannerApi';
import { getErrorMessage } from '@/lib/error';
import { SyllabusEditor } from '@/components/planner/SyllabusEditor';

export default function PlannerSubjectPage() {
  const params = useParams();
  const subjectId = typeof params.subjectId === 'string' ? params.subjectId : '';
  const [subject, setSubject] = useState<PlannerSubject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    plannerApi
      .listSubjects()
      .then((list) => {
        if (!cancelled) setSubject(list.find((s) => s.subjectId === subjectId) ?? null);
      })
      .catch((err) => {
        if (!cancelled) toast.error(getErrorMessage(err, 'Failed to load subject'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const back = (
    <Link
      href="/teacher/planner"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft size={14} /> Back to planner
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-12 w-64 rounded-xl bg-muted animate-pulse" />
        <div className="rounded-2xl border border-border/50 bg-card h-64 animate-pulse" />
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="space-y-4 pt-2">
        {back}
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 flex flex-col items-center gap-2 text-center">
          <BookOpenCheck size={28} className="text-muted-foreground" />
          <p className="text-sm font-semibold">You are not assigned to this subject</p>
          <p className="text-sm text-muted-foreground">Pick one of your subjects from the planner.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2">
      {back}
      <div>
        <h1 className="text-xl font-bold">{subject.subjectName}</h1>
        <p className="text-sm text-muted-foreground">{subject.standardName} · Syllabus</p>
      </div>
      {subject.divisions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subject.divisions.map((d) => (
            <Link
              key={d.id}
              href={`/teacher/planner/${encodeURIComponent(subjectId)}/plan/${encodeURIComponent(d.id)}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/50 bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <CalendarRange size={14} /> Pacing plan — {d.name}
            </Link>
          ))}
        </div>
      )}
      <SyllabusEditor subjectId={subjectId} />
    </div>
  );
}
