'use client';

import { useState, useEffect } from 'react';
import PencilLoader from '@/components/student/PencilLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Users, Trophy, Calendar, Loader2, X, FileText, ChevronRight, GraduationCap } from 'lucide-react';
import { SUBJECT_PALETTE } from '@/lib/subjectColors';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Subject { id: string; name: string; code: string; color: string; teacherName: string }
interface Classmate {
    id: string; name: string; rollNo: string;
    rank: number | null; attendancePct: number | null;
    marksPct: number | null; offlinePct: number | null; onlinePct: number | null; isMe: boolean;
}
interface SubjectScore {
    subjectId: string; subjectName: string; subjectCode: string; subjectColor: string;
    columns: { name: string; scored: number | null; max: number; isAbsent: boolean }[];
    totalScored: number; totalMax: number; pct: number | null;
}
interface LbEntry { name: string; combinedPct: number; offlinePct: number | null; onlinePct: number | null; isMe: boolean }
interface FeedFile {
    id: string; title: string;
    attachmentUrl: string | null; attachmentType: string | null; attachmentName: string | null;
    postedBy: string; createdAt: string;
}
interface ClassData {
    division: { id: string; name: string; standardName: string; classTeacherName: string | null; classTeacherAvatarUrl: string | null; totalStudents: number; subjects: Subject[] } | null;
    resultFiles: FeedFile[];
    subjectMaterials: Record<string, FeedFile[]>;
    classmates: Classmate[];
    myScores: SubjectScore[];
    subjectLeaderboards: Record<string, LbEntry[]>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
type LbMode = 'offline' | 'online' | 'combined';
const AVATAR_COLORS = ['#7C3AED','#2563EB','#10B981','#F59E0B','#EF4444','#EC4899','#0891B2','#059669'];
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase(); }
function formatDivision(n: string) { const p = n.split('-'); return p.length > 1 ? `Division ${p.slice(1).join('-')}` : n; }
function getClassmatePct(c: Classmate, mode: LbMode) { return mode === 'offline' ? c.offlinePct : mode === 'online' ? c.onlinePct : c.marksPct; }
function getLbPct(e: LbEntry, mode: LbMode) { return mode === 'offline' ? e.offlinePct : mode === 'online' ? e.onlinePct : e.combinedPct; }

function getBadge(type: string | null) {
    if (!type) return { label: 'FILE', bg: '#64748B' };
    if (type.includes('pdf')) return { label: 'PDF', bg: '#EF4444' };
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return { label: 'XLS', bg: '#10B981' };
    if (type.includes('image')) return { label: 'IMG', bg: '#3B82F6' };
    if (type.includes('word') || type.includes('document')) return { label: 'DOC', bg: '#8B5CF6' };
    return { label: 'FILE', bg: '#64748B' };
}

