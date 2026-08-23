import api from './api';

export interface MarksheetMeta {
  id: string;
  academicYear: string;
  status: 'DRAFT' | 'PUBLISHED';
  shareToken: string | null;
  gradedSectionTitle: string;
  // Persisted server-side (not just client state) so it survives page
  // reload/navigation — true from the moment any edit happens after the
  // last publish, reset to false by publish/re-publish.
  hasUnpublishedChanges?: boolean;
}

export interface ExamColumn {
  id: string;
  subjectId: string;
  name: string;
  maxMarks: number;
  examDate: string | null;
  order: number;
}

export interface ScoreEntry {
  score: number | null;
  isAbsent: boolean;
}

export interface GradedSubjectItem {
  id: string;
  name: string;
  order: number;
}

export interface GradedScoreEntry {
  term1Grade: string | null;
  term2Grade: string | null;
}

export interface MarksheetStudent {
  id: string;
  name: string;
  rollNo: string;
  avatarUrl?: string | null;
}

export interface GradeScaleEntry {
  grade: string;
  minPct: number;
}

export interface RemarkEntry {
  conduct: string | null;
  remarks: string | null;
}

export interface MarksheetData {
  marksheet: MarksheetMeta;
  gradeScale: GradeScaleEntry[];
  examColumns: Record<string, ExamColumn[]>;
  scores: Record<string, Record<string, ScoreEntry>>;
  gradedSubjects: GradedSubjectItem[];
  gradedScores: Record<string, Record<string, GradedScoreEntry>>;
  remarks: Record<string, RemarkEntry>;
  students: MarksheetStudent[];
}

export function resolveGrade(pct: number, scale: GradeScaleEntry[]): string {
  if (scale.length === 0) {
    if (pct >= 75) return 'A';
    if (pct >= 60) return 'B';
    if (pct >= 45) return 'C';
    if (pct >= 35) return 'D';
    return 'F';
  }
  const sorted = [...scale].sort((a, b) => b.minPct - a.minPct);
  for (const entry of sorted) {
    if (pct >= entry.minPct) return entry.grade;
  }
  return sorted[sorted.length - 1]?.grade ?? 'F';
}

export async function updateMarksheetGradeScale(marksheetId: string, gradeScale: GradeScaleEntry[]): Promise<GradeScaleEntry[]> {
  const res = await api.patch(`/teacher/marksheet/${marksheetId}/grade-scale`, { gradeScale });
  return res.data.data.gradeScale as GradeScaleEntry[];
}

export async function getMarksheet(divisionId: string, academicYear: string, opts?: { publishedOnly?: boolean }): Promise<MarksheetData | null> {
  const res = await api.get(`/teacher/marksheet/division/${divisionId}`, {
    params: { academicYear, ...(opts?.publishedOnly ? { publishedOnly: '1' } : {}) },
    validateStatus: (s) => s === 200 || s === 404,
  });
  if (res.status === 404) return null;
  return res.data.data as MarksheetData;
}

export async function getAdminMarksheet(divisionId: string, academicYear: string, opts?: { publishedOnly?: boolean }): Promise<MarksheetData | null> {
  const res = await api.get(`/admin/marksheet/division/${divisionId}`, {
    params: { academicYear, ...(opts?.publishedOnly ? { publishedOnly: '1' } : {}) },
    validateStatus: (s) => s === 200 || s === 404,
  });
  if (res.status === 404) return null;
  return res.data.data as MarksheetData;
}

export async function initMarksheet(divisionId: string, academicYear: string): Promise<{ marksheetId: string; shareToken: string }> {
  const res = await api.post(`/teacher/marksheet/division/${divisionId}/init`, { academicYear });
  return res.data.data as { marksheetId: string; shareToken: string };
}

// An exam column ("Unit Test 1", etc.) is one exam across every subject in
// the division, not just the subject the teacher was viewing when they hit
// "+" — the backend fans the same name/maxMarks/examDate out to every
// subject and returns the full set via `allCreated` (each tagged with its
// own subjectId) alongside `data`, the one for the subject that was
// explicitly picked.
export async function addColumn(
  marksheetId: string,
  payload: { subjectId: string; name: string; maxMarks: number; examDate?: string | null }
): Promise<{ column: ExamColumn; allCreated: ExamColumn[] }> {
  const res = await api.post(`/teacher/marksheet/${marksheetId}/columns`, payload);
  return { column: res.data.data as ExamColumn, allCreated: (res.data.allCreated ?? [res.data.data]) as ExamColumn[] };
}

export async function editColumn(
  marksheetId: string,
  colId: string,
  payload: { name?: string; maxMarks?: number; examDate?: string | null }
): Promise<ExamColumn> {
  const res = await api.patch(`/teacher/marksheet/${marksheetId}/columns/${colId}`, payload);
  return res.data.data as ExamColumn;
}

