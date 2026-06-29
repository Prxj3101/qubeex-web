'use client';

import { useState, useEffect } from 'react';
import PencilLoader from '@/components/student/PencilLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Users, Trophy, Calendar, Loader2, X, FileText } from 'lucide-react';
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
    division: { id: string; name: string; standardName: string; classTeacherName: string | null; totalStudents: number; subjects: Subject[] } | null;
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
        <div className="flex rounded-full border border-white/10 overflow-hidden shrink-0">
            {(['offline', 'online', 'combined'] as LbMode[]).map(m => (
                <button key={m} onClick={() => onChange(m)}
                    className={`text-[9px] font-semibold px-2.5 py-1 capitalize transition-all ${mode === m ? 'bg-white text-black' : 'text-white/50 hover:text-white/80'}`}>
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
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
            <div className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white shrink-0 w-9 text-center"
                style={{ background: badge.bg }}>{badge.label}</div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-white truncate">{file.title}</p>
                <p className="text-[9px] text-white/40">{date}</p>
            </div>
            {file.attachmentUrl && (
                <button onClick={() => onView(file)}
                    className="text-[10px] font-semibold text-white/60 hover:text-white transition-colors shrink-0 px-2 py-0.5 rounded border border-white/15 hover:border-white/30">
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
        { height: 68, color: '#94A3B8', label: '2nd', medal: '🥈' },
        { height: 96, color: '#F59E0B', label: '1st', medal: '🥇' },
        { height: 52, color: '#CD7C2F', label: '3rd', medal: '🥉' },
    ];

    return (
        <>
            {viewFile && <FileViewer file={viewFile} onClose={() => setViewFile(null)} />}
            {showTimetable && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setShowTimetable(false)}>
                    <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setShowTimetable(false)}>
                        <X size={24} />
                    </button>
                    <img src="/timetable.jpeg" alt="Timetable" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
                </div>
            )}

            <div className="h-full overflow-hidden flex gap-3 pt-3 pb-3 px-1">

                {/* LEFT — Classmates */}
                <div className="w-[22%] shrink-0 flex flex-col rounded-2xl overflow-hidden" style={{ background: '#1A1030', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="px-4 py-2.5 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                            <Users size={11} /> Classmates ({classmates.length})
                        </p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {classmates.map(s => (
                            <div key={s.id} className="flex items-center gap-2.5 px-3 py-2.5 border-b transition-colors"
                                style={{ borderColor: 'rgba(255,255,255,0.04)', background: s.isMe ? 'rgba(139,92,246,0.12)' : 'transparent' }}>
                                <Avatar name={s.name} size={30} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[11px] font-semibold text-white truncate">{s.name}</p>
                                        {s.isMe && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-violet-500/30 text-violet-300">You</span>}
                                    </div>
                                    <p className="text-[9px] text-white/35">Roll No. {s.rollNo}</p>
                                </div>
                                {s.rank != null && (
                                    <span className="text-[10px] font-bold text-violet-400 shrink-0">#{s.rank}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* CENTER — Timetable + Subject Teachers */}
                <div className="flex-1 min-w-0 flex flex-col gap-3">

                    {/* Timetable */}
                    <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col" style={{ background: '#1A1030', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="px-4 py-2.5 border-b shrink-0 flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <Calendar size={11} className="text-white/40" />
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Timetable</p>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-3 cursor-pointer overflow-hidden" onClick={() => setShowTimetable(true)}>
                            <img src="/timetable.jpeg" alt="Timetable"
                                className="w-full h-full rounded-xl object-contain hover:opacity-90 transition-opacity" />
                        </div>
                    </div>

                    {/* Subject Teachers */}
                    <div className="shrink-0 rounded-2xl overflow-hidden flex flex-col max-h-[42%]" style={{ background: '#1A1030', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="px-4 py-2.5 border-b shrink-0 flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <BookOpen size={11} className="text-white/40" />
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Subject Teachers</p>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {subjects.map(sub => (
                                <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 border-b transition-colors hover:bg-white/3"
                                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sub.color }} />
                                    <p className="text-[11px] font-semibold text-white flex-1 truncate">{sub.name}</p>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Avatar name={sub.teacherName} size={22} />
                                        <p className="text-[10px] text-white/50 truncate max-w-[110px]">{sub.teacherName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT — Leaderboard + Results */}
                <div className="w-[28%] shrink-0 flex flex-col gap-3">

                    {/* Leaderboard */}
                    <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col" style={{ background: '#1A1030', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="px-4 py-2.5 border-b shrink-0 flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <Trophy size={11} className="text-white/40" />
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex-1">Leaderboard — Top 5</p>
                            <LbFilter mode={lbMode} onChange={setLbMode} />
                        </div>

                        {top5.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center px-4">
                                <p className="text-[11px] text-white/30 text-center">Leaderboard available once marks are published</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto flex flex-col">
                                {/* Podium */}
                                {top3.length >= 3 && (
                                    <div className="flex items-end justify-center gap-4 px-3 pt-4 pb-2">
                                        {podiumOrder.map((s, i) => {
                                            if (!s) return <div key={i} className="w-16" />;
                                            const cfg = podiumCfg[i];
                                            const pct = getClassmatePct(s, lbMode);
                                            return (
                                                <div key={s.id} className="flex flex-col items-center gap-1">
                                                    <Avatar name={s.name} size={i === 1 ? 38 : 30} />
                                                    <p className="text-[9px] font-semibold text-white/80 text-center w-16 leading-tight truncate">{s.name.split(' ')[0]}</p>
                                                    {s.isMe && <span className="text-[7px] font-bold px-1 py-0.5 rounded-full bg-violet-500/30 text-violet-300">You</span>}
                                                    <p className="text-[9px] font-bold" style={{ color: cfg.color }}>{pct != null ? `${pct}%` : '—'}</p>
                                                    <div className="w-16 rounded-t-lg flex flex-col items-center justify-end pb-1" style={{ height: cfg.height, background: cfg.color }}>
                                                        <span className="text-[10px] font-bold text-white">{cfg.label}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {/* 4th & 5th */}
                                {rest.length > 0 && (
                                    <div className="px-3 pb-2 space-y-1.5">
                                        {rest.map((s, i) => {
                                            const pct = getClassmatePct(s, lbMode);
                                            return (
                                                <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                                    style={{ background: s.isMe ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)', border: s.isMe ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                                                    <span className="text-[10px] font-bold text-white/40 w-4 shrink-0">{i + 4}</span>
                                                    <Avatar name={s.name} size={24} />
                                                    <p className="text-[10px] font-semibold text-white flex-1 truncate">
                                                        {s.name.split(' ')[0]}
                                                        {s.isMe && <span className="ml-1 text-[8px] text-violet-400">(You)</span>}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-violet-400 shrink-0">{pct != null ? `${pct}%` : '—'}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Results */}
                    <div className="shrink-0 rounded-2xl overflow-hidden flex flex-col max-h-[35%]" style={{ background: '#1A1030', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="px-4 py-2.5 border-b shrink-0 flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <FileText size={11} className="text-white/40" />
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Results</p>
                        </div>
                        <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1.5">
                            {resultFiles.length === 0
                                ? <p className="text-[10px] text-white/25 py-4 text-center">No results uploaded yet</p>
                                : resultFiles.map(f => <FileRow key={f.id} file={f} onView={setViewFile} />)
                            }
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
    const score = myScores.find(s => s.subjectId === selectedId);
    const leaderboard = subjectLeaderboards[selectedId] ?? [];
    const materials = subjectMaterials[selectedId] ?? [];
    const chartData = (score?.columns ?? [])
        .filter(c => !c.isAbsent && c.scored != null)
        .map(c => ({ name: c.name, score: Math.round(((c.scored ?? 0) / c.max) * 100) }));

    if (subjects.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-sm text-white/40">No subjects assigned to your division yet.</p>
            </div>
        );
    }

    return (
        <>
            {viewFile && <FileViewer file={viewFile} onClose={() => setViewFile(null)} />}
            <div className="h-full flex flex-col overflow-hidden pt-3 pb-3 px-1">

                {/* Subject chips */}
                <div className="shrink-0 flex flex-wrap gap-1.5 mb-3">
                    {subjects.map(sub => {
                        const active = sub.id === selectedId;
                        return (
                            <button key={sub.id} onClick={() => setSelectedId(sub.id)}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all"
                                style={active
                                    ? { background: sub.color + '25', color: sub.color, border: `1px solid ${sub.color}60` }
                                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <span className="text-[9px] opacity-60">⊞</span>
                                {sub.name}
                            </button>
                        );
                    })}
                </div>

                {subject && (
                    <div className="flex-1 min-h-0 flex gap-3">

                        {/* LEFT — teacher card + filter + leaderboard (unified) */}
                        <div className="w-[27%] shrink-0 rounded-2xl overflow-hidden flex flex-col" style={{ background: '#1A1030', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {/* Teacher header */}
                            <div className="px-4 py-3 border-b shrink-0 flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                    style={{ background: subject.color }}>
                                    {subject.code}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{subject.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Avatar name={subject.teacherName} size={14} />
                                        <p className="text-[9px] text-white/40 truncate">{subject.teacherName}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Filter + Leaderboard title */}
                            <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                <Trophy size={11} className="text-white/40 shrink-0" />
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex-1">{subject.code} — Top 5</p>
                                <LbFilter mode={lbMode} onChange={setLbMode} />
                            </div>

                            {/* Leaderboard list */}
                            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                                {leaderboard.length === 0
                                    ? <p className="text-[10px] text-white/25 py-8 text-center">No results yet</p>
                                    : leaderboard.map((e, i) => {
                                        const pct = getLbPct(e, lbMode);
                                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                                        return (
                                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors"
                                                style={{ background: e.isMe ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)', border: e.isMe ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                                                {medal
                                                    ? <span className="text-sm shrink-0">{medal}</span>
                                                    : <span className="text-[10px] font-bold text-white/30 w-4 text-center shrink-0">#{i + 1}</span>
                                                }
                                                <Avatar name={e.name} size={24} />
                                                <p className="text-[10px] font-semibold text-white flex-1 truncate">
                                                    {e.name.split(' ')[0]}
                                                    {e.isMe && <span className="ml-1 text-[8px] text-violet-400">(You)</span>}
                                                </p>
                                                <span className="text-[10px] font-bold shrink-0" style={{ color: subject.color }}>
                                                    {pct != null ? `${pct}%` : '—'}
                                                </span>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>

                        {/* CENTER — Results/Materials toggle + chart */}
                        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col" style={{ background: '#1A1030', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {/* Tab toggle */}
                            <div className="px-4 py-2.5 border-b shrink-0 flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                {(['results', 'materials'] as const).map(t => (
                                    <button key={t} onClick={() => setCenterTab(t)}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all"
                                        style={centerTab === t
                                            ? { background: subject.color + '20', color: subject.color, border: `1px solid ${subject.color}40` }
                                            : { color: 'rgba(255,255,255,0.35)', border: '1px solid transparent' }}>
                                        {t === 'results' ? '📊' : '📄'} {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 min-h-0 p-4">
                                {centerTab === 'materials' ? (
                                    <div className="h-full overflow-y-auto space-y-2">
                                        {materials.length === 0
                                            ? <div className="flex items-center justify-center h-full"><p className="text-[11px] text-white/30">No materials uploaded yet</p></div>
                                            : materials.map(m => <FileRow key={m.id} file={m} onView={setViewFile} />)
                                        }
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-[11px] font-semibold text-white/60 mb-3">Performance Trend</p>
                                        {chartData.length < 2
                                            ? <div className="flex items-center justify-center h-[calc(100%-28px)]"><p className="text-[11px] text-white/30">Need at least 2 exams for trend chart</p></div>
                                            : <div className="h-[calc(100%-28px)]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={chartData} margin={{ top: 30, right: 12, left: -20, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id={`grad-${subject.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={subject.color} stopOpacity={0.4} />
                                                                <stop offset="95%" stopColor={subject.color} stopOpacity={0.02} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} />
                                                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} unit="%" />
                                                        <Tooltip
                                                            contentStyle={{ background: '#0F0A1E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                                                            labelStyle={{ color: '#F1F5F9' }}
                                                            formatter={(val: unknown) => [`${val}%`, 'Score']}
                                                            itemStyle={{ color: subject.color }}
                                                        />
                                                        <Area type="monotone" dataKey="score" stroke={subject.color} strokeWidth={2}
                                                            fill={`url(#grad-${subject.id})`}
                                                            dot={(dotProps: unknown) => {
                                                                const { cx, cy, payload } = dotProps as { cx: number; cy: number; payload: { score: number } };
                                                                const vals = chartData.map(d => d.score);
                                                                const isMax = payload.score === Math.max(...vals);
                                                                const isMin = payload.score === Math.min(...vals);
                                                                const labelColor = isMin ? '#EF4444' : '#10B981';
                                                                return (
                                                                    <g key={`dot-${cx}-${cy}`} style={{ overflow: 'visible' }}>
                                                                        <circle cx={cx} cy={cy} r={4} fill={subject.color} />
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
                                    </>
                                )}
                            </div>
                        </div>

                        {/* RIGHT — My Results */}
                        <div className="w-[27%] shrink-0 rounded-2xl overflow-hidden flex flex-col" style={{ background: '#1A1030', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div className="px-4 py-2.5 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                <p className="text-[11px] font-bold text-white/70">My Results</p>
                            </div>
                            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                                {!score || score.columns.length === 0
                                    ? <p className="text-[10px] text-white/25 py-8 text-center">No marks published yet</p>
                                    : score.columns.map((c, i) => {
                                        const pct = !c.isAbsent && c.scored != null ? Math.round((c.scored / c.max) * 100) : null;
                                        const barColor = pct == null ? '#64748B' : pct >= 75 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';
                                        return (
                                            <div key={i} className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-semibold text-white/80 truncate flex-1 pr-2">{c.name}</p>
                                                    {c.isAbsent
                                                        ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 shrink-0">Absent</span>
                                                        : <div className="flex items-center gap-1.5 shrink-0">
                                                            <span className="text-[10px] font-bold text-white/60">{c.scored}/{c.max}</span>
                                                            {pct != null && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: barColor + '25', color: barColor }}>{pct}%</span>}
                                                        </div>
                                                    }
                                                </div>
                                                {!c.isAbsent && pct != null && (
                                                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
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
        if (tab === activeTab) return;
        setTabLoading(true);
        setTimeout(() => { setActiveTab(tab); setTabLoading(false); }, 600);
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
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Division title */}
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }}>
                                <Users size={16} className="text-violet-400" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-foreground leading-tight">
                                    {division?.name ?? '—'}
                                </h1>
                                <p className="text-[11px] text-muted-foreground">{division?.standardName}</p>
                            </div>
                        </div>

                        {/* Tab bar */}
                        <div className="flex gap-1 bg-muted/30 rounded-full p-0.5 border border-border/40 ml-2">
                            {TABS.map(tab => {
                                const isActive = activeTab === tab.key;
                                return (
                                    <button key={tab.key} onClick={() => switchTab(tab.key)} className="relative">
                                        {isActive && (
                                            <motion.div layoutId="studentClassTab"
                                                className="absolute inset-0 bg-primary rounded-full"
                                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                                        )}
                                        <div className={`relative z-10 px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {tab.label}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-xl font-bold leading-tight">{subjects.length}</p>
                            <p className="text-[11px] text-muted-foreground">Subjects</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xl font-bold leading-tight">{division?.totalStudents ?? data?.classmates.length ?? 0}</p>
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
