'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import {
  MarksheetMeta, ExamColumn, ScoreEntry, GradedSubjectItem, GradedScoreEntry, MarksheetStudent,
  GradeScaleEntry, RemarkEntry,
  getMarksheet, getAdminMarksheet, initMarksheet, addColumn, editColumn, deleteColumn, reorderColumns,
  saveScores, addGradedSubject, editGradedSubject, deleteGradedSubject,
  reorderGradedSubjects, updateGradedSectionTitle, saveGradedScores, publishMarksheet,
  getClassStudents, updateMarksheetGradeScale, getOnlineMarksheet, saveMarksheetRemark,
} from './marksheetApi';

/** Extracts the backend's `{ error }` message from an axios error, with a fallback. */
function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const ax = err as AxiosError<{ error?: string }>;
  return ax?.response?.data?.error ?? fallback;
}

export interface UseMarksheetResult {
  loading: boolean;
  marksheet: MarksheetMeta | null;
  gradeScale: GradeScaleEntry[];
  hasUnpublishedChanges: boolean;
  students: MarksheetStudent[];
  examColumns: Record<string, ExamColumn[]>;
  scores: Record<string, Record<string, ScoreEntry>>;
  gradedSubjects: GradedSubjectItem[];
  gradedScores: Record<string, Record<string, GradedScoreEntry>>;
  remarks: Record<string, RemarkEntry>;
  gradedSectionTitle: string;
  saveStatus: 'idle' | 'saving' | 'saved';
  handleAddColumn: (subjectId: string, name: string, maxMarks: number, examDate?: string | null) => Promise<void>;
  handleEditColumn: (colId: string, subjectId: string, payload: { name?: string; maxMarks?: number; examDate?: string | null }) => Promise<void>;
  handleDeleteColumn: (colId: string, subjectId: string) => Promise<void>;
  handleReorderColumns: (subjectId: string, orderedIds: string[]) => Promise<void>;
  handleScoreChange: (examColumnId: string, studentId: string, subjectId: string, value: ScoreEntry) => void;
  handleAddGradedSubject: (name: string) => Promise<void>;
  handleEditGradedSubject: (gsId: string, name: string) => Promise<void>;
  handleDeleteGradedSubject: (gsId: string) => Promise<void>;
  handleReorderGradedSubjects: (orderedIds: string[]) => Promise<void>;
  handleGradedSectionTitleChange: (title: string) => void;
  handleGradedScoreChange: (gradedSubjectId: string, studentId: string, value: GradedScoreEntry) => void;
  handleUpdateGradeScale: (scale: GradeScaleEntry[]) => Promise<void>;
  handleRemarkChange: (studentId: string, value: RemarkEntry) => void;
  handlePublish: () => Promise<void>;
}

function getAcademicYear(): string {
  const now = new Date();
  const yr = now.getFullYear();
  return now.getMonth() >= 5
    ? `${yr}-${String(yr + 1).slice(2)}`
    : `${yr - 1}-${String(yr).slice(2)}`;
}

