'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, X, Plus, Edit2, Trash2, Download,
    ChevronDown, Loader2, BookOpen, Layers, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType = 'MCQ' | 'FILL_BLANK' | 'TRUE_FALSE' | 'SHORT_ANSWER';

interface Question {
    id: string;
    type: QuestionType;
    question: string;
    options: string[] | null;
    answer: string;
    createdAt: string;
    moduleAssignment: { moduleId: string; module: { name: string } } | null;
}

interface ModuleQuestion {
    id: string;
    questionId: string;
    assignedAt: string;
    question: {
        id: string;
        type: QuestionType;
        question: string;
        options: string[] | null;
        answer: string;
        createdAt: string;
    };
}

interface TaskModule {
    id: string;
    name: string;
    description: string | null;
    questions: ModuleQuestion[];
    createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<QuestionType, { label: string; color: string }> = {
    MCQ: { label: 'MCQ', color: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300' },
    FILL_BLANK: { label: 'Fill', color: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' },
    TRUE_FALSE: { label: 'T/F', color: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' },
    SHORT_ANSWER: { label: 'Short', color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' },
};

const BTN_GRADIENT = 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)';

// ── Error helper ──────────────────────────────────────────────────────────────

function apiError(err: unknown): string {
    const data = (err as { response?: { data?: { message?: string; error?: string; errors?: { field: string; message: string }[] } } })?.response?.data;
    if (data?.errors?.length) {
        return `${data.message ?? 'Validation failed'}: ${data.errors.map(e => `${e.field} — ${e.message}`).join(', ')}`;
    }
    return data?.message ?? data?.error ?? 'Something went wrong';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TasksTabProps {
    divisionId: string;
}

export default function TasksTab({ divisionId }: TasksTabProps) {
    const [subTab, setSubTab] = useState<'questions' | 'modules'>('questions');

    // ── Questions ────────────────────────────────────────────────────────────
    const [questions, setQuestions] = useState<Question[]>([]);
    const [qLoading, setQLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<QuestionType | 'ALL'>('ALL');

    // ── Generate panel ───────────────────────────────────────────────────────
    const [generateOpen, setGenerateOpen] = useState(false);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState('');
    const [generateMore, setGenerateMore] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Edit question ────────────────────────────────────────────────────────
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [editQ, setEditQ] = useState('');
    const [editA, setEditA] = useState('');
    const [editOpts, setEditOpts] = useState<string[]>(['', '', '', '']);
    const [savingQuestion, setSavingQuestion] = useState(false);

    // ── Modules ──────────────────────────────────────────────────────────────
    const [modules, setModules] = useState<TaskModule[]>([]);
    const [mLoading, setMLoading] = useState(true);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [creatingModule, setCreatingModule] = useState(false);
    const [newModName, setNewModName] = useState('');
    const [newModDesc, setNewModDesc] = useState('');
    const [savingModule, setSavingModule] = useState(false);
    const [editingModule, setEditingModule] = useState<TaskModule | null>(null);
    const [editModName, setEditModName] = useState('');
    const [editModDesc, setEditModDesc] = useState('');
    const [assignPickerOpen, setAssignPickerOpen] = useState(false);

    const fetchedRef = useRef(false);

    // ── Data fetching ─────────────────────────────────────────────────────────

    const fetchQuestions = useCallback(async () => {
        try {
            const res = await api.get(`/teacher/tasks/questions?divisionId=${divisionId}`);
            setQuestions(res.data.data);
        } catch {
            setQuestions([]);
        } finally {
            setQLoading(false);
        }
    }, [divisionId]);

    const fetchModules = useCallback(async () => {
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
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchQuestions();
        fetchModules();
    }, [fetchQuestions, fetchModules]);

    // ── Generate questions ────────────────────────────────────────────────────

    const handleFileSelect = (file: File) => {
        if (file.type !== 'application/pdf') return toast.error('Only PDF files are accepted');
        if (file.size > 5 * 1024 * 1024) return toast.error('File must be under 5 MB');
        setPdfFile(file);
    };

    const handleGenerate = async () => {
        if (!pdfFile) return toast.error('Please select a PDF file');
        setGenerating(true);
        try {
            const form = new FormData();
            form.append('divisionId', divisionId);
            if (prompt.trim()) form.append('prompt', prompt.trim());
            if (generateMore) form.append('more', 'true');
            form.append('file', pdfFile);
            const res = await api.post('/teacher/tasks/generate', form, {
                headers: { 'Content-Type': undefined },
            });
            const newQs = res.data.data.questions as Question[];
            setQuestions(prev => [...newQs.map(q => ({ ...q, moduleAssignment: null })), ...prev]);
            toast.success(`${newQs.length} question${newQs.length !== 1 ? 's' : ''} generated`);
            if (res.data.data.truncated) {
                toast.info('PDF was too long — text was truncated to 12,000 characters');
            }
            setPdfFile(null);
            setPrompt('');
            setGenerateMore(false);
            setGenerateOpen(false);
        } catch (err) {
            toast.error(apiError(err));
        } finally {
            setGenerating(false);
        }
    };

    // ── Edit question ─────────────────────────────────────────────────────────

    const openEdit = (q: Question) => {
        setEditingQuestion(q);
        setEditQ(q.question);
        setEditA(q.answer);
        setEditOpts(Array.isArray(q.options) && q.options.length === 4 ? [...q.options] : ['', '', '', '']);
    };

    const saveEdit = async () => {
        if (!editingQuestion) return;
        setSavingQuestion(true);
        try {
            const payload: { question: string; answer: string; options?: string[] } = {
                question: editQ,
                answer: editA,
            };
            if (editingQuestion.type === 'MCQ') payload.options = editOpts;
            const res = await api.patch(`/teacher/tasks/questions/${editingQuestion.id}`, payload);
            setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? { ...q, ...res.data.data } : q));
            setEditingQuestion(null);
            toast.success('Question updated');
        } catch (err) {
            toast.error(apiError(err));
        } finally {
            setSavingQuestion(false);
        }
    };

    const deleteQuestion = async (id: string) => {
        try {
            await api.delete(`/teacher/tasks/questions/${id}`);
            setQuestions(prev => prev.filter(q => q.id !== id));
            toast.success('Question deleted');
        } catch {
            toast.error('Failed to delete question');
        }
    };

    // ── Export ────────────────────────────────────────────────────────────────

    const handleExport = async () => {
        try {
            const res = await api.get(`/teacher/tasks/questions/export?divisionId=${divisionId}`, {
                responseType: 'blob',
            });
            const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Question_Bank.pdf';
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to export question bank');
        }
    };

    // ── Module CRUD ───────────────────────────────────────────────────────────

    const createModule = async () => {
        if (!newModName.trim()) return;
        setSavingModule(true);
        try {
            const res = await api.post('/teacher/tasks/modules', {
                divisionId,
                name: newModName.trim(),
                description: newModDesc.trim() || undefined,
            });
            const mod = res.data.data as TaskModule;
            setModules(prev => [...prev, mod]);
            setSelectedModuleId(mod.id);
            setCreatingModule(false);
            setNewModName('');
            setNewModDesc('');
            toast.success('Module created');
        } catch {
            toast.error('Failed to create module');
        } finally {
            setSavingModule(false);
        }
    };

    const saveEditModule = async () => {
        if (!editingModule || !editModName.trim()) return;
        setSavingModule(true);
        try {
            const res = await api.patch(`/teacher/tasks/modules/${editingModule.id}`, {
                name: editModName.trim(),
                description: editModDesc.trim() || undefined,
            });
            setModules(prev => prev.map(m => m.id === editingModule.id ? { ...m, ...res.data.data } : m));
            setEditingModule(null);
            toast.success('Module updated');
        } catch {
            toast.error('Failed to update module');
        } finally {
            setSavingModule(false);
        }
    };

    const deleteModule = async (id: string) => {
        try {
            await api.delete(`/teacher/tasks/modules/${id}`);
            setModules(prev => prev.filter(m => m.id !== id));
            if (selectedModuleId === id) setSelectedModuleId(null);
            toast.success('Module deleted');
        } catch {
            toast.error('Failed to delete module');
        }
    };

    // ── Module-question assignment ────────────────────────────────────────────

    const assignQuestion = async (questionId: string) => {
        if (!selectedModuleId) return;
        try {
            await api.post(`/teacher/tasks/modules/${selectedModuleId}/questions`, { questionId });
            await Promise.all([fetchQuestions(), fetchModules()]);
            toast.success('Question assigned');
        } catch (err) {
            toast.error(apiError(err));
        }
    };

    const unassignQuestion = async (moduleId: string, questionId: string) => {
        try {
            await api.delete(`/teacher/tasks/modules/${moduleId}/questions/${questionId}`);
            await Promise.all([fetchQuestions(), fetchModules()]);
            toast.success('Question unassigned');
        } catch {
            toast.error('Failed to unassign question');
        }
    };

    // ── Derived values ────────────────────────────────────────────────────────

    const filteredQuestions = typeFilter === 'ALL' ? questions : questions.filter(q => q.type === typeFilter);
    const unassignedQuestions = questions.filter(q => !q.moduleAssignment);
    const selectedModule = modules.find(m => m.id === selectedModuleId) ?? null;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* Sub-tab bar */}
            <div className="shrink-0 flex items-center justify-between px-1 pt-2 pb-2">
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50">
                    {(['questions', 'modules'] as const).map(tab => {
                        const isActive = subTab === tab;
                        const label = tab === 'questions'
                            ? `Questions${questions.length > 0 ? ` (${questions.length})` : ''}`
                            : `Modules${modules.length > 0 ? ` (${modules.length})` : ''}`;
                        return (
                            <button key={tab} onClick={() => setSubTab(tab)} className="relative">
                                {isActive && (
                                    <motion.div layoutId="taskSubTab"
                                        className="absolute inset-0 bg-primary rounded-4xl"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                                )}
                                <div className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-4xl transition-colors ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {label}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {subTab === 'questions' && questions.length > 0 && (
                    <button onClick={handleExport}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-border hover:bg-muted transition-all">
                        <Download size={13} /> Export PDF
                    </button>
                )}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <AnimatePresence mode="wait">

                    {/* ── Questions sub-tab ──────────────────────────────────── */}
                    {subTab === 'questions' && (
                        <motion.div key="questions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="h-full flex flex-col overflow-hidden">

                            {/* Generate panel */}
                            <div className="shrink-0 px-1 mb-2">
                                <button onClick={() => setGenerateOpen(v => !v)}
                                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-border/60 hover:bg-muted/50 transition-all text-sm font-medium text-left">
                                    <Upload size={14} className="text-muted-foreground" />
                                    <span>Generate Questions from PDF</span>
                                    <ChevronDown size={14} className={`ml-auto text-muted-foreground transition-transform duration-200 ${generateOpen ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {generateOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden">
                                            <div className="pt-2 pb-1">
                                                <div className="border border-border rounded-xl p-3 space-y-3 bg-muted/20">
                                                    {/* PDF drop zone */}
                                                    <div
                                                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                                        onDragLeave={() => setDragging(false)}
                                                        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}>
                                                        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                                                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
                                                        {pdfFile ? (
                                                            <div className="flex items-center justify-center gap-2 text-sm">
                                                                <FileText size={16} className="text-primary shrink-0" />
                                                                <span className="font-medium truncate max-w-[220px]">{pdfFile.name}</span>
                                                                <button onClick={e => { e.stopPropagation(); setPdfFile(null); }}
                                                                    className="ml-1 p-0.5 rounded-full hover:bg-muted shrink-0">
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                                                <Upload size={18} />
                                                                <p className="text-xs">Drop PDF here or click to browse</p>
                                                                <p className="text-[10px] text-muted-foreground/60">Max 5 MB · PDF only</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Prompt */}
                                                    <textarea
                                                        value={prompt}
                                                        onChange={e => setPrompt(e.target.value)}
                                                        placeholder="Optional: describe what you want (e.g. focus on chapter 3, generate more MCQs, avoid examples)"
                                                        rows={2}
                                                        className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60" />

                                                    {/* Generate more checkbox */}
                                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                                        <div onClick={() => setGenerateMore(v => !v)}
                                                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${generateMore ? 'bg-primary border-primary' : 'border-border bg-background'}`}>
                                                            {generateMore && <Check size={10} className="text-white" />}
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            Generate more questions
                                                            {questions.length > 0 && ` (avoids repeating existing ${questions.length})`}
                                                        </span>
                                                    </label>

                                                    <button onClick={handleGenerate} disabled={!pdfFile || generating}
                                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-50"
                                                        style={{ background: BTN_GRADIENT }}>
                                                        {generating
                                                            ? <><Loader2 size={14} className="animate-spin" /> Generating...</>
                                                            : 'Generate Questions'}
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Type filter */}
                            {questions.length > 0 && (
                                <div className="shrink-0 flex gap-1.5 px-1 mb-2 flex-wrap">
                                    {(['ALL', 'MCQ', 'FILL_BLANK', 'TRUE_FALSE', 'SHORT_ANSWER'] as const).map(t => {
                                        const count = t === 'ALL' ? questions.length : questions.filter(q => q.type === t).length;
                                        const label = t === 'ALL' ? 'All' : t === 'FILL_BLANK' ? 'Fill' : t === 'TRUE_FALSE' ? 'T/F' : t === 'SHORT_ANSWER' ? 'Short' : 'MCQ';
                                        const isActive = typeFilter === t;
                                        return (
                                            <button key={t} onClick={() => setTypeFilter(t)}
                                                className={`px-3 py-0.5 rounded-full text-xs font-medium transition-all border ${isActive ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}>
                                                {label} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Question list */}
                            <div className="flex-1 min-h-0 overflow-y-auto px-1 space-y-1">
                                {qLoading ? (
                                    <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                                        <Loader2 size={16} className="animate-spin" /> Loading...
                                    </div>
                                ) : filteredQuestions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                                        <BookOpen size={32} className="text-muted-foreground/30" />
                                        <div>
                                            <p className="text-sm text-muted-foreground font-medium">No questions yet</p>
                                            <p className="text-xs text-muted-foreground/60 mt-0.5">Upload a PDF above to generate questions with AI</p>
                                        </div>
                                    </div>
                                ) : filteredQuestions.map((q, i) => (
                                    <motion.div key={q.id}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                                        className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all group">
                                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${TYPE_META[q.type].color}`}>
                                            {TYPE_META[q.type].label}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm leading-snug line-clamp-2">{q.question}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                Ans: <span className="text-foreground/70">{q.answer}</span>
                                                {q.moduleAssignment && (
                                                    <span className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                                                        {q.moduleAssignment.module.name}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEdit(q)}
                                                className="p-1.5 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground">
                                                <Edit2 size={13} />
                                            </button>
                                            <button onClick={() => deleteQuestion(q.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-950 transition-all text-muted-foreground hover:text-red-600">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ── Modules sub-tab ────────────────────────────────────── */}
                    {subTab === 'modules' && (
                        <motion.div key="modules" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="h-full flex overflow-hidden gap-3 px-1">

                            {/* Module list sidebar */}
                            <div className="w-60 shrink-0 flex flex-col gap-1.5 overflow-y-auto pr-1">
                                <button onClick={() => setCreatingModule(true)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-sm text-muted-foreground shrink-0">
                                    <Plus size={14} /> New Module
                                </button>

                                <AnimatePresence>
                                    {creatingModule && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden shrink-0">
                                            <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/20">
                                                <input value={newModName} onChange={e => setNewModName(e.target.value)}
                                                    placeholder="Module name (e.g. Chapter 1)" autoFocus
                                                    onKeyDown={e => e.key === 'Enter' && createModule()}
                                                    className="w-full text-sm bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                                                <input value={newModDesc} onChange={e => setNewModDesc(e.target.value)}
                                                    placeholder="Description (optional)"
                                                    className="w-full text-sm bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                                                <div className="flex gap-1.5">
                                                    <button onClick={createModule} disabled={!newModName.trim() || savingModule}
                                                        className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 flex items-center justify-center"
                                                        style={{ background: BTN_GRADIENT }}>
                                                        {savingModule ? <Loader2 size={12} className="animate-spin" /> : 'Create'}
                                                    </button>
                                                    <button onClick={() => { setCreatingModule(false); setNewModName(''); setNewModDesc(''); }}
                                                        className="px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-muted transition-all">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {mLoading ? (
                                    <div className="flex items-center justify-center py-6 text-muted-foreground text-xs gap-1.5">
                                        <Loader2 size={13} className="animate-spin" /> Loading...
                                    </div>
                                ) : modules.length === 0 ? (
                                    <div className="text-center py-6 text-xs text-muted-foreground">No modules yet</div>
                                ) : modules.map(m => (
                                    <button key={m.id} onClick={() => setSelectedModuleId(prev => prev === m.id ? null : m.id)}
                                        className={`text-left px-3 py-2.5 rounded-xl border transition-all group ${selectedModuleId === m.id ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:bg-muted/30'}`}>
                                        <div className="flex items-start justify-between gap-1">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{m.name}</p>
                                                {m.description && (
                                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{m.description}</p>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {m.questions.length} question{m.questions.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={e => {
                                                    e.stopPropagation();
                                                    setEditingModule(m);
                                                    setEditModName(m.name);
                                                    setEditModDesc(m.description ?? '');
                                                }}
                                                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                                                    <Edit2 size={11} />
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); deleteModule(m.id); }}
                                                    className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600">
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Module detail panel */}
                            <div className="flex-1 min-w-0 flex flex-col overflow-hidden border border-border/50 rounded-2xl">
                                {!selectedModule ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                                        <Layers size={32} className="text-muted-foreground/30" />
                                        <div>
                                            <p className="text-sm text-muted-foreground font-medium">Select a module</p>
                                            <p className="text-xs text-muted-foreground/60 mt-0.5">Or create one to organise your questions into chapters</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col h-full overflow-hidden">
                                        {/* Module header */}
                                        <div className="shrink-0 px-4 py-3 border-b border-border/50">
                                            {editingModule?.id === selectedModule.id ? (
                                                <div className="space-y-2">
                                                    <input value={editModName} onChange={e => setEditModName(e.target.value)}
                                                        className="w-full text-sm font-medium bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                                                    <input value={editModDesc} onChange={e => setEditModDesc(e.target.value)}
                                                        placeholder="Description (optional)"
                                                        className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                                                    <div className="flex gap-1.5">
                                                        <button onClick={saveEditModule} disabled={!editModName.trim() || savingModule}
                                                            className="px-3 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-50 flex items-center gap-1"
                                                            style={{ background: BTN_GRADIENT }}>
                                                            {savingModule ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
                                                        </button>
                                                        <button onClick={() => setEditingModule(null)}
                                                            className="px-3 py-1 rounded-lg text-xs border border-border hover:bg-muted transition-all">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <h3 className="font-semibold text-sm">{selectedModule.name}</h3>
                                                        {selectedModule.description && (
                                                            <p className="text-xs text-muted-foreground mt-0.5">{selectedModule.description}</p>
                                                        )}
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {selectedModule.questions.length} question{selectedModule.questions.length !== 1 ? 's' : ''} assigned
                                                        </p>
                                                    </div>
                                                    <button onClick={() => setAssignPickerOpen(v => !v)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white shrink-0"
                                                        style={{ background: BTN_GRADIENT }}>
                                                        <Plus size={12} /> Assign Questions
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Assign picker (collapsible) */}
                                        <AnimatePresence>
                                            {assignPickerOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden shrink-0">
                                                    <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                                                        <p className="text-xs font-medium text-muted-foreground mb-2">
                                                            Unassigned questions — click to assign
                                                        </p>
                                                        {unassignedQuestions.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground/70">All questions are assigned to modules</p>
                                                        ) : (
                                                            <div className="space-y-1 max-h-36 overflow-y-auto">
                                                                {unassignedQuestions.map(q => (
                                                                    <button key={q.id} onClick={() => assignQuestion(q.id)}
                                                                        className="w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                                                                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold mt-0.5 ${TYPE_META[q.type].color}`}>
                                                                            {TYPE_META[q.type].label}
                                                                        </span>
                                                                        <p className="text-xs line-clamp-1 flex-1">{q.question}</p>
                                                                        <Plus size={11} className="shrink-0 text-muted-foreground group-hover:text-primary mt-0.5" />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Module questions list */}
                                        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1.5">
                                            {selectedModule.questions.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                                                    <p className="text-sm text-muted-foreground">No questions in this module</p>
                                                    <p className="text-xs text-muted-foreground/60">Click &quot;Assign Questions&quot; to add from your bank</p>
                                                </div>
                                            ) : selectedModule.questions.map((mq, i) => (
                                                <motion.div key={mq.id}
                                                    initial={{ opacity: 0, y: 4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                                                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all group">
                                                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${TYPE_META[mq.question.type].color}`}>
                                                        {TYPE_META[mq.question.type].label}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm leading-snug line-clamp-2">{mq.question.question}</p>
                                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                            Ans: <span className="text-foreground/70">{mq.question.answer}</span>
                                                        </p>
                                                    </div>
                                                    <button onClick={() => unassignQuestion(selectedModule.id, mq.question.id)}
                                                        className="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition-all">
                                                        <X size={13} />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* ── Edit question modal ──────────────────────────────────────── */}
            <AnimatePresence>
                {editingQuestion && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={e => { if (e.target === e.currentTarget) setEditingQuestion(null); }}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
                            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TYPE_META[editingQuestion.type].color}`}>
                                        {TYPE_META[editingQuestion.type].label}
                                    </span>
                                    <h3 className="font-semibold text-sm">Edit Question</h3>
                                </div>
                                <button onClick={() => setEditingQuestion(null)}
                                    className="p-1 rounded-lg hover:bg-muted transition-all">
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <textarea value={editQ} onChange={e => setEditQ(e.target.value)} rows={3}
                                    placeholder="Question text"
                                    className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50" />

                                {editingQuestion.type === 'MCQ' && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs text-muted-foreground font-medium">Options</p>
                                        {editOpts.map((opt, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground w-5 shrink-0">{String.fromCharCode(97 + i)})</span>
                                                <input value={opt}
                                                    onChange={e => setEditOpts(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                                                    className="flex-1 text-sm bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-1.5">Answer</p>
                                    {editingQuestion.type === 'MCQ' ? (
                                        <select value={editA} onChange={e => setEditA(e.target.value)}
                                            className="w-full text-sm bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50">
                                            <option value="">Select correct answer</option>
                                            {editOpts.filter(Boolean).map((opt, i) => (
                                                <option key={i} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : editingQuestion.type === 'TRUE_FALSE' ? (
                                        <select value={editA} onChange={e => setEditA(e.target.value)}
                                            className="w-full text-sm bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50">
                                            <option value="true">True</option>
                                            <option value="false">False</option>
                                        </select>
                                    ) : (
                                        <input value={editA} onChange={e => setEditA(e.target.value)}
                                            className="w-full text-sm bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <button onClick={saveEdit} disabled={!editQ.trim() || !editA.trim() || savingQuestion}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                                    style={{ background: BTN_GRADIENT }}>
                                    {savingQuestion ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save Changes'}
                                </button>
                                <button onClick={() => setEditingQuestion(null)}
                                    className="px-4 py-2 rounded-xl text-sm border border-border hover:bg-muted transition-all">
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
