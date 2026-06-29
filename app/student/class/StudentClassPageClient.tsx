'use client';

import { useState, useEffect } from 'react';
import PencilLoader from '@/components/student/PencilLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Users, Trophy, Calendar, Loader2, X, FileText, ExternalLink } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Subject {
    id: string; name: string; code: string; color: string; teacherName: string;
}
interface Classmate {
    id: string; name: string; rollNo: string;
    rank: number | null; attendancePct: number | null;
    marksPct: number | null; offlinePct: number | null; onlinePct: number | null;
    isMe: boolean;
}
interface SubjectScore {
    subjectId: string; subjectName: string; subjectCode: string; subjectColor: string;
    columns: { name: string; scored: number | null; max: number; isAbsent: boolean }[];
    totalScored: number; totalMax: number; pct: number | null;
}
interface LbEntry {
    name: string; combinedPct: number; offlinePct: number | null; onlinePct: number | null; isMe: boolean;
}
interface ResultFile {
    id: string; name: string; pdfUrl: string | null;
}
interface ClassData {
    division: { id: string; name: string; standardName: string; classTeacherName: string | null; totalStudents: number; subjects: Subject[] } | null;
    resultFiles: ResultFile[];
    classmates: Classmate[];
    myScores: SubjectScore[];
    subjectLeaderboards: Record<string, LbEntry[]>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#0891B2', '#059669'];
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase(); }
function formatDivision(n: string) { const p = n.split('-'); return p.length > 1 ? `Division ${p.slice(1).join('-')}` : n; }

type LeaderboardMode = 'combined' | 'offline' | 'online';
const LB_TABS: { key: LeaderboardMode; label: string }[] = [
    { key: 'offline', label: 'Offline' },
    { key: 'online', label: 'Online' },
    { key: 'combined', label: 'Combined' },
];

