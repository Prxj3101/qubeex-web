'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, X, Plus, Trash2, Download,
    Loader2, BookOpen, Layers, Check, X as XIcon,
    Clock, Link2, Play, Eye, ChevronDown, ChevronUp,
    FlaskConical, Brain, Users, Copy, CheckCircle2, AlertCircle,
    Shuffle, ArrowUp, ArrowDown, ArrowRight, Search, BookMarked, ArrowLeft, PackageOpen, ClipboardList, ClipboardCheck, BarChart2, Maximize2, Minimize2, GripVertical, Pencil, ArrowDownToLine, Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType = 'MCQ' | 'FILL_BLANK' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'NUMERICAL' | 'CONCEPTUAL';
type QuestionStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
type TestStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';

interface NumericalDetails {
    variables: Record<string, number>;
    correct_answer_formula: string;
    distractor_formulas?: string[];
    category?: string;
}

interface ConceptualDetails {
    correct_answer: string;
    distractors: string[];
    category?: string;
}

type QuestionSource = 'AI' | 'MANUAL' | 'IMPORTED';

interface Question {
    id: string;
    type: QuestionType;
    status: QuestionStatus;
    source: QuestionSource;
    sourceFile: string | null;
    uploadBatchId: string | null;
    question: string;
    questionTemplate: string | null;
    options: string[] | null;
    answer: string;
    details: NumericalDetails | ConceptualDetails | null;
    category: string | null;
    createdAt: string;
    moduleAssignment: { moduleId: string; module: { name: string } } | null;
}

interface ModuleQuestion {
    id: string;
    questionId: string;
    assignedAt: string;
    question: {
        id: string; type: QuestionType; status: QuestionStatus;
        question: string; options: string[] | null; answer: string;
        createdAt: string; details: NumericalDetails | ConceptualDetails | null; category: string | null;
    };
}

interface TaskModule {
    id: string;
    name: string;
    description: string | null;
    questions: ModuleQuestion[];
    createdAt: string;
}

interface PdfUpload {
    id: string;
    displayName: string;
    status: 'processing' | 'completed' | 'failed';
    questionCount: number | null;
    errorMessage: string | null;
    createdAt: string;
}

interface PaperSection {
    id: string;
    title: string;
    instruction: string;
    questionTypes: QuestionType[];
    attemptCount: number;     // 0 = attempt all questions
    marksPerQuestion: number;
}

interface BuilderQuestion {
    questionId: string;
    sectionId: string | null;
    marks: number;
    order: number;
    isCompulsory: boolean;
    question: Question;
}

interface TestBase {
    id: string;
    title: string;
    description: string | null;
    testLink: string;
    status: TestStatus;
    durationMinutes: number;
    totalMarks: number;
    numberOfQuestions: number;
    maxAttempts: number;
    validUntil: string | null;
    paperType: string;
    isRandomized: boolean;
    answerSpace: boolean;
    sections: PaperSection[] | null;
    createdAt?: string;
    _count: { attempts: number; submissions?: number };
}

interface Test extends TestBase {
    questions: { id: string; isCompulsory: boolean }[];
}

interface TestDetailQuestion {
    id: string;
    isCompulsory: boolean;
    sectionId: string | null;
    marks: number | null;
    order: number;
    question: Question;
}

