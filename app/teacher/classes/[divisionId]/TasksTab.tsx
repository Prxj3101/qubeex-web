'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, X, Plus, Trash2, Download,
    Loader2, BookOpen, Layers, Check, X as XIcon,
    Clock, Link2, Play, Eye, ChevronDown, ChevronUp,
    FlaskConical, Brain, Users, Copy, CheckCircle2, AlertCircle,
    Shuffle, ArrowUp, ArrowDown, Search, BookMarked,
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

interface Question {
    id: string;
    type: QuestionType;
    status: QuestionStatus;
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
    marksPerQuestion: number;
    numberOfQuestions: number;
    maxAttempts: number;
    validUntil: string | null;
    paperType: string;
    isRandomized: boolean;
    sections: PaperSection[] | null;
    _count: { attempts: number };
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
    CONCEPTUAL:   { label: 'MCQ',        color: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',   section: 'Section A' },
    FILL_BLANK:   { label: 'Fill Blank', color: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',           section: 'Section B' },
    TRUE_FALSE:   { label: 'True/False', color: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',       section: 'Section B' },
    SHORT_ANSWER: { label: 'Short Ans',  color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300', section: 'Section C' },
    NUMERICAL:    { label: 'Numerical',  color: 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300',   section: 'Section D' },
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

// ── Component ─────────────────────────────────────────────────────────────────

interface TasksTabProps { divisionId: string }

export default function TasksTab({ divisionId }: TasksTabProps) {
    const [subTab, setSubTab] = useState<'questions' | 'tests' | 'modules'>('questions');

    // ── Questions ─────────────────────────────────────────────────────────────
    const [questions, setQuestions] = useState<Question[]>([]);
    const [qLoading, setQLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<QuestionStatus | 'ALL'>('ALL');
    const [typeFilter, setTypeFilter] = useState<QuestionType | 'ALL'>('ALL');

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
    const [newTest, setNewTest] = useState({ title: '', description: '', durationMinutes: 60, marksPerQuestion: 1, numberOfQuestions: 10, maxAttempts: 1, validUntil: '' });
    const [savingTest, setSavingTest] = useState(false);
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [paperBuilderOpen, setPaperBuilderOpen] = useState(false);
    const [paperBuilderTestId, setPaperBuilderTestId] = useState<string | null>(null);

    // ── Modules ───────────────────────────────────────────────────────────────
    const [modules, setModules] = useState<TaskModule[]>([]);
    const [mLoading, setMLoading] = useState(false);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [creatingModule, setCreatingModule] = useState(false);
    const [newModName, setNewModName] = useState('');
    const [newModDesc, setNewModDesc] = useState('');
    const [savingModule, setSavingModule] = useState(false);

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchQuestions = useCallback(async (status?: string) => {
        setQLoading(true);
        try {
            const params = new URLSearchParams({ divisionId });
            if (status && status !== 'ALL') params.set('status', status);
            const res = await api.get(`/teacher/tasks/questions?${params}`);
            setQuestions(res.data.data);
        } catch {
            setQuestions([]);
        } finally {
            setQLoading(false);
        }
    }, [divisionId]);

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

    const fetchModules = useCallback(async () => {
        setMLoading(true);
        try {
            const res = await api.get(`/teacher/tasks/modules?divisionId=${divisionId}`);
            setModules(res.data.data);
        } catch {
            setModules([]);
        } finally {
            setMLoading(false);
        }
    }, [divisionId]);

    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    useEffect(() => {
        if (subTab === 'tests' && tests.length === 0) fetchTests();
    }, [subTab, tests.length, fetchTests]);

    useEffect(() => {
        fetchModules();
    }, [fetchModules]);

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
                    const qRes = await api.get(`/teacher/tasks/questions?divisionId=${divisionId}&status=PENDING_REVIEW`).catch(() => null);
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
        setUploading(true);
        try {
            const form = new FormData();
            form.append('divisionId', divisionId);
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

    // ── Tests ──────────────────────────────────────────────────────────────────

    const handleCreateTest = async () => {
        if (!newTest.title.trim()) return toast.error('Test title is required');
        setSavingTest(true);
        try {
            const payload: Record<string, unknown> = {
                divisionId, title: newTest.title, description: newTest.description || undefined,
                durationMinutes: newTest.durationMinutes, marksPerQuestion: newTest.marksPerQuestion,
                numberOfQuestions: newTest.numberOfQuestions, maxAttempts: newTest.maxAttempts,
            };
            if (newTest.validUntil) payload.validUntil = new Date(newTest.validUntil).toISOString();
            const res = await api.post('/teacher/tasks/tests', payload);
            const created: Test = res.data.data;
            setTests(prev => [created, ...prev]);
            toast.success('Test created — opening Paper Builder');
            setCreateTestOpen(false);
            setNewTest({ title: '', description: '', durationMinutes: 60, marksPerQuestion: 1, numberOfQuestions: 10, maxAttempts: 1, validUntil: '' });
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

    const openBuilder = (testId: string) => {
        setPaperBuilderTestId(testId);
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
        toast.success('Quiz link copied');
        setTimeout(() => setCopiedLink(null), 2000);
    };

    // ── Module assignment ──────────────────────────────────────────────────────

    const assignToModule = async (questionId: string, moduleId: string) => {
        try {
            await api.post(`/teacher/tasks/modules/${moduleId}/questions`, { questionId });
            const mod = modules.find(m => m.id === moduleId);
            setQuestions(prev => prev.map(q => q.id === questionId
                ? { ...q, moduleAssignment: { moduleId, module: { name: mod?.name ?? '' } } }
                : q));
            toast.success(`Added to ${mod?.name ?? 'module'}`);
        } catch (err) { toast.error(apiError(err)); }
    };

    const unassignFromModule = async (questionId: string) => {
        const q = questions.find(q2 => q2.id === questionId);
        if (!q?.moduleAssignment) return;
        try {
            await api.delete(`/teacher/tasks/modules/${q.moduleAssignment.moduleId}/questions/${questionId}`);
            setQuestions(prev => prev.map(q2 => q2.id === questionId ? { ...q2, moduleAssignment: null } : q2));
            toast.success('Removed from module');
        } catch (err) { toast.error(apiError(err)); }
    };

    // ── Modules ────────────────────────────────────────────────────────────────

    const createModule = async () => {
        if (!newModName.trim()) return toast.error('Module name is required');
        setSavingModule(true);
        try {
            const res = await api.post('/teacher/tasks/modules', { divisionId, name: newModName, description: newModDesc || undefined });
            setModules(prev => [...prev, res.data.data]);
            toast.success('Module created');
            setCreatingModule(false);
            setNewModName(''); setNewModDesc('');
        } catch (err) { toast.error(apiError(err)); } finally { setSavingModule(false); }
    };

    const deleteModule = async (id: string) => {
        try {
            await api.delete(`/teacher/tasks/modules/${id}`);
            setModules(prev => prev.filter(m => m.id !== id));
            if (selectedModuleId === id) setSelectedModuleId(null);
            toast.success('Module deleted');
        } catch (err) { toast.error(apiError(err)); }
    };

    // ── Filtered questions ─────────────────────────────────────────────────────

    const statusFiltered = questions.filter(q =>
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

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Sub-tabs */}
            <div className="shrink-0 px-4 pt-3 pb-0 flex items-center justify-between">
                <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/50">
                    {(['questions', 'tests', 'modules'] as const).map(tab => (
                        <button key={tab} onClick={() => setSubTab(tab)}
                            className={`relative px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize
                            ${subTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {subTab === 'questions' && activeUploadId && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
                            <Loader2 size={11} className="animate-spin" />
                            Generating questions…
                        </div>
                    )}
                    {subTab === 'questions' && (
                        <button onClick={() => setGenerateOpen(v => !v)}
                            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl text-white"
                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                            <Upload size={14} /> Generate from PDF
                        </button>
                    )}
                    {subTab === 'tests' && (
                        <button onClick={() => setCreateTestOpen(true)}
                            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl text-white"
                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                            <Plus size={14} /> Create Test
                        </button>
                    )}
                    {subTab === 'modules' && (
                        <button onClick={() => setCreatingModule(true)}
                            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl text-white"
                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                            <Plus size={14} /> New Module
                        </button>
                    )}
                    {subTab === 'questions' && (
                        <button onClick={() => {
                            const url = `/api/teacher/tasks/questions/export?divisionId=${divisionId}`;
                            window.open(process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') + url || url);
                        }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg border border-border hover:bg-muted transition-all">
                            <Download size={13} /> Export
                        </button>
                    )}
                </div>
            </div>

            {/* Generate Panel */}
            <AnimatePresence>
                {generateOpen && subTab === 'questions' && (
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
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
                {/* ── QUESTIONS TAB ── */}
                {subTab === 'questions' && (
                    <>
                        {/* Status filter row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {(['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const).map(s => (
                                <button key={s} onClick={() => { setStatusFilter(s); setTypeFilter('ALL'); }}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${statusFilter === s ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'}`}>
                                    {s === 'ALL' ? 'All' : s === 'PENDING_REVIEW' ? 'Pending Review' : s === 'APPROVED' ? 'Approved' : 'Rejected'}
                                    <span className="ml-1 opacity-60">
                                        {s === 'ALL' ? questions.length : questions.filter(q => q.status === s).length}
                                    </span>
                                </button>
                            ))}
                        </div>

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
                                <p className="text-xs mt-1 opacity-60">Upload a PDF to generate questions automatically</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {displayedQuestions.map(q => (
                                    <QuestionCard key={q.id} question={q}
                                        modules={modules}
                                        onApprove={() => updateStatus(q.id, 'APPROVED')}
                                        onReject={() => updateStatus(q.id, 'REJECTED')}
                                        onDelete={() => deleteQuestion(q.id)}
                                        onAssignModule={(moduleId) => assignToModule(q.id, moduleId)}
                                        onUnassignModule={() => unassignFromModule(q.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ── TESTS TAB ── */}
                {subTab === 'tests' && (
                    <>
                        {/* Create test modal */}
                        <AnimatePresence>
                            {createTestOpen && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                    className="p-4 rounded-xl border border-border bg-card/50 mb-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-sm">Create New Test</h3>
                                        <button onClick={() => setCreateTestOpen(false)}><X size={16} /></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <label className="text-xs text-muted-foreground">Title *</label>
                                            <input value={newTest.title} onChange={e => setNewTest(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Chapter 5 Quiz" className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-muted-foreground">Description</label>
                                            <input value={newTest.description} onChange={e => setNewTest(p => ({ ...p, description: e.target.value }))} placeholder="Optional" className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                        </div>
                                        {[
                                            { label: 'Duration (mins)', key: 'durationMinutes', min: 5, max: 300 },
                                            { label: 'Marks / Question', key: 'marksPerQuestion', min: 1, max: 10 },
                                            { label: 'No. of Questions', key: 'numberOfQuestions', min: 1, max: 100 },
                                            { label: 'Max Attempts', key: 'maxAttempts', min: 1, max: 10 },
                                        ].map(({ label, key, min, max }) => (
                                            <div key={key}>
                                                <label className="text-xs text-muted-foreground">{label}</label>
                                                <input type="number" min={min} max={max} value={(newTest as Record<string, unknown>)[key] as number}
                                                    onChange={e => setNewTest(p => ({ ...p, [key]: Number(e.target.value) }))}
                                                    className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                            </div>
                                        ))}
                                        <div>
                                            <label className="text-xs text-muted-foreground">Valid Until (optional)</label>
                                            <input type="datetime-local" value={newTest.validUntil} onChange={e => setNewTest(p => ({ ...p, validUntil: e.target.value }))}
                                                className="w-full mt-1 text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4">
                                        <button onClick={() => setCreateTestOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-all">Cancel</button>
                                        <button onClick={handleCreateTest} disabled={savingTest}
                                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                                            style={{ background: 'linear-gradient(135deg,#E8876A,#C06040)' }}>
                                            {savingTest ? <><Loader2 size={13} className="animate-spin" />Creating…</> : <>Create Test</>}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

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
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {tests.map(test => (
                                    <TestCard key={test.id} test={test}
                                        onOpen={() => openBuilder(test.id)}
                                        onCopyLink={() => copyLink(test.testLink)}
                                        onDelete={() => deleteTest(test.id)}
                                        onActivate={() => updateTestStatus(test, 'ACTIVE')}
                                        copiedLink={copiedLink}
                                    />
                                ))}
                            </div>
                        )}
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
                            <div className="space-y-2">
                                {modules.map(m => (
                                    <div key={m.id} className="rounded-xl border border-border bg-card overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/40 transition-all"
                                            onClick={() => setSelectedModuleId(selectedModuleId === m.id ? null : m.id)}>
                                            <div className="flex items-center gap-2">
                                                <BookOpen size={15} className="text-muted-foreground" />
                                                <span className="font-medium text-sm">{m.name}</span>
                                                <span className="text-xs text-muted-foreground">{m.questions.length} questions</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={e => { e.stopPropagation(); deleteModule(m.id); }} className="text-xs text-muted-foreground hover:text-red-500 p-1 rounded transition-all"><Trash2 size={13} /></button>
                                                {selectedModuleId === m.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </div>
                                        </div>
                                        {selectedModuleId === m.id && (
                                            <div className="px-4 pb-3 space-y-1.5 border-t border-border/50 pt-2">
                                                {m.questions.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground py-2">No questions in this module</p>
                                                ) : m.questions.map(mq => (
                                                    <div key={mq.id} className="flex items-start gap-2 py-1.5 text-sm">
                                                        <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${TYPE_META[mq.question.type]?.color ?? 'bg-muted text-muted-foreground'}`}>{TYPE_META[mq.question.type]?.label}</span>
                                                        <span className="flex-1 text-sm">{mq.question.question}</span>
                                                    </div>
                                                ))}
                                            </div>
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
                    onClose={() => { setPaperBuilderOpen(false); setPaperBuilderTestId(null); }}
                    onSaved={handlePaperSaved}
                />
            )}
        </div>
    );
}

// ── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({ question, modules, onApprove, onReject, onDelete, onAssignModule, onUnassignModule }: {
    question: Question;
    modules: TaskModule[];
    onApprove: () => void;
    onReject: () => void;
    onDelete: () => void;
    onAssignModule: (moduleId: string) => void;
    onUnassignModule: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);
    const meta = TYPE_META[question.type];
    const statusMeta = STATUS_META[question.status];
    const marks = (question.details as Record<string, unknown> | null)?.marks as number | undefined;

    const isNumerical = question.type === 'NUMERICAL';
    const isConceptual = question.type === 'CONCEPTUAL' || question.type === 'MCQ';
    const numDetails = isNumerical ? question.details as NumericalDetails : null;
    const conDetails = isConceptual ? question.details as ConceptualDetails : null;
    const isOpenEnded = question.type === 'FILL_BLANK' || question.type === 'TRUE_FALSE' || question.type === 'SHORT_ANSWER';

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                    <div className="flex flex-wrap gap-1.5 mt-0.5 shrink-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${meta?.color ?? 'bg-muted text-muted-foreground'}`}>{meta?.label}</span>
                        {marks && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{marks}m</span>}
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${statusMeta.color}`}>{statusMeta.label}</span>
                        {question.category && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{question.category}</span>}
                    </div>
                    <p className="flex-1 text-sm leading-snug">{question.question}</p>
                    <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                </div>

                {/* Compact answer preview when not expanded */}
                {!expanded && isNumerical && numDetails && (
                    <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-3">
                        <span className="font-mono">f: {numDetails.correct_answer_formula}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">= {question.answer}</span>
                    </div>
                )}
                {!expanded && isConceptual && conDetails && (
                    <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 truncate">✓ {conDetails.correct_answer ?? question.answer}</p>
                )}
                {!expanded && isOpenEnded && (
                    <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 line-clamp-2">✓ {question.answer}</p>
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
                                    <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ Answer: {question.answer}</div>
                                </>
                            )}
                            {isConceptual && conDetails && (
                                <>
                                    {[conDetails.correct_answer, ...(conDetails.distractors ?? [])].filter(Boolean).map((opt, i) => (
                                        <div key={i} className={`text-xs px-2 py-1 rounded-lg ${opt === conDetails.correct_answer ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                                            {'ABCD'[i]}. {opt} {opt === conDetails.correct_answer && '✓'}
                                        </div>
                                    ))}
                                </>
                            )}
                            {question.type === 'MCQ' && Array.isArray(question.options) && (
                                question.options.map((opt, i) => (
                                    <div key={i} className={`text-xs px-2 py-1 rounded-lg ${opt === question.answer ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                                        {'ABCD'[i]}. {opt} {opt === question.answer && '✓'}
                                    </div>
                                ))
                            )}
                            {question.type === 'FILL_BLANK' && (
                                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ Fill: {question.answer}</div>
                            )}
                            {question.type === 'TRUE_FALSE' && (
                                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    ✓ {String(question.answer).charAt(0).toUpperCase() + String(question.answer).slice(1)}
                                </div>
                            )}
                            {question.type === 'SHORT_ANSWER' && (
                                <div className="text-xs rounded-lg bg-muted/60 px-3 py-2 text-foreground leading-relaxed">
                                    <span className="text-muted-foreground text-[10px] uppercase font-semibold block mb-1">Model Answer</span>
                                    {question.answer}
                                </div>
                            )}
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
                    ) : (
                        <button onClick={() => setModuleDropdownOpen(v => !v)}
                            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all">
                            <BookMarked size={10} /> Module
                        </button>
                    )}
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
                <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 p-1 rounded transition-all">
                    <Trash2 size={13} />
                </button>
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
    const statusColor = { DRAFT: 'text-muted-foreground bg-muted', ACTIVE: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950', COMPLETED: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950' }[test.status];

    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm truncate">{test.title}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${statusColor}`}>{test.status}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={11} />{test.durationMinutes} min</span>
                    <span>{test.questions.length}/{test.numberOfQuestions} questions</span>
                    <span className="flex items-center gap-1"><Users size={11} />{test._count.attempts} attempts</span>
                    {test.validUntil && <span>Expires {new Date(test.validUntil).toLocaleDateString()}</span>}
                </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                {test.status === 'DRAFT' && test.questions.length > 0 && (
                    <button onClick={onActivate} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all">
                        <Play size={11} /> Activate
                    </button>
                )}
                {test.status === 'ACTIVE' && (
                    <button onClick={onCopyLink} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                        {copiedLink === test.testLink ? <><CheckCircle2 size={11} /> Copied</> : <><Copy size={11} /> Copy Link</>}
                    </button>
                )}
                <button onClick={onOpen} className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-all flex items-center gap-1">
                    <Eye size={11} /> Open
                </button>
                <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 p-1.5 rounded transition-all">
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
}

// ── Paper Builder ─────────────────────────────────────────────────────────────

function PaperBuilder({ testId, approvedQuestions, onClose, onSaved }: {
    testId: string;
    approvedQuestions: Question[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Metadata
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [paperType, setPaperType] = useState<'TEST' | 'ASSIGNMENT'>('TEST');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [maxAttempts, setMaxAttempts] = useState(1);
    const [validUntil, setValidUntil] = useState('');
    const [isRandomized, setIsRandomized] = useState(false);

    // Builder state
    const [sections, setSections] = useState<PaperSection[]>([]);
    const [builderQs, setBuilderQs] = useState<BuilderQuestion[]>([]);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

    // Left panel filters
    const [qSearch, setQSearch] = useState('');
    const [qTypeFilter, setQTypeFilter] = useState<QuestionType | 'ALL'>('ALL');

    useEffect(() => {
        api.get(`/teacher/tasks/tests/${testId}`)
            .then(res => {
                const t: TestDetail = res.data.data;
                setTitle(t.title);
                setDescription(t.description ?? '');
                setPaperType((t.paperType ?? 'TEST') as 'TEST' | 'ASSIGNMENT');
                setDurationMinutes(t.durationMinutes);
                setMaxAttempts(t.maxAttempts);
                setValidUntil(t.validUntil ? new Date(t.validUntil).toISOString().slice(0, 16) : '');
                setIsRandomized(t.isRandomized ?? false);
                const loadedSections = (t.sections ?? []) as PaperSection[];
                const defaultSections: PaperSection[] = loadedSections.length > 0 ? loadedSections : [{
                    id: crypto.randomUUID(),
                    title: 'Section A',
                    instruction: '',
                    questionTypes: [],
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
        const section = sections.find(s => s.id === activeSectionId);
        setBuilderQs(prev => [...prev, {
            questionId: question.id,
            sectionId: paperType === 'TEST' ? (activeSectionId ?? null) : null,
            marks: section?.marksPerQuestion ?? 1,
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
        if (!title.trim()) return toast.error('Test title is required');
        setSaving(true);
        try {
            await api.put(`/teacher/tasks/tests/${testId}/paper`, {
                title,
                description: description || null,
                paperType,
                durationMinutes,
                maxAttempts,
                validUntil: validUntil ? new Date(validUntil).toISOString() : null,
                isRandomized,
                sections: paperType === 'TEST' ? sections : [],
                questions: builderQs.map((q, i) => ({
                    questionId: q.questionId,
                    sectionId: q.sectionId,
                    marks: q.marks,
                    order: i,
                    isCompulsory: q.isCompulsory,
                })),
            });
            if (activate) {
                await api.patch(`/teacher/tasks/tests/${testId}`, { status: 'ACTIVE' });
            }
            toast.success(activate ? 'Paper saved and activated' : 'Paper saved');
            onSaved();
        } catch (err) { toast.error(apiError(err)); } finally { setSaving(false); }
    };

    const addedIds = new Set(builderQs.map(q => q.questionId));
    const leftQuestions = approvedQuestions.filter(q =>
        !addedIds.has(q.id) &&
        (qTypeFilter === 'ALL' || q.type === qTypeFilter) &&
        (qSearch === '' || q.question.toLowerCase().includes(qSearch.toLowerCase()))
    );
    const totalMarks = builderQs.reduce((sum, q) => sum + q.marks, 0);

    if (loading) return (
        <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
    );

    // Global question counter across sections
    let qCounter = 0;

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            {/* Header */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border">
                <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all">
                    ← Back
                </button>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Paper title…"
                    className="flex-1 text-base font-semibold bg-transparent focus:outline-none border-b border-transparent focus:border-border/60 pb-0.5 transition-all" />
                <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5">
                    {(['TEST', 'ASSIGNMENT'] as const).map(t => (
                        <button key={t} onClick={() => setPaperType(t)}
                            className={`text-xs font-medium px-3 py-1 rounded-md transition-all ${paperType === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                            {t === 'TEST' ? 'Test' : 'Assignment'}
                        </button>
                    ))}
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
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left panel — Question bank */}
                <div className="w-[38%] border-r border-border flex flex-col overflow-hidden">
                    <div className="shrink-0 px-4 py-3 border-b border-border/50 space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Question Bank</p>
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input value={qSearch} onChange={e => setQSearch(e.target.value)} placeholder="Search questions…"
                                className="w-full text-sm pl-7 pr-3 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                            <button onClick={() => setQTypeFilter('ALL')}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all ${qTypeFilter === 'ALL' ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                                All
                            </button>
                            {(Object.entries(TYPE_META) as [QuestionType, typeof TYPE_META[QuestionType]][]).map(([type, meta]) => (
                                <button key={type} onClick={() => setQTypeFilter(qTypeFilter === type ? 'ALL' : type)}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all ${qTypeFilter === type ? `${meta.color} border-current/30` : 'border-border text-muted-foreground hover:text-foreground'}`}>
                                    {meta.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                        {leftQuestions.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-8">
                                {approvedQuestions.length === 0 ? 'No approved questions yet. Approve questions in the Questions tab first.' : 'All approved questions are in the paper.'}
                            </p>
                        ) : leftQuestions.map(q => (
                            <div key={q.id} onClick={() => addQuestionToBuilder(q)}
                                className="flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-muted/60 cursor-pointer transition-all group">
                                <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${TYPE_META[q.type]?.color}`}>{TYPE_META[q.type]?.label}</span>
                                <span className="flex-1 text-xs leading-snug line-clamp-2">{q.question}</span>
                                <Plus size={12} className="text-primary shrink-0 opacity-0 group-hover:opacity-100 mt-0.5 transition-all" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right panel — Paper document */}
                <div className="flex-1 flex flex-col overflow-hidden">
                {/* Metadata bar */}
                <div className="shrink-0 px-4 py-2.5 border-b border-border/50 flex items-center gap-4 flex-wrap text-sm">
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
                    <div className="ml-auto flex items-center gap-3">
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
                <div className="flex-1 overflow-y-auto py-8 px-6" style={{ background: '#C8BFB3', scrollbarWidth: 'thin', scrollbarColor: '#A89880 #C8BFB3' }}>

                    {/* ── The actual paper ── */}
                    <div className="max-w-3xl mx-auto shadow-2xl" style={{
                        background: '#FEFCF8',
                        border: '1px solid #D8C4A0',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                    }}>

                        {/* Paper top decorative border */}
                        <div style={{ height: 6, background: '#2A1F10' }} />
                        <div style={{ height: 2, background: '#8B6914', marginTop: 3 }} />

                        {/* Paper header */}
                        <div className="px-10 pt-6 pb-4" style={{ borderBottom: '1.5px solid #D8C4A0' }}>
                            <div className="text-center mb-4">
                                <p className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-1" style={{ color: '#8B7355' }}>
                                    {paperType === 'TEST' ? 'Examination Paper' : 'Assignment'}
                                </p>
                                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Paper Title"
                                    className="text-center text-xl font-bold w-full focus:outline-none bg-transparent"
                                    style={{ color: '#1A1208', borderBottom: '1px dashed #D8C4A0', paddingBottom: 2 }} />
                                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description / instructions for students (optional)"
                                    rows={2} className="w-full text-center text-xs mt-2 resize-none focus:outline-none bg-transparent"
                                    style={{ color: '#6B5B45', borderBottom: '1px dashed #EDE4D6' }} />
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-3" style={{ color: '#4A3728' }}>
                                <div className="flex items-center gap-6">
                                    <span><span className="font-semibold">Time:</span> {durationMinutes} min</span>
                                    <span><span className="font-semibold">Max Attempts:</span> {maxAttempts}</span>
                                    {validUntil && <span><span className="font-semibold">Valid Until:</span> {new Date(validUntil).toLocaleDateString()}</span>}
                                </div>
                                <div className="flex items-center gap-4">
                                    <span><span className="font-semibold">Total Questions:</span> {builderQs.length}</span>
                                    <span className="font-bold text-sm" style={{ color: '#8B6914' }}>Total Marks: {totalMarks}</span>
                                </div>
                            </div>
                            {isRandomized && (
                                <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: '#8B7355' }}>
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
                                        const sectionMarks = sectionQs.reduce((s, q) => s + q.marks, 0);
                                        return (
                                            <div key={section.id}>
                                                {/* Section header — click to activate */}
                                                <div className="flex items-center gap-3 px-3 py-2 cursor-pointer -mx-3 mb-3 group transition-all"
                                                    style={{ background: isActive ? '#EDE4D6' : '#F5EFE6', borderLeft: `3px solid ${isActive ? '#8B6914' : '#D8C4A0'}`, borderBottom: '1px solid #D8C4A0' }}
                                                    onClick={() => setActiveSectionId(section.id)}>
                                                    <div className="flex-1 flex items-center gap-3">
                                                        <input value={section.title} onClick={e => e.stopPropagation()}
                                                            onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
                                                            className="text-sm font-bold uppercase tracking-wider bg-transparent focus:outline-none"
                                                            style={{ color: '#2A1F10' }} />
                                                        {sectionQs.length > 0 && (
                                                            <span className="text-[10px]" style={{ color: '#8B7355' }}>
                                                                ({sectionQs.length} × {section.marksPerQuestion} = {sectionMarks} marks)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                                        <span className="text-[10px]" style={{ color: '#8B7355' }}>Marks/Q:</span>
                                                        <input type="number" min={0} max={100} value={section.marksPerQuestion}
                                                            onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, marksPerQuestion: Number(e.target.value) } : s))}
                                                            className="w-10 text-xs text-center rounded focus:outline-none"
                                                            style={{ background: '#FAF5EE', color: '#2A1F10', border: '1px solid #D8C4A0', padding: '1px 4px' }} />
                                                        {sections.length > 1 && (
                                                            <button onClick={() => removeSection(section.id)}
                                                                className="opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded"
                                                                style={{ color: '#C05050' }}>
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                        {isActive && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                                                style={{ background: '#8B6914', color: '#FAF5EE' }}>ACTIVE</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Section instruction */}
                                                <input value={section.instruction}
                                                    onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, instruction: e.target.value } : s))}
                                                    placeholder="Section instruction (e.g. Answer any five of the following)"
                                                    className="w-full text-xs italic mb-3 focus:outline-none bg-transparent"
                                                    style={{ color: '#6B5B45', borderBottom: '1px dashed transparent', paddingBottom: 2 }}
                                                    onFocus={e => e.currentTarget.style.borderBottomColor = '#D8C4A0'}
                                                    onBlur={e => e.currentTarget.style.borderBottomColor = 'transparent'} />

                                                {/* Questions */}
                                                {sectionQs.length === 0 ? (
                                                    <div className="py-4 text-center rounded" style={{ border: `1.5px dashed ${isActive ? '#C4A882' : '#D8C4A0'}`, color: isActive ? '#8B7355' : '#C4A882' }}>
                                                        <p className="text-xs">{isActive ? '← Click a question from the bank to add it here' : 'Click section header to activate, then add questions'}</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-0">
                                                        {sectionQs.map((bq, qi) => {
                                                            qCounter++;
                                                            const num = qCounter;
                                                            return (
                                                                <div key={bq.questionId} className="flex items-start gap-3 py-2.5 group transition-all"
                                                                    style={{ borderBottom: `0.5px solid #EDE4D6` }}>
                                                                    {/* Reorder */}
                                                                    <div className="flex flex-col gap-0 pt-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                                        <button onClick={() => moveQuestion(bq.questionId, 'up', section.id)} disabled={qi === 0}
                                                                            className="disabled:opacity-20 p-0.5" style={{ color: '#8B7355' }}><ArrowUp size={9} /></button>
                                                                        <button onClick={() => moveQuestion(bq.questionId, 'down', section.id)} disabled={qi === sectionQs.length - 1}
                                                                            className="disabled:opacity-20 p-0.5" style={{ color: '#8B7355' }}><ArrowDown size={9} /></button>
                                                                    </div>
                                                                    {/* Q number */}
                                                                    <span className="text-xs font-bold shrink-0 mt-0.5 w-5 text-right" style={{ color: '#8B6914' }}>Q{num}.</span>
                                                                    {/* Question text */}
                                                                    <span className="flex-1 text-[13px] leading-relaxed" style={{ color: '#1A1208' }}>{bq.question.question}</span>
                                                                    {/* Right side controls */}
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                            <input type="number" min={0} value={bq.marks}
                                                                                onChange={e => setBuilderQs(prev => prev.map(q => q.questionId === bq.questionId ? { ...q, marks: Number(e.target.value) } : q))}
                                                                                className="w-9 text-xs text-center rounded focus:outline-none"
                                                                                style={{ background: '#FAF5EE', color: '#2A1F10', border: '1px solid #D8C4A0', padding: '1px 2px' }} />
                                                                            <button onClick={() => removeQuestion(bq.questionId)} className="p-0.5 rounded transition-all" style={{ color: '#C05050' }}><X size={12} /></button>
                                                                        </div>
                                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                                                                            style={{ background: '#EDE4D6', color: '#6B5B45', border: '0.5px solid #D8C4A0' }}>
                                                                            [{bq.marks}m]
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
                                        style={{ border: '1.5px dashed #D8C4A0', color: '#8B7355', borderRadius: 4, background: 'transparent' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#8B6914'; e.currentTarget.style.color = '#8B6914'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D8C4A0'; e.currentTarget.style.color = '#8B7355'; }}>
                                        <Plus size={13} /> Add Section
                                    </button>
                                </div>
                            ) : (
                                /* Assignment — flat list */
                                <div>
                                    <div className="flex items-center justify-between mb-4" style={{ borderBottom: '1px solid #D8C4A0', paddingBottom: 8 }}>
                                        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: '#2A1F10' }}>Questions</span>
                                        <span className="text-xs" style={{ color: '#8B7355' }}>{builderQs.length} questions · {totalMarks} marks</span>
                                    </div>
                                    {builderQs.length === 0 ? (
                                        <div className="py-8 text-center rounded" style={{ border: '1.5px dashed #D8C4A0', color: '#C4A882' }}>
                                            <p className="text-xs">← Click a question from the bank to add it here</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0">
                                            {builderQs.map((bq, qi) => (
                                                <div key={bq.questionId} className="flex items-start gap-3 py-2.5 group transition-all"
                                                    style={{ borderBottom: '0.5px solid #EDE4D6' }}>
                                                    <div className="flex flex-col gap-0 pt-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                        <button onClick={() => moveQuestion(bq.questionId, 'up', null)} disabled={qi === 0}
                                                            className="disabled:opacity-20 p-0.5" style={{ color: '#8B7355' }}><ArrowUp size={9} /></button>
                                                        <button onClick={() => moveQuestion(bq.questionId, 'down', null)} disabled={qi === builderQs.length - 1}
                                                            className="disabled:opacity-20 p-0.5" style={{ color: '#8B7355' }}><ArrowDown size={9} /></button>
                                                    </div>
                                                    <span className="text-xs font-bold shrink-0 mt-0.5 w-5 text-right" style={{ color: '#8B6914' }}>Q{qi + 1}.</span>
                                                    <span className="flex-1 text-[13px] leading-relaxed" style={{ color: '#1A1208' }}>{bq.question.question}</span>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                            <input type="number" min={0} value={bq.marks}
                                                                onChange={e => setBuilderQs(prev => prev.map(q => q.questionId === bq.questionId ? { ...q, marks: Number(e.target.value) } : q))}
                                                                className="w-9 text-xs text-center rounded focus:outline-none"
                                                                style={{ background: '#FAF5EE', color: '#2A1F10', border: '1px solid #D8C4A0', padding: '1px 2px' }} />
                                                            <button onClick={() => removeQuestion(bq.questionId)} className="p-0.5" style={{ color: '#C05050' }}><X size={12} /></button>
                                                        </div>
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                                            style={{ background: '#EDE4D6', color: '#6B5B45', border: '0.5px solid #D8C4A0' }}>
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
                        <div className="px-10 py-4 flex items-center justify-between" style={{ borderTop: '1px solid #D8C4A0', background: '#FAF5EE' }}>
                            <span className="text-[10px] italic" style={{ color: '#8B7355' }}>— End of {paperType === 'TEST' ? 'Exam Paper' : 'Assignment'} —</span>
                            <span className="text-[10px]" style={{ color: '#8B7355' }}>Total: {totalMarks} marks</span>
                        </div>

                        {/* Paper bottom decorative border */}
                        <div style={{ height: 2, background: '#8B6914' }} />
                        <div style={{ height: 6, background: '#2A1F10', marginTop: 3 }} />
                    </div>

                </div>
                </div>
            </div>
        </div>
    );
}
