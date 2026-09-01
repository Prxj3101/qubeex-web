'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Flag, User } from 'lucide-react';
import { Division, getInitials, getAvatarColor } from './DivisionClassPageClient';
import { useStudentPhotosStore } from '@/store/studentPhotosStore';
import api from '@/lib/api';

interface Student {
    id: string;
    studentId: string;
    avatarUrl: string | null;
    user: { id: string; name: string | null };
    rollNo: string | null;
    status: 'ACTIVE' | 'INACTIVE';
}

interface LeaderboardEntry { id: string; rank: number; attendancePct: number | null }

interface StudentStats {
    attendance: { present: number; total: number; pct: number | null };
    score: { pct: number | null };
    classRank: number | null;
}

// Read-only student roster for subject teachers — same Report / View Profile
// entry point the class teacher has in ManageTab, without any of the
// admin-ish edit/deactivate/export/reset-password capabilities that tab also
// exposes (those stay class-teacher-only, matching the backend's own gating).
export default function StudentsTab({ division }: { division: Division }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(true);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    const { photos, setPhoto } = useStudentPhotosStore();
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        setLoadingStudents(true);
        api.get(`/teacher/classes/${division.id}/students`)
            .then(res => {
                const list: Student[] = res.data.data;
                list.forEach(s => { if (s.avatarUrl) setPhoto(s.id, s.avatarUrl); });
                setStudents(list);
                const wantedId = searchParams.get('student');
                const wanted = wantedId ? list.find(s => s.id === wantedId) : undefined;
                setSelectedStudent(wanted ?? list[0] ?? null);
            })
            .catch(() => toast.error('Failed to load students'))
            .finally(() => setLoadingStudents(false));
        api.get(`/teacher/classes/${division.id}/leaderboard`)
            .then(res => setLeaderboard(res.data.data))
            .catch(() => setLeaderboard([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [division.id]);

    useEffect(() => {
        if (!selectedStudent) return;
        setLoadingStats(true);
        api.get(`/teacher/classes/${division.id}/students/${selectedStudent.id}/stats`)
            .then(r => setStudentStats(r.data.data))
            .catch(() => setStudentStats(null))
            .finally(() => setLoadingStats(false));
    }, [selectedStudent?.id, division.id]);

    const sortedStudents = [...students].sort((a, b) => {
        const ra = parseInt(a.rollNo ?? '9999');
        const rb = parseInt(b.rollNo ?? '9999');
        return ra - rb;
    });

    const navigateWithSelection = (path: string) => {
        if (!selectedStudent) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', 'students');
        params.set('student', selectedStudent.id);
        window.history.replaceState(null, '', `/teacher/classes/${division.id}?${params.toString()}`);
        router.push(path);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-3 h-full pt-3 pb-3 px-1 overflow-y-auto lg:overflow-hidden">

            {/* LEFT — Students List */}
            <div className="w-full lg:w-[40%] h-[420px] lg:h-auto shrink-0 lg:shrink flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <div className="px-4 py-3 border-b border-border/40 shrink-0">
                    <p className="text-sm font-bold flex items-center gap-2">
                        <Users size={15} /> Students ({students.length})
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto bg-background">
                    {loadingStudents ? (
                        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">Loading…</div>
                    ) : students.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                            <Users size={24} className="text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No students yet</p>
                        </div>
                    ) : (
                        sortedStudents.map(student => {
                            const isSelected = selectedStudent?.id === student.id;
                            const lb = leaderboard.find(e => e.id === student.id);
                            return (
                                <button key={student.id}
                                    onClick={() => setSelectedStudent(student)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/20 text-left transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden"
                                        style={{ background: getAvatarColor(student.user.name ?? student.studentId) }}>
                                        {photos[student.id]
                                            ? <img src={photos[student.id]} alt="profile" className="w-full h-full object-cover" />
                                            : getInitials(student.user.name ?? student.studentId)
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">{student.user.name ?? '—'}</p>
                                        <p className="text-[10px] text-muted-foreground">{student.studentId}{student.rollNo ? ` · Roll ${student.rollNo}` : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {student.status === 'INACTIVE' && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">
                                                Inactive
                                            </span>
                                        )}
                                        <div className="text-right">
                                            <p className="text-[11px] font-bold" style={{ color: 'var(--primary)' }}>{lb ? `#${lb.rank}` : '—'}</p>
                                            <p className="text-[9px] text-muted-foreground/60">rank</p>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-[11px] font-bold ${lb?.attendancePct == null ? 'text-muted-foreground/60'
                                                : lb.attendancePct >= 75 ? 'text-emerald-600 dark:text-emerald-400'
                                                    : lb.attendancePct >= 65 ? 'text-amber-600'
                                                        : 'text-red-500'
                                                }`}>
                                                {lb?.attendancePct != null ? `${lb.attendancePct}%` : '—'}
                                            </div>
                                            <p className="text-[9px] text-muted-foreground/60">attend.</p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* RIGHT — Selected student summary + Report / View Profile */}
            <div className="w-full lg:w-[60%] h-[70vh] lg:h-auto flex flex-col min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                {!selectedStudent ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4 h-full">
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                            <Users size={20} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Select a student</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Click any student from the list</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div key={selectedStudent.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="px-4 py-3 space-y-3 overflow-y-auto">

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white overflow-hidden shrink-0"
                                        style={{ background: getAvatarColor(selectedStudent.user.name ?? selectedStudent.studentId) }}>
                                        {photos[selectedStudent.id]
                                            ? <img src={photos[selectedStudent.id]} alt="profile" className="w-full h-full object-cover" />
                                            : getInitials(selectedStudent.user.name ?? selectedStudent.studentId)
                                        }
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">{selectedStudent.user.name ?? '—'}</p>
                                        <p className="text-xs text-muted-foreground">{selectedStudent.studentId}{selectedStudent.rollNo ? ` · Roll ${selectedStudent.rollNo}` : ''}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => navigateWithSelection(
                                        `/teacher/classes/${division.id}/students/${selectedStudent.id}/reports?name=${encodeURIComponent(selectedStudent.user.name ?? 'Student')}&class=${encodeURIComponent(division.name)}`
                                    )}
                                        className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-red-500 hover:border-red-400/50 transition-all">
                                        <Flag size={11} /> Report
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {[
                                    {
                                        label: 'Class Rank',
                                        value: loadingStats ? '…' : (studentStats?.classRank != null ? `#${studentStats.classRank}` : '—'),
                                        sub: 'by score',
                                    },
                                    {
                                        label: 'Score %',
                                        value: loadingStats ? '…' : (studentStats?.score.pct != null ? `${studentStats.score.pct}%` : '—'),
                                        sub: 'overall',
                                    },
                                    {
                                        label: 'Attendance',
                                        value: loadingStats ? '…' : (studentStats?.attendance.pct != null ? `${studentStats.attendance.pct}%` : '—'),
                                        sub: 'overall',
                                    },
                                ].map(stat => (
                                    <div key={stat.label} className="flex flex-col items-center justify-center py-2.5 rounded-xl border border-border/50 bg-muted/30">
                                        <p className="text-lg font-black" style={{ color: '#DA7756' }}>{stat.value}</p>
                                        <p className="text-[11px] font-semibold text-foreground/70 mt-0.5">{stat.label}</p>
                                        <p className="text-[10px] text-muted-foreground/60">{stat.sub}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/50 bg-muted/20">
                                <User size={13} className="text-muted-foreground shrink-0" />
                                <p className="text-[11px] text-muted-foreground">
                                    Full student details, guardians, and account management are handled by {division.name}&apos;s class teacher.
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
