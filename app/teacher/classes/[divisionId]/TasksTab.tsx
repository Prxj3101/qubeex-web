'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, X, Plus, Edit2, Trash2, Download,
    Loader2, BookOpen, Layers, Check, X as XIcon,
    Clock, Link2, Play, Eye, ChevronDown, ChevronUp,
    FlaskConical, Brain, Users, Copy, CheckCircle2, AlertCircle,
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
    _count: { attempts: number };
}

interface Test extends TestBase {
    questions: { id: string; isCompulsory: boolean }[];
}

interface TestDetailQuestion {
    id: string;
    isCompulsory: boolean;
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
    const [selectedTest, setSelectedTest] = useState<Test | null>(null);
    const [testDetail, setTestDetail] = useState<TestDetail | null>(null);
    const [addQOpen, setAddQOpen] = useState(false);
    const [copiedLink, setCopiedLink] = useState<string | null>(null);

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
        if (subTab === 'modules' && modules.length === 0) fetchModules();
    }, [subTab, tests.length, modules.length, fetchTests, fetchModules]);

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
        if (newTest.numberOfQuestions < 1) return toast.error('Number of questions must be at least 1');
        setSavingTest(true);
        try {
            const payload: Record<string, unknown> = {
                divisionId, title: newTest.title, description: newTest.description || undefined,
                durationMinutes: newTest.durationMinutes, marksPerQuestion: newTest.marksPerQuestion,
                numberOfQuestions: newTest.numberOfQuestions, maxAttempts: newTest.maxAttempts,
            };
            if (newTest.validUntil) payload.validUntil = new Date(newTest.validUntil).toISOString();
            const res = await api.post('/teacher/tasks/tests', payload);
            setTests(prev => [res.data.data, ...prev]);
            toast.success('Test created');
            setCreateTestOpen(false);
            setNewTest({ title: '', description: '', durationMinutes: 60, marksPerQuestion: 1, numberOfQuestions: 10, maxAttempts: 1, validUntil: '' });
        } catch (err) { toast.error(apiError(err)); } finally { setSavingTest(false); }
    };

    const updateTestStatus = async (test: Test, status: TestStatus) => {
        try {
            const res = await api.patch(`/teacher/tasks/tests/${test.id}`, { status });
            setTests(prev => prev.map(t => t.id === test.id ? { ...t, ...res.data.data } : t));
            if (selectedTest?.id === test.id) setSelectedTest(prev => prev ? { ...prev, status } : null);
            toast.success(status === 'ACTIVE' ? 'Test activated — link is now live' : 'Test completed');
        } catch (err) { toast.error(apiError(err)); }
    };

    const deleteTest = async (id: string) => {
        try {
            await api.delete(`/teacher/tasks/tests/${id}`);
            setTests(prev => prev.filter(t => t.id !== id));
            if (selectedTest?.id === id) setSelectedTest(null);
            toast.success('Test deleted');
        } catch (err) { toast.error(apiError(err)); }
    };

    const openTestDetail = async (test: Test) => {
        setSelectedTest(test);
        try {
            const res = await api.get(`/teacher/tasks/tests/${test.id}`);
            setTestDetail(res.data.data);
        } catch (err) { toast.error(apiError(err)); }
    };

    const addQToTest = async (questionId: string, isCompulsory: boolean) => {
        if (!testDetail) return;
        try {
            await api.post(`/teacher/tasks/tests/${testDetail.id}/questions`, { questionId, isCompulsory });
            const res = await api.get(`/teacher/tasks/tests/${testDetail.id}`);
            setTestDetail(res.data.data);
            toast.success('Question added');
        } catch (err) { toast.error(apiError(err)); }
    };

    const removeQFromTest = async (questionId: string) => {
        if (!testDetail) return;
        try {
            await api.delete(`/teacher/tasks/tests/${testDetail.id}/questions/${questionId}`);
            setTestDetail(prev => prev ? { ...prev, questions: prev.questions.filter(tq => tq.question.id !== questionId) } : null);
            toast.success('Question removed');
        } catch (err) { toast.error(apiError(err)); }
    };

    const copyLink = (testLink: string) => {
        const url = getQuizUrl(testLink);
        navigator.clipboard.writeText(url);
        setCopiedLink(testLink);
        toast.success('Quiz link copied');
        setTimeout(() => setCopiedLink(null), 2000);
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
                                {displayedQuestions.map(q => <QuestionCard key={q.id} question={q} onApprove={() => updateStatus(q.id, 'APPROVED')} onReject={() => updateStatus(q.id, 'REJECTED')} onDelete={() => deleteQuestion(q.id)} />)}
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
                        ) : selectedTest ? (
                            <TestDetailView
                                test={testDetail}
                                allApprovedQuestions={approvedQuestions}
                                onBack={() => { setSelectedTest(null); setTestDetail(null); setAddQOpen(false); }}
                                onActivate={() => updateTestStatus(selectedTest, 'ACTIVE')}
                                onComplete={() => updateTestStatus(selectedTest, 'COMPLETED')}
                                onAddQuestion={addQToTest}
                                onRemoveQuestion={removeQFromTest}
                                onCopyLink={() => testDetail && copyLink(testDetail.testLink)}
                                copiedLink={copiedLink}
                                addQOpen={addQOpen}
                                setAddQOpen={setAddQOpen}
                            />
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {tests.map(test => (
                                    <TestCard key={test.id} test={test}
                                        onOpen={() => openTestDetail(test)}
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
        </div>
    );
}

// ── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({ question, onApprove, onReject, onDelete }: {
    question: Question;
    onApprove: () => void;
    onReject: () => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
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
                <button onClick={onDelete} className="ml-auto text-muted-foreground hover:text-red-500 p-1 rounded transition-all">
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

// ── Test Detail View ──────────────────────────────────────────────────────────

function TestDetailView({
    test, allApprovedQuestions, onBack, onActivate, onComplete,
    onAddQuestion, onRemoveQuestion, onCopyLink, copiedLink, addQOpen, setAddQOpen,
}: {
    test: TestDetail | null;
    allApprovedQuestions: Question[];
    onBack: () => void;
    onActivate: () => void;
    onComplete: () => void;
    onAddQuestion: (qId: string, isCompulsory: boolean) => void;
    onRemoveQuestion: (qId: string) => void;
    onCopyLink: () => void;
    copiedLink: string | null;
    addQOpen: boolean;
    setAddQOpen: (v: boolean) => void;
}) {
    if (!test) return <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm"><Loader2 size={16} className="animate-spin" />Loading test…</div>;

    const alreadyAddedIds = new Set(test.questions.map(tq => tq.question.id));
    const availableQuestions = allApprovedQuestions.filter(q => !alreadyAddedIds.has(q.id));
    const statusColor = { DRAFT: 'text-muted-foreground bg-muted', ACTIVE: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950', COMPLETED: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950' }[test.status];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-muted transition-all">
                    ← Back
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h2 className="font-semibold">{test.title}</h2>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${statusColor}`}>{test.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span><Clock size={11} className="inline mr-0.5" />{test.durationMinutes} min</span>
                        <span>{test.marksPerQuestion} mark/q</span>
                        <span>Need {test.numberOfQuestions} questions ({test.questions.length} added)</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {test.status === 'ACTIVE' && (
                        <button onClick={onCopyLink} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                            {copiedLink === test.testLink ? <><CheckCircle2 size={13} /> Copied!</> : <><Link2 size={13} /> Copy Quiz Link</>}
                        </button>
                    )}
                    {test.status === 'DRAFT' && test.questions.length >= test.numberOfQuestions && (
                        <button onClick={onActivate} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                            <Play size={13} /> Activate Test
                        </button>
                    )}
                    {test.status === 'ACTIVE' && (
                        <button onClick={onComplete} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all">
                            Mark Complete
                        </button>
                    )}
                </div>
            </div>

            {test.status === 'DRAFT' && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${test.questions.length >= test.numberOfQuestions ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'}`}>
                    {test.questions.length >= test.numberOfQuestions ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    {test.questions.length >= test.numberOfQuestions
                        ? `Ready — you have ${test.questions.length} questions (${test.numberOfQuestions} required). Activate to publish.`
                        : `Add ${test.numberOfQuestions - test.questions.length} more question${test.numberOfQuestions - test.questions.length !== 1 ? 's' : ''} before activating.`}
                </div>
            )}

            {/* Questions in test */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Questions in Test ({test.questions.length})</span>
                    {test.status !== 'COMPLETED' && (
                        <button onClick={() => setAddQOpen(!addQOpen)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-muted transition-all">
                            <Plus size={11} /> Add Question
                        </button>
                    )}
                </div>
                {test.questions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3">No questions added yet. Click &quot;Add Question&quot; to add from your approved question bank.</p>
                ) : (
                    <div className="space-y-1.5">
                        {test.questions.map(tq => (
                            <div key={tq.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card/50">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${TYPE_META[tq.question.type]?.color ?? 'bg-muted text-muted-foreground'}`}>{TYPE_META[tq.question.type]?.label}</span>
                                <span className="flex-1 text-sm truncate">{tq.question.question}</span>
                                {tq.isCompulsory && <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">Required</span>}
                                {test.status !== 'COMPLETED' && (
                                    <button onClick={() => onRemoveQuestion(tq.question.id)} className="text-muted-foreground hover:text-red-500 transition-all">
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add question picker */}
            <AnimatePresence>
                {addQOpen && availableQuestions.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="p-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 space-y-1.5 max-h-64 overflow-y-auto">
                        <p className="text-xs text-muted-foreground font-medium mb-2">Click a question to add it</p>
                        {availableQuestions.map(q => (
                            <div key={q.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-all"
                                onClick={() => onAddQuestion(q.id, false)}>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${TYPE_META[q.type]?.color}`}>{TYPE_META[q.type]?.label}</span>
                                <span className="flex-1 text-xs truncate">{q.question}</span>
                                <Plus size={12} className="text-primary shrink-0" />
                            </div>
                        ))}
                    </motion.div>
                )}
                {addQOpen && availableQuestions.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
                        No approved questions available to add. Approve questions in the Questions tab first.
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