export function useMarksheet(divisionId: string, isAdmin?: boolean): UseMarksheetResult {
  const academicYear = getAcademicYear();
  const [loading, setLoading] = useState(true);
  const [marksheet, setMarksheet] = useState<MarksheetMeta | null>(null);
  const [students, setStudents] = useState<MarksheetStudent[]>([]);
  const [examColumns, setExamColumns] = useState<Record<string, ExamColumn[]>>({});
  const [scores, setScores] = useState<Record<string, Record<string, ScoreEntry>>>({});
  const [gradedSubjects, setGradedSubjects] = useState<GradedSubjectItem[]>([]);
  const [gradedScores, setGradedScores] = useState<Record<string, Record<string, GradedScoreEntry>>>({});
  const [remarks, setRemarks] = useState<Record<string, RemarkEntry>>({});
  const [gradedSectionTitle, setGradedSectionTitle] = useState('Graded Subjects');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [gradeScale, setGradeScale] = useState<GradeScaleEntry[]>([]);

  const marksheetIdRef = useRef<string | null>(null);
  const dirtySubjectsRef = useRef<Set<string>>(new Set());
  const scoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gradedDirtyRef = useRef(false);
  const gradedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushScoresRef = useRef<() => Promise<void>>(async () => {});
  const flushGradedScoresRef = useRef<() => Promise<void>>(async () => {});
  const remarkDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Fix 2: cleanup debounce timers on unmount to prevent stale API calls
  useEffect(() => {
    return () => {
      if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
      if (gradedDebounceRef.current) clearTimeout(gradedDebounceRef.current);
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      Object.values(remarkDebounceRef.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!divisionId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const data = isAdmin
          ? await getAdminMarksheet(divisionId, academicYear)
          : await getMarksheet(divisionId, academicYear);
        if (cancelled) return;
        if (data === null) {
          // Marksheet not initialised yet — show empty sheet with real student names
          setMarksheet(null);
          try {
            const fallback = await getClassStudents(divisionId, isAdmin);
            if (!cancelled) setStudents(fallback);
          } catch {
            // class students unavailable — empty sheet is fine
          }
        } else {
          marksheetIdRef.current = data.marksheet.id;
          setMarksheet(data.marksheet);
          setStudents(data.students);
          setExamColumns(data.examColumns);
          setScores(data.scores);
          setGradedSubjects(data.gradedSubjects);
          setGradedScores(data.gradedScores);
          setRemarks(data.remarks ?? {});
          setGradedSectionTitle(data.marksheet.gradedSectionTitle);
          setGradeScale(data.gradeScale ?? []);
          // Server-persisted, not derived client-side — otherwise this always
          // reset to false on reload/navigation even with real unpublished
          // edits (e.g. a subject teacher entering marks in another tab).
          setHasUnpublishedChanges(data.marksheet.hasUnpublishedChanges ?? false);
        }
      } catch {
        // unexpected errors (5xx, network) — leave UI empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [divisionId, academicYear, isAdmin]);

  const ensureMarksheetId = useCallback(async (): Promise<string> => {
    if (marksheetIdRef.current) return marksheetIdRef.current;
    const result = await initMarksheet(divisionId, academicYear);
    marksheetIdRef.current = result.marksheetId;
    setMarksheet(prev => prev ? prev : {
      id: result.marksheetId,
      academicYear,
      status: 'DRAFT',
      shareToken: result.shareToken,
      gradedSectionTitle: 'Graded Subjects',
    });
    return result.marksheetId;
  }, [divisionId, academicYear]);

  const flushScores = useCallback(async () => {
    const mid = marksheetIdRef.current;
    if (!mid || dirtySubjectsRef.current.size === 0) return;
    const dirty = new Set(dirtySubjectsRef.current);
    dirtySubjectsRef.current.clear();
    setSaveStatus('saving');
    try {
      const currentScores = scores;
      const currentExamColumns = examColumns;
      const currentStudents = students;
      await Promise.all(Array.from(dirty).map(subjectId => {
        const cols = currentExamColumns[subjectId] ?? [];
        const entries = cols.flatMap(col =>
          currentStudents.map(st => ({
            studentId: st.id,
            examColumnId: col.id,
            score: currentScores[col.id]?.[st.id]?.score ?? null,
            isAbsent: currentScores[col.id]?.[st.id]?.isAbsent ?? false,
          }))
        );
        return saveScores(mid, subjectId, entries);
      }));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      dirtySubjectsRef.current = new Set([...dirtySubjectsRef.current, ...dirty]);
      setSaveStatus('idle');
    }
  }, [scores, examColumns, students]);

  const flushGradedScores = useCallback(async () => {
    const mid = marksheetIdRef.current;
    if (!mid || !gradedDirtyRef.current) return;
    gradedDirtyRef.current = false;
    setSaveStatus('saving');
    try {
      const currentGradedScores = gradedScores;
      const currentGradedSubjects = gradedSubjects;
      const currentStudents = students;
      const entries = currentGradedSubjects.flatMap(gs =>
        currentStudents.map(st => ({
          gradedSubjectId: gs.id,
          studentId: st.id,
          term1Grade: currentGradedScores[gs.id]?.[st.id]?.term1Grade ?? null,
          term2Grade: currentGradedScores[gs.id]?.[st.id]?.term2Grade ?? null,
        }))
      );
      await saveGradedScores(mid, entries);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      gradedDirtyRef.current = true;
      setSaveStatus('idle');
    }
  }, [gradedScores, gradedSubjects, students]);

  // Fix 1: keep refs pointing to the latest closure so debounced timeouts always call fresh versions
  useEffect(() => { flushScoresRef.current = flushScores; }, [flushScores]);
  useEffect(() => { flushGradedScoresRef.current = flushGradedScores; }, [flushGradedScores]);

  const handleAddColumn = useCallback(async (subjectId: string, name: string, maxMarks: number, examDate?: string | null) => {
    try {
      const mid = await ensureMarksheetId();
      const col = await addColumn(mid, { subjectId, name, maxMarks, examDate: examDate ?? null });
      setExamColumns(prev => ({
        ...prev,
        [subjectId]: [...(prev[subjectId] ?? []), col],
      }));
      setHasUnpublishedChanges(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not add exam column'));
    }
  }, [ensureMarksheetId]);

  const handleEditColumn = useCallback(async (colId: string, subjectId: string, payload: { name?: string; maxMarks?: number; examDate?: string | null }) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    try {
      const updated = await editColumn(mid, colId, payload);
      setExamColumns(prev => ({
        ...prev,
        [subjectId]: (prev[subjectId] ?? []).map(c => c.id === colId ? updated : c),
      }));
      setHasUnpublishedChanges(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not update exam column'));
    }
  }, []);

  const handleDeleteColumn = useCallback(async (colId: string, subjectId: string) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    // Snapshot for rollback if the server rejects the delete.
    const prevCols = examColumns[subjectId] ?? [];
    const prevColScores = scores[colId];
    setExamColumns(prev => ({
      ...prev,
      [subjectId]: (prev[subjectId] ?? []).filter(c => c.id !== colId),
    }));
    setScores(prev => {
      const next = { ...prev };
      delete next[colId];
      return next;
    });
    try {
      await deleteColumn(mid, colId);
      setHasUnpublishedChanges(true);
    } catch (err) {
      setExamColumns(prev => ({ ...prev, [subjectId]: prevCols }));
      if (prevColScores !== undefined) setScores(prev => ({ ...prev, [colId]: prevColScores }));
      toast.error(apiErrorMessage(err, 'Could not delete exam column'));
    }
  }, [examColumns, scores]);

  const handleReorderColumns = useCallback(async (subjectId: string, orderedIds: string[]) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    const prevCols = examColumns[subjectId] ?? [];
    setExamColumns(prev => {
      const cols = prev[subjectId] ?? [];
      const sorted = orderedIds.map(id => cols.find(c => c.id === id)!).filter(Boolean);
      return { ...prev, [subjectId]: sorted };
    });
    try {
      await reorderColumns(mid, subjectId, orderedIds);
      setHasUnpublishedChanges(true);
    } catch (err) {
      setExamColumns(prev => ({ ...prev, [subjectId]: prevCols }));
      toast.error(apiErrorMessage(err, 'Could not reorder columns'));
    }
  }, [examColumns]);

  const handleScoreChange = useCallback((examColumnId: string, studentId: string, subjectId: string, value: ScoreEntry) => {
    setScores(prev => ({
      ...prev,
      [examColumnId]: { ...(prev[examColumnId] ?? {}), [studentId]: value },
    }));
    setHasUnpublishedChanges(true);
    dirtySubjectsRef.current.add(subjectId);
    if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
    scoreDebounceRef.current = setTimeout(() => { flushScoresRef.current(); }, 1500);
  }, [flushScores]);

  const handleAddGradedSubject = useCallback(async (name: string) => {
    try {
      const mid = await ensureMarksheetId();
      const gs = await addGradedSubject(mid, name);
      setGradedSubjects(prev => [...prev, gs]);
      setHasUnpublishedChanges(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not add graded subject'));
    }
  }, [ensureMarksheetId]);

  const handleEditGradedSubject = useCallback(async (gsId: string, name: string) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    try {
      const updated = await editGradedSubject(mid, gsId, name);
      setGradedSubjects(prev => prev.map(g => g.id === gsId ? updated : g));
      setHasUnpublishedChanges(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not update graded subject'));
    }
  }, []);

  const handleDeleteGradedSubject = useCallback(async (gsId: string) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    const prevSubjects = gradedSubjects;
    const prevGsScores = gradedScores[gsId];
    setGradedSubjects(prev => prev.filter(g => g.id !== gsId));
    setGradedScores(prev => {
      const next = { ...prev };
      delete next[gsId];
      return next;
    });
    try {
      await deleteGradedSubject(mid, gsId);
      setHasUnpublishedChanges(true);
    } catch (err) {
      setGradedSubjects(prevSubjects);
      if (prevGsScores !== undefined) setGradedScores(prev => ({ ...prev, [gsId]: prevGsScores }));
      toast.error(apiErrorMessage(err, 'Could not delete graded subject'));
    }
  }, [gradedSubjects, gradedScores]);

  const handleReorderGradedSubjects = useCallback(async (orderedIds: string[]) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    const prevSubjects = gradedSubjects;
    setGradedSubjects(prev => orderedIds.map(id => prev.find(g => g.id === id)!).filter(Boolean));
    try {
      await reorderGradedSubjects(mid, orderedIds);
      setHasUnpublishedChanges(true);
    } catch (err) {
      setGradedSubjects(prevSubjects);
      toast.error(apiErrorMessage(err, 'Could not reorder graded subjects'));
    }
  }, [gradedSubjects]);

  const handleGradedSectionTitleChange = useCallback((title: string) => {
    setGradedSectionTitle(title);
    setHasUnpublishedChanges(true);
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(async () => {
      const mid = marksheetIdRef.current;
      if (!mid) return;
      await updateGradedSectionTitle(mid, title).catch(() => {});
    }, 1500);
  }, []);

  const handleGradedScoreChange = useCallback((gradedSubjectId: string, studentId: string, value: GradedScoreEntry) => {
    setGradedScores(prev => ({
      ...prev,
      [gradedSubjectId]: { ...(prev[gradedSubjectId] ?? {}), [studentId]: value },
    }));
    setHasUnpublishedChanges(true);
    gradedDirtyRef.current = true;
    if (gradedDebounceRef.current) clearTimeout(gradedDebounceRef.current);
    gradedDebounceRef.current = setTimeout(() => { flushGradedScoresRef.current(); }, 1500);
  }, [flushGradedScores]);

  const handleRemarkChange = useCallback((studentId: string, value: RemarkEntry) => {
    setRemarks(prev => ({ ...prev, [studentId]: value }));
    setHasUnpublishedChanges(true);
    const existing = remarkDebounceRef.current[studentId];
    if (existing) clearTimeout(existing);
    remarkDebounceRef.current[studentId] = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const mid = await ensureMarksheetId();
        await saveMarksheetRemark(mid, studentId, value);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        setSaveStatus('idle');
        toast.error(apiErrorMessage(err, 'Could not save conduct/remarks'));
      }
    }, 1200);
  }, [ensureMarksheetId]);

  const handleUpdateGradeScale = useCallback(async (scale: GradeScaleEntry[]) => {
    const mid = marksheetIdRef.current;
    if (!mid) throw new Error('Marksheet not initialized');
    const saved = await updateMarksheetGradeScale(mid, scale);
    setGradeScale(saved);
    setHasUnpublishedChanges(true);
  }, []);

  const handlePublish = useCallback(async (): Promise<void> => {
    const mid = marksheetIdRef.current;
    if (!mid) throw new Error('Marksheet not initialized');
    await publishMarksheet(mid);
    setMarksheet(prev => prev ? { ...prev, status: 'PUBLISHED' } : prev);
    setHasUnpublishedChanges(false);
  }, []);

  return {
    loading,
    marksheet,
    gradeScale,
    hasUnpublishedChanges,
    students,
    examColumns,
    scores,
    gradedSubjects,
    gradedScores,
    remarks,
    gradedSectionTitle,
    saveStatus,
    handleAddColumn,
    handleEditColumn,
    handleDeleteColumn,
    handleReorderColumns,
    handleScoreChange,
    handleAddGradedSubject,
    handleEditGradedSubject,
    handleDeleteGradedSubject,
    handleReorderGradedSubjects,
    handleGradedSectionTitleChange,
    handleGradedScoreChange,
    handleUpdateGradeScale,
    handleRemarkChange,
    handlePublish,
  };
}