export async function deleteColumn(marksheetId: string, colId: string): Promise<void> {
  await api.delete(`/teacher/marksheet/${marksheetId}/columns/${colId}`);
}

// Backend fans this reorder out to every subject (the same exam column
// always lines up across subjects, matching add/delete's own fan-out) and
// returns every column it touched — not just the ones in the subject that
// was dragged — so the caller can re-sort every affected subject's list.
export async function reorderColumns(marksheetId: string, subjectId: string, orderedIds: string[]): Promise<{ id: string; subjectId: string; order: number }[]> {
  const res = await api.put(`/teacher/marksheet/${marksheetId}/columns/${subjectId}/reorder`, { orderedIds });
  return (res.data.updated ?? []) as { id: string; subjectId: string; order: number }[];
}

export async function saveScores(
  marksheetId: string,
  subjectId: string,
  scores: { studentId: string; examColumnId: string; score: number | null; isAbsent: boolean }[]
): Promise<void> {
  await api.put(`/teacher/marksheet/${marksheetId}/scores/subject/${subjectId}`, { scores });
}

export async function addGradedSubject(marksheetId: string, name: string): Promise<GradedSubjectItem> {
  const res = await api.post(`/teacher/marksheet/${marksheetId}/graded-subjects`, { name });
  return res.data.data as GradedSubjectItem;
}

export async function editGradedSubject(marksheetId: string, gsId: string, name: string): Promise<GradedSubjectItem> {
  const res = await api.patch(`/teacher/marksheet/${marksheetId}/graded-subjects/${gsId}`, { name });
  return res.data.data as GradedSubjectItem;
}

export async function deleteGradedSubject(marksheetId: string, gsId: string): Promise<void> {
  await api.delete(`/teacher/marksheet/${marksheetId}/graded-subjects/${gsId}`);
}

export async function reorderGradedSubjects(marksheetId: string, orderedIds: string[]): Promise<void> {
  await api.put(`/teacher/marksheet/${marksheetId}/graded-subjects/reorder`, { orderedIds });
}

export async function updateGradedSectionTitle(marksheetId: string, title: string): Promise<void> {
  await api.patch(`/teacher/marksheet/${marksheetId}/graded-section-title`, { title });
}

export async function saveGradedScores(
  marksheetId: string,
  scores: { gradedSubjectId: string; studentId: string; term1Grade?: string | null; term2Grade?: string | null }[]
): Promise<void> {
  await api.put(`/teacher/marksheet/${marksheetId}/graded-scores`, { scores });
}

// Conduct/Remarks — class teacher only (write), read-only to subject teachers
// and to the student themselves (via /student/marksheet).
export async function saveMarksheetRemark(
  marksheetId: string,
  studentId: string,
  payload: { conduct?: string | null; remarks?: string | null }
): Promise<RemarkEntry> {
  const res = await api.put(`/teacher/marksheet/${marksheetId}/remarks/${studentId}`, payload);
  return res.data.data as RemarkEntry;
}

export async function publishMarksheet(marksheetId: string): Promise<void> {
  await api.post(`/teacher/marksheet/${marksheetId}/publish`);
}

export async function downloadMarksheetPdf(
  marksheetId: string,
  scope: 'full' | 'subject' | 'exam',
  subjectId?: string
): Promise<Blob> {
  const res = await api.get(`/teacher/marksheet/${marksheetId}/download`, {
    params: { scope, ...(subjectId ? { subjectId } : {}) },
    responseType: 'blob',
  });
  return res.data as Blob;
}

export interface OnlineMarksheetData {
  examColumns: Record<string, ExamColumn[]>;
  scores: Record<string, Record<string, ScoreEntry>>;
}

// Auto-computed from completed tests + attempts — no init step, always live,
// so unlike the offline sheet there's no "not initialised yet" 404 case.
export async function getOnlineMarksheet(divisionId: string, isAdmin?: boolean): Promise<OnlineMarksheetData> {
  const res = await api.get(
    isAdmin ? `/admin/marksheet/division/${divisionId}/online` : `/teacher/marksheet/division/${divisionId}/online`
  );
  return res.data.data as OnlineMarksheetData;
}

export async function getClassStudents(divisionId: string, isAdmin?: boolean): Promise<MarksheetStudent[]> {
  const res = await api.get(isAdmin ? `/admin/campus/divisions/${divisionId}/students` : `/teacher/classes/${divisionId}/students`);
  const raw = res.data.data as Array<{ id: string; rollNo: number | string; user: { name: string }; avatarUrl?: string | null }>;
  return raw.map(s => ({ id: s.id, name: s.user.name, rollNo: String(s.rollNo), avatarUrl: s.avatarUrl ?? null }));
}
