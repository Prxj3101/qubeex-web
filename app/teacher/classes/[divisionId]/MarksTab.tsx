'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, BookOpen, ChevronDown, Plus, X, Pencil, Save, Trophy, Flag, ExternalLink,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Student { id: string; name: string; rollNo: string; }

interface Exam {
    id: string;
    name: string;
    maxMarks: number;
    type: 'online' | 'offline';
    date?: string; // DD Mon YYYY format, for online tests
}

interface Subject {
    id: string;
    name: string;
    code: string;
    color: string;
}

type GradeValue = 'A+' | 'A' | 'B' | 'C' | 'D' | null;
interface GradedSubject { id: string; name: string; }

const GRADE_OPTIONS: { val: GradeValue; color: string; label: string }[] = [
    { val: 'A+', color: '#059669', label: 'Outstanding' },
    { val: 'A', color: '#16a34a', label: 'Excellent' },
    { val: 'B', color: '#F59E0B', label: 'Good' },
    { val: 'C', color: '#d97706', label: 'Satisfactory' },
    { val: 'D', color: '#DC2626', label: 'Needs Improvement' },
];
function gradeValColor(g: GradeValue) {
    return GRADE_OPTIONS.find(o => o.val === g)?.color ?? '#D8C4A0';
}

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_STUDENTS: Student[] = [
    { id: 'st1', name: 'Aarav Mehta', rollNo: '01' },
    { id: 'st2', name: 'Priya Singh', rollNo: '02' },
    { id: 'st3', name: 'Rohan Gupta', rollNo: '03' },
    { id: 'st4', name: 'Sneha Patel', rollNo: '04' },
    { id: 'st5', name: 'Arjun Kumar', rollNo: '05' },
    { id: 'st6', name: 'Meera Sharma', rollNo: '06' },
    { id: 'st7', name: 'Karan Joshi', rollNo: '07' },
    { id: 'st8', name: 'Ananya Nair', rollNo: '08' },
    { id: 'st9', name: 'Vikram Rao', rollNo: '09' },
    { id: 'st10', name: 'Ishaan Verma', rollNo: '10' },
    { id: 'st11', name: 'Divya Reddy', rollNo: '11' },
    { id: 'st12', name: 'Sahil Khan', rollNo: '12' },
];

const MOCK_SUBJECTS: Subject[] = [
    { id: 's1', name: 'English', code: 'ENG', color: '#DA7756' },
    { id: 's2', name: 'Hindi', code: 'HIN', color: '#EC4899' },
    { id: 's3', name: 'Marathi', code: 'MAR', color: '#0891B2' },
    { id: 's4', name: 'Algebra', code: 'ALG', color: '#7C3AED' },
    { id: 's5', name: 'Geometry', code: 'GEO', color: '#059669' },
    { id: 's6', name: 'Science 1', code: 'SC1', color: '#0EA5E9' },
    { id: 's7', name: 'Science 2', code: 'SC2', color: '#6366F1' },
    { id: 's8', name: 'History', code: 'HIS', color: '#D97706' },
    { id: 's9', name: 'Geography', code: 'GEOG', color: '#16A34A' },
];

// ── Offline exams (teacher-defined, same for all subjects) ────────────────────
const OFFLINE_EXAMS: Exam[] = [
    { id: 'oe1', name: 'Unit Test 1', maxMarks: 20, type: 'offline' },
    { id: 'oe2', name: 'Oral 1', maxMarks: 10, type: 'offline' },
    { id: 'oe3', name: 'Mid Sem', maxMarks: 70, type: 'offline' },
    { id: 'oe4', name: 'Unit Test 2', maxMarks: 20, type: 'offline' },
    { id: 'oe5', name: 'Oral 2', maxMarks: 10, type: 'offline' },
    { id: 'oe6', name: 'Final Exam', maxMarks: 70, type: 'offline' },
];

// ── Online exams (auto from QubeEx, subject-specific) ────────────────────────
// Placeholder entries — real data will come from API later
const ONLINE_EXAM_TEMPLATE: Exam[] = [
    { id: 'ot1', name: 'Weekly Test 1', maxMarks: 20, type: 'online', date: '10 Jul 2026' },
    { id: 'ot2', name: 'Ch 1–3 Test', maxMarks: 25, type: 'online', date: '28 Jul 2026' },
    { id: 'ot3', name: 'Weekly Test 2', maxMarks: 20, type: 'online', date: '18 Aug 2026' },
    { id: 'ot4', name: 'Ch 4–6 Test', maxMarks: 30, type: 'online', date: '05 Sep 2026' },
];
const ONLINE_EXAMS: Record<string, Exam[]> = Object.fromEntries(
    MOCK_SUBJECTS.map(sub => [
        sub.id,
        ONLINE_EXAM_TEMPLATE.map(ex => ({ ...ex, id: `${ex.id}-${sub.id}` })),
    ])
);

// ── Mock Scores — offline ─────────────────────────────────────────────────────
// scores[subjectId][studentId][examId] = marks
function genOfflineScores(): Record<string, Record<string, Record<string, number | null>>> {
    const base: Record<string, Record<string, Record<string, number | null>>> = {};
    MOCK_SUBJECTS.forEach(sub => {
        base[sub.id] = {};
        MOCK_STUDENTS.forEach(st => {
            base[sub.id][st.id] = {};
            OFFLINE_EXAMS.forEach(ex => {
                const max = ex.maxMarks;
                base[sub.id][st.id][ex.id] = Math.floor(Math.random() * (max * 0.4) + max * 0.5);
            });
        });
    });
    return base;
}

function genOnlineScores(): Record<string, Record<string, Record<string, number | null>>> {
    const base: Record<string, Record<string, Record<string, number | null>>> = {};
    MOCK_SUBJECTS.forEach(sub => {
        base[sub.id] = {};
        MOCK_STUDENTS.forEach(st => {
            base[sub.id][st.id] = {};
            (ONLINE_EXAMS[sub.id] ?? []).forEach(ex => {
                const max = ex.maxMarks;
                base[sub.id][st.id][ex.id] = Math.floor(Math.random() * (max * 0.4) + max * 0.5);
            });
        });
    });
    return base;
}

// Per-subject exam lists (each subject starts with OFFLINE_EXAMS, then diverges)
function initSubjectExams(subjects: Subject[]): Record<string, Exam[]> {
    const r: Record<string, Exam[]> = {};
    subjects.forEach(sub => { r[sub.id] = [...OFFLINE_EXAMS]; });
    return r;
}

// Stable initial data (outside component to avoid re-gen on render)
const INITIAL_OFFLINE = genOfflineScores();
const INITIAL_ONLINE = genOnlineScores();
const INITIAL_SUBJECT_EXAMS = initSubjectExams(MOCK_SUBJECTS);

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
function getAvatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(n: string) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

function scoreColor(pct: number) {
    if (pct >= 75) return '#059669';  // ≥75% — green
    if (pct >= 35) return '#F59E0B';  // 35–74% — amber
    return '#DC2626';                 // <35% — red
}

function grade(pct: number) {
    if (pct >= 75) return 'A';
    if (pct >= 61) return 'B';
    if (pct >= 35) return 'C';
    return 'D';
}