export interface UseOnlineMarksheetResult {
  loading: boolean;
  students: MarksheetStudent[];
  examColumns: Record<string, ExamColumn[]>;
  scores: Record<string, Record<string, ScoreEntry>>;
}

// Read-only counterpart to useMarksheet — the online sheet is auto-computed
// from completed tests + attempts on the server (see
// onlineMarksheet.service.ts), so there's nothing here to edit, init, or
// publish. Just students (same roster call the offline sheet's empty-state
// fallback uses) plus whatever the server has computed.
export function useOnlineMarksheet(divisionId: string, isAdmin?: boolean): UseOnlineMarksheetResult {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<MarksheetStudent[]>([]);
  const [examColumns, setExamColumns] = useState<Record<string, ExamColumn[]>>({});
  const [scores, setScores] = useState<Record<string, Record<string, ScoreEntry>>>({});

  useEffect(() => {
    if (!divisionId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([getOnlineMarksheet(divisionId, isAdmin), getClassStudents(divisionId, isAdmin)])
      .then(([data, roster]) => {
        if (cancelled) return;
        setExamColumns(data.examColumns);
        setScores(data.scores);
        setStudents(roster);
      })
      .catch(() => {
        // unexpected errors (5xx, network) — leave UI empty
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [divisionId, isAdmin]);

  return { loading, students, examColumns, scores };
}
