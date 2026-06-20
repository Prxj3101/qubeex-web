'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MarksheetMeta, ExamColumn, ScoreEntry, GradedSubjectItem, GradedScoreEntry, MarksheetStudent,
  getMarksheet, initMarksheet, addColumn, editColumn, deleteColumn, reorderColumns,
  saveScores, addGradedSubject, editGradedSubject, deleteGradedSubject,
  reorderGradedSubjects, updateGradedSectionTitle, saveGradedScores, publishMarksheet,
  getClassStudents,
} from './marksheetApi';

export interface UseMarksheetResult {
  loading: boolean;
  marksheet: MarksheetMeta | null;
  students: MarksheetStudent[];
  examColumns: Record<string, ExamColumn[]>;
  scores: Record<string, Record<string, ScoreEntry>>;
  gradedSubjects: GradedSubjectItem[];
  gradedScores: Record<string, Record<string, GradedScoreEntry>>;
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
  handlePublish: () => Promise<{ pdfUrl: string; shareToken: string }>;
}

function getAcademicYear(): string {
  const now = new Date();
  const yr = now.getFullYear();
  return now.getMonth() >= 5
    ? `${yr}-${String(yr + 1).slice(2)}`
    : `${yr - 1}-${String(yr).slice(2)}`;
}

export function useMarksheet(divisionId: string): UseMarksheetResult {
  const academicYear = getAcademicYear();
  const [loading, setLoading] = useState(true);
  const [marksheet, setMarksheet] = useState<MarksheetMeta | null>(null);
  const [students, setStudents] = useState<MarksheetStudent[]>([]);
  const [examColumns, setExamColumns] = useState<Record<string, ExamColumn[]>>({});
  const [scores, setScores] = useState<Record<string, Record<string, ScoreEntry>>>({});
  const [gradedSubjects, setGradedSubjects] = useState<GradedSubjectItem[]>([]);
  const [gradedScores, setGradedScores] = useState<Record<string, Record<string, GradedScoreEntry>>>({});
  const [gradedSectionTitle, setGradedSectionTitle] = useState('Graded Subjects');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const marksheetIdRef = useRef<string | null>(null);
  const dirtySubjectsRef = useRef<Set<string>>(new Set());
  const scoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gradedDirtyRef = useRef(false);
  const gradedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushScoresRef = useRef<() => Promise<void>>(async () => {});
  const flushGradedScoresRef = useRef<() => Promise<void>>(async () => {});

  // Fix 2: cleanup debounce timers on unmount to prevent stale API calls
  useEffect(() => {
    return () => {
      if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
      if (gradedDebounceRef.current) clearTimeout(gradedDebounceRef.current);
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!divisionId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const data = await getMarksheet(divisionId, academicYear);
        if (cancelled) return;
        if (data === null) {
          // Marksheet not initialised yet — show empty sheet with real student names
          setMarksheet(null);
          try {
            const fallback = await getClassStudents(divisionId);
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
          setGradedSectionTitle(data.marksheet.gradedSectionTitle);
        }
      } catch {
        // unexpected errors (5xx, network) — leave UI empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [divisionId, academicYear]);

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
    const mid = await ensureMarksheetId();
    const col = await addColumn(mid, { subjectId, name, maxMarks, examDate: examDate ?? null });
    setExamColumns(prev => ({
      ...prev,
      [subjectId]: [...(prev[subjectId] ?? []), col],
    }));
  }, [ensureMarksheetId]);

  const handleEditColumn = useCallback(async (colId: string, subjectId: string, payload: { name?: string; maxMarks?: number; examDate?: string | null }) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    const updated = await editColumn(mid, colId, payload);
    setExamColumns(prev => ({
      ...prev,
      [subjectId]: (prev[subjectId] ?? []).map(c => c.id === colId ? updated : c),
    }));
  }, []);

  const handleDeleteColumn = useCallback(async (colId: string, subjectId: string) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    setExamColumns(prev => ({
      ...prev,
      [subjectId]: (prev[subjectId] ?? []).filter(c => c.id !== colId),
    }));
    setScores(prev => {
      const next = { ...prev };
      delete next[colId];
      return next;
    });
    await deleteColumn(mid, colId);
  }, []);

  const handleReorderColumns = useCallback(async (subjectId: string, orderedIds: string[]) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    setExamColumns(prev => {
      const cols = prev[subjectId] ?? [];
      const sorted = orderedIds.map(id => cols.find(c => c.id === id)!).filter(Boolean);
      return { ...prev, [subjectId]: sorted };
    });
    await reorderColumns(mid, subjectId, orderedIds);
  }, []);

  const handleScoreChange = useCallback((examColumnId: string, studentId: string, subjectId: string, value: ScoreEntry) => {
    setScores(prev => ({
      ...prev,
      [examColumnId]: { ...(prev[examColumnId] ?? {}), [studentId]: value },
    }));
    dirtySubjectsRef.current.add(subjectId);
    if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
    scoreDebounceRef.current = setTimeout(() => { flushScoresRef.current(); }, 1500);
  }, [flushScores]);

  const handleAddGradedSubject = useCallback(async (name: string) => {
    const mid = await ensureMarksheetId();
    const gs = await addGradedSubject(mid, name);
    setGradedSubjects(prev => [...prev, gs]);
  }, [ensureMarksheetId]);

  const handleEditGradedSubject = useCallback(async (gsId: string, name: string) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    const updated = await editGradedSubject(mid, gsId, name);
    setGradedSubjects(prev => prev.map(g => g.id === gsId ? updated : g));
  }, []);

  const handleDeleteGradedSubject = useCallback(async (gsId: string) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    setGradedSubjects(prev => prev.filter(g => g.id !== gsId));
    setGradedScores(prev => {
      const next = { ...prev };
      delete next[gsId];
      return next;
    });
    await deleteGradedSubject(mid, gsId);
  }, []);

  const handleReorderGradedSubjects = useCallback(async (orderedIds: string[]) => {
    const mid = marksheetIdRef.current;
    if (!mid) return;
    setGradedSubjects(prev => orderedIds.map(id => prev.find(g => g.id === id)!).filter(Boolean));
    await reorderGradedSubjects(mid, orderedIds);
  }, []);

  const handleGradedSectionTitleChange = useCallback((title: string) => {
    setGradedSectionTitle(title);
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
    gradedDirtyRef.current = true;
    if (gradedDebounceRef.current) clearTimeout(gradedDebounceRef.current);
    gradedDebounceRef.current = setTimeout(() => { flushGradedScoresRef.current(); }, 1500);
  }, [flushGradedScores]);

  const handlePublish = useCallback(async (): Promise<{ pdfUrl: string; shareToken: string }> => {
    const mid = marksheetIdRef.current;
    if (!mid) throw new Error('Marksheet not initialized');
    const result = await publishMarksheet(mid);
    setMarksheet(prev => prev ? { ...prev, status: 'PUBLISHED', shareToken: result.shareToken } : prev);
    return result;
  }, []);

  return {
    loading,
    marksheet,
    students,
    examColumns,
    scores,
    gradedSubjects,
    gradedScores,
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
    handlePublish,
  };
}
