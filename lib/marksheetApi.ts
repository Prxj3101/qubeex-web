import api from './api';

export interface MarksheetMeta {
  id: string;
  academicYear: string;
  status: 'DRAFT' | 'PUBLISHED';
  shareToken: string | null;
  gradedSectionTitle: string;
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
  term1Grade: 'A+' | 'A' | 'B' | 'C' | 'D' | null;
  term2Grade: 'A+' | 'A' | 'B' | 'C' | 'D' | null;
}

export interface MarksheetStudent {
  id: string;
  name: string;
  rollNo: string;
}

export interface MarksheetData {
  marksheet: MarksheetMeta;
  examColumns: Record<string, ExamColumn[]>;
  scores: Record<string, Record<string, ScoreEntry>>;
  gradedSubjects: GradedSubjectItem[];
  gradedScores: Record<string, Record<string, GradedScoreEntry>>;
  students: MarksheetStudent[];
}

export async function getMarksheet(divisionId: string, academicYear: string): Promise<MarksheetData> {
  const res = await api.get(`/teacher/marksheet/${divisionId}`, { params: { academicYear } });
  return res.data.data as MarksheetData;
}

export async function initMarksheet(divisionId: string, academicYear: string): Promise<{ marksheetId: string; shareToken: string }> {
  const res = await api.post('/teacher/marksheet/init', { divisionId, academicYear });
  return res.data.data as { marksheetId: string; shareToken: string };
}

export async function addColumn(
  marksheetId: string,
  payload: { subjectId: string; name: string; maxMarks: number; examDate?: string | null }
): Promise<ExamColumn> {
  const res = await api.post(`/teacher/marksheet/${marksheetId}/columns`, payload);
  return res.data.data as ExamColumn;
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

export async function reorderColumns(marksheetId: string, subjectId: string, orderedIds: string[]): Promise<void> {
  await api.patch(`/teacher/marksheet/${marksheetId}/columns/reorder`, { subjectId, orderedIds });
}

export async function saveScores(
  marksheetId: string,
  subjectId: string,
  scores: { studentId: string; examColumnId: string; score: number | null; isAbsent: boolean }[]
): Promise<void> {
  await api.post(`/teacher/marksheet/${marksheetId}/scores`, { subjectId, scores });
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
  await api.patch(`/teacher/marksheet/${marksheetId}/graded-subjects/reorder`, { orderedIds });
}

export async function updateGradedSectionTitle(marksheetId: string, title: string): Promise<void> {
  await api.patch(`/teacher/marksheet/${marksheetId}/graded-section-title`, { title });
}

export async function saveGradedScores(
  marksheetId: string,
  scores: { gradedSubjectId: string; studentId: string; term1Grade?: string | null; term2Grade?: string | null }[]
): Promise<void> {
  await api.post(`/teacher/marksheet/${marksheetId}/graded-scores`, { scores });
}

export async function publishMarksheet(marksheetId: string): Promise<{ pdfUrl: string; shareToken: string }> {
  const res = await api.post(`/teacher/marksheet/${marksheetId}/publish`);
  return res.data.data as { pdfUrl: string; shareToken: string };
}
