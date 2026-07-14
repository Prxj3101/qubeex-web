'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, Plus, Check, X, BookOpen, Users,
    ArrowUpRight, LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Assignment {
    id: string;
    subjectId: string | null;
    teacher: { id: string; user: { id: string; name: string | null } };
    subject: { id: string; name: string; color: string | null } | null;
}

interface Subject {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
    order: number;
}

interface Standard {
    id: string;
    name: string;
    order: number;
    subjects: Subject[];
    divisions: Division[];
}

interface Division {
    id: string;
    name: string;
    capacity: number | null;
    divisionSubjects: { subjectId: string }[];
    assignments: Assignment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getClassTeacher(div: Division): string | null {
    const ct = div.assignments.find(a => a.subjectId === null);
    return ct?.teacher.user.name ?? null;
}

function getAssignedCount(div: Division): number {
    return div.assignments.filter(a => a.subjectId !== null).length;
}

// ── Inline Add Input ──────────────────────────────────────────────────────────

function InlineAddInput({ placeholder, onAdd, onCancel, loading }: {
    placeholder: string;
    onAdd: (val: string) => void;
    onCancel: () => void;
    loading?: boolean;
}) {
    const [val, setVal] = useState('');
    return (
        <div className="flex items-center gap-1.5">
            <input
                autoFocus
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && val.trim()) onAdd(val.trim());
                    if (e.key === 'Escape') onCancel();
                }}
                placeholder={placeholder}
                className="h-8 px-3 rounded-xl border border-primary/50 bg-primary/5 text-xs focus:outline-none focus:border-primary transition-all w-36"
            />
            <button
                onClick={() => val.trim() && onAdd(val.trim())}
                disabled={loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                <Check size={13} />
            </button>
            <button
                onClick={onCancel}
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
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'ADMIN';
    const [standards, setStandards] = useState<Standard[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [addingDivision, setAddingDivision] = useState<string | null>(null);
    const [addingStandard, setAddingStandard] = useState(false);
    const [saving, setSaving] = useState(false);
    const fetchedRef = useRef(false);
    const [addingSubject, setAddingSubject] = useState<string | null>(null);
    const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<{ id: string; name: string; standardId: string } | null>(null);

    const standardLabel = instType === 'COLLEGE' ? 'Department' : instType === 'COACHING' ? 'Batch' : 'Standard';
    const divisionLabel = instType === 'COLLEGE' ? 'Section' : instType === 'COACHING' ? 'Group' : 'Division';

    const fetchStandards = useCallback(async () => {
        try {
            const res = await api.get('/admin/campus/standards');
            setStandards(res.data.data);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to load classes');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchStandards();
    }, [fetchStandards]);

    const addStandard = async (name: string) => {
        setSaving(true);
        try {
            const res = await api.post('/admin/campus/standards', { name });
            const newStd: Standard = { ...res.data.data, divisions: [] };
            setStandards(prev => [...prev, newStd]);
            setAddingStandard(false);
            setExpandedId(newStd.id);
            toast.success(`${standardLabel} added`);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to add');
        } finally {
            setSaving(false);
        }
    };

    const addDivision = async (standardId: string, name: string) => {
        setSaving(true);
        try {
            const res = await api.post(`/admin/campus/standards/${standardId}/divisions`, { name });
            const newDiv: Division = { ...res.data.data, divisionSubjects: [], assignments: [] };
            setStandards(prev => prev.map(s => s.id !== standardId ? s : {
                ...s, divisions: [...s.divisions, newDiv],
            }));
            setAddingDivision(null);
            toast.success(`${divisionLabel} added`);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to add');
        } finally {
            setSaving(false);
        }
    };

    const addSubject = async (standardId: string, name: string) => {
        setSaving(true);
        try {
            const res = await api.post(`/admin/campus/standards/${standardId}/subjects`, { name });
            const newSubject: Subject = { ...res.data.data };
            setStandards(prev => prev.map(s => s.id !== standardId ? s : {
                ...s,
                subjects: [...s.subjects, newSubject],  // sirf standard mein
            }));
            setAddingSubject(null);
            toast.success('Subject added');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to add subject');
        } finally {
            setSaving(false);
        }
    };

    const deleteSubject = async (subjectId: string, standardId: string) => {
        try {
            await api.delete(`/admin/campus/subjects/${subjectId}`);
            setStandards(prev => prev.map(s => s.id !== standardId ? s : {
                ...s,
                subjects: s.subjects.filter(sub => sub.id !== subjectId),
                divisions: s.divisions.map(d => ({
                    ...d,
                    divisionSubjects: d.divisionSubjects.filter(ds => ds.subjectId !== subjectId),
                    assignments: d.assignments.filter(a => a.subjectId !== subjectId),
                })),
            }));
            toast.success('Subject deleted');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to delete subject');
        }
    };

    const totalDivisions = standards.reduce((n, s) => n + s.divisions.length, 0);
    const totalSubjects = standards.reduce((n, s) => n + (s.subjects?.length ?? 0), 0);
    const gradients = [
        'linear-gradient(135deg, #7C3AED, #9F67FF)',
        'linear-gradient(135deg, #DA7756, #E8876A)',
        'linear-gradient(135deg, #0891B2, #38BDF8)',
        'linear-gradient(135deg, #059669, #34D399)',
        'linear-gradient(135deg, #D97706, #FCD34D)',
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden pb-3">

            {/* Header */}
            <div className="shrink-0 pt-0 pb-0 px-1 sticky top-0 z-20 bg-background">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h1 className="text-lg lg:text-xl font-bold flex items-center gap-2">
                            <LayoutGrid size={21} />
                            Classes
                        </h1>
                        <p className="text-[13px] text-muted-foreground">
                            {standards.length} {standardLabel.toLowerCase()}s · {totalDivisions} {divisionLabel.toLowerCase()}s · {totalSubjects} subjects
                        </p>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => setAddingStandard(true)}
                            className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all w-fit"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Plus size={15} /> Add {standardLabel}
                        </button>
                    )}
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Standards list */}
            <div className="flex-1 overflow-y-auto px-1 pb-6 pt-3 space-y-3">

                {loading && (
                    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                        Loading...
                    </div>
                )}

                {!loading && standards.length === 0 && !addingStandard && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                            <LayoutGrid size={22} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No {standardLabel.toLowerCase()}s yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Click &ldquo;Add {standardLabel}&rdquo; to get started</p>
                    </div>
                )}

                {isAdmin && addingStandard && (
                    <div className="bg-card border border-primary/30 rounded-2xl px-5 py-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-3">New {standardLabel}</p>
                        <InlineAddInput
                            placeholder="e.g. Class 7"
                            onAdd={addStandard}
                            onCancel={() => setAddingStandard(false)}
                            loading={saving}
                        />
                    </div>
                )}

                {standards.map((std, idx) => {
                    const isExpanded = expandedId === std.id;
                    const grad = gradients[idx % gradients.length];
                    const totalStudents = 0;

                    return (
                        <div key={std.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden">

                            {/* Standard header */}
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : std.id)}
                                className="w-full flex items-center justify-between px-3 sm:px-5 py-4 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black text-white shrink-0"
                                        style={{ background: grad }}>
                                        {std.name.replace(/[^0-9A-Za-z]/g, '').slice(0, 2) || std.name[0]}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold">{std.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-[11px] text-muted-foreground">{std.divisions.length} {divisionLabel.toLowerCase()}s</span>
                                            <span className="text-muted-foreground/40 text-[11px]">·</span>
                                            <span className="text-[11px] text-muted-foreground">{totalStudents} students</span>
                                        </div>
                                    </div>
                                </div>
                                <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Expanded */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden">
                                        <div className="border-t border-border/40 px-3 sm:px-5 py-4 space-y-4">

                                            <div className="border-t border-border/40 px-3 sm:px-5 py-4 space-y-4">

                                                {/* Subjects */}
                                                <div>
                                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                                                        Subjects
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {(std.subjects ?? []).map(sub => (
                                                            <span key={sub.id}
                                                                className="group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-full text-xs font-medium"
                                                                style={{
                                                                    background: (sub.color ?? '#7C3AED') + '20',
                                                                    color: sub.color ?? '#7C3AED',
                                                                    border: `1px solid ${sub.color ?? '#7C3AED'}40`,
                                                                }}>
                                                                <BookOpen size={11} />
                                                                {sub.name}
                                                                {isAdmin && (
                                                                    <button
                                                                        onClick={() => setConfirmDeleteSubject({ id: sub.id, name: sub.name, standardId: std.id })}
                                                                        className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all">
                                                                        <X size={9} />
                                                                    </button>
                                                                )}
                                                            </span>
                                                        ))}
                                                        {(std.subjects ?? []).length === 0 && (
                                                            <span className="text-xs text-muted-foreground/60 italic">No subjects yet</span>
                                                        )}
                                                        {isAdmin && (addingSubject === std.id ? (
                                                            <InlineAddInput
                                                                placeholder="Subject name"
                                                                onAdd={name => addSubject(std.id, name)}
                                                                onCancel={() => setAddingSubject(null)}
                                                                loading={saving}
                                                            />
                                                        ) : (
                                                            <button onClick={() => setAddingSubject(std.id)}
                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                                                                <Plus size={11} /> Add subject
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Division cards */}
                                                {std.divisions.length > 0 && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                        {std.divisions.map((div, divIdx) => {
                                                            const classTeacherName = getClassTeacher(div);
                                                            const assignedSubjects = getAssignedCount(div);

                                                            return (
                                                                <motion.div
                                                                    key={div.id}
                                                                    initial={{ opacity: 0, y: 20 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: divIdx * 0.05, duration: 0.3 }}
                                                                    className="rounded-2xl border border-border/50 overflow-hidden flex flex-col bg-background hover:shadow-md hover:shadow-black/5 hover:border-border transition-all duration-200">

                                                                    <div className="px-4 pt-4 pb-3">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <div className="flex items-center gap-2.5">
                                                                                <div
                                                                                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-2 border-white/20"
                                                                                    style={{ background: grad }}>
                                                                                    <span className="text-sm font-black text-white">
                                                                                        {div.name.includes('-') ? div.name.split('-').pop() : div.name[0]}
                                                                                    </span>
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-sm font-bold">{div.name}</p>
                                                                                    <p className="text-[11px] text-muted-foreground">0 students</p>
                                                                                </div>
                                                                            </div>
                                                                            <div
                                                                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                                                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                                                                onClick={() => router.push(`/admin/campus/classes/${std.id}/${div.id}`)}>
                                                                                <ArrowUpRight size={19} className="text-white" />
                                                                            </div>
                                                                        </div>


                                                                        <div className="px-4 py-1.5 border-t border-border/40">
                                                                            <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
                                                                                    <span className="text-[10px] text-muted-foreground">Class Teacher</span>
                                                                                </div>
                                                                                {classTeacherName ? (
                                                                                    <span className="text-[10px] font-semibold" style={{ color: '#F59E0B' }}>{classTeacherName}</span>
                                                                                ) : (
                                                                                    <span className="text-[10px] text-muted-foreground/50 italic">Not assigned</span>
                                                                                )}
                                                                            </div>
                                                                            {(() => {
                                                                                const selectedIds = new Set(div.divisionSubjects.map(ds => ds.subjectId));
                                                                                const selectedSubs = std.subjects.filter(s => selectedIds.has(s.id));
                                                                                if (selectedSubs.length === 0) return null;
                                                                                return (
                                                                                    <>
                                                                                        <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider py-1">Subjects</p>
                                                                                        {selectedSubs.map((sub: Subject) => {
                                                                                            const assignment = div.assignments.find(a => a.subjectId === sub.id);
                                                                                            return (
                                                                                                <div key={sub.id} className="flex items-center justify-between py-1 border-t border-border/20">
                                                                                                    <div className="flex items-center gap-1.5">
                                                                                                        <div className="w-1.5 h-1.5 rounded-full shrink-0"
                                                                                                            style={{ background: sub.color ?? '#7C3AED' }} />
                                                                                                        <span className="text-[10px] text-muted-foreground">{sub.name}</span>
                                                                                                    </div>
                                                                                                    {assignment?.teacher.user.name ? (
                                                                                                        <span className="text-[10px] font-semibold truncate max-w-[80px] text-right text-foreground">
                                                                                                            {assignment.teacher.user.name}
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span className="text-[10px] text-muted-foreground/50 italic">Not assigned</span>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {std.divisions.length === 0 && (
                                                    <p className="text-xs text-muted-foreground/60 italic">
                                                        No {divisionLabel.toLowerCase()}s yet
                                                    </p>
                                                )}

                                                {/* Add division — ADMIN only */}
                                                {isAdmin && (addingDivision === std.id ? (
                                                    <InlineAddInput
                                                        placeholder={`e.g. ${std.name.replace('Class ', '')}-A`}
                                                        onAdd={name => addDivision(std.id, name)}
                                                        onCancel={() => setAddingDivision(null)}
                                                        loading={saving}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => setAddingDivision(std.id)}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                                                        <Plus size={11} /> Add {divisionLabel}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            <AnimatePresence>
                {confirmDeleteSubject && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                            <h3 className="text-base font-bold mb-2">Delete Subject?</h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                <span className="font-semibold text-foreground">{confirmDeleteSubject.name}</span> will be removed from this standard and all its divisions. Teacher assignments for this subject will also be removed.
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmDeleteSubject(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => { deleteSubject(confirmDeleteSubject.id, confirmDeleteSubject.standardId); setConfirmDeleteSubject(null); }}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white bg-red-500 hover:opacity-90 transition-all">
                                    Yes, Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