function LeaderboardFilter({ mode, onChange }: { mode: LeaderboardMode; onChange: (m: LeaderboardMode) => void }) {
    return (
        <div className="flex bg-muted/40 rounded-full p-0.5 border border-border/40 shrink-0">
            {LB_TABS.map(t => (
                <button key={t.key} onClick={() => onChange(t.key)}
                    className={`text-[9px] font-semibold px-2 py-0.5 rounded-full transition-all ${mode === t.key ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                    {t.label}
                </button>
            ))}
        </div>
    );
}

function getPct(c: Classmate, mode: LeaderboardMode) {
    if (mode === 'offline') return c.offlinePct;
    if (mode === 'online') return c.onlinePct;
    return c.marksPct;
}

function getLbPct(e: LbEntry, mode: LeaderboardMode) {
    if (mode === 'offline') return e.offlinePct;
    if (mode === 'online') return e.onlinePct;
    return e.combinedPct;
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
    return (
        <div className="px-3 py-2 border-b border-border/40 bg-muted/20 shrink-0 flex items-center gap-2">
            <span className="text-muted-foreground">{icon}</span>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex-1">{title}</p>
            {right}
        </div>
    );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 7 }: { name: string; size?: number }) {
    return (
        <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0`}
            style={{ width: size * 4, height: size * 4, fontSize: size * 4 * 0.32, background: getAvatarColor(name) }}>
            {getInitials(name)}
        </div>
    );
}

// ── Podium ─────────────────────────────────────────────────────────────────────
const PODIUM_CFG = [
    { label: '🥈', podiumH: 52, color: '#94A3B8', rank: 2 },
    { label: '🥇', podiumH: 76, color: '#F59E0B', rank: 1 },
    { label: '🥉', podiumH: 38, color: '#CD7C2F', rank: 3 },
];

function Podium({ top3, mode }: { top3: Classmate[]; mode: LeaderboardMode }) {
    const ordered = [top3[1], top3[0], top3[2]];
    return (
        <div className="flex items-end justify-center gap-3 px-2 py-2">
            {ordered.map((s, i) => {
                if (!s) return <div key={i} className="w-16" />;
                const cfg = PODIUM_CFG[i];
                const pct = getPct(s, mode);
                return (
                    <div key={s.id} className="flex flex-col items-center gap-1">
                        <Avatar name={s.name} size={i === 1 ? 9 : 7} />
                        <p className="text-[9px] font-semibold text-center w-14 leading-tight truncate">{s.name.split(' ')[0]}</p>
                        {s.isMe && <span className="text-[7px] font-bold px-1 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400">You</span>}
                        <p className="text-[9px] font-bold" style={{ color: cfg.color }}>{pct != null ? `${pct}%` : '—'}</p>
                        <div className="w-14 rounded-t-lg flex items-center justify-center" style={{ height: cfg.podiumH, backgroundColor: cfg.color }}>
                            <span className="text-lg">{cfg.label}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── View Tab ──────────────────────────────────────────────────────────────────
function ViewTab({ data }: { data: ClassData }) {
    const { classmates, division, marksheetName } = data;
    const [showTimetable, setShowTimetable] = useState(false);
    const [lbMode, setLbMode] = useState<LeaderboardMode>('combined');

    const top5 = [...classmates]
        .filter(c => getPct(c, lbMode) != null || c.rank != null)
        .sort((a, b) => (getPct(b, lbMode) ?? -1) - (getPct(a, lbMode) ?? -1))
        .slice(0, 5);
    const top3 = top5.slice(0, 3);
    const rest = top5.slice(3);
    const subjects = division?.subjects ?? [];

    return (
        <div className="h-full overflow-hidden flex gap-2.5 pt-2.5 pb-2.5 px-1">

            {/* LEFT — Classmates */}
            <div className="w-[22%] shrink-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                <SectionHeader icon={<Users size={12} />} title={`Classmates (${classmates.length})`} />
                <div className="flex-1 overflow-y-auto">
                    {classmates.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">No classmates found</p>
                    ) : classmates.map(s => (
                        <div key={s.id} className={`flex items-center gap-2 px-3 py-2 border-b border-border/20 transition-colors ${s.isMe ? 'bg-violet-500/10' : 'hover:bg-muted/20'}`}>
                            <Avatar name={s.name} size={7} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                    <p className="text-[11px] font-semibold truncate">{s.name}</p>
                                    {s.isMe && <span className="text-[7px] font-bold px-1 py-0.5 rounded-full shrink-0 bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400">You</span>}
                                </div>
                                <div className="flex gap-1.5">
                                    <p className="text-[9px] text-muted-foreground">Roll {s.rollNo}</p>
                                    {s.attendancePct != null && (
                                        <span className={`text-[9px] font-semibold ${s.attendancePct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                            {s.attendancePct}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            {s.rank != null && (
                                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 shrink-0">#{s.rank}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* CENTER — Timetable + Subject Teachers */}
            <div className="flex-1 min-w-0 flex flex-col gap-2.5">

                {/* Timetable */}
                <div className="flex-1 min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col">
                    <SectionHeader icon={<Calendar size={12} />} title="Timetable" />
                    <div className="flex-1 flex items-center justify-center p-2 cursor-pointer overflow-hidden"
                        onClick={() => setShowTimetable(true)}>
                        <img src="/timetable.jpeg" alt="Timetable"
                            className="w-full h-full rounded-xl object-contain hover:opacity-90 transition-opacity" />
                    </div>
                </div>

                {/* Subject Teachers */}
                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col max-h-[44%]">
                    <SectionHeader icon={<BookOpen size={12} />} title="Subject Teachers" />
                    <div className="overflow-y-auto flex-1">
                        {subjects.length === 0
                            ? <p className="text-[11px] text-muted-foreground text-center py-4">No subjects assigned</p>
                            : subjects.map(sub => (
                                <div key={sub.id} className="flex items-center gap-2.5 px-3 py-2 border-b border-border/20 hover:bg-muted/10 transition-colors">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                                    <p className="text-[10px] font-semibold flex-1 truncate">{sub.name}</p>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Avatar name={sub.teacherName} size={5} />
                                        <p className="text-[9px] text-muted-foreground truncate max-w-[100px]">{sub.teacherName}</p>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            {/* RIGHT — Leaderboard + Results */}
            <div className="w-[30%] shrink-0 flex flex-col gap-2.5">

                {/* Leaderboard */}
                <div className="flex-1 min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col">
                    <SectionHeader
                        icon={<Trophy size={12} />}
                        title="Leaderboard — Top 5"
                        right={<LeaderboardFilter mode={lbMode} onChange={setLbMode} />}
                    />
                    {top5.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-xs text-muted-foreground text-center px-4">Leaderboard available once marks are published</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto flex flex-col">
                            {top3.length >= 3 && <Podium top3={top3 as [Classmate, Classmate, Classmate]} mode={lbMode} />}
                            {rest.length > 0 && (
                                <div className="px-3 space-y-1.5 pb-2">
                                    {rest.map((s, i) => (
                                        <div key={s.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${s.isMe ? 'border-violet-400/40 bg-violet-500/10' : 'border-border/40 bg-background'}`}>
                                            <span className="text-[10px] font-black text-muted-foreground w-4 text-center shrink-0">#{i + 4}</span>
                                            <Avatar name={s.name} size={6} />
                                            <p className="text-[10px] font-semibold flex-1 truncate">
                                                {s.name.split(' ')[0]}
                                                {s.isMe && <span className="ml-1 text-[7px] font-bold text-violet-600 dark:text-violet-400">(You)</span>}
                                            </p>
                                            <span className="text-[10px] font-bold shrink-0" style={{ color: '#7C3AED' }}>
                                                {getPct(s, lbMode) != null ? `${getPct(s, lbMode)}%` : '—'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Results files */}
                <div className="shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col max-h-[36%]">
                    <SectionHeader icon={<FileText size={12} />} title="Results" />
                    <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1.5">
                        {!marksheetName ? (
                            <p className="text-[10px] text-muted-foreground py-3 text-center">No published results yet</p>
                        ) : (
                            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-background border border-border/40 hover:border-violet-400/40 transition-colors group">
                                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                                    <FileText size={14} className="text-red-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold truncate">{marksheetName}</p>
                                    <p className="text-[9px] text-muted-foreground">Marksheet · Published</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Timetable fullscreen */}
            {showTimetable && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setShowTimetable(false)}>
                    <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setShowTimetable(false)}>
                        <X size={24} />
                    </button>
                    <img src="/timetable.jpeg" alt="Timetable" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
}

// ── Subjects Tab ──────────────────────────────────────────────────────────────
function SubjectsTab({ subjects, myScores, subjectLeaderboards }: { subjects: Subject[]; myScores: SubjectScore[]; subjectLeaderboards: Record<string, LbEntry[]> }) {
    const [selectedId, setSelectedId] = useState<string>(subjects[0]?.id ?? '');
    const [lbMode, setLbMode] = useState<LeaderboardMode>('combined');
    const [centerTab, setCenterTab] = useState<'results' | 'materials'>('results');

    const subject = subjects.find(s => s.id === selectedId);
    const score = myScores.find(s => s.subjectId === selectedId);
    const leaderboard = subjectLeaderboards[selectedId] ?? [];
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
        <div className="h-full flex flex-col overflow-hidden pt-2.5 pb-2.5 px-1">

            {/* Subject chips */}
            <div className="shrink-0 flex flex-wrap gap-1.5 mb-2.5">
                {subjects.map(sub => {
                    const isActive = sub.id === selectedId;
                    return (
                        <button key={sub.id} onClick={() => setSelectedId(sub.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                            style={isActive
                                ? { background: sub.color + '20', color: sub.color, border: `1px solid ${sub.color}40` }
                                : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}>
                            <BookOpen size={10} />
                            {sub.name}
                        </button>
                    );
                })}
            </div>

            {subject && (
                <div className="flex-1 min-h-0 flex gap-2.5">

                    {/* LEFT — teacher card + filter + subject leaderboard */}
                    <div className="w-[28%] shrink-0 flex flex-col gap-2.5 overflow-hidden">

                        {/* Teacher card */}
                        <div className="shrink-0 bg-card border border-border/50 rounded-2xl px-3 py-3 shadow-sm shadow-black/5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                style={{ background: subject.color }}>
                                {subject.code}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold truncate">{subject.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <Avatar name={subject.teacherName} size={4} />
                                    <p className="text-[9px] text-muted-foreground truncate">{subject.teacherName}</p>
                                </div>
                            </div>
                        </div>

                        {/* Per-subject leaderboard */}
                        <div className="flex-1 min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col">
                            <SectionHeader
                                icon={<Trophy size={11} />}
                                title={`${subject.code} — Top 5`}
                                right={<LeaderboardFilter mode={lbMode} onChange={setLbMode} />}
                            />
                            <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
                                {leaderboard.length === 0 ? (
                                    <p className="text-[10px] text-muted-foreground py-6 text-center">No results published yet</p>
                                ) : leaderboard.map((e, i) => {
                                    const pct = getLbPct(e, lbMode);
                                    return (
                                        <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border ${e.isMe ? 'border-violet-400/40 bg-violet-500/10' : 'border-border/30 bg-background'}`}>
                                            <span className="text-sm shrink-0 w-5 text-center">
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-[10px] font-black text-muted-foreground">#{i + 1}</span>}
                                            </span>
                                            <p className="text-[10px] font-semibold flex-1 truncate">
                                                {e.name.split(' ')[0]}
                                                {e.isMe && <span className="ml-1 text-[7px] font-bold text-violet-600 dark:text-violet-400">(You)</span>}
                                            </p>
                                            <span className="text-[10px] font-bold shrink-0" style={{ color: subject.color }}>
                                                {pct != null ? `${pct}%` : '—'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* CENTER — Results/Materials toggle + chart */}
                    <div className="flex-1 min-h-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col">
                        <div className="px-3 py-2 border-b border-border/40 bg-muted/20 shrink-0 flex items-center gap-3">
                            {(['results', 'materials'] as const).map(t => (
                                <button key={t} onClick={() => setCenterTab(t)}
                                    className={`text-[10px] font-bold uppercase tracking-wider pb-0.5 transition-all ${centerTab === t ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {t === 'results' ? 'Results' : 'Materials'}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 min-h-0 p-3">
                            {centerTab === 'materials' ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-xs text-muted-foreground">No materials uploaded yet</p>
                                </div>
                            ) : chartData.length < 2 ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-xs text-muted-foreground">Need at least 2 exams for trend chart</p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 28, right: 12, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id={`grad-${subject.id}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={subject.color} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={subject.color} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} unit="%" />
                                        <Tooltip
                                            contentStyle={{ background: '#1A1030', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 11 }}
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
                            )}
                        </div>
                    </div>

                    {/* RIGHT — My Results */}
                    <div className="w-[28%] shrink-0 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm shadow-black/5 flex flex-col">
                        <SectionHeader icon={<FileText size={11} />} title="My Results" />
                        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1.5">
                            {!score || score.columns.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground py-8 text-center">No marks published yet</p>
                            ) : score.columns.map((c, i) => {
                                const pct = !c.isAbsent && c.scored != null ? Math.round((c.scored / c.max) * 100) : null;
                                return (
                                    <div key={i} className="bg-background border border-border/40 rounded-xl p-2.5">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-[9px] font-semibold truncate flex-1 pr-1">{c.name}</p>
                                            {c.isAbsent
                                                ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-600 shrink-0">Absent</span>
                                                : <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[9px] font-bold" style={{ color: subject.color }}>{c.scored}/{c.max}</span>
                                                    {pct != null && <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full ${pct >= 75 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' : pct >= 40 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700' : 'bg-red-100 dark:bg-red-950 text-red-600'}`}>{pct}%</span>}
                                                </div>
                                            }
                                        </div>
                                        {!c.isAbsent && pct != null && (
                                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: subject.color }} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
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
        setTimeout(() => { setActiveTab(tab); setTabLoading(false); }, 800);
    }

    const division = data?.division;
    const subjects = division?.subjects ?? [];
    const divLabel = division ? formatDivision(division.name) : '—';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-1 pt-1 pb-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Users size={22} /> {division?.standardName ?? '—'} · {divLabel}
                            </h1>
                            {division?.classTeacherName && (
                                <p className="text-xs text-muted-foreground">Class Teacher: {division.classTeacherName}</p>
                            )}
                        </div>

                        {/* Tab bar */}
                        <div className="flex gap-1 bg-muted/50 rounded-full p-0.5 border border-border/50 ml-4">
                            {TABS.map(tab => {
                                const isActive = activeTab === tab.key;
                                return (
                                    <button key={tab.key} onClick={() => switchTab(tab.key)} className="relative">
                                        {isActive && (
                                            <motion.div layoutId="studentClassTab"
                                                className="absolute inset-0 bg-primary rounded-full"
                                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                                        )}
                                        <div className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
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
                <div className="h-px bg-border/60 mt-2" />
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
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
