'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, X, Plus, Trash2, Download,
    Loader2, BookOpen, Layers, Check, X as XIcon,
    Clock, Link2, Play, Eye, ChevronDown, ChevronUp,
    FlaskConical, Brain, Users, Copy, CheckCircle2, AlertCircle,
    Shuffle, ArrowUp, ArrowDown, ArrowRight, Search, BookMarked, ArrowLeft, PackageOpen, ClipboardList, ClipboardCheck, BarChart2, Maximize2, Minimize2, GripVertical, Pencil, ArrowDownToLine, Share2, ShieldAlert, Save, ZoomIn, ZoomOut, Square, Trophy, TrendingDown,
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
    images: string[] | null;
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
        images: string[] | null;
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

// Flow blocks used to auto-paginate the paper builder (TEST and ASSIGNMENT) into A4-sized pages.
type FlowBlock =
    | { key: string; kind: 'header' }
    | { key: string; kind: 'spacer'; height: number }
    | { key: string; kind: 'sectionHeader'; section: PaperSection }
    | { key: string; kind: 'sectionEmpty'; section: PaperSection }
    | { key: string; kind: 'question'; section: PaperSection; bq: BuilderQuestion; num: number }
    | { key: string; kind: 'assignmentQuestionsHeader' }
    | { key: string; kind: 'assignmentEmpty' }
    | { key: string; kind: 'assignmentQuestion'; bq: BuilderQuestion; num: number }
    | { key: string; kind: 'footer' };

interface TestBase {
    id: string;
    title: string;
    description: string | null;
    subject?: { name: string };
    testLink: string;
    status: TestStatus;
    durationMinutes: number;
    totalMarks: number;
    numberOfQuestions: number;
    maxAttempts: number;
    startDate: string | null;
    validUntil: string | null;
    dueDate?: string | null; // assignments only — the builder's "due date" (replaces the test-only Duration/Time concept)
    submissionType?: 'OFFLINE' | 'ONLINE'; // assignments only
    paperType: string;
    isRandomized: boolean;
    answerSpace: boolean;
    sections: PaperSection[] | null;
    createdAt?: string;
    _count: { attempts: number; submitted?: number };
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
    MCQ:          { label: 'MCQ',        color: 'bg-[var(--muted)] text-[var(--primary)]',   section: 'Section A' },
    CONCEPTUAL:   { label: 'MCQ',         color: 'bg-[var(--muted)] text-[var(--primary)]',   section: 'Section A' },
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
    completedAt?: string | null;
    submissionType: 'OFFLINE' | 'ONLINE';
    createdAt?: string;
    _count: { submissions: number; totalStudents?: number };
}

// ── Component ─────────────────────────────────────────────────────────────────

export type TasksSubTab = 'questions' | 'tests' | 'assignments' | 'modules';

interface TasksTabProps { divisionId: string; subjectId: string | null; subTab: TasksSubTab; onSubTabChange: (tab: TasksSubTab) => void; onStatsChange?: (stats: { tests: number; assignments: number }) => void; onBuilderCloseChange?: (closeFn: (() => void) | null) => void; }


