'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ChevronRight, Plus, Check, X,
    BookOpen, Users, GraduationCap, ArrowUpRight, User as UserIcon, LayoutGrid, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { assignSubjectColor } from '@/lib/subjectColors';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Subject { id: string; name: string; code: string; color: string; }
interface Division {
    id: string; name: string; studentCount: number;
    classTeacher?: string; classTeacherName?: string;
    subjects: { subjectId: string; teacherId?: string; teacherName?: string; }[];
}
interface Standard {
    id: string; name: string; code: string;
    subjects: Subject[];
    divisions: Division[];
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_TEACHERS_LIST = [
    { id: 't1', name: 'Ritu Sharma' },
    { id: 't2', name: 'Ankit Verma' },
    { id: 't3', name: 'Priya Nair' },
    { id: 't4', name: 'Meena Patel' },
    { id: 't5', name: 'Suresh Iyer' },
];

const MOCK_STANDARDS: Standard[] = [
    {
        id: 's1', name: 'Class 10', code: '10',
        subjects: [
            { id: 'sub1', name: 'Mathematics', code: 'MATH', color: '#7C3AED' },
            { id: 'sub2', name: 'Science', code: 'SCI', color: '#0891B2' },
            { id: 'sub3', name: 'English', code: 'ENG', color: '#DA7756' },
            { id: 'sub4', name: 'Hindi', code: 'HIN', color: '#059669' },
            { id: 'sub5', name: 'History', code: 'HIS', color: '#D97706' },
            { id: 'sub6', name: 'Geography', code: 'GEO', color: '#8B5CF6' },
        ],
        divisions: [
            {
                id: 'd1', name: '10-A', studentCount: 32,
                classTeacher: 't1', classTeacherName: 'Ritu Sharma',
                subjects: [
                    { subjectId: 'sub1', teacherId: 't1', teacherName: 'Ritu Sharma' },
                    { subjectId: 'sub2', teacherId: 't2', teacherName: 'Ankit Verma' },
                    { subjectId: 'sub3', teacherId: 't3', teacherName: 'Priya Nair' },
                    { subjectId: 'sub4', teacherId: 't4', teacherName: 'Meena Patel' },
                    { subjectId: 'sub5', teacherId: 't5', teacherName: 'Suresh Iyer' },
                    { subjectId: 'sub6' },
                ],
            },
            {
                id: 'd2', name: '10-B', studentCount: 28,
                subjects: [
                    { subjectId: 'sub1', teacherId: 't1', teacherName: 'Ritu Sharma' },
                    { subjectId: 'sub2' },
                    { subjectId: 'sub3' },
                    { subjectId: 'sub4' },
                    { subjectId: 'sub5' },
                    { subjectId: 'sub6' },
                ],
            },
            { id: 'd3', name: '10-C', studentCount: 25, subjects: [] },
        ],
    },
    {
        id: 's2', name: 'Class 9', code: '9',
        subjects: [
            { id: 'sub4', name: 'Mathematics', code: 'MATH', color: '#7C3AED' },
            { id: 'sub5', name: 'Hindi', code: 'HIN', color: '#059669' },
        ],
        divisions: [
            {
                id: 'd4', name: '9-A', studentCount: 30,
                classTeacher: 't4', classTeacherName: 'Meena Patel',
                subjects: [{ subjectId: 'sub4', teacherId: 't4', teacherName: 'Meena Patel' }],
            },
            { id: 'd5', name: '9-B', studentCount: 27, subjects: [] },
        ],
    },
    {
        id: 's3', name: 'Class 8', code: '8',
        subjects: [],
        divisions: [],
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ── Teacher Picker ────────────────────────────────────────────────────────────
function TeacherPicker({ value, onChange, accentColor }: {
    value?: string; onChange: (id: string, name: string) => void; accentColor?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = MOCK_TEACHERS_LIST.find(t => t.id === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-medium transition-all"
                style={selected ? {
                    borderColor: (accentColor ?? '#7C3AED') + '60',
                    background: (accentColor ?? '#7C3AED') + '10',
                    color: accentColor ?? '#7C3AED',
                } : {}}>
                <UserIcon size={11} />
                {selected ? selected.name : 'Assign'}
                <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-8 right-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
                        {MOCK_TEACHERS_LIST.map(t => (
                            <button key={t.id} type="button"
                                onClick={() => { onChange(t.id, t.name); setOpen(false); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors ${value === t.id ? 'text-primary font-semibold' : 'text-foreground'
                                    }`}>
                                <div className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-[9px] font-bold text-violet-700 dark:text-violet-300 shrink-0">
                                    {getInitials(t.name)}
                                </div>
                                {t.name}
                                {value === t.id && <Check size={11} className="ml-auto text-primary shrink-0" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Inline Add Input ──────────────────────────────────────────────────────────
function InlineAddInput({ placeholder, onAdd, onCancel }: {
    placeholder: string; onAdd: (val: string) => void; onCancel: () => void;
}) {
    const [val, setVal] = useState('');
    return (
        <div className="flex items-center gap-1.5">
            <input autoFocus value={val} onChange={e => setVal(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && val.trim()) onAdd(val.trim());
                    if (e.key === 'Escape') onCancel();
                }}
                placeholder={placeholder}
                className="h-8 px-3 rounded-xl border border-primary/50 bg-primary/5 text-xs focus:outline-none focus:border-primary transition-all w-36"
            />
            <button onClick={() => val.trim() && onAdd(val.trim())}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                <Check size={13} />
            </button>
            <button onClick={onCancel}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                <X size={13} />
            </button>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClassesPage() {
    const router = useRouter();
    const { instType } = useMockInstType();
    const [standards, setStandards] = useState<Standard[]>(MOCK_STANDARDS);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [addingSubject, setAddingSubject] = useState<string | null>(null);
    const [addingDivision, setAddingDivision] = useState<string | null>(null);
    const [addingStandard, setAddingStandard] = useState(false);

    const standardLabel = instType === 'COLLEGE' ? 'Department' : instType === 'COACHING' ? 'Batch' : 'Standard';
    const divisionLabel = instType === 'COLLEGE' ? 'Section' : instType === 'COACHING' ? 'Group' : 'Division';

    const addStandard = (name: string) => {
        const newS: Standard = {
            id: `s-${Date.now()}`, name, code: name,
            subjects: [], divisions: [],
        };
        setStandards(prev => [...prev, newS]);
        setAddingStandard(false);
        setExpandedId(newS.id);
        toast.success(`${standardLabel} added`);
    };

    const addSubject = (standardId: string, name: string) => {
        const std = standards.find(s => s.id === standardId);
        const colorIndex = std?.subjects.length ?? 0;
        const color = assignSubjectColor(colorIndex);
        const newSubId = `sub-${Date.now()}`;
        setStandards(prev => prev.map(s => s.id !== standardId ? s : {
            ...s,
            subjects: [...s.subjects, { id: newSubId, name, code: name.slice(0, 4).toUpperCase(), color }],
            divisions: s.divisions.map(d => ({
                ...d,
                subjects: [...d.subjects, { subjectId: newSubId }],
            })),
        }));
        setAddingSubject(null);
        toast.success(`Subject added to all ${divisionLabel.toLowerCase()}s`);
    };

    const addDivision = (standardId: string, name: string) => {
        const std = standards.find(s => s.id === standardId);
        if (!std) return;
        const newDiv: Division = {
            id: `d-${Date.now()}`, name, studentCount: 0,
            subjects: std.subjects.map(sub => ({ subjectId: sub.id })),
        };
        setStandards(prev => prev.map(s => s.id !== standardId ? s : {
            ...s, divisions: [...s.divisions, newDiv],
        }));
        setAddingDivision(null);
        toast.success(`${divisionLabel} added`);
    };

    const assignTeacher = (standardId: string, divisionId: string, subjectId: string, teacherId: string, teacherName: string) => {
        setStandards(prev => prev.map(s => s.id !== standardId ? s : {
            ...s,
            divisions: s.divisions.map(d => d.id !== divisionId ? d : {
                ...d,
                subjects: d.subjects.map(sub => sub.subjectId !== subjectId ? sub : {
                    ...sub, teacherId, teacherName,
                }),
            }),
        }));
        toast.success(`${teacherName} assigned`);
    };

    const assignClassTeacher = (standardId: string, divisionId: string, teacherId: string, teacherName: string) => {
        setStandards(prev => prev.map(s => s.id !== standardId ? s : {
            ...s,
            divisions: s.divisions.map(d => d.id !== divisionId ? d : {
                ...d, classTeacher: teacherId, classTeacherName: teacherName,
            }),
        }));
        toast.success(`Class teacher assigned`);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden pb-3">

            {/* Header */}
            <div className="shrink-0 pt-0 pb-0 px-1 sticky top-0 z-20 bg-background">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <LayoutGrid size={21} />
                                Classes
                            </h1>
                            <p className="text-[13px] text-muted-foreground">
                                {standards.length} standards · {standards.reduce((n, s) => n + s.divisions.length, 0)} divisions · {standards.reduce((n, s) => n + s.divisions.reduce((m, d) => m + d.studentCount, 0), 0)} students
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setAddingStandard(true)}
                        className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        <Plus size={15} /> Add {standardLabel}
                    </button>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Standards list */}
            <div className="flex-1 overflow-y-auto px-1 pb-6 pt-3 space-y-3">

                {addingStandard && (
                    <div className="bg-card border border-primary/30 rounded-2xl px-5 py-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-3">New {standardLabel}</p>
                        <InlineAddInput placeholder="e.g. Class 7" onAdd={addStandard} onCancel={() => setAddingStandard(false)} />
                    </div>
                )}

                {standards.map((std, idx) => {
                    const isExpanded = expandedId === std.id;
                    const assignedCount = std.divisions.reduce((n, d) => n + d.subjects.filter(s => s.teacherId).length, 0);
                    const totalAssign = std.divisions.length * std.subjects.length;
                    const assignPct = totalAssign > 0 ? Math.round((assignedCount / totalAssign) * 100) : 0;
                    const totalStudents = std.divisions.reduce((n, d) => n + d.studentCount, 0);

                    const gradients = [
                        'linear-gradient(135deg, #7C3AED, #9F67FF)',
                        'linear-gradient(135deg, #DA7756, #E8876A)',
                        'linear-gradient(135deg, #0891B2, #38BDF8)',
                        'linear-gradient(135deg, #059669, #34D399)',
                        'linear-gradient(135deg, #D97706, #FCD34D)',
                    ];
                    const grad = gradients[idx % gradients.length];

                    return (
                        <div key={std.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden">

                            {/* Standard header */}
                            <button onClick={() => setExpandedId(isExpanded ? null : std.id)}
                                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black text-white shrink-0"
                                        style={{ background: grad }}>
                                        {std.code}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold">{std.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-[11px] text-muted-foreground">{std.divisions.length} {divisionLabel.toLowerCase()}s</span>
                                            <span className="text-muted-foreground/40 text-[11px]">·</span>
                                            <span className="text-[11px] text-muted-foreground">{std.subjects.length} subjects</span>
                                            <span className="text-muted-foreground/40 text-[11px]">·</span>
                                            <span className="text-[11px] text-muted-foreground">{totalStudents} students</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {/* Expanded */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                        <div className="border-t border-border/40 px-5 py-4 space-y-5">

                                            {/* Subjects */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2.5">
                                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                        Subjects
                                                        <span className="text-[10px] font-normal normal-case ml-1.5 opacity-60">— all {divisionLabel.toLowerCase()}s</span>
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {std.subjects.map(sub => (
                                                        <span key={sub.id}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                                                            style={{
                                                                background: sub.color + '20',
                                                                color: sub.color,
                                                                border: `1px solid ${sub.color}40`
                                                            }}>
                                                            <BookOpen size={11} />
                                                            {sub.name}
                                                        </span>
                                                    ))}
                                                    {std.subjects.length === 0 && (
                                                        <span className="text-xs text-muted-foreground/60 italic">No subjects yet</span>
                                                    )}
                                                    {addingSubject === std.id ? (
                                                        <InlineAddInput placeholder="Subject name" onAdd={name => addSubject(std.id, name)} onCancel={() => setAddingSubject(null)} />
                                                    ) : (
                                                        <button onClick={() => setAddingSubject(std.id)}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                                                            <Plus size={11} /> Add subject
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Divisions */}
                                            <div>
                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                                                    {divisionLabel}s
                                                </p>
                                                {std.divisions.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground/60 italic mb-2">No {divisionLabel.toLowerCase()}s yet</p>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                                                        {std.divisions.map((div, divIdx) => {
                                                            const divAssigned = div.subjects.filter(s => s.teacherId).length;
                                                            const divTotal = std.subjects.length;
                                                            const allDone = divTotal > 0 && divAssigned === divTotal;

                                                            return (
                                                                <motion.div
                                                                    key={div.id}
                                                                    initial={{ opacity: 0, y: 20 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: divIdx * 0.05, duration: 0.3 }}
                                                                    className="rounded-2xl border border-border/50 overflow-hidden flex flex-col bg-background transition-all duration-200 hover:shadow-md hover:shadow-black/5 hover:border-border">
                                                                    <div className="px-4 pt-4 pb-3 border-b border-border/40">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <div className="flex items-center gap-2.5">
                                                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-2 border-white/20"
                                                                                    style={{ background: grad }}>
                                                                                    <span className="text-sm font-black text-white">
                                                                                        {div.name.includes('-') ? div.name.split('-')[1] : div.name[0]}
                                                                                    </span>
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-sm font-bold">{div.name}</p>
                                                                                    <p className="text-[11px] text-muted-foreground">{div.studentCount} students</p>
                                                                                </div>
                                                                            </div>

                                                                            {/* Arrow — terracotta */}
                                                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                                                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                                                                onClick={() => router.push(`/admin/campus/classes/${std.id}/${div.id}`)}>
                                                                                <ArrowUpRight size={19} className="text-white" />
                                                                            </div>
                                                                        </div>
                                                                        {div.classTeacherName && (
                                                                            <span className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                                                                                style={{ background: '#F59E0B20', color: '#F59E0B' }}>
                                                                                CT: {div.classTeacherName}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Subject assignments */}
                                                                    <div className="px-4 py-2 flex-1">
                                                                        <div className="flex items-center justify-between py-2 border-b border-border/30">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
                                                                                <span className="text-[11px] text-muted-foreground">Class Teacher</span>
                                                                            </div>
                                                                            {div.classTeacherName ? (
                                                                                <span className="text-[11px] font-semibold" style={{ color: '#F59E0B' }}>{div.classTeacherName}</span>
                                                                            ) : (
                                                                                <span className="text-[11px] text-muted-foreground/50 italic">Not assigned</span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider py-2">Subjects</p>
                                                                        {std.subjects.map(sub => {
                                                                            const assignment = div.subjects.find(s => s.subjectId === sub.id);
                                                                            return (
                                                                                <div key={sub.id} className="flex items-center justify-between py-2 border-t border-border/20">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color }} />
                                                                                        <span className="text-[11px] text-muted-foreground">{sub.name}</span>
                                                                                    </div>
                                                                                    {assignment?.teacherName ? (
                                                                                        <span className="text-[10px] font-semibold truncate max-w-[80px] text-right text-foreground">
                                                                                            {assignment.teacherName}
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-[10px] text-muted-foreground/50 italic">Not assigned</span>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </motion.div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Add division */}
                                                {addingDivision === std.id ? (
                                                    <InlineAddInput placeholder={`e.g. ${std.code}-D`}
                                                        onAdd={name => addDivision(std.id, name)} onCancel={() => setAddingDivision(null)} />
                                                ) : (
                                                    <button onClick={() => setAddingDivision(std.id)}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                                                        <Plus size={11} /> Add {divisionLabel}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}