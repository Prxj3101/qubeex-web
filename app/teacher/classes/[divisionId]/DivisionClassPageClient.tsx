'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Users, NotebookPen, Smartphone, BarChart2, CalendarCheck, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import ViewTab from './ViewTab';
import ManageTab from './ManageTab';
import FeesTab from './FeesTab';
import AttendanceTab, { AttendanceSubTab } from './AttendanceTab';
import MarksTab, { MarksSubTab, MarksStats } from './MarksTab';
import TasksTab, { TasksSubTab } from './TasksTab';

export interface Subject {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
    order: number;
}

export interface Assignment {
    id: string;
    subjectId: string | null;
    teacher: { id: string; user: { id: string; name: string | null } };
    subject: { id: string; name: string; color: string | null } | null;
}

export interface Division {
    id: string;
    name: string;
    capacity: number | null;
    standard: { id: string; name: string };
    subjects: Subject[];
    assignments: Assignment[];
}

export function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export const AVATAR_COLORS = ['#7C3AED', '#DA7756', '#0891B2', '#059669', '#D97706', '#DC2626', '#2563EB', '#8B5CF6'];
export function getAvatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export const MOCK_STUDENTS = [
    { id: 'st1', name: 'Aarav Mehta', rollNo: '01', rank: 1, attendance: 92, totalMarks: 487, gender: 'Male', dob: '12 Mar 2009', phone: '+91 98765 43210' },
    { id: 'st2', name: 'Priya Singh', rollNo: '02', rank: 2, attendance: 61, totalMarks: 471, gender: 'Female', dob: '5 Jul 2009', phone: '+91 87654 32109' },
    { id: 'st3', name: 'Rohan Gupta', rollNo: '03', rank: 3, attendance: 78, totalMarks: 458, gender: 'Male', dob: '22 Jan 2009', phone: '+91 76543 21098' },
    { id: 'st4', name: 'Sneha Patel', rollNo: '04', rank: 4, attendance: 55, totalMarks: 445, gender: 'Female', dob: '8 Sep 2009', phone: '+91 65432 10987' },
    { id: 'st5', name: 'Arjun Kumar', rollNo: '05', rank: 5, attendance: 88, totalMarks: 432, gender: 'Male', dob: '15 Apr 2009', phone: '+91 54321 09876' },
    { id: 'st6', name: 'Meera Sharma', rollNo: '06', rank: 6, attendance: 70, totalMarks: 419, gender: 'Female', dob: '3 Dec 2009', phone: '+91 43210 98765' },
    { id: 'st7', name: 'Karan Joshi', rollNo: '07', rank: 7, attendance: 48, totalMarks: 406, gender: 'Male', dob: '19 Feb 2009', phone: '+91 32109 87654' },
    { id: 'st8', name: 'Ananya Nair', rollNo: '08', rank: 8, attendance: 95, totalMarks: 398, gender: 'Female', dob: '27 Jun 2009', phone: '+91 21098 76543' },
    { id: 'st9', name: 'Vikram Rao', rollNo: '09', rank: 9, attendance: 67, totalMarks: 385, gender: 'Male', dob: '11 Oct 2009', phone: '+91 10987 65432' },
    { id: 'st10', name: 'Ishaan Verma', rollNo: '10', rank: 10, attendance: 82, totalMarks: 372, gender: 'Male', dob: '4 Aug 2009', phone: '+91 98765 43211' },
];

