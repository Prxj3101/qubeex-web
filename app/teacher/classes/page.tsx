// app/(teacher)/classes/page.tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutGrid, Users, BookOpen, GraduationCap, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { assignSubjectColor } from '@/lib/subjectColors';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClassTeacherAssignment {
    id: string;
    divisionId: string;
    divisionName: string;
    standardName: string;
    studentCount: number;
    subjects: { id: string; name: string; color: string | null; teacherName?: string | null }[];
}

interface SubjectTeacherAssignment {
    id: string;
    divisionId: string;
    divisionName: string;
    standardName: string;
    subjectId: string;
    subjectName: string;
    subjectColor: string | null;
    studentCount: number;
}


const GRADIENTS = [
    'linear-gradient(135deg, #7C3AED, #9F67FF)',
    'linear-gradient(135deg, #DA7756, #E8876A)',
    'linear-gradient(135deg, #0891B2, #38BDF8)',
    'linear-gradient(135deg, #059669, #34D399)',
    'linear-gradient(135deg, #D97706, #FCD34D)',
];

function getGradient(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function getDivisionInitial(name: string) {
    return name.includes('-') ? name.split('-').pop() ?? name[0] : name[0];
}

// ── Class Teacher Card ────────────────────────────────────────────────────────
function ClassTeacherCard({ item, index }: { item: ClassTeacherAssignment; index: number }) {
    const grad = getGradient(item.standardName);
    const router = useRouter();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="rounded-2xl border border-border/50 overflow-hidden flex flex-col bg-card hover:shadow-md hover:shadow-black/10 hover:border-border transition-all duration-200 cursor-pointer"
        >
            {/* Top */}
            <div className="px-4 pt-4 pb-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 border-white/20"
                            style={{ background: grad }}>
                            <span className="text-sm font-black text-white">
                                {getDivisionInitial(item.divisionName)}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-bold">{item.divisionName}</p>
                            <p className="text-[11px] text-muted-foreground">{item.standardName}</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                            Class Teacher
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Users size={11} />
                                <span>{item.studentCount}</span>
                            </div>
                            <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                onClick={() => router.push(`/teacher/classes/${item.divisionId}?role=class-teacher`)}>
                                <ArrowUpRight size={19} className="text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom info — admin style */}
            <div className="px-4 pb-3 border-t border-border/40 pt-2.5">
                {/* Class Teacher row */}
                <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
                        <span className="text-[10px] text-muted-foreground">Class Teacher</span>
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: '#F59E0B' }}>You</span>
                </div>

                {/* Subjects */}
                {item.subjects.length > 0 && (
                    <>
                        <p className="text-[9px] font-semibold text-muted-foreground/60 tracking-wider py-2">Subjects</p>
                        {item.subjects.map(sub => (
                            <div key={sub.id} className="flex items-center justify-between py-1 border-t border-border/20">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ background: sub.color ?? '#7C3AED' }} />
                                    <span className="text-[10px] text-muted-foreground">{sub.name}</span>
                                </div>
                                <span className="text-[10px] font-semibold text-muted-foreground/50 italic">
                                    {sub.teacherName ?? 'Not assigned'}
                                </span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </motion.div>
    );
}

// ── Subject Teacher Card ──────────────────────────────────────────────────────
function SubjectTeacherCard({ item, index }: { item: SubjectTeacherAssignment; index: number }) {
    const grad = getGradient(item.standardName);
    const router = useRouter();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="rounded-2xl border border-border/50 overflow-hidden flex flex-col bg-card hover:shadow-md hover:shadow-black/10 hover:border-border transition-all duration-200 cursor-pointer"
        >
            <div className="px-4 pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 border-white/20"
                            style={{ background: grad }}>
                            <span className="text-sm font-black text-white">
                                {getDivisionInitial(item.divisionName)}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-bold">{item.divisionName}</p>
                            <p className="text-[11px] text-muted-foreground">{item.standardName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Users size={11} />
                            <span>{item.studentCount}</span>
                        </div>
                        <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            onClick={() => router.push(`/teacher/classes/${item.divisionId}?role=subject-teacher&subjectId=${item.subjectId}`)}>
                            <ArrowUpRight size={19} className="text-white" />
                        </div>
                    </div>
                </div>

                {/* Subject badge */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                    style={{
                        background: (item.subjectColor ?? assignSubjectColor(index)) + '15',
                        borderColor: (item.subjectColor ?? assignSubjectColor(index)) + '40',
                    }}>
                    <BookOpen size={12} style={{ color: item.subjectColor ?? assignSubjectColor(index) }} />
                    <span className="text-xs font-semibold" style={{ color: item.subjectColor ?? assignSubjectColor(index) }}>
                        {item.subjectName}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherClassesPage() {
    const [classTeacher, setClassTeacher] = useState<ClassTeacherAssignment[]>([]);
    const [subjectTeacher, setSubjectTeacher] = useState<SubjectTeacherAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        api.get('/teacher/classes')
            .then(res => {
                setClassTeacher(res.data.data.classTeacher);
                setSubjectTeacher(res.data.data.subjectTeacher);
            })
            .catch(() => {
                toast.error('Failed to load classes');
                setError(true);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Loading...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Failed to load classes. Please refresh.
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden pb-3">

            {/* Header */}
            <div className="shrink-0 pt-0 pb-0 px-1 sticky top-0 z-20 bg-background">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <LayoutGrid size={21} /> My Classes
                        </h1>
                        <p className="text-[13px] text-muted-foreground">
                            {classTeacher.length} class · {subjectTeacher.length} subject assignment{subjectTeacher.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Body */}
            <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pt-3 px-1">

                {/* LEFT — Class Teacher */}
                <div className="w-full lg:w-[300px] h-[45vh] lg:h-auto shrink-0 flex flex-col min-h-0">
                    {/* Section label */}
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <p className="text-xs font-semibold text-muted-foreground">Class Teacher</p>
                        <span className="ml-auto text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {classTeacher.length}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {classTeacher.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/50 rounded-2xl">
                                <GraduationCap size={28} className="text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">No class assigned</p>
                                <p className="text-xs text-muted-foreground/50 mt-0.5">Admin will assign you a class</p>
                            </div>
                        ) : (
                            classTeacher.map((item, i) => (
                                <ClassTeacherCard key={item.id} item={item} index={i} />
                            ))
                        )}
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px w-full lg:h-auto lg:w-px bg-border/50 shrink-0" />

                {/* RIGHT — Subject Teacher */}
                <div className="w-full lg:flex-1 h-[65vh] lg:h-auto flex flex-col min-h-0">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                        <p className="text-xs font-semibold text-muted-foreground">Subject Teacher</p>
                        <span className="ml-auto text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {subjectTeacher.length}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 pb-4">
                        {subjectTeacher.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/50 rounded-2xl">
                                <BookOpen size={28} className="text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">No subjects assigned</p>
                                <p className="text-xs text-muted-foreground/50 mt-0.5">Admin will assign you subjects</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pr-1">
                                {subjectTeacher.map((item, i) => (
                                    <SubjectTeacherCard key={item.id} item={item} index={i} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}