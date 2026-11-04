import api from '@/lib/api';

export interface PlannerSubject {
  subjectId: string;
  subjectName: string;
  standardName: string;
  divisions: { id: string; name: string }[];
  hasSyllabus: boolean;
  chapterCount: number;
}

export interface SyllabusChapterView {
  id: string;
  order: number;
  name: string;
  term: number | null;
  weight: number;
}

export interface SyllabusView {
  id: string;
  subjectId: string;
  title: string | null;
  medium: string | null;
  updatedAt: string;
  updatedByName: string;
  chapters: SyllabusChapterView[];
}

export interface SaveSyllabusInput {
  title?: string;
  medium?: string;
  sourceTemplateId?: string;
  expectedUpdatedAt?: string | null;
  chapters: Array<{ id?: string; name: string; term: number | null; weight: number }>;
}

export interface ParsedChapter {
  number: number | null;
  name: string;
  term: number | null;
  startPage: number | null;
  endPage: number | null;
  weight: number;
  needsReview: boolean;
}

export interface PreviewResult {
  chapters: ParsedChapter[];
  warnings: string[];
  indexPage?: number | null;
}

export interface TemplateFilter {
  board?: string;
  medium?: string;
  standardLabel?: string;
  subjectName?: string;
}

export interface TemplateListItem {
  id: string;
  board: string;
  medium: string;
  standardLabel: string;
  subjectName: string;
  title: string;
  chapterCount: number;
}

export interface TemplatePreview {
  title: string;
  medium: string;
  sourceTemplateId: string;
  chapters: ParsedChapter[];
}

export type PeriodSourceKind = 'TIMETABLE' | 'PATTERN' | 'NONE';

export interface NamedTarget {
  label: string;
  date: string;
  periodsBefore: number;
}

export interface PlannedItem {
  itemId: string | null;
  kind: 'CHAPTER' | 'BUFFER';
  chapterId: string | null;
  name: string;
  term: number | null;
  weight: number;
  manual: boolean;
  plannedPeriods: number;
  startDate: string | null;
  endDate: string | null;
  atRisk: boolean;
  removed: boolean;
}

export type PlanViewItem = PlannedItem & { label: string | null; manualPeriods: number | null };

export interface PlanView {
  plan: { id: string | null; updatedAt: string | null; targetEndDate: string | null };
  window: { from: string; to: string };
  source: PeriodSourceKind;
  pattern: Record<string, number> | null;
  availablePeriods: number;
  shortfallPeriods: number;
  warnings: string[];
  items: PlanViewItem[];
  targets: NamedTarget[];
  hasSyllabus: boolean;
}

export interface SavePlanBody {
  targetEndDate?: string | null;
  expectedUpdatedAt?: string | null;
  items: Array<{
    kind: 'CHAPTER' | 'BUFFER';
    chapterId?: string | null;
    label?: string | null;
    manualPeriods?: number | null;
  }>;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

const BASE = '/teacher/planner';

export const plannerApi = {
  async listSubjects(): Promise<PlannerSubject[]> {
    const res = await api.get<ApiEnvelope<PlannerSubject[]>>(`${BASE}/subjects`);
    return res.data.data;
  },

  async getSyllabus(subjectId: string): Promise<{ syllabus: SyllabusView | null }> {
    const res = await api.get<ApiEnvelope<{ syllabus: SyllabusView | null }>>(
      `${BASE}/subjects/${encodeURIComponent(subjectId)}/syllabus`,
    );
    return res.data.data;
  },

  async saveSyllabus(subjectId: string, body: SaveSyllabusInput): Promise<SyllabusView> {
    const res = await api.put<ApiEnvelope<SyllabusView>>(
      `${BASE}/subjects/${encodeURIComponent(subjectId)}/syllabus`,
      body,
    );
    return res.data.data;
  },

  async previewPdf(subjectId: string, file: File): Promise<PreviewResult> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post<ApiEnvelope<PreviewResult>>(
      `${BASE}/subjects/${encodeURIComponent(subjectId)}/syllabus/preview/pdf`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  async previewPaste(subjectId: string, text: string): Promise<PreviewResult> {
    const res = await api.post<ApiEnvelope<PreviewResult>>(
      `${BASE}/subjects/${encodeURIComponent(subjectId)}/syllabus/preview/paste`,
      { text },
    );
    return res.data.data;
  },

  // Library routes answer 404 unless the server flag is on.
  async listLibraryTemplates(filter: TemplateFilter = {}): Promise<TemplateListItem[]> {
    const res = await api.get<ApiEnvelope<TemplateListItem[]>>(`${BASE}/library/templates`, {
      params: filter,
    });
    return res.data.data;
  },

  async adoptTemplate(subjectId: string, templateId: string): Promise<TemplatePreview> {
    const res = await api.post<ApiEnvelope<TemplatePreview>>(
      `${BASE}/subjects/${encodeURIComponent(subjectId)}/syllabus/adopt`,
      { templateId },
    );
    return res.data.data;
  },

  async getPlan(divisionId: string, subjectId: string): Promise<PlanView> {
    const res = await api.get<ApiEnvelope<PlanView>>(`${BASE}/plans/${encodeURIComponent(divisionId)}/${encodeURIComponent(subjectId)}`);
    return res.data.data;
  },

  async savePlan(divisionId: string, subjectId: string, body: SavePlanBody): Promise<PlanView> {
    const res = await api.put<ApiEnvelope<PlanView>>(
      `${BASE}/plans/${encodeURIComponent(divisionId)}/${encodeURIComponent(subjectId)}`,
      body,
    );
    return res.data.data;
  },

  async savePattern(divisionId: string, subjectId: string, days: Record<string, number> | null): Promise<PlanView> {
    const res = await api.put<ApiEnvelope<PlanView>>(
      `${BASE}/plans/${encodeURIComponent(divisionId)}/${encodeURIComponent(subjectId)}/pattern`,
      { days },
    );
    return res.data.data;
  },
};