// ── In-App File Viewer ────────────────────────────────────────────────────────
function FileViewer({ file, onClose }: { file: FeedFile; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
            <div className="flex items-center justify-between px-4 py-3 bg-[#1A1030] border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="text-[11px] font-bold px-2 py-0.5 rounded-md text-white shrink-0"
                        style={{ background: getBadge(file.attachmentType).bg }}>
                        {getBadge(file.attachmentType).label}
                    </div>
                    <p className="text-sm font-semibold text-white truncate max-w-md">{file.title}</p>
                </div>
                <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1">
                    <X size={20} />
                </button>
            </div>
            <div className="flex-1 min-h-0">
                {file.attachmentUrl ? (
                    <iframe
                        src={file.attachmentUrl}
                        className="w-full h-full border-0"
                        title={file.title}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-white/50">No file attached</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 28 }: { name: string; size?: number }) {
    return (
        <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
            style={{ width: size, height: size, fontSize: size * 0.36, background: getAvatarColor(name) }}>
            {getInitials(name)}
        </div>
    );
}

// ── LB Mode Pills ─────────────────────────────────────────────────────────────
function LbFilter({ mode, onChange }: { mode: LbMode; onChange: (m: LbMode) => void }) {
    return (
        <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40 shrink-0">
            {(['offline', 'online', 'combined'] as LbMode[]).map(m => (
                <button key={m} onClick={() => onChange(m)}
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold capitalize transition-all ${mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
            ))}
        </div>
    );
}

// ── FILE ROW ──────────────────────────────────────────────────────────────────
function FileRow({ file, onView }: { file: FeedFile; onView: (f: FeedFile) => void }) {
    const badge = getBadge(file.attachmentType);
    const date = new Date(file.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
            <div className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white shrink-0 w-9 text-center"
                style={{ background: badge.bg }}>{badge.label}</div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate">{file.title}</p>
                <p className="text-[9px] text-muted-foreground">{date}</p>
            </div>
            {file.attachmentUrl && (
                <button onClick={() => onView(file)}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0 px-2 py-0.5 rounded border border-border/50 hover:border-border">
                    View
                </button>
            )}
        </div>
    );
}

// ── VIEW TAB ──────────────────────────────────────────────────────────────────
function ViewTab({ data }: { data: ClassData }) {
    const { classmates, division, resultFiles } = data;
    const [showTimetable, setShowTimetable] = useState(false);
    const [lbMode, setLbMode] = useState<LbMode>('combined');
    const [viewFile, setViewFile] = useState<FeedFile | null>(null);

    const subjects = division?.subjects ?? [];
    const top5 = [...classmates]
        .sort((a, b) => (getClassmatePct(b, lbMode) ?? -1) - (getClassmatePct(a, lbMode) ?? -1))
        .slice(0, 5);
    const top3 = top5.slice(0, 3);
    const rest = top5.slice(3);

    // Podium order: 2nd | 1st | 3rd
    const podiumOrder = [top3[1], top3[0], top3[2]];
    const podiumCfg = [
        { height: 'h-16', color: '#C0C0C0', label: '2nd' },
        { height: 'h-24', color: '#F59E0B', label: '1st' },
        { height: 'h-12', color: '#CD7F32', label: '3rd' },
    ];

    return (
        <>
            {viewFile && <FileViewer file={viewFile} onClose={() => setViewFile(null)} />}
            <AnimatePresence>
                {showTimetable && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowTimetable(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="relative max-w-4xl w-full mx-4 flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-2 shrink-0">
                                <p className="text-white text-sm font-semibold">Timetable — {division?.name}</p>
                                <div className="flex items-center gap-2">
                                    <a href="/timetable.jpeg" download
                                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                        ⬇ Download
                                    </a>
                                    <button onClick={() => setShowTimetable(false)}
                                        className="flex items-center justify-center w-8 h-8 rounded-xl border border-white/20 text-white text-xs font-semibold hover:bg-white/10 transition-all">
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <img src="/timetable.jpeg" alt="Timetable" className="rounded-2xl w-full object-contain" style={{ maxHeight: 'calc(90vh - 48px)' }} />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="h-full overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-3 pt-3 pb-3 px-1">

                {/* LEFT — Classmates */}
                <div className="w-full lg:w-[25%] shrink-0 flex flex-col rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm shadow-black/5 max-h-72 lg:max-h-none">
                    <div className="px-4 border-b border-border/40 bg-muted/20 shrink-0 flex items-center" style={{ height: '46px' }}>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Users size={13} /> Classmates ({classmates.length})
                        </p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {classmates.map(s => (
                            <div key={s.id} className={`flex items-center gap-2.5 px-3 py-2.5 border-b border-border/40 transition-colors ${s.isMe ? 'bg-violet-500/10' : ''}`}>
                                <Avatar name={s.name} size={30} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[12px] font-semibold text-foreground truncate">{s.name}</p>
                                        {s.isMe && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-violet-500/20 text-violet-700 dark:text-violet-300">You</span>}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Roll No. {s.rollNo}</p>
                                </div>
                                {s.rank != null && (
                                    <div className="flex flex-col items-center shrink-0">
                                        <span className="text-[11px] font-bold"
                                            style={{ color: s.rank === 1 ? '#F59E0B' : s.rank === 2 ? '#94A3B8' : s.rank === 3 ? '#CD7C2F' : '#7C3AED' }}>
                                            #{s.rank}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">rank</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* CENTER + RIGHT — single scroll wrapper, grid layout */}
                <div className="flex-1 min-w-0 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-3 lg:[grid-template-rows:repeat(2,380px)]">

                        {/* Timetable (col 1, row 1) */}
                        <div className="min-h-[380px] lg:min-h-0 rounded-2xl overflow-hidden flex flex-col bg-card border border-border/50 shadow-sm shadow-black/5">
                            <div className="px-4 border-b border-border/40 bg-muted/20 shrink-0 flex items-center gap-2" style={{ height: '46px' }}>
                                <Calendar size={13} className="text-muted-foreground" />
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Timetable</p>
                            </div>
                            <div className="flex-1 flex items-center justify-center p-3 cursor-pointer overflow-hidden" onClick={() => setShowTimetable(true)}>
                                <img src="/timetable.jpeg" alt="Timetable"
                                    className="w-full h-full rounded-xl object-contain scale-[1.15] hover:opacity-90 transition-opacity" />
                            </div>
                        </div>

                        {/* Leaderboard (col 2, row 1) */}
                        <div className="min-h-[380px] lg:min-h-0 rounded-2xl overflow-hidden flex flex-col bg-card border border-border/50 shadow-sm shadow-black/5">
                            <div className="px-4 border-b border-border/40 bg-muted/20 shrink-0 flex items-center gap-2" style={{ height: '46px' }}>
                                <Trophy size={13} className="text-muted-foreground" />
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">Leaderboard — Top 5</p>
                                <LbFilter mode={lbMode} onChange={setLbMode} />
                            </div>
                            {top5.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center px-4">
                                    <p className="text-[11px] text-muted-foreground text-center">Leaderboard available once marks are published</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto flex flex-col">
                                    {top3.length >= 3 && (
                                        <div className="flex items-end justify-center gap-4 px-4 pt-4 pb-2">
                                            {podiumOrder.map((s, i) => {
                                                if (!s) return <div key={i} className="w-14" />;
                                                const cfg = podiumCfg[i];
                                                const pct = getClassmatePct(s, lbMode);
                                                return (
                                                    <div key={s.id} className="flex flex-col items-center gap-1.5">
                                                        <Avatar name={s.name} size={40} />
                                                        <p className="text-[10px] font-bold text-center w-16 truncate">{s.name.split(' ')[0]}</p>
                                                        <p className="text-[9px] font-bold text-center w-16 truncate -mt-2">{s.name.split(' ').slice(1).join(' ')}</p>
                                                        {s.isMe && <span className="text-[7px] font-bold px-1 py-0.5 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300">You</span>}
                                                        <p className="text-[10px] text-muted-foreground">{pct != null ? `${pct}%` : '—'}</p>
                                                        <div className={`${cfg.height} w-14 rounded-t-xl flex items-center justify-center text-white text-xs font-black`}
                                                            style={{ background: cfg.color }}>
                                                            {cfg.label}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {rest.length > 0 && (
                                        <div className="px-4 pb-3 space-y-1.5">
                                            {rest.map((s, i) => {
                                                const pct = getClassmatePct(s, lbMode);
                                                return (
                                                    <div key={s.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${s.isMe ? 'bg-violet-500/10 border-violet-500/30' : 'bg-muted/30 border-border/40'}`}>
                                                        <span className="text-xs font-black text-muted-foreground w-4 text-center">{i + 4}</span>
                                                        <Avatar name={s.name} size={24} />
                                                        <p className="text-xs font-semibold flex-1 truncate">
                                                            {s.name}
                                                            {s.isMe && <span className="ml-1 text-[8px] text-violet-700 dark:text-violet-400">(You)</span>}
                                                        </p>
                                                        <span className="text-[11px] font-bold text-muted-foreground">{pct != null ? `${pct}%` : '—'}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Subject Teachers (col 1, row 2) */}
                        <div className="min-h-[380px] lg:min-h-0 rounded-2xl overflow-hidden flex flex-col bg-card border border-border/50 shadow-sm shadow-black/5">
                            <div className="px-4 border-b border-border/40 bg-muted/20 shrink-0 flex items-center gap-2" style={{ height: '46px' }}>
                                <GraduationCap size={16} className="text-muted-foreground" />
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Teachers</p>
                            </div>
                            <div className="overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                                {division?.classTeacherName && (
                                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 transition-colors hover:bg-muted/40">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
                                        <p className="text-[11px] font-semibold text-foreground flex-1 truncate">Class Teacher</p>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Avatar name={division.classTeacherName} size={22} />
                                            <p className="text-[10px] text-muted-foreground truncate max-w-[110px]">{division.classTeacherName}</p>
                                        </div>
                                    </div>
                                )}
                                {subjects.map(sub => (
                                    <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 transition-colors hover:bg-muted/40">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color }} />
                                        <p className="text-[11px] font-semibold text-foreground flex-1 truncate">{sub.name}</p>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Avatar name={sub.teacherName} size={22} />
                                            <p className="text-[10px] text-muted-foreground truncate max-w-[110px]">{sub.teacherName}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Results (col 2, row 2) */}
                        <div className="min-h-[380px] lg:min-h-0 rounded-2xl overflow-hidden flex flex-col bg-card border border-border/50 shadow-sm shadow-black/5">
                            <div className="px-4 border-b border-border/40 bg-muted/20 shrink-0 flex items-center gap-2" style={{ height: '46px' }}>
                                <FileText size={13} className="text-muted-foreground" />
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Results</p>
                            </div>
                            <div className="overflow-y-auto flex-1 min-h-0 px-3 py-2 space-y-1.5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                                {resultFiles.length === 0
                                    ? <p className="text-[10px] text-muted-foreground py-4 text-center">No results uploaded yet</p>
                                    : resultFiles.map(f => <FileRow key={f.id} file={f} onView={setViewFile} />)
                                }
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
}

// ── SUBJECTS TAB ──────────────────────────────────────────────────────────────
function SubjectsTab({ subjects, myScores, subjectLeaderboards, subjectMaterials }: {
    subjects: Subject[];
    myScores: SubjectScore[];
    subjectLeaderboards: Record<string, LbEntry[]>;
    subjectMaterials: Record<string, FeedFile[]>;
}) {
    const [selectedId, setSelectedId] = useState(subjects[0]?.id ?? '');
    const [lbMode, setLbMode] = useState<LbMode>('combined');
    const [centerTab, setCenterTab] = useState<'results' | 'materials'>('results');
    const [viewFile, setViewFile] = useState<FeedFile | null>(null);

    const subject = subjects.find(s => s.id === selectedId);
    const subjectColor = (s: Subject) => s.color || SUBJECT_PALETTE[subjects.indexOf(s) % SUBJECT_PALETTE.length];
    const activeColor = subject ? subjectColor(subject) : SUBJECT_PALETTE[0];
    const score = myScores.find(s => s.subjectId === selectedId);
    const leaderboard = subjectLeaderboards[selectedId] ?? [];
    const materials = subjectMaterials[selectedId] ?? [];
    const chartData = (score?.columns ?? [])
        .filter(c => !c.isAbsent && c.scored != null)
        .map(c => ({ name: c.name, score: Math.round(((c.scored ?? 0) / c.max) * 100) }));

    if (subjects.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No subjects assigned to your division yet.</p>
            </div>
        );
    }

    return (
        <>
            {viewFile && <FileViewer file={viewFile} onClose={() => setViewFile(null)} />}
            <div className="h-full flex flex-col overflow-y-auto lg:overflow-hidden pt-3 pb-3 px-1">

                {/* Subject chips */}
                <div className="shrink-0 flex flex-wrap gap-1.5 mb-3">
                    {subjects.map(sub => {
                        const active = sub.id === selectedId;
                        return (
                            <button key={sub.id} onClick={() => setSelectedId(sub.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                                style={active ? {
                                    background: subjectColor(sub) + '20',
                                    color: subjectColor(sub),
                                    border: `1px solid ${subjectColor(sub)}40`,
                                } : {
                                    background: 'hsl(var(--muted))',
                                    color: 'hsl(var(--muted-foreground))',
                                    border: '1px dashed hsl(var(--border))',
                                }}>
                                <BookOpen size={10} />
                                {sub.name}
                            </button>
                        );
                    })}
                </div>

                {subject && (
                    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">

                        {/* LEFT 35% — subject info card + leaderboard (separate cards) */}
                        <div className="w-full lg:w-[35%] shrink-0 flex flex-col gap-3 min-h-0">

                            {/* Subject info card */}
                            <div className="shrink-0 rounded-2xl bg-card border border-border/50 shadow-sm shadow-black/5 px-4 py-3 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                                    style={{ background: activeColor }}>
                                    {subject.code || subject.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold text-foreground truncate">{subject.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Avatar name={subject.teacherName} size={17} />
                                        <p className="text-[11px] text-muted-foreground truncate">{subject.teacherName}</p>
                                    </div>
                                </div>
                                <LbFilter mode={lbMode} onChange={setLbMode} />
                            </div>

                            {/* Leaderboard card */}
                            <div className="max-h-80 lg:max-h-none lg:flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm shadow-black/5">
                                <div className="px-4 border-b border-border/40 bg-muted/20 shrink-0 flex items-center gap-2" style={{ height: '46px' }}>
                                    <span className="text-sm">🏆</span>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{subject.name} — Top 5</p>
                                </div>
                                <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-1.5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                                    {leaderboard.length === 0
                                        ? <p className="text-[10px] text-muted-foreground py-8 text-center">No results yet</p>
                                        : leaderboard.map((e, i) => {
                                            const pct = getLbPct(e, lbMode);
                                            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                                            return (
                                                <div key={i} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${e.isMe ? 'bg-violet-500/10 border-violet-500/30' : 'bg-background border-border/40'}`}>
                                                    {medal
                                                        ? <span className="text-sm shrink-0">{medal}</span>
                                                        : <span className="text-[10px] font-bold text-muted-foreground w-5 text-center shrink-0">#{i + 1}</span>
                                                    }
                                                    <Avatar name={e.name} size={28} />
                                                    <p className="text-[11px] font-semibold text-foreground flex-1 truncate">
                                                        {e.name}
                                                        {e.isMe && <span className="ml-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300">You</span>}
                                                    </p>
                                                    <span className="text-[11px] font-bold shrink-0" style={{ color: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : activeColor }}>
                                                        {pct != null ? `${pct}%` : '—'}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </div>
                        </div>

                        {/* RIGHT 65% — single panel with 3 tabs */}
                        <div className="w-full min-h-[420px] lg:min-h-0 lg:flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm shadow-black/5">

                            {/* Tab toggle */}
                            <div className="flex-1 min-h-0 flex flex-col">
                                <div className="shrink-0 flex px-4 pt-3 pb-2">
                                    <div className="flex gap-0.5 bg-muted/60 rounded-2xl p-0.5 border border-border/40">
                                        {([
                                            { key: 'results', label: 'Results', emoji: '📊' },
                                            { key: 'materials', label: 'Materials', emoji: '📄' },
                                        ] as const).map(t => (
                                            <button key={t.key} onClick={() => setCenterTab(t.key)}
                                                className={`flex items-center gap-1.5 px-5 py-2 rounded-2xl text-xs font-semibold transition-all ${centerTab === t.key ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                style={centerTab === t.key ? { background: activeColor, color: '#fff' } : undefined}>
                                                {t.emoji} {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0">
                                {centerTab === 'materials' ? (
                                    <div className="h-full p-4 overflow-y-auto space-y-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                                        {materials.length === 0
                                            ? <div className="flex items-center justify-center h-full"><p className="text-[11px] text-muted-foreground">No materials uploaded yet</p></div>
                                            : materials.map(m => <FileRow key={m.id} file={m} onView={setViewFile} />)
                                        }
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col lg:flex-row gap-0 min-h-0">
                                        {/* Left — Performance Trend */}
                                        <div className="min-h-[260px] lg:min-h-0 flex-1 p-4 border-b lg:border-b-0 lg:border-r border-border/40 relative">
                                            <p className="text-[12px] font-bold text-foreground absolute" style={{ top: 36, left: 16 }}>Performance Trend</p>
                                            {chartData.length < 2
                                                ? <div className="h-full flex items-center justify-center"><p className="text-[11px] text-muted-foreground">Need at least 2 exams for trend chart</p></div>
                                                : <div className="h-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={chartData} margin={{ top: 55, right: 12, left: -20, bottom: 0 }}>
                                                            <defs>
                                                                <linearGradient id={`grad-${subject.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor={activeColor} stopOpacity={0.4} />
                                                                    <stop offset="95%" stopColor={activeColor} stopOpacity={0.02} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                                                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.5 }} />
                                                            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.5 }} unit="%" />
                                                            <Tooltip
                                                                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                                                                labelStyle={{ color: 'var(--foreground)' }}
                                                                formatter={(val: unknown) => [`${val}%`, 'Score']}
                                                                itemStyle={{ color: activeColor }}
                                                            />
                                                            <Area type="monotone" dataKey="score" stroke={activeColor} strokeWidth={2}
                                                                fill={`url(#grad-${subject.id})`}
                                                                dot={(dotProps: unknown) => {
                                                                    const { cx, cy, payload } = dotProps as { cx: number; cy: number; payload: { score: number } };
                                                                    const vals = chartData.map(d => d.score);
                                                                    const isMax = payload.score === Math.max(...vals);
                                                                    const isMin = payload.score === Math.min(...vals);
                                                                    const labelColor = isMin ? '#EF4444' : '#10B981';
                                                                    return (
                                                                        <g key={`dot-${cx}-${cy}`} style={{ overflow: 'visible' }}>
                                                                            <circle cx={cx} cy={cy} r={4} fill={activeColor} />
                                                                            {(isMax || isMin) && (
                                                                                <>
                                                                                    <rect x={cx - 14} y={isMin ? cy + 7 : cy - 21} width={28} height={14} rx={3} fill={labelColor} />
                                                                                    <text x={cx} y={isMin ? cy + 17 : cy - 10} textAnchor="middle" fill="white" fontSize={9} fontWeight="600">{payload.score}%</text>
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

                                        {/* Right — My Results */}
                                        <div className="w-full lg:w-[220px] shrink-0 flex flex-col px-3" style={{ paddingTop: 36, paddingBottom: 16 }}>
                                            <p className="text-[12px] font-bold text-foreground mb-3 shrink-0">My Results</p>
                                            <div className="overflow-y-auto space-y-2.5 border-b border-border/30" style={{ height: 308, scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                                            {!score || score.columns.length === 0
                                                ? <p className="text-[10px] text-muted-foreground text-center pt-8">No marks published yet</p>
                                                : score.columns.map((c, i) => {
                                                    const pct = !c.isAbsent && c.scored != null ? Math.round((c.scored / c.max) * 100) : null;
                                                    const barColor = pct == null ? '#64748B' : pct >= 75 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';
                                                    return (
                                                        <div key={i} className="px-3 py-2.5 rounded-xl border bg-background border-border/40 space-y-1.5">
                                                            <div className="flex items-center gap-2.5">
                                                                <p className="text-[11px] font-semibold text-foreground truncate flex-1">{c.name}</p>
                                                                {c.isAbsent
                                                                    ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 shrink-0">Absent</span>
                                                                    : <div className="flex items-center gap-1.5 shrink-0">
                                                                        <span className="text-[10px] font-bold text-muted-foreground">{c.scored}/{c.max}</span>
                                                                        {pct != null && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: barColor + '25', color: barColor }}>{pct}%</span>}
                                                                    </div>
                                                                }
                                                            </div>
                                                            {!c.isAbsent && pct != null && (
                                                                <div className="h-1 rounded-full overflow-hidden bg-muted/60">
                                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            }
                                            </div>
                                        </div>
                                    </div>
                                )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const TABS = [
    { key: 'view' as const, label: 'View' },
    { key: 'subjects' as const, label: 'Subjects' },
];

export default function StudentClassPageClient() {
    const [activeTab, setActiveTab] = useState<'view' | 'subjects'>('view');
    const [pendingTab, setPendingTab] = useState<'view' | 'subjects'>('view');
    const [tabLoading, setTabLoading] = useState(false);
    const [data, setData] = useState<ClassData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/student/class')
            .then(r => setData(r.data.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    function switchTab(tab: 'view' | 'subjects') {
        if (tab === pendingTab) return;
        setPendingTab(tab);
        setTabLoading(true);
        setTimeout(() => { setActiveTab(tab); setTabLoading(false); }, 1300);
    }

    const division = data?.division;
    const subjects = division?.subjects ?? [];
    const divLabel = division ? formatDivision(division.name) : '—';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-white/30" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-1 pt-1 pb-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 lg:gap-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Title */}
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Users size={24} /> {division?.name ?? '—'}
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                {division?.classTeacherName ? `Class Teacher - ${division.classTeacherName}` : division?.standardName}
                            </p>
                        </div>

                        {/* Tab bar */}
                        <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 ml-0 sm:ml-4">
                            {TABS.map(tab => {
                                const isActive = pendingTab === tab.key;
                                return (
                                    <button key={tab.key} onClick={() => switchTab(tab.key)} className="relative">
                                        {isActive && (
                                            <motion.div layoutId="studentClassTab"
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

                    {/* Stats */}
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-lg font-bold leading-tight">{subjects.length}</p>
                            <p className="text-[11px] text-muted-foreground">Subjects</p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold leading-tight">{division?.totalStudents ?? data?.classmates.length ?? 0}</p>
                            <p className="text-[11px] text-muted-foreground">Students</p>
                        </div>
                    </div>
                </div>
                <div className="h-px bg-border/40 mt-2" />
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {tabLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <PencilLoader size={72} />
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {activeTab === 'view' && data && (
                            <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                <ViewTab data={data} />
                            </motion.div>
                        )}
                        {activeTab === 'subjects' && (
                            <motion.div key="subjects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                <SubjectsTab
                                    subjects={subjects}
                                    myScores={data?.myScores ?? []}
                                    subjectLeaderboards={data?.subjectLeaderboards ?? {}}
                                    subjectMaterials={data?.subjectMaterials ?? {}}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