// ── Exam Edit Modal (offline only) ───────────────────────────────────────────
function ExamEditModal({
    exam, onSave, onDelete, onClose,
}: {
    exam: Exam;
    onSave: (name: string, maxMarks: number) => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(exam.name);
    const [max, setMax] = useState(String(exam.maxMarks));
    const [confirmDel, setConfirmDel] = useState(false);

    const valid = name.trim().length > 0 && parseFloat(max) > 0;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-2xl p-5 max-w-xs w-full mx-4 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold">✏️ Edit Exam</p>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                        <X size={14} />
                    </button>
                </div>

                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Exam Name</label>
                <input
                    autoFocus value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all mb-3"
                />

                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Max Marks</label>
                <input
                    type="number" min={1} value={max} onChange={e => setMax(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all mb-4"
                />

                {confirmDel ? (
                    <div className="mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                        <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mb-2">Delete this exam? All scores will be lost.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDel(false)}
                                className="flex-1 h-8 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                                Cancel
                            </button>
                            <button onClick={() => { onDelete(); onClose(); }}
                                className="flex-1 h-8 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-all">
                                Delete
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => setConfirmDel(true)}
                            className="h-9 px-3 rounded-xl border border-red-200 dark:border-red-800 text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all flex items-center gap-1">
                            🗑 Delete
                        </button>
                        <button onClick={onClose}
                            className="flex-1 h-9 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                            Cancel
                        </button>
                        <button onClick={() => { if (valid) { onSave(name.trim(), parseFloat(max)); onClose(); } }}
                            disabled={!valid}
                            className="flex-1 h-9 rounded-xl text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-all"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            Save
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

// ── Add Exam Modal (offline only) ─────────────────────────────────────────────
function AddExamModal({
    onSave, onClose, existingNames,
}: {
    onSave: (name: string, max: number) => void;
    onClose: () => void;
    existingNames: string[];
}) {
    const [name, setName] = useState('');
    const [max, setMax] = useState('40');

    const presets = ['Unit Test', 'Oral', 'Mid Sem', 'Final Sem', 'Prelim', 'Practice Test'];
    const valid = name.trim().length > 0 && !existingNames.includes(name.trim()) && parseFloat(max) > 0;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold">➕ Add Exam</p>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                        <X size={14} />
                    </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                    {presets.map(p => (
                        <button key={p} onClick={() => setName(p)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all
                                ${name === p ? 'bg-[#1B3D7A] text-white border-[#1B3D7A]' : 'border-border/50 text-muted-foreground hover:border-[#1B3D7A]/40 hover:text-[#1B3D7A]'}`}>
                            {p}
                        </button>
                    ))}
                </div>

                <input value={name} onChange={e => setName(e.target.value)} placeholder="Exam name"
                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all mb-2" />

                <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs text-muted-foreground shrink-0">Max Marks:</span>
                    <input type="number" value={max} onChange={e => setMax(e.target.value)} min={1} max={200}
                        className="flex-1 h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                </div>

                <button onClick={() => { if (valid) { onSave(name.trim(), parseFloat(max)); onClose(); } }}
                    disabled={!valid}
                    className="w-full h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                    Add Exam Column
                </button>
            </motion.div>
        </div>
    );
}

// ── Graded Subject Modal ──────────────────────────────────────────────────────
function GradedSubjectModal({
    existing, onSave, onDelete, onClose,
}: {
    existing?: GradedSubject;
    onSave: (name: string) => void;
    onDelete?: () => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(existing?.name ?? '');
    const presets = ['Art & Craft', 'Physical Education', 'Work Education', 'Music', 'Dance', 'Yoga', 'Computer'];
    const valid = name.trim().length > 0;
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold">{existing ? '✏️ Edit Subject' : '➕ Add Graded Subject'}</p>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"><X size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {presets.map(p => (
                        <button key={p} onClick={() => setName(p)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all
                                ${name === p ? 'bg-primary text-white border-primary' : 'border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary'}`}>
                            {p}
                        </button>
                    ))}
                </div>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Subject name"
                    className="w-full h-9 px-3 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50 transition-all mb-4" />
                <div className="flex gap-2">
                    {existing && onDelete && (
                        <button onClick={() => { onDelete(); onClose(); }}
                            className="flex-1 h-9 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                            style={{ background: '#DC2626' }}>
                            Delete
                        </button>
                    )}
                    <button onClick={() => { if (valid) { onSave(name.trim()); onClose(); } }} disabled={!valid}
                        className="flex-1 h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        {existing ? 'Save' : 'Add Subject'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}


export type MarksStats = {
    avg: number | null;
    topGrade: string | null;
    pill1Label?: string;
    pill2Label?: string;
    pill2Value?: string;
    pill2Color?: string;
};

export type MarksSubTab = 'offline' | 'online' | 'overall';

// ── Mark Sheet (Right Panel) — ALL subjects in one sheet ─────────────────────
function MarkSheet({
    students, subjects, mode, divisionName, isActive, onStatsChange, restrictToSubjectId, readOnly,
}: {
    students: Student[];
    subjects: Subject[];
    mode: 'online' | 'offline';
    divisionName: string;
    isActive: boolean;
    onStatsChange?: (stats: MarksStats) => void;
    restrictToSubjectId?: string | null;
    readOnly?: boolean;
}) {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth();
    const academicYear = mo >= 5 ? `${yr}–${String(yr + 1).slice(2)}` : `${yr - 1}–${String(yr).slice(2)}`;

    const isRestricted = (subId: string) => !!restrictToSubjectId && subId !== restrictToSubjectId;

    const msColors = {
        bg: '#F8F3EC',
        hdrBg: '#EDE4D6',
        hdrText: '#2A1F10',
        hdrBorder: '#D8C4A0',
        cellBorder: '#D8C4A0',
        rowBase: '#FAF5EE',
        rowAlt: '#FAF5EE',
        stickyBg: '#F8F3EC',
        summaryBg: '#E8DDD0',
        subHdrBg: (color: string) => color + '18',
        subHdrText: (color: string) => color,
    };

    const SAVE_KEY = `marksheet_${divisionName}_${mode}`;

    const loadSaved = () => {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    };

    const saved = loadSaved();

    const [offlineScores, setOfflineScores] = useState<Record<string, Record<string, Record<string, number | null>>>>(saved?.offlineScores ?? INITIAL_OFFLINE);
    const [onlineScores, setOnlineScores] = useState<Record<string, Record<string, Record<string, number | null>>>>(saved?.onlineScores ?? INITIAL_ONLINE);
    const [subjectExams, setSubjectExams] = useState<Record<string, Exam[]>>(saved?.subjectExams ?? initSubjectExams(subjects));
    const [editExamCtx, setEditExamCtx] = useState<{ exam: Exam; subId: string } | null>(null);
    const [addExamSubId, setAddExamSubId] = useState<string | null>(null);
    const [dragExam, setDragExam] = useState<{ subId: string; examId: string } | null>(null);
    const [dragOverExam, setDragOverExam] = useState<{ subId: string; examId: string } | null>(null);
    const [dragGraded, setDragGraded] = useState<string | null>(null);
    const [dragOverGraded, setDragOverGraded] = useState<string | null>(null);
    const [activeCell, setActiveCell] = useState<{ subId: string; stId: string; examId: string } | null>(null);
    const [draftVal, setDraftVal] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const [gradedSubjects, setGradedSubjects] = useState<GradedSubject[]>(saved?.gradedSubjects ?? [
        { id: 'gs1', name: 'PT' },
        { id: 'gs2', name: 'SG' },
        { id: 'gs3', name: 'ICT' },
    ]);
    const [gradedScores, setGradedScores] = useState<Record<string, Record<string, { t1: GradeValue; t2: GradeValue }>>>(saved?.gradedScores ?? {});
    const [activeGradeCell, setActiveGradeCell] = useState<{ gsId: string; stId: string; term: 't1' | 't2' } | null>(null);
    const [gradeDraft, setGradeDraft] = useState('');
    const gradeInputRef = useRef<HTMLInputElement>(null);
    const [addGradedOpen, setAddGradedOpen] = useState(false);
    const [editGradedSub, setEditGradedSub] = useState<GradedSubject | null>(null);
    const [gradedSectionTitle, setGradedSectionTitle] = useState(saved?.gradedSectionTitle ?? 'Graded Subjects');
    const [editingGradedTitle, setEditingGradedTitle] = useState(false);
    const [gradedTitleDraft, setGradedTitleDraft] = useState('');
    const gradedTitleInputRef = useRef<HTMLInputElement>(null);

    const getGrade = (gsId: string, stId: string, term: 't1' | 't2'): GradeValue =>
        gradedScores[gsId]?.[stId]?.[term] ?? null;
    const setGradeVal = (gsId: string, stId: string, term: 't1' | 't2', val: GradeValue) => {
        setGradedScores(prev => ({
            ...prev,
            [gsId]: { ...prev[gsId], [stId]: { ...prev[gsId]?.[stId], [term]: val } },
        }));
    };
    const startGradeEdit = (gsId: string, stId: string, term: 't1' | 't2', current: GradeValue) => {
        setActiveGradeCell({ gsId, stId, term });
        setGradeDraft(current ?? '');
        setTimeout(() => gradeInputRef.current?.select(), 0);
    };
    const commitGradeEdit = (gsId: string, stId: string, term: 't1' | 't2') => {
        const upper = gradeDraft.trim().toUpperCase() as GradeValue;
        const valid: GradeValue[] = ['A+', 'A', 'B', 'C', 'D'];
        setGradeVal(gsId, stId, term, valid.includes(upper) ? upper : null);
        setActiveGradeCell(null);
    };

    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const saveData = () => {
        setSaveStatus('saving');
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify({
                offlineScores, onlineScores, subjectExams,
                gradedSubjects, gradedScores, gradedSectionTitle,
            }));
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch { setSaveStatus('idle'); }
    };

    // Auto-save: 2s debounce after any data change (only when this mode is active)
    useEffect(() => {
        if (!isActive) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => { saveData(); }, 2000);
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offlineScores, onlineScores, subjectExams, gradedSubjects, gradedScores, gradedSectionTitle, isActive]);

    // Report high/low to parent when active
    useEffect(() => {
        if (!isActive || !onStatsChange) return;
        const pcts = students.map(st => getGrandTotal(st.id).pct).filter((p): p is number => p !== null);
        if (pcts.length === 0) { onStatsChange({ avg: null, topGrade: null }); return; }
        const high = Math.max(...pcts);
        const low = Math.min(...pcts);
        const modeLabel = mode === 'offline' ? 'Offline' : 'Online';
        onStatsChange({
            avg: high,
            topGrade: null,
            pill1Label: `${modeLabel} High`,
            pill2Label: `${modeLabel} Low`,
            pill2Value: `${low}%`,
            pill2Color: scoreColor(low),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offlineScores, onlineScores, isActive]);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node))
                setShowExportMenu(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const getSubjectExams = (subId: string): Exam[] =>
        mode === 'offline'
            ? (subjectExams[subId] ?? [])
            : (ONLINE_EXAMS[subId] ?? ONLINE_EXAM_TEMPLATE.map(ex => ({ ...ex, id: `${ex.id}-${subId}` })));

    const getScore = (subId: string, stId: string, examId: string): number | null => {
        const store = mode === 'offline' ? offlineScores : onlineScores;
        return store[subId]?.[stId]?.[examId] ?? null;
    };

    const setScore = (subId: string, stId: string, examId: string, val: number | null) => {
        if (mode === 'offline') {
            setOfflineScores(prev => ({
                ...prev,
                [subId]: { ...prev[subId], [stId]: { ...prev[subId]?.[stId], [examId]: val } },
            }));
        } else {
            setOnlineScores(prev => ({
                ...prev,
                [subId]: { ...prev[subId], [stId]: { ...prev[subId]?.[stId], [examId]: val } },
            }));
        }
    };

    const handleExamDrop = (targetSubId: string, targetExamId: string) => {
        if (!dragExam || dragExam.subId !== targetSubId || dragExam.examId === targetExamId) return;
        setSubjectExams(prev => {
            const exams = [...(prev[targetSubId] ?? [])];
            const fromIdx = exams.findIndex(e => e.id === dragExam.examId);
            const toIdx = exams.findIndex(e => e.id === targetExamId);
            if (fromIdx === -1 || toIdx === -1) return prev;
            const [moved] = exams.splice(fromIdx, 1);
            exams.splice(toIdx, 0, moved);
            return { ...prev, [targetSubId]: exams };
        });
        setDragExam(null);
        setDragOverExam(null);
    };

    const handleGradedDrop = (targetGsId: string) => {
        if (!dragGraded || dragGraded === targetGsId) return;
        setGradedSubjects(prev => {
            const arr = [...prev];
            const fromIdx = arr.findIndex(g => g.id === dragGraded);
            const toIdx = arr.findIndex(g => g.id === targetGsId);
            if (fromIdx === -1 || toIdx === -1) return prev;
            const [moved] = arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, moved);
            return arr;
        });
        setDragGraded(null);
        setDragOverGraded(null);
    };

    const getSubjectTotal = (subId: string, stId: string) => {
        const exams = getSubjectExams(subId);
        const total = exams.reduce((s, ex) => s + ex.maxMarks, 0);
        const scored = exams.reduce((s, ex) => s + (getScore(subId, stId, ex.id) ?? 0), 0);
        const enteredTotal = exams.reduce((s, ex) => {
            const sc = getScore(subId, stId, ex.id);
            return sc !== null ? s + ex.maxMarks : s;
        }, 0);
        return { total, scored, enteredTotal };
    };

    const getGrandTotal = (stId: string) => {
        let total = 0, scored = 0, enteredTotal = 0;
        subjects.forEach(sub => {
            const t = getSubjectTotal(sub.id, stId);
            total += t.total;
            scored += t.scored;
            enteredTotal += t.enteredTotal;
        });
        return { total, scored, pct: enteredTotal > 0 ? Math.round((scored / enteredTotal) * 100) : null };
    };

    const handleExport = () => {
        const examCols = subjects.flatMap(sub =>
            getSubjectExams(sub.id).map(ex => `${sub.code}-${ex.name}(/${ex.maxMarks})`)
        );
        const headers = ['Roll', 'Name', ...examCols,
            ...subjects.flatMap(sub => [`${sub.code} Total`, `${sub.code} %`]),
            'Grand Total', 'Overall %', 'Grade'];
        const rows = students.map(st => {
            const scoreCells = subjects.flatMap(sub =>
                getSubjectExams(sub.id).map(ex => getScore(sub.id, st.id, ex.id) ?? '—')
            );
            const subTotals = subjects.flatMap(sub => {
                const { total, scored } = getSubjectTotal(sub.id, st.id);
                const p = total > 0 ? Math.round((scored / total) * 100) : null;
                return [`${scored}/${total}`, p !== null ? `${p}%` : '—'];
            });
            const grand = getGrandTotal(st.id);
            return [st.rollNo, st.name, ...scoreCells, ...subTotals,
            `${grand.scored}/${grand.total}`,
            grand.pct !== null ? `${grand.pct}%` : '—',
            grand.pct !== null ? grade(grand.pct) : '—'];
        });
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${mode === 'offline' ? 'Offline' : 'Online'}_All`);
        XLSX.writeFile(wb, `MarksSheet_${divisionName}_${mode}.xlsx`);
        setShowExportMenu(false);
    };

    const GRADE_W = 52;
    const PCT_W = 56;
    const TOTAL_W = 80;

    return (
        <div className="flex-1 flex flex-col min-h-0 border border-border/50 rounded-2xl shadow-sm shadow-black/5 overflow-hidden bg-card">

            {/* Header */}
            <div className="px-4 py-2.5 border-b border-border/40 shrink-0 flex items-center gap-3 bg-card">
                <div className="shrink-0">
                    <p className="text-[14px] font-bold flex items-center gap-2">
                        <BookOpen size={14} />
                        {divisionName} Marksheet
                    </p>
                    <p className="px-6 text-[10.5px] text-muted-foreground">
                        {`Academic Year ${academicYear} \xb7 ${mode === 'online' ? 'Online' : 'Offline'}`}
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {!readOnly && (
                        <button onClick={saveData}
                            className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all border ${saveStatus === 'saved'
                                ? 'border-green-500 text-green-600 bg-green-500/10'
                                : 'border-border text-foreground hover:bg-muted'
                                }`}>
                            <Save size={12} />
                            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
                        </button>
                    )}
                    <div className="relative" ref={exportMenuRef}>
                        <button onClick={() => setShowExportMenu(v => !v)}
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            ⬇ Export <ChevronDown size={11} />
                        </button>
                        <AnimatePresence>
                            {showExportMenu && (
                                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                    className="absolute right-0 top-9 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[170px]">
                                    <button onClick={handleExport}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2">
                                        <span>📊</span><span>Full Sheet (All Subjects)</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Sheet table */}
            <div style={{ flex: 1, minHeight: 0, overflowX: 'scroll', overflowY: 'auto', background: msColors.bg, scrollbarWidth: 'thin', scrollbarColor: `${msColors.cellBorder} ${msColors.bg}` }}>
                <table className="text-[11px] border-separate border-spacing-0 min-w-max" style={{ tableLayout: 'fixed' }}>
                    <thead className="sticky top-0 z-30">
                        {/* Row 1 */}
                        <tr>
                            <th rowSpan={2} className="sticky left-0 z-[70] px-2 text-center whitespace-nowrap w-[60px] min-w-[60px] max-w-[60px]"
                                style={{ background: msColors.hdrBg, border: `0.5px solid ${msColors.hdrBorder}`, color: msColors.hdrText, fontWeight: 700, verticalAlign: 'middle' }}>
                                Roll No.
                            </th>
                            <th rowSpan={2} className="sticky left-[60px] z-[70] px-3 text-left whitespace-nowrap min-w-[130px]"
                                style={{ background: msColors.hdrBg, border: `0.5px solid ${msColors.hdrBorder}`, color: msColors.hdrText, fontWeight: 700, verticalAlign: 'middle' }}>
                                Student Name
                            </th>
                            {subjects.map(sub => {
                                const exams = getSubjectExams(sub.id);
                                const colSpan = exams.length + (mode === 'offline' ? 3 : 2);
                                return (
                                    <th key={sub.id} colSpan={colSpan} className="px-2 py-1.5 text-center whitespace-nowrap"
                                        style={{ background: `linear-gradient(${sub.color}22, ${sub.color}22), ${msColors.hdrBg}`, borderBottom: `2px solid ${sub.color}60`, border: `0.5px solid ${msColors.cellBorder}` }}>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color }} />
                                            <span style={{ color: sub.color, fontWeight: 700, fontSize: 11 }}>{sub.name}</span>
                                        </div>
                                    </th>
                                );
                            })}
                            {/* Spacer 1 + Graded section — offline only */}
                            {mode === 'offline' && <><th rowSpan={2} style={{ minWidth: 12, width: 12, background: 'transparent', border: 'none' }} />
                                <th rowSpan={2} style={{ minWidth: 12, width: 12, background: 'transparent', border: 'none' }} /></>}
                            {/* Graded section header */}
                            {mode === 'offline' && gradedSubjects.length > 0 && (
                                <th colSpan={gradedSubjects.length * 2 + (!readOnly && !restrictToSubjectId ? 1 : 0)} className="px-2 py-1.5 text-center group/gtitle"
                                    style={{ background: 'linear-gradient(#7C3AED18, #7C3AED18), #EDE4D6', border: `0.5px solid ${msColors.hdrBorder}`, fontWeight: 700, fontSize: 11 }}>
                                    {editingGradedTitle ? (
                                        <input
                                            ref={gradedTitleInputRef}
                                            value={gradedTitleDraft}
                                            onChange={e => setGradedTitleDraft(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') { e.preventDefault(); setGradedSectionTitle(gradedTitleDraft.trim() || gradedSectionTitle); setEditingGradedTitle(false); }
                                                if (e.key === 'Escape') setEditingGradedTitle(false);
                                            }}
                                            onBlur={() => { setGradedSectionTitle(gradedTitleDraft.trim() || gradedSectionTitle); setEditingGradedTitle(false); }}
                                            className="bg-transparent outline-none text-center w-full"
                                            style={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: msColors.hdrText, caretColor: msColors.hdrText }}
                                        />
                                    ) : (
                                        <span className="inline-flex items-center gap-1 cursor-default">
                                            <span style={{ color: msColors.hdrText }}>{gradedSectionTitle}</span>
                                            {!readOnly && !restrictToSubjectId && (
                                                <span className="opacity-0 group-hover/gtitle:opacity-100 transition-opacity cursor-pointer"
                                                    onClick={() => { setGradedTitleDraft(gradedSectionTitle); setEditingGradedTitle(true); setTimeout(() => gradedTitleInputRef.current?.select(), 0); }}>
                                                    <Pencil size={8} color={msColors.hdrText} />
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </th>
                            )}
                            {mode === 'offline' && gradedSubjects.length === 0 && !readOnly && !restrictToSubjectId && (
                                <th className="px-1 py-1.5 text-center cursor-pointer group/gadd"
                                    onClick={() => setAddGradedOpen(true)}
                                    style={{ background: 'linear-gradient(#7C3AED10, #7C3AED10), #EDE4D6', border: `0.5px dashed ${msColors.hdrBorder}`, minWidth: 28 }}>
                                    <span className="opacity-40 group-hover/gadd:opacity-100 transition-opacity flex items-center justify-center">
                                        <Plus size={11} color={msColors.hdrText} />
                                    </span>
                                </th>
                            )}
                            {/* Spacer 2: between graded and Overall — offline only */}
                            {mode === 'offline' && <><th rowSpan={2} style={{ minWidth: 12, width: 12, background: 'transparent', border: 'none' }} />
                                <th rowSpan={2} style={{ minWidth: 12, width: 12, background: 'transparent', border: 'none' }} /></>}
                            {/* Overall sticky header */}
                            <th colSpan={3} rowSpan={1} className="sticky right-0 z-[65] px-2 py-1.5 text-center"
                                style={{ minWidth: TOTAL_W + PCT_W + GRADE_W, background: msColors.summaryBg, border: `0.5px solid ${msColors.cellBorder}`, borderLeft: `2px solid ${msColors.cellBorder}`, color: '#2A1F10', fontWeight: 700, fontSize: 11 }}>
                                Overall
                            </th>
                        </tr>
                        {/* Row 2 */}
                        <tr>
                            {subjects.map(sub => {
                                const exams = getSubjectExams(sub.id);
                                return (
                                    <React.Fragment key={sub.id}>
                                        {exams.map(ex => {
                                            const isDraggingOver = dragOverExam?.subId === sub.id && dragOverExam?.examId === ex.id;
                                            const isDragging = dragExam?.subId === sub.id && dragExam?.examId === ex.id;
                                            const subRestricted = isRestricted(sub.id);
                                            return (
                                                <th key={ex.id}
                                                    draggable={mode === 'offline' && !readOnly && !subRestricted}
                                                    onDragStart={() => { if (!readOnly && !subRestricted) setDragExam({ subId: sub.id, examId: ex.id }); }}
                                                    onDragOver={e => { if (!readOnly && !subRestricted) { e.preventDefault(); setDragOverExam({ subId: sub.id, examId: ex.id }); } }}
                                                    onDragLeave={() => setDragOverExam(null)}
                                                    onDrop={() => { if (!readOnly && !subRestricted) handleExamDrop(sub.id, ex.id); }}
                                                    onDragEnd={() => { setDragExam(null); setDragOverExam(null); }}
                                                    className="px-1 py-1.5 text-center whitespace-nowrap min-w-[62px] group relative"
                                                    style={{
                                                        background: isDraggingOver ? `linear-gradient(${sub.color}30, ${sub.color}30), ${msColors.hdrBg}` : msColors.hdrBg,
                                                        border: isDraggingOver ? `1.5px solid ${sub.color}` : `0.5px solid ${msColors.hdrBorder}`,
                                                        color: msColors.hdrText,
                                                        opacity: isDragging ? 0.4 : 1,
                                                        cursor: mode === 'offline' && !subRestricted ? 'grab' : 'default',
                                                    }}>
                                                    {mode === 'online' && ex.date && (
                                                        <div style={{ margin: '-6px -4px 4px', padding: '2px 4px', borderBottom: `0.5px solid ${msColors.hdrBorder}`, fontSize: 9, fontWeight: 500, opacity: 0.65, background: msColors.hdrBg }}>
                                                            {ex.date}
                                                        </div>
                                                    )}
                                                    <div style={{ fontWeight: 600, fontSize: 10 }}>{ex.name}</div>
                                                    <div style={{ fontWeight: 600, fontSize: 10, opacity: 0.8 }}>/{ex.maxMarks}</div>
                                                    {mode === 'offline' && !readOnly && !subRestricted && (
                                                        <span className="absolute top-0 right-0 opacity-0 group-hover:opacity-70 transition-opacity cursor-pointer flex items-center justify-center"
                                                            style={{ width: 20, height: 20 }}
                                                            onMouseDown={e => e.stopPropagation()}
                                                            onClick={e => { e.stopPropagation(); setEditExamCtx({ exam: ex, subId: sub.id }); }}>
                                                            <Pencil size={9} color={msColors.hdrText} />
                                                        </span>
                                                    )}
                                                </th>
                                            );
                                        })}
                                        {mode === 'offline' && (
                                            !readOnly && !isRestricted(sub.id) ? (
                                                <th className="px-1 py-1.5 text-center w-7 cursor-pointer group/add"
                                                    onClick={() => setAddExamSubId(sub.id)}
                                                    style={{ background: msColors.hdrBg, border: `0.5px dashed ${msColors.hdrBorder}`, color: msColors.hdrText }}>
                                                    <span className="opacity-40 group-hover/add:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Plus size={11} />
                                                    </span>
                                                </th>
                                            ) : (
                                                <th style={{ background: msColors.hdrBg, border: `0.5px solid ${msColors.hdrBorder}`, width: '28px', minWidth: '28px' }} />
                                            )
                                        )}
                                        <th className="px-1 py-1.5 text-center whitespace-nowrap"
                                            style={{ background: msColors.summaryBg, border: `0.5px solid ${msColors.cellBorder}`, color: '#2A1F10', fontWeight: 700, fontSize: 11, width: '72px', minWidth: '72px', maxWidth: '72px' }}>
                                            Total
                                        </th>
                                        <th className="px-1 py-1.5 text-center whitespace-nowrap"
                                            style={{ background: msColors.summaryBg, border: `0.5px solid ${msColors.cellBorder}`, color: '#2A1F10', fontWeight: 700, fontSize: 11, width: '48px', minWidth: '48px', maxWidth: '48px' }}>
                                            %
                                        </th>
                                    </React.Fragment>
                                );
                            })}
                            {/* Graded subject col headers — offline only */}
                            {mode === 'offline' && gradedSubjects.map(gs => {
                                const isGOver = dragOverGraded === gs.id;
                                const isGDrag = dragGraded === gs.id;
                                const gradedThStyle = {
                                    background: isGOver && !restrictToSubjectId ? `linear-gradient(#7C3AED30, #7C3AED30), #EDE4D6` : '#EDE4D6',
                                    border: isGOver && !restrictToSubjectId ? `1.5px solid #7C3AED` : `0.5px solid ${msColors.hdrBorder}`,
                                    color: msColors.hdrText, width: 52, minWidth: 52, maxWidth: 52,
                                    opacity: isGDrag ? 0.4 : 1,
                                    cursor: readOnly || restrictToSubjectId ? 'default' : 'grab',
                                };
                                return (
                                    <React.Fragment key={gs.id}>
                                        <th className="px-1 py-1.5 text-center whitespace-nowrap group relative"
                                            draggable={!readOnly && !restrictToSubjectId}
                                            onDragStart={() => { if (!readOnly && !restrictToSubjectId) setDragGraded(gs.id); }}
                                            onDragOver={e => { if (!readOnly && !restrictToSubjectId) { e.preventDefault(); setDragOverGraded(gs.id); } }}
                                            onDragLeave={() => setDragOverGraded(null)}
                                            onDrop={() => { if (!readOnly && !restrictToSubjectId) handleGradedDrop(gs.id); }}
                                            onDragEnd={() => { setDragGraded(null); setDragOverGraded(null); }}
                                            style={gradedThStyle}>
                                            <div style={{ fontWeight: 700, fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 48 }}>{gs.name}</div>
                                            <div style={{ fontWeight: 600, fontSize: 9, opacity: 0.7 }}>Term 1</div>
                                            {!readOnly && !restrictToSubjectId && (
                                                <span className="absolute top-0 right-0 opacity-0 group-hover:opacity-70 transition-opacity cursor-pointer flex items-center justify-center"
                                                    style={{ width: 18, height: 18 }}
                                                    onMouseDown={e => e.stopPropagation()}
                                                    onClick={e => { e.stopPropagation(); setEditGradedSub(gs); }}>
                                                    <Pencil size={8} color={msColors.hdrText} />
                                                </span>
                                            )}
                                        </th>
                                        <th className="px-1 py-1.5 text-center whitespace-nowrap group relative"
                                            draggable={!readOnly && !restrictToSubjectId}
                                            onDragStart={() => { if (!readOnly && !restrictToSubjectId) setDragGraded(gs.id); }}
                                            onDragOver={e => { if (!readOnly && !restrictToSubjectId) { e.preventDefault(); setDragOverGraded(gs.id); } }}
                                            onDragLeave={() => setDragOverGraded(null)}
                                            onDrop={() => { if (!readOnly && !restrictToSubjectId) handleGradedDrop(gs.id); }}
                                            onDragEnd={() => { setDragGraded(null); setDragOverGraded(null); }}
                                            style={gradedThStyle}>
                                            <div style={{ fontWeight: 700, fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 48 }}>{gs.name}</div>
                                            <div style={{ fontWeight: 600, fontSize: 9, opacity: 0.7 }}>Term 2</div>
                                            {!readOnly && !restrictToSubjectId && (
                                                <span className="absolute top-0 right-0 opacity-0 group-hover:opacity-70 transition-opacity cursor-pointer flex items-center justify-center"
                                                    style={{ width: 18, height: 18 }}
                                                    onMouseDown={e => e.stopPropagation()}
                                                    onClick={e => { e.stopPropagation(); setEditGradedSub(gs); }}>
                                                    <Pencil size={8} color={msColors.hdrText} />
                                                </span>
                                            )}
                                        </th>
                                    </React.Fragment>
                                );
                            })}
                            {mode === 'offline' && gradedSubjects.length > 0 && !readOnly && !restrictToSubjectId && (
                                <th className="px-1 py-1.5 text-center cursor-pointer group/gadd"
                                    onClick={() => setAddGradedOpen(true)}
                                    style={{ background: '#EDE4D6', border: `0.5px dashed ${msColors.hdrBorder}`, width: 28, minWidth: 28 }}>
                                    <span className="opacity-40 group-hover/gadd:opacity-100 transition-opacity flex items-center justify-center">
                                        <Plus size={11} color="#7C3AED" />
                                    </span>
                                </th>
                            )}
                            {/* Grand sticky cols */}
                            <th className="sticky z-20 px-2 py-1.5 text-center whitespace-nowrap"
                                style={{ right: PCT_W + GRADE_W, minWidth: TOTAL_W, background: msColors.summaryBg, border: `0.5px solid ${msColors.cellBorder}`, borderLeft: `2px solid ${msColors.cellBorder}`, color: '#2A1F10', fontWeight: 700 }}>
                                Grand
                            </th>
                            <th className="sticky z-20 px-2 py-1.5 text-center whitespace-nowrap"
                                style={{ right: GRADE_W, minWidth: PCT_W, background: msColors.summaryBg, border: `0.5px solid ${msColors.cellBorder}`, color: '#2A1F10', fontWeight: 700 }}>
                                %
                            </th>
                            <th className="sticky right-0 z-20 px-2 py-1.5 text-center whitespace-nowrap"
                                style={{ minWidth: GRADE_W, background: msColors.summaryBg, border: `0.5px solid ${msColors.cellBorder}`, color: '#2A1F10', fontWeight: 700 }}>
                                Grade
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, si) => {
                            const rowBg = si % 2 === 0 ? msColors.rowBase : msColors.rowAlt;
                            const grand = getGrandTotal(student.id);
                            return (
                                <tr key={student.id} style={{ background: rowBg }} className="hover:opacity-90 transition-opacity">
                                    <td className="sticky left-0 z-10 px-2 py-2 text-center font-semibold whitespace-nowrap w-[60px] min-w-[60px] max-w-[60px]"
                                        style={{ background: rowBg, border: `0.5px solid ${msColors.cellBorder}`, color: '#2A1F10' }}>
                                        {student.rollNo}
                                    </td>
                                    <td className="sticky left-[60px] z-10 px-3 py-1.5 whitespace-nowrap"
                                        style={{ background: rowBg, border: `0.5px solid ${msColors.cellBorder}`, color: '#2A1F10' }}>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                style={{ background: getAvatarColor(student.name) }}>
                                                {getInitials(student.name)}
                                            </div>
                                            <span className="font-medium text-[11px]">{student.name}</span>
                                        </div>
                                    </td>
                                    {subjects.map(sub => {
                                        const subRestricted = isRestricted(sub.id);
                                        const exams = getSubjectExams(sub.id);
                                        const { total, scored, enteredTotal } = getSubjectTotal(sub.id, student.id);
                                        const subPct = enteredTotal > 0 ? Math.round((scored / enteredTotal) * 100) : null;
                                        return (
                                            <React.Fragment key={sub.id}>
                                                {exams.map(ex => {
                                                    if (subRestricted) {
                                                        return (
                                                            <td key={ex.id} className="px-1 py-2 text-center"
                                                                style={{ border: `0.5px solid ${msColors.cellBorder}`, width: '62px', minWidth: '62px', maxWidth: '62px' }}>
                                                                <span style={{ color: msColors.cellBorder }}>—</span>
                                                            </td>
                                                        );
                                                    }
                                                    const sc = getScore(sub.id, student.id, ex.id);
                                                    const cellPct = sc !== null ? (sc / ex.maxMarks) * 100 : null;
                                                    const isEditing = activeCell?.subId === sub.id && activeCell?.stId === student.id && activeCell?.examId === ex.id;
                                                    const startEdit = () => {
                                                        setActiveCell({ subId: sub.id, stId: student.id, examId: ex.id });
                                                        setDraftVal(sc !== null ? String(sc) : '');
                                                        setTimeout(() => inputRef.current?.select(), 0);
                                                    };
                                                    const commitEdit = () => {
                                                        const n = parseFloat(draftVal);
                                                        setScore(sub.id, student.id, ex.id, isNaN(n) ? null : Math.min(ex.maxMarks, Math.max(0, n)));
                                                        setActiveCell(null);
                                                    };
                                                    return (
                                                        <td key={ex.id}
                                                            onClick={() => { if (!readOnly && !isEditing && sc === null) startEdit(); }}
                                                            className={`px-1 text-center relative group ${sc === null && !readOnly ? 'cursor-pointer' : 'cursor-default'}`}
                                                            style={{ border: `0.5px solid ${msColors.cellBorder}`, width: '62px', minWidth: '62px', maxWidth: '62px' }}>
                                                            {isEditing ? (
                                                                <input
                                                                    ref={inputRef}
                                                                    type="number" min={0} max={ex.maxMarks}
                                                                    value={draftVal}
                                                                    onChange={e => setDraftVal(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                                                                        if (e.key === 'Escape') { setActiveCell(null); }
                                                                    }}
                                                                    onBlur={commitEdit}
                                                                    className="text-center bg-transparent outline-none py-2"
                                                                    style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: '#DA7756', width: '100%', minWidth: 0, display: 'block', caretColor: '#2A1F10' }}
                                                                />
                                                            ) : (
                                                                <div className="py-2 flex items-center justify-center">
                                                                    {sc !== null ? (
                                                                        <span style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: scoreColor(cellPct!), lineHeight: 1 }}>
                                                                            {sc}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ color: msColors.cellBorder }}>—</span>
                                                                    )}
                                                                    {!readOnly && (
                                                                        <span className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-70 transition-opacity cursor-pointer"
                                                                            onClick={e => { e.stopPropagation(); startEdit(); }}>
                                                                            <Pencil size={8} color={msColors.hdrText} />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                {mode === 'offline' && (
                                                    <td style={{ background: rowBg, borderLeft: `0.5px dashed ${msColors.cellBorder}`, borderRight: `0.5px dashed ${msColors.cellBorder}`, borderTop: `0.5px solid ${msColors.cellBorder}`, borderBottom: `0.5px solid ${msColors.cellBorder}`, width: '28px' }} />
                                                )}
                                                <td className="px-1 py-2 text-center"
                                                    style={{ background: msColors.rowAlt, border: `0.5px solid ${msColors.cellBorder}`, color: subRestricted ? msColors.cellBorder : '#2A1F10', fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
                                                    {subRestricted ? '—' : `${scored}/${total}`}
                                                </td>
                                                <td className="px-1 py-2 text-center"
                                                    style={{ background: msColors.rowAlt, border: `0.5px solid ${msColors.cellBorder}`, color: subRestricted ? msColors.cellBorder : (subPct !== null ? scoreColor(subPct) : msColors.cellBorder), fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
                                                    {subRestricted ? '—' : (subPct !== null ? `${subPct}%` : '—')}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}
                                    {/* Spacer 1 + Graded cells — offline only */}
                                    {mode === 'offline' && <><td style={{ background: 'transparent', border: 'none', width: 12 }} />
                                        <td style={{ background: 'transparent', border: 'none', width: 12 }} /></>}
                                    {mode === 'offline' && gradedSubjects.map(gs => {
                                        if (restrictToSubjectId) {
                                            return (
                                                <React.Fragment key={gs.id}>
                                                    <td className="px-1 py-1 text-center"
                                                        style={{ background: msColors.rowBase, border: `0.5px solid ${msColors.cellBorder}`, width: 52, minWidth: 52, maxWidth: 52 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: msColors.hdrBorder }}>—</span>
                                                    </td>
                                                    <td className="px-1 py-1 text-center"
                                                        style={{ background: msColors.rowBase, border: `0.5px solid ${msColors.cellBorder}`, width: 52, minWidth: 52, maxWidth: 52 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: msColors.hdrBorder }}>—</span>
                                                    </td>
                                                </React.Fragment>
                                            );
                                        }
                                        const t1 = getGrade(gs.id, student.id, 't1');
                                        const t2 = getGrade(gs.id, student.id, 't2');
                                        const isEditT1 = activeGradeCell?.gsId === gs.id && activeGradeCell?.stId === student.id && activeGradeCell?.term === 't1';
                                        const isEditT2 = activeGradeCell?.gsId === gs.id && activeGradeCell?.stId === student.id && activeGradeCell?.term === 't2';
                                        return (
                                            <React.Fragment key={gs.id}>
                                                <td className={`px-1 py-1 text-center group relative ${!t1 && !readOnly ? 'cursor-pointer' : ''}`}
                                                    onClick={() => { if (!readOnly && !isEditT1 && !t1) startGradeEdit(gs.id, student.id, 't1', t1); }}
                                                    style={{ background: msColors.rowBase, border: `0.5px solid ${msColors.cellBorder}`, width: 52, minWidth: 52, maxWidth: 52 }}>
                                                    {isEditT1 ? (
                                                        <input
                                                            ref={gradeInputRef}
                                                            value={gradeDraft}
                                                            onChange={e => setGradeDraft(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') { e.preventDefault(); commitGradeEdit(gs.id, student.id, 't1'); }
                                                                if (e.key === 'Escape') setActiveGradeCell(null);
                                                            }}
                                                            onBlur={() => commitGradeEdit(gs.id, student.id, 't1')}
                                                            placeholder="A+…D"
                                                            className="text-center bg-transparent outline-none w-full"
                                                            style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: msColors.hdrText, caretColor: msColors.hdrText }}
                                                        />
                                                    ) : (
                                                        <>
                                                            <span style={{ fontSize: 12, fontWeight: 700, color: t1 ? gradeValColor(t1) : msColors.hdrBorder }}>
                                                                {t1 ?? '—'}
                                                            </span>
                                                            {t1 && !readOnly && (
                                                                <span className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-60 transition-opacity cursor-pointer"
                                                                    onClick={e => { e.stopPropagation(); startGradeEdit(gs.id, student.id, 't1', t1); }}>
                                                                    <Pencil size={7} color={msColors.hdrText} />
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                <td className={`px-1 py-1 text-center group relative ${!t2 && !readOnly ? 'cursor-pointer' : ''}`}
                                                    onClick={() => { if (!readOnly && !isEditT2 && !t2) startGradeEdit(gs.id, student.id, 't2', t2); }}
                                                    style={{ background: msColors.rowBase, border: `0.5px solid ${msColors.cellBorder}`, width: 52, minWidth: 52, maxWidth: 52 }}>
                                                    {isEditT2 ? (
                                                        <input
                                                            ref={gradeInputRef}
                                                            value={gradeDraft}
                                                            onChange={e => setGradeDraft(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') { e.preventDefault(); commitGradeEdit(gs.id, student.id, 't2'); }
                                                                if (e.key === 'Escape') setActiveGradeCell(null);
                                                            }}
                                                            onBlur={() => commitGradeEdit(gs.id, student.id, 't2')}
                                                            placeholder="A+…D"
                                                            className="text-center bg-transparent outline-none w-full"
                                                            style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: msColors.hdrText, caretColor: msColors.hdrText }}
                                                        />
                                                    ) : (
                                                        <>
                                                            <span style={{ fontSize: 12, fontWeight: 700, color: t2 ? gradeValColor(t2) : msColors.hdrBorder }}>
                                                                {t2 ?? '—'}
                                                            </span>
                                                            {t2 && !readOnly && (
                                                                <span className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-60 transition-opacity cursor-pointer"
                                                                    onClick={e => { e.stopPropagation(); startGradeEdit(gs.id, student.id, 't2', t2); }}>
                                                                    <Pencil size={7} color={msColors.hdrText} />
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}
                                    {/* "+" button col placeholder — offline only */}
                                    {mode === 'offline' && gradedSubjects.length > 0 && !readOnly && !restrictToSubjectId && <td style={{ background: msColors.rowBase, border: `0.5px dashed ${msColors.cellBorder}`, width: 28 }} />}
                                    {/* Spacer 2 — offline only */}
                                    {mode === 'offline' && <><td style={{ background: 'transparent', border: 'none', width: 12 }} />
                                        <td style={{ background: 'transparent', border: 'none', width: 12 }} /></>}
                                    {/* Grand sticky summary */}
                                    <td className="sticky z-10 px-2 py-2 text-center"
                                        style={{ right: PCT_W + GRADE_W, minWidth: TOTAL_W, background: rowBg, border: `0.5px solid ${msColors.cellBorder}`, borderLeft: `2px solid ${msColors.cellBorder}`, color: restrictToSubjectId ? msColors.cellBorder : msColors.hdrText, fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
                                        {restrictToSubjectId ? '—' : `${grand.scored}/${grand.total}`}
                                    </td>
                                    <td className="sticky z-10 px-2 py-2 text-center"
                                        style={{ right: GRADE_W, minWidth: PCT_W, background: rowBg, border: `0.5px solid ${msColors.cellBorder}`, color: restrictToSubjectId ? msColors.cellBorder : (grand.pct !== null ? scoreColor(grand.pct) : msColors.cellBorder), fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
                                        {restrictToSubjectId ? '—' : (grand.pct !== null ? `${grand.pct}%` : '—')}
                                    </td>
                                    <td className="sticky right-0 z-10 px-2 py-2 text-center"
                                        style={{ minWidth: GRADE_W, background: rowBg, border: `0.5px solid ${msColors.cellBorder}`, color: restrictToSubjectId ? msColors.cellBorder : (grand.pct !== null ? scoreColor(grand.pct) : msColors.cellBorder), fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
                                        {restrictToSubjectId ? '—' : (grand.pct !== null ? grade(grand.pct) : '—')}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border/40 shrink-0 flex items-center gap-5 bg-card">
                {[
                    { label: '≥75% Pass', color: '#059669', sample: 75 },
                    { label: '35–74% Pass', color: '#F59E0B', sample: 36 },
                    { label: '<35% Fail', color: '#DC2626', sample: 17 },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <span style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: item.color }}>{item.sample}</span>
                        <span className="text-[10px] text-muted-foreground">{item.label}</span>
                    </div>
                ))}
                <span className="text-[10px] text-muted-foreground/40 italic ml-auto">
                    {mode === 'online' ? 'Auto-populated \xb7 Click any cell to override' : 'Click any cell to enter / edit marks'}
                </span>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {editExamCtx && (
                    <ExamEditModal
                        exam={editExamCtx.exam}
                        onSave={(name, max) => {
                            setSubjectExams(prev => ({
                                ...prev,
                                [editExamCtx.subId]: prev[editExamCtx.subId].map(e =>
                                    e.id === editExamCtx.exam.id ? { ...e, name, maxMarks: max } : e
                                ),
                            }));
                        }}
                        onDelete={() => {
                            setSubjectExams(prev => ({
                                ...prev,
                                [editExamCtx.subId]: prev[editExamCtx.subId].filter(e => e.id !== editExamCtx.exam.id),
                            }));
                        }}
                        onClose={() => setEditExamCtx(null)}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {addExamSubId && (
                    <AddExamModal
                        existingNames={(subjectExams[addExamSubId] ?? []).map(e => e.name)}
                        onSave={(name, max) => setSubjectExams(prev => ({
                            ...prev,
                            [addExamSubId]: [...(prev[addExamSubId] ?? []), { id: `oe${Date.now()}`, name, maxMarks: max, type: 'offline' }],
                        }))}
                        onClose={() => setAddExamSubId(null)}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {addGradedOpen && (
                    <GradedSubjectModal
                        onSave={name => setGradedSubjects(prev => [...prev, { id: `gs${Date.now()}`, name }])}
                        onClose={() => setAddGradedOpen(false)}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {editGradedSub && (
                    <GradedSubjectModal
                        existing={editGradedSub}
                        onSave={name => setGradedSubjects(prev => prev.map(gs => gs.id === editGradedSub.id ? { ...gs, name } : gs))}
                        onDelete={() => setGradedSubjects(prev => prev.filter(gs => gs.id !== editGradedSub.id))}
                        onClose={() => setEditGradedSub(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Summary Panel ─────────────────────────────────────────────────────────────
function StudentSummaryPanel({
    students, subjects, selectedId, onSelect,
}: {
    students: Student[];
    subjects: Subject[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    const getOverall = (stId: string) => {
        let total = 0, scored = 0;
        subjects.forEach(sub => {
            OFFLINE_EXAMS.forEach(ex => {
                total += ex.maxMarks;
                scored += INITIAL_OFFLINE[sub.id]?.[stId]?.[ex.id] ?? 0;
            });
        });
        return total > 0 ? Math.round((scored / total) * 100) : null;
    };

    return (
        <div className="w-[30%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
            <div className="px-4 py-3.5 border-b border-border/40 shrink-0">
                <p className="text-sm font-bold flex items-center gap-2">
                    <Users size={14} /> Students ({students.length})
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Click student to view details</p>
            </div>
            <div className="flex-1 overflow-y-auto bg-background">
                {students.map(student => {
                    const ov = getOverall(student.id);
                    const isSelected = selectedId === student.id;
                    return (
                        <button key={student.id} onClick={() => onSelect(student.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-colors hover:bg-muted/30 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                style={{ background: getAvatarColor(student.name) }}>
                                {getInitials(student.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate">{student.name}</p>
                                <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                            </div>
                            {ov !== null && (
                                <div className="text-right shrink-0">
                                    <p className="text-[11px] font-black" style={{ color: scoreColor(ov) }}>{ov}%</p>
                                    <p className="text-[9px] text-muted-foreground/60">overall</p>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Overall View ──────────────────────────────────────────────────────────────
function OverallView({ divisionName, subjects, onStatsChange }: {
    divisionName: string;
    subjects: Subject[];
    onStatsChange?: (stats: MarksStats) => void;
}) {
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(MOCK_STUDENTS[0].id);
    const [rightTab, setRightTab] = useState<'class' | 'student'>('class');
    const [rankTab, setRankTab] = useState<'offline' | 'online' | 'combined'>('combined');
    const [subjectTopperTab, setSubjectTopperTab] = useState<'offline' | 'online' | 'combined'>('combined');
    const [reportCardTab, setReportCardTab] = useState<'offline' | 'online'>('offline');
    const [trendSubjectId, setTrendSubjectId] = useState<string>(MOCK_SUBJECTS[0]?.id ?? '');
    const [trendMode, setTrendMode] = useState<'offline' | 'online' | 'combined'>('combined');

    // per-subject top-5 computation
    const subjectToppers = useMemo(() => {
        return subjects.map(sub => {
            const offMax = OFFLINE_EXAMS.reduce((s, ex) => s + ex.maxMarks, 0);
            const onMax = (ONLINE_EXAMS[sub.id] ?? []).reduce((s, ex) => s + ex.maxMarks, 0);
            const rows = MOCK_STUDENTS.map(st => {
                const offScored = OFFLINE_EXAMS.reduce((s, ex) => s + (INITIAL_OFFLINE[sub.id]?.[st.id]?.[ex.id] ?? 0), 0);
                const onScored = (ONLINE_EXAMS[sub.id] ?? []).reduce((s, ex) => s + ((INITIAL_ONLINE[sub.id]?.[st.id]?.[ex.id] ?? 0) as number), 0);
                const offPct = offMax > 0 ? Math.round((offScored / offMax) * 100) : null;
                const onPct = onMax > 0 ? Math.round((onScored / onMax) * 100) : null;
                const combPct = offPct !== null && onPct !== null ? Math.round((offPct + onPct) / 2) : offPct ?? onPct ?? 0;
                return { student: st, offPct, onPct, combPct };
            });
            const getPct = (r: typeof rows[0]) =>
                subjectTopperTab === 'offline' ? (r.offPct ?? 0)
                    : subjectTopperTab === 'online' ? (r.onPct ?? 0)
                        : r.combPct;
            const sorted = [...rows].sort((a, b) => getPct(b) - getPct(a));
            return { sub, top5: sorted.slice(0, 3), getPct };
        });
    }, [subjects, subjectTopperTab]);

    const studentStats = useMemo(() => {
        return MOCK_STUDENTS.map(st => {
            let offTotal = 0, offScored = 0;
            subjects.forEach(sub => {
                OFFLINE_EXAMS.forEach(ex => {
                    offTotal += ex.maxMarks;
                    offScored += INITIAL_OFFLINE[sub.id]?.[st.id]?.[ex.id] ?? 0;
                });
            });
            const offPct = offTotal > 0 ? Math.round((offScored / offTotal) * 100) : null;

            let onTotal = 0, onScored = 0;
            subjects.forEach(sub => {
                const exams = ONLINE_EXAMS[sub.id] ?? ONLINE_EXAM_TEMPLATE.map(ex => ({ ...ex, id: `${ex.id}-${sub.id}` }));
                exams.forEach(ex => {
                    onTotal += ex.maxMarks;
                    onScored += (INITIAL_ONLINE[sub.id]?.[st.id]?.[ex.id] ?? 0) as number;
                });
            });
            const onPct = onTotal > 0 ? Math.round((onScored / onTotal) * 100) : null;

            const combPct = offPct !== null && onPct !== null
                ? Math.round((offPct + onPct) / 2)
                : offPct ?? onPct ?? 0;

            return { student: st, offPct, onPct, combPct };
        });
    }, [subjects]);

    const rankMap = useMemo(() => {
        const sorted = [...studentStats].sort((a, b) => b.combPct - a.combPct);
        const m: Record<string, number> = {};
        sorted.forEach((r, i) => { m[r.student.id] = i + 1; });
        return m;
    }, [studentStats]);

    const onStatsChangeRef = useRef(onStatsChange);
    useEffect(() => { onStatsChangeRef.current = onStatsChange; });
    const prevOverallKey = useRef<string>('');

    useEffect(() => {
        if (!onStatsChangeRef.current) return;
        const offPcts = studentStats.map(s => s.offPct).filter((p): p is number => p !== null);
        const onPcts = studentStats.map(s => s.onPct).filter((p): p is number => p !== null);
        const highOff = offPcts.length > 0 ? Math.max(...offPcts) : null;
        const highOn = onPcts.length > 0 ? Math.max(...onPcts) : null;
        const key = `${highOff}-${highOn}`;
        if (key === prevOverallKey.current) return;
        prevOverallKey.current = key;
        onStatsChangeRef.current({
            avg: highOff,
            topGrade: null,
            pill1Label: 'Offline High',
            pill2Label: 'Online High',
            pill2Value: highOn !== null ? `${highOn}%` : '—',
            pill2Color: highOn !== null ? scoreColor(highOn) : undefined,
        });
    }, [studentStats]);

    return (
        <div className="flex gap-3 h-full min-h-0 pt-3 pb-3 px-1">

            {/* LEFT — Students list */}
            <div className="w-[30%] flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-3.5 border-b border-border/40 shrink-0">
                    <p className="text-sm font-bold flex items-center gap-2">
                        <Users size={14} /> Students ({MOCK_STUDENTS.length})
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto bg-background">
                    {studentStats.map(({ student, offPct, onPct }) => {
                        const isSelected = selectedStudentId === student.id;
                        return (
                            <button key={student.id}
                                onClick={() => { setSelectedStudentId(prev => prev === student.id ? null : student.id); setRightTab('student'); }}
                                className={`w-full flex items-center gap-2 px-3 py-3 border-b border-border/20 text-left transition-colors hover:bg-muted/30 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                    style={{ background: getAvatarColor(student.name) }}>
                                    {getInitials(student.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate">{student.name}</p>
                                    <p className="text-[10px] text-muted-foreground">Roll No. {student.rollNo}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="w-px h-6 bg-border/40" />
                                    <div className="text-right">
                                        <p className="text-[11px] font-black" style={{ color: offPct !== null ? scoreColor(offPct) : undefined }}>
                                            {offPct !== null ? `${offPct}%` : '—'}
                                        </p>
                                        <p className="text-[9px] text-muted-foreground/60">offline</p>
                                    </div>
                                    <div className="w-px h-6 bg-border/40" />
                                    <div className="text-right">
                                        <p className="text-[11px] font-black" style={{ color: onPct !== null ? scoreColor(onPct) : undefined }}>
                                            {onPct !== null ? `${onPct}%` : '—'}
                                        </p>
                                        <p className="text-[9px] text-muted-foreground/60">online</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT — Details panel */}
            <div className="flex-1 flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-2.5 border-b border-border/40 shrink-0 flex items-center gap-3">
                    <p className="text-sm font-bold shrink-0 flex items-center gap-1.5">
                        <BookOpen size={14} /> {divisionName}
                    </p>
                    <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/40">
                        {([
                            { key: 'class' as const, label: 'Class Overview' },
                            { key: 'student' as const, label: 'Student Details' },
                        ]).map(tab => {
                            const isActive = rightTab === tab.key;
                            return (
                                <button key={tab.key} onClick={() => setRightTab(tab.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                    <AnimatePresence>
                        {rightTab === 'student' && (
                            <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                                className="flex items-center gap-2 ml-auto">
                                <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-red-500 hover:border-red-400/50 transition-all">
                                    <Flag size={11} /> Report
                                </button>
                                <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                                    <ExternalLink size={10} /> View Profile
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden bg-background p-3 flex flex-col">
                    {rightTab === 'class' ? (<div className="flex gap-3 h-full min-h-0">{(() => {
                        const getPct = (s: typeof studentStats[0]) =>
                            rankTab === 'offline' ? (s.offPct ?? 0)
                                : rankTab === 'online' ? (s.onPct ?? 0)
                                    : s.combPct;
                        const sorted = [...studentStats].sort((a, b) => getPct(b) - getPct(a));
                        const top3 = sorted.slice(0, 3);
                        const rest = sorted.slice(3);
                        const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
                        const podiumCfg = [
                            { height: 'h-16', color: '#C0C0C0', label: '2nd' },
                            { height: 'h-24', color: '#F59E0B', label: '1st' },
                            { height: 'h-12', color: '#CD7F32', label: '3rd' },
                        ];
                        return (
                            <div className="w-1/2 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col min-h-0">
                                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Trophy size={13} /> Leaderboard
                                    </p>
                                    <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
                                        {(['offline', 'online', 'combined'] as const).map(t => (
                                            <button key={t} onClick={() => setRankTab(t)}
                                                className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold capitalize transition-all ${rankTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-end justify-center gap-4 px-4 pt-4 pb-2">
                                    {podiumOrder.map((st, i) => {
                                        const cfg = podiumCfg[i];
                                        const pct = getPct(st);
                                        return (
                                            <div key={st.student.id} className="flex flex-col items-center gap-1.5">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/20"
                                                    style={{ background: getAvatarColor(st.student.name) }}>
                                                    {getInitials(st.student.name)}
                                                </div>
                                                <p className="text-[10px] font-bold text-center w-16 truncate">{st.student.name}</p>
                                                <p className="text-[10px] font-black" style={{ color: scoreColor(pct) }}>{pct}%</p>
                                                <div className={`${cfg.height} w-14 rounded-t-xl flex items-center justify-center text-white text-xs font-black`}
                                                    style={{ background: cfg.color }}>
                                                    {cfg.label}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="px-4 pb-3 space-y-1.5 overflow-y-auto flex-1 min-h-0">
                                    {rest.map((st, i) => {
                                        const pct = getPct(st);
                                        return (
                                            <div key={st.student.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
                                                <span className="text-xs font-black text-muted-foreground w-4 text-center">{i + 4}</span>
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                                    style={{ background: getAvatarColor(st.student.name) }}>
                                                    {getInitials(st.student.name)}
                                                </div>
                                                <p className="text-xs font-semibold flex-1 truncate">{st.student.name}</p>
                                                <span className="text-[11px] font-black" style={{ color: scoreColor(pct) }}>{pct}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                        {/* Subject Toppers */}
                        <div className="w-1/2 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col min-h-0">
                            <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between shrink-0">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Trophy size={13} /> Subject Toppers
                                </p>
                                <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
                                    {(['offline', 'online', 'combined'] as const).map(t => (
                                        <button key={t} onClick={() => setSubjectTopperTab(t)}
                                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold capitalize transition-all ${subjectTopperTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-3">
                                {subjectToppers.map(({ sub, top5, getPct }) => (
                                    <div key={sub.id}>
                                        <div className="flex items-center gap-1.5 mb-1.5 px-1">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color }} />
                                            <p className="text-[11px] font-bold truncate" style={{ color: sub.color }}>{sub.name}</p>
                                        </div>
                                        <div className="space-y-1">
                                            {top5.map((row, idx) => {
                                                const pct = getPct(row);
                                                return (
                                                    <div key={row.student.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/30">
                                                        <span className="text-[10px] font-black text-muted-foreground w-3 shrink-0">{idx + 1}</span>
                                                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                                                            style={{ background: getAvatarColor(row.student.name) }}>
                                                            {getInitials(row.student.name)}
                                                        </div>
                                                        <p className="text-[11px] font-semibold flex-1 truncate">{row.student.name}</p>
                                                        <span className="text-[11px] font-black shrink-0" style={{ color: scoreColor(pct) }}>{pct}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>) : (() => {
                        const sel = selectedStudentId ? studentStats.find(s => s.student.id === selectedStudentId) : null;
                        if (!sel) return (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                    <Users size={20} className="text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Click any student from the list</p>
                            </div>
                        );
                        const rank = rankMap[sel.student.id];
                        const trendSub = MOCK_SUBJECTS.find(s => s.id === trendSubjectId) ?? MOCK_SUBJECTS[0];
                        const offExams = OFFLINE_EXAMS;
                        const onExams = trendSub ? (ONLINE_EXAMS[trendSub.id] ?? []) : [];
                        const trendData = (() => {
                            if (!trendSub) return [];
                            const offRows = offExams.map(ex => ({
                                name: ex.name,
                                score: Math.round(((INITIAL_OFFLINE[trendSub.id]?.[sel.student.id]?.[ex.id] ?? 0) / ex.maxMarks) * 100),
                            }));
                            const onRows = onExams.map(ex => ({
                                name: ex.name,
                                score: Math.round((((INITIAL_ONLINE[trendSub.id]?.[sel.student.id]?.[ex.id] ?? 0) as number) / ex.maxMarks) * 100),
                            }));
                            if (trendMode === 'offline') return offRows;
                            if (trendMode === 'online') return onRows;
                            return [...offRows, ...onRows];
                        })();

                        return (
                            <div className="h-full overflow-y-auto space-y-3">

                                {/* Top card: 380px */}
                                <div className="shrink-0 bg-background border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col" style={{ height: '380px' }}>
                                    {/* Header: subject pills + mode toggle */}
                                    <div className="px-3 py-2 border-b border-border/40 bg-muted/20 flex items-center gap-2 shrink-0">
                                        <div className="flex-1 min-w-0 overflow-x-auto">
                                            <div className="flex gap-1.5">
                                                {MOCK_SUBJECTS.map(s => (
                                                    <button key={s.id} onClick={() => setTrendSubjectId(s.id)}
                                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all shrink-0"
                                                        style={trendSubjectId === s.id ? { background: s.color + '20', color: s.color, border: '1px solid ' + s.color + '40' } : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}>
                                                        <BookOpen size={10} />
                                                        {s.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40 shrink-0">
                                            {(['offline', 'online', 'combined'] as const).map(t => (
                                                <button key={t} onClick={() => setTrendMode(t)}
                                                    className={'px-2 py-0.5 rounded-md text-[9px] font-semibold capitalize transition-all ' + (trendMode === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Body: student info left + chart right */}
                                    <div className="flex flex-1 min-h-0">
                                        <div className="w-[22%] shrink-0 border-r border-border/40 px-3 py-3 flex flex-col items-center gap-2">
                                            <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-white/20"
                                                style={{ background: getAvatarColor(sel.student.name) }}>
                                                {getInitials(sel.student.name)}
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold leading-tight">{sel.student.name}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">Roll No. {sel.student.rollNo}</p>
                                            </div>
                                            <div className="text-center px-3 py-2 rounded-xl border border-amber-400/30 bg-amber-400/5 w-full">
                                                <p className="text-[18px] font-black text-amber-500">#{rank}</p>
                                                <p className="text-[9px] text-muted-foreground">Class Rank</p>
                                            </div>
                                            <div className="text-center w-full">
                                                <p className="text-[11px] font-black" style={{ color: scoreColor(sel.combPct) }}>{sel.combPct}%</p>
                                                <p className="text-[9px] text-muted-foreground">Overall</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 min-h-0 p-3 flex flex-col">
                                            <p className="text-xs font-bold shrink-0 mb-2">Performance Trend</p>
                                            {trendData.length === 0
                                                ? <p className="text-xs text-muted-foreground text-center py-8">No data</p>
                                                : <div className="flex-1 min-h-0">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={trendData} margin={{ top: 28, right: 8, left: -20, bottom: 0 }}>
                                                            <defs>
                                                                <linearGradient id={`trendGrad-${trendSub?.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor={trendSub?.color ?? '#7C3AED'} stopOpacity={0.3} />
                                                                    <stop offset="95%" stopColor={trendSub?.color ?? '#7C3AED'} stopOpacity={0} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                                                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                                                            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} unit="%" />
                                                            <Tooltip
                                                                contentStyle={{ background: '#1A1030', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 11 }}
                                                                labelStyle={{ color: '#F1F5F9' }}
                                                                formatter={(val: unknown) => [`${val}%`, 'Score']}
                                                                itemStyle={{ color: trendSub?.color ?? '#7C3AED' }}
                                                            />
                                                            <Area type="monotone" dataKey="score" stroke={trendSub?.color ?? '#7C3AED'} strokeWidth={2}
                                                                fill={`url(#trendGrad-${trendSub?.id})`}
                                                                dot={(dotProps: any) => {
                                                                    const { cx, cy, payload } = dotProps;
                                                                    const score = payload.score;
                                                                    const vals = trendData.map((d: any) => d.score);
                                                                    const isMax = score === Math.max(...vals);
                                                                    const isMin = score === Math.min(...vals);
                                                                    const labelColor = isMin ? '#EF4444' : '#10B981';
                                                                    return (
                                                                        <g style={{ overflow: 'visible' }}>
                                                                            <circle cx={cx} cy={cy} r={4} fill={trendSub?.color ?? '#7C3AED'} />
                                                                            {(isMax || isMin) && (
                                                                                <>
                                                                                    <rect x={cx - 14} y={isMin ? cy + 7 : cy - 21} width={28} height={14} rx={3} fill={labelColor} />
                                                                                    <text x={cx} y={isMin ? cy + 17 : cy - 10} textAnchor="middle" fill="white" fontSize={9} fontWeight="600">{score}%</text>
                                                                                </>
                                                                            )}
                                                                        </g>
                                                                    );
                                                                }}
                                                                activeDot={{ r: 6 }}
                                                            />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Report Card */}
                                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                                    <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between relative">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Report Card</p>
                                        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                                            <span className="text-[12px] font-semibold text-foreground">{sel.student.name}</span>
                                            <span className="text-[11px] text-muted-foreground">Roll No. {sel.student.rollNo}</span>
                                        </div>
                                        <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
                                            {(['offline', 'online'] as const).map(t => (
                                                <button key={t} onClick={() => setReportCardTab(t)}
                                                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold capitalize transition-all ${reportCardTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {(() => {
                                        const scores = reportCardTab === 'offline' ? INITIAL_OFFLINE : INITIAL_ONLINE;
                                        const bgCell = (pct: number | null) =>
                                            pct === null ? '#FAF5EE' : pct >= 75 ? '#DCFCE7' : pct >= 50 ? '#FEF9C3' : '#FEE2E2';
                                        const fgCell = (pct: number | null) =>
                                            pct === null ? '#888' : pct >= 75 ? '#15803d' : pct >= 50 ? '#854d0e' : '#b91c1c';
                                        const headerExams = reportCardTab === 'offline'
                                            ? OFFLINE_EXAMS
                                            : (ONLINE_EXAMS[MOCK_SUBJECTS[0]?.id] ?? []);
                                        const GRADED_SUBS = [
                                            { id: 'gs1', name: 'PT' }, { id: 'gs2', name: 'SG' }, { id: 'gs3', name: 'ICT' },
                                            { id: 'gs4', name: 'GK' }, { id: 'gs5', name: 'ART' }, { id: 'gs6', name: 'EVS' }, { id: 'gs7', name: 'VE' },
                                        ];
                                        const isOffline = reportCardTab === 'offline';

                                        // Compute per-subject data + running grand total
                                        let grandScored = 0, grandMax = 0;
                                        const subjectData = MOCK_SUBJECTS.map(sub => {
                                            const examList = isOffline ? OFFLINE_EXAMS : (ONLINE_EXAMS[sub.id] ?? []);
                                            const maxTotal = examList.reduce((s, ex) => s + ex.maxMarks, 0);
                                            let scored = 0;
                                            const cells = examList.map(ex => {
                                                const val = (scores[sub.id]?.[sel.student.id]?.[ex.id] ?? null) as number | null;
                                                if (val !== null) scored += val;
                                                const pct = val !== null && ex.maxMarks > 0 ? Math.round((val / ex.maxMarks) * 100) : null;
                                                return { ex, val, maxMarks: ex.maxMarks, pct };
                                            });
                                            const totalPct = maxTotal > 0 ? Math.round((scored / maxTotal) * 100) : null;
                                            grandScored += scored;
                                            grandMax += maxTotal;
                                            return { sub, cells, scored, maxTotal, totalPct };
                                        });
                                        const grandPct = grandMax > 0 ? Math.round((grandScored / grandMax) * 100) : null;

                                        return (
                                            <div style={{ overflowX: 'auto', overflowY: 'auto', height: '364px', background: '#F8F3EC', scrollbarWidth: 'thin', scrollbarColor: '#D8C4A0 #F8F3EC' }}>
                                                {isOffline ? (
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                                        {/* Offline: flat subjects table */}
                                                        <table className="text-[12px] border-separate border-spacing-0 min-w-max" style={{ color: "#2A1F10" }}>
                                                            <thead className="sticky top-0 z-30">
                                                                <tr>
                                                                    <th className="sticky left-0 z-40 bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-left font-bold text-[#2A1F10] whitespace-nowrap min-w-[110px]">Subjects</th>
                                                                    {headerExams.map(ex => (
                                                                        <th key={ex.id} className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[60px]">
                                                                            <div style={{ fontWeight: 600, fontSize: 10 }}>{ex.name}</div>
                                                                            <div style={{ fontWeight: 600, fontSize: 10, opacity: 0.7 }}>/{ex.maxMarks}</div>
                                                                        </th>
                                                                    ))}
                                                                    <th className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[56px]" style={{ fontWeight: 700 }}>Total</th>
                                                                    <th className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[52px]" style={{ fontWeight: 700 }}>%</th>
                                                                    <th className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[48px]" style={{ fontWeight: 700 }}>Grade</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {subjectData.map(({ sub, cells, scored, maxTotal, totalPct }) => (
                                                                    <tr key={sub.id}>
                                                                        <td className="sticky left-0 z-20 bg-[#FAF5EE] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 font-semibold text-[#2A1F10] whitespace-nowrap">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sub.color }} />
                                                                                {sub.name}
                                                                            </div>
                                                                        </td>
                                                                        {cells.map(({ ex, val, maxMarks, pct }) => (
                                                                            <td key={ex.id} className="border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold">
                                                                                {val !== null ? <span style={{ color: scoreColor(pct ?? 0) }}>{val}</span> : '—'}
                                                                            </td>
                                                                        ))}
                                                                        <td className="border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#FAF5EE]">
                                                                            {scored}/{maxTotal}
                                                                        </td>
                                                                        <td className="border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap">
                                                                            {totalPct !== null ? <span style={{ color: scoreColor(totalPct), fontWeight: 700 }}>{totalPct}%</span> : '—'}
                                                                        </td>
                                                                        <td className="border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold">
                                                                            {totalPct !== null ? <span style={{ color: scoreColor(totalPct) }}>{grade(totalPct)}</span> : '—'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                {/* Grand Total row */}
                                                                <tr>
                                                                    <td className="sticky left-0 z-20 bg-[#FAF5EE] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 font-bold text-[#2A1F10] whitespace-nowrap">Grand Total</td>
                                                                    {headerExams.map(ex => (
                                                                        <td key={ex.id} className="bg-[#FAF5EE] border-[0.5px] border-[#D8C4A0]" />
                                                                    ))}
                                                                    <td className="border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center font-bold whitespace-nowrap bg-[#E8DDD0]">
                                                                        {grandScored}/{grandMax}
                                                                    </td>
                                                                    <td className="border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap bg-[#E8DDD0]">
                                                                        {grandPct !== null ? <span style={{ color: scoreColor(grandPct), fontWeight: 700 }}>{grandPct}%</span> : '—'}
                                                                    </td>
                                                                    <td className="border-[0.5px] border-[#D8C4A0] px-2 py-1.5 text-center whitespace-nowrap font-semibold bg-[#E8DDD0]">
                                                                        {grandPct !== null ? <span style={{ color: scoreColor(grandPct) }}>{grade(grandPct)}</span> : '—'}
                                                                    </td>
                                                                </tr>
                                                                {/* Conduct & Remarks row - offline only */}
                                                                <tr>
                                                                    <td className="sticky left-0 z-20 bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 font-bold text-[#2A1F10] whitespace-nowrap">Conduct</td>
                                                                    <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-[#2A1F10] whitespace-nowrap">Excellent</td>
                                                                    <td className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 font-bold text-[#2A1F10] whitespace-nowrap">Remarks</td>
                                                                    <td colSpan={headerExams.length + 1} className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-[#2A1F10] italic text-[11px]">Good keep it up</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                        {/* Graded Subjects table - offline only */}
                                                        {isOffline && (
                                                            <table className="text-[12px] border-separate border-spacing-0 min-w-max shrink-0" style={{ color: "#2A1F10" }}>
                                                                <thead className="sticky top-0 z-30">
                                                                    <tr>
                                                                        <th className="sticky left-0 z-40 bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-left font-semibold text-[#2A1F10] whitespace-nowrap min-w-[110px]" style={{ lineHeight: '30px', fontWeight: 700 }}>Graded Subjects</th>
                                                                        <th className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-4 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[80px]" style={{ lineHeight: '30px' }}>Term 1</th>
                                                                        <th className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-4 py-1.5 text-center font-semibold text-[#2A1F10] whitespace-nowrap min-w-[80px]" style={{ lineHeight: '30px' }}>Term 2</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {GRADED_SUBS.map(gs => (
                                                                        <tr key={gs.id}>
                                                                            <td className="sticky left-0 z-20 bg-[#FAF5EE] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 font-semibold text-[#2A1F10] whitespace-nowrap">{gs.name}</td>
                                                                            <td className="border-[0.5px] border-[#D8C4A0] px-4 py-1.5 text-center whitespace-nowrap" style={{ color: '#C8B89A' }}>—</td>
                                                                            <td className="border-[0.5px] border-[#D8C4A0] px-4 py-1.5 text-center whitespace-nowrap" style={{ color: '#C8B89A' }}>—</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </div>
                                                ) : (
                                                    /* Online: grouped by subject */
                                                    <table className="text-[12px] border-separate border-spacing-0 min-w-max w-full" style={{ color: "#2A1F10" }}>
                                                        <thead className="sticky top-0 z-30">
                                                            <tr>
                                                                <th className="sticky left-0 z-40 bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-left font-bold text-[#2A1F10] whitespace-nowrap min-w-[180px]">Subject / Exam</th>
                                                                <th className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center font-bold text-[#2A1F10] whitespace-nowrap min-w-[60px]">Score</th>
                                                                <th className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center font-bold text-[#2A1F10] whitespace-nowrap min-w-[52px]">Max</th>
                                                                <th className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center font-bold text-[#2A1F10] whitespace-nowrap min-w-[52px]">%</th>
                                                                <th className="bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center font-bold text-[#2A1F10] whitespace-nowrap min-w-[48px]">Grade</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {subjectData.map(({ sub, cells, scored, maxTotal, totalPct }) => (
                                                                <React.Fragment key={sub.id}>
                                                                    <tr>
                                                                        <td colSpan={5} className="sticky left-0 z-20 bg-[#EDE4D6] border-[0.5px] border-[#D8C4A0] px-3 py-1 font-bold text-[#2A1F10] whitespace-nowrap">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color }} />
                                                                                {sub.name}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    {cells.map(({ ex, val, pct }) => (
                                                                        <tr key={ex.id}>
                                                                            <td className="sticky left-0 z-20 bg-[#FAF5EE] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-[#2A1F10] whitespace-nowrap pl-7">
                                                                                <div className="flex items-center gap-2">
                                                                                    {(ex as any).date && <span style={{ fontSize: 11, opacity: 0.6, whiteSpace: 'nowrap' }}>{(ex as any).date}</span>}
                                                                                    <span>{ex.name}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap font-semibold">
                                                                                {val !== null ? <span style={{ color: scoreColor(pct ?? 0) }}>{val}</span> : '—'}
                                                                            </td>
                                                                            <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap text-[#2A1F10]">{ex.maxMarks}</td>
                                                                            <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap">
                                                                                {pct !== null ? <span style={{ color: scoreColor(pct), fontWeight: 600 }}>{pct}%</span> : '—'}
                                                                            </td>
                                                                            <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap" style={{ color: '#C8B89A' }}>—</td>
                                                                        </tr>
                                                                    ))}
                                                                    <tr>
                                                                        <td className="sticky left-0 z-20 bg-[#FAF5EE] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 font-semibold text-[#2A1F10] whitespace-nowrap pl-7 italic">Total</td>
                                                                        <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center font-bold whitespace-nowrap bg-[#FAF5EE]">{scored}</td>
                                                                        <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center font-bold whitespace-nowrap bg-[#FAF5EE]">{maxTotal}</td>
                                                                        <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap">
                                                                            {totalPct !== null ? <span style={{ color: scoreColor(totalPct), fontWeight: 700 }}>{totalPct}%</span> : '—'}
                                                                        </td>
                                                                        <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap font-semibold">
                                                                            {totalPct !== null ? <span style={{ color: scoreColor(totalPct) }}>{grade(totalPct)}</span> : '—'}
                                                                        </td>
                                                                    </tr>
                                                                </React.Fragment>
                                                            ))}
                                                            <tr style={{ position: 'sticky', bottom: 0, zIndex: 25 }}>
                                                                <td className="sticky left-0 z-30 bg-[#E8DDD0] border-[0.5px] border-[#D8C4A0] px-3 py-1.5 font-bold text-[#2A1F10] whitespace-nowrap">Grand Total</td>
                                                                <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center font-bold whitespace-nowrap bg-[#E8DDD0]">{grandScored}</td>
                                                                <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center font-bold whitespace-nowrap bg-[#E8DDD0]">{grandMax}</td>
                                                                <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap bg-[#E8DDD0]">
                                                                    {grandPct !== null ? <span style={{ color: scoreColor(grandPct), fontWeight: 700 }}>{grandPct}%</span> : '—'}
                                                                </td>
                                                                <td className="border-[0.5px] border-[#D8C4A0] px-3 py-1.5 text-center whitespace-nowrap font-semibold bg-[#E8DDD0]">
                                                                    {grandPct !== null ? <span style={{ color: scoreColor(grandPct) }}>{grade(grandPct)}</span> : '—'}
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    {/* Footer */}
                                    <div className="border-t border-border/40 bg-muted/20 px-4 py-2 shrink-0 flex items-center gap-5">
                                        {[
                                            { label: '≥75% Pass', color: '#059669', sample: 75 },
                                            { label: '35–74% Pass', color: '#F59E0B', sample: 36 },
                                            { label: '<35% Fail', color: '#DC2626', sample: 17 },
                                        ].map(item => (
                                            <div key={item.label} className="flex items-center gap-1.5">
                                                <span style={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: item.color }}>{item.sample}%</span>
                                                <span className="text-[10px] text-muted-foreground">{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

// ── Main MarksTab ─────────────────────────────────────────────────────────────────────────────

export default function MarksTab({
    divisionName,
    subjects,
    subTab,
    onSubTabChange,
    onStatsChange,
    restrictToSubjectId,
    readOnly,
}: {
    divisionName: string;
    subjects: { id: string; name: string; code: string; color: string }[];
    subTab: MarksSubTab;
    onSubTabChange: (tab: MarksSubTab) => void;
    onStatsChange: (stats: MarksStats) => void;
    restrictToSubjectId?: string | null;
    readOnly?: boolean;
}) {
    const mappedSubjects: Subject[] = subjects.map(s => ({
        id: s.id, name: s.name, code: s.code, color: s.color,
    }));

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className={subTab === "offline" ? "flex-1 min-h-0 flex flex-col pt-3 pb-3 px-1" : "hidden"}>
                <MarkSheet
                    students={MOCK_STUDENTS}
                    subjects={mappedSubjects}
                    mode="offline"
                    divisionName={divisionName}
                    isActive={subTab === "offline"}
                    onStatsChange={onStatsChange}
                    restrictToSubjectId={restrictToSubjectId}
                    readOnly={readOnly}
                />
            </div>
            <div className={subTab === "online" ? "flex-1 min-h-0 flex flex-col pt-3 pb-3 px-1" : "hidden"}>
                <MarkSheet
                    students={MOCK_STUDENTS}
                    subjects={mappedSubjects}
                    mode="online"
                    divisionName={divisionName}
                    isActive={subTab === "online"}
                    onStatsChange={onStatsChange}
                    restrictToSubjectId={restrictToSubjectId}
                    readOnly={readOnly}
                />
            </div>
            {subTab === "overall" && (
                <div className="flex-1 min-h-0 flex flex-col">
                    <OverallView
                        divisionName={divisionName}
                        subjects={mappedSubjects}
                        onStatsChange={onStatsChange}
                    />
                </div>
            )}
        </div>
    );
}