export default function TasksTab({ divisionId, subjectId, subTab, onSubTabChange: _onSubTabChange, onStatsChange, onBuilderCloseChange }: TasksTabProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

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
    const [newTest, setNewTest] = useState({ title: '', description: '', durationMinutes: 30, totalMarks: 0, numberOfQuestions: 10, maxAttempts: 1, startDate: '', validUntil: '' });
    // Free-typing buffers for the numeric fields below — same fix as the paper builder's
    // duration box: lets each box go fully empty while editing instead of snapping to a
    // stuck "0" that turns "45" into "045".
    const [newTestDraft, setNewTestDraft] = useState<Record<string, string | null>>({});
    const [savingTest, setSavingTest] = useState(false);
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [resultsTestId, setResultsTestId] = useState<string | null>(null);
    const [submissionsAssignmentId, setSubmissionsAssignmentId] = useState<string | null>(null);
    // Test and assignment builders are tracked independently — opening one must not clobber
    // the other's open state, so switching Tests -> Assignments -> Tests leaves the original
    // test's builder exactly as it was instead of losing it.
    // Which paper is open is also mirrored into the URL (?testId=/?assignmentId=) — otherwise
    // refreshing while inside a paper would drop straight back to the list, same class of bug
    // as the tab/subtab reset.
    const initialTestId = searchParams.get('testId');
    const initialAssignmentId = searchParams.get('assignmentId');
    const [testBuilderOpen, setTestBuilderOpen] = useState(!!initialTestId);
    const [testBuilderId, setTestBuilderId] = useState<string | null>(initialTestId);
    const [assignmentBuilderOpen, setAssignmentBuilderOpen] = useState(!!initialAssignmentId);
    const [assignmentBuilderId, setAssignmentBuilderId] = useState<string | null>(initialAssignmentId);

    const setUrlParam = useCallback((key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(key, value); else params.delete(key);
        router.replace(`?${params.toString()}`, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);
    const openTestBuilder = useCallback((id: string) => { setTestBuilderId(id); setTestBuilderOpen(true); setUrlParam('testId', id); }, [setUrlParam]);
    const closeTestBuilder = useCallback(() => { setTestBuilderOpen(false); setTestBuilderId(null); setUrlParam('testId', null); }, [setUrlParam]);
    const openAssignmentBuilder = useCallback((id: string) => { setAssignmentBuilderId(id); setAssignmentBuilderOpen(true); setUrlParam('assignmentId', id); }, [setUrlParam]);
    const closeAssignmentBuilder = useCallback(() => { setAssignmentBuilderOpen(false); setAssignmentBuilderId(null); setUrlParam('assignmentId', null); }, [setUrlParam]);

    // Each builder overlay is only actually shown while its own subtab (Tests for a test
    // paper, Assignments for an assignment paper) is the active one — switching to another
    // nav tab (Modules, AI Questions, etc.) while one is open must reveal that tab's content,
    // not hide it behind the still-open overlay. The open/id state itself is untouched though,
    // so navigating back to the matching subtab brings the same paper back up.
    const testBuilderVisible = testBuilderOpen && !!testBuilderId && subTab === 'tests';
    const assignmentBuilderVisible = assignmentBuilderOpen && !!assignmentBuilderId && subTab === 'assignments';

    // ── Let the parent (class page) know how to close whichever builder overlay is
    // currently visible, so its own top-level back button steps back into the matching
    // list instead of navigating away from the class entirely. Only wired up while an
    // overlay is actually visible — otherwise the back button should behave normally. ──
    useEffect(() => {
        const closeFn = testBuilderVisible
            ? () => { closeTestBuilder(); fetchTests(); }
            : assignmentBuilderVisible
                ? () => { closeAssignmentBuilder(); fetchAssignments(); }
                : null;
        onBuilderCloseChange?.(closeFn);
        return () => { onBuilderCloseChange?.(null); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [testBuilderVisible, assignmentBuilderVisible]);

    // ── Assignments ───────────────────────────────────────────────────────────
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [aLoading, setALoading] = useState(false);
    const [createAssignmentOpen, setCreateAssignmentOpen] = useState(false);
    const [newAssignment, setNewAssignment] = useState({ title: '', description: '', totalMarks: 10, dueDate: '', submissionType: 'OFFLINE' as 'OFFLINE' | 'ONLINE' });
    // Same free-typing-buffer fix as the paper builder's marks/duration boxes.
    const [newAssignmentMarksDraft, setNewAssignmentMarksDraft] = useState<string | null>(null);
    const [savingAssignment, setSavingAssignment] = useState(false);

    // ── Report stats to parent ────────────────────────────────────────────────
    const onStatsChangeRef = useRef(onStatsChange);
    useEffect(() => { onStatsChangeRef.current = onStatsChange; });
    useEffect(() => {
        onStatsChangeRef.current?.({
            tests: tests.filter(t => t.status === 'ACTIVE').length,
            assignments: assignments.filter(a => a.status === 'ACTIVE').length,
        });
    }, [tests, assignments]);

    // ── Modules ───────────────────────────────────────────────────────────────
    const [modules, setModules] = useState<TaskModule[]>([]);
    const [mLoading, setMLoading] = useState(false);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [expandedMQIds, setExpandedMQIds] = useState<Set<string>>(new Set());
    const [editingMQId, setEditingMQId] = useState<string | null>(null);
    const [editMQText, setEditMQText] = useState('');
    const [editMQAnswer, setEditMQAnswer] = useState('');
    const [editMQOptions, setEditMQOptions] = useState<string[]>(['', '', '', '']);
    const [editMQCorrectIdx, setEditMQCorrectIdx] = useState(0);
    const [dragMQId, setDragMQId] = useState<string | null>(null);
    const [dragOverMQId, setDragOverMQId] = useState<string | null>(null);
    const [creatingModule, setCreatingModule] = useState(false);
    const [newModName, setNewModName] = useState('');
    const [newModDesc, setNewModDesc] = useState('');
    const [savingModule, setSavingModule] = useState(false);
    const [dragModuleId, setDragModuleId] = useState<string | null>(null);
    const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
    const [deleteModuleConfirmId, setDeleteModuleConfirmId] = useState<string | null>(null);
    const [removeMQConfirm, setRemoveMQConfirm] = useState<{ moduleId: string; questionId: string; questionText: string } | null>(null);
    const [removeImageConfirm, setRemoveImageConfirm] = useState<{ moduleId: string; questionId: string; url: string } | null>(null);
    // Full-screen preview when a question image is clicked — same treatment
    // as the profile photo zoom in Topbar.tsx's AvatarMenu.
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
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
    // Images picked while building a custom question — held in memory and
    // only actually uploaded once the question itself is created (it needs a
    // real questionId to attach to). Cleared on save/cancel.
    const [customQImages, setCustomQImages] = useState<File[]>([]);
    // Tracks which question (by id) currently has an image add/remove
    // in flight, so its own control can show a spinner without needing a
    // per-row boolean map.
    const [uploadingImagesFor, setUploadingImagesFor] = useState<string | null>(null);

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
            const res = await api.get(`/teacher/tasks/tests?divisionId=${divisionId}${subjectId ? `&subjectId=${subjectId}` : ''}`);
            setTests(res.data.data);
        } catch {
            setTests([]);
        } finally {
            setTLoading(false);
        }
    }, [divisionId, subjectId]);

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

    // Pressing the browser/device back button to leave the paper builder can land the
    // teacher back on this page via the browser's bfcache or Next's router cache —
    // neither of which re-runs the mount effects above, so the test/assignment cards
    // would otherwise keep showing whatever was on screen before the edit. `pageshow`
    // fires every time the page becomes visible again (fresh load AND cache restores),
    // so re-fetching there guarantees the cards are never stale after a back-navigation.
    useEffect(() => {
        const onPageShow = () => {
            fetchTests();
            fetchAssignments();
            fetchModules();
        };
        window.addEventListener('pageshow', onPageShow);
        return () => window.removeEventListener('pageshow', onPageShow);
    }, [fetchTests, fetchAssignments, fetchModules]);

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
            setModules(prev => prev.map(m => ({
                ...m,
                questions: m.questions.map(mq => mq.questionId === id ? { ...mq, question: { ...mq.question, ...res.data.data } } : mq),
            })));
            toast.success('Question updated');
        } catch (err) { toast.error(apiError(err)); }
    };

    const startEditMQ = (mq: ModuleQuestion) => {
        const q = mq.question;
        const isMcq = q.type === 'MCQ' || q.type === 'CONCEPTUAL';
        let opts: string[] = ['', '', '', ''];
        let correctIdx = 0;
        if (isMcq) {
            if (q.type === 'MCQ') {
                opts = q.options ?? ['', '', '', ''];
                correctIdx = Math.max(0, opts.indexOf(q.answer));
            } else {
                const cd = q.details as ConceptualDetails | null;
                opts = cd ? [cd.correct_answer, ...(cd.distractors ?? ['', '', ''])].slice(0, 4) : ['', '', '', ''];
                correctIdx = 0;
            }
        }
        setEditMQText(q.question);
        setEditMQAnswer(q.answer);
        setEditMQOptions(opts);
        setEditMQCorrectIdx(correctIdx);
        setEditingMQId(mq.id);
    };

    const saveEditMQ = (mq: ModuleQuestion) => {
        const isMcq = mq.question.type === 'MCQ' || mq.question.type === 'CONCEPTUAL';
        handleEditQuestion(mq.questionId, editMQText, editMQAnswer, isMcq ? editMQOptions : undefined);
        setEditingMQId(null);
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
                submissionType: newAssignment.submissionType,
            };
            if (newAssignment.dueDate) payload.dueDate = new Date(newAssignment.dueDate).toISOString();
            const res = await api.post('/teacher/tasks/assignments', payload);
            setAssignments(prev => [res.data.data, ...prev]);
            toast.success('Assignment created');
            setCreateAssignmentOpen(false);
            setNewAssignment({ title: '', description: '', totalMarks: 10, dueDate: '', submissionType: 'OFFLINE' });
        } catch (err) { toast.error(apiError(err)); }
        finally { setSavingAssignment(false); }
    };

    const handleCreateTest = async () => {
        if (!newTest.title.trim()) return toast.error('Test title is required');
        if (newTest.startDate && newTest.validUntil && new Date(newTest.validUntil) <= new Date(newTest.startDate)) {
            return toast.error('Valid Until must be after the Start Date');
        }
        setSavingTest(true);
        try {
            const payload: Record<string, unknown> = {
                divisionId, subjectId: subjectId ?? undefined, title: newTest.title, description: newTest.description || undefined,
                durationMinutes: newTest.durationMinutes, totalMarks: newTest.totalMarks,
                numberOfQuestions: newTest.numberOfQuestions, maxAttempts: newTest.maxAttempts,
            };
            if (newTest.startDate) payload.startDate = new Date(newTest.startDate).toISOString();
            if (newTest.validUntil) payload.validUntil = new Date(newTest.validUntil).toISOString();
            const res = await api.post('/teacher/tasks/tests', payload);
            const created: Test = res.data.data;
            setTests(prev => [created, ...prev]);
            toast.success('Test created — opening Paper Builder');
            setCreateTestOpen(false);
            setNewTest({ title: '', description: '', durationMinutes: 30, totalMarks: 0, numberOfQuestions: 10, maxAttempts: 1, startDate: '', validUntil: '' });
            openTestBuilder(created.id);
        } catch (err) { toast.error(apiError(err)); } finally { setSavingTest(false); }
    };

    // `startNow` only matters when activating: true locks Start Date to right now (test
    // goes live immediately); false leaves whatever Start Date is already set untouched,
    // so the test stays "Upcoming" for students until that scheduled moment arrives.
    const updateTestStatus = async (test: Test, status: TestStatus, startNow = true) => {
        try {
            const body: Record<string, unknown> = { status };
            if (status === 'ACTIVE' && startNow) body.startDate = new Date().toISOString();
            const res = await api.patch(`/teacher/tasks/tests/${test.id}`, body);
            setTests(prev => prev.map(t => t.id === test.id ? { ...t, ...res.data.data } : t));
            toast.success(status === 'ACTIVE' ? (startNow ? 'Test activated — link is now live' : 'Test scheduled — will go live at the set Start Date') : 'Test completed');
        } catch (err) { toast.error(apiError(err)); }
    };

    // Ends an ACTIVE test immediately instead of waiting for its Valid Until date —
    // pulls Valid Until to right now so "Ended at" reflects the real stop moment.
    const stopTestNow = async (test: Test) => {
        try {
            const res = await api.patch(`/teacher/tasks/tests/${test.id}`, { status: 'COMPLETED', validUntil: new Date().toISOString() });
            setTests(prev => prev.map(t => t.id === test.id ? { ...t, ...res.data.data } : t));
            toast.success('Test stopped — now shows as completed');
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

    // Ends an ACTIVE assignment immediately — the original Due Date is left
    // untouched; the backend stamps `completedAt` with the real stop moment,
    // which the card shows as "Ended at:" instead of overwriting "Due:".
    const stopAssignmentNow = async (id: string) => {
        try {
            const res = await api.patch(`/teacher/tasks/assignments/${id}`, { status: 'COMPLETED' });
            setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...res.data.data } : a));
            toast.success('Assignment stopped — now shows as completed');
        } catch (err) { toast.error(apiError(err)); }
    };

    const openBuilder = (id: string, type: 'TEST' | 'ASSIGNMENT' = 'TEST') => {
        if (type === 'ASSIGNMENT') openAssignmentBuilder(id);
        else openTestBuilder(id);
    };

    const handleTestPaperSaved = () => {
        fetchTests();
        closeTestBuilder();
    };

    const handleAssignmentPaperSaved = () => {
        fetchAssignments();
        closeAssignmentBuilder();
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
                        images: theQ.images,
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
            api.patch('/teacher/tasks/modules/reorder', { modules: arr.map((m, i) => ({ id: m.id, order: i })) })
                .catch(err => toast.error(apiError(err)));
            return arr;
        });
        setDragModuleId(null);
        setDragOverModuleId(null);
    };
    const handleModuleDragEnd = () => { setDragModuleId(null); setDragOverModuleId(null); };

    const handleMQDragStart = (id: string) => setDragMQId(id);
    const handleMQDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); if (id !== dragMQId) setDragOverMQId(id); };
    const handleMQDrop = (moduleId: string, targetId: string) => {
        if (!dragMQId || dragMQId === targetId) { setDragMQId(null); setDragOverMQId(null); return; }
        setModules(prev => prev.map(m => {
            if (m.id !== moduleId) return m;
            const arr = [...m.questions];
            const fromIdx = arr.findIndex(mq => mq.id === dragMQId);
            const toIdx = arr.findIndex(mq => mq.id === targetId);
            if (fromIdx === -1 || toIdx === -1) return m;
            const [item] = arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, item);
            api.patch(`/teacher/tasks/modules/${moduleId}/questions/reorder`, { questions: arr.map((mq, i) => ({ questionId: mq.questionId, order: i })) })
                .catch(err => toast.error(apiError(err)));
            return { ...m, questions: arr };
        }));
        setDragMQId(null);
        setDragOverMQId(null);
    };
    const handleMQDragEnd = () => { setDragMQId(null); setDragOverMQId(null); };

    const deleteModule = async (id: string) => {
        try {
            await api.delete(`/teacher/tasks/modules/${id}`);
            const deletedModule = modules.find(m => m.id === id);
            const clearedQuestionIds = new Set((deletedModule?.questions ?? []).map(mq => mq.questionId));
            setModules(prev => prev.filter(m => m.id !== id));
            if (clearedQuestionIds.size > 0) {
                setQuestions(prev => prev.map(q => clearedQuestionIds.has(q.id) ? { ...q, moduleAssignment: null } : q));
            }
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
            let newMQ: ModuleQuestion = res.data.data;

            // The question needs a real id before images can attach to it,
            // so any images picked while filling out this form only actually
            // upload now, right after creation succeeds.
            if (customQImages.length > 0) {
                try {
                    const images = await uploadQuestionImages(newMQ.questionId, customQImages);
                    newMQ = { ...newMQ, question: { ...newMQ.question, images } };
                } catch (err) {
                    toast.error(apiError(err) || 'Question saved, but images failed to upload');
                }
            }

            setModules(prev => prev.map(m => m.id === moduleId ? { ...m, questions: [...m.questions, newMQ] } : m));
            toast.success('Question added');
            setAddQModuleId(null);
            setCustomQ({ type: 'MCQ', question: '', answer: '', options: ['', '', '', ''], formula: '' });
            setCustomQImages([]);
        } catch (err) { toast.error(apiError(err)); }
        finally { setSavingCustomQ(false); }
    };

    // Shared by both the custom-question form (upload right after creation)
    // and the "add images" control on an already-assigned question. Returns
    // the question's full, updated images array (existing multer route
    // appends server-side, but the response is the full array either way).
    const uploadQuestionImages = async (questionId: string, files: File[]): Promise<string[]> => {
        const form = new FormData();
        files.forEach(f => form.append('images', f));
        const res = await api.post(`/teacher/tasks/questions/${questionId}/images`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return (res.data.data.images as string[] | null) ?? [];
    };

    const addImagesToMQ = async (moduleId: string, questionId: string, files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploadingImagesFor(questionId);
        try {
            const images = await uploadQuestionImages(questionId, Array.from(files));
            setModules(prev => prev.map(m => m.id !== moduleId ? m : {
                ...m,
                questions: m.questions.map(mq => mq.questionId === questionId ? { ...mq, question: { ...mq.question, images } } : mq),
            }));
        } catch (err) { toast.error(apiError(err)); }
        finally { setUploadingImagesFor(null); }
    };

    const removeImageFromMQ = async (moduleId: string, questionId: string, url: string) => {
        setUploadingImagesFor(questionId);
        try {
            const res = await api.delete(`/teacher/tasks/questions/${questionId}/images`, { data: { url } });
            const images = (res.data.data.images as string[] | null) ?? [];
            setModules(prev => prev.map(m => m.id !== moduleId ? m : {
                ...m,
                questions: m.questions.map(mq => mq.questionId === questionId ? { ...mq, question: { ...mq.question, images } } : mq),
            }));
        } catch (err) { toast.error(apiError(err)); }
        finally { setUploadingImagesFor(null); }
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
        <div className="relative flex flex-col h-full overflow-hidden">
            {/* Action buttons */}
            <div className="shrink-0 px-2 pt-1 pb-1 flex flex-wrap items-center justify-between gap-2 relative">
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
                                        <stop offset="0%" stopColor="var(--primary)">
                                            <animate attributeName="stop-color" values="var(--primary);#DA7756;var(--primary)" dur="3s" repeatCount="indefinite" />
                                        </stop>
                                        <stop offset="100%" stopColor="#DA7756">
                                            <animate attributeName="stop-color" values="#DA7756;var(--primary);#DA7756" dur="3s" repeatCount="indefinite" />
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
                    <div className="order-last w-full sm:w-auto sm:order-none sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex justify-center bg-muted/50 rounded-xl p-0.5 border border-border/50">
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
                        <div className="mx-4 mt-3 p-4 rounded-xl border border-border bg-card/50" data-dashboard-surface="">
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
            <div className="flex-1 min-h-0 overflow-y-auto py-3 pr-2 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                {/* ── QUESTIONS TAB ── */}
                {subTab === 'questions' && !selectedContainerId && (
                    <>
                        {/* New collection inline form */}
                        <AnimatePresence>
                            {creatingContainer && (
                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                    className="p-4 rounded-xl border border-border bg-card/50 mb-1" data-dashboard-surface="">
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
                                    onActivate={(startNow) => updateTestStatus(test, 'ACTIVE', startNow)}
                                    onStopNow={() => stopTestNow(test)}
                                    onResults={() => setResultsTestId(test.id)}
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
                            // The submit link stays open past the due date now, so an assignment only
                            // moves to History once the teacher explicitly marks it COMPLETED — passing
                            // the due date on its own just adds an "Overdue" tag on the card (see below).
                            const isExpiredA = (a: Assignment) => a.status === 'COMPLETED';
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
                                                {liveAssignments.map(a => <AssignmentCard key={a.id} assignment={a} onOpen={() => openBuilder(a.id, 'ASSIGNMENT')} onDelete={() => deleteAssignment(a.id)} onActivate={() => updateAssignmentStatus(a.id, 'ACTIVE')} onComplete={() => stopAssignmentNow(a.id)} onSubmissions={() => setSubmissionsAssignmentId(a.id)} />)}
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
                                                {historyAssignments.map(a => <AssignmentCard key={a.id} assignment={a} onOpen={() => openBuilder(a.id, 'ASSIGNMENT')} onDelete={() => deleteAssignment(a.id)} onActivate={() => updateAssignmentStatus(a.id, 'ACTIVE')} onComplete={() => stopAssignmentNow(a.id)} onSubmissions={() => setSubmissionsAssignmentId(a.id)} />)}
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
                                    className="p-4 rounded-xl border border-border bg-card/50 mb-2" data-dashboard-surface="">
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
                                    <div key={m.id} data-module-card
                                        onDragOver={e => handleModuleDragOver(e, m.id)}
                                        onDrop={() => handleModuleDrop(m.id)}
                                        className={`rounded-xl border bg-card overflow-hidden transition-all ${dragOverModuleId === m.id ? 'border-primary shadow-md scale-[1.01]' : 'border-border'} ${dragModuleId === m.id ? 'opacity-40' : 'opacity-100'}`} data-dashboard-surface="">

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
                                                        <div draggable={editingModuleId !== m.id}
                                                            onClick={e => e.stopPropagation()}
                                                            onDragStart={e => {
                                                                e.stopPropagation();
                                                                handleModuleDragStart(m.id);
                                                                const card = e.currentTarget.closest('[data-module-card]') as HTMLElement | null;
                                                                if (card) e.dataTransfer.setDragImage(card, 20, 20);
                                                            }}
                                                            onDragEnd={handleModuleDragEnd}
                                                            className="shrink-0 cursor-grab active:cursor-grabbing">
                                                            <GripVertical size={14} className="text-muted-foreground/40" />
                                                        </div>
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
                                                        {/* description + question list — the list itself scrolls
                                                            internally (capped height) instead of growing the whole
                                                            module panel taller with every question. */}
                                                        <div className="px-4 pt-2 pb-1">
                                                            {(m as any).description && (
                                                                <p className="text-xs text-muted-foreground pt-1 pb-0.5 italic">{(m as any).description}</p>
                                                            )}
                                                        </div>
                                                        <div className="px-4 pb-1 space-y-1.5 max-h-[420px] overflow-y-auto">
                                                            {m.questions.length === 0 ? (
                                                                <p className="text-xs text-muted-foreground py-2">No questions in this module</p>
                                                            ) : m.questions.map(mq => {
                                                                const isOptsOpen = expandedMQIds.has(mq.id);
                                                                const opts: string[] = mq.question.type === 'MCQ'
                                                                    ? (Array.isArray(mq.question.options) ? mq.question.options : [])
                                                                    : mq.question.type === 'CONCEPTUAL'
                                                                        ? (() => { const d = mq.question.details as ConceptualDetails | null; return d ? [d.correct_answer, ...(d.distractors ?? [])] : []; })()
                                                                        : [];
                                                                const isPlainAnswer = mq.question.type === 'FILL_BLANK' || mq.question.type === 'SHORT_ANSWER' || mq.question.type === 'NUMERICAL';
                                                                const hasOpts = opts.length > 0 || mq.question.type === 'TRUE_FALSE' || isPlainAnswer;
                                                                const isMcqType = mq.question.type === 'MCQ' || mq.question.type === 'CONCEPTUAL';
                                                                if (editingMQId === mq.id) {
                                                                    return (
                                                                        <div key={mq.id} className="py-2 px-1.5 -mx-1.5 rounded-md bg-muted/40 flex flex-col gap-2">
                                                                            <div className="flex flex-col gap-1">
                                                                                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Question</label>
                                                                                <textarea value={editMQText} onChange={e => setEditMQText(e.target.value)} rows={2}
                                                                                    className="w-full text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                                                            </div>
                                                                            {/* Images — same add/remove control as the collapsed row's
                                                                                right-end button, just also surfaced here since this panel
                                                                                is the other place a teacher is actively editing the question. */}
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {(mq.question.images ?? []).map((url, ii) => (
                                                                                    <div key={ii} className="relative group/img shrink-0">
                                                                                        <img src={url} alt="" onClick={e => { e.stopPropagation(); setExpandedImage(url); }}
                                                                                            className="max-w-[160px] max-h-[160px] w-auto h-auto rounded-lg object-contain border border-border bg-muted/40 cursor-pointer" />
                                                                                        <button onClick={() => setRemoveImageConfirm({ moduleId: m.id, questionId: mq.questionId, url })}
                                                                                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all">
                                                                                            <X size={11} />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                                <label className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all cursor-pointer shrink-0 ${uploadingImagesFor === mq.questionId ? 'opacity-50 pointer-events-none' : ''}`}>
                                                                                    {uploadingImagesFor === mq.questionId ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                                                                    Image
                                                                                    <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
                                                                                        onChange={e => { addImagesToMQ(m.id, mq.questionId, e.target.files); e.target.value = ''; }} />
                                                                                </label>
                                                                            </div>
                                                                            {isMcqType ? (
                                                                                <div className="flex flex-col gap-1.5">
                                                                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Options (select correct)</label>
                                                                                    {editMQOptions.map((opt, i) => (
                                                                                        <div key={i} className="flex items-center gap-2">
                                                                                            <button onClick={() => { setEditMQCorrectIdx(i); setEditMQAnswer(editMQOptions[i]); }}
                                                                                                className={`w-4 h-4 rounded-full border-2 shrink-0 ${editMQCorrectIdx === i ? 'border-emerald-500 bg-emerald-500' : 'border-border'}`} />
                                                                                            <span className="text-xs text-muted-foreground shrink-0 w-4">{'ABCD'[i]}.</span>
                                                                                            <input value={opt} onChange={e => {
                                                                                                const next = [...editMQOptions]; next[i] = e.target.value;
                                                                                                setEditMQOptions(next);
                                                                                                if (editMQCorrectIdx === i) setEditMQAnswer(e.target.value);
                                                                                            }} className="flex-1 text-sm rounded-lg border border-border bg-background px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex flex-col gap-1">
                                                                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Answer</label>
                                                                                    <textarea value={editMQAnswer} onChange={e => setEditMQAnswer(e.target.value)} rows={2}
                                                                                        className="w-full text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                                                                </div>
                                                                            )}
                                                                            <div className="flex gap-2 justify-end">
                                                                                <button onClick={() => setEditingMQId(null)}
                                                                                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                                                                    Cancel
                                                                                </button>
                                                                                <button onClick={() => saveEditMQ(mq)}
                                                                                    className="text-xs px-3 py-1.5 rounded-lg text-white font-medium transition-all"
                                                                                    style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                                                                    Save
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return (
                                                                    <div key={mq.id}
                                                                        onDragOver={e => handleMQDragOver(e, mq.id)}
                                                                        onDrop={() => handleMQDrop(m.id, mq.id)}
                                                                        onClick={() => {
                                                                            if (!hasOpts) return;
                                                                            setExpandedMQIds(prev => {
                                                                                const next = new Set(prev);
                                                                                if (next.has(mq.id)) next.delete(mq.id); else next.add(mq.id);
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        className={`flex items-start gap-2 py-1.5 px-1.5 -mx-1.5 rounded-md group/mq transition-all hover:bg-muted/50 ${hasOpts ? 'cursor-pointer' : ''} ${dragOverMQId === mq.id ? 'bg-black/5 dark:bg-white/10' : ''} ${dragMQId === mq.id ? 'opacity-40' : ''}`}>
                                                                        <div draggable
                                                                            onClick={e => e.stopPropagation()}
                                                                            onDragStart={e => {
                                                                                e.stopPropagation();
                                                                                handleMQDragStart(mq.id);
                                                                                const row = e.currentTarget.parentElement as HTMLElement | null;
                                                                                if (row) e.dataTransfer.setDragImage(row, 20, 20);
                                                                            }}
                                                                            onDragEnd={handleMQDragEnd}
                                                                            className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing">
                                                                            <GripVertical size={13} />
                                                                        </div>
                                                                        <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${TYPE_META[mq.question.type]?.color ?? 'bg-muted text-muted-foreground'}`}>{TYPE_META[mq.question.type]?.label}</span>
                                                                        <div className="flex-1 min-w-0">
                                                                            <span className="text-sm">{mq.question.question}</span>
                                                                            {/* Images — shown large right below the question text,
                                                                                always (not just when expanded) and always above the
                                                                                options/answer, since a diagram/figure attached to a
                                                                                question needs to actually be legible here. */}
                                                                            {(mq.question.images ?? []).length > 0 && (
                                                                                <div className="mt-2 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                                                                                    {(mq.question.images ?? []).map((url, ii) => (
                                                                                        <div key={ii} className="relative group/img">
                                                                                            <img src={url} alt="" onClick={e => { e.stopPropagation(); setExpandedImage(url); }}
                                                                                                className="max-w-[400px] max-h-[400px] w-auto h-auto rounded-lg object-contain border border-border bg-muted/40 cursor-pointer" />
                                                                                            <button onClick={() => setRemoveImageConfirm({ moduleId: m.id, questionId: mq.questionId, url })}
                                                                                                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all">
                                                                                                <X size={11} />
                                                                                            </button>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            {isOptsOpen && opts.length > 0 && (
                                                                                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                                                                                    {opts.map((opt, oi) => {
                                                                                        const isCorrect = (mq.question.type === 'MCQ' || mq.question.type === 'CONCEPTUAL') && opt === mq.question.answer;
                                                                                        return (
                                                                                            <span key={oi} className={`text-xs truncate ${isCorrect ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{String.fromCharCode(65 + oi)}) {opt}</span>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                            {isOptsOpen && mq.question.type === 'TRUE_FALSE' && (
                                                                                <div className="mt-1 flex gap-4">
                                                                                    <span className={`text-xs ${mq.question.answer?.toLowerCase() === 'true' ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>A) True</span>
                                                                                    <span className={`text-xs ${mq.question.answer?.toLowerCase() === 'false' ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>B) False</span>
                                                                                </div>
                                                                            )}
                                                                            {isOptsOpen && isPlainAnswer && (
                                                                                <div className="mt-1 text-xs space-y-0.5">
                                                                                    {mq.question.type === 'NUMERICAL' && (mq.question.details as NumericalDetails | null)?.correct_answer_formula && (
                                                                                        <div>
                                                                                            <span className="text-muted-foreground">Formula: </span>
                                                                                            <span className="font-mono">{(mq.question.details as NumericalDetails).correct_answer_formula}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    <div>
                                                                                        <span className="text-muted-foreground">Answer: </span>
                                                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{mq.question.answer}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            {hasOpts && (isOptsOpen ? <ChevronUp size={12} className="text-muted-foreground shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0" />)}
                                                                            <label onClick={e => e.stopPropagation()} className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all cursor-pointer shrink-0 ${(mq.question.images ?? []).length === 0 ? 'opacity-0 group-hover/mq:opacity-100' : ''} ${uploadingImagesFor === mq.questionId ? 'opacity-50 pointer-events-none' : ''}`}>
                                                                                {uploadingImagesFor === mq.questionId ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                                                                Image
                                                                                <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
                                                                                    onChange={e => { addImagesToMQ(m.id, mq.questionId, e.target.files); e.target.value = ''; }} />
                                                                            </label>
                                                                            {/* Edit/remove icons — grouped in the same items-center row
                                                                                as the Image pill (rather than as separate top-aligned
                                                                                siblings) so they line up on the Image pill's own
                                                                                vertical center instead of sitting above it. */}
                                                                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/mq:opacity-100 transition-all">
                                                                                <button onClick={e => { e.stopPropagation(); startEditMQ(mq); }}
                                                                                    className="text-muted-foreground hover:text-primary p-0.5 rounded"
                                                                                    title="Edit question">
                                                                                    <Pencil size={12} />
                                                                                </button>
                                                                                <button onClick={e => { e.stopPropagation(); setRemoveMQConfirm({ moduleId: m.id, questionId: mq.questionId, questionText: mq.question.question }); }}
                                                                                    className="text-muted-foreground hover:text-red-500 p-0.5 rounded"
                                                                                    title="Remove from module">
                                                                                    <X size={12} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
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

                                                                {/* Images (optional) — held in memory here and only
                                                                    actually uploaded once this question is created and has
                                                                    a real id (see saveCustomQuestion). */}
                                                                <div>
                                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Images <span className="normal-case font-normal">(optional)</span></p>
                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                        {customQImages.map((file, ii) => (
                                                                            <div key={ii} className="relative group/img">
                                                                                <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 rounded-md object-cover border border-border" />
                                                                                <button onClick={() => setCustomQImages(prev => prev.filter((_, j) => j !== ii))}
                                                                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all">
                                                                                    <X size={9} />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                        <label className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all cursor-pointer">
                                                                            <Plus size={13} /> Image
                                                                            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
                                                                                onChange={e => { setCustomQImages(prev => [...prev, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
                                                                        </label>
                                                                    </div>
                                                                </div>

                                                                <div className="flex justify-end gap-2 pt-1">
                                                                    <button onClick={() => { setAddQModuleId(null); setCustomQ({ type: 'MCQ', question: '', answer: '', options: ['','','',''], formula: '' }); setCustomQImages([]); }}
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

            {/* Test Results Panel */}
            <AnimatePresence>
                {resultsTestId && (
                    <TestResultsPanel testId={resultsTestId} onClose={() => setResultsTestId(null)} />
                )}
            </AnimatePresence>

            {/* Assignment Submissions Panel */}
            {submissionsAssignmentId && (
                <AssignmentSubmissionsPanel assignmentId={submissionsAssignmentId} onClose={() => setSubmissionsAssignmentId(null)} />
            )}

            {/* Paper Builder — full-screen overlay (test) */}
            {testBuilderVisible && (
                <PaperBuilder
                    testId={testBuilderId}
                    approvedQuestions={approvedQuestions}
                    modules={modules}
                    lockedPaperType="TEST"
                    entityType="test"
                    onClose={() => { closeTestBuilder(); fetchTests(); }}
                    onSaved={handleTestPaperSaved}
                />
            )}

            {/* Paper Builder — full-screen overlay (assignment) */}
            {assignmentBuilderVisible && (
                <PaperBuilder
                    testId={assignmentBuilderId}
                    approvedQuestions={approvedQuestions}
                    modules={modules}
                    lockedPaperType="ASSIGNMENT"
                    entityType="assignment"
                    onClose={() => { closeAssignmentBuilder(); fetchAssignments(); }}
                    onSaved={handleAssignmentPaperSaved}
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
                            className="fixed z-50 bg-card border border-border rounded-2xl shadow-2xl w-[calc(100%-2rem)] max-w-[420px]"
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
                                    <label className="text-xs text-muted-foreground">Syllabus / Description <span className="text-muted-foreground/60">(one topic per line)</span></label>
                                    <textarea value={newTest.description} onChange={e => setNewTest(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Chapter 5 — Photosynthesis&#10;Chapter 6 — Respiration"
                                        rows={3}
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
                                </div>
                                {[
                                    { label: 'Duration (mins)', key: 'durationMinutes', min: 5, max: 300 },
                                    { label: 'Total Marks', key: 'totalMarks', min: 1, max: 1000 },
                                    { label: 'No. of Questions', key: 'numberOfQuestions', min: 1, max: 100 },
                                    { label: 'Max Attempts', key: 'maxAttempts', min: 1, max: 10 },
                                ].map(({ label, key, min, max }) => {
                                    const current = (newTest as Record<string, unknown>)[key] as number;
                                    const draft = newTestDraft[key];
                                    return (
                                        <div key={key}>
                                            <label className="text-xs text-muted-foreground">{label}</label>
                                            <input type="text" inputMode="numeric"
                                                value={draft !== null && draft !== undefined ? draft : String(current)}
                                                onFocus={e => { setNewTestDraft(d => ({ ...d, [key]: String(current) })); e.currentTarget.select(); }}
                                                onChange={e => {
                                                    const digits = e.target.value.replace(/[^0-9]/g, '');
                                                    setNewTestDraft(d => ({ ...d, [key]: digits }));
                                                    if (digits !== '') setNewTest(p => ({ ...p, [key]: Number(digits) }));
                                                }}
                                                onBlur={() => {
                                                    const raw = newTestDraft[key];
                                                    const n = parseInt(raw ?? '', 10);
                                                    setNewTest(p => ({ ...p, [key]: !isNaN(n) ? Math.min(max, Math.max(min, n)) : current }));
                                                    setNewTestDraft(d => ({ ...d, [key]: null }));
                                                }}
                                                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                        </div>
                                    );
                                })}
                                <div>
                                    <label className="text-xs text-muted-foreground">Start Date (optional)</label>
                                    <input type="datetime-local" value={newTest.startDate} min={toLocalDatetimeInput(new Date().toISOString())}
                                        onChange={e => {
                                            const v = e.target.value;
                                            if (v && new Date(v) < new Date()) {
                                                toast.error('Start Date cannot be in the past');
                                                return;
                                            }
                                            setNewTest(p => {
                                                // If Valid Until is already set and would now fall before/at the
                                                // new Start Date, clear it rather than silently allowing an invalid pair.
                                                const clearValidUntil = p.validUntil && v && new Date(p.validUntil) <= new Date(v);
                                                if (clearValidUntil) toast.error('Valid Until was cleared — it was before the new Start Date');
                                                return { ...p, startDate: v, validUntil: clearValidUntil ? '' : p.validUntil };
                                            });
                                        }}
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Valid Until (optional)</label>
                                    <input type="datetime-local" value={newTest.validUntil} min={newTest.startDate || undefined}
                                        onChange={e => {
                                            const v = e.target.value;
                                            if (newTest.startDate && v && new Date(v) <= new Date(newTest.startDate)) {
                                                toast.error('Valid Until must be after the Start Date');
                                                return;
                                            }
                                            setNewTest(p => ({ ...p, validUntil: v }));
                                        }}
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
                            className="fixed z-50 bg-card border border-border rounded-2xl shadow-2xl w-[calc(100%-2rem)] max-w-[420px]"
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
                                        placeholder="e.g. Assignment 1"
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
                                    <input type="text" inputMode="numeric"
                                        value={newAssignmentMarksDraft !== null ? newAssignmentMarksDraft : String(newAssignment.totalMarks)}
                                        onFocus={e => { setNewAssignmentMarksDraft(String(newAssignment.totalMarks)); e.currentTarget.select(); }}
                                        onChange={e => {
                                            const digits = e.target.value.replace(/[^0-9]/g, '');
                                            setNewAssignmentMarksDraft(digits);
                                            if (digits !== '') setNewAssignment(p => ({ ...p, totalMarks: Number(digits) }));
                                        }}
                                        onBlur={() => {
                                            const n = parseInt(newAssignmentMarksDraft ?? '', 10);
                                            setNewAssignment(p => ({ ...p, totalMarks: !isNaN(n) ? Math.min(500, Math.max(1, n)) : p.totalMarks }));
                                            setNewAssignmentMarksDraft(null);
                                        }}
                                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Due Date (optional)</label>
                                    <input type="datetime-local" value={newAssignment.dueDate}
                                        onChange={e => setNewAssignment(p => ({ ...p, dueDate: e.target.value }))}
                                        className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-muted-foreground">Submission Type</label>
                                    <div className="flex gap-2 mt-1">
                                        {(['OFFLINE', 'ONLINE'] as const).map(type => (
                                            <button key={type} type="button"
                                                onClick={() => setNewAssignment(p => ({ ...p, submissionType: type }))}
                                                className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                                                    newAssignment.submissionType === type
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'border-border text-muted-foreground hover:bg-muted'
                                                }`}>
                                                {type === 'OFFLINE' ? '📝 Offline' : '📤 Online'}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {newAssignment.submissionType === 'OFFLINE'
                                            ? 'Students submit physically. You mark each as submitted manually.'
                                            : 'Students upload a PDF. You review and mark Correct or Write Again.'}
                                    </p>
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

            {/* Remove question from module confirm modal */}
            <AnimatePresence>
                {removeMQConfirm && (
                    <>
                        <motion.div
                            key="rmq-overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                            onClick={() => setRemoveMQConfirm(null)}
                        />
                        <motion.div
                            key="rmq-modal"
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                        >
                            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-80 pointer-events-auto flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-foreground">Remove this question?</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        "{removeMQConfirm.questionText}" will be removed from this module.
                                    </p>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setRemoveMQConfirm(null)}
                                        className="px-4 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                        Cancel
                                    </button>
                    <button onClick={() => { removeFromModule(removeMQConfirm.moduleId, removeMQConfirm.questionId); setRemoveMQConfirm(null); }}
                                        className="px-4 py-1.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Remove image confirm modal */}
            <AnimatePresence>
                {removeImageConfirm && (
                    <>
                        <motion.div
                            key="rimg-overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                            onClick={() => setRemoveImageConfirm(null)}
                        />
                        <motion.div
                            key="rimg-modal"
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                        >
                            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-80 pointer-events-auto flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-semibold text-foreground">Remove this image?</p>
                                    <img src={removeImageConfirm.url} alt="" className="max-h-40 w-auto rounded-lg object-contain border border-border bg-muted/40 self-center" />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setRemoveImageConfirm(null)}
                                        className="px-4 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                        Cancel
                                    </button>
                                    <button onClick={() => { removeImageFromMQ(removeImageConfirm.moduleId, removeImageConfirm.questionId, removeImageConfirm.url); setRemoveImageConfirm(null); }}
                                        className="px-4 py-1.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Expanded question image — same zoom treatment as the profile
                photo expand in Topbar.tsx's AvatarMenu. */}
            <AnimatePresence>
                {expandedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => setExpandedImage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="relative max-w-[90vw] max-h-[85vh]"
                            onClick={e => e.stopPropagation()}
                        >
                            <img src={expandedImage} alt="" className="max-w-[90vw] max-h-[85vh] w-auto h-auto rounded-2xl object-contain shadow-2xl" />
                            <button
                                onClick={() => setExpandedImage(null)}
                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                                <X size={16} className="text-white" />
                            </button>
                        </motion.div>
                    </motion.div>
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
                            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md pointer-events-auto flex flex-col gap-4 max-h-[85vh]" data-dashboard-surface="">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold">Share questions</p>
                                    <button onClick={() => setShareOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                                </div>

                                {shareToken ? (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-xs text-muted-foreground">Share this code with another teacher in your institution. It expires in 7 days.</p>
                                        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2" data-dashboard-surface="">
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
                            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md pointer-events-auto flex flex-col gap-4 max-h-[85vh]" data-dashboard-surface="">
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
        <div className="rounded-xl border border-border bg-card" data-dashboard-surface="">
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
                        <div className="absolute bottom-full right-0 mb-1 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px]" data-dashboard-surface="">
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
                                style={{ width: 160 }} data-dashboard-surface="">
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

function AssignmentCard({ assignment, onOpen, onDelete, onActivate, onComplete, onSubmissions }: {
    assignment: Assignment; onOpen: () => void;
    onDelete: () => void; onActivate: () => void; onComplete: () => void; onSubmissions: () => void;
}) {
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [activateConfirm, setActivateConfirm] = useState(false);
    const [completeConfirm, setCompleteConfirm] = useState(false);
    // Submissions stay open past the due date now, so status no longer
    // auto-flips to COMPLETED when the due date passes — only the teacher's
    // explicit Stop Now action does that. An overdue-but-still-active
    // assignment instead gets a separate "Overdue" tag next to the status badge.
    const effectiveStatus: AssignmentStatus = assignment.status;
    const isOverdue = assignment.status === 'ACTIVE' && !!assignment.dueDate && new Date(assignment.dueDate) < new Date();
    const statusColor = {
        DRAFT: 'text-muted-foreground bg-muted',
        ACTIVE: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950',
        COMPLETED: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950',
    }[effectiveStatus];

    return (
        <div className="group rounded-xl border border-border bg-card px-6 py-5 flex flex-col gap-4 min-h-[130px]" data-dashboard-surface="">
            {/* Top row */}
            <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${statusColor}`}>{effectiveStatus}</span>
                        {isOverdue && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0 text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950">⚠️ Overdue</span>
                        )}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md shrink-0 ${assignment.submissionType === 'ONLINE' ? 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-950' : 'text-muted-foreground bg-muted'}`}>
                            {assignment.submissionType === 'ONLINE' ? '📤 Online' : '📝 Offline'}
                        </span>
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
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap self-start mt-1 mr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-foreground/50">Created at:</span> {assignment.createdAt ? `${new Date(assignment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(assignment.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—'}
                    </span>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span><span className="text-foreground/50">Started at:</span> {assignment.createdAt ? `${new Date(assignment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(assignment.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—'}</span>
                    <span className="opacity-40">·</span>
                    <span><span className="text-foreground/50">Due:</span> {assignment.dueDate ? `${new Date(assignment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(assignment.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—'}</span>
                    {effectiveStatus === 'COMPLETED' && assignment.completedAt && (
                        <>
                            <span className="opacity-40">·</span>
                            <span><span className="text-foreground/50">Ended at:</span> {new Date(assignment.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(assignment.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {effectiveStatus === 'DRAFT' && (
                        <div className="relative">
                            <button onClick={() => setActivateConfirm(true)} disabled={assignment.numberOfQuestions === 0 || !assignment.dueDate}
                                title={assignment.numberOfQuestions === 0 ? 'Add at least one question before activating' : !assignment.dueDate ? 'Set a Due Date before activating' : undefined}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10">
                                <Play size={12} /> Activate
                            </button>
                            <AnimatePresence>
                                {activateConfirm && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                        className="absolute right-0 bottom-9 z-30 bg-card border border-border rounded-xl shadow-xl p-3 w-60 flex flex-col gap-2">
                                        <p className="text-xs font-semibold text-foreground">Activate this assignment?</p>
                                        <p className="text-[11px] text-muted-foreground">Students will be able to see and submit it immediately.</p>
                                        <div className="flex gap-1.5 justify-end">
                                            <button onClick={() => setActivateConfirm(false)}
                                                className="px-2.5 py-1 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                                Cancel
                                            </button>
                                            <button onClick={() => { setActivateConfirm(false); onActivate(); }}
                                                className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-all">
                                                Activate
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                    {effectiveStatus === 'ACTIVE' && (
                        <div className="relative">
                            <button onClick={() => setCompleteConfirm(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all">
                                <Square size={11} /> Stop Now
                            </button>
                            <AnimatePresence>
                                {completeConfirm && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                        className="absolute right-0 bottom-9 z-30 bg-card border border-border rounded-xl shadow-xl p-3 w-64 flex flex-col gap-2">
                                        <p className="text-xs font-semibold text-foreground">Stop this assignment now?</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            The assignment will end immediately. This can't be undone.
                                        </p>
                                        <div className="flex gap-1.5 justify-end">
                                            <button onClick={() => setCompleteConfirm(false)}
                                                className="px-2.5 py-1 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                                Cancel
                                            </button>
                                            <button onClick={() => { setCompleteConfirm(false); onComplete(); }}
                                                className="px-2.5 py-1 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                                Stop Now
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                    <button onClick={onOpen} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all flex items-center gap-1.5">
                        <Eye size={12} /> Open & Edit
                    </button>
                    <button onClick={onSubmissions} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all flex items-center gap-1.5">
                        <BarChart2 size={12} /> Submissions
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Test Results Panel ────────────────────────────────────────────────────────

interface TestAttemptResult {
    id: string;
    studentName: string;
    rollNo: string;
    attemptNumber: number;
    totalScore: number;
    maxScore: number;
    tabChangeCount: number;
    malpracticeFlag: boolean;
    startTime: string | null;
    endTime: string | null;
    student: { id: string } | null;
}

function fmtDateTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface TestResultData {
    test: { title: string; subject: { name: string }; division: { name: string }; totalMarks: number; status: string; validUntil: string | null; maxAttempts: number };
    attempts: TestAttemptResult[];
    roster: { id: string; name: string; rollNo: string }[];
}

function TestResultsPanel({ testId, onClose }: { testId: string; onClose: () => void }) {
    const [data, setData] = useState<TestResultData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/teacher/tasks/tests/${testId}/results`)
            .then(res => setData(res.data.data as TestResultData))
            .catch(() => toast.error('Failed to load results'))
            .finally(() => setLoading(false));
    }, [testId]);

    // Every roster student, grouped with ALL of their attempts (not just one) —
    // a student who took a test twice gets two adjacent rows, one per attempt,
    // so the teacher can see both instead of only whichever attempt happened
    // to be picked. Students with zero attempts still get one row (attempt:
    // null) so the teacher can see who hasn't given the test at all. Attempts
    // from students no longer on the roster (e.g. removed after taking the
    // test) are appended at the end as their own group, rather than dropped.
    type ResultRow = { student: { id: string; name: string; rollNo: string }; attempt: TestAttemptResult | null; isFirstOfGroup: boolean; isLastOfGroup: boolean };
    const studentGroups: { student: { id: string; name: string; rollNo: string }; attempts: TestAttemptResult[] }[] = data ? (() => {
        const rosterIds = new Set(data.roster.map(s => s.id));
        const groups = data.roster.map(s => ({
            student: s,
            attempts: data.attempts.filter(a => a.student?.id === s.id).sort((a, b) => a.attemptNumber - b.attemptNumber),
        }));
        const extraByKey = new Map<string, TestAttemptResult[]>();
        data.attempts.filter(a => !rosterIds.has(a.student?.id ?? '')).forEach(a => {
            const key = a.student?.id || a.studentName;
            if (!extraByKey.has(key)) extraByKey.set(key, []);
            extraByKey.get(key)!.push(a);
        });
        extraByKey.forEach((list, key) => {
            const sorted = list.slice().sort((a, b) => a.attemptNumber - b.attemptNumber);
            groups.push({ student: { id: sorted[0].student?.id ?? key, name: sorted[0].studentName, rollNo: sorted[0].rollNo }, attempts: sorted });
        });
        return groups;
    })() : [];

    const rows: ResultRow[] = studentGroups.flatMap((g): ResultRow[] =>
        g.attempts.length > 0
            ? g.attempts.map((a, i) => ({ student: g.student, attempt: a, isFirstOfGroup: i === 0, isLastOfGroup: i === g.attempts.length - 1 }))
            : [{ student: g.student, attempt: null, isFirstOfGroup: true, isLastOfGroup: true }]
    );
    // One row per student using their best attempt — used for the
    // not-submitted count and the highest/lowest scorer cards, so a student
    // with 2 attempts doesn't get double-counted or show up on both ends.
    const bestRows: ResultRow[] = studentGroups.map(g => ({
        student: g.student,
        attempt: g.attempts.length > 0 ? g.attempts.reduce((best, a) => (a.totalScore > best.totalScore ? a : best)) : null,
        isFirstOfGroup: true,
        isLastOfGroup: true,
    }));
    const notSubmittedCount = bestRows.filter(r => !r.attempt).length;

    // Once the test window has actually closed (either explicitly marked
    // COMPLETED, or its validUntil has passed), a student who never
    // submitted has definitively missed it — worth calling out in red with
    // a hard 0, instead of the more neutral "still open, might submit yet"
    // amber/— treatment shown while the test is still live.
    const isTestCompleted = !!data && (data.test.status === 'COMPLETED' || (!!data.test.validUntil && new Date(data.test.validUntil) < new Date()));

    // Highest/lowest scorer, by percentage — only among students who actually
    // submitted (best attempt each). Ties keep the first match (roster order / rollNo asc).
    const scoredRows = bestRows.filter((r): r is ResultRow & { attempt: TestAttemptResult } => !!r.attempt);
    const pct = (a: TestAttemptResult) => (a.maxScore > 0 ? (a.totalScore / a.maxScore) * 100 : 0);
    const highestRow = scoredRows.length > 0 ? scoredRows.reduce((best, r) => (pct(r.attempt) > pct(best.attempt) ? r : best)) : null;
    const lowestRow = scoredRows.length > 0 ? scoredRows.reduce((worst, r) => (pct(r.attempt) < pct(worst.attempt) ? r : worst)) : null;

    const handleDownload = () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const url = `${base}/teacher/tasks/tests/${testId}/results/download`;
        fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then(async res => {
                const blob = await res.blob();
                const disposition = res.headers.get('Content-Disposition') ?? '';
                const match = disposition.match(/filename="(.+)"/);
                const filename = match?.[1] ?? 'results.csv';
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                a.click();
                URL.revokeObjectURL(a.href);
            })
            .catch(() => toast.error('Download failed'));
    };

    const [downloadingAttemptId, setDownloadingAttemptId] = useState<string | null>(null);
    const handleDownloadAttemptPdf = async (attemptId: string, studentName: string) => {
        setDownloadingAttemptId(attemptId);
        try {
            const res = await api.get(`/teacher/tasks/attempts/${attemptId}/pdf`, { responseType: 'blob' });
            const blob = res.data as Blob;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Result_${studentName}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Download failed');
        } finally {
            setDownloadingAttemptId(null);
        }
    };

    return (
        <motion.div
            className="absolute inset-0 z-50 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <motion.div
                className="relative ml-auto w-full max-w-6xl h-full bg-card border-l border-border flex flex-col shadow-2xl"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-3 border-b border-border shrink-0 bg-card">
                    <div className="shrink-0">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
                            <BarChart2 size={11} /> Results
                        </p>
                        <h2 className="font-semibold text-sm">{data?.test.title ?? '—'}</h2>
                        {data && <p className="text-xs text-muted-foreground">{data.test.subject.name} · {data.test.division.name}</p>}
                    </div>

                    {data && rows.length > 0 && (
                        <div className="flex items-center gap-3 flex-1 justify-center">
                            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-background px-3.5 py-2" data-dashboard-surface="">
                                <span className="text-base font-bold leading-none">{data.attempts.length}</span>
                                <span className="text-xs text-muted-foreground">Submitted</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-background px-3.5 py-2" data-dashboard-surface="">
                                <span className={`text-base font-bold leading-none ${isTestCompleted ? 'text-red-500' : 'text-amber-500'}`}>{notSubmittedCount}</span>
                                <span className="text-xs text-muted-foreground">Not Submitted</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-background px-3.5 py-2" data-dashboard-surface="">
                                <span className="text-base font-bold leading-none">
                                    {data.attempts.length > 0 ? Math.round(data.attempts.reduce((s, a) => s + (a.maxScore > 0 ? (a.totalScore / a.maxScore) * 100 : 0), 0) / data.attempts.length) : 0}%
                                </span>
                                <span className="text-xs text-muted-foreground">Avg Score</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-background px-3.5 py-2" data-dashboard-surface="">
                                <span className="text-base font-bold leading-none text-red-500">{data.attempts.filter(a => a.malpracticeFlag).length}</span>
                                <span className="text-xs text-muted-foreground">Malpractice</span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                        {data && data.attempts.length > 0 && (
                            /* CSV export intentionally stays submitted-only — download button hidden only if nobody has submitted yet */
                            <button onClick={handleDownload}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                <Download size={12} /> Download CSV
                            </button>
                        )}
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col overflow-hidden pl-3 pr-1.5 pb-4 pt-2.5 bg-background">
                    {loading ? (
                        <div className="flex items-center justify-center h-full"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
                    ) : !data || rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                            <BarChart2 size={36} className="text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No students in this class yet.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full min-h-0">
                            {/* Highest / Lowest scorer */}
                            {highestRow && lowestRow && (
                                <div className="grid grid-cols-2 gap-3 mb-2.5 shrink-0">
                                    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                        <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                            <Trophy size={16} className="text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Highest Score</p>
                                            <p className="text-sm font-semibold truncate">{highestRow.student.name}</p>
                                            <p className="text-xs text-muted-foreground">Roll {highestRow.student.rollNo}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-2xl font-bold leading-none text-emerald-500 dark:text-emerald-300">{Math.round(pct(highestRow.attempt))}%</p>
                                            <p className="text-xs font-semibold text-black dark:text-white mt-1">{highestRow.attempt.totalScore}/{highestRow.attempt.maxScore}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                                        <div className="shrink-0 w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center">
                                            <TrendingDown size={16} className="text-red-500" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">Lowest Score</p>
                                            <p className="text-sm font-semibold truncate">{lowestRow.student.name}</p>
                                            <p className="text-xs text-muted-foreground">Roll {lowestRow.student.rollNo}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-2xl font-bold leading-none text-red-400 dark:text-red-300">{Math.round(pct(lowestRow.attempt))}%</p>
                                            <p className="text-xs font-semibold text-black dark:text-white mt-1">{lowestRow.attempt.totalScore}/{lowestRow.attempt.maxScore}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Table */}
                            <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-border bg-card" data-dashboard-surface="">
                                <table className="w-full text-xs border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-muted shadow-[inset_0_-1px_0_0_var(--border)]">
                                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Roll No</th>
                                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Name</th>
                                            <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Status</th>
                                            <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Attempt</th>
                                            <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Given At</th>
                                            <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Submitted At</th>
                                            <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Score</th>
                                            <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">%</th>
                                            <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Tab Changes</th>
                                            <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Malpractice</th>
                                            <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r, i) => {
                                            const a = r.attempt;
                                            const pct = a && a.maxScore > 0 ? Math.round((a.totalScore / a.maxScore) * 100) : 0;
                                            // No border between a student's own attempt rows — only below the
                                            // last attempt in the group, so consecutive attempts read as one
                                            // visually grouped block instead of separate students.
                                            const rowBorder = r.isLastOfGroup ? 'border-b border-black/10 dark:border-white/10' : '';
                                            return (
                                                <tr key={i} className="bg-card">
                                                    <td className={`px-4 py-2.5 font-mono text-muted-foreground ${rowBorder}`}>{r.isFirstOfGroup ? r.student.rollNo : ''}</td>
                                                    <td className={`px-4 py-2.5 font-medium ${rowBorder} ${!a ? 'text-muted-foreground' : ''}`}>{r.student.name}</td>
                                                    <td className={`px-4 py-2.5 text-center ${rowBorder}`}>
                                                        {a ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                                                                Submitted
                                                            </span>
                                                        ) : isTestCompleted ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                                                                Not Submitted
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                                                                Not Submitted
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className={`px-4 py-2.5 text-center text-muted-foreground whitespace-nowrap ${rowBorder}`}>
                                                        {a ? `${a.attemptNumber}/${data?.test.maxAttempts ?? a.attemptNumber}` : <span className="text-muted-foreground/50">—</span>}
                                                    </td>
                                                    <td className={`px-4 py-2.5 text-center text-muted-foreground whitespace-nowrap ${rowBorder}`}>{a ? fmtDateTime(a.startTime) : <span className="text-muted-foreground/50">—</span>}</td>
                                                    <td className={`px-4 py-2.5 text-center text-muted-foreground whitespace-nowrap ${rowBorder}`}>{a ? fmtDateTime(a.endTime) : <span className="text-muted-foreground/50">—</span>}</td>
                                                    <td className={`px-4 py-2.5 text-center ${rowBorder}`}>
                                                        {a ? `${a.totalScore}/${a.maxScore}` : isTestCompleted ? (
                                                            <span className="text-red-500">{`0/${data?.test.totalMarks ?? 0}`}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground/50">—</span>
                                                        )}
                                                    </td>
                                                    <td className={`px-4 py-2.5 text-center ${rowBorder}`}>
                                                        {a ? (
                                                            <span className={`font-semibold ${pct >= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{pct}%</span>
                                                        ) : isTestCompleted ? (
                                                            <span className="font-semibold text-red-500">0%</span>
                                                        ) : (
                                                            <span className="text-muted-foreground/50">—</span>
                                                        )}
                                                    </td>
                                                    <td className={`px-4 py-2.5 text-center text-muted-foreground ${rowBorder}`}>{a ? a.tabChangeCount : <span className="text-muted-foreground/50">—</span>}</td>
                                                    <td className={`px-4 py-2.5 text-center ${rowBorder}`}>
                                                        {a?.malpracticeFlag ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                                                                <ShieldAlert size={10} /> Yes
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground/50">—</span>
                                                        )}
                                                    </td>
                                                    <td className={`px-4 py-2.5 text-center ${rowBorder}`}>
                                                        {a ? (
                                                            <button onClick={() => handleDownloadAttemptPdf(a.id, r.student.name)}
                                                                disabled={downloadingAttemptId === a.id}
                                                                className="inline-flex items-center justify-center w-6 h-6 rounded-lg hover:bg-muted transition-all disabled:opacity-50"
                                                                title="Download result PDF">
                                                                {downloadingAttemptId === a.id
                                                                    ? <Loader2 size={12} className="animate-spin text-muted-foreground" />
                                                                    : <Download size={12} className="text-muted-foreground" />}
                                                            </button>
                                                        ) : (
                                                            <span className="text-muted-foreground/50">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Assignment Submissions Panel ──────────────────────────────────────────────

interface AssignmentSubmissionAttempt {
    id: string;
    attemptNumber: number;
    fileUrl: string | null;
    submittedAt: string;
    reviewStatus: string | null;
    reviewNote: string | null;
    reviewedAt: string | null;
}

interface AssignmentSubmission {
    student: { id: string; name: string | null; rollNo: string | null };
    submission: {
        id: string;
        fileUrl: string | null;
        submittedAt: string | null;
        resubmitCount: number;
        reviewStatus: string | null;
        reviewNote: string | null;
        reviewedAt: string | null;
        offlineSubmittedAt: string | null;
        offlineMarkedLate: boolean;
    } | null;
    // Newest first — attempts[0] mirrors `submission` above.
    attempts: AssignmentSubmissionAttempt[];
}

interface AssignmentSubmissionsData {
    assignment: { id: string; title: string; submissionType: 'OFFLINE' | 'ONLINE'; dueDate: string | null; totalMarks: number; status: 'DRAFT' | 'ACTIVE' | 'COMPLETED'; completedAt: string | null };
    students: AssignmentSubmission[];
}

function AssignmentSubmissionsPanel({ assignmentId, onClose }: { assignmentId: string; onClose: () => void }) {
    const [data, setData] = useState<AssignmentSubmissionsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [reviewing, setReviewing] = useState<string | null>(null);
    const [reviewNote, setReviewNote] = useState('');
    const [toggling, setToggling] = useState<string | null>(null);
    const [confirmReview, setConfirmReview] = useState<{ studentId: string; status: 'CORRECT' | 'WRITE_AGAIN' } | null>(null);
    const [historyOpenFor, setHistoryOpenFor] = useState<Set<string>>(new Set());

    useEffect(() => {
        api.get(`/teacher/tasks/assignments/${assignmentId}/submissions`)
            .then(res => setData(res.data.data as AssignmentSubmissionsData))
            .catch(() => toast.error('Failed to load submissions'))
            .finally(() => setLoading(false));
    }, [assignmentId]);

    async function handleReview(studentId: string, reviewStatus: 'CORRECT' | 'WRITE_AGAIN') {
        setConfirmReview(null);
        setReviewing(studentId + reviewStatus);
        try {
            await api.patch(`/teacher/tasks/assignments/${assignmentId}/submissions/${studentId}/review`, { reviewStatus, reviewNote: reviewNote || null });
            toast.success(reviewStatus === 'CORRECT' ? 'Approved' : 'Sent back for revision');
            const res = await api.get(`/teacher/tasks/assignments/${assignmentId}/submissions`);
            setData(res.data.data as AssignmentSubmissionsData);
            setReviewNote('');
        } catch { toast.error('Failed to update review'); }
        finally { setReviewing(null); }
    }

    async function handleToggleOffline(studentId: string, currentlySubmitted: boolean) {
        setToggling(studentId);
        try {
            await api.patch(`/teacher/tasks/assignments/${assignmentId}/submissions/${studentId}/offline`, { submitted: !currentlySubmitted });
            toast.success(!currentlySubmitted ? 'Marked as received offline' : 'Offline mark removed');
            const res = await api.get(`/teacher/tasks/assignments/${assignmentId}/submissions`);
            setData(res.data.data as AssignmentSubmissionsData);
        } catch { toast.error('Failed to update offline status'); }
        finally { setToggling(null); }
    }

    // Independent manual "late" toggle for offline copies — doesn't touch
    // received status at all, just flags whether it should show a Late tag
    // alongside Submitted once received.
    async function handleToggleLate(studentId: string, currentlyLate: boolean) {
        setToggling(studentId);
        try {
            await api.patch(`/teacher/tasks/assignments/${assignmentId}/submissions/${studentId}/offline-late`, { late: !currentlyLate });
            toast.success(!currentlyLate ? 'Marked as late' : 'Late mark removed');
            const res = await api.get(`/teacher/tasks/assignments/${assignmentId}/submissions`);
            setData(res.data.data as AssignmentSubmissionsData);
        } catch { toast.error('Failed to update late status'); }
        finally { setToggling(null); }
    }

    const submittedOnline = data?.students.filter(s => s.submission?.submittedAt).length ?? 0;
    const submittedOffline = data?.students.filter(s => s.submission?.offlineSubmittedAt).length ?? 0;
    const total = data?.students.length ?? 0;
    const isOnline = data?.assignment.submissionType === 'ONLINE';
    const submittedCount = isOnline ? submittedOnline : submittedOffline;
    const pendingCount = total - submittedCount;
    const correctCount = data?.students.filter(s => s.submission?.reviewStatus === 'CORRECT').length ?? 0;
    const isAssignmentOverdue = !!data && !!data.assignment.dueDate && new Date(data.assignment.dueDate) < new Date();

    return (
        <motion.div
            className="absolute inset-0 z-50 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <motion.div
                className="relative ml-auto w-full max-w-6xl h-full bg-card border-l border-border flex flex-col shadow-2xl"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-3 border-b border-border shrink-0 bg-card">
                    <div className="shrink-0">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
                            <FileText size={11} /> Submissions
                        </p>
                        <h2 className="font-semibold text-sm">{data?.assignment.title ?? '—'}</h2>
                        {data && <p className="text-xs text-muted-foreground">{data.assignment.submissionType === 'ONLINE' ? '📤 Online' : '📝 Offline'} · {data.assignment.totalMarks} marks</p>}
                    </div>

                    {data && total > 0 && (
                        <div className="flex items-center gap-3 flex-1 justify-center">
                            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-background px-3.5 py-2" data-dashboard-surface="">
                                <span className="text-base font-bold leading-none">{submittedCount}</span>
                                <span className="text-xs text-muted-foreground">Submitted</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-background px-3.5 py-2" data-dashboard-surface="">
                                <span className={`text-base font-bold leading-none ${isAssignmentOverdue && isOnline ? 'text-red-500' : 'text-amber-500'}`}>{pendingCount}</span>
                                <span className="text-xs text-muted-foreground">Pending</span>
                            </div>
                            {isOnline && (
                                <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-background px-3.5 py-2" data-dashboard-surface="">
                                    <span className="text-base font-bold leading-none text-emerald-500">{correctCount}</span>
                                    <span className="text-xs text-muted-foreground">Reviewed</span>
                                </div>
                            )}
                            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-background px-3.5 py-2" data-dashboard-surface="">
                                <span className="text-base font-bold leading-none">{total}</span>
                                <span className="text-xs text-muted-foreground">Total</span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col overflow-hidden pl-3 pr-1.5 pb-4 pt-2.5 bg-background">
                    {loading ? (
                        <div className="flex items-center justify-center h-full"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
                    ) : !data || data.students.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                            <FileText size={36} className="text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No students in this class yet.</p>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-border bg-card" data-dashboard-surface="">
                            <table className="w-full text-xs border-separate border-spacing-0">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-muted shadow-[inset_0_-1px_0_0_var(--border)]">
                                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Roll No</th>
                                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Name</th>
                                        <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Status</th>
                                        {isOnline && <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Online Submission</th>}
                                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Offline Copy</th>
                                        {/* Manual "Mark Late" only makes sense for offline copies — an online
                                            assignment already derives its own Late status automatically from
                                            dueDate vs submittedAt (see lateSubmission below), so this column
                                            doesn't apply there. */}
                                        {!isOnline && <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground bg-muted">Late</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.students.map(({ student, submission, attempts }) => {
                                        const isOnlineAssignment = data.assignment.submissionType === 'ONLINE';
                                        const hasOnline = !!submission?.submittedAt;
                                        const hasOffline = !!submission?.offlineSubmittedAt;
                                        const reviewStatus = submission?.reviewStatus;
                                        const rowBorder = 'border-b border-black/10 dark:border-white/10';
                                        // Submissions stay open past the due date, so a CORRECT (approved) review
                                        // whose submittedAt landed after dueDate is flagged Late instead of Submitted.
                                        const lateSubmission = isOnlineAssignment && !!(attempts[0]?.submittedAt ?? submission?.submittedAt) && !!data.assignment.dueDate &&
                                            new Date(attempts[0]?.submittedAt ?? submission!.submittedAt!) > new Date(data.assignment.dueDate);

                                        return (
                                            <tr key={student.id} className="bg-card align-top">
                                                <td className={`px-4 py-2.5 font-mono text-muted-foreground ${rowBorder}`}>{student.rollNo ?? '—'}</td>
                                                <td className={`px-4 py-2.5 font-medium ${rowBorder}`}>{student.name ?? '—'}</td>
                                                <td className={`px-4 py-2.5 text-center ${rowBorder}`}>
                                                    {reviewStatus === 'CORRECT' && lateSubmission ? (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">⚠️ Late</span>
                                                    ) : reviewStatus === 'CORRECT' || (!isOnlineAssignment && hasOffline) ? (
                                                        <div className="flex items-center justify-center gap-1 flex-wrap">
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">✅ Submitted</span>
                                                            {!isOnlineAssignment && submission?.offlineMarkedLate && (
                                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">⚠️ Late</span>
                                                            )}
                                                        </div>
                                                    ) : reviewStatus === 'WRITE_AGAIN' ? (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">✍️ Write Again</span>
                                                    ) : hasOnline ? (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">👀 In Review</span>
                                                    ) : isOnlineAssignment && data.assignment.status !== 'ACTIVE' ? (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">❌ Missed</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">⏳ Pending</span>
                                                    )}
                                                </td>

                                                {isOnline && (
                                                    <td className={`px-4 py-3 ${rowBorder}`}>
                                                        {isOnlineAssignment && hasOnline ? (
                                                            <div className="min-w-[220px] max-w-[300px] space-y-2">
                                                                {/* Latest submission */}
                                                                <div className="flex items-center justify-between gap-2 w-full">
                                                                    <div className="min-w-0 flex-1 truncate">
                                                                        <p className="text-muted-foreground truncate">
                                                                            {(() => {
                                                                                const attemptNo = attempts[0]?.attemptNumber ?? 1;
                                                                                return attemptNo > 1 ? `Submission #${attemptNo} · ` : `Submission · `;
                                                                            })()}
                                                                            {new Date(submission!.submittedAt!).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                                        </p>
                                                                    </div>
                                                                    {submission?.fileUrl && (
                                                                        <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer"
                                                                            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg transition-all whitespace-nowrap">
                                                                            <FileText size={11} /> View PDF
                                                                        </a>
                                                                    )}
                                                                </div>

                                                                {(attempts[0]?.reviewStatus === 'CORRECT' || attempts[0]?.reviewStatus === 'WRITE_AGAIN') && (
                                                                    <div className="-mt-1.5">
                                                                        <span className={`inline-block mb-1 text-[9px] font-bold px-1 py-0.5 rounded ${attempts[0].reviewStatus === 'CORRECT' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-red-600 dark:text-red-400 bg-red-500/10'}`}>
                                                                            {attempts[0].reviewStatus === 'CORRECT' ? 'Approved' : 'Write Again'}
                                                                        </span>
                                                                        {attempts[0].reviewNote && (
                                                                            <p className="text-foreground/80 italic">{attempts[0].reviewNote}</p>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Review actions — only while awaiting a first review; once the
                                                                    teacher has approved or sent it back, this stays hidden until
                                                                    the student resubmits (resets reviewStatus to null). */}
                                                                {!reviewStatus && (
                                                                    <div className="space-y-1.5 rounded-lg bg-muted/40 p-2">
                                                                        {confirmReview?.studentId === student.id ? (
                                                                            <div className="space-y-1.5">
                                                                                <p className="text-[10px] text-muted-foreground">
                                                                                    {confirmReview.status === 'CORRECT' ? 'Approve this submission?' : 'Ask the student to write again?'}
                                                                                </p>
                                                                                <div className="flex gap-1.5">
                                                                                    <button
                                                                                        onClick={() => setConfirmReview(null)}
                                                                                        className="flex-1 text-[11px] py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                                                                        Cancel
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleReview(student.id, confirmReview.status)}
                                                                                        disabled={!!reviewing}
                                                                                        className={`flex-1 text-[11px] py-1 rounded-lg font-semibold disabled:opacity-50 transition-all ${
                                                                                            confirmReview.status === 'CORRECT'
                                                                                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                                                                : 'bg-red-500 text-white hover:bg-red-600'
                                                                                        }`}>
                                                                                        {reviewing === student.id + confirmReview.status ? '…' : 'Confirm'}
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <input
                                                                                    value={reviewNote}
                                                                                    onChange={e => setReviewNote(e.target.value)}
                                                                                    placeholder="Optional feedback note…"
                                                                                    className="w-full text-xs rounded-lg border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40"
                                                                                />
                                                                                <div className="flex gap-1.5">
                                                                                    <button
                                                                                        onClick={() => setConfirmReview({ studentId: student.id, status: 'CORRECT' })}
                                                                                        disabled={!!reviewing}
                                                                                        className="flex-1 text-[11px] py-1 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-all">
                                                                                        ✓ Approve
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => setConfirmReview({ studentId: student.id, status: 'WRITE_AGAIN' })}
                                                                                        disabled={!!reviewing}
                                                                                        className="flex-1 text-[11px] py-1 rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 font-semibold hover:bg-red-500/20 disabled:opacity-50 transition-all">
                                                                                        ↩ Write Again
                                                                                    </button>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Earlier submissions — collapsed by default so the row stays
                                                                    tidy; resubmitting never erases the previous upload, it just
                                                                    moves it in here. */}
                                                                {attempts.length > 1 && (
                                                                    <div className="pt-1 border-t border-border/60">
                                                                        <button
                                                                            onClick={() => setHistoryOpenFor(prev => {
                                                                                const next = new Set(prev);
                                                                                if (next.has(student.id)) next.delete(student.id); else next.add(student.id);
                                                                                return next;
                                                                            })}
                                                                            className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all pt-1">
                                                                            {historyOpenFor.has(student.id) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                                                            {attempts.length - 1} earlier submission{attempts.length - 1 > 1 ? 's' : ''}
                                                                        </button>
                                                                        {historyOpenFor.has(student.id) && (
                                                                            <div className="mt-1.5 space-y-1.5 w-full">
                                                                                {attempts.slice(1).map(at => (
                                                                                    <div key={at.id} className="rounded-lg bg-muted/30 px-2 py-1.5 w-full">
                                                                                        <div className="flex items-center justify-between gap-2">
                                                                                            <div className="min-w-0 flex-1 truncate">
                                                                                                <p className="text-muted-foreground truncate">#{at.attemptNumber} · {new Date(at.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                                                                                {at.reviewStatus === 'CORRECT' && (
                                                                                                    <span className="inline-block mt-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">Approved</span>
                                                                                                )}
                                                                                                {at.reviewStatus === 'WRITE_AGAIN' && (
                                                                                                    <span className="inline-block mt-0.5 text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-1 py-0.5 rounded">Write Again</span>
                                                                                                )}
                                                                                            </div>
                                                                                            {at.fileUrl && (
                                                                                                <a href={at.fileUrl} target="_blank" rel="noopener noreferrer"
                                                                                                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg transition-all whitespace-nowrap">
                                                                                                    <FileText size={11} /> View PDF
                                                                                                </a>
                                                                                            )}
                                                                                        </div>
                                                                                        {at.reviewNote && (
                                                                                            <p className="mt-1 text-foreground/80 italic">{at.reviewNote}</p>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground/50">—</span>
                                                        )}
                                                    </td>
                                                )}

                                                <td className={`px-4 py-2.5 ${rowBorder}`}>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-muted-foreground whitespace-nowrap">
                                                            {hasOffline
                                                                ? `Received ${new Date(submission!.offlineSubmittedAt!).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                                                                : 'Not received'}
                                                        </span>
                                                        <button
                                                            onClick={() => handleToggleOffline(student.id, hasOffline)}
                                                            disabled={toggling === student.id}
                                                            className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all disabled:opacity-50 ${
                                                                hasOffline
                                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                                                                    : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
                                                            }`}>
                                                            {toggling === student.id ? '…' : hasOffline ? '✓ Received' : 'Mark Received'}
                                                        </button>
                                                    </div>
                                                </td>

                                                {!isOnlineAssignment && (
                                                    <td className={`px-4 py-2.5 text-center ${rowBorder}`}>
                                                        <button
                                                            onClick={() => handleToggleLate(student.id, !!submission?.offlineMarkedLate)}
                                                            disabled={toggling === student.id}
                                                            className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all disabled:opacity-50 ${
                                                                submission?.offlineMarkedLate
                                                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/20'
                                                                    : 'bg-transparent text-muted-foreground border border-border hover:bg-muted'
                                                            }`}>
                                                            {toggling === student.id ? '…' : submission?.offlineMarkedLate ? '⚠️ Late' : 'Mark Late'}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Test Card ─────────────────────────────────────────────────────────────────

function TestCard({ test, onOpen, onCopyLink, onDelete, onActivate, onStopNow, onResults, copiedLink }: {
    test: Test;
    onOpen: () => void;
    onCopyLink: () => void;
    onDelete: () => void;
    onActivate: (startNow: boolean) => void;
    onStopNow: () => void;
    onResults: () => void;
    copiedLink: string | null;
}) {
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [activateConfirm, setActivateConfirm] = useState(false);
    const [activateMenuOpen, setActivateMenuOpen] = useState(false);
    const [activateStartNow, setActivateStartNow] = useState(true);
    const [stopConfirm, setStopConfirm] = useState(false);
    const effectiveStatus = (test.validUntil && new Date(test.validUntil) < new Date()) ? 'COMPLETED' : test.status;
    // Activated via "Start at set time" but that time hasn't arrived yet — link isn't live
    // for students, so the badge/labels should read "Upcoming" rather than "Active" even
    // though the backend status is already ACTIVE. Flips to "Active" on its own once the
    // Start Date passes (same derived-on-render pattern as the validUntil → COMPLETED check).
    const isUpcoming = effectiveStatus === 'ACTIVE' && !!test.startDate && new Date(test.startDate) > new Date();
    const displayStatus = isUpcoming ? 'UPCOMING' : effectiveStatus;
    const statusColor = {
        DRAFT: 'text-muted-foreground bg-muted',
        UPCOMING: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950',
        ACTIVE: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950',
        COMPLETED: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950',
    }[displayStatus];

    return (
        <div className="group rounded-xl border border-border bg-card px-6 py-5 flex flex-col gap-4 min-h-[130px]" data-dashboard-surface="">
            {/* Top row: content + icons */}
            <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${statusColor}`}>{displayStatus}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><BookOpen size={12} />{test.numberOfQuestions} questions</span>
                        <span className="text-muted-foreground opacity-40">·</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users size={12} />{test._count.attempts} attempts</span>
                        <span className="text-muted-foreground opacity-40">·</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 size={12} />{test._count.submitted ?? 0} submitted</span>
                    </div>
                    <h3 className="font-semibold text-base truncate mb-1.5">{test.title}</h3>
                    {test.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{test.description}</p>
                    )}
                </div>
                {/* Top-right icons: copy + delete */}
                <div className="flex items-start gap-1 shrink-0">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap self-start mt-1 mr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-foreground/50">Created at:</span> {test.createdAt ? `${new Date(test.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(test.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—'}
                    </span>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={12} />{test.durationMinutes} min</span>
                    <span className="opacity-40">·</span>
                    <span>{test.totalMarks} marks</span>
                    <span className="opacity-40">|</span>
                    <span><span className="text-foreground/50">{(displayStatus === 'DRAFT' || displayStatus === 'UPCOMING') ? 'Starts at:' : 'Started at:'}</span> {test.startDate ? `${new Date(test.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(test.startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—'}</span>
                    <span className="opacity-40">·</span>
                    <span><span className="text-foreground/50">{effectiveStatus === 'COMPLETED' ? 'Ended at:' : 'Ends at:'}</span> {test.validUntil ? `${new Date(test.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ${new Date(test.validUntil).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                    {effectiveStatus === 'DRAFT' && (
                        <div className="relative">
                            <button onClick={() => setActivateMenuOpen(true)} disabled={test.numberOfQuestions === 0 || !test.validUntil}
                                title={test.numberOfQuestions === 0 ? 'Add at least one question before activating' : !test.validUntil ? 'Set a Valid Until date before activating' : undefined}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10">
                                <Play size={12} /> Activate
                            </button>
                            <AnimatePresence>
                                {activateMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-20" onClick={() => setActivateMenuOpen(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                            className="absolute right-0 bottom-9 z-30 bg-card border border-border rounded-xl shadow-xl p-1.5 w-64 flex flex-col gap-0.5">
                                            <button onClick={() => {
                                                    if (!test.startDate) { toast.error('Set a Start Date first to use this option'); return; }
                                                    setActivateMenuOpen(false); setActivateStartNow(false); setActivateConfirm(true);
                                                }}
                                                className="text-left px-3 py-2 rounded-lg text-xs hover:bg-muted transition-all">
                                                <span className="font-medium text-foreground">Start at set time</span>
                                                <span className="block text-[11px] text-muted-foreground">
                                                    {test.startDate
                                                        ? `${new Date(test.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${new Date(test.startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
                                                        : 'Set a Start Date first'}
                                                </span>
                                            </button>
                                            <button onClick={() => { setActivateMenuOpen(false); setActivateStartNow(true); setActivateConfirm(true); }}
                                                className="text-left px-3 py-2 rounded-lg text-xs hover:bg-muted transition-all">
                                                <span className="font-medium text-foreground">Start now</span>
                                                <span className="block text-[11px] text-muted-foreground">Goes live immediately</span>
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                            <AnimatePresence>
                                {activateConfirm && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                        className="absolute right-0 bottom-9 z-30 bg-card border border-border rounded-xl shadow-xl p-3 w-64 flex flex-col gap-2">
                                        <p className="text-xs font-semibold text-foreground">Activate this test?</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {activateStartNow
                                                ? "The link goes live immediately and the Start Date locks to right now. This can't be undone."
                                                : `Students will see it as "Upcoming" until ${new Date(test.startDate!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${new Date(test.startDate!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} — it'll go live on its own at that time, no need to activate it again.`}
                                        </p>
                                        <div className="flex gap-1.5 justify-end">
                                            <button onClick={() => setActivateConfirm(false)}
                                                className="px-2.5 py-1 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                                Cancel
                                            </button>
                                            <button onClick={() => { setActivateConfirm(false); onActivate(activateStartNow); }}
                                                className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-all">
                                                Activate
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                    {displayStatus === 'ACTIVE' && (
                        <div className="relative">
                            <button onClick={() => setStopConfirm(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all">
                                <Square size={11} /> Stop Now
                            </button>
                            <AnimatePresence>
                                {stopConfirm && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                        className="absolute left-0 bottom-9 z-30 bg-card border border-border rounded-xl shadow-xl p-3 w-64 flex flex-col gap-2">
                                        <p className="text-xs font-semibold text-foreground">Stop this test now?</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            The test will end immediately. This can't be undone.
                                        </p>
                                        <div className="flex gap-1.5 justify-end">
                                            <button onClick={() => setStopConfirm(false)}
                                                className="px-2.5 py-1 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                                Cancel
                                            </button>
                                            <button onClick={() => { setStopConfirm(false); onStopNow(); }}
                                                className="px-2.5 py-1 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                                Stop Now
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                    {effectiveStatus === 'ACTIVE' && (
                        <button title="Sends students a fresh notification about this test - use it if some of them missed the first one"
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                            <ArrowRight size={12} /> Resend
                        </button>
                    )}
                    <button onClick={onOpen} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all flex items-center gap-1.5">
                        <Eye size={12} /> Open & Edit
                    </button>
                    <button onClick={onResults} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all flex items-center gap-1.5">
                        <BarChart2 size={12} /> Results
                    </button>
                </div>
            </div>
        </div>
    );
}

// Convert a UTC ISO string to the local-time format required by datetime-local inputs.
// toISOString() always returns UTC, but datetime-local needs local wall-clock time.
function toLocalDatetimeInput(utcIso: string): string {
    const d = new Date(utcIso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const draftAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [paperZoom, setPaperZoom] = useState(1);
    const [mainTop, setMainTop] = useState(0);
    // Full-screen zoom for question images shown in the module question
    // picker below — same treatment as the Modules panel / profile photo zoom.
    const [expandedImage, setExpandedImage] = useState<string | null>(null);

    useLayoutEffect(() => {
        if (!isFullscreen) return;
        const main = document.querySelector('main');
        if (main) setMainTop(main.getBoundingClientRect().top);
    }, [isFullscreen]);

    // Metadata
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [subjectName, setSubjectName] = useState('');
    const [paperType, setPaperType] = useState<'TEST' | 'ASSIGNMENT'>(lockedPaperType);
    const [durationMinutes, setDurationMinutes] = useState(60);
    // Free-typing buffer for the duration input — lets the box go fully empty while
    // editing instead of snapping to "0" (which used to leave a stuck leading zero,
    // e.g. typing "45" over a cleared box became "045").
    const [durationDraft, setDurationDraft] = useState<string | null>(null);
    // Same free-typing-buffer trick as durationDraft, but keyed per question —
    // assignment marks boxes had the same "stuck leading zero" bug (typing over
    // a cleared "0" box became "05" etc since value was bound straight to the number).
    const [marksDraft, setMarksDraft] = useState<Record<string, string>>({});
    // Same fix, for TEST sections' "m each" (marksPerQuestion) box — keyed per section.
    const [mpqDraft, setMpqDraft] = useState<Record<string, string>>({});
    const [maxAttempts, setMaxAttempts] = useState(1);
    const [startDate, setStartDate] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [dueDate, setDueDate] = useState(''); // assignments only
    const [submissionType, setSubmissionType] = useState<'OFFLINE' | 'ONLINE'>('OFFLINE'); // assignments only
    // Letterhead — printed on every page of an assignment paper, pulled from
    // the institution's own logo/address (set once in Admin > Settings), not
    // anything the teacher configures per-assignment.
    const [letterhead, setLetterhead] = useState<{ name: string; logoUrl: string | null; address: string | null; city: string | null; state: string | null; pincode: string | null } | null>(null);
    useEffect(() => {
        if (entityType !== 'assignment') return;
        api.get('/teacher/institution/letterhead').then(res => setLetterhead(res.data.data)).catch(() => {});
    }, [entityType]);
    const [isRandomized, setIsRandomized] = useState(false);
    const [answerSpace, setAnswerSpace] = useState(true);

    // Builder state
    const [sections, setSections] = useState<PaperSection[]>([]);
    const [builderQs, setBuilderQs] = useState<BuilderQuestion[]>([]);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

    // Left panel filters
    const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
    const [expandedQIds, setExpandedQIds] = useState<Set<string>>(new Set());
    const [deleteSectionConfirmId, setDeleteSectionConfirmId] = useState<string | null>(null);
    const [dragQId, setDragQId] = useState<string | null>(null);
    const [dragOverQId, setDragOverQId] = useState<string | null>(null);
    const [removeQConfirm, setRemoveQConfirm] = useState<{ questionId: string; questionText: string } | null>(null);
    const [pageGroups, setPageGroups] = useState<string[][] | null>(null);
    // Once a test has been activated, its Start Date is locked to the real activation
    // moment and can no longer be hand-edited.
    const [isActivated, setIsActivated] = useState(false);
    // Distinct from isActivated (which is also true for a plain ACTIVE test) — this
    // specifically means the test has ended (either its Valid Until passed, or the
    // teacher hit Stop Now), at which point Valid Until shouldn't be editable anymore.
    const [isCompleted, setIsCompleted] = useState(false);
    const [activateConfirm, setActivateConfirm] = useState(false);
    const [activateMenuOpen, setActivateMenuOpen] = useState(false);
    const [activateStartNow, setActivateStartNow] = useState(true);
    const pageBlockElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const testFlowBlocksRef = useRef<FlowBlock[]>([]);

    useEffect(() => {
        const loadUrl = entityType === 'assignment'
            ? `/teacher/tasks/assignments/${testId}`
            : `/teacher/tasks/tests/${testId}`;
        api.get(loadUrl)
            .then(res => {
                const t: TestDetail = res.data.data;
                setTitle(t.title);
                setDescription(t.description ?? '');
                setSubjectName(t.subject?.name ?? '');
                setPaperType((t.paperType ?? 'TEST') as 'TEST' | 'ASSIGNMENT');
                setDurationMinutes(t.durationMinutes);
                setMaxAttempts(t.maxAttempts);
                setStartDate(t.startDate ? toLocalDatetimeInput(t.startDate) : '');
                setValidUntil(t.validUntil ? toLocalDatetimeInput(t.validUntil) : '');
                setDueDate(t.dueDate ? toLocalDatetimeInput(t.dueDate) : '');
                setSubmissionType(t.submissionType ?? 'OFFLINE');
                setIsActivated(t.status === 'ACTIVE' || t.status === 'COMPLETED');
                setIsCompleted(t.status === 'COMPLETED');
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
        if (isLocked) return;
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

    const moveSection = (sectionId: string, direction: 'up' | 'down') => {
        if (isLocked) return;
        setSections(prev => {
            const idx = prev.findIndex(s => s.id === sectionId);
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
            return next;
        });
    };

    const removeSection = (sectionId: string) => {
        if (isLocked) return;
        setBuilderQs(prev => prev.filter(q => q.sectionId !== sectionId).map((q, i) => ({ ...q, order: i })));
        setSections(prev => {
            const next = prev.filter(s => s.id !== sectionId);
            if (activeSectionId === sectionId) setActiveSectionId(next[0]?.id ?? null);
            return next;
        });
    };

    const addQuestionToBuilder = (question: Question) => {
        if (isLocked) return;
        if (builderQs.find(q => q.questionId === question.id)) {
            toast.info('Already in paper');
            return;
        }
        const sectionId = activeSectionId ?? null;
        const section = sections.find(s => s.id === sectionId);
        setBuilderQs(prev => [...prev, {
            questionId: question.id,
            sectionId,
            // ASSIGNMENT questions keep their own per-question marks even inside a
            // section (assignments don't have the TEST-only "marks per question"
            // concept) — only TEST questions inherit the section's marksPerQuestion.
            marks: paperType === 'TEST' && section ? section.marksPerQuestion : 1,
            order: prev.length,
            // TEST questions default to Optional so "Show N" works out of the box
            // (only questions explicitly marked Compulsory always survive the trim).
            // ASSIGNMENT questions keep the old default since they don't use Show.
            isCompulsory: paperType !== 'TEST',
            question,
        }]);
    };

    const removeQuestion = (questionId: string) => {
        if (isLocked) return;
        setBuilderQs(prev => prev.filter(q => q.questionId !== questionId).map((q, i) => ({ ...q, order: i })));
    };

    const moveQuestion = (questionId: string, direction: 'up' | 'down', sectionId: string | null) => {
        if (isLocked) return;
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

    const handleQDragStart = (id: string) => { if (isLocked) return; setDragQId(id); };
    const handleQDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); if (id !== dragQId) setDragOverQId(id); };
    const handleQDrop = (targetId: string, sectionId: string | null) => {
        if (isLocked) { setDragQId(null); setDragOverQId(null); return; }
        if (!dragQId || dragQId === targetId) { setDragQId(null); setDragOverQId(null); return; }
        setBuilderQs(prev => {
            const pool = prev.filter(q => q.sectionId === sectionId);
            const others = prev.filter(q => q.sectionId !== sectionId);
            const fromIdx = pool.findIndex(q => q.questionId === dragQId);
            const toIdx = pool.findIndex(q => q.questionId === targetId);
            if (fromIdx === -1 || toIdx === -1) return prev;
            const newPool = [...pool];
            const [item] = newPool.splice(fromIdx, 1);
            newPool.splice(toIdx, 0, item);
            return [...others, ...newPool].map((q, i) => ({ ...q, order: i }));
        });
        setDragQId(null);
        setDragOverQId(null);
    };
    const handleQDragEnd = () => { setDragQId(null); setDragOverQId(null); };

    // `startNow` only matters when activating: true locks Start Date to right now (test
    // goes live immediately); false leaves whatever Start Date is already set untouched,
    // so the test stays "Upcoming" for students until that scheduled moment arrives.
    const savePaper = async (activate = false, silent = false, startNow = true) => {
        if (isCompleted && !activate) { if (!silent) toast.error('Test is completed - it can no longer be edited'); return; }
        if (!title.trim()) { if (!silent) toast.error('Title is required'); return; }
        if (startDate && validUntil && new Date(validUntil) <= new Date(startDate)) {
            if (!silent) toast.error('Valid Until must be after the Start Date');
            return;
        }
        if (silent) setDraftSaveStatus('saving'); else setSaving(true);
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
                    totalMarks,
                    dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                });
                if (activate) {
                    await api.patch(`/teacher/tasks/assignments/${testId}`, { status: 'ACTIVE' });
                }
            } else {
                // "Start now" locks in the real moment the test goes live as the Start Date,
                // overriding whatever was pre-set in the picker. "Start at set time" leaves
                // the picker's value exactly as-is — the test becomes ACTIVE but stays
                // "Upcoming" (no Start button) for students until that scheduled time arrives.
                const effectiveStartDateIso = (activate && startNow) ? new Date().toISOString() : (startDate ? new Date(startDate).toISOString() : null);
                await api.put(`/teacher/tasks/tests/${testId}/paper`, {
                    title,
                    description: description || null,
                    paperType,
                    durationMinutes,
                    maxAttempts,
                    startDate: effectiveStartDateIso,
                    validUntil: validUntil ? new Date(validUntil).toISOString() : null,
                    isRandomized,
                    answerSpace,
                    sections: paperType === 'TEST' ? sections : [],
                    questions: questionPayload,
                    totalMarks,
                });
                if (activate) {
                    await api.patch(`/teacher/tasks/tests/${testId}`, { status: 'ACTIVE' });
                    if (effectiveStartDateIso) setStartDate(toLocalDatetimeInput(effectiveStartDateIso));
                    setIsActivated(true);
                }
            }
            if (!activate) {
                // Draft saves (auto or manual) just update the status indicator — they
                // must never close the builder overlay, only "Save & Activate" should.
                setDraftSaveStatus('saved');
                setTimeout(() => setDraftSaveStatus('idle'), 2000);
                if (!silent) toast.success('Paper saved');
            } else {
                toast.success(entityType === 'test' && !startNow ? 'Paper saved — will go live at the set Start Date' : 'Paper saved and activated');
                onSaved();
            }
        } catch (err) {
            if (activate) toast.error(apiError(err));
            else { setDraftSaveStatus('idle'); if (!silent) toast.error(apiError(err)); }
        } finally {
            if (!silent) setSaving(false);
        }
    };

    // Auto-save the draft 2s after the teacher stops editing — same debounce pattern
    // used for Attendance/Fees, so there's no need to click "Save Draft" manually.
    useEffect(() => {
        if (loading || !title.trim()) return;
        if (draftAutoSaveTimer.current) clearTimeout(draftAutoSaveTimer.current);
        draftAutoSaveTimer.current = setTimeout(() => { savePaper(false, true); }, 2000);
        return () => { if (draftAutoSaveTimer.current) clearTimeout(draftAutoSaveTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, description, durationMinutes, maxAttempts, startDate, validUntil, dueDate, isRandomized, answerSpace, sections, builderQs]);

    const addedIds = new Set(builderQs.map(q => q.questionId));
    const totalMarks = paperType === 'TEST'
        ? sections.reduce((sum, s) => {
            const sQs = builderQs.filter(q => q.sectionId === s.id).length;
            const attemptN = s.attemptCount > 0 ? Math.min(s.attemptCount, sQs) : sQs;
            return sum + attemptN * s.marksPerQuestion;
          }, 0) + builderQs.filter(q => !q.sectionId).reduce((sum, q) => sum + q.marks, 0)
        : builderQs.reduce((sum, q) => sum + q.marks, 0);
    // Effective question count a student will actually see — sectioned
    // questions apply their own "Show N of M", not the raw count added.
    const effectiveTotalQuestions = paperType === 'TEST'
        ? sections.reduce((sum, s) => {
            const sQs = builderQs.filter(q => q.sectionId === s.id).length;
            const attemptN = s.attemptCount > 0 ? Math.min(s.attemptCount, sQs) : sQs;
            return sum + attemptN;
          }, 0) + builderQs.filter(q => !q.sectionId).length
        : builderQs.length;

    // Only lock Start Date once the test has actually gone live. If it was activated via
    // "Start at set time" and that time hasn't arrived yet, the link still isn't live —
    // the teacher can freely push it earlier/later. "Start now" always locks immediately
    // since the link is already live by definition.
    const startDateInFuture = !!startDate && new Date(startDate) > new Date();
    const startDateLocked = isActivated && !startDateInFuture;
    // True editability lock: a test that's ACTIVE but still scheduled to start later
    // (startDate in the future) hasn't actually gone live yet, so it should stay fully
    // editable like a draft/upcoming test. Only a genuinely live (started) or completed
    // test should be locked down.
    const isLocked = isCompleted || (isActivated && !startDateInFuture);

    const containerStyle = isFullscreen
        ? { position: 'fixed' as const, top: mainTop, left: 0, right: 0, bottom: 0, zIndex: 60 }
        : { position: 'absolute' as const, inset: 0, zIndex: 50 };

    // ── A4 pagination (both TEST and ASSIGNMENT papers) ─────────────────────────
    // CSS spec fixes 1in = 96px, so mm→px is an exact conversion (not an approximation).
    const MM_TO_PX = 96 / 25.4;
    const PAGE_HEIGHT_PX = 297 * MM_TO_PX;
    const PAGE_CHROME_PX = 11 + 11; // top decorative bars (6+3+2) + bottom bars (2+3+6)
    const PAGE_PADDING_Y_PX = 48; // content wrapper padding: 24px top + 24px bottom
    const PAGE_CONTENT_CAPACITY_PX = PAGE_HEIGHT_PX - PAGE_CHROME_PX - PAGE_PADDING_Y_PX;

    // Hook must be called unconditionally every render (before the `loading` early
    // return below) — it reads the latest flow-block list via a ref that's updated
    // further down in the render body, since the block list itself depends on
    // `theme`/`sections`/`builderQs`, which are only meaningful once loaded.
    useLayoutEffect(() => {
        if (loading) return;
        const heights = testFlowBlocksRef.current.map(b => {
            const el = pageBlockElRefs.current.get(b.key);
            return { key: b.key, height: el ? el.getBoundingClientRect().height : 0 };
        });
        const groups: string[][] = [];
        let current: string[] = [];
        let currentHeight = 0;
        for (const { key, height } of heights) {
            if (current.length > 0 && currentHeight + height > PAGE_CONTENT_CAPACITY_PX) {
                groups.push(current);
                current = [];
                currentHeight = 0;
            }
            current.push(key);
            currentHeight += height;
        }
        if (current.length > 0 || groups.length === 0) groups.push(current);
        setPageGroups(prev => {
            if (prev && prev.length === groups.length && prev.every((g, i) => g.length === groups[i].length && g.every((k, j) => k === groups[i][j]))) {
                return prev;
            }
            return groups;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, paperType, sections, builderQs, answerSpace, isRandomized, title, description, durationMinutes, maxAttempts, startDate, validUntil, totalMarks, activeSectionId, paperZoom]);

    if (loading) return (
        <div style={containerStyle} className="bg-background flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
    );

    // Paper color theme
    const theme = lockedPaperType === 'TEST' ? {
        // Authentic school/board exam-paper look: plain white sheet, black rules,
        // serif type, neutral grey backdrop — no decorative gold/cream card styling.
        outerBg:   '#9C9C9C', scrollbar: '#7A7A7A #9C9C9C',
        paperBg:   '#FFFFFF', paperBorder: '#1A1A1A',
        topBar1:   '#000000', topBar2: '#000000',
        headingColor: '#333333', titleColor: '#000000',
        metaColor: '#1A1A1A', accentColor: '#000000',
        sectionActiveBg: '#F2F2F2', sectionBg: '#FFFFFF', sectionBorder: '#000000', sectionBorderInactive: '#B0B0B0',
        sectionText: '#000000', sectionMeta: '#4D4D4D',
        inputBg: '#FFFFFF', inputBorder: '#8C8C8C', inputText: '#000000',
        rowBorder: '#D9D9D9', marksBadgeBg: '#FFFFFF', marksBadgeText: '#000000', marksBadgeBorder: '#8C8C8C',
        emptyBorder: '#B0B0B0', emptyText: '#8C8C8C', emptyActiveText: '#4D4D4D',
        footerBg: '#FFFFFF', footerText: '#4D4D4D',
        addSectionBorder: '#8C8C8C', addSectionText: '#4D4D4D', addSectionHoverBorder: '#000000', addSectionHoverText: '#000000',
        fontFamily: '"Times New Roman", Georgia, serif',
    } : {
        outerBg:   '#B8C8D8', scrollbar: '#8AAAC8 #B8C8D8',
        paperBg:   '#F8FBFF', paperBorder: '#A8C0DC',
        topBar1:   '#1A2F4A', topBar2: '#2563EB',
        headingColor: '#4A7AAA', titleColor: '#0D1B2A',
        metaColor: '#1E3A5F', accentColor: '#2563EB',
        sectionActiveBg: '#F0F0F0', sectionBg: '#F8FBFF', sectionBorder: '#4A5568', sectionBorderInactive: '#CBD5E0',
        sectionText: '#0D1B2A', sectionMeta: '#4A7AAA',
        inputBg: '#F0F6FE', inputBorder: '#A8C0DC', inputText: '#0D1B2A',
        rowBorder: '#DDEAFB', marksBadgeBg: '#DDEAFB', marksBadgeText: '#1E3A5F', marksBadgeBorder: '#A8C0DC',
        emptyBorder: '#A8C0DC', emptyText: '#7AAAC8', emptyActiveText: '#2563EB',
        footerBg: '#F0F6FE', footerText: '#4A7AAA',
        addSectionBorder: '#A8C0DC', addSectionText: '#4A7AAA', addSectionHoverBorder: '#2563EB', addSectionHoverText: '#2563EB',
        fontFamily: 'inherit',
    };

    const testFlowBlocks: FlowBlock[] = [];
    testFlowBlocks.push({ key: 'header', kind: 'header' });
    if (paperType === 'TEST') {
        let qNum = 0;
        sections.forEach((section, si) => {
            if (si > 0) testFlowBlocks.push({ key: `spacer-${section.id}`, kind: 'spacer', height: 24 });
            testFlowBlocks.push({ key: `sh-${section.id}`, kind: 'sectionHeader', section });
            const sectionQs = builderQs.filter(q => q.sectionId === section.id);
            if (sectionQs.length === 0) {
                testFlowBlocks.push({ key: `se-${section.id}`, kind: 'sectionEmpty', section });
            } else {
                sectionQs.forEach(bq => {
                    qNum++;
                    testFlowBlocks.push({ key: `q-${bq.questionId}`, kind: 'question', section, bq, num: qNum });
                });
            }
        });
    } else if (sections.length === 0) {
        testFlowBlocks.push({ key: 'assign-qh', kind: 'assignmentQuestionsHeader' });
        if (builderQs.length === 0) {
            testFlowBlocks.push({ key: 'assign-empty', kind: 'assignmentEmpty' });
        } else {
            builderQs.forEach((bq, qi) => {
                testFlowBlocks.push({ key: `aq-${bq.questionId}`, kind: 'assignmentQuestion', bq, num: qi + 1 });
            });
        }
    } else {
        // ASSIGNMENT with sections — same sectionHeader/sectionEmpty blocks as
        // TEST, but questions render via 'assignmentQuestion' (no C/O toggle,
        // no Show/marksPerQuestion — marks stay per-question).
        let qNum = 0;
        sections.forEach((section, si) => {
            if (si > 0) testFlowBlocks.push({ key: `spacer-${section.id}`, kind: 'spacer', height: 24 });
            testFlowBlocks.push({ key: `sh-${section.id}`, kind: 'sectionHeader', section });
            const sectionQs = builderQs.filter(q => q.sectionId === section.id);
            if (sectionQs.length === 0) {
                testFlowBlocks.push({ key: `se-${section.id}`, kind: 'sectionEmpty', section });
            } else {
                sectionQs.forEach(bq => {
                    qNum++;
                    testFlowBlocks.push({ key: `aq-${bq.questionId}`, kind: 'assignmentQuestion', bq, num: qNum });
                });
            }
        });
        // Questions not (yet) placed in any section — shown under a plain
        // "Questions" header so nothing added before the first section was
        // created silently disappears from the paper.
        const unsectioned = builderQs.filter(q => !q.sectionId || !sections.some(s => s.id === q.sectionId));
        if (unsectioned.length > 0) {
            testFlowBlocks.push({ key: 'spacer-unsectioned', kind: 'spacer', height: 24 });
            testFlowBlocks.push({ key: 'assign-qh', kind: 'assignmentQuestionsHeader' });
            unsectioned.forEach(bq => {
                qNum++;
                testFlowBlocks.push({ key: `aq-${bq.questionId}`, kind: 'assignmentQuestion', bq, num: qNum });
            });
        }
    }
    testFlowBlocks.push({ key: 'spacer-footer', kind: 'spacer', height: 16 });
    testFlowBlocks.push({ key: 'footer', kind: 'footer' });
    testFlowBlocksRef.current = testFlowBlocks;
    const testBlocksByKey = new Map(testFlowBlocks.map(b => [b.key, b] as const));

    const renderFlowBlock = (block: FlowBlock) => {
        switch (block.kind) {
            case 'header':
                return (
                    <div style={{ borderBottom: `1.5px solid ${theme.paperBorder}`, paddingBottom: 6, marginBottom: 8 }}>
                        <div className="text-center mb-1">
                            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={entityType === 'assignment' ? 'Assignment Title' : 'Paper Title'}
                                className="text-center text-xl font-bold w-full focus:outline-none bg-transparent"
                                style={{ color: theme.titleColor, borderBottom: `1px dashed ${theme.paperBorder}`, paddingBottom: 2 }} />
                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description / instructions for students (optional)"
                                rows={2} className="w-full text-center text-xs mt-2 resize-none focus:outline-none bg-transparent"
                                style={{ color: theme.sectionMeta, borderBottom: `1px dashed ${theme.rowBorder}` }} />
                        </div>
                        <div className="flex items-center justify-between text-[13px] mt-1" style={{ color: theme.metaColor }}>
                            <div className="flex items-center gap-6">
                                {entityType === 'assignment' ? (
                                    <span>
                                        {subjectName && <><span className="font-semibold">Subject:</span> {subjectName}&nbsp;&nbsp;&nbsp;&nbsp;</>}
                                        <span className="font-semibold">Due:</span> {dueDate ? new Date(dueDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Not set'}
                                    </span>
                                ) : (
                                    <>
                                        {subjectName && <span><span className="font-semibold">Subject:</span> {subjectName}</span>}
                                        <span><span className="font-semibold">Time:</span> {durationMinutes} min</span>
                                        <span><span className="font-semibold">Max Attempts:</span> {maxAttempts}</span>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <span><span className="font-semibold">Total Questions:</span> {effectiveTotalQuestions}</span>
                                <span className="font-bold text-base" style={{ color: theme.accentColor }}>Total Marks: {totalMarks}</span>
                            </div>
                        </div>
                        {isRandomized && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: theme.headingColor }}>
                                <Shuffle size={10} /> Questions will be shuffled for each student
                            </div>
                        )}
                    </div>
                );
            case 'spacer':
                return <div style={{ height: block.height }} />;
            case 'sectionHeader': {
                const section = block.section;
                const sectionQs = builderQs.filter(q => q.sectionId === section.id);
                const isActive = activeSectionId === section.id;
                const effectiveAttempt = section.attemptCount > 0 ? Math.min(section.attemptCount, sectionQs.length) : sectionQs.length;
                const sectionTotal = effectiveAttempt * section.marksPerQuestion;
                const compulsoryCount = sectionQs.filter(q => q.isCompulsory).length;
                return (
                    <div>
                        <div className={`flex items-center gap-3 py-2 cursor-pointer mb-3 group transition-all ${paperType === 'TEST' ? '-mx-3 px-3' : ''}`}
                            style={paperType === 'TEST'
                                ? { background: isActive ? theme.sectionActiveBg : theme.sectionBg, borderLeft: `3px solid ${isActive ? theme.sectionBorder : theme.sectionBorderInactive}`, borderBottom: `1px solid ${theme.paperBorder}` }
                                : { borderBottom: `1px solid ${theme.paperBorder}` }}
                            onClick={() => setActiveSectionId(section.id)}>
                            <div className="flex-1 flex items-center gap-3">
                                <input value={section.title} onClick={e => e.stopPropagation()}
                                    onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
                                    className="text-sm font-bold uppercase tracking-wider bg-transparent focus:outline-none"
                                    style={{ color: theme.sectionText, borderBottom: `1px dashed ${theme.sectionBorderInactive}`, paddingBottom: 1 }} />
                                {sectionQs.length > 0 && paperType === 'TEST' && (
                                    <span className="text-[10px]" style={{ color: theme.sectionMeta }}>
                                        {`(${effectiveAttempt}/${sectionQs.length} × ${section.marksPerQuestion}m = ${sectionTotal} marks)`}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                {sectionQs.length > 0 && paperType !== 'TEST' && (
                                    <span className="text-[11.5px] font-semibold mr-1" style={{ color: theme.sectionMeta }}>
                                        {sectionQs.length} Q. {sectionQs.reduce((s, q) => s + q.marks, 0)} mks
                                    </span>
                                )}
                                {paperType === 'TEST' && (
                                    <>
                                        <span className="text-[12px]" style={{ color: theme.sectionMeta }}
                                            title="Randomly picks this many questions from the section for each student - leave empty to show all questions in this section">Show</span>
                                        <input type="number" min={compulsoryCount} max={sectionQs.length || 99}
                                            value={section.attemptCount === 0 ? '' : section.attemptCount}
                                            placeholder="all"
                                            onChange={e => {
                                                const val = Number(e.target.value) || 0;
                                                if (val > 0 && val < compulsoryCount) {
                                                    toast.error(`${compulsoryCount} question(s) in this section are marked Compulsory - Show can't be set below that`);
                                                    return;
                                                }
                                                setSections(prev => prev.map(s => s.id === section.id ? { ...s, attemptCount: val } : s));
                                            }}
                                            className="w-10 text-xs text-center rounded focus:outline-none"
                                            style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.inputBorder}`, padding: '1px 4px' }} />
                                        <span className="text-[10px]" style={{ color: theme.sectionMeta }}>·</span>
                                        <input type="text" inputMode="numeric"
                                            value={mpqDraft[section.id] !== undefined ? mpqDraft[section.id] : String(section.marksPerQuestion)}
                                            onFocus={e => { setMpqDraft(prev => ({ ...prev, [section.id]: String(section.marksPerQuestion) })); e.currentTarget.select(); }}
                                            onChange={e => {
                                                const digits = e.target.value.replace(/[^0-9]/g, '');
                                                setMpqDraft(prev => ({ ...prev, [section.id]: digits }));
                                                if (digits !== '') {
                                                    const mpq = Number(digits);
                                                    setSections(prev => prev.map(s => s.id === section.id ? { ...s, marksPerQuestion: mpq } : s));
                                                    setBuilderQs(prev => prev.map(q => q.sectionId === section.id ? { ...q, marks: mpq } : q));
                                                }
                                            }}
                                            onBlur={() => {
                                                const n = parseInt(mpqDraft[section.id] ?? '', 10);
                                                const mpq = !isNaN(n) ? Math.min(100, Math.max(0, n)) : section.marksPerQuestion;
                                                setSections(prev => prev.map(s => s.id === section.id ? { ...s, marksPerQuestion: mpq } : s));
                                                setBuilderQs(prev => prev.map(q => q.sectionId === section.id ? { ...q, marks: mpq } : q));
                                                setMpqDraft(prev => { const next = { ...prev }; delete next[section.id]; return next; });
                                            }}
                                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                            className="w-10 text-xs text-center rounded focus:outline-none"
                                            style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.inputBorder}`, padding: '1px 4px' }} />
                                        <span className="text-[12px]" style={{ color: theme.sectionMeta }}>m each</span>
                                    </>
                                )}
                                {sections.length > 1 && (
                                    <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={() => moveSection(section.id, 'up')} disabled={sections.findIndex(s => s.id === section.id) === 0}
                                            className="disabled:opacity-20 p-0.5" style={{ color: theme.sectionMeta }}><ArrowUp size={9} /></button>
                                        <button onClick={() => moveSection(section.id, 'down')} disabled={sections.findIndex(s => s.id === section.id) === sections.length - 1}
                                            className="disabled:opacity-20 p-0.5" style={{ color: theme.sectionMeta }}><ArrowDown size={9} /></button>
                                    </div>
                                )}
                                {sections.length > 1 && (
                                    <button onClick={e => { e.stopPropagation(); setDeleteSectionConfirmId(section.id); }}
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
                        {paperType === 'TEST' && (
                            <input value={section.instruction}
                                onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, instruction: e.target.value } : s))}
                                placeholder="Section instruction (e.g. MCQs, True or False, Numerical, etc.)"
                                className="w-full text-sm italic mb-3 focus:outline-none bg-transparent"
                                style={{ color: theme.sectionMeta, borderBottom: `1px dashed ${theme.rowBorder}`, paddingBottom: 2 }} />
                        )}
                    </div>
                );
            }
            case 'sectionEmpty': {
                const isActive = activeSectionId === block.section.id;
                return (
                    <div className="py-4 mb-3 text-center rounded" style={{ border: `1.5px dashed ${theme.emptyBorder}`, color: isActive ? theme.emptyActiveText : theme.emptyText }}>
                        <p className="text-xs">{isActive ? '← Click a question from the bank to add it here' : 'Click section header to activate, then add questions'}</p>
                    </div>
                );
            }
            case 'question': {
                const { section, bq, num } = block;
                return (
                    <div
                        onDragOver={e => handleQDragOver(e, bq.questionId)}
                        onDrop={() => handleQDrop(bq.questionId, section.id)}
                        className={`flex items-start gap-3 py-2.5 group transition-all ${dragOverQId === bq.questionId ? 'bg-black/5 dark:bg-white/10' : ''} ${dragQId === bq.questionId ? 'opacity-40' : ''}`}
                        style={{ borderBottom: `0.5px solid ${theme.rowBorder}` }}>
                        <div draggable
                            onDragStart={e => {
                                handleQDragStart(bq.questionId);
                                const row = e.currentTarget.parentElement as HTMLElement | null;
                                if (row) e.dataTransfer.setDragImage(row, 20, 20);
                            }}
                            onDragEnd={handleQDragEnd}
                            className="pt-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-grab active:cursor-grabbing" style={{ color: theme.sectionMeta }}>
                            <GripVertical size={13} />
                        </div>
                        <span className="text-xs font-bold shrink-0 mt-0.5 w-5 text-right" style={{ color: theme.accentColor }}>Q{num}.</span>
                        <div className="flex-1 min-w-0 -mt-[2.8px]">
                            <span className="text-[15px] leading-relaxed" style={{ color: theme.titleColor }}>{bq.question.question}</span>
                            {(bq.question.images ?? []).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2 pl-1">
                                    {(bq.question.images ?? []).map((url, ii) => (
                                        <img key={ii} src={url} alt="" className="max-w-[340px] max-h-[340px] w-auto h-auto rounded-lg object-contain border" style={{ borderColor: theme.rowBorder }} />
                                    ))}
                                </div>
                            )}
                            {(bq.question.type === 'MCQ' || bq.question.type === 'CONCEPTUAL') && (() => {
                                const opts = bq.question.type === 'MCQ'
                                    ? (bq.question.options ?? [])
                                    : (() => { const d = bq.question.details as ConceptualDetails | null; return d ? [d.correct_answer, ...d.distractors] : []; })();
                                return opts.length > 0 ? (
                                    <div className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-0.5 pl-1">
                                        {opts.map((opt, oi) => (
                                            <span key={oi} className="text-[13px]" style={{ color: theme.metaColor }}>{String.fromCharCode(65 + oi)}) {opt}</span>
                                        ))}
                                    </div>
                                ) : null;
                            })()}
                            {bq.question.type === 'TRUE_FALSE' && (
                                <div className="mt-1.5 flex gap-8 pl-1">
                                    <span className="text-[13px]" style={{ color: theme.metaColor }}>A) True</span>
                                    <span className="text-[13px]" style={{ color: theme.metaColor }}>B) False</span>
                                </div>
                            )}
                            {answerSpace && bq.question.type === 'NUMERICAL' && (
                                <div className="mt-2 pl-1" style={{ borderBottom: `1px solid ${theme.metaColor}`, opacity: 0.3, width: '60%' }} />
                            )}
                            {answerSpace && bq.question.type === 'SHORT_ANSWER' && (
                                <div className="mt-2 pl-1 space-y-2.5">
                                    {[0, 1, 2].map(i => <div key={i} style={{ borderBottom: `1px solid ${theme.metaColor}`, opacity: 0.22, width: '100%' }} />)}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={() => {
                                            if (!bq.isCompulsory && section.attemptCount > 0) {
                                                const compulsoryCount = builderQs.filter(q => q.sectionId === section.id && q.isCompulsory).length;
                                                if (compulsoryCount >= section.attemptCount) {
                                                    toast.error(`Only ${section.attemptCount} question(s) can be Compulsory in this section - matches the "Show" count`);
                                                    return;
                                                }
                                            }
                                            setBuilderQs(prev => prev.map(q => q.questionId === bq.questionId ? { ...q, isCompulsory: !q.isCompulsory } : q));
                                        }}
                                        title={bq.isCompulsory ? 'Always included - click to make it part of the random Show pool' : 'In the random Show pool - click to always include it'}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded transition-all"
                                        style={{ background: bq.isCompulsory ? theme.marksBadgeBg : '#FEF3C7', color: bq.isCompulsory ? theme.marksBadgeText : '#92400E', border: `0.5px solid ${bq.isCompulsory ? theme.marksBadgeBorder : '#F59E0B'}` }}>
                                        {bq.isCompulsory ? 'C' : 'O'}
                                    </button>
                                    <button onClick={() => setRemoveQConfirm({ questionId: bq.questionId, questionText: bq.question.question })} className="p-0.5 rounded transition-all" style={{ color: '#C05050' }}><X size={12} /></button>
                                </div>
                                <span className="text-[12px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                                    style={{ background: theme.marksBadgeBg, color: theme.marksBadgeText, border: `0.5px solid ${theme.marksBadgeBorder}` }}>
                                    [{section.marksPerQuestion}m]
                                </span>
                            </div>
                            {bq.isCompulsory && <span className="text-[11px] font-bold px-1 py-0 rounded" style={{ background: theme.marksBadgeBg, color: theme.marksBadgeText, border: `0.5px solid ${theme.marksBadgeBorder}` }}>Compulsory</span>}
                        </div>
                    </div>
                );
            }
            case 'assignmentQuestionsHeader':
                return (
                    <div className="flex items-center justify-between mb-4" style={{ borderBottom: `1px solid ${theme.paperBorder}`, paddingBottom: 8 }}>
                        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: theme.titleColor }}>Questions</span>
                        <span className="text-xs" style={{ color: theme.headingColor }}>{effectiveTotalQuestions} questions · {totalMarks} marks</span>
                    </div>
                );
            case 'assignmentEmpty':
                return (
                    <div className="py-8 text-center rounded" style={{ border: `1.5px dashed ${theme.emptyBorder}`, color: theme.emptyText }}>
                        <p className="text-xs">← Click a question from the modules to add it here</p>
                    </div>
                );
            case 'assignmentQuestion': {
                const { bq, num } = block;
                return (
                    <div
                        onDragOver={e => handleQDragOver(e, bq.questionId)}
                        onDrop={() => handleQDrop(bq.questionId, bq.sectionId)}
                        className={`flex items-start gap-3 py-2.5 group transition-all ${dragOverQId === bq.questionId ? 'bg-black/5 dark:bg-white/10' : ''} ${dragQId === bq.questionId ? 'opacity-40' : ''}`}
                        style={{ borderBottom: `0.5px solid ${theme.rowBorder}` }}>
                        <div draggable
                            onDragStart={e => {
                                handleQDragStart(bq.questionId);
                                const row = e.currentTarget.parentElement as HTMLElement | null;
                                if (row) e.dataTransfer.setDragImage(row, 20, 20);
                            }}
                            onDragEnd={handleQDragEnd}
                            className="pt-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-grab active:cursor-grabbing" style={{ color: theme.sectionMeta }}>
                            <GripVertical size={13} />
                        </div>
                        <span className="text-xs font-bold shrink-0 mt-0.5 w-5 text-right" style={{ color: theme.accentColor }}>Q{num}.</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-1.5">
                                <span className="flex-1 text-[13px] leading-relaxed" style={{ color: theme.titleColor }}>{bq.question.question}</span>
                            </div>
                            {(bq.question.images ?? []).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2 pl-1">
                                    {(bq.question.images ?? []).map((url, ii) => (
                                        <img key={ii} src={url} alt="" className="max-w-[340px] max-h-[340px] w-auto h-auto rounded-lg object-contain border" style={{ borderColor: theme.rowBorder }} />
                                    ))}
                                </div>
                            )}
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
                            {answerSpace && bq.question.type === 'NUMERICAL' && (
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
                                <input type="text" inputMode="numeric"
                                    value={marksDraft[bq.questionId] !== undefined ? marksDraft[bq.questionId] : String(bq.marks)}
                                    onFocus={e => { setMarksDraft(prev => ({ ...prev, [bq.questionId]: String(bq.marks) })); e.currentTarget.select(); }}
                                    onChange={e => {
                                        const digits = e.target.value.replace(/[^0-9]/g, '');
                                        setMarksDraft(prev => ({ ...prev, [bq.questionId]: digits }));
                                        if (digits !== '') setBuilderQs(prev => prev.map(q => q.questionId === bq.questionId ? { ...q, marks: Number(digits) } : q));
                                    }}
                                    onBlur={() => {
                                        const n = parseInt(marksDraft[bq.questionId] ?? '', 10);
                                        setBuilderQs(prev => prev.map(q => q.questionId === bq.questionId ? { ...q, marks: !isNaN(n) ? n : q.marks } : q));
                                        setMarksDraft(prev => { const next = { ...prev }; delete next[bq.questionId]; return next; });
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                    className="w-9 text-xs text-center rounded focus:outline-none"
                                    style={{ background: theme.inputBg, color: theme.inputText, border: `1px solid ${theme.inputBorder}`, padding: '1px 2px' }} />
                                <button onClick={() => setRemoveQConfirm({ questionId: bq.questionId, questionText: bq.question.question })} className="p-0.5" style={{ color: '#C05050' }}><X size={12} /></button>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                                style={{ background: theme.marksBadgeBg, color: theme.marksBadgeText, border: `0.5px solid ${theme.marksBadgeBorder}` }}>
                                [{bq.marks}m]
                            </span>
                        </div>
                    </div>
                );
            }
            case 'footer':
                return (
                    <div className="flex items-center justify-between pt-4 mt-2" style={{ borderTop: `1px solid ${theme.paperBorder}` }}>
                        <span className="text-[12px] italic" style={{ color: theme.footerText }}>— End of {paperType === 'TEST' ? 'Exam Paper' : 'Assignment'} —</span>
                        <span className="text-[12px]" style={{ color: theme.footerText }}>Total: {totalMarks} marks</span>
                    </div>
                );
            default:
                return null;
        }
    };

    const effectiveTestPageGroups: string[][] = pageGroups && pageGroups.length > 0
        ? pageGroups
        : [testFlowBlocks.map(b => b.key)];

    return (
        <>
        <div style={containerStyle} className="bg-background flex flex-col">
            {/* Body */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
                {/* Left panel — Modules */}
                <div className="w-full lg:w-[38%] h-[320px] lg:h-auto shrink-0 lg:shrink border-r-0 lg:border-r border-b lg:border-b-0 border-border flex flex-col overflow-hidden bg-card">
                    {/* Metadata bar */}
                    <div className="shrink-0 pl-3 pr-4 py-2.5 border-b border-border/50 flex flex-col gap-0.5 text-sm">
                        {entityType === 'test' && (
                            <div className="flex items-start gap-3 flex-wrap">
                                <div className="flex flex-col gap-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <label className="text-[11px] text-muted-foreground">Duration</label>
                                        <input type="text" inputMode="numeric" disabled={isLocked}
                                            value={durationDraft !== null ? durationDraft : String(durationMinutes)}
                                            onFocus={e => { setDurationDraft(String(durationMinutes)); e.currentTarget.select(); }}
                                            onChange={e => {
                                                const digits = e.target.value.replace(/[^0-9]/g, '');
                                                setDurationDraft(digits);
                                                if (digits !== '') setDurationMinutes(Number(digits));
                                            }}
                                            onBlur={() => {
                                                const n = parseInt(durationDraft ?? '', 10);
                                                setDurationMinutes(!isNaN(n) ? Math.min(600, Math.max(5, n)) : durationMinutes);
                                                setDurationDraft(null);
                                            }}
                                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                            className="w-14 text-xs text-center rounded-md border border-border bg-background px-2 py-1 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" />
                                        <span className="text-[11px] text-muted-foreground -ml-1">mins</span>
                                        <label className="text-[11px] text-muted-foreground ml-6">Attempts</label>
                                        <input type="number" min={1} max={10} value={maxAttempts} disabled={isLocked}
                                            onChange={e => setMaxAttempts(Number(e.target.value))}
                                            className="w-10 text-xs text-center rounded-md border border-border bg-background px-2 py-1 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" />
                                    </div>
                                    <div className="flex items-center gap-12 flex-wrap">
                                        <label className={`flex items-center gap-1.5 text-xs select-none ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                            <div onClick={() => { if (!isLocked) setAnswerSpace(v => !v); }}
                                                className={`relative w-8 h-4 rounded-full transition-colors ${isLocked ? '' : 'cursor-pointer'} ${answerSpace ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${answerSpace ? 'translate-x-4' : ''}`} />
                                            </div>
                                            <span className="text-muted-foreground">Answer Space</span>
                                        </label>
                                        <label className={`flex items-center gap-1.5 text-xs select-none ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                            <div onClick={() => { if (!isLocked) setIsRandomized(v => !v); }}
                                                className={`relative w-8 h-4 rounded-full transition-colors ${isLocked ? '' : 'cursor-pointer'} ${isRandomized ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isRandomized ? 'translate-x-4' : ''}`} />
                                            </div>
                                            <Shuffle size={12} className="text-muted-foreground" />
                                            <span className="text-muted-foreground">Randomize</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5 ml-auto">
                                    <div className="flex items-center gap-1.5 self-end">
                                        <label className="text-[11px] text-muted-foreground">Start date</label>
                                        <input type="datetime-local" value={startDate} disabled={startDateLocked}
                                            min={toLocalDatetimeInput(new Date().toISOString())}
                                            title={startDateLocked ? 'Start Date is locked to the moment this test went live' : undefined}
                                            onChange={e => {
                                                const v = e.target.value;
                                                if (v && new Date(v) < new Date()) {
                                                    toast.error('Start Date cannot be in the past');
                                                    return;
                                                }
                                                // If Valid Until is already set and would now fall before/at the
                                                // new Start Date, clear it rather than silently allowing an invalid pair.
                                                if (validUntil && v && new Date(validUntil) <= new Date(v)) {
                                                    toast.error('Valid Until was cleared — it was before the new Start Date');
                                                    setValidUntil('');
                                                }
                                                setStartDate(v);
                                            }}
                                            className="text-xs rounded-md border border-border bg-background px-2 py-1 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <label className="text-[11px] text-muted-foreground">Valid until <span className="text-red-500 text-sm">*</span></label>
                                        <input type="datetime-local" value={validUntil} min={startDate || undefined} disabled={isCompleted}
                                            title={isCompleted ? 'Test has ended - Valid Until can no longer be changed' : undefined}
                                            onChange={e => {
                                                const v = e.target.value;
                                                if (v && new Date(v) <= new Date()) {
                                                    toast.error('Valid Until must be after the current time');
                                                    return;
                                                }
                                                if (startDate && v && new Date(v) <= new Date(startDate)) {
                                                    toast.error('Valid Until must be after the Start Date');
                                                    return;
                                                }
                                                setValidUntil(v);
                                            }}
                                            className="text-xs rounded-md border border-border bg-background px-2 py-1 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" />
                                    </div>
                                </div>
                            </div>
                        )}
                        {entityType !== 'test' && (
                            <div className="flex items-center gap-10 flex-wrap">
                                <label className={`flex items-center gap-1.5 text-xs select-none ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                    <div onClick={() => { if (!isLocked) setAnswerSpace(v => !v); }}
                                        className={`relative w-8 h-4 rounded-full transition-colors ${isLocked ? '' : 'cursor-pointer'} ${answerSpace ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${answerSpace ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <span className="text-muted-foreground">Answer Space</span>
                                </label>
                                <label className={`flex items-center gap-1.5 text-xs select-none ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                    <div onClick={() => { if (!isLocked) setIsRandomized(v => !v); }}
                                        className={`relative w-8 h-4 rounded-full transition-colors ${isLocked ? '' : 'cursor-pointer'} ${isRandomized ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isRandomized ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <Shuffle size={12} className="text-muted-foreground" />
                                    <span className="text-muted-foreground">Randomize</span>
                                </label>
                                <div className="flex items-center gap-1.5 ml-auto">
                                    <label className="text-[11px] text-muted-foreground">Due date <span className="text-red-500 text-sm">*</span></label>
                                    <input type="datetime-local" value={dueDate} disabled={isCompleted}
                                        title={isCompleted ? 'Assignment has ended - Due Date can no longer be changed' : undefined}
                                        onChange={e => {
                                            const v = e.target.value;
                                            if (v && new Date(v) <= new Date()) {
                                                toast.error('Due Date must be after the current time');
                                                return;
                                            }
                                            setDueDate(v);
                                        }}
                                        className="text-xs rounded-md border border-border bg-background px-2 py-1 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" />
                                </div>
                            </div>
                        )}
                        {entityType !== 'test' && (
                            <div className="flex items-center gap-2 mt-2">
                                <label className="text-[11px] text-muted-foreground shrink-0">Submission</label>
                                <div className="flex gap-1.5">
                                    {(['OFFLINE', 'ONLINE'] as const).map(type => (
                                        <button key={type} type="button" disabled={isLocked}
                                            onClick={() => {
                                                if (isLocked || submissionType === type) return;
                                                setSubmissionType(type);
                                                api.patch(`/teacher/tasks/assignments/${testId}`, { submissionType: type })
                                                    .catch(() => { toast.error('Failed to update submission type'); setSubmissionType(prev => prev === type ? (type === 'OFFLINE' ? 'ONLINE' : 'OFFLINE') : prev); });
                                            }}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                                submissionType === type
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'border-border text-muted-foreground hover:bg-muted'
                                            }`}>
                                            {type === 'OFFLINE' ? '📝 Offline' : '📤 Online'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2 mt-3">
                            <button onClick={() => savePaper(false)} disabled={saving || draftSaveStatus === 'saving' || isCompleted}
                                className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg border border-border hover:bg-muted transition-all disabled:opacity-50">
                                {(saving || draftSaveStatus === 'saving')
                                    ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                    : draftSaveStatus === 'saved'
                                        ? <CheckCircle2 size={12} className="text-emerald-500" />
                                        : <Save size={12} />}
                                {(saving || draftSaveStatus === 'saving') ? 'Saving…' : draftSaveStatus === 'saved' ? 'Saved!' : 'Save Draft'}
                            </button>
                            {isActivated ? (
                                <span className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg text-emerald-600 bg-emerald-500/10 border border-emerald-500/30">
                                    <CheckCircle2 size={14} /> Activated
                                </span>
                            ) : (
                                <div className="relative">
                                    <button onClick={() => {
                                            if (entityType === 'test') setActivateMenuOpen(true);
                                            else { setActivateStartNow(true); setActivateConfirm(true); }
                                        }}
                                        disabled={saving || builderQs.length === 0 || (entityType === 'assignment' && !dueDate) || (entityType === 'test' && !validUntil)}
                                        title={entityType === 'assignment' && !dueDate ? 'Set a Due Date before activating' : (entityType === 'test' && !validUntil) ? 'Set a Valid Until date before activating' : undefined}
                                        className="text-sm font-medium px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
                                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                                        Save & Activate
                                    </button>
                                    <AnimatePresence>
                                        {activateMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-[59]" onClick={() => setActivateMenuOpen(false)} />
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.9, y: 4 }}
                                                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                                    className="absolute right-0 top-full mt-1 z-[60] bg-card border border-border rounded-xl shadow-xl p-1.5 w-64 flex flex-col gap-0.5">
                                                    <button onClick={() => {
                                                            if (!startDate) { toast.error('Set a Start Date first to use this option'); return; }
                                                            setActivateMenuOpen(false); setActivateStartNow(false); setActivateConfirm(true);
                                                        }}
                                                        className="text-left px-3 py-2 rounded-lg text-xs hover:bg-muted transition-all">
                                                        <span className="font-medium text-foreground">Start at set time</span>
                                                        <span className="block text-[11px] text-muted-foreground">
                                                            {startDate
                                                                ? `${new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${new Date(startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
                                                                : 'Set a Start Date first'}
                                                        </span>
                                                    </button>
                                                    <button onClick={() => { setActivateMenuOpen(false); setActivateStartNow(true); setActivateConfirm(true); }}
                                                        className="text-left px-3 py-2 rounded-lg text-xs hover:bg-muted transition-all">
                                                        <span className="font-medium text-foreground">Start now</span>
                                                        <span className="block text-[11px] text-muted-foreground">Goes live immediately</span>
                                                    </button>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="shrink-0 px-4 py-3 border-b border-border/50 bg-muted/40 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Modules</p>
                        <span className="text-xs text-muted-foreground">
                            {effectiveTotalQuestions} Q · {totalMarks} marks
                        </span>
                    </div>
                    <div className={`flex-1 overflow-y-auto px-3 py-2 space-y-1 ${isLocked ? 'pointer-events-none opacity-50' : ''}`}>
                        {modules.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-8">No modules yet. Create modules and assign questions first.</p>
                        ) : modules.map(mod => {
                            const isExpanded = expandedModuleId === mod.id;
                            const selectedCount = mod.questions.filter(mq => addedIds.has(mq.question.id)).length;
                            return (
                                <div key={mod.id} className="rounded-lg border border-border/60 overflow-hidden bg-muted/40">
                                    <button
                                        onClick={() => setExpandedModuleId(isExpanded ? null : mod.id)}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-all text-left">
                                        <BookMarked size={13} className="text-primary/70 shrink-0" />
                                        <span className="flex-1 text-xs font-semibold truncate">{mod.name}</span>
                                        <span className={`text-[10px] shrink-0 ${selectedCount > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                                            {selectedCount > 0 ? `${selectedCount}/${mod.questions.length}q` : `${mod.questions.length}q`}
                                        </span>
                                        {isExpanded ? <ChevronUp size={12} className="text-muted-foreground shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t border-border/40 bg-white dark:bg-black/20 max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                                            {mod.questions.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground px-4 py-3">No questions in this module.</p>
                                            ) : mod.questions.map(mq => {
                                                const q = mq.question;
                                                const alreadyAdded = addedIds.has(q.id);
                                                const isOptsOpen = expandedQIds.has(q.id);
                                                const opts: string[] = q.type === 'MCQ'
                                                    ? (Array.isArray(q.options) ? q.options : [])
                                                    : q.type === 'CONCEPTUAL'
                                                        ? (() => { const d = q.details as ConceptualDetails | null; return d ? [d.correct_answer, ...(d.distractors ?? [])] : []; })()
                                                        : [];
                                                const isPlainAnswer = q.type === 'FILL_BLANK' || q.type === 'SHORT_ANSWER' || q.type === 'NUMERICAL';
                                                const hasOpts = opts.length > 0 || q.type === 'TRUE_FALSE' || isPlainAnswer;
                                                return (
                                                    <div key={mq.id}
                                                        onClick={() => {
                                                            if (!hasOpts) return;
                                                            setExpandedQIds(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                                                                return next;
                                                            });
                                                        }}
                                                        className={`flex items-start gap-2 px-3 py-2 border-b border-border/30 last:border-0 transition-all group ${hasOpts ? 'cursor-pointer' : ''} ${alreadyAdded ? '' : 'hover:bg-muted/50'} ${paperType === 'TEST' && q.type === 'SHORT_ANSWER' && !alreadyAdded ? 'opacity-50' : ''}`}
                                                        style={alreadyAdded ? { background: 'rgba(218,119,86,0.08)' } : undefined}>
                                                        <div onClick={e => {
                                                                e.stopPropagation();
                                                                if (alreadyAdded) { removeQuestion(q.id); return; }
                                                                if (paperType === 'TEST' && q.type === 'SHORT_ANSWER') {
                                                                    toast.error("Short Answer questions can't be added to a Test - there's no fixed option to auto-grade against");
                                                                    return;
                                                                }
                                                                addQuestionToBuilder(q as unknown as Question);
                                                            }}
                                                            title={paperType === 'TEST' && q.type === 'SHORT_ANSWER' && !alreadyAdded ? "Short Answer questions can't be used in a Test" : undefined}
                                                            className={`self-stretch shrink-0 flex items-start justify-center -my-2 -ml-3 pl-3 pr-1.5 pt-2.5 ${paperType === 'TEST' && q.type === 'SHORT_ANSWER' && !alreadyAdded ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                                            <span className={`w-3.5 h-3.5 rounded-[4px] border shrink-0 flex items-center justify-center transition-all ${paperType === 'TEST' && q.type === 'SHORT_ANSWER' && !alreadyAdded ? 'opacity-40' : ''}`}
                                                                style={alreadyAdded ? { background: '#DA7756', borderColor: '#DA7756' } : { borderColor: 'var(--border)' }}>
                                                                {alreadyAdded && <Check size={10} className="text-white" strokeWidth={3} />}
                                                            </span>
                                                        </div>
                                                        <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${TYPE_META[q.type]?.color}`}>{TYPE_META[q.type]?.label}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start gap-1">
                                                                <span className="flex-1 text-xs leading-snug line-clamp-2">{q.question}</span>
                                                                {hasOpts && (isOptsOpen ? <ChevronUp size={11} className="text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown size={11} className="text-muted-foreground shrink-0 mt-0.5" />)}
                                                            </div>
                                                            {/* Images — same question data as the Modules panel, so any
                                                                image attached there shows up here too when picking
                                                                questions for a test/paper. View-only here (no add/remove
                                                                controls) since this is a selection list, not the module
                                                                editor — click to zoom, same as elsewhere. */}
                                                            {(q.images ?? []).length > 0 && (
                                                                <div className="mt-2 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                                                                    {(q.images ?? []).map((url, ii) => (
                                                                        <img key={ii} src={url} alt="" onClick={() => setExpandedImage(url)}
                                                                            className="max-w-[300px] max-h-[300px] w-auto h-auto rounded-lg object-contain border border-border bg-muted/40 cursor-pointer" />
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {isOptsOpen && opts.length > 0 && (
                                                                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0">
                                                                    {opts.map((opt, oi) => {
                                                                        const isCorrect = (q.type === 'MCQ' || q.type === 'CONCEPTUAL') && opt === q.answer;
                                                                        return (
                                                                            <span key={oi} className={`text-[10px] truncate ${isCorrect ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{String.fromCharCode(65 + oi)}) {opt}</span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            {isOptsOpen && q.type === 'TRUE_FALSE' && (
                                                                <div className="mt-1 flex gap-4">
                                                                    <span className={`text-[10px] ${q.answer?.toLowerCase() === 'true' ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>A) True</span>
                                                                    <span className={`text-[10px] ${q.answer?.toLowerCase() === 'false' ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>B) False</span>
                                                                </div>
                                                            )}
                                                            {isOptsOpen && isPlainAnswer && (
                                                                <div className="mt-1 text-[10px] space-y-0.5">
                                                                    {q.type === 'NUMERICAL' && (q.details as NumericalDetails | null)?.correct_answer_formula && (
                                                                        <div>
                                                                            <span className="text-muted-foreground">Formula: </span>
                                                                            <span className="font-mono">{(q.details as NumericalDetails).correct_answer_formula}</span>
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <span className="text-muted-foreground">Answer: </span>
                                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{q.answer}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
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
                <div className="w-full lg:flex-1 h-[55vh] lg:h-auto flex flex-col min-h-0 overflow-hidden relative">
                <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
                    <button onClick={() => setIsFullscreen(v => !v)}
                        className="p-1.5 rounded-lg border border-black/20 bg-black/50 hover:bg-black/70 transition-all text-white"
                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                        {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                    <div className="flex flex-col rounded-lg border border-black/20 bg-black/50 overflow-hidden">
                        <button onClick={() => setPaperZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                            disabled={paperZoom >= 2}
                            className="p-1.5 hover:bg-black/30 transition-all text-white disabled:opacity-30" title="Zoom in">
                            <ZoomIn size={15} />
                        </button>
                        <button onClick={() => setPaperZoom(1)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-white/80 hover:bg-black/30 transition-all border-t border-b border-white/10"
                            title="Reset zoom">
                            {Math.round(paperZoom * 100)}%
                        </button>
                        <button onClick={() => setPaperZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                            disabled={paperZoom <= 0.5}
                            className="p-1.5 hover:bg-black/30 transition-all text-white disabled:opacity-30" title="Zoom out">
                            <ZoomOut size={15} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto pt-3 pb-8 px-6" style={{ background: theme.outerBg, scrollbarWidth: 'thin', scrollbarColor: theme.scrollbar }}>

                    {/* ── The actual paper (both TEST and ASSIGNMENT paginate into A4 pages) ── */}
                    <div className={`mx-auto ${isLocked ? 'pointer-events-none' : ''}`} style={{ width: 'fit-content', zoom: paperZoom } as CSSProperties}>
                        {effectiveTestPageGroups.map((group, pi) => (
                            <div key={`page-${pi}`} className={pi > 0 ? 'mt-6' : ''} style={{
                                width: '210mm', minHeight: `${PAGE_HEIGHT_PX}px`,
                                display: 'flex', flexDirection: 'column',
                                background: theme.paperBg, border: `1px solid ${theme.paperBorder}`,
                                boxShadow: '0 8px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                                fontFamily: theme.fontFamily,
                            }}>
                                <div style={{ height: 6, background: theme.topBar1, flexShrink: 0 }} />
                                <div style={{ height: 2, background: theme.topBar2, marginTop: 3, flexShrink: 0 }} />
                                {entityType === 'assignment' && letterhead && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 18,
                                        padding: '20px 40px 16px',
                                        borderBottom: `3px double ${theme.paperBorder}`, flexShrink: 0,
                                    }}>
                                        {letterhead.logoUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={letterhead.logoUrl} alt="" style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0 }} />
                                        )}
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <p style={{ fontSize: 26, fontWeight: 800, color: theme.titleColor, letterSpacing: 0.6, textTransform: 'uppercase', lineHeight: 1.15 }}>{letterhead.name}</p>
                                            {(letterhead.address || letterhead.city || letterhead.state || letterhead.pincode) && (
                                                <p style={{ fontSize: 12.5, color: theme.sectionMeta, marginTop: 5 }}>
                                                    {[letterhead.address, letterhead.city, letterhead.state, letterhead.pincode].filter(Boolean).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                        {/* Spacer to balance the logo so the name/address stay visually centered */}
                                        {letterhead.logoUrl && <div style={{ width: 72, flexShrink: 0 }} />}
                                    </div>
                                )}
                                <div style={{ padding: '24px 40px', flex: 1 }}>
                                    {group.map(key => {
                                        const block = testBlocksByKey.get(key);
                                        if (!block) return null;
                                        return (
                                            <div key={key}>
                                                {pi === effectiveTestPageGroups.length - 1 && block.kind === 'footer' && (
                                                    <button onClick={addSection}
                                                        className="w-full mb-4 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                                                        style={{ border: `1.5px dashed ${theme.addSectionBorder}`, color: theme.addSectionText, borderRadius: 4, background: 'transparent' }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = theme.addSectionHoverBorder; e.currentTarget.style.color = theme.addSectionHoverText; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = theme.addSectionBorder; e.currentTarget.style.color = theme.addSectionText; }}>
                                                        <Plus size={13} /> Add Section
                                                    </button>
                                                )}
                                                <div ref={el => { if (el) pageBlockElRefs.current.set(key, el); }} style={{ display: 'flow-root' }}>
                                                    {renderFlowBlock(block)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {pi === effectiveTestPageGroups.length - 1 && !testFlowBlocksRef.current.some(b => b.kind === 'footer') && (
                                        <button onClick={addSection}
                                            className="w-full mt-4 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                                            style={{ border: `1.5px dashed ${theme.addSectionBorder}`, color: theme.addSectionText, borderRadius: 4, background: 'transparent' }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.addSectionHoverBorder; e.currentTarget.style.color = theme.addSectionHoverText; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.addSectionBorder; e.currentTarget.style.color = theme.addSectionText; }}>
                                            <Plus size={13} /> Add Section
                                        </button>
                                    )}
                                </div>
                                <div style={{ height: 2, background: theme.topBar2, flexShrink: 0 }} />
                                <div style={{ height: 6, background: theme.topBar1, marginTop: 3, flexShrink: 0 }} />
                            </div>
                        ))}
                    </div>

                </div>
                </div>
            </div>
        </div>

        {/* Save & Activate confirm modal */}
        <AnimatePresence>
            {activateConfirm && (
                <>
                    <motion.div
                        key="activate-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
                        onClick={() => setActivateConfirm(false)}
                    />
                    <motion.div
                        key="activate-modal"
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
                    >
                        <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-80 pointer-events-auto flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <p className="text-sm font-semibold text-foreground">
                                    {entityType === 'test' ? 'Save & activate this test?' : 'Save & activate this assignment?'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {entityType !== 'test'
                                        ? 'Students will be able to see and submit it immediately.'
                                        : activateStartNow
                                            ? "The link goes live immediately and the Start Date locks to right now. This can't be undone."
                                            : `Students will see it as "Upcoming" until ${new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${new Date(startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} — it'll go live on its own at that time, no need to activate it again.`}
                                </p>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setActivateConfirm(false)}
                                    className="px-4 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => { setActivateConfirm(false); savePaper(true, false, activateStartNow); }}
                                    className="px-4 py-1.5 text-sm rounded-lg text-white font-medium transition-all"
                                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                                    Activate
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Delete section confirm modal */}
        <AnimatePresence>
            {deleteSectionConfirmId && (
                <>
                    <motion.div
                        key="del-sec-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
                        onClick={() => setDeleteSectionConfirmId(null)}
                    />
                    <motion.div
                        key="del-sec-modal"
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
                    >
                        <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-80 pointer-events-auto flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <p className="text-sm font-semibold text-foreground">Delete this section?</p>
                                <p className="text-xs text-muted-foreground">
                                    "{sections.find(s => s.id === deleteSectionConfirmId)?.title}" and all its questions will be removed from the paper. This cannot be undone.
                                </p>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setDeleteSectionConfirmId(null)}
                                    className="px-4 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => { removeSection(deleteSectionConfirmId); setDeleteSectionConfirmId(null); }}
                                    className="px-4 py-1.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Remove question from paper confirm modal */}
        <AnimatePresence>
            {removeQConfirm && (
                <>
                    <motion.div
                        key="del-q-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
                        onClick={() => setRemoveQConfirm(null)}
                    />
                    <motion.div
                        key="del-q-modal"
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
                    >
                        <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-80 pointer-events-auto flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <p className="text-sm font-semibold text-foreground">Remove this question?</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    "{removeQConfirm.questionText}" will be removed from this {entityType === 'test' ? 'paper' : 'assignment'}.
                                </p>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setRemoveQConfirm(null)}
                                    className="px-4 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => { removeQuestion(removeQConfirm.questionId); setRemoveQConfirm(null); }}
                                    className="px-4 py-1.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
                                    Remove
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Expanded question image — same zoom treatment as the Modules panel. */}
        <AnimatePresence>
            {expandedImage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={() => setExpandedImage(null)}
                >
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.85, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="relative max-w-[90vw] max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <img src={expandedImage} alt="" className="max-w-[90vw] max-h-[85vh] w-auto h-auto rounded-2xl object-contain shadow-2xl" />
                        <button
                            onClick={() => setExpandedImage(null)}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                            <X size={16} className="text-white" />
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        </>
    );
}