export default function DivisionClassPageClient() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const divisionId = params.divisionId as string;

    const role = searchParams.get('role') ?? 'class-teacher';
    const isClassTeacher = role === 'class-teacher';
    const subjectId = searchParams.get('subjectId');

    const TABS = isClassTeacher
        ? [
            { key: 'view' as const, label: 'View' },
            { key: 'manage' as const, label: 'Manage' },
            { key: 'attendance' as const, label: 'Attendance' },
            { key: 'marks' as const, label: 'Marksheet' },
            { key: 'fees' as const, label: 'Fees' },
        ]
        : [
            { key: 'view' as const, label: 'View' },
            { key: 'tasks' as const, label: 'Tasks' },
            { key: 'marks' as const, label: 'Marksheet' },
        ];

    const [division, setDivision] = useState<Division | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'view' | 'manage' | 'attendance' | 'marks' | 'fees' | 'tasks'>('view');

    // ── Attendance sub-tab state lifted here ──────────────────────────────────
    const [attendanceSubTab, setAttendanceSubTab] = useState<AttendanceSubTab>('daily');
    const [attendanceHeaderStats, setAttendanceHeaderStats] = useState<{ overall: number | null; thisMonth: number | null }>({ overall: null, thisMonth: null });

    // ── Marks sub-tab state ───────────────────────────────────────────────────
    const [marksSubTab, setMarksSubTab] = useState<MarksSubTab>('offline');
    const [marksStats, setMarksStats] = useState<MarksStats>({ avg: null, topGrade: null });

    // ── Tasks sub-tab state ───────────────────────────────────────────────────
    const [tasksSubTab, setTasksSubTab] = useState<TasksSubTab>('questions');
    const [tasksStats, setTasksStats] = useState({ tests: 0, assignments: 0 });

    const fetchedRef = useRef(false);

    const fetchDivision = useCallback(async () => {
        try {
            const res = await api.get(`/teacher/classes/${divisionId}`);
            const raw = res.data.data;
            setDivision({ ...raw, subjects: raw.standard?.subjects ?? [] });
        } catch {
            setDivision({
                id: divisionId,
                name: '10-A',
                capacity: 45,
                standard: { id: 'std1', name: 'Class 10' },
                subjects: [
                    { id: 's1', name: 'Mathematics', code: 'MATH', color: '#7C3AED', order: 1 },
                    { id: 's2', name: 'Science', code: 'SCI', color: '#0891B2', order: 2 },
                    { id: 's3', name: 'English', code: 'ENG', color: '#DA7756', order: 3 },
                    { id: 's4', name: 'Hindi', code: 'HIN', color: '#059669', order: 4 },
                ],
                assignments: [
                    { id: 'a1', subjectId: null, teacher: { id: 't1', user: { id: 'u1', name: 'Ritu Sharma' } }, subject: null },
                    { id: 'a2', subjectId: 's1', teacher: { id: 't2', user: { id: 'u2', name: 'Amit Verma' } }, subject: { id: 's1', name: 'Mathematics', color: '#7C3AED' } },
                    { id: 'a3', subjectId: 's2', teacher: { id: 't3', user: { id: 'u3', name: 'Priya Nair' } }, subject: { id: 's2', name: 'Science', color: '#0891B2' } },
                ],
            });
        } finally {
            setLoading(false);
        }
    }, [divisionId]);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchDivision();
    }, [fetchDivision]);

    if (loading) {
        return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading...</div>;
    }

    if (!division) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <p className="text-sm text-muted-foreground">Division not found</p>
                <button onClick={() => router.back()} className="text-xs text-primary underline">Go back</button>
            </div>
        );
    }

    const classTeacherAssignment = division.assignments.find((a: Assignment) => a.subjectId === null);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="shrink-0 px-1 pt-1 pb-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Back button */}
                        <button onClick={() => router.back()}
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all">
                            <ArrowLeft size={16} />
                        </button>

                        {/* Title */}
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Users size={24} /> {division.name}
                            </h1>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {division.standard.name} <ChevronRight size={11} /> {division.name}
                                {isClassTeacher ? (
                                    <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                                        Class Teacher
                                    </span>
                                ) : (() => {
                                    const sub = division.subjects.find(s => s.id === subjectId);
                                    return (
                                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 flex items-center gap-1">
                                            Subject Teacher
                                            {sub && <>
                                                <span className="opacity-40">·</span>
                                                <span>{sub.name}</span>
                                            </>}
                                        </span>
                                    );
                                })()}
                            </p>
                        </div>

                        {/* Main tab bar */}
                        <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 ml-4">
                            {TABS.map(tab => {
                                const isActive = activeTab === tab.key;
                                return (
                                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="relative">
                                        {isActive && (
                                            <motion.div layoutId="divTabTeacher"
                                                className="absolute inset-0 bg-primary rounded-4xl"
                                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                                        )}
                                        <div className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-4xl transition-colors ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {tab.label}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                    </div>

                    {/* Right side — attendance sub-tab toggle + Subjects + Students count */}
                    <div className="flex items-center gap-4">

                        {/* Marks sub-tab toggle */}
                        <AnimatePresence>
                            {activeTab === 'marks' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
                                    {([
                                        { key: 'offline' as MarksSubTab, label: 'Offline', Icon: NotebookPen },
                                        { key: 'online' as MarksSubTab, label: 'Online', Icon: Smartphone },
                                        { key: 'overall' as MarksSubTab, label: 'Overall', Icon: BarChart2 },
                                    ].filter(t => isClassTeacher || t.key !== 'overall')).map(({ key, label, Icon }) => {
                                        const isActive = marksSubTab === key;
                                        return (
                                            <button key={key} onClick={() => setMarksSubTab(key)}
                                                className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all
                                                    ${isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                                <Icon size={14} />
                                                {label}
                                            </button>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Attendance sub-tab — exact same style as "Student Fees | Fee Setup" in screenshot */}
                        <AnimatePresence>
                            {activeTab === 'attendance' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 8 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
                                    {([
                                        { key: 'daily' as AttendanceSubTab, label: 'Daily Attendance', Icon: CalendarCheck },
                                        { key: 'overall' as AttendanceSubTab, label: 'Overall', Icon: BarChart2 },
                                    ]).map(({ key, label, Icon }) => {
                                        const isActive = attendanceSubTab === key;
                                        return (
                                            <button key={key} onClick={() => setAttendanceSubTab(key)}
                                                className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all
                                                    ${isActive
                                                        ? 'bg-card text-foreground shadow-sm'
                                                        : 'text-muted-foreground hover:text-foreground'}`}>
                                                <Icon size={14} />
                                                {label}
                                            </button>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Tasks sub-tab toggle */}
                        <AnimatePresence>
                            {activeTab === 'tasks' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
                                    {([
                                        { key: 'questions' as const, label: 'AI Questions', count: null },
                                        { key: 'tests' as const, label: 'Tests', count: tasksStats.tests },
                                        { key: 'assignments' as const, label: 'Assignments', count: tasksStats.assignments },
                                        { key: 'modules' as const, label: 'Modules', count: null },
                                    ]).map(({ key, label, count }) => (
                                        <button key={key} onClick={() => setTasksSubTab(key)}
                                            className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all
                                            ${tasksSubTab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {label}
                                            {count !== null && (
                                                <span className={`text-[10px] font-bold px-1.5 py-0 rounded-full leading-5 ${tasksSubTab === key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {activeTab === 'attendance' ? (
                            <div className="flex items-center gap-4">
                                {[
                                    { label: 'Class Overall', value: attendanceHeaderStats.overall !== null ? `${attendanceHeaderStats.overall}%` : '—' },
                                    { label: 'This Month', value: attendanceHeaderStats.thisMonth !== null ? `${attendanceHeaderStats.thisMonth}%` : '—' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="text-right">
                                        <p className="text-lg font-bold leading-tight">{value}</p>
                                        <p className="text-[11px] text-muted-foreground">{label}</p>
                                    </div>
                                ))}
                            </div>
                        ) : activeTab === 'fees' ? (
                            <div className="flex items-center gap-4">
                                {[
                                    { label: 'Paid', value: '7', cls: 'text-emerald-500' },
                                    { label: 'Pending', value: '3', cls: 'text-red-500' },
                                ].map(({ label, value, cls }) => (
                                    <div key={label} className="text-right">
                                        <p className={`text-lg font-bold leading-tight ${cls}`}>{value}</p>
                                        <p className="text-[11px] text-muted-foreground">{label}</p>
                                    </div>
                                ))}
                            </div>
                        ) : activeTab === 'marks' ? (
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-lg font-bold leading-tight">
                                        {marksStats.avg !== null ? `${marksStats.avg}%` : '—'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">{marksStats.pill1Label ?? 'Class Avg'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold leading-tight"
                                        style={{ color: marksStats.pill2Color ?? (marksStats.topGrade === 'A' ? '#059669' : marksStats.topGrade === 'B' ? '#F59E0B' : marksStats.topGrade === 'C' ? '#d97706' : marksStats.topGrade === 'D' ? '#DC2626' : undefined) }}>
                                        {marksStats.pill2Value ?? marksStats.topGrade ?? '—'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">{marksStats.pill2Label ?? 'Top Grade'}</p>
                                </div>
                            </div>
                        ) : activeTab === 'tasks' ? (
                            <div className="flex items-center gap-4">
                                {[
                                    { label: 'Tests', value: tasksStats.tests },
                                    { label: 'Assignments', value: tasksStats.assignments },
                                ].map(({ label, value }) => (
                                    <div key={label} className="text-right">
                                        <p className="text-lg font-bold leading-tight">{value}</p>
                                        <p className="text-[11px] text-muted-foreground">{label}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                {[
                                    { label: 'Subjects', value: division.subjects.length },
                                    { label: 'Students', value: MOCK_STUDENTS.length },
                                ].map(({ label, value }) => (
                                    <div key={label} className="text-right">
                                        <p className="text-lg font-bold leading-tight">{value}</p>
                                        <p className="text-[11px] text-muted-foreground">{label}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {activeTab === 'view' && (
                        <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                            <ViewTab division={division} classTeacherAssignment={classTeacherAssignment} isClassTeacher={isClassTeacher} />
                        </motion.div>
                    )}
                    {activeTab === 'manage' && (
                        <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                            <ManageTab division={division} isClassTeacher={isClassTeacher} />
                        </motion.div>
                    )}
                    {activeTab === 'attendance' && (
                        <motion.div key="attendance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                            <AttendanceTab
                                divisionId={divisionId}
                                divisionName={division.name}
                                isClassTeacher={isClassTeacher}
                                attendanceSubTab={attendanceSubTab}
                                onAttendanceSubTabChange={setAttendanceSubTab}
                                onHeaderStatsLoad={setAttendanceHeaderStats}
                            />
                        </motion.div>
                    )}
                    {activeTab === 'marks' && (
                        <motion.div key="marks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                            <MarksTab
                                divisionName={division.name}
                                subjects={division.subjects.map(s => ({
                                    id: s.id, name: s.name,
                                    code: s.code ?? s.name.slice(0, 4).toUpperCase(),
                                    color: s.color ?? '#7C3AED',
                                }))}
                                subTab={marksSubTab}
                                onSubTabChange={setMarksSubTab}
                                onStatsChange={setMarksStats}
                                restrictToSubjectId={isClassTeacher ? null : subjectId}
                            />
                        </motion.div>
                    )}
                    {activeTab === 'fees' && isClassTeacher && (
                        <motion.div key="fees" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                            <FeesTab divisionId={divisionId} divisionName={division.name} />
                        </motion.div>
                    )}
                    {activeTab === 'tasks' && (
                        <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                            <TasksTab divisionId={divisionId} subTab={tasksSubTab} onSubTabChange={setTasksSubTab} onStatsChange={setTasksStats} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