interface TestDetail extends TestBase {
    questions: TestDetailQuestion[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<QuestionType, { label: string; color: string; section: string }> = {
    MCQ:          { label: 'MCQ',        color: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',   section: 'Section A' },
    CONCEPTUAL:   { label: 'MCQ',         color: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',   section: 'Section A' },
    FILL_BLANK:   { label: 'Fill Blank', color: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',           section: 'Section B' },
    TRUE_FALSE:   { label: 'True/False', color: 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300',           section: 'Section B' },
    SHORT_ANSWER: { label: 'Short Ans',  color: 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300', section: 'Section C' },
    NUMERICAL:    { label: 'Numerical',  color: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',   section: 'Section D' },
};

const STATUS_META: Record<QuestionStatus, { label: string; color: string }> = {
    PENDING_REVIEW: { label: 'Pending', color: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' },
    APPROVED: { label: 'Approved', color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' },
    REJECTED: { label: 'Rejected', color: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' },
};

function apiError(err: unknown): string {
    const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
    return data?.message ?? data?.error ?? 'Something went wrong';
}

function getQuizUrl(testLink: string): string {
    if (typeof window === 'undefined') return `/quiz/${testLink}`;
    return `${window.location.origin}/quiz/${testLink}`;
}

// ── Assignment types ──────────────────────────────────────────────────────────

type AssignmentStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';

interface Assignment {
    id: string;
    title: string;
    description: string | null;
    status: AssignmentStatus;
    totalMarks: number;
    numberOfQuestions: number;
    dueDate: string | null;
    createdAt?: string;
    _count: { submissions: number; totalStudents?: number };
}

// ── Component ─────────────────────────────────────────────────────────────────

export type TasksSubTab = 'questions' | 'tests' | 'assignments' | 'modules';

interface TasksTabProps { divisionId: string; subjectId: string | null; subTab: TasksSubTab; onSubTabChange: (tab: TasksSubTab) => void; onStatsChange?: (stats: { tests: number; assignments: number }) => void; }


export default function TasksTab({ divisionId, subjectId, subTab, onSubTabChange: _onSubTabChange, onStatsChange }: TasksTabProps) {

    // ── Containers ────────────────────────────────────────────────────────────
    interface QContainer { id: string; name: string; createdAt: string; questionCount: number; }
    const [containers, setContainers] = useState<QContainer[]>([]);
    const [containersLoading, setContainersLoading] = useState(true);
    const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
    const [openingContainerId, setOpeningContainerId] = useState<string | null>(null);
    const [hoveredContainerId, setHoveredContainerId] = useState<string | null>(null);
    const [closingContainerId, setClosingContainerId] = useState<string | null>(null);
    const [backOpenContainerId, setBackOpenContainerId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [editingContainerId, setEditingContainerId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [creatingContainer, setCreatingContainer] = useState(false);
    const [newContainerName, setNewContainerName] = useState('');

    const selectedContainer = containers.find(c => c.id === selectedContainerId) ?? null;

    const handleGoBack = useCallback((prevId: string) => {
        setBackOpenContainerId(prevId);
        setSelectedContainerId(null);
        setGenerateOpen(false);
        setHoveredContainerId(null);
        setOpeningContainerId(null);
        setTimeout(() => {
            setBackOpenContainerId(null);
            setClosingContainerId(prevId);
            setTimeout(() => setClosingContainerId(null), 500);
        }, 60);
    }, []);

    const handleContainerClick = (id: string) => {
        setOpeningContainerId(id);
        setTimeout(() => {
            setOpeningContainerId(null);
            setSelectedContainerId(id);
            window.history.pushState({ containerOpen: true }, '');
        }, 480);
    };

    const handleCreateContainer = async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        try {
            const res = await api.post('/teacher/tasks/containers', { divisionId, subjectId: subjectId ?? undefined, name: trimmed });
            setContainers(prev => [res.data.data, ...prev]);
            toast.success('Container created');
        } catch (err) { toast.error(apiError(err)); }
        finally { setCreatingContainer(false); setNewContainerName(''); }
    };

    const handleRenameContainer = async (id: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) { setEditingContainerId(null); return; }
        try {
            const res = await api.patch(`/teacher/tasks/containers/${id}`, { name: trimmed });
            setContainers(prev => prev.map(c => c.id === id ? { ...c, name: res.data.data.name } : c));
        } catch (err) { toast.error(apiError(err)); }
        finally { setEditingContainerId(null); }
    };

    const handleDeleteContainer = async (id: string) => {
        try {
            await api.delete(`/teacher/tasks/containers/${id}`);
            setContainers(prev => prev.filter(c => c.id !== id));
            toast.success('Container deleted');
        } catch (err) { toast.error(apiError(err)); }
        finally { setDeleteConfirmId(null); }
    };

    useEffect(() => {
        const onPopState = (e: PopStateEvent) => {
            if (selectedContainerId) {
                e.preventDefault?.();
                handleGoBack(selectedContainerId);
            }
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [selectedContainerId, handleGoBack]);

    // ── Questions ─────────────────────────────────────────────────────────────
    const [questions, setQuestions] = useState<Question[]>([]);
    const [qLoading, setQLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<QuestionStatus | 'ALL'>('ALL');
    const [typeFilter, setTypeFilter] = useState<QuestionType | 'ALL'>('ALL');

    // ── Share / Import ────────────────────────────────────────────────────────
    const [shareOpen, setShareOpen] = useState(false);
    const [shareSelectedIds, setShareSelectedIds] = useState<Set<string>>(new Set());
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [shareCreating, setShareCreating] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importTokenInput, setImportTokenInput] = useState('');
    const [importVerifying, setImportVerifying] = useState(false);
    const [importPreview, setImportPreview] = useState<{ questions: Question[]; expiresAt: string } | null>(null);
    const [importSelectedIds, setImportSelectedIds] = useState<Set<string>>(new Set());
    const [importSaving, setImportSaving] = useState(false);

    // ── Manual question entry ─────────────────────────────────────────────────

    // ── Upload panel ──────────────────────────────────────────────────────────
    const [generateOpen, setGenerateOpen] = useState(false);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState('');
    const [generateMore, setGenerateMore] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Tests ─────────────────────────────────────────────────────────────────
    const [tests, setTests] = useState<Test[]>([]);
    const [tLoading, setTLoading] = useState(false);
    const [createTestOpen, setCreateTestOpen] = useState(false);
    const [newTest, setNewTest] = useState({ title: '', description: '', durationMinutes: 60, totalMarks: 100, numberOfQuestions: 10, maxAttempts: 1, validUntil: '' });
    const [savingTest, setSavingTest] = useState(false);
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [paperBuilderOpen, setPaperBuilderOpen] = useState(false);
    const [paperBuilderTestId, setPaperBuilderTestId] = useState<string | null>(null);
    const [paperBuilderType, setPaperBuilderType] = useState<'TEST' | 'ASSIGNMENT'>('TEST');

    // ── Assignments ───────────────────────────────────────────────────────────
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [aLoading, setALoading] = useState(false);
    const [createAssignmentOpen, setCreateAssignmentOpen] = useState(false);
    const [newAssignment, setNewAssignment] = useState({ title: '', description: '', totalMarks: 10, dueDate: '' });
    const [savingAssignment, setSavingAssignment] = useState(false);

    // ── Report stats to parent ────────────────────────────────────────────────
    const onStatsChangeRef = useRef(onStatsChange);
    useEffect(() => { onStatsChangeRef.current = onStatsChange; });
    useEffect(() => {
        onStatsChangeRef.current?.({ tests: tests.length, assignments: assignments.length });
    }, [tests.length, assignments.length]);

    // ── Modules ───────────────────────────────────────────────────────────────
    const [modules, setModules] = useState<TaskModule[]>([]);
    const [mLoading, setMLoading] = useState(false);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [creatingModule, setCreatingModule] = useState(false);
    const [newModName, setNewModName] = useState('');
    const [newModDesc, setNewModDesc] = useState('');
    const [savingModule, setSavingModule] = useState(false);
    const [dragModuleId, setDragModuleId] = useState<string | null>(null);
    const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
    const [deleteModuleConfirmId, setDeleteModuleConfirmId] = useState<string | null>(null);
    const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
    const [editModName, setEditModName] = useState('');
    const [editModDesc, setEditModDesc] = useState('');
    const [savingEditModule, setSavingEditModule] = useState(false);
    const [addQModuleId, setAddQModuleId] = useState<string | null>(null);
    const [customQ, setCustomQ] = useState<{
        type: QuestionType; question: string; answer: string;
        options: [string, string, string, string]; formula: string;
    }>({ type: 'MCQ', question: '', answer: '', options: ['', '', '', ''], formula: '' });
    const [savingCustomQ, setSavingCustomQ] = useState(false);

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchQuestions = useCallback(async (containerId: string, status?: string) => {
        setQLoading(true);
        try {
            const params = new URLSearchParams({ containerId });
            if (status && status !== 'ALL') params.set('status', status);
            const res = await api.get(`/teacher/tasks/questions?${params}`);
            setQuestions(res.data.data);
        } catch {
            setQuestions([]);
        } finally {
            setQLoading(false);
        }
    }, []);

    const fetchTests = useCallback(async () => {
        setTLoading(true);
        try {
            const res = await api.get(`/teacher/tasks/tests?divisionId=${divisionId}`);
            setTests(res.data.data);
        } catch {
            setTests([]);
        } finally {
            setTLoading(false);
        }
    }, [divisionId]);

    const fetchAssignments = useCallback(async () => {
        setALoading(true);
        try {
            const res = await api.get(`/teacher/tasks/assignments?divisionId=${divisionId}${subjectId ? `&subjectId=${subjectId}` : ''}`);
            setAssignments(res.data.data);
        } catch {
            setAssignments([]);
        } finally {
            setALoading(false);
        }
    }, [divisionId, subjectId]);

    const fetchModules = useCallback(async () => {
        setMLoading(true);
        try {
            const res = await api.get(`/teacher/tasks/modules?divisionId=${divisionId}${subjectId ? `&subjectId=${subjectId}` : ''}`);
            setModules(res.data.data);
        } catch {
            setModules([]);
        } finally {
            setMLoading(false);
        }
    }, [divisionId]);

    const fetchContainers = useCallback(async () => {
        setContainersLoading(true);
        try {
            const res = await api.get(`/teacher/tasks/containers?divisionId=${divisionId}${subjectId ? `&subjectId=${subjectId}` : ''}`);
            setContainers(res.data.data);
        } catch {
            setContainers([]);
        } finally {
            setContainersLoading(false);
        }
    }, [divisionId]);

    useEffect(() => {
        if (selectedContainerId) fetchQuestions(selectedContainerId);
        else setQuestions([]);
    }, [selectedContainerId, fetchQuestions]);

    useEffect(() => {
        fetchTests();
    }, [fetchTests]);

    useEffect(() => {
        fetchAssignments();
    }, [fetchAssignments]);

    useEffect(() => {
        fetchModules();
    }, [fetchModules]);

    useEffect(() => {
        fetchContainers();
    }, [fetchContainers]);

    // Poll active upload
    useEffect(() => {
        if (!activeUploadId) return;
        pollTimerRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/teacher/tasks/uploads/${activeUploadId}`);
                const upload = res.data.data as PdfUpload;
                if (upload.status === 'completed') {
                    clearInterval(pollTimerRef.current!);
                    setActiveUploadId(null);
                    // Fetch new questions then show breakdown
                    const qRes = selectedContainerId ? await api.get(`/teacher/tasks/questions?containerId=${selectedContainerId}&status=PENDING_REVIEW`).catch(() => null) : null;
                    const newQs: Question[] = qRes?.data?.data ?? [];
                    setQuestions(newQs);
                    setStatusFilter('PENDING_REVIEW');
                    setTypeFilter('ALL');
                    // Build breakdown string
                    const counts: Partial<Record<QuestionType, number>> = {};
                    for (const q of newQs) counts[q.type] = (counts[q.type] ?? 0) + 1;
                    const parts = (Object.entries(counts) as [QuestionType, number][])
                        .map(([t, n]) => `${n} ${TYPE_META[t]?.label ?? t}`)
                        .join(' · ');
                    toast.success(`${newQs.length} questions ready for review${parts ? ` — ${parts}` : ''}`);
                } else if (upload.status === 'failed') {
                    clearInterval(pollTimerRef.current!);
                    setActiveUploadId(null);
                    toast.error(upload.errorMessage ?? 'PDF processing failed');
                }
            } catch { /* silent */ }
        }, 3000);
        return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
    }, [activeUploadId, fetchQuestions]);

    // ── PDF Upload ─────────────────────────────────────────────────────────────

    const handleGenerate = async () => {
        if (!pdfFile) return toast.error('Please select a PDF file');
        if (!selectedContainerId) return toast.error('Open a container first');
        setUploading(true);
        try {
            const form = new FormData();
            form.append('containerId', selectedContainerId);
            if (prompt.trim()) form.append('prompt', prompt.trim());
            if (generateMore) form.append('more', 'true');
            form.append('file', pdfFile);
            const res = await api.post('/teacher/tasks/generate', form, { headers: { 'Content-Type': undefined } });
            const { uploadId } = res.data.data;
            setActiveUploadId(uploadId);
            toast.success('PDF uploaded — questions generating in background…');
            setPdfFile(null);
            setPrompt('');
            setGenerateMore(false);
            setGenerateOpen(false);
        } catch (err) {
            toast.error(apiError(err));
        } finally {
            setUploading(false);
        }
    };

    // ── Question actions ───────────────────────────────────────────────────────

    const updateStatus = async (id: string, status: QuestionStatus) => {
        try {
            await api.patch(`/teacher/tasks/questions/${id}/status`, { status });
            setQuestions(prev => prev.map(q => q.id === id ? { ...q, status } : q));
            toast.success(status === 'APPROVED' ? 'Question approved' : status === 'REJECTED' ? 'Question rejected' : 'Status updated');
        } catch (err) { toast.error(apiError(err)); }
    };

    const deleteQuestion = async (id: string) => {
        try {
            await api.delete(`/teacher/tasks/questions/${id}`);
            setQuestions(prev => prev.filter(q => q.id !== id));
            toast.success('Question deleted');
        } catch (err) { toast.error(apiError(err)); }
    };

    const handleEditQuestion = async (id: string, q: string, ans: string, opts?: string[]) => {
        try {
            const body: Record<string, unknown> = { question: q, answer: ans };
            if (opts) body.options = opts;
            const res = await api.patch(`/teacher/tasks/questions/${id}`, body);
            setQuestions(prev => prev.map(existing => existing.id === id ? { ...existing, ...res.data.data } : existing));
            toast.success('Question updated');
        } catch (err) { toast.error(apiError(err)); }
    };


    const handleCreateShareToken = async () => {
        if (shareSelectedIds.size === 0) return toast.error('Select at least one question to share');
        setShareCreating(true);
        try {
            const res = await api.post('/teacher/tasks/questions/share', { questionIds: Array.from(shareSelectedIds) });
            setShareToken(res.data.data.token);
        } catch (err) { toast.error(apiError(err)); }
        finally { setShareCreating(false); }
    };

    const handleVerifyShareToken = async () => {
        const token = importTokenInput.trim();
        if (!token) return toast.error('Paste a share code first');
        setImportVerifying(true);
        setImportPreview(null);
        setImportSelectedIds(new Set());
        try {
            const res = await api.get(`/teacher/tasks/questions/share/${token}`);
            setImportPreview(res.data.data);
            setImportSelectedIds(new Set((res.data.data.questions as Question[]).map((q: Question) => q.id)));
        } catch (err) { toast.error(apiError(err)); }
        finally { setImportVerifying(false); }
    };

    const handleImportQuestions = async () => {
        if (!selectedContainerId || !importPreview || importSelectedIds.size === 0) return;
        setImportSaving(true);
        try {
            const res = await api.post('/teacher/tasks/questions/import', {
                token: importTokenInput.trim(),
                containerId: selectedContainerId,
                questionIds: Array.from(importSelectedIds),
            });
            setQuestions(prev => [...(res.data.data as Question[]), ...prev]);
            setImportOpen(false);
            setImportTokenInput(''); setImportPreview(null); setImportSelectedIds(new Set());
            toast.success(`${res.data.data.length} question(s) imported for review`);
        } catch (err) { toast.error(apiError(err)); }
        finally { setImportSaving(false); }
    };

    // ── Tests ──────────────────────────────────────────────────────────────────

    const handleCreateAssignment = async () => {
        if (!newAssignment.title.trim()) return toast.error('Assignment title is required');
        setSavingAssignment(true);
        try {
            const payload: Record<string, unknown> = {
                divisionId, subjectId: subjectId ?? undefined,
                title: newAssignment.title,
                description: newAssignment.description || undefined,
                totalMarks: newAssignment.totalMarks,
            };
            if (newAssignment.dueDate) payload.dueDate = new Date(newAssignment.dueDate).toISOString();
            const res = await api.post('/teacher/tasks/assignments', payload);
            setAssignments(prev => [res.data.data, ...prev]);
            toast.success('Assignment created');
            setCreateAssignmentOpen(false);
            setNewAssignment({ title: '', description: '', totalMarks: 10, dueDate: '' });
        } catch (err) { toast.error(apiError(err)); }
        finally { setSavingAssignment(false); }
    };

    const handleCreateTest = async () => {
        if (!newTest.title.trim()) return toast.error('Test title is required');
        setSavingTest(true);
        try {
            const payload: Record<string, unknown> = {
                divisionId, subjectId: subjectId ?? undefined, title: newTest.title, description: newTest.description || undefined,
                durationMinutes: newTest.durationMinutes, totalMarks: newTest.totalMarks,
                numberOfQuestions: newTest.numberOfQuestions, maxAttempts: newTest.maxAttempts,
            };
            if (newTest.validUntil) payload.validUntil = new Date(newTest.validUntil).toISOString();
            const res = await api.post('/teacher/tasks/tests', payload);
            const created: Test = res.data.data;
            setTests(prev => [created, ...prev]);
            toast.success('Test created — opening Paper Builder');
            setCreateTestOpen(false);
            setNewTest({ title: '', description: '', durationMinutes: 60, totalMarks: 100, numberOfQuestions: 10, maxAttempts: 1, validUntil: '' });
            setPaperBuilderTestId(created.id);
            setPaperBuilderOpen(true);
        } catch (err) { toast.error(apiError(err)); } finally { setSavingTest(false); }
    };

    const updateTestStatus = async (test: Test, status: TestStatus) => {
        try {
            const res = await api.patch(`/teacher/tasks/tests/${test.id}`, { status });
            setTests(prev => prev.map(t => t.id === test.id ? { ...t, ...res.data.data } : t));
            toast.success(status === 'ACTIVE' ? 'Test activated — link is now live' : 'Test completed');
        } catch (err) { toast.error(apiError(err)); }
    };

    const deleteTest = async (id: string) => {
        try {
            await api.delete(`/teacher/tasks/tests/${id}`);
            setTests(prev => prev.filter(t => t.id !== id));
            toast.success('Test deleted');
        } catch (err) { toast.error(apiError(err)); }
    };

    const deleteAssignment = async (id: string) => {
        try {
            await api.delete(`/teacher/tasks/assignments/${id}`);
            setAssignments(prev => prev.filter(a => a.id !== id));
            toast.success('Assignment deleted');
        } catch (err) { toast.error(apiError(err)); }
    };

    const updateAssignmentStatus = async (id: string, status: AssignmentStatus) => {
        try {
            const res = await api.patch(`/teacher/tasks/assignments/${id}`, { status });
            setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...res.data.data } : a));
            toast.success(status === 'ACTIVE' ? 'Assignment activated' : 'Assignment completed');
        } catch (err) { toast.error(apiError(err)); }
    };

    const openBuilder = (testId: string, type: 'TEST' | 'ASSIGNMENT' = 'TEST') => {
        setPaperBuilderTestId(testId);
        setPaperBuilderType(type);
        setPaperBuilderOpen(true);
    };

    const handlePaperSaved = () => {
        fetchTests();
        setPaperBuilderOpen(false);
        setPaperBuilderTestId(null);
    };

    const copyLink = (testLink: string) => {
        const url = getQuizUrl(testLink);
        navigator.clipboard.writeText(url);
        setCopiedLink(testLink);
        toast.success('Test link copied');
        setTimeout(() => setCopiedLink(null), 2000);
    };

    // ── Module assignment ──────────────────────────────────────────────────────

    const assignToModule = async (questionId: string, moduleId: string) => {
        try {
            const res = await api.post(`/teacher/tasks/modules/${moduleId}/questions`, { questionId });
            const mod = modules.find(m => m.id === moduleId);
            setQuestions(prev => prev.map(q => q.id === questionId
                ? { ...q, moduleAssignment: { moduleId, module: { name: mod?.name ?? '' } } }
                : q));
            const theQ = questions.find(q => q.id === questionId);
            if (theQ) {
                const newMQ: ModuleQuestion = {
                    id: res.data.data.id,
                    questionId,
                    assignedAt: res.data.data.assignedAt ?? new Date().toISOString(),
                    question: {
                        id: theQ.id, type: theQ.type, status: theQ.status,
                        question: theQ.question, options: theQ.options, answer: theQ.answer,
                        createdAt: theQ.createdAt,
                        details: theQ.details as ModuleQuestion['question']['details'],
                        category: theQ.category,
                    },
                };
                setModules(prev => prev.map(m => m.id === moduleId ? { ...m, questions: [...m.questions, newMQ] } : m));
            }
            toast.success(`Added to ${mod?.name ?? 'module'}`);
        } catch (err) { toast.error(apiError(err)); }
    };

    const removeFromModule = async (moduleId: string, questionId: string) => {
        try {
            await api.delete(`/teacher/tasks/modules/${moduleId}/questions/${questionId}`);
            setModules(prev => prev.map(m => m.id === moduleId
                ? { ...m, questions: m.questions.filter(mq => mq.questionId !== questionId) }
                : m));
            setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, moduleAssignment: null } : q));
            toast.success('Removed from module');
        } catch (err) { toast.error(apiError(err)); }
    };

    const unassignFromModule = async (questionId: string) => {
        const q = questions.find(q2 => q2.id === questionId);
        if (!q?.moduleAssignment) return;
        await removeFromModule(q.moduleAssignment.moduleId, questionId);
    };

    // ── Modules ────────────────────────────────────────────────────────────────

    const createModule = async () => {
        if (!newModName.trim()) return toast.error('Module name is required');
        setSavingModule(true);
        try {
            const res = await api.post('/teacher/tasks/modules', { divisionId, subjectId: subjectId ?? undefined, name: newModName, description: newModDesc || undefined });
            setModules(prev => [...prev, res.data.data]);
            toast.success('Module created');
            setCreatingModule(false);
            setNewModName(''); setNewModDesc('');
        } catch (err) { toast.error(apiError(err)); } finally { setSavingModule(false); }
    };

    const handleModuleDragStart = (id: string) => setDragModuleId(id);
    const handleModuleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); if (id !== dragModuleId) setDragOverModuleId(id); };
    const handleModuleDrop = (targetId: string) => {
        if (!dragModuleId || dragModuleId === targetId) { setDragModuleId(null); setDragOverModuleId(null); return; }
        setModules(prev => {
            const arr = [...prev];
            const fromIdx = arr.findIndex(m => m.id === dragModuleId);
            const toIdx = arr.findIndex(m => m.id === targetId);
            const [item] = arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, item);
            return arr;
        });
        setDragModuleId(null);
        setDragOverModuleId(null);
    };
    const handleModuleDragEnd = () => { setDragModuleId(null); setDragOverModuleId(null); };

    const deleteModule = async (id: string) => {
        try {
            await api.delete(`/teacher/tasks/modules/${id}`);
            setModules(prev => prev.filter(m => m.id !== id));
            if (selectedModuleId === id) setSelectedModuleId(null);
            toast.success('Module deleted');
        } catch (err) { toast.error(apiError(err)); }
    };

    const startEditModule = (m: TaskModule) => {
        setEditingModuleId(m.id);
        setEditModName(m.name);
        setEditModDesc((m as any).description ?? '');
        setSelectedModuleId(null);
    };

    const saveEditModule = async () => {
        if (!editModName.trim() || !editingModuleId) return;
        setSavingEditModule(true);
        try {
            const res = await api.patch(`/teacher/tasks/modules/${editingModuleId}`, { name: editModName, description: editModDesc || undefined });
            setModules(prev => prev.map(m => m.id === editingModuleId ? { ...m, name: res.data.data.name ?? editModName, description: res.data.data.description ?? editModDesc } : m));
            toast.success('Module updated');
            setEditingModuleId(null);
        } catch (err) {
            toast.error(apiError(err));
        } finally {
            setSavingEditModule(false);
        }
    };

    const saveCustomQuestion = async (moduleId: string) => {
        if (!customQ.question.trim()) return toast.error('Question text is required');
        if (customQ.type === 'MCQ' && customQ.options.some(o => !o.trim())) return toast.error('Fill all 4 MCQ options');
        if (customQ.type === 'MCQ' && !customQ.answer.trim()) return toast.error('Select the correct option');
        if (customQ.type === 'NUMERICAL' && isNaN(Number(customQ.answer.trim()))) return toast.error('Numerical answer must be a number');
        if (!customQ.answer.trim()) return toast.error('Answer is required');
        setSavingCustomQ(true);
        try {
            const payload: Record<string, unknown> = {
                type: customQ.type,
                question: customQ.question.trim(),
                answer: customQ.answer.trim(),
            };
            if (customQ.type === 'MCQ') payload.options = customQ.options;
            if (customQ.type === 'NUMERICAL') payload.formula = customQ.formula.trim() || undefined;
            const res = await api.post(`/teacher/tasks/modules/${moduleId}/questions/manual`, payload);
            const newMQ: ModuleQuestion = res.data.data;
            setModules(prev => prev.map(m => m.id === moduleId ? { ...m, questions: [...m.questions, newMQ] } : m));
            toast.success('Question added');
            setAddQModuleId(null);
            setCustomQ({ type: 'MCQ', question: '', answer: '', options: ['', '', '', ''], formula: '' });
        } catch (err) { toast.error(apiError(err)); }
        finally { setSavingCustomQ(false); }
    };

    // ── Filtered questions ─────────────────────────────────────────────────────

    const containerQuestions = selectedContainerId ? questions : [];
    const statusFiltered = containerQuestions.filter(q =>
        statusFilter === 'ALL' ? true : q.status === statusFilter
    );

    const displayedQuestions = statusFiltered.filter(q =>
        typeFilter === 'ALL' ? true : q.type === typeFilter
    );

    // Type breakdown over the status-filtered pool
    const typeCounts = statusFiltered.reduce<Partial<Record<QuestionType, number>>>((acc, q) => {
        acc[q.type] = (acc[q.type] ?? 0) + 1;
        return acc;
    }, {});

    const approvedQuestions = questions.filter(q => q.status === 'APPROVED');

    // Group displayed questions by source + upload batch.
    // MANUAL → group key "MANUAL"; IMPORTED → "IMPORTED"; AI → by uploadBatchId or 2-min proximity.
    const groupedQuestions = useMemo(() => {
        type Group = { batchId: string | null; sourceFile: string | null; source: QuestionSource; generatedAt: string; items: Question[] };
        const groups: Group[] = [];

        for (let i = 0; i < displayedQuestions.length; i++) {
            const q = displayedQuestions[i];
            const prev = groups[groups.length - 1];
            const prevLastCreatedAt = prev?.items[prev.items.length - 1]?.createdAt;

            const sameAsPrev = prev && prev.source === q.source && (
                q.source !== 'AI'
                    ? true // merge all MANUAL/IMPORTED into one group each
                    : q.uploadBatchId
                        ? q.uploadBatchId === prev.batchId
                        : !q.uploadBatchId && prevLastCreatedAt
                            && (Math.abs(new Date(q.createdAt).getTime() - new Date(prevLastCreatedAt).getTime()) < 2 * 60 * 1000)
            );

            if (!sameAsPrev) {
                groups.push({ batchId: q.uploadBatchId ?? null, sourceFile: q.sourceFile ?? null, source: q.source, generatedAt: q.createdAt, items: [] });
            }
            groups[groups.length - 1].items.push(q);
        }
        return groups;
    }, [displayedQuestions]);

    const hasMultipleBatches = groupedQuestions.length > 1;

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Action buttons */}
            <div className="shrink-0 px-2 pt-1 pb-1 flex items-center justify-between relative">
                {subTab === 'questions' && selectedContainerId && (
                    <h2 className="text-xl font-bold flex items-center gap-2 shrink-0">
                        <PackageOpen size={21} />
                        {selectedContainer?.name}
                    </h2>
                )}
                {subTab === 'questions' && !selectedContainerId && (
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="url(#brainGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <defs>
                                    <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#7C3AED">
                                            <animate attributeName="stop-color" values="#7C3AED;#DA7756;#7C3AED" dur="3s" repeatCount="indefinite" />
                                        </stop>
                                        <stop offset="100%" stopColor="#DA7756">
                                            <animate attributeName="stop-color" values="#DA7756;#7C3AED;#DA7756" dur="3s" repeatCount="indefinite" />
                                        </stop>
                                    </linearGradient>
                                </defs>
                                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                                <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
                                <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
                                <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
                                <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
                                <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
                                <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
                                <path d="M6 18a4 4 0 0 1-1.967-.516"/>
                                <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
                            </svg>
                            AI Questions
                        </h2>
                        <p className="text-[13px] text-muted-foreground">Create containers and generate questions from PDFs</p>
                    </div>
                )}
                {subTab === 'tests' && (
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <ClipboardList size={21} />
                            Tests
                        </h2>
                        <p className="text-[13px] text-muted-foreground">Create and manage tests for your students</p>
                    </div>
                )}
                {subTab === 'assignments' && (
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <ClipboardCheck size={21} />
                            Assignments
                        </h2>
                        <p className="text-[13px] text-muted-foreground">Create and manage assignments for your students</p>
                    </div>
                )}
                {subTab === 'modules' && (
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <BookOpen size={21} />
                            Modules
                        </h2>
                        <p className="text-[13px] text-muted-foreground">Organise questions into modules for tests and assignments</p>
                    </div>
                )}
                {subTab === 'questions' && selectedContainerId && (
                    <div className="absolute left-1/2 -translate-x-1/2 flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
                        {(['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const).map(s => (
                            <button key={s} onClick={() => { setStatusFilter(s); setTypeFilter('ALL'); }}
                                className={`relative px-3 py-1 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                {s === 'ALL' ? 'All' : s === 'PENDING_REVIEW' ? 'Pending' : s === 'APPROVED' ? 'Approved' : 'Rejected'}
                                <span className="ml-1 opacity-60">
                                    {s === 'ALL' ? containerQuestions.length : containerQuestions.filter(q => q.status === s).length}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex items-center gap-2 ml-auto">
                    {subTab === 'questions' && selectedContainerId && activeUploadId && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
                            <Loader2 size={11} className="animate-spin" />
                            Generating questions…
                        </div>
                    )}
                    {subTab === 'questions' && selectedContainerId && (
                        <button onClick={() => setGenerateOpen(v => !v)}
                            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl text-white"
                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                            <Upload size={14} /> Generate from PDF
                        </button>
                    )}
                    {subTab === 'questions' && !selectedContainerId && (
                        <button onClick={() => setCreatingContainer(true)}
                            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl text-white"
                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                            <Plus size={14} /> New Container
                        </button>
                    )}
                    {subTab === 'tests' && (
                        <button onClick={() => setCreateTestOpen(true)}
                            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl text-white"
                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                            <Plus size={14} /> Create Test
                        </button>
                    )}
                    {subTab === 'assignments' && (
                        <button onClick={() => setCreateAssignmentOpen(true)}
                            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl text-white"
                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                            <Plus size={14} /> Create Assignment
                        </button>
                    )}
                    {subTab === 'modules' && (
                        <button onClick={() => setCreatingModule(true)}
                            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl text-white"
                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                            <Plus size={14} /> New Module
                        </button>
                    )}
                    {subTab === 'questions' && selectedContainerId && (
                        <>
                            <button onClick={() => { setImportOpen(true); setImportTokenInput(''); setImportPreview(null); setImportSelectedIds(new Set()); }}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg border border-border hover:bg-muted transition-all">
                                <ArrowDownToLine size={13} /> Import
                            </button>
                            <button onClick={() => { setShareOpen(true); setShareToken(null); setShareSelectedIds(new Set(containerQuestions.map(q => q.id))); }}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg border border-border hover:bg-muted transition-all">
                                <Share2 size={13} /> Share
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Generate Panel */}
            <AnimatePresence>
                {generateOpen && subTab === 'questions' && selectedContainerId && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="shrink-0 overflow-hidden">
                        <div className="mx-4 mt-3 p-4 rounded-xl border border-border bg-card/50">
                            <div className="flex gap-3">
                                {/* Drop zone */}
                                <div onClick={() => fileInputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) { if (f.type !== 'application/pdf') toast.error('Only PDFs accepted'); else if (f.size > 25 * 1024 * 1024) toast.error('Max 25 MB'); else setPdfFile(f); } }}
                                    className={`w-48 flex-shrink-0 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all py-4 ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'}`}>
                                    <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { if (f.type !== 'application/pdf') toast.error('Only PDFs'); else if (f.size > 25 * 1024 * 1024) toast.error('Max 25 MB'); else setPdfFile(f); e.target.value = ''; } }} />
                                    {pdfFile ? <><FileText size={22} className="text-primary" /><p className="text-xs text-center text-foreground font-medium leading-tight px-2">{pdfFile.name}</p><button onClick={e => { e.stopPropagation(); setPdfFile(null); }} className="text-xs text-muted-foreground hover:text-red-500"><X size={14} /></button></>
                                        : <><Upload size={22} className="text-muted-foreground" /><p className="text-xs text-muted-foreground text-center">Drop PDF here<br />or click to browse</p></>}
                                </div>
                                <div className="flex-1 flex flex-col gap-3">
                                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Optional: teacher instruction (e.g. focus on Chapter 3, generate 15 questions, avoid examples…)" rows={3}
                                        className="w-full text-sm rounded-xl border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                                            <input type="checkbox" checked={generateMore} onChange={e => setGenerateMore(e.target.checked)} className="rounded" />
                                            Avoid repeating existing questions
                                        </label>
                                        <button onClick={handleGenerate} disabled={!pdfFile || uploading}
                                            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                            {uploading ? <><Loader2 size={14} className="animate-spin" />Uploading…</> : <><Play size={14} />Generate</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto py-3 pr-2 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                {/* ── QUESTIONS TAB ── */}
                {subTab === 'questions' && !selectedContainerId && (
                    <>
                        {/* New collection inline form */}
                        <AnimatePresence>
                            {creatingContainer && (
                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                    className="p-4 rounded-xl border border-border bg-card/50 mb-1">
                                    <div className="flex items-center gap-2">
                                        <input autoFocus value={newContainerName} onChange={e => setNewContainerName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && newContainerName.trim()) {
                                                    handleCreateContainer(newContainerName);
                                                }
                                                if (e.key === 'Escape') { setCreatingContainer(false); setNewContainerName(''); }
                                            }}
                                            placeholder="Collection name (e.g. Chapter 3, Practice Exam…)"
                                            className="flex-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                        <button onClick={() => {
                                            if (!newContainerName.trim()) return;
                                            handleCreateContainer(newContainerName);
                                        }} className="px-3 py-2 text-sm font-medium rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                            Create
                                        </button>
                                        <button onClick={() => { setCreatingContainer(false); setNewContainerName(''); }} className="p-2 text-muted-foreground hover:text-foreground"><X size={15} /></button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Container grid */}
                        <div className="flex flex-wrap gap-20" style={{ paddingTop: 48, paddingLeft: 72, paddingRight: 40 }}>
                            {containersLoading && containers.length === 0 && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 size={16} className="animate-spin" /> Loading collections…
                                </div>
                            )}
                            {!containersLoading && containers.length === 0 && !creatingContainer && (
                                <p className="text-sm text-muted-foreground">No collections yet — create one to generate questions into it.</p>
                            )}
                            {containers.map(c => {
                                const isOpening = openingContainerId === c.id || hoveredContainerId === c.id || backOpenContainerId === c.id;
                                return (
                                    <div key={c.id} className="group relative flex flex-col items-center gap-2"
                                        style={{ isolation: 'isolate' }}
                                        onMouseEnter={() => { setHoveredContainerId(c.id); setClosingContainerId(null); }}
                                        onMouseLeave={() => {
                                            setHoveredContainerId(null);
                                            setClosingContainerId(c.id);
                                            setTimeout(() => setClosingContainerId(null), 400);
                                        }}>
                                        {/* Closing impact lines — left corner */}
                                        {[0,1].map(i => (
                                            <motion.div key={`cl${i}`}
                                                animate={closingContainerId === c.id
                                                    ? { opacity: [0, 1, 0], x: [-4, -12, -18], scaleX: [0.4, 1, 0.6] }
                                                    : { opacity: 0, x: 0 }}
                                                transition={{ duration: 0.35, delay: i * 0.06, ease: 'easeOut' }}
                                                style={{
                                                    position: 'absolute',
                                                    left: 0, top: 6 + i * 9,
                                                    width: 14 - i * 2, height: 2.5, borderRadius: 1,
                                                    background: '#6B4C1E', zIndex: 20,
                                                    originX: 1,
                                                }}/>
                                        ))}
                                        {/* Closing impact lines — right corner */}
                                        {[0,1].map(i => (
                                            <motion.div key={`cr${i}`}
                                                animate={closingContainerId === c.id
                                                    ? { opacity: [0, 1, 0], x: [4, 12, 18], scaleX: [0.4, 1, 0.6] }
                                                    : { opacity: 0, x: 0 }}
                                                transition={{ duration: 0.35, delay: i * 0.06, ease: 'easeOut' }}
                                                style={{
                                                    position: 'absolute',
                                                    right: 0, top: 6 + i * 9,
                                                    width: 14 - i * 2, height: 2.5, borderRadius: 1,
                                                    background: '#6B4C1E', zIndex: 20,
                                                    originX: 0,
                                                }}/>
                                        ))}
                                        {/* Delete */}
                                        <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(c.id); }}
                                            className="absolute -top-1 -right-1 z-20 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-red-500 text-white transition-all"
                                            style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Trash2 size={10} />
                                        </button>
                                        {/* 2D Cartoon Box */}
                                        <div style={{ width: 155, cursor: 'pointer' }} onClick={() => handleContainerClick(c.id)}>
                                            {/* Flap arms */}
                                            <div style={{ position: 'relative', height: 3, overflow: 'visible' }}>
                                                <motion.div
                                                    animate={{ rotate: isOpening ? -120 : 0 }}
                                                    transition={isOpening
                                                        ? { type: 'tween', duration: 0.4, ease: [0.4, 0, 0.2, 1] }
                                                        : { type: 'spring', stiffness: 400, damping: 27, mass: 0.8 }
                                                    }
                                                    style={{
                                                        position: 'absolute', left: 0, top: 0,
                                                        width: 65, height: 3,
                                                        background: '#7B5230',
                                                        transformOrigin: 'left center',
                                                        zIndex: 3,
                                                    }} />
                                                <motion.div
                                                    animate={{ rotate: isOpening ? 120 : 0 }}
                                                    transition={isOpening
                                                        ? { type: 'tween', duration: 0.4, ease: [0.4, 0, 0.2, 1] }
                                                        : { type: 'spring', stiffness: 400, damping: 27, mass: 0.8 }
                                                    }
                                                    style={{
                                                        position: 'absolute', right: 0, top: 0,
                                                        width: 65, height: 3,
                                                        background: '#7B5230',
                                                        transformOrigin: 'right center',
                                                        zIndex: 3,
                                                    }} />
                                            </div>
                                            {/* Box body */}
                                            <div style={{
                                                height: 130,
                                                background: '#C8A96E',
                                                border: '3px solid #6B4C1E',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                                                position: 'relative', overflow: 'visible',
                                            }}>
                                                {/* Left side shading */}
                                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '46%', background: '#B8945A' }} />
                                                {/* Center vertical crease */}
                                                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: '#6B4C1E', opacity: 0.5, zIndex: 1 }} />
                                                {/* Label rect (top center) */}
                                                <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 48, height: 13, background: '#D4B47A', border: '1.5px solid #6B4C1E', borderRadius: 3, zIndex: 2 }} />
                                                {/* Dashed fold line */}
                                                <div style={{ position: 'absolute', top: 40, left: -3, right: -3, borderTop: '1.5px dashed #6B4C1E', opacity: 0.5, zIndex: 2 }} />
                                                {/* Name */}
                                                {editingContainerId === c.id ? (
                                                    <input
                                                        autoFocus
                                                        value={editingName}
                                                        onChange={e => setEditingName(e.target.value)}
                                                        onClick={e => e.stopPropagation()}
                                                        onKeyDown={e => {
                                                            e.stopPropagation();
                                                            if (e.key === 'Enter' && editingName.trim()) {
                                                                handleRenameContainer(c.id, editingName);
                                                            }
                                                            if (e.key === 'Escape') setEditingContainerId(null);
                                                        }}
                                                        onBlur={() => {
                                                            handleRenameContainer(c.id, editingName);
                                                        }}
                                                        style={{ fontSize: 11, fontWeight: 700, color: '#3a2010', textAlign: 'center', zIndex: 3, maxWidth: '84%', lineHeight: 1.4, marginTop: 28, background: 'rgba(255,255,255,0.6)', border: '1px solid #6B4C1E', borderRadius: 4, padding: '1px 4px', width: '84%', outline: 'none' }}
                                                    />
                                                ) : (
                                                    <div style={{ position: 'relative', zIndex: 3, marginTop: 28, maxWidth: '84%' }} className="group/name">
                                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#3a2010', textAlign: 'center', lineHeight: 1.4 }}>{c.name}</div>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); setEditingContainerId(c.id); setEditingName(c.name); }}
                                                            className="absolute -top-3 -right-3 opacity-0 group-hover/name:opacity-100 transition-opacity"
                                                            style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', border: '1px solid #6B4C1E60', borderRadius: 3 }}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#6B4C1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                        </button>
                                                    </div>
                                                )}
                                                <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 9, color: '#6B4C1E', zIndex: 3 }}>{new Date(c.createdAt).toLocaleDateString()}</div>
                                                {/* Name */}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {subTab === 'questions' && selectedContainerId && (
                    <>
                        {/* Type breakdown row — only when there are questions */}
                        {statusFiltered.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] text-muted-foreground mr-0.5">By type:</span>
                                <button
                                    onClick={() => setTypeFilter('ALL')}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all border ${typeFilter === 'ALL' ? 'bg-foreground/10 border-foreground/30 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                                    All ({statusFiltered.length})
                                </button>
                                {(Object.entries(typeCounts) as [QuestionType, number][]).map(([type, count]) => (
                                    <button key={type} onClick={() => setTypeFilter(typeFilter === type ? 'ALL' : type)}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all border ${typeFilter === type ? `${TYPE_META[type]?.color} border-current/30` : 'border-border text-muted-foreground hover:text-foreground'}`}>
                                        <span>{TYPE_META[type]?.label}</span>
                                        {count}
                                    </button>
                                ))}
                                <button onClick={() => selectedContainerId && fetchQuestions(selectedContainerId)}
                                    className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all" title="Refresh">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                                </button>
                            </div>
                        )}

                        {qLoading ? (
                            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Loading questions…
                            </div>
                        ) : displayedQuestions.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <FlaskConical size={32} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No questions yet</p>
                                <p className="text-xs mt-1 opacity-60">Upload a PDF & sit back — let the AI do its magic ✨</p>
                            </div>
                        ) : (
                            <div className="space-y-3 pl-1 pb-1">
                                {(() => {
                                        let globalIdx = 0;
                                        return groupedQuestions.map((group, gIdx) => (
                                            <div key={group.batchId ?? group.source + gIdx}>
                                                {/* Source group header */}
                                                <div className={`flex items-center gap-3 ${gIdx === 0 ? 'mb-3' : 'mt-5 mb-3'}`}>
                                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/60 text-[11px] text-muted-foreground shrink-0">
                                                        {group.source === 'MANUAL' ? (
                                                            <>
                                                                <Pencil size={11} className="text-primary/60" />
                                                                <span className="font-medium text-foreground/70">Manually added</span>
                                                            </>
                                                        ) : group.source === 'IMPORTED' ? (
                                                            <>
                                                                <ArrowDownToLine size={11} className="text-primary/60" />
                                                                <span className="font-medium text-foreground/70">Imported</span>
                                                                <span className="opacity-50">·</span>
                                                                <span>{new Date(group.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <FileText size={11} className="text-primary/60" />
                                                                <span className="font-medium text-foreground/70">{group.sourceFile ?? 'PDF'}</span>
                                                                <span className="opacity-50">·</span>
                                                                <span>{new Date(group.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                                <span className="opacity-50">at</span>
                                                                <span>{new Date(group.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 h-px bg-border/60" />
                                                </div>
                                                {group.items.map(q => {
                                                    globalIdx++;
                                                    const idx = globalIdx;
                                                    return (
                                                        <div key={q.id} className="mb-3">
                                                            <QuestionCard question={q} index={idx}
                                                                modules={modules}
                                                                onApprove={() => updateStatus(q.id, 'APPROVED')}
                                                                onReject={() => updateStatus(q.id, 'REJECTED')}
                                                                onDelete={() => q.status === 'REJECTED' ? deleteQuestion(q.id) : updateStatus(q.id, 'REJECTED')}
                                                                onAssignModule={(moduleId) => assignToModule(q.id, moduleId)}
                                                                onUnassignModule={() => unassignFromModule(q.id)}
                                                                onEdit={(qText, ans, opts) => handleEditQuestion(q.id, qText, ans, opts)}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ));
                                    })()
                                }
                            </div>
                        )}
                    </>
                )}

                {/* ── TESTS TAB ── */}
                {subTab === 'tests' && (
                    <>

                        {tLoading ? (
                            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Loading tests…
                            </div>
                        ) : tests.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <Brain size={32} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No tests yet</p>
                                <p className="text-xs mt-1 opacity-60">Create a test and add approved questions to it</p>
                            </div>
                        ) : (() => {
                            const now = new Date();
                            const isExpired = (t: Test) => t.status === 'COMPLETED' || (!!t.validUntil && new Date(t.validUntil) < now);
                            const liveTests = tests.filter(t => !isExpired(t));
                            const historyTests = tests.filter(t => isExpired(t));
                            const renderCard = (test: Test) => (
                                <TestCard key={test.id} test={test}
                                    onOpen={() => openBuilder(test.id)}
                                    onCopyLink={() => copyLink(test.testLink)}
                                    onDelete={() => deleteTest(test.id)}
                                    onActivate={() => updateTestStatus(test, 'ACTIVE')}
                                    copiedLink={copiedLink}
                                />
                            );
                            return (
                                <div className="space-y-6">
                                    {/* Live Tests */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground/70 uppercase tracking-wider shrink-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Live Tests
                                                <span className="text-muted-foreground font-normal normal-case tracking-normal">{liveTests.length}</span>
                                            </div>
                                            <div className="flex-1 h-px bg-border/60" />
                                        </div>
                                        {liveTests.length === 0 ? (
                                            <p className="text-xs text-muted-foreground pl-1">No active or draft tests</p>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3 px-1">{liveTests.map(renderCard)}</div>
                                        )}
                                    </div>

                                    {/* History */}
                                    {historyTests.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground/70 uppercase tracking-wider shrink-0">
                                                    <Clock size={11} className="text-muted-foreground" />
                                                    History
                                                    <span className="text-muted-foreground font-normal normal-case tracking-normal">{historyTests.length}</span>
                                                </div>
                                                <div className="flex-1 h-px bg-border/60" />
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 px-1">{historyTests.map(renderCard)}</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}

                {/* ── ASSIGNMENTS TAB ── */}
                {subTab === 'assignments' && (
                    <>
                        {aLoading ? (
                            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Loading assignments…
                            </div>
                        ) : assignments.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No assignments yet</p>
                                <p className="text-xs mt-1 opacity-60">Create an assignment to get started</p>
                            </div>
                        ) : (() => {
                            const now = new Date();
                            const isExpiredA = (a: Assignment) => a.status === 'COMPLETED' || (!!a.dueDate && new Date(a.dueDate) < now);
                            const liveAssignments = assignments.filter(a => !isExpiredA(a));
                            const historyAssignments = assignments.filter(a => isExpiredA(a));
                            return (
                                <div className="space-y-6">
                                    {/* Live Assignments */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground/70 uppercase tracking-wider shrink-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Live Assignments
                                                <span className="text-muted-foreground font-normal normal-case tracking-normal">{liveAssignments.length}</span>
                                            </div>
                                            <div className="flex-1 h-px bg-border/60" />
                                        </div>
                                        {liveAssignments.length === 0 ? (
                                            <p className="text-xs text-muted-foreground pl-1">No active or draft assignments</p>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3 px-1">
                                                {liveAssignments.map(a => <AssignmentCard key={a.id} assignment={a} onOpen={() => openBuilder(a.id, 'ASSIGNMENT')} onDelete={() => deleteAssignment(a.id)} onActivate={() => updateAssignmentStatus(a.id, 'ACTIVE')} onComplete={() => updateAssignmentStatus(a.id, 'COMPLETED')} />)}
                                            </div>
                                        )}
                                    </div>

                                    {/* History */}
                                    {historyAssignments.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground/70 uppercase tracking-wider shrink-0">
                                                    <Clock size={11} className="text-muted-foreground" />
                                                    History
                                                    <span className="text-muted-foreground font-normal normal-case tracking-normal">{historyAssignments.length}</span>
                                                </div>
                                                <div className="flex-1 h-px bg-border/60" />
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 px-1">
                                                {historyAssignments.map(a => <AssignmentCard key={a.id} assignment={a} onOpen={() => openBuilder(a.id, 'ASSIGNMENT')} onDelete={() => deleteAssignment(a.id)} onActivate={() => updateAssignmentStatus(a.id, 'ACTIVE')} onComplete={() => updateAssignmentStatus(a.id, 'COMPLETED')} />)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}

                {/* ── MODULES TAB ── */}
                {subTab === 'modules' && (
                    <>
                        <AnimatePresence>
                            {creatingModule && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                    className="p-4 rounded-xl border border-border bg-card/50 mb-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-sm">New Module</h3>
                                        <button onClick={() => setCreatingModule(false)}><X size={16} /></button>
                                    </div>
                                    <div className="space-y-3">
                                        <input value={newModName} onChange={e => setNewModName(e.target.value)} placeholder="Module name" className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                        <input value={newModDesc} onChange={e => setNewModDesc(e.target.value)} placeholder="Description (optional)" className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                    </div>
                                    <div className="flex justify-end gap-2 mt-3">
                                        <button onClick={() => setCreatingModule(false)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-all">Cancel</button>
                                        <button onClick={createModule} disabled={savingModule}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-white"
                                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                            {savingModule ? <><Loader2 size={13} className="animate-spin" />Creating…</> : 'Create'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {mLoading ? (
                            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Loading modules…
                            </div>
                        ) : modules.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <Layers size={32} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No modules yet</p>
                                <p className="text-xs mt-1 opacity-60">Group questions by chapter or topic</p>
                            </div>
                        ) : (
                            <div className="space-y-3 px-1">
                                {modules.map(m => (
                                    <div key={m.id}
                                        draggable={editingModuleId !== m.id}
                                        onDragStart={() => handleModuleDragStart(m.id)}
                                        onDragOver={e => handleModuleDragOver(e, m.id)}
                                        onDrop={() => handleModuleDrop(m.id)}
                                        onDragEnd={handleModuleDragEnd}
                                        className={`rounded-xl border bg-card overflow-hidden transition-all ${dragOverModuleId === m.id ? 'border-primary shadow-md scale-[1.01]' : 'border-border'} ${dragModuleId === m.id ? 'opacity-40' : 'opacity-100'}`}>

                                        {editingModuleId === m.id ? (
                                            <div className="px-4 py-3 space-y-2">
                                                <input autoFocus value={editModName} onChange={e => setEditModName(e.target.value)}
                                                    placeholder="Module name"
                                                    className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                                <input value={editModDesc} onChange={e => setEditModDesc(e.target.value)}
                                                    placeholder="Description (optional)"
                                                    className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                                <div className="flex justify-end gap-2 pt-1">
                                                    <button onClick={() => setEditingModuleId(null)}
                                                        className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-all">Cancel</button>
                                                    <button onClick={saveEditModule} disabled={savingEditModule || !editModName.trim()}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                                                        style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                                        {savingEditModule ? <><Loader2 size={13} className="animate-spin" />Saving…</> : 'Save'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/40 transition-all"
                                                    onClick={() => setSelectedModuleId(selectedModuleId === m.id ? null : m.id)}>
                                                    <div className="flex items-center gap-2">
                                                        <GripVertical size={14} className="text-muted-foreground/40 cursor-grab shrink-0" onClick={e => e.stopPropagation()} />
                                                        <BookOpen size={15} className="text-muted-foreground" />
                                                        <span className="font-medium text-sm">{m.name}</span>
                                                        <span className="text-xs text-muted-foreground">{m.questions.length} questions</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={e => { e.stopPropagation(); startEditModule(m); }} className="text-xs text-muted-foreground hover:text-primary p-1 rounded transition-all"><Pencil size={13} /></button>
                                                        <button onClick={e => { e.stopPropagation(); setDeleteModuleConfirmId(m.id); }} className="text-xs text-muted-foreground hover:text-red-500 p-1 rounded transition-all"><Trash2 size={13} /></button>
                                                        {selectedModuleId === m.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    </div>
                                                </div>
                                                {selectedModuleId === m.id && (
                                                    <div className="border-t border-border/50">
                                                        {/* description + question list */}
                                                        <div className="px-4 pt-2 pb-1 space-y-1.5">
                                                            {(m as any).description && (
                                                                <p className="text-xs text-muted-foreground pt-1 pb-0.5 italic">{(m as any).description}</p>
                                                            )}
                                                            {m.questions.length === 0 ? (
                                                                <p className="text-xs text-muted-foreground py-2">No questions in this module</p>
                                                            ) : m.questions.map(mq => (
                                                                <div key={mq.id} className="flex items-start gap-2 py-1.5 group/mq">
                                                                    <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${TYPE_META[mq.question.type]?.color ?? 'bg-muted text-muted-foreground'}`}>{TYPE_META[mq.question.type]?.label}</span>
                                                                    <span className="flex-1 text-sm">{mq.question.question}</span>
                                                                    <button onClick={() => removeFromModule(m.id, mq.questionId)}
                                                                        className="shrink-0 text-muted-foreground hover:text-red-500 opacity-0 group-hover/mq:opacity-100 transition-all p-0.5 rounded mt-0.5"
                                                                        title="Remove from module">
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Add custom question form / button */}
                                                        {addQModuleId === m.id ? (
                                                            <div className="px-4 pb-4 pt-2 border-t border-border/40 space-y-3">
                                                                {/* Type chips */}
                                                                <div>
                                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Question Type</p>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {(['MCQ','SHORT_ANSWER','TRUE_FALSE','FILL_BLANK','NUMERICAL'] as QuestionType[]).map(t => (
                                                                            <button key={t} onClick={() => setCustomQ(q => ({ ...q, type: t, answer: '', options: ['','','',''], formula: '' }))}
                                                                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${customQ.type === t ? `${TYPE_META[t]?.color} border-current/30` : 'border-border text-muted-foreground hover:text-foreground'}`}>
                                                                                {TYPE_META[t]?.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Question text */}
                                                                <div>
                                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Question</p>
                                                                    <textarea value={customQ.question} onChange={e => setCustomQ(q => ({ ...q, question: e.target.value }))}
                                                                        placeholder="Type your question here…" rows={2}
                                                                        className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                                                </div>

                                                                {/* MCQ options */}
                                                                {customQ.type === 'MCQ' && (
                                                                    <div>
                                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Options</p>
                                                                        <div className="space-y-1.5">
                                                                            {customQ.options.map((opt, i) => (
                                                                                <div key={i} className="flex items-center gap-2">
                                                                                    <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{String.fromCharCode(65+i)}.</span>
                                                                                    <input value={opt} onChange={e => setCustomQ(q => { const o = [...q.options] as [string,string,string,string]; o[i] = e.target.value; return { ...q, options: o }; })}
                                                                                        placeholder={`Option ${String.fromCharCode(65+i)}`}
                                                                                        className="flex-1 text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                                                                    <input type="radio" name={`correct-${m.id}`} checked={customQ.answer === opt && opt !== ''}
                                                                                        onChange={() => setCustomQ(q => ({ ...q, answer: opt }))}
                                                                                        className="accent-primary shrink-0" title="Mark as correct" />
                                                                                </div>
                                                                            ))}
                                                                            <p className="text-[10px] text-muted-foreground pl-6">Select the radio button next to the correct answer</p>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* True/False answer */}
                                                                {customQ.type === 'TRUE_FALSE' && (
                                                                    <div>
                                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Answer</p>
                                                                        <div className="flex gap-2">
                                                                            {['True','False'].map(v => (
                                                                                <button key={v} onClick={() => setCustomQ(q => ({ ...q, answer: v }))}
                                                                                    className={`px-4 py-1.5 text-sm rounded-lg border font-medium transition-all ${customQ.answer === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                                                                                    {v}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Numerical: formula + answer */}
                                                                {customQ.type === 'NUMERICAL' && (
                                                                    <div className="space-y-2">
                                                                        <div>
                                                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Formula <span className="normal-case font-normal">(optional)</span></p>
                                                                            <input value={customQ.formula} onChange={e => setCustomQ(q => ({ ...q, formula: e.target.value }))}
                                                                                placeholder="e.g. 2 * π * r"
                                                                                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Answer</p>
                                                                            <input value={customQ.answer} onChange={e => setCustomQ(q => ({ ...q, answer: e.target.value }))}
                                                                                placeholder="Numerical answer"
                                                                                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Short / Fill blank answer */}
                                                                {(customQ.type === 'SHORT_ANSWER' || customQ.type === 'FILL_BLANK') && (
                                                                    <div>
                                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Answer</p>
                                                                        <input value={customQ.answer} onChange={e => setCustomQ(q => ({ ...q, answer: e.target.value }))}
                                                                            placeholder="Expected answer"
                                                                            className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                                                    </div>
                                                                )}

                                                                {/* MCQ answer sync on blur */}
                                                                {customQ.type === 'MCQ' && customQ.answer === '' && (
                                                                    <p className="text-[11px] text-amber-500">Please select the correct option above</p>
                                                                )}

                                                                <div className="flex justify-end gap-2 pt-1">
                                                                    <button onClick={() => { setAddQModuleId(null); setCustomQ({ type: 'MCQ', question: '', answer: '', options: ['','','',''], formula: '' }); }}
                                                                        className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-all">Cancel</button>
                                                                    <button onClick={() => saveCustomQuestion(m.id)} disabled={savingCustomQ}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                                                                        style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                                                        {savingCustomQ ? <><Loader2 size={13} className="animate-spin" />Adding…</> : <><Plus size={13} />Add Question</>}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="px-4 pb-3 pt-2">
                                                                <button onClick={() => { setAddQModuleId(m.id); setSelectedModuleId(m.id); }}
                                                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all">
                                                                    <Plus size={12} /> Add Custom Question
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Paper Builder — full-screen overlay */}
            {paperBuilderOpen && paperBuilderTestId && (
                <PaperBuilder
                    testId={paperBuilderTestId}
                    approvedQuestions={approvedQuestions}
                    modules={modules}
                    lockedPaperType={paperBuilderType}
                    entityType={paperBuilderType === 'ASSIGNMENT' ? 'assignment' : 'test'}
                    onClose={() => { setPaperBuilderOpen(false); setPaperBuilderTestId(null); }}
                    onSaved={handlePaperSaved}
                />
            )}

            {/* Create Test draggable modal */}
            <AnimatePresence>
                {createTestOpen && (
                    <>
                        <motion.div
                            key="ct-overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40"
                            onClick={() => setCreateTestOpen(false)}
                        />
                        <motion.div
                            key="ct-modal"
                            drag
                            dragMomentum={false}
                            dragElastic={0}
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="fixed z-50 bg-card border border-border rounded-2xl shadow-2xl w-[420px]"
                            style={{ top: '15%', left: '50%', x: '-50%' }}
                        >
                            {/* Drag handle */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 cursor-grab active:cursor-grabbing select-none">
                                <div className="flex items-center gap-2">
                                    <ClipboardList size={15} className="text-muted-foreground" />
                                    <h3 className="font-semibold text-sm">Create New Test</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setCreateTestOpen(false)} className="text-muted-foreground hover:text-foreground">
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* Form */}
                            <div className="px-5 py-4 grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-xs text-muted-foreground">Title *</label>
                                    <input value={newTest.title} onChange={e => setNewTest(p => ({ ...p, title: e.target.value }))}
                                        placeholder="e.g. Chapter 5 Quiz"
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-muted-foreground">Description</label>
                                    <input value={newTest.description} onChange={e => setNewTest(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                                {[
                                    { label: 'Duration (mins)', key: 'durationMinutes', min: 5, max: 300 },
                                    { label: 'Total Marks', key: 'totalMarks', min: 1, max: 1000 },
                                    { label: 'No. of Questions', key: 'numberOfQuestions', min: 1, max: 100 },
                                    { label: 'Max Attempts', key: 'maxAttempts', min: 1, max: 10 },
                                ].map(({ label, key, min, max }) => (
                                    <div key={key}>
                                        <label className="text-xs text-muted-foreground">{label}</label>
                                        <input type="number" min={min} max={max}
                                            value={(newTest as Record<string, unknown>)[key] as number}
                                            onChange={e => setNewTest(p => ({ ...p, [key]: Number(e.target.value) }))}
                                            className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs text-muted-foreground">Valid Until (optional)</label>
                                    <input type="datetime-local" value={newTest.validUntil}
                                        onChange={e => setNewTest(p => ({ ...p, validUntil: e.target.value }))}
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-2 px-5 pb-5">
                                <button onClick={() => setCreateTestOpen(false)}
                                    className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={handleCreateTest} disabled={savingTest}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                                    style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                    {savingTest ? <><Loader2 size={13} className="animate-spin" />Creating…</> : 'Create Test'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Create Assignment draggable modal */}
            <AnimatePresence>
                {createAssignmentOpen && (
                    <>
                        <motion.div
                            key="ca-overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40"
                            onClick={() => setCreateAssignmentOpen(false)}
                        />
                        <motion.div
                            key="ca-modal"
                            drag
                            dragMomentum={false}
                            dragElastic={0}
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="fixed z-50 bg-card border border-border rounded-2xl shadow-2xl w-[420px]"
                            style={{ top: '15%', left: '50%', x: '-50%' }}
                        >
                            {/* Drag handle */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 cursor-grab active:cursor-grabbing select-none">
                                <div className="flex items-center gap-2">
                                    <BookOpen size={15} className="text-muted-foreground" />
                                    <h3 className="font-semibold text-sm">Create New Assignment</h3>
                                </div>
                                <button onClick={() => setCreateAssignmentOpen(false)} className="text-muted-foreground hover:text-foreground">
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Form */}
                            <div className="px-5 py-4 grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-xs text-muted-foreground">Title *</label>
                                    <input value={newAssignment.title} onChange={e => setNewAssignment(p => ({ ...p, title: e.target.value }))}
                                        placeholder="e.g. Chapter 3 Assignment"
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-muted-foreground">Description</label>
                                    <input value={newAssignment.description} onChange={e => setNewAssignment(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Total Marks</label>
                                    <input type="number" min={1} max={500}
                                        value={newAssignment.totalMarks}
                                        onChange={e => setNewAssignment(p => ({ ...p, totalMarks: Number(e.target.value) }))}
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Due Date (optional)</label>
                                    <input type="datetime-local" value={newAssignment.dueDate}
                                        onChange={e => setNewAssignment(p => ({ ...p, dueDate: e.target.value }))}
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-2 px-5 pb-5">
                                <button onClick={() => setCreateAssignmentOpen(false)}
                                    className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={handleCreateAssignment} disabled={savingAssignment || !newAssignment.title.trim()}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                                    style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                    {savingAssignment ? <><Loader2 size={13} className="animate-spin" />Creating…</> : 'Create Assignment'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Delete container confirm modal */}
            <AnimatePresence>
                {deleteConfirmId && (
                    <>
                        <motion.div
                            key="overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                            onClick={() => setDeleteConfirmId(null)}
                        />
                        <motion.div
                            key="modal"
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                        >
                            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-80 pointer-events-auto flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-foreground">Delete this collection?</p>
                                    <p className="text-xs text-muted-foreground">
                                        &quot;{containers.find(c => c.id === deleteConfirmId)?.name}&quot; and its {containers.find(c => c.id === deleteConfirmId)?.questionCount ?? 0} question(s) will be permanently deleted. This cannot be undone.
                                    </p>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setDeleteConfirmId(null)}
                                        className="px-4 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                        Cancel
                                    </button>
                                    <button onClick={() => handleDeleteContainer(deleteConfirmId)}
                                        className="px-4 py-1.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Delete module confirm modal */}
            <AnimatePresence>
                {deleteModuleConfirmId && (
                    <>
                        <motion.div
                            key="mod-overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                            onClick={() => setDeleteModuleConfirmId(null)}
                        />
                        <motion.div
                            key="mod-modal"
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                        >
                            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-80 pointer-events-auto flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-foreground">Delete this module?</p>
                                    <p className="text-xs text-muted-foreground">
                                        "{modules.find(m => m.id === deleteModuleConfirmId)?.name}" will be permanently deleted. This cannot be undone.
                                    </p>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setDeleteModuleConfirmId(null)}
                                        className="px-4 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                        Cancel
                                    </button>
                                    <button onClick={() => { deleteModule(deleteModuleConfirmId); setDeleteModuleConfirmId(null); }}
                                        className="px-4 py-1.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Share modal */}
            <AnimatePresence>
                {shareOpen && (
                    <>
                        <motion.div key="sh-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShareOpen(false)} />
                        <motion.div key="sh-modal" initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 16 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4">
                            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md pointer-events-auto flex flex-col gap-4 max-h-[85vh]">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold">Share questions</p>
                                    <button onClick={() => setShareOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                                </div>

                                {shareToken ? (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-xs text-muted-foreground">Share this code with another teacher in your institution. It expires in 7 days.</p>
                                        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
                                            <span className="flex-1 text-sm font-mono break-all select-all">{shareToken}</span>
                                            <button onClick={() => { navigator.clipboard.writeText(shareToken); toast.success('Copied!'); }}
                                                className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                                <Copy size={13} />
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">The recipient opens their container → Import → pastes this code.</p>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-xs text-muted-foreground">Select approved questions to share. The recipient can import them into their own container.</p>
                                        <div className="flex-1 overflow-y-auto flex flex-col gap-1 max-h-72">
                                            {containerQuestions.length === 0 ? (
                                                <p className="text-xs text-muted-foreground text-center py-6">No questions in this container yet.</p>
                                            ) : (
                                                <>
                                                    <button onClick={() => setShareSelectedIds(
                                                        shareSelectedIds.size === containerQuestions.length
                                                            ? new Set()
                                                            : new Set(containerQuestions.map(q => q.id))
                                                    )} className="text-xs text-primary hover:underline self-start mb-1">
                                                        {shareSelectedIds.size === containerQuestions.length ? 'Deselect all' : 'Select all'}
                                                    </button>
                                                    {containerQuestions.map(q => (
                                                        <label key={q.id} className="flex items-start gap-2.5 cursor-pointer px-3 py-2 rounded-lg hover:bg-muted/60 transition-all">
                                                            <input type="checkbox" checked={shareSelectedIds.has(q.id)}
                                                                onChange={e => {
                                                                    const next = new Set(shareSelectedIds);
                                                                    e.target.checked ? next.add(q.id) : next.delete(q.id);
                                                                    setShareSelectedIds(next);
                                                                }} className="mt-0.5 shrink-0" />
                                                            <span className="text-sm leading-snug line-clamp-2">{q.question}</span>
                                                        </label>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                        <div className="flex gap-2 justify-end pt-1">
                                            <button onClick={() => setShareOpen(false)}
                                                className="text-xs px-4 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                                Cancel
                                            </button>
                                            <button onClick={handleCreateShareToken} disabled={shareCreating || shareSelectedIds.size === 0}
                                                className="text-xs px-4 py-1.5 rounded-lg text-white font-medium transition-all disabled:opacity-60"
                                                style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                                {shareCreating ? 'Generating…' : `Generate link (${shareSelectedIds.size})`}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Import modal */}
            <AnimatePresence>
                {importOpen && (
                    <>
                        <motion.div key="im-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setImportOpen(false)} />
                        <motion.div key="im-modal" initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 16 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4">
                            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md pointer-events-auto flex flex-col gap-4 max-h-[85vh]">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold">Import questions</p>
                                    <button onClick={() => setImportOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                                </div>

                                <div className="flex gap-2">
                                    <input value={importTokenInput} onChange={e => setImportTokenInput(e.target.value)}
                                        placeholder="Paste share code here…"
                                        className="flex-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                    <button onClick={handleVerifyShareToken} disabled={importVerifying}
                                        className="text-xs px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all disabled:opacity-60 shrink-0">
                                        {importVerifying ? <Loader2 size={13} className="animate-spin" /> : 'Verify'}
                                    </button>
                                </div>

                                {importPreview && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground">{importPreview.questions.length} question(s) in this share. Select which to import.</p>
                                            <button onClick={() => setImportSelectedIds(
                                                importSelectedIds.size === importPreview.questions.length
                                                    ? new Set()
                                                    : new Set(importPreview.questions.map(q => q.id))
                                            )} className="text-xs text-primary hover:underline">
                                                {importSelectedIds.size === importPreview.questions.length ? 'Deselect all' : 'Select all'}
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto flex flex-col gap-1 max-h-64">
                                            {importPreview.questions.map(q => (
                                                <label key={q.id} className="flex items-start gap-2.5 cursor-pointer px-3 py-2 rounded-lg hover:bg-muted/60 transition-all">
                                                    <input type="checkbox" checked={importSelectedIds.has(q.id)}
                                                        onChange={e => {
                                                            const next = new Set(importSelectedIds);
                                                            e.target.checked ? next.add(q.id) : next.delete(q.id);
                                                            setImportSelectedIds(next);
                                                        }} className="mt-0.5 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm leading-snug line-clamp-2">{q.question}</p>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 inline-block ${TYPE_META[q.type]?.color ?? 'bg-muted text-muted-foreground'}`}>{TYPE_META[q.type]?.label ?? q.type}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 justify-end pt-1">
                                            <button onClick={() => setImportOpen(false)}
                                                className="text-xs px-4 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                                Cancel
                                            </button>
                                            <button onClick={handleImportQuestions} disabled={importSaving || importSelectedIds.size === 0}
                                                className="text-xs px-4 py-1.5 rounded-lg text-white font-medium transition-all disabled:opacity-60"
                                                style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                                {importSaving ? 'Importing…' : `Import selected (${importSelectedIds.size})`}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({ question, modules, index, onApprove, onReject, onDelete, onAssignModule, onUnassignModule, onEdit }: {
    question: Question;
    modules: TaskModule[];
    index: number;
    onApprove: () => void;
    onReject: () => void;
    onDelete: () => void;
    onAssignModule: (moduleId: string) => void;
    onUnassignModule: () => void;
    onEdit: (q: string, ans: string, opts?: string[]) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editQuestion, setEditQuestion] = useState(question.question);
    const [editAnswer, setEditAnswer] = useState(question.answer);
    const isMcqType = question.type === 'MCQ' || question.type === 'CONCEPTUAL';
    const initialOptions = isMcqType
        ? (question.type === 'MCQ' ? (question.options ?? ['', '', '', '']) : (() => {
              const cd = question.details as ConceptualDetails | null;
              if (!cd) return ['', '', '', ''];
              return [cd.correct_answer, ...(cd.distractors ?? ['', '', ''])].slice(0, 4);
          })())
        : ['', '', '', ''];
    const [editOptions, setEditOptions] = useState<string[]>(initialOptions);
    const [editCorrectIdx, setEditCorrectIdx] = useState<number>(() => {
        if (!isMcqType) return 0;
        if (question.type === 'MCQ') return (question.options ?? []).indexOf(question.answer);
        const cd = question.details as ConceptualDetails | null;
        if (!cd) return 0;
        const all = [cd.correct_answer, ...(cd.distractors ?? [])].slice(0, 4);
        return 0; // correct_answer is always first
    });
    const meta = TYPE_META[question.type];
    const statusMeta = STATUS_META[question.status];
    const marks = (question.details as Record<string, unknown> | null)?.marks as number | undefined;

    const isNumerical = question.type === 'NUMERICAL';
    const isConceptual = question.type === 'CONCEPTUAL' || question.type === 'MCQ';
    const numDetails = isNumerical ? question.details as NumericalDetails : null;
    const conDetails = isConceptual ? question.details as ConceptualDetails : null;
    const isOpenEnded = question.type === 'FILL_BLANK' || question.type === 'TRUE_FALSE' || question.type === 'SHORT_ANSWER';

    return (
        <div className="rounded-xl border border-border bg-card">
            <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                    <span className="text-xs font-bold text-muted-foreground shrink-0 mt-0.5 w-5 text-right">{index}.</span>
                    <p className="flex-1 text-sm leading-snug">{question.question}</p>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <div className="flex flex-wrap gap-1.5 justify-end">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${meta?.color ?? 'bg-muted text-muted-foreground'}`}>{meta?.label}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${statusMeta.color}`}>{statusMeta.label}</span>
                            {question.category && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{question.category}</span>}
                        </div>
                        <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground shrink-0">
                            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                    </div>
                </div>

                {/* Compact answer preview when not expanded */}
                {!expanded && isNumerical && numDetails && (
                    <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-3">
                        <span className="font-mono">f: {numDetails.correct_answer_formula}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">= {question.answer}</span>
                    </div>
                )}
                {!expanded && isConceptual && conDetails && (
                    <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1"><ArrowRight size={11} className="shrink-0" />{conDetails.correct_answer ?? question.answer}</p>
                )}
                {!expanded && isOpenEnded && (
                    <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 line-clamp-2 flex items-center gap-1"><ArrowRight size={11} className="shrink-0" />{question.answer}</p>
                )}
            </div>

            {/* Expanded detail */}
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border/50">
                        <div className="px-4 py-3 space-y-2">
                            {isNumerical && numDetails && (
                                <>
                                    <div className="text-xs">
                                        <span className="text-muted-foreground">Variables: </span>
                                        <span className="font-mono">{Object.entries(numDetails.variables).map(([k, v]) => `${k} = ${v}`).join(', ')}</span>
                                    </div>
                                    <div className="text-xs">
                                        <span className="text-muted-foreground">Formula: </span>
                                        <span className="font-mono">{numDetails.correct_answer_formula}</span>
                                    </div>
                                    {(numDetails.distractor_formulas ?? []).length > 0 && (
                                        <div className="text-xs text-muted-foreground">
                                            Distractor formulas: <span className="font-mono">{numDetails.distractor_formulas!.join(', ')}</span>
                                        </div>
                                    )}
                                    <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><ArrowRight size={11} className="shrink-0" /> Answer: {question.answer}</div>
                                </>
                            )}
                            {isConceptual && conDetails && (
                                <>
                                    {[conDetails.correct_answer, ...(conDetails.distractors ?? [])].filter(Boolean).map((opt, i) => (
                                        <div key={i} className={`text-xs px-2 py-1 rounded-lg ${opt === conDetails.correct_answer ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                                            {'ABCD'[i]}. {opt} {opt === conDetails.correct_answer && <CheckCircle2 size={10} className="inline ml-1" />}
                                        </div>
                                    ))}
                                </>
                            )}
                            {question.type === 'MCQ' && Array.isArray(question.options) && (
                                question.options.map((opt, i) => (
                                    <div key={i} className={`text-xs px-2 py-1 rounded-lg ${opt === question.answer ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                                        {'ABCD'[i]}. {opt} {opt === question.answer && <CheckCircle2 size={10} className="inline ml-1" />}
                                    </div>
                                ))
                            )}
                            {question.type === 'FILL_BLANK' && (
                                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><ArrowRight size={11} className="shrink-0" /> Fill: {question.answer}</div>
                            )}
                            {question.type === 'TRUE_FALSE' && (
                                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <ArrowRight size={11} className="shrink-0" /> {String(question.answer).charAt(0).toUpperCase() + String(question.answer).slice(1)}
                                </div>
                            )}
                            {question.type === 'SHORT_ANSWER' && (
                                <div className="text-xs rounded-lg bg-muted/60 px-3 py-2 text-foreground leading-relaxed">
                                    <span className="text-muted-foreground text-[10px] uppercase font-semibold block mb-1">Model Answer</span>
                                    {question.answer}
                                </div>
                            )}
                            <div className="flex justify-end pt-1">
                                <span className="text-[10px] text-muted-foreground">
                                    {new Date(question.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    {' · '}
                                    {new Date(question.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action row */}
            <div className="px-4 py-2 flex items-center gap-2 border-t border-border/40 bg-muted/20">
                {question.status === 'PENDING_REVIEW' && (
                    <>
                        <button onClick={onApprove} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all">
                            <Check size={12} /> Approve
                        </button>
                        <button onClick={onReject} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all">
                            <XIcon size={12} /> Reject
                        </button>
                    </>
                )}
                {question.status === 'REJECTED' && (
                    <button onClick={onApprove} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all">
                        <Check size={12} /> Approve
                    </button>
                )}
                {question.status === 'APPROVED' && (
                    <button onClick={onReject} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all">
                        <XIcon size={12} /> Revoke
                    </button>
                )}
                {/* Module assignment */}
                <div className="relative ml-auto">
                    {question.moduleAssignment ? (
                        <div className="flex items-center gap-1">
                            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                <BookMarked size={10} /> {question.moduleAssignment.module.name}
                            </span>
                            <button onClick={onUnassignModule} className="text-muted-foreground hover:text-red-500 p-0.5 transition-all" title="Remove from module">
                                <XIcon size={11} />
                            </button>
                        </div>
                    ) : question.status === 'APPROVED' ? (
                        <button onClick={() => setModuleDropdownOpen(v => !v)}
                            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all">
                            <BookMarked size={10} /> Assign to Module
                        </button>
                    ) : null}
                    {moduleDropdownOpen && !question.moduleAssignment && (
                        <div className="absolute bottom-full right-0 mb-1 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px]">
                            {modules.length === 0 ? (
                                <p className="text-xs text-muted-foreground px-3 py-2">No modules yet</p>
                            ) : modules.map(m => (
                                <button key={m.id} onClick={() => { onAssignModule(m.id); setModuleDropdownOpen(false); }}
                                    className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted transition-all truncate">
                                    {m.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={() => { setEditQuestion(question.question); setEditAnswer(question.answer); setEditOpen(v => !v); }}
                    className={`p-1 rounded transition-all ${editOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <div className="relative">
                    <button onClick={() => setDeleteConfirm(true)} className="text-muted-foreground hover:text-red-500 p-1 rounded transition-all">
                        <Trash2 size={13} />
                    </button>
                    <AnimatePresence>
                        {deleteConfirm && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                className="absolute bottom-8 right-0 z-30 bg-card border border-border rounded-xl shadow-xl p-3 flex flex-col gap-2"
                                style={{ width: 160 }}>
                                <p className="text-xs font-semibold text-foreground">{question.status === 'REJECTED' ? 'Delete this question?' : 'Reject this question?'}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">{question.status === 'REJECTED' ? 'This cannot be undone.' : 'It will be moved to Rejected.'}</p>
                                <div className="flex gap-1.5 mt-0.5">
                                    <button onClick={() => setDeleteConfirm(false)}
                                        className="flex-1 text-xs py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                        Cancel
                                    </button>
                                    <button onClick={() => { setDeleteConfirm(false); onDelete(); }}
                                        className="flex-1 text-xs py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                        {question.status === 'REJECTED' ? 'Delete' : 'Reject'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Edit panel */}
            <AnimatePresence>
                {editOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border/50">
                        <div className="px-4 py-3 flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Question</label>
                                <textarea value={editQuestion} onChange={e => setEditQuestion(e.target.value)} rows={3}
                                    className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
                            </div>
                            {isMcqType ? (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Options (select correct)</label>
                                    {editOptions.map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <button onClick={() => { setEditCorrectIdx(i); setEditAnswer(editOptions[i]); }}
                                                className={`w-4 h-4 rounded-full border-2 shrink-0 ${editCorrectIdx === i ? 'border-emerald-500 bg-emerald-500' : 'border-border'}`} />
                                            <span className="text-xs text-muted-foreground shrink-0 w-4">{'ABCD'[i]}.</span>
                                            <input value={opt} onChange={e => {
                                                const next = [...editOptions]; next[i] = e.target.value;
                                                setEditOptions(next);
                                                if (editCorrectIdx === i) setEditAnswer(e.target.value);
                                            }} className="flex-1 text-sm rounded-lg border border-border bg-background px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Answer</label>
                                    <textarea value={editAnswer} onChange={e => setEditAnswer(e.target.value)} rows={2}
                                        className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                            )}
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditOpen(false)}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => {
                                        onEdit(editQuestion, editAnswer, isMcqType ? editOptions : undefined);
                                        setEditOpen(false);
                                    }}
                                    className="text-xs px-3 py-1.5 rounded-lg text-white font-medium transition-all"
                                    style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                    Save
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Assignment Card ───────────────────────────────────────────────────────────

function AssignmentCard({ assignment, onOpen, onDelete, onActivate, onComplete }: {
    assignment: Assignment; onOpen: () => void;
    onDelete: () => void; onActivate: () => void; onComplete: () => void;
}) {
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const effectiveStatus: AssignmentStatus = (assignment.dueDate && new Date(assignment.dueDate) < new Date()) ? 'COMPLETED' : assignment.status;
    const statusColor = {
        DRAFT: 'text-muted-foreground bg-muted',
        ACTIVE: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950',
        COMPLETED: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950',
    }[effectiveStatus];

    return (
        <div className="rounded-xl border border-border bg-card px-6 py-5 flex flex-col gap-4 min-h-[130px]">
            {/* Top row */}
            <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${statusColor}`}>{effectiveStatus}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><FileText size={12} />{assignment.totalMarks} marks</span>
                        <span className="text-muted-foreground opacity-40">·</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><BookOpen size={12} />{assignment.numberOfQuestions} questions</span>
                        {assignment._count.totalStudents != null && (
                            <>
                                <span className="text-muted-foreground opacity-40">·</span>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users size={12} />{assignment._count.totalStudents} students</span>
                            </>
                        )}
                    </div>
                    <h3 className="font-semibold text-base truncate mb-1.5">{assignment.title}</h3>
                    {assignment.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{assignment.description}</p>
                    )}
                </div>
                {/* Top-right icons */}
                <div className="flex items-start gap-1 shrink-0">
                    <div className="relative">
                        <button onClick={() => setDeleteConfirm(v => !v)} className="text-muted-foreground hover:text-red-500 p-1 rounded transition-all">
                            <Trash2 size={15} />
                        </button>
                        <AnimatePresence>
                            {deleteConfirm && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                    className="absolute right-0 top-7 z-30 bg-card border border-border rounded-xl shadow-xl p-3 w-56 flex flex-col gap-2">
                                    <p className="text-xs font-semibold text-foreground">Delete this assignment?</p>
                                    <p className="text-[11px] text-muted-foreground">&quot;{assignment.title}&quot; will be permanently deleted.</p>
                                    <div className="flex gap-1.5 justify-end">
                                        <button onClick={() => setDeleteConfirm(false)}
                                            className="px-2.5 py-1 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                            Cancel
                                        </button>
                                        <button onClick={() => { setDeleteConfirm(false); onDelete(); }}
                                            className="px-2.5 py-1 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                            Delete
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Bottom row */}
            <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span><span className="text-foreground/50">Created at:</span> {assignment.createdAt ? `${new Date(assignment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(assignment.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—'}</span>
                    <span className="opacity-40">·</span>
                    <span><span className="text-foreground/50">{effectiveStatus === 'COMPLETED' ? 'Due was:' : 'Due:'}</span> {assignment.dueDate ? `${new Date(assignment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(assignment.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                    {effectiveStatus === 'DRAFT' && (
                        <button onClick={onActivate} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all">
                            <Play size={12} /> Activate
                        </button>
                    )}
                    {effectiveStatus === 'ACTIVE' && (
                        <button onClick={onComplete} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                            <CheckCircle2 size={12} /> Complete
                        </button>
                    )}
                    <button onClick={onOpen} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all flex items-center gap-1.5">
                        <Eye size={12} /> Open & Edit
                    </button>
                    <button className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all flex items-center gap-1.5">
                        <BarChart2 size={12} /> Results
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Test Card ─────────────────────────────────────────────────────────────────

function TestCard({ test, onOpen, onCopyLink, onDelete, onActivate, copiedLink }: {
    test: Test;
    onOpen: () => void;
    onCopyLink: () => void;
    onDelete: () => void;
    onActivate: () => void;
    copiedLink: string | null;
}) {
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const effectiveStatus = (test.validUntil && new Date(test.validUntil) < new Date()) ? 'COMPLETED' : test.status;
    const statusColor = { DRAFT: 'text-muted-foreground bg-muted', ACTIVE: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950', COMPLETED: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950' }[effectiveStatus];

    return (
        <div className="rounded-xl border border-border bg-card px-6 py-5 flex flex-col gap-4 min-h-[130px]">
            {/* Top row: content + icons */}
            <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${statusColor}`}>{effectiveStatus}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><BookOpen size={12} />{test.questions.length}/{test.numberOfQuestions} questions</span>
                        <span className="text-muted-foreground opacity-40">·</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users size={12} />{test._count.attempts} attempts</span>
                        <span className="text-muted-foreground opacity-40">·</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 size={12} />{test._count.submissions ?? 0} submitted</span>
                    </div>
                    <h3 className="font-semibold text-base truncate mb-1.5">{test.title}</h3>
                    {test.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{test.description}</p>
                    )}
                </div>
                {/* Top-right icons: copy + delete */}
                <div className="flex items-start gap-1 shrink-0">
                    {effectiveStatus === 'ACTIVE' && (
                        <div className="relative">
                            <button onClick={onCopyLink} className="text-muted-foreground hover:text-foreground p-1 rounded transition-all" title="Copy link">
                                {copiedLink === test.testLink ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Copy size={15} />}
                            </button>
                            <AnimatePresence>
                                {copiedLink === test.testLink && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 4, scale: 0.9 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                        className="absolute right-0 top-7 z-30 bg-card border border-border rounded-lg shadow-lg px-2.5 py-1.5 whitespace-nowrap">
                                        <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <CheckCircle2 size={11} /> Test link copied
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                    <div className="relative">
                        <button onClick={() => setDeleteConfirm(v => !v)} className="text-muted-foreground hover:text-red-500 p-1 rounded transition-all">
                            <Trash2 size={15} />
                        </button>
                        <AnimatePresence>
                            {deleteConfirm && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                    className="absolute right-0 top-7 z-30 bg-card border border-border rounded-xl shadow-xl p-3 w-52 flex flex-col gap-2">
                                    <p className="text-xs font-semibold text-foreground">Delete this test?</p>
                                    <p className="text-[11px] text-muted-foreground">"{test.title}" will be permanently deleted.</p>
                                    <div className="flex gap-1.5 justify-end">
                                        <button onClick={() => setDeleteConfirm(false)}
                                            className="px-2.5 py-1 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                            Cancel
                                        </button>
                                        <button onClick={() => { setDeleteConfirm(false); onDelete(); }}
                                            className="px-2.5 py-1 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                            Delete
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Bottom row */}
            <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={12} />{test.durationMinutes} min</span>
                    <span className="opacity-40">·</span>
                    <span>{test.totalMarks} marks</span>
                    <span className="opacity-40">|</span>
                    <span><span className="text-foreground/50">Created at:</span> {test.createdAt ? `${new Date(test.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(test.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—'}</span>
                    <span className="opacity-40">·</span>
                    <span><span className="text-foreground/50">{test.status === 'COMPLETED' ? 'Ended at:' : 'Ends at:'}</span> {test.validUntil ? `${new Date(test.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(test.validUntil).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                    {effectiveStatus === 'DRAFT' && (
                        <button onClick={onActivate} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all">
                            <Play size={12} /> Activate
                        </button>
                    )}
                    {effectiveStatus === 'ACTIVE' && (
                        <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                            <ArrowRight size={12} /> Resend
                        </button>
                    )}
                    <button onClick={onOpen} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all flex items-center gap-1.5">
                        <Eye size={12} /> Open & Edit
                    </button>
                    <button className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all flex items-center gap-1.5">
                        <BarChart2 size={12} /> Results
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Paper Builder ─────────────────────────────────────────────────────────────

function PaperBuilder({ testId, approvedQuestions, modules, lockedPaperType, entityType, onClose, onSaved }: {
    testId: string;
    approvedQuestions: Question[];
    modules: TaskModule[];
    lockedPaperType: 'TEST' | 'ASSIGNMENT';
    entityType: 'test' | 'assignment';
    onClose: () => void;
    onSaved: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mainTop, setMainTop] = useState(0);

    useLayoutEffect(() => {
        if (!isFullscreen) return;
        const main = document.querySelector('main');
        if (main) setMainTop(main.getBoundingClientRect().top);
    }, [isFullscreen]);

    // Metadata
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [paperType, setPaperType] = useState<'TEST' | 'ASSIGNMENT'>(lockedPaperType);
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [maxAttempts, setMaxAttempts] = useState(1);
    const [validUntil, setValidUntil] = useState('');
    const [isRandomized, setIsRandomized] = useState(false);
    const [answerSpace, setAnswerSpace] = useState(true);

    // Builder state
    const [sections, setSections] = useState<PaperSection[]>([]);
    const [builderQs, setBuilderQs] = useState<BuilderQuestion[]>([]);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

    // Left panel filters
    const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

    useEffect(() => {
        const loadUrl = entityType === 'assignment'
            ? `/teacher/tasks/assignments/${testId}`
            : `/teacher/tasks/tests/${testId}`;
        api.get(loadUrl)
            .then(res => {
                const t: TestDetail = res.data.data;
                setTitle(t.title);
                setDescription(t.description ?? '');
                setPaperType((t.paperType ?? 'TEST') as 'TEST' | 'ASSIGNMENT');
                setDurationMinutes(t.durationMinutes);
                setMaxAttempts(t.maxAttempts);
                setValidUntil(t.validUntil ? new Date(t.validUntil).toISOString().slice(0, 16) : '');
                setIsRandomized(t.isRandomized ?? false);
                setAnswerSpace(t.answerSpace ?? true);
                const rawSections = (t.sections ?? []) as unknown as Array<Record<string, unknown>>;
                const loadedSections: PaperSection[] = rawSections.map(s => ({
                    id: s.id as string,
                    title: s.title as string,
                    instruction: (s.instruction as string) ?? '',
                    questionTypes: (s.questionTypes as QuestionType[]) ?? [],
                    attemptCount: (s.attemptCount as number) ?? 0,
                    marksPerQuestion: (s.marksPerQuestion as number) ?? 1,
                }));
                const defaultSections: PaperSection[] = loadedSections.length > 0 ? loadedSections : [{
                    id: crypto.randomUUID(),
                    title: 'Section A',
                    instruction: '',
                    questionTypes: [],
                    attemptCount: 0,
                    marksPerQuestion: 1,
                }];
                setSections(defaultSections);
                setActiveSectionId(defaultSections[0]?.id ?? null);
                setBuilderQs(
                    t.questions
                        .map(tq => ({
                            questionId: tq.question.id,
                            sectionId: tq.sectionId ?? null,
                            marks: tq.marks ?? 1,
                            order: tq.order ?? 0,
                            isCompulsory: tq.isCompulsory,
                            question: tq.question,
                        }))
                        .sort((a, b) => a.order - b.order)
                );
            })
            .catch(() => toast.error('Failed to load test'))
            .finally(() => setLoading(false));
    }, [testId]);

    const addSection = () => {
        const newSec: PaperSection = {
            id: crypto.randomUUID(),
            title: `Section ${String.fromCharCode(65 + sections.length)}`,
            instruction: '',
            questionTypes: [],
            attemptCount: 0,
            marksPerQuestion: 1,
        };
        setSections(prev => [...prev, newSec]);
        setActiveSectionId(newSec.id);
    };

    const removeSection = (sectionId: string) => {
        setBuilderQs(prev => prev.map(q => q.sectionId === sectionId ? { ...q, sectionId: null } : q));
        setSections(prev => {
            const next = prev.filter(s => s.id !== sectionId);
            if (activeSectionId === sectionId) setActiveSectionId(next[0]?.id ?? null);
            return next;
        });
    };

    const addQuestionToBuilder = (question: Question) => {
        if (builderQs.find(q => q.questionId === question.id)) {
            toast.info('Already in paper');
            return;
        }
        const sectionId = paperType === 'TEST' ? (activeSectionId ?? null) : null;
        const section = sections.find(s => s.id === sectionId);
        setBuilderQs(prev => [...prev, {
            questionId: question.id,
            sectionId,
            marks: section ? section.marksPerQuestion : 1,
            order: prev.length,
            isCompulsory: true,
            question,
        }]);
    };

    const removeQuestion = (questionId: string) => {
        setBuilderQs(prev => prev.filter(q => q.questionId !== questionId).map((q, i) => ({ ...q, order: i })));
    };

    const moveQuestion = (questionId: string, direction: 'up' | 'down', sectionId: string | null) => {
        setBuilderQs(prev => {
            const pool = prev.filter(q => q.sectionId === sectionId);
            const idx = pool.findIndex(q => q.questionId === questionId);
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= pool.length) return prev;
            const newPool = [...pool];
            [newPool[idx], newPool[swapIdx]] = [newPool[swapIdx], newPool[idx]];
            const others = prev.filter(q => q.sectionId !== sectionId);
            return [...others, ...newPool].map((q, i) => ({ ...q, order: i }));
        });
    };

    const savePaper = async (activate = false) => {
        if (!title.trim()) return toast.error('Title is required');
        setSaving(true);
        try {
            const questionPayload = builderQs.map((q, i) => ({
                questionId: q.questionId,
                sectionId: q.sectionId,
                marks: q.marks,
                order: i,
                isCompulsory: q.isCompulsory,
            }));

            if (entityType === 'assignment') {
                await api.put(`/teacher/tasks/assignments/${testId}/paper`, {
                    title,
                    description: description || null,
                    isRandomized,
                    answerSpace,
                    sections,
                    questions: questionPayload,
                });
                if (activate) {
                    await api.patch(`/teacher/tasks/assignments/${testId}`, { status: 'ACTIVE' });
                }
            } else {
                await api.put(`/teacher/tasks/tests/${testId}/paper`, {
                    title,
                    description: description || null,
                    paperType,
                    durationMinutes,
                    maxAttempts,
                    validUntil: validUntil ? new Date(validUntil).toISOString() : null,
                    isRandomized,
                    answerSpace,
                    sections: paperType === 'TEST' ? sections : [],
                    questions: questionPayload,
                });
                if (activate) {
                    await api.patch(`/teacher/tasks/tests/${testId}`, { status: 'ACTIVE' });
                }
            }
            toast.success(activate ? 'Paper saved and activated' : 'Paper saved');
            onSaved();
        } catch (err) { toast.error(apiError(err)); } finally { setSaving(false); }
    };

    const addedIds = new Set(builderQs.map(q => q.questionId));
    const totalMarks = paperType === 'TEST'
        ? sections.reduce((sum, s) => {
            const sQs = builderQs.filter(q => q.sectionId === s.id).length;
            const attemptN = s.attemptCount > 0 ? Math.min(s.attemptCount, sQs) : sQs;
            return sum + attemptN * s.marksPerQuestion;
          }, 0) + builderQs.filter(q => !q.sectionId).reduce((sum, q) => sum + q.marks, 0)
        : builderQs.reduce((sum, q) => sum + q.marks, 0);

    const containerStyle = isFullscreen
        ? { position: 'fixed' as const, top: mainTop, left: 0, right: 0, bottom: 0, zIndex: 60 }
        : { position: 'absolute' as const, inset: 0, zIndex: 50 };

    if (loading) return (
        <div style={containerStyle} className="bg-background flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
    );

    // Paper color theme
    const theme = lockedPaperType === 'TEST' ? {
        outerBg:   '#C8BFB3', scrollbar: '#A89880 #C8BFB3',
        paperBg:   '#FEFCF8', paperBorder: '#D8C4A0',
        topBar1:   '#2A1F10', topBar2: '#8B6914',
        headingColor: '#8B7355', titleColor: '#1A1208',
        metaColor: '#4A3728', accentColor: '#8B6914',
        sectionActiveBg: '#EDE4D6', sectionBg: '#F5EFE6', sectionBorder: '#8B6914', sectionBorderInactive: '#D8C4A0',
        sectionText: '#2A1F10', sectionMeta: '#8B7355',
        inputBg: '#FAF5EE', inputBorder: '#D8C4A0', inputText: '#2A1F10',
        rowBorder: '#EDE4D6', marksBadgeBg: '#EDE4D6', marksBadgeText: '#6B5B45', marksBadgeBorder: '#D8C4A0',
        emptyBorder: '#D8C4A0', emptyText: '#C4A882', emptyActiveText: '#8B7355',
        footerBg: '#FAF5EE', footerText: '#8B7355',
        addSectionBorder: '#D8C4A0', addSectionText: '#8B7355', addSectionHoverBorder: '#8B6914', addSectionHoverText: '#8B6914',
    } : {
        outerBg:   '#B8C8D8', scrollbar: '#8AAAC8 #B8C8D8',
        paperBg:   '#F8FBFF', paperBorder: '#A8C0DC',
        topBar1:   '#1A2F4A', topBar2: '#2563EB',
        headingColor: '#4A7AAA', titleColor: '#0D1B2A',
        metaColor: '#1E3A5F', accentColor: '#2563EB',
        sectionActiveBg: '#DDEAFB', sectionBg: '#EEF4FD', sectionBorder: '#2563EB', sectionBorderInactive: '#A8C0DC',
        sectionText: '#0D1B2A', sectionMeta: '#4A7AAA',
        inputBg: '#F0F6FE', inputBorder: '#A8C0DC', inputText: '#0D1B2A',
        rowBorder: '#DDEAFB', marksBadgeBg: '#DDEAFB', marksBadgeText: '#1E3A5F', marksBadgeBorder: '#A8C0DC',
        emptyBorder: '#A8C0DC', emptyText: '#7AAAC8', emptyActiveText: '#2563EB',
        footerBg: '#F0F6FE', footerText: '#4A7AAA',
        addSectionBorder: '#A8C0DC', addSectionText: '#4A7AAA', addSectionHoverBorder: '#2563EB', addSectionHoverText: '#2563EB',
    };

    // Global question counter across sections
    let qCounter = 0;

    return (
        <div style={containerStyle} className="bg-background flex flex-col">
            {/* Header */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border">
                <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all">
                    ← Back
                </button>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Paper title…"
                    className="flex-1 text-base font-semibold bg-transparent focus:outline-none border-b border-transparent focus:border-border/60 pb-0.5 transition-all" />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                    {lockedPaperType === 'TEST' ? <ClipboardList size={13} /> : <ClipboardCheck size={13} />}
                    {lockedPaperType === 'TEST' ? 'Test' : 'Assignment'}
                </div>
                <button onClick={() => savePaper(false)} disabled={saving}
                    className="text-sm px-4 py-1.5 rounded-lg border border-border hover:bg-muted transition-all disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save Draft'}
                </button>
                <button onClick={() => savePaper(true)} disabled={saving || builderQs.length === 0}
                    className="text-sm font-medium px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                    Save & Activate
                </button>
                <button onClick={() => setIsFullscreen(v => !v)}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted transition-all text-muted-foreground hover:text-foreground"
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                    {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left panel — Modules */}
                <div className="w-[38%] border-r border-border flex flex-col overflow-hidden">
                    <div className="shrink-0 px-4 py-3 border-b border-border/50">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Modules</p>
                    </div>
                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                        {modules.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-8">No modules yet. Create modules and assign questions first.</p>
                        ) : modules.map(mod => {
                            const isExpanded = expandedModuleId === mod.id;
                            return (
                                <div key={mod.id} className="rounded-lg border border-border/60 overflow-hidden">
                                    <button
                                        onClick={() => setExpandedModuleId(isExpanded ? null : mod.id)}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-all text-left">
                                        <BookMarked size={13} className="text-primary/70 shrink-0" />
                                        <span className="flex-1 text-xs font-semibold truncate">{mod.name}</span>
                                        <span className="text-[10px] text-muted-foreground shrink-0">{mod.questions.length}q</span>
                                        {isExpanded ? <ChevronUp size={12} className="text-muted-foreground shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t border-border/40 bg-muted/20">
                                            {mod.questions.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground px-4 py-3">No questions in this module.</p>
                                            ) : mod.questions.map(mq => {
                                                const q = mq.question;
                                                const alreadyAdded = addedIds.has(q.id);
                                                return (
                                                    <div key={mq.id}
                                                        onClick={() => {
                                                            if (alreadyAdded) { toast.info('Already in paper'); return; }
                                                            addQuestionToBuilder(q as unknown as Question);
                                                        }}
                                                        className={`flex items-start gap-2 px-3 py-2 border-b border-border/30 last:border-0 transition-all group ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/50 cursor-pointer'}`}>
                                                        <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${TYPE_META[q.type]?.color}`}>{TYPE_META[q.type]?.label}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-xs leading-snug line-clamp-2">{q.question}</span>
                                                            {q.type === 'MCQ' && Array.isArray(q.options) && q.options.length > 0 && (
                                                                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0">
                                                                    {q.options.map((opt, oi) => (
                                                                        <span key={oi} className="text-[10px] text-muted-foreground truncate">{String.fromCharCode(65 + oi)}) {opt}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {!alreadyAdded && <Plus size={11} className="text-primary shrink-0 opacity-0 group-hover:opacity-100 mt-0.5 transition-all" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right panel — Paper document */}
                <div className="flex-1 flex flex-col overflow-hidden">
                {/* Metadata bar */}
                <div className="shrink-0 px-4 py-2.5 border-b border-border/50 flex items-center gap-4 flex-wrap text-sm">
                    {entityType === 'test' && (
                        <>
                            <div className="flex items-center gap-1.5">
                                <label className="text-[11px] text-muted-foreground">Duration</label>
                                <input type="number" min={5} max={600} value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}
                                    className="w-14 text-xs text-center rounded-md border border-border bg-background px-2 py-1 focus:outline-none" />
                                <span className="text-[11px] text-muted-foreground">min</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <label className="text-[11px] text-muted-foreground">Attempts</label>
                                <input type="number" min={1} max={10} value={maxAttempts} onChange={e => setMaxAttempts(Number(e.target.value))}
                                    className="w-10 text-xs text-center rounded-md border border-border bg-background px-2 py-1 focus:outline-none" />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <label className="text-[11px] text-muted-foreground">Valid until</label>
                                <input type="datetime-local" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                                    className="text-xs rounded-md border border-border bg-background px-2 py-1 focus:outline-none" />
                            </div>
                        </>
                    )}
                    <div className="ml-auto flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                            <div onClick={() => setAnswerSpace(v => !v)}
                                className={`relative w-8 h-4 rounded-full cursor-pointer transition-colors ${answerSpace ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${answerSpace ? 'translate-x-4' : ''}`} />
                            </div>
                            <span className="text-muted-foreground">Answer Space</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                            <div onClick={() => setIsRandomized(v => !v)}
                                className={`relative w-8 h-4 rounded-full cursor-pointer transition-colors ${isRandomized ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isRandomized ? 'translate-x-4' : ''}`} />
                            </div>
                            <Shuffle size={12} className="text-muted-foreground" />
                            <span className="text-muted-foreground">Randomize</span>
                        </label>
                        <span className="text-xs text-muted-foreground border-l border-border pl-3">
                            {builderQs.length} Q · {totalMarks} marks
                        </span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto py-8 px-6" style={{ background: theme.outerBg, scrollbarWidth: 'thin', scrollbarColor: theme.scrollbar }}>

                    {/* ── The actual paper ── */}
                    <div className="max-w-3xl mx-auto shadow-2xl" style={{
                        background: theme.paperBg,
                        border: `1px solid ${theme.paperBorder}`,
                        boxShadow: '0 8px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                    }}>

                        {/* Paper top decorative border */}
                        <div style={{ height: 6, background: theme.topBar1 }} />
                        <div style={{ height: 2, background: theme.topBar2, marginTop: 3 }} />

                        {/* Paper header */}
                        <div className="px-10 pt-6 pb-4" style={{ borderBottom: `1.5px solid ${theme.paperBorder}` }}>
                            <div className="text-center mb-4">
                                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Paper Title"
                                    className="text-center text-xl font-bold w-full focus:outline-none bg-transparent"
                                    style={{ color: theme.titleColor, borderBottom: `1px dashed ${theme.paperBorder}`, paddingBottom: 2 }} />
                                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description / instructions for students (optional)"
                                    rows={2} className="w-full text-center text-xs mt-2 resize-none focus:outline-none bg-transparent"
                                    style={{ color: theme.sectionMeta, borderBottom: `1px dashed ${theme.rowBorder}` }} />
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-3" style={{ color: theme.metaColor }}>
                                <div className="flex items-center gap-6">
                                    <span><span className="font-semibold">Time:</span> {durationMinutes} min</span>
                                    <span><span className="font-semibold">Max Attempts:</span> {maxAttempts}</span>
                                    {validUntil && <span><span className="font-semibold">Valid Until:</span> {new Date(validUntil).toLocaleDateString()}</span>}
                                </div>
                                <div className="flex items-center gap-4">
                                    <span><span className="font-semibold">Total Questions:</span> {builderQs.length}</span>
                                    <span className="font-bold text-sm" style={{ color: theme.accentColor }}>Total Marks: {totalMarks}</span>
                                </div>
                            </div>
                            {isRandomized && (
                                <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: theme.headingColor }}>
                                    <Shuffle size={10} /> Questions will be shuffled for each student
                                </div>
                            )}
                        </div>

                        {/* Paper body — sections or flat questions */}
                        <div className="px-10 py-4">
                            {paperType === 'TEST' ? (
                                <div className="space-y-6">
                                    {sections.map((section) => {
                                        const sectionQs = builderQs.filter(q => q.sectionId === section.id);
                                        const isActive = activeSectionId === section.id;
                                        const effectiveAttempt = section.attemptCount > 0 ? Math.min(section.attemptCount, sectionQs.length) : sectionQs.length;
                                        const sectionTotal = effectiveAttempt * section.marksPerQuestion;
                                        return (
                                            <div key={section.id}>
                                                {/* Section header */}
                                                <div className="flex items-center gap-3 px-3 py-2 cursor-pointer -mx-3 mb-3 group transition-all"
                                                    style={{ background: isActive ? theme.sectionActiveBg : theme.sectionBg, borderLeft: `3px solid ${isActive ? theme.sectionBorder : theme.sectionBorderInactive}`, borderBottom: `1px solid ${theme.paperBorder}` }}
                                                    onClick={() => setActiveSectionId(section.id)}>
                                                    <div className="flex-1 flex items-center gap-3">
                                                        <input value={section.title} onClick={e => e.stopPropagation()}
                                                            onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
                                                            className="text-sm font-bold uppercase tracking-wider bg-transparent focus:outline-none"
                                                            style={{ color: theme.sectionText }} />
                                                        {sectionQs.length > 0 && (
                                                            <span className="text-[10px]" style={{ color: theme.sectionMeta }}>
                                                                ({effectiveAttempt}/{sectionQs.length} × {section.marksPerQuestion}m = {sectionTotal} marks)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                                        <span className="text-[10px]" style={{ color: theme.sectionMeta }}>Attempt</span>
                                                        <input type="number" min={0} max={sectionQs.length || 99}
                                                            value={section.attemptCount === 0 ? '' : section.attemptCount}
                                                            placeholder="all"
                                                            onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, attemptCount: Number(e.target.value) || 0 } : s))}
                                                            className="w-10 text-xs text-center rounded focus:outline-none"
                                                            style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.inputBorder}`, padding: '1px 4px' }} />
                                                        <span className="text-[10px]" style={{ color: theme.sectionMeta }}>·</span>
                                                        <input type="number" min={0} max={100} value={section.marksPerQuestion}
                                                            onChange={e => {
                                                                const mpq = Number(e.target.value);
                                                                setSections(prev => prev.map(s => s.id === section.id ? { ...s, marksPerQuestion: mpq } : s));
                                                                setBuilderQs(prev => prev.map(q => q.sectionId === section.id ? { ...q, marks: mpq } : q));
                                                            }}
                                                            className="w-10 text-xs text-center rounded focus:outline-none"
                                                            style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.inputBorder}`, padding: '1px 4px' }} />
                                                        <span className="text-[10px]" style={{ color: theme.sectionMeta }}>m each</span>
                                                        {sections.length > 1 && (
                                                            <button onClick={() => removeSection(section.id)}
                                                                className="opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded"
                                                                style={{ color: '#C05050' }}>
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                        {isActive && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                                                style={{ background: theme.accentColor, color: theme.inputBg }}>ACTIVE</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Section instruction */}
                                                <input value={section.instruction}
                                                    onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, instruction: e.target.value } : s))}
                                                    placeholder="Section instruction (e.g. Answer any five of the following)"
                                                    className="w-full text-xs italic mb-3 focus:outline-none bg-transparent"
                                                    style={{ color: theme.sectionMeta, borderBottom: '1px dashed transparent', paddingBottom: 2 }}
                                                    onFocus={e => e.currentTarget.style.borderBottomColor = theme.paperBorder}
                                                    onBlur={e => e.currentTarget.style.borderBottomColor = 'transparent'} />

                                                {/* Questions */}
                                                {sectionQs.length === 0 ? (
                                                    <div className="py-4 text-center rounded" style={{ border: `1.5px dashed ${theme.emptyBorder}`, color: isActive ? theme.emptyActiveText : theme.emptyText }}>
                                                        <p className="text-xs">{isActive ? '← Click a question from the bank to add it here' : 'Click section header to activate, then add questions'}</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-0">
                                                        {sectionQs.map((bq, qi) => {
                                                            qCounter++;
                                                            const num = qCounter;
                                                            return (
                                                                <div key={bq.questionId} className="flex items-start gap-3 py-2.5 group transition-all"
                                                                    style={{ borderBottom: `0.5px solid ${theme.rowBorder}` }}>
                                                                    <div className="flex flex-col gap-0 pt-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                                        <button onClick={() => moveQuestion(bq.questionId, 'up', section.id)} disabled={qi === 0}
                                                                            className="disabled:opacity-20 p-0.5" style={{ color: theme.sectionMeta }}><ArrowUp size={9} /></button>
                                                                        <button onClick={() => moveQuestion(bq.questionId, 'down', section.id)} disabled={qi === sectionQs.length - 1}
                                                                            className="disabled:opacity-20 p-0.5" style={{ color: theme.sectionMeta }}><ArrowDown size={9} /></button>
                                                                    </div>
                                                                    <span className="text-xs font-bold shrink-0 mt-0.5 w-5 text-right" style={{ color: theme.accentColor }}>Q{num}.</span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-[13px] leading-relaxed" style={{ color: theme.titleColor }}>{bq.question.question}</span>
                                                                        {(bq.question.type === 'MCQ' || bq.question.type === 'CONCEPTUAL') && (() => {
                                                                            const opts = bq.question.type === 'MCQ'
                                                                                ? (bq.question.options ?? [])
                                                                                : (() => { const d = bq.question.details as ConceptualDetails | null; return d ? [d.correct_answer, ...d.distractors] : []; })();
                                                                            return opts.length > 0 ? (
                                                                                <div className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-0.5 pl-1">
                                                                                    {opts.map((opt, oi) => (
                                                                                        <span key={oi} className="text-[11px]" style={{ color: theme.metaColor }}>{String.fromCharCode(65 + oi)}) {opt}</span>
                                                                                    ))}
                                                                                </div>
                                                                            ) : null;
                                                                        })()}
                                                                        {bq.question.type === 'TRUE_FALSE' && (
                                                                            <div className="mt-1.5 flex gap-8 pl-1">
                                                                                <span className="text-[11px]" style={{ color: theme.metaColor }}>A) True</span>
                                                                                <span className="text-[11px]" style={{ color: theme.metaColor }}>B) False</span>
                                                                            </div>
                                                                        )}
                                                                        {answerSpace && (bq.question.type === 'FILL_BLANK' || bq.question.type === 'NUMERICAL') && (
                                                                            <div className="mt-2 pl-1" style={{ borderBottom: `1px solid ${theme.metaColor}`, opacity: 0.3, width: '60%' }} />
                                                                        )}
                                                                        {answerSpace && bq.question.type === 'SHORT_ANSWER' && (
                                                                            <div className="mt-2 pl-1 space-y-2.5">
                                                                                {[0, 1, 2].map(i => <div key={i} style={{ borderBottom: `1px solid ${theme.metaColor}`, opacity: 0.22, width: '100%' }} />)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <div className="opacity-0 group-hover:opacity-100 transition-all">
                                                                            <button onClick={() => removeQuestion(bq.questionId)} className="p-0.5 rounded transition-all" style={{ color: '#C05050' }}><X size={12} /></button>
                                                                        </div>
                                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                                                                            style={{ background: theme.marksBadgeBg, color: theme.marksBadgeText, border: `0.5px solid ${theme.marksBadgeBorder}` }}>
                                                                            [{section.marksPerQuestion}m]
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Add section */}
                                    <button onClick={addSection}
                                        className="w-full py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                                        style={{ border: `1.5px dashed ${theme.addSectionBorder}`, color: theme.addSectionText, borderRadius: 4, background: 'transparent' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = theme.addSectionHoverBorder; e.currentTarget.style.color = theme.addSectionHoverText; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = theme.addSectionBorder; e.currentTarget.style.color = theme.addSectionText; }}>
                                        <Plus size={13} /> Add Section
                                    </button>
                                </div>
                            ) : (
                                /* Assignment — flat list */
                                <div>
                                    <div className="flex items-center justify-between mb-4" style={{ borderBottom: `1px solid ${theme.paperBorder}`, paddingBottom: 8 }}>
                                        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: theme.titleColor }}>Questions</span>
                                        <span className="text-xs" style={{ color: theme.headingColor }}>{builderQs.length} questions · {totalMarks} marks</span>
                                    </div>
                                    {builderQs.length === 0 ? (
                                        <div className="py-8 text-center rounded" style={{ border: `1.5px dashed ${theme.emptyBorder}`, color: theme.emptyText }}>
                                            <p className="text-xs">← Click a question from the modules to add it here</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0">
                                            {builderQs.map((bq, qi) => (
                                                <div key={bq.questionId} className="flex items-start gap-3 py-2.5 group transition-all"
                                                    style={{ borderBottom: `0.5px solid ${theme.rowBorder}` }}>
                                                    <div className="flex flex-col gap-0 pt-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                        <button onClick={() => moveQuestion(bq.questionId, 'up', null)} disabled={qi === 0}
                                                            className="disabled:opacity-20 p-0.5" style={{ color: theme.sectionMeta }}><ArrowUp size={9} /></button>
                                                        <button onClick={() => moveQuestion(bq.questionId, 'down', null)} disabled={qi === builderQs.length - 1}
                                                            className="disabled:opacity-20 p-0.5" style={{ color: theme.sectionMeta }}><ArrowDown size={9} /></button>
                                                    </div>
                                                    <span className="text-xs font-bold shrink-0 mt-0.5 w-5 text-right" style={{ color: theme.accentColor }}>Q{qi + 1}.</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start gap-1.5">
                                                            <span className="flex-1 text-[13px] leading-relaxed" style={{ color: theme.titleColor }}>{bq.question.question}</span>
                                                            {!bq.isCompulsory && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E', border: '0.5px solid #F59E0B' }}>Optional</span>}
                                                        </div>
                                                        {(bq.question.type === 'MCQ' || bq.question.type === 'CONCEPTUAL') && (() => {
                                                            const opts = bq.question.type === 'MCQ'
                                                                ? (bq.question.options ?? [])
                                                                : (() => { const d = bq.question.details as ConceptualDetails | null; return d ? [d.correct_answer, ...d.distractors] : []; })();
                                                            return opts.length > 0 ? (
                                                                <div className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-0.5 pl-1">
                                                                    {opts.map((opt, oi) => (
                                                                        <span key={oi} className="text-[11px]" style={{ color: theme.metaColor }}>{String.fromCharCode(65 + oi)}) {opt}</span>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                        {bq.question.type === 'TRUE_FALSE' && (
                                                            <div className="mt-1.5 flex gap-8 pl-1">
                                                                <span className="text-[11px]" style={{ color: theme.metaColor }}>A) True</span>
                                                                <span className="text-[11px]" style={{ color: theme.metaColor }}>B) False</span>
                                                            </div>
                                                        )}
                                                        {answerSpace && (bq.question.type === 'FILL_BLANK' || bq.question.type === 'NUMERICAL') && (
                                                            <div className="mt-2 pl-1" style={{ borderBottom: `1px solid ${theme.metaColor}`, opacity: 0.3, width: '60%' }} />
                                                        )}
                                                        {answerSpace && bq.question.type === 'SHORT_ANSWER' && (
                                                            <div className="mt-2 pl-1 space-y-2.5">
                                                                {[0, 1, 2].map(i => <div key={i} style={{ borderBottom: `1px solid ${theme.metaColor}`, opacity: 0.22, width: '100%' }} />)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                            <button onClick={() => setBuilderQs(prev => prev.map(q => q.questionId === bq.questionId ? { ...q, isCompulsory: !q.isCompulsory } : q))}
                                                                title={bq.isCompulsory ? 'Mark as optional' : 'Mark as compulsory'}
                                                                className="text-[9px] font-bold px-1.5 py-0.5 rounded transition-all"
                                                                style={{ background: bq.isCompulsory ? theme.marksBadgeBg : '#FEF3C7', color: bq.isCompulsory ? theme.marksBadgeText : '#92400E', border: `0.5px solid ${bq.isCompulsory ? theme.marksBadgeBorder : '#F59E0B'}` }}>
                                                                {bq.isCompulsory ? 'C' : 'O'}
                                                            </button>
                                                            <input type="number" min={0} value={bq.marks}
                                                                onChange={e => setBuilderQs(prev => prev.map(q => q.questionId === bq.questionId ? { ...q, marks: Number(e.target.value) } : q))}
                                                                className="w-9 text-xs text-center rounded focus:outline-none"
                                                                style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.inputBorder}`, padding: '1px 2px' }} />
                                                            <button onClick={() => removeQuestion(bq.questionId)} className="p-0.5" style={{ color: '#C05050' }}><X size={12} /></button>
                                                        </div>
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                                                            style={{ background: theme.marksBadgeBg, color: theme.marksBadgeText, border: `0.5px solid ${theme.marksBadgeBorder}` }}>
                                                            [{bq.marks}m]
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Paper footer */}
                        <div className="px-10 py-4 flex items-center justify-between" style={{ borderTop: `1px solid ${theme.paperBorder}`, background: theme.footerBg }}>
                            <span className="text-[10px] italic" style={{ color: theme.footerText }}>— End of {paperType === 'TEST' ? 'Exam Paper' : 'Assignment'} —</span>
                            <span className="text-[10px]" style={{ color: theme.footerText }}>Total: {totalMarks} marks</span>
                        </div>

                        {/* Paper bottom decorative border */}
                        <div style={{ height: 2, background: theme.topBar2 }} />
                        <div style={{ height: 6, background: theme.topBar1, marginTop: 3 }} />
                    </div>

                </div>
                </div>
            </div>
        </div>
    );
}
