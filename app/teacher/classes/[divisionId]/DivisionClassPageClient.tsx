'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Users } from 'lucide-react';
import api from '@/lib/api';
import ViewTab from './ViewTab';
import ManageTab from './ManageTab';
import FeesTab from './FeesTab';

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
    const subjectId = searchParams.get('subjectId') ?? null;

    const TABS = [
        { key: 'view' as const, label: 'View' },
        { key: 'manage' as const, label: 'Manage' },
        ...(isClassTeacher ? [{ key: 'fees' as const, label: 'Fees' }] : []),
    ];

    const [division, setDivision] = useState<Division | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'view' | 'manage' | 'fees'>('view');
    const fetchedRef = useRef(false);

    const fetchDivision = useCallback(async () => {
        try {
            const res = await api.get(`/teacher/classes/${divisionId}`);
            setDivision(res.data.data);
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
                        <button onClick={() => router.back()}
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all">
                            <ArrowLeft size={16} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Users size={24} /> {division.name}
                            </h1>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {division.standard.name} <ChevronRight size={11} /> {division.name}
                                <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${isClassTeacher
                                        ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300'
                                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                    }`}>
                                    {isClassTeacher ? 'Class Teacher' : 'Subject Teacher'}
                                </span>
                            </p>
                        </div>

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
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
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
                    {activeTab === 'fees' && isClassTeacher && (
                        <motion.div key="fees" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                            <FeesTab divisionId={divisionId} divisionName={division.name} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}