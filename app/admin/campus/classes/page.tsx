'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, Plus, Check, X, BookOpen, Users,
    ArrowUpRight, LayoutGrid, GripVertical, Pencil, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { useAcademicYear, useIsHistoricalYear } from '@/context/AcademicYearContext';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { colorForSubject } from '@/lib/subjectColors';
import { formatDisplayName } from '@/lib/displayName';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Assignment {
    id: string;
    subjectId: string | null;
    teacher: { id: string; prefix: string | null; user: { id: string; name: string | null } };
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
    studentCount: number;
    divisionSubjects: { subjectId: string }[];
    assignments: Assignment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getClassTeacher(div: Division): string | null {
    const ct = div.assignments.find(a => a.subjectId === null);
    if (!ct?.teacher.user.name) return null;
    return formatDisplayName(ct.teacher.user.name, ct.teacher.prefix);
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
    const { selectedYearId, isCurrentYearSelected } = useAcademicYear();
    const isHistorical = useIsHistoricalYear();
    const { user } = useAuthStore();
    // A sub-admin granted CAMPUS_MANAGE gets the exact same add/edit/delete/
    // reorder access as an Admin here — the backend routes for standards,
    // divisions, and subjects now check this same permission instead of
    // rejecting SUB_ADMIN outright.
    const isAdmin = user?.role === 'ADMIN' || (user?.role === 'SUB_ADMIN' && (user.permissions ?? []).includes('CAMPUS_MANAGE'));
    const [standards, setStandards] = useState<Standard[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [addingDivision, setAddingDivision] = useState<string | null>(null);
    const [addingStandard, setAddingStandard] = useState(false);
    const [saving, setSaving] = useState(false);
    const fetchedRef = useRef(false);
    const [addingSubject, setAddingSubject] = useState<string | null>(null);
    const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<{ id: string; name: string; standardId: string } | null>(null);

    // Rename (edit) state — one entity editable at a time, across both levels
    type EditTarget =
        | { type: 'standard'; id: string }
        | { type: 'division'; standardId: string; id: string };
    const [editing, setEditing] = useState<EditTarget | null>(null);
    // Any rename left open when switching to a past year is hidden (not
    // submittable) while that year is on screen.
    const visibleEditing = isHistorical ? null : editing;
    const [editValue, setEditValue] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    // Delete confirmation for Standard/Division — separate from subject delete above
    type DeleteTarget =
        | { type: 'standard'; id: string; name: string }
        | { type: 'division'; standardId: string; id: string; name: string };
    const [confirmDeleteEntity, setConfirmDeleteEntity] = useState<DeleteTarget | null>(null);
    const [deletingEntity, setDeletingEntity] = useState(false);

    const standardLabel = instType === 'COLLEGE' ? 'Department' : instType === 'COACHING' ? 'Batch' : 'Standard';
    const divisionLabel = instType === 'COLLEGE' ? 'Section' : instType === 'COACHING' ? 'Group' : 'Division';

    // The year this screen actually requests: null means "current year" (the
    // API call sends no academicYearId). selectedYearId itself starts as null
    // and then becomes the current year's real id once AcademicYearContext
    // loads — both mean "current", so comparing effectiveYear (not the raw id)
    // keeps that first-mount transition from looking like a year switch.
    const effectiveYear = isCurrentYearSelected ? null : selectedYearId;

    // Request sequencing: only the most recently *initiated* fetch may update
    // state, so a slow response for a previously-selected year can never land
    // on top of the newer year's data (or clear it on failure).
    const reqIdRef = useRef(0);

    const fetchStandards = useCallback(async () => {
        const requestId = ++reqIdRef.current;
        setLoading(true);
        try {
            const res = await api.get('/admin/campus/standards', {
                params: effectiveYear === null ? {} : { academicYearId: effectiveYear },
            });
            if (requestId !== reqIdRef.current) return; // a newer request has started; discard this stale response
            setStandards(res.data.data);
            setLoading(false);
        } catch (err: unknown) {
            if (requestId !== reqIdRef.current) return; // a newer request has started; discard this stale failure
            // Clear rather than keep the previous response on screen — otherwise
            // it would be shown under the newly-selected year's label.
            setStandards([]);
            setLoading(false);
            const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
            toast.error(data?.error ?? data?.message ?? 'Failed to load classes');
        }
    }, [effectiveYear]);

    // fetchedRef guards against React StrictMode's dev-only double-invoke of
    // this effect on mount (same deps, no real dependency change). prevYearRef
    // tracks the effective year so a genuine year switch still triggers a refetch.
    const prevYearRef = useRef(effectiveYear);
    useEffect(() => {
        if (!fetchedRef.current) {
            fetchedRef.current = true;
            prevYearRef.current = effectiveYear;
            fetchStandards();
            return;
        }
        if (prevYearRef.current !== effectiveYear) {
            prevYearRef.current = effectiveYear;
            fetchStandards();
        }
    }, [fetchStandards, effectiveYear]);

    const addStandard = async (name: string) => {
        if (isHistorical) return;
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
        if (isHistorical) return;
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
        if (isHistorical) return;
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
        if (isHistorical) return;
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

    // ── Rename ────────────────────────────────────────────────────────────────
    const startEdit = (target: EditTarget, currentName: string) => {
        setEditing(target);
        setEditValue(currentName);
    };
    const cancelEdit = () => {
        setEditing(null);
        setEditValue('');
    };
    const saveEdit = async () => {
        if (isHistorical || !editing || !editValue.trim()) return;
        const name = editValue.trim();
        setSavingEdit(true);
        try {
            if (editing.type === 'standard') {
                await api.patch(`/admin/campus/standards/${editing.id}`, { name });
                setStandards(prev => prev.map(s => s.id !== editing.id ? s : { ...s, name }));
            } else {
                await api.patch(`/admin/campus/divisions/${editing.id}`, { name });
                setStandards(prev => prev.map(s => s.id !== editing.standardId ? s : {
                    ...s, divisions: s.divisions.map(d => d.id !== editing.id ? d : { ...d, name }),
                }));
            }
            toast.success('Renamed');
            cancelEdit();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to rename');
        } finally {
            setSavingEdit(false);
        }
    };

    // ── Delete Standard / Division ───────────────────────────────────────────
    const performEntityDelete = async () => {
        if (isHistorical || !confirmDeleteEntity) return;
        const target = confirmDeleteEntity;
        setDeletingEntity(true);
        try {
            if (target.type === 'standard') {
                await api.delete(`/admin/campus/standards/${target.id}`);
                setStandards(prev => prev.filter(s => s.id !== target.id));
                if (expandedId === target.id) setExpandedId(null);
            } else {
                await api.delete(`/admin/campus/divisions/${target.id}`);
                setStandards(prev => prev.map(s => s.id !== target.standardId ? s : {
                    ...s, divisions: s.divisions.filter(d => d.id !== target.id),
                }));
            }
            toast.success(`${target.type === 'standard' ? standardLabel : divisionLabel} deleted`);
            setConfirmDeleteEntity(null);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to delete');
        } finally {
            setDeletingEntity(false);
        }
    };

    // ── Drag & drop reorder — Standards, Divisions ───────────────────────────
    // Same optimistic-then-persist pattern as subject reordering below.
    const [dragStdId, setDragStdId] = useState<string | null>(null);
    const [dragDivId, setDragDivId] = useState<string | null>(null);
    // Same reasoning as the subject pills — draggable only flips on while the
    // pointer is held down on that card's grip icon, so dragging can't start
    // by grabbing anywhere else on the card.
    const [stdDragReady, setStdDragReady] = useState(false);
    const [divDragReady, setDivDragReady] = useState(false);

    const reorderStandards = async (orderedIds: string[]) => {
        // Reorder is a write against the CURRENT year only, and the backend
        // responds with current-year data — never run it (or apply its
        // response) while a past year is on screen.
        if (isHistorical) return;
        const requestIdAtStart = reqIdRef.current;
        setStandards(prev => orderedIds
            .map(id => prev.find(s => s.id === id))
            .filter((s): s is Standard => !!s));
        try {
            const res = await api.patch('/admin/campus/standards/reorder', { orderedIds });
            const reordered: Standard[] = res.data.data;
            // A year switch (new fetch) since this reorder started means the
            // screen now shows different data — don't overwrite it.
            if (requestIdAtStart !== reqIdRef.current) return;
            setStandards(reordered);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to save order');
            fetchStandards();
        }
    };

    const handleStdDrop = (targetStdId: string) => {
        const draggedId = dragStdId;
        setDragStdId(null);
        if (!draggedId || draggedId === targetStdId) return;
        const ids = standards.map(s => s.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetStdId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderStandards(newIds);
    };

    const reorderDivisions = async (standardId: string, orderedIds: string[]) => {
        if (isHistorical) return;
        setStandards(prev => prev.map(s => s.id !== standardId ? s : {
            ...s,
            divisions: orderedIds
                .map(id => s.divisions.find(d => d.id === id))
                .filter((d): d is Division => !!d),
        }));
        try {
            const res = await api.patch(`/admin/campus/standards/${standardId}/divisions/reorder`, { orderedIds });
            const reordered: Division[] = res.data.data;
            setStandards(prev => prev.map(s => s.id !== standardId ? s : { ...s, divisions: reordered }));
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to save order');
            fetchStandards();
        }
    };

    const handleDivDrop = (standardId: string, targetDivId: string) => {
        const draggedId = dragDivId;
        setDragDivId(null);
        if (!draggedId || draggedId === targetDivId) return;
        const std = standards.find(s => s.id === standardId);
        if (!std) return;
        const ids = std.divisions.map(d => d.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetDivId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderDivisions(standardId, newIds);
    };

    const [dragSubjectId, setDragSubjectId] = useState<string | null>(null);
    // Native HTML5 drag makes the WHOLE element a drag source the moment
    // draggable=true — there's no built-in way to restrict the pickup point to
    // just the grip icon. So `draggable` only flips to true while the pointer
    // is actually held down on the grip icon (dragReady), instead of being
    // true for the pill at all times.
    const [dragReady, setDragReady] = useState(false);

    const reorderSubjects = async (standardId: string, orderedIds: string[]) => {
        if (isHistorical) return;
        // Optimistic reorder — colors are placeholders here (same as before the
        // drag) until the server responds with the real recolored list, since
        // color reassignment happens server-side to stay the single source of truth.
        setStandards(prev => prev.map(s => s.id !== standardId ? s : {
            ...s,
            subjects: orderedIds
                .map(id => s.subjects.find(sub => sub.id === id))
                .filter((sub): sub is Subject => !!sub),
        }));
        try {
            const res = await api.patch(`/admin/campus/standards/${standardId}/subjects/reorder`, { orderedIds });
            const reordered: Subject[] = res.data.data;
            setStandards(prev => prev.map(s => s.id !== standardId ? s : { ...s, subjects: reordered }));
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Failed to save subject order');
            fetchStandards();
        }
    };

    const handleSubjectDrop = (standardId: string, targetSubjectId: string) => {
        const draggedId = dragSubjectId;
        setDragSubjectId(null);
        if (!draggedId || draggedId === targetSubjectId) return;
        const std = standards.find(s => s.id === standardId);
        if (!std) return;
        const ids = std.subjects.map(s => s.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetSubjectId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderSubjects(standardId, newIds);
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
                            {loading
                                ? 'Loading...'
                                : `${standards.length} ${standardLabel.toLowerCase()}s · ${totalDivisions} ${divisionLabel.toLowerCase()}s · ${totalSubjects} subjects`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button
                                onClick={() => setAddingStandard(true)}
                                disabled={isHistorical}
                                title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all w-fit disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                <Plus size={15} /> Add {standardLabel}
                            </button>
                        )}
                    </div>
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

                {isAdmin && !isHistorical && addingStandard && (
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

                {!loading && standards.map((std, idx) => {
                    const isExpanded = expandedId === std.id;
                    const grad = gradients[idx % gradients.length];
                    const totalStudents = std.divisions.reduce((sum, div) => sum + div.studentCount, 0);

                    return (
                        <div key={std.id}
                            draggable={isAdmin && !isHistorical && stdDragReady}
                            onDragStart={() => setDragStdId(std.id)}
                            onDragOver={(e) => isAdmin && !isHistorical && e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); handleStdDrop(std.id); }}
                            onDragEnd={() => { setDragStdId(null); setStdDragReady(false); }}
                            className={`bg-card border border-border/50 rounded-2xl overflow-hidden transition-opacity ${dragStdId === std.id ? 'opacity-40' : ''}`}>

                            {/* Standard header */}
                            <div className="group/std w-full flex items-center justify-between px-3 sm:px-5 py-4 hover:bg-muted/20 transition-colors">
                                {isAdmin && !isHistorical && (
                                    <GripVertical
                                        size={15}
                                        className="text-muted-foreground/40 shrink-0 opacity-0 group-hover/std:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mr-1"
                                        onMouseDown={() => setStdDragReady(true)}
                                        onMouseUp={() => setStdDragReady(false)}
                                    />
                                )}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : std.id)}
                                    disabled={visibleEditing?.type === 'standard' && visibleEditing.id === std.id}
                                    className="flex items-center gap-3 flex-1 min-w-0 text-left">
                                    <div
                                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black text-white shrink-0"
                                        style={{ background: grad }}>
                                        {std.name.replace(/[^0-9A-Za-z]/g, '').slice(0, 2) || std.name[0]}
                                    </div>
                                    {visibleEditing?.type === 'standard' && visibleEditing.id === std.id ? (
                                        <input
                                            autoFocus
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                            onClick={e => e.stopPropagation()}
                                            className="h-9 px-3 rounded-xl border border-primary/50 bg-primary/5 text-sm font-bold focus:outline-none focus:border-primary transition-all w-48"
                                        />
                                    ) : (
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold truncate">{std.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span className="text-[11px] text-muted-foreground">{std.divisions.length} {divisionLabel.toLowerCase()}s</span>
                                                <span className="text-muted-foreground/40 text-[11px]">·</span>
                                                <span className="text-[11px] text-muted-foreground">{totalStudents} students</span>
                                            </div>
                                        </div>
                                    )}
                                </button>

                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {isAdmin && visibleEditing?.type === 'standard' && visibleEditing.id === std.id ? (
                                        <>
                                            <button onClick={saveEdit} disabled={savingEdit}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                <Check size={13} />
                                            </button>
                                            <button onClick={cancelEdit}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                <X size={13} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {isAdmin && (
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover/std:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => startEdit({ type: 'standard', id: std.id }, std.name)}
                                                        disabled={isHistorical}
                                                        title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                        <Pencil size={13} className="text-muted-foreground" />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeleteEntity({ type: 'standard', id: std.id, name: std.name })}
                                                        disabled={isHistorical}
                                                        title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                        <Trash2 size={13} className="text-red-500" />
                                                    </button>
                                                </div>
                                            )}
                                            <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </>
                                    )}
                                </div>
                            </div>

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
                                                        {(std.subjects ?? []).map((sub) => (
                                                            <span key={sub.id}
                                                                draggable={isAdmin && !isHistorical && dragReady}
                                                                onDragStart={() => setDragSubjectId(sub.id)}
                                                                onDragOver={(e) => isAdmin && !isHistorical && e.preventDefault()}
                                                                onDrop={(e) => { e.preventDefault(); handleSubjectDrop(std.id, sub.id); }}
                                                                onDragEnd={() => { setDragSubjectId(null); setDragReady(false); }}
                                                                className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-full text-xs font-medium transition-opacity ${dragSubjectId === sub.id ? 'opacity-40' : ''}`}
                                                                style={{
                                                                    background: colorForSubject(sub) + '20',
                                                                    color: colorForSubject(sub),
                                                                    border: `1px solid ${colorForSubject(sub)}40`,
                                                                }}>
                                                                {isAdmin && !isHistorical && (
                                                                    <GripVertical
                                                                        size={11}
                                                                        className="opacity-50 cursor-grab active:cursor-grabbing"
                                                                        onMouseDown={() => setDragReady(true)}
                                                                        onMouseUp={() => setDragReady(false)}
                                                                    />
                                                                )}
                                                                <BookOpen size={11} />
                                                                {sub.name}
                                                                {isAdmin && (
                                                                    <button
                                                                        onClick={() => setConfirmDeleteSubject({ id: sub.id, name: sub.name, standardId: std.id })}
                                                                        disabled={isHistorical}
                                                                        title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                                        className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all disabled:cursor-not-allowed">
                                                                        <X size={9} />
                                                                    </button>
                                                                )}
                                                            </span>
                                                        ))}
                                                        {(std.subjects ?? []).length === 0 && (
                                                            <span className="text-xs text-muted-foreground/60 italic">No subjects yet</span>
                                                        )}
                                                        {isAdmin && (addingSubject === std.id && !isHistorical ? (
                                                            <InlineAddInput
                                                                placeholder="Subject name"
                                                                onAdd={name => addSubject(std.id, name)}
                                                                onCancel={() => setAddingSubject(null)}
                                                                loading={saving}
                                                            />
                                                        ) : (
                                                            <button onClick={() => setAddingSubject(std.id)}
                                                                disabled={isHistorical}
                                                                title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
                                                                    draggable={isAdmin && !isHistorical && divDragReady}
                                                                    onDragStart={() => setDragDivId(div.id)}
                                                                    onDragOver={(e) => isAdmin && !isHistorical && e.preventDefault()}
                                                                    onDrop={(e) => { e.preventDefault(); handleDivDrop(std.id, div.id); }}
                                                                    onDragEnd={() => { setDragDivId(null); setDivDragReady(false); }}
                                                                    className={`group/divcard rounded-2xl border border-border/50 overflow-hidden flex flex-col bg-background hover:shadow-md hover:shadow-black/5 hover:border-border transition-all duration-200 ${dragDivId === div.id ? 'opacity-40' : ''}`}>

                                                                    <div className="px-4 pt-4 pb-3">
                                                                        <div className="flex items-center justify-between mb-2 gap-2">
                                                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                                {isAdmin && !isHistorical && (
                                                                                    <GripVertical
                                                                                        size={13}
                                                                                        className="text-muted-foreground/40 shrink-0 opacity-0 group-hover/divcard:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                                                                                        onMouseDown={() => setDivDragReady(true)}
                                                                                        onMouseUp={() => setDivDragReady(false)}
                                                                                    />
                                                                                )}
                                                                                <div
                                                                                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-2 border-white/20"
                                                                                    style={{ background: grad }}>
                                                                                    <span className="text-sm font-black text-white">
                                                                                        {div.name.includes('-') ? div.name.split('-').pop() : div.name[0]}
                                                                                    </span>
                                                                                </div>
                                                                                {visibleEditing?.type === 'division' && visibleEditing.id === div.id ? (
                                                                                    <input
                                                                                        autoFocus
                                                                                        value={editValue}
                                                                                        onChange={e => setEditValue(e.target.value)}
                                                                                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                                                                        className="h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-sm font-bold focus:outline-none focus:border-primary transition-all w-full"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-sm font-bold truncate">{div.name}</p>
                                                                                        <p className="text-[11px] text-muted-foreground">{div.studentCount} student{div.studentCount === 1 ? '' : 's'}</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            <div className="flex items-center gap-1 shrink-0">
                                                                                {isAdmin && visibleEditing?.type === 'division' && visibleEditing.id === div.id ? (
                                                                                    <>
                                                                                        <button onClick={saveEdit} disabled={savingEdit}
                                                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white disabled:opacity-50"
                                                                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                                                            <Check size={13} />
                                                                                        </button>
                                                                                        <button onClick={cancelEdit}
                                                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                                                            <X size={13} />
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        {isAdmin && (
                                                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover/divcard:opacity-100 transition-opacity">
                                                                                                <button
                                                                                                    onClick={() => startEdit({ type: 'division', standardId: std.id, id: div.id }, div.name)}
                                                                                                    disabled={isHistorical}
                                                                                                    title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                                                                    <Pencil size={13} className="text-muted-foreground" />
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => setConfirmDeleteEntity({ type: 'division', standardId: std.id, id: div.id, name: div.name })}
                                                                                                    disabled={isHistorical}
                                                                                                    title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                                                                    <Trash2 size={13} className="text-red-500" />
                                                                                                </button>
                                                                                            </div>
                                                                                        )}
                                                                                        <div
                                                                                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                                                                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                                                                            onClick={() => router.push(`/admin/campus/classes/${std.id}/${div.id}`)}>
                                                                                            <ArrowUpRight size={19} className="text-white" />
                                                                                        </div>
                                                                                    </>
                                                                                )}
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
                                                                                                            style={{ background: colorForSubject(sub) }} />
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
                                                {isAdmin && (addingDivision === std.id && !isHistorical ? (
                                                    <InlineAddInput
                                                        placeholder={`e.g. ${std.name.replace('Class ', '')}-A`}
                                                        onAdd={name => addDivision(std.id, name)}
                                                        onCancel={() => setAddingDivision(null)}
                                                        loading={saving}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => setAddingDivision(std.id)}
                                                        disabled={isHistorical}
                                                        title={isHistorical ? 'Read-only — viewing a past year' : undefined}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
                {confirmDeleteSubject && !isHistorical && (
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

            <AnimatePresence>
                {confirmDeleteEntity && !isHistorical && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                            <h3 className="text-base font-bold mb-2">
                                Delete {confirmDeleteEntity.type === 'standard' ? standardLabel : divisionLabel}?
                            </h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                <span className="font-semibold text-foreground">{confirmDeleteEntity.name}</span>{' '}
                                {confirmDeleteEntity.type === 'standard'
                                    ? `will be removed along with all its ${divisionLabel.toLowerCase()}s and subjects.`
                                    : 'will be removed. Student data linked to this division may be affected.'}
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmDeleteEntity(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={performEntityDelete} disabled={deletingEntity}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white bg-red-500 hover:opacity-90 transition-all disabled:opacity-50">
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
