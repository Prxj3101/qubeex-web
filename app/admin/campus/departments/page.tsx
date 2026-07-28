'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, Plus, Check, X, BookOpen,
    ArrowUpRight, GripVertical, Building2, Pencil, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { colorForSubject, assignSubjectColor } from '@/lib/subjectColors';
import { formatDisplayName } from '@/lib/displayName';

// ── Types ─────────────────────────────────────────────────────────────────────
// Department → Year → Division, mirroring school's Standard → Division, just
// with one extra level in between. Subjects live on Year (same spot as
// Standard held them for school) — Division then picks a subset of that pool,
// same divisionSubjects pattern as school.

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

interface DivisionRecord {
    id: string;
    name: string;
    capacity: number | null;
    studentCount: number;
    divisionSubjects: { subjectId: string }[];
    assignments: Assignment[];
}

interface YearRecord {
    id: string;
    name: string;
    order: number;
    subjects: Subject[];
    divisions: DivisionRecord[];
}

interface DepartmentRecord {
    id: string;
    name: string;
    order: number;
    years: YearRecord[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getClassTeacher(div: DivisionRecord): string | null {
    const ct = div.assignments.find(a => a.subjectId === null);
    if (!ct?.teacher.user.name) return null;
    return formatDisplayName(ct.teacher.user.name, ct.teacher.prefix);
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
// NOTE: this assumes a backend contract that mirrors /admin/campus/standards
// one level deeper — /admin/campus/departments, /admin/campus/departments/:id/years,
// /admin/campus/years/:id/divisions, /admin/campus/years/:id/subjects. Backend
// for this doesn't exist yet (frontend-first, per plan) — wire these up once
// the real endpoints land.

export default function DepartmentsPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'ADMIN';
    const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
    const [expandedYearId, setExpandedYearId] = useState<string | null>(null);
    const [addingDivision, setAddingDivision] = useState<string | null>(null);
    const [addingDepartment, setAddingDepartment] = useState(false);
    const [addingYear, setAddingYear] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const fetchedRef = useRef(false);
    const [addingSubject, setAddingSubject] = useState<string | null>(null);
    const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<{ id: string; name: string; yearId: string } | null>(null);

    // Rename (edit) state — one entity editable at a time, across all 3 levels
    type EditTarget =
        | { type: 'department'; id: string }
        | { type: 'year'; departmentId: string; id: string }
        | { type: 'division'; departmentId: string; yearId: string; id: string };
    const [editing, setEditing] = useState<EditTarget | null>(null);
    const [editValue, setEditValue] = useState('');

    // Delete confirmation — same idea, one pending delete at a time
    type DeleteTarget =
        | { type: 'department'; id: string; name: string }
        | { type: 'year'; departmentId: string; id: string; name: string }
        | { type: 'division'; departmentId: string; yearId: string; id: string; name: string };
    const [confirmDeleteEntity, setConfirmDeleteEntity] = useState<DeleteTarget | null>(null);

    // ── TEMPORARY LOCAL MOCK ─────────────────────────────────────────────────
    // The real backend for Department/Year/Division doesn't exist yet (see
    // the endpoint list noted for whoever builds it: POST /admin/campus/
    // departments, /admin/campus/departments/:id/years, /admin/campus/years/
    // :id/divisions, /admin/campus/years/:id/subjects, DELETE .../subjects/:id,
    // PATCH .../subjects/reorder). Until then everything here just reads/
    // writes localStorage so the flow can be clicked through end-to-end —
    // swap each function body back to the commented-out api.* calls once the
    // real endpoints exist, the state-shape logic around them doesn't change.
    const MOCK_KEY = 'qubeex:mockDepartments';
    const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const persistMock = (depts: DepartmentRecord[]) => {
        try { window.localStorage.setItem(MOCK_KEY, JSON.stringify(depts)); } catch { /* ignore */ }
    };

    const fetchDepartments = useCallback(async () => {
        try {
            const raw = window.localStorage.getItem(MOCK_KEY);
            setDepartments(raw ? JSON.parse(raw) : []);
        } catch {
            setDepartments([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchDepartments();
    }, [fetchDepartments]);

    const addDepartment = async (name: string) => {
        setSaving(true);
        const newDept: DepartmentRecord = { id: uid(), name, order: departments.length, years: [] };
        setDepartments(prev => {
            const next = [...prev, newDept];
            persistMock(next);
            return next;
        });
        setAddingDepartment(false);
        setExpandedDeptId(newDept.id);
        toast.success('Department added');
        setSaving(false);
    };

    const addYear = async (departmentId: string, name: string) => {
        setSaving(true);
        const newYear: YearRecord = { id: uid(), name, order: 0, subjects: [], divisions: [] };
        setDepartments(prev => {
            const next = prev.map(d => d.id !== departmentId ? d : { ...d, years: [...d.years, newYear] });
            persistMock(next);
            return next;
        });
        setAddingYear(null);
        setExpandedYearId(newYear.id);
        toast.success('Year added');
        setSaving(false);
    };

    const addDivision = async (departmentId: string, yearId: string, name: string) => {
        setSaving(true);
        const newDiv: DivisionRecord = { id: uid(), name, capacity: null, studentCount: 0, divisionSubjects: [], assignments: [] };
        setDepartments(prev => {
            const next = prev.map(d => d.id !== departmentId ? d : {
                ...d,
                years: d.years.map(y => y.id !== yearId ? y : { ...y, divisions: [...y.divisions, newDiv] }),
            });
            persistMock(next);
            return next;
        });
        setAddingDivision(null);
        toast.success('Division added');
        setSaving(false);
    };

    const addSubject = async (departmentId: string, yearId: string, name: string) => {
        setSaving(true);
        setDepartments(prev => {
            const next = prev.map(d => {
                if (d.id !== departmentId) return d;
                return {
                    ...d,
                    years: d.years.map(y => {
                        if (y.id !== yearId) return y;
                        // Assign the next color in the same fixed sequence school
                        // uses (SUBJECT_PALETTE, by insertion index) instead of
                        // leaving color null — a null color falls back to a
                        // per-id hash, which looks random since these ids are
                        // random UUIDs, unlike school's colors which come from
                        // the backend already assigned in that same sequence.
                        const newSubject: Subject = { id: uid(), name, code: null, color: assignSubjectColor(y.subjects.length), order: y.subjects.length };
                        return { ...y, subjects: [...y.subjects, newSubject] };
                    }),
                };
            });
            persistMock(next);
            return next;
        });
        setAddingSubject(null);
        toast.success('Subject added');
        setSaving(false);
    };

    const deleteSubject = async (subjectId: string, departmentId: string, yearId: string) => {
        setDepartments(prev => {
            const next = prev.map(d => d.id !== departmentId ? d : {
                ...d,
                years: d.years.map(y => y.id !== yearId ? y : {
                    ...y,
                    subjects: y.subjects.filter(sub => sub.id !== subjectId),
                    divisions: y.divisions.map(div => ({
                        ...div,
                        divisionSubjects: div.divisionSubjects.filter(ds => ds.subjectId !== subjectId),
                        assignments: div.assignments.filter(a => a.subjectId !== subjectId),
                    })),
                }),
            });
            persistMock(next);
            return next;
        });
        toast.success('Subject deleted');
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
    const saveEdit = () => {
        if (!editing || !editValue.trim()) return;
        const name = editValue.trim();
        setDepartments(prev => {
            let next = prev;
            if (editing.type === 'department') {
                next = prev.map(d => d.id !== editing.id ? d : { ...d, name });
            } else if (editing.type === 'year') {
                next = prev.map(d => d.id !== editing.departmentId ? d : {
                    ...d, years: d.years.map(y => y.id !== editing.id ? y : { ...y, name }),
                });
            } else {
                next = prev.map(d => d.id !== editing.departmentId ? d : {
                    ...d,
                    years: d.years.map(y => y.id !== editing.yearId ? y : {
                        ...y, divisions: y.divisions.map(div => div.id !== editing.id ? div : { ...div, name }),
                    }),
                });
            }
            persistMock(next);
            return next;
        });
        toast.success('Renamed');
        cancelEdit();
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const performEntityDelete = () => {
        if (!confirmDeleteEntity) return;
        const target = confirmDeleteEntity;
        setDepartments(prev => {
            let next = prev;
            if (target.type === 'department') {
                next = prev.filter(d => d.id !== target.id);
            } else if (target.type === 'year') {
                next = prev.map(d => d.id !== target.departmentId ? d : {
                    ...d, years: d.years.filter(y => y.id !== target.id),
                });
            } else {
                next = prev.map(d => d.id !== target.departmentId ? d : {
                    ...d,
                    years: d.years.map(y => y.id !== target.yearId ? y : {
                        ...y, divisions: y.divisions.filter(div => div.id !== target.id),
                    }),
                });
            }
            persistMock(next);
            return next;
        });
        if (target.type === 'department' && expandedDeptId === target.id) setExpandedDeptId(null);
        if (target.type === 'year' && expandedYearId === target.id) setExpandedYearId(null);
        toast.success(`${target.type === 'department' ? 'Department' : target.type === 'year' ? 'Year' : 'Division'} deleted`);
        setConfirmDeleteEntity(null);
    };

    const [dragSubjectId, setDragSubjectId] = useState<string | null>(null);
    // Native HTML5 drag makes the WHOLE element a drag source the moment
    // draggable=true — there's no built-in way to restrict the pickup point to
    // just the grip icon. So `draggable` only flips to true while the pointer
    // is actually held down on the grip icon (dragReady), instead of being
    // true for the pill at all times.
    const [dragReady, setDragReady] = useState(false);

    const reorderSubjects = async (departmentId: string, yearId: string, orderedIds: string[]) => {
        setDepartments(prev => {
            const next = prev.map(d => d.id !== departmentId ? d : {
                ...d,
                years: d.years.map(y => y.id !== yearId ? y : {
                    ...y,
                    // Recolor by the new position too — same as school, where the
                    // backend reassigns colors on reorder so the palette always
                    // reads left-to-right in the same fixed sequence.
                    subjects: orderedIds
                        .map(id => y.subjects.find(sub => sub.id === id))
                        .filter((sub): sub is Subject => !!sub)
                        .map((sub, i) => ({ ...sub, color: assignSubjectColor(i) })),
                }),
            });
            persistMock(next);
            return next;
        });
    };

    const handleSubjectDrop = (departmentId: string, yearId: string, targetSubjectId: string) => {
        const draggedId = dragSubjectId;
        setDragSubjectId(null);
        if (!draggedId || draggedId === targetSubjectId) return;
        const dept = departments.find(d => d.id === departmentId);
        const year = dept?.years.find(y => y.id === yearId);
        if (!year) return;
        const ids = year.subjects.map(s => s.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetSubjectId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderSubjects(departmentId, yearId, newIds);
    };

    // ── Drag & drop reorder — Departments, Years, Divisions ─────────────────────
    // Same pattern as subject reordering above: track the dragged id, splice it
    // to the drop target's index on drop, persist the new order to the mock.
    const [dragDeptId, setDragDeptId] = useState<string | null>(null);
    const [dragYearId, setDragYearId] = useState<string | null>(null);
    const [dragDivisionId, setDragDivisionId] = useState<string | null>(null);
    // Same reasoning as the subject pills — draggable only flips on while the
    // pointer is held down on that card's grip icon, so dragging can't start
    // by grabbing anywhere else on the card (which would fight with the
    // expand/edit/delete click targets covering most of it).
    const [deptDragReady, setDeptDragReady] = useState(false);
    const [yearDragReady, setYearDragReady] = useState(false);
    const [divDragReady, setDivDragReady] = useState(false);

    const reorderDepartments = (orderedIds: string[]) => {
        setDepartments(prev => {
            const next = orderedIds
                .map(id => prev.find(d => d.id === id))
                .filter((d): d is DepartmentRecord => !!d);
            persistMock(next);
            return next;
        });
    };

    const handleDeptDrop = (targetDeptId: string) => {
        const draggedId = dragDeptId;
        setDragDeptId(null);
        if (!draggedId || draggedId === targetDeptId) return;
        const ids = departments.map(d => d.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetDeptId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderDepartments(newIds);
    };

    const reorderYears = (departmentId: string, orderedIds: string[]) => {
        setDepartments(prev => {
            const next = prev.map(d => d.id !== departmentId ? d : {
                ...d,
                years: orderedIds
                    .map(id => d.years.find(y => y.id === id))
                    .filter((y): y is YearRecord => !!y),
            });
            persistMock(next);
            return next;
        });
    };

    const handleYearDrop = (departmentId: string, targetYearId: string) => {
        const draggedId = dragYearId;
        setDragYearId(null);
        if (!draggedId || draggedId === targetYearId) return;
        const dept = departments.find(d => d.id === departmentId);
        if (!dept) return;
        const ids = dept.years.map(y => y.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetYearId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderYears(departmentId, newIds);
    };

    const reorderDivisions = (departmentId: string, yearId: string, orderedIds: string[]) => {
        setDepartments(prev => {
            const next = prev.map(d => d.id !== departmentId ? d : {
                ...d,
                years: d.years.map(y => y.id !== yearId ? y : {
                    ...y,
                    divisions: orderedIds
                        .map(id => y.divisions.find(div => div.id === id))
                        .filter((div): div is DivisionRecord => !!div),
                }),
            });
            persistMock(next);
            return next;
        });
    };

    const handleDivisionDrop = (departmentId: string, yearId: string, targetDivisionId: string) => {
        const draggedId = dragDivisionId;
        setDragDivisionId(null);
        if (!draggedId || draggedId === targetDivisionId) return;
        const dept = departments.find(d => d.id === departmentId);
        const year = dept?.years.find(y => y.id === yearId);
        if (!year) return;
        const ids = year.divisions.map(div => div.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetDivisionId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderDivisions(departmentId, yearId, newIds);
    };

    const totalYears = departments.reduce((n, d) => n + d.years.length, 0);
    const totalDivisions = departments.reduce((n, d) => n + d.years.reduce((m, y) => m + y.divisions.length, 0), 0);
    const gradients = [
        'linear-gradient(135deg, #2F6AE6, #5B8DEF)',
        'linear-gradient(135deg, #0891B2, #38BDF8)',
        'linear-gradient(135deg, #7C3AED, #9F67FF)',
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
                            <Building2 size={21} />
                            Departments
                        </h1>
                        <p className="text-[13px] text-muted-foreground">
                            {departments.length} departments · {totalYears} years · {totalDivisions} divisions
                        </p>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => setAddingDepartment(true)}
                            className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all w-fit"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Plus size={15} /> Add Department
                        </button>
                    )}
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Departments list */}
            <div className="flex-1 overflow-y-auto px-1 pb-6 pt-3 space-y-3">

                {loading && (
                    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                        Loading...
                    </div>
                )}

                {!loading && departments.length === 0 && !addingDepartment && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                            <Building2 size={22} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No departments yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Click &ldquo;Add Department&rdquo; to get started</p>
                    </div>
                )}

                {isAdmin && addingDepartment && (
                    <div className="bg-card border border-primary/30 rounded-2xl px-5 py-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-3">New Department</p>
                        <InlineAddInput
                            placeholder="e.g. Computer Engineering"
                            onAdd={addDepartment}
                            onCancel={() => setAddingDepartment(false)}
                            loading={saving}
                        />
                    </div>
                )}

                {departments.map((dept, idx) => {
                    const isDeptExpanded = expandedDeptId === dept.id;
                    const grad = gradients[idx % gradients.length];
                    const totalDeptStudents = dept.years.reduce((sum, y) => sum + y.divisions.reduce((s, div) => s + div.studentCount, 0), 0);

                    return (
                        <div key={dept.id}
                            draggable={isAdmin && deptDragReady}
                            onDragStart={() => setDragDeptId(dept.id)}
                            onDragOver={(e) => isAdmin && e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); handleDeptDrop(dept.id); }}
                            onDragEnd={() => { setDragDeptId(null); setDeptDragReady(false); }}
                            className={`bg-card border border-border/50 rounded-2xl overflow-hidden transition-opacity ${dragDeptId === dept.id ? 'opacity-40' : ''}`}>

                            {/* Department header */}
                            <div className="group/dept w-full flex items-center justify-between px-3 sm:px-5 py-4 hover:bg-muted/20 transition-colors">
                                {isAdmin && (
                                    <GripVertical
                                        size={15}
                                        className="text-muted-foreground/40 shrink-0 opacity-0 group-hover/dept:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mr-1"
                                        onMouseDown={() => setDeptDragReady(true)}
                                        onMouseUp={() => setDeptDragReady(false)}
                                    />
                                )}
                                <button
                                    onClick={() => setExpandedDeptId(isDeptExpanded ? null : dept.id)}
                                    disabled={editing?.type === 'department' && editing.id === dept.id}
                                    className="flex items-center gap-3 flex-1 min-w-0 text-left">
                                    <div
                                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black text-white shrink-0"
                                        style={{ background: grad }}>
                                        {dept.name.replace(/[^0-9A-Za-z]/g, '').slice(0, 2) || dept.name[0]}
                                    </div>
                                    {editing?.type === 'department' && editing.id === dept.id ? (
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
                                            <p className="text-sm font-bold truncate">{dept.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span className="text-[11px] text-muted-foreground">{dept.years.length} years</span>
                                                <span className="text-muted-foreground/40 text-[11px]">·</span>
                                                <span className="text-[11px] text-muted-foreground">{totalDeptStudents} students</span>
                                            </div>
                                        </div>
                                    )}
                                </button>

                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {isAdmin && editing?.type === 'department' && editing.id === dept.id ? (
                                        <>
                                            <button onClick={saveEdit}
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
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover/dept:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => startEdit({ type: 'department', id: dept.id }, dept.name)}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                                                        <Pencil size={13} className="text-muted-foreground" />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeleteEntity({ type: 'department', id: dept.id, name: dept.name })}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                                        <Trash2 size={13} className="text-red-500" />
                                                    </button>
                                                </div>
                                            )}
                                            <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${isDeptExpanded ? 'rotate-180' : ''}`} />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Expanded — Years */}
                            <AnimatePresence>
                                {isDeptExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden">
                                        <div className="border-t border-border/40 px-3 sm:px-5 py-4 space-y-3">

                                            {dept.years.length === 0 && !addingYear && (
                                                <p className="text-xs text-muted-foreground/60 italic">No years yet</p>
                                            )}

                                            {dept.years.map((year) => {
                                                const isYearExpanded = expandedYearId === year.id;
                                                const totalYearStudents = year.divisions.reduce((s, div) => s + div.studentCount, 0);

                                                return (
                                                    <div key={year.id}
                                                        draggable={isAdmin && yearDragReady}
                                                        onDragStart={() => setDragYearId(year.id)}
                                                        onDragOver={(e) => isAdmin && e.preventDefault()}
                                                        onDrop={(e) => { e.preventDefault(); handleYearDrop(dept.id, year.id); }}
                                                        onDragEnd={() => { setDragYearId(null); setYearDragReady(false); }}
                                                        className={`rounded-xl border border-border/50 overflow-hidden bg-background transition-opacity ${dragYearId === year.id ? 'opacity-40' : ''}`}>

                                                        {/* Year header */}
                                                        <div className="group/year w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                                                            {isAdmin && (
                                                                <GripVertical
                                                                    size={13}
                                                                    className="text-muted-foreground/40 shrink-0 opacity-0 group-hover/year:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mr-1"
                                                                    onMouseDown={() => setYearDragReady(true)}
                                                                    onMouseUp={() => setYearDragReady(false)}
                                                                />
                                                            )}
                                                            <button
                                                                onClick={() => setExpandedYearId(isYearExpanded ? null : year.id)}
                                                                disabled={editing?.type === 'year' && editing.id === year.id}
                                                                className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border-2 border-white/20"
                                                                    style={{ background: grad }}>
                                                                    <span className="text-xs font-black text-white">{year.name.slice(0, 2).toUpperCase()}</span>
                                                                </div>
                                                                {editing?.type === 'year' && editing.id === year.id ? (
                                                                    <input
                                                                        autoFocus
                                                                        value={editValue}
                                                                        onChange={e => setEditValue(e.target.value)}
                                                                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-[13px] font-bold focus:outline-none focus:border-primary transition-all w-40"
                                                                    />
                                                                ) : (
                                                                    <div className="min-w-0">
                                                                        <p className="text-[13px] font-bold truncate">{year.name}</p>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <span className="text-[10px] text-muted-foreground">{year.divisions.length} divisions</span>
                                                                            <span className="text-muted-foreground/40 text-[10px]">·</span>
                                                                            <span className="text-[10px] text-muted-foreground">{totalYearStudents} students</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </button>

                                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                {isAdmin && editing?.type === 'year' && editing.id === year.id ? (
                                                                    <>
                                                                        <button onClick={saveEdit}
                                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                                                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                                            <Check size={12} />
                                                                        </button>
                                                                        <button onClick={cancelEdit}
                                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                                            <X size={12} />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {isAdmin && (
                                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover/year:opacity-100 transition-opacity">
                                                                                <button
                                                                                    onClick={() => startEdit({ type: 'year', departmentId: dept.id, id: year.id }, year.name)}
                                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                                                                                    <Pencil size={12} className="text-muted-foreground" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setConfirmDeleteEntity({ type: 'year', departmentId: dept.id, id: year.id, name: year.name })}
                                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                                                                    <Trash2 size={12} className="text-red-500" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isYearExpanded ? 'rotate-180' : ''}`} />
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Expanded — Subjects + Divisions */}
                                                        <AnimatePresence>
                                                            {isYearExpanded && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    transition={{ duration: 0.2 }}
                                                                    className="overflow-hidden">
                                                                    <div className="border-t border-border/40 px-4 py-3 space-y-4">

                                                                        {/* Subjects */}
                                                                        <div>
                                                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                                                                                Subjects
                                                                            </p>
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                {(year.subjects ?? []).map((sub) => (
                                                                                    <span key={sub.id}
                                                                                        draggable={isAdmin && dragReady}
                                                                                        onDragStart={() => setDragSubjectId(sub.id)}
                                                                                        onDragOver={(e) => isAdmin && e.preventDefault()}
                                                                                        onDrop={(e) => { e.preventDefault(); handleSubjectDrop(dept.id, year.id, sub.id); }}
                                                                                        onDragEnd={() => { setDragSubjectId(null); setDragReady(false); }}
                                                                                        className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-full text-xs font-medium transition-opacity ${dragSubjectId === sub.id ? 'opacity-40' : ''}`}
                                                                                        style={{
                                                                                            background: colorForSubject(sub) + '20',
                                                                                            color: colorForSubject(sub),
                                                                                            border: `1px solid ${colorForSubject(sub)}40`,
                                                                                        }}>
                                                                                        {isAdmin && (
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
                                                                                                onClick={() => setConfirmDeleteSubject({ id: sub.id, name: sub.name, yearId: year.id })}
                                                                                                className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all">
                                                                                                <X size={9} />
                                                                                            </button>
                                                                                        )}
                                                                                    </span>
                                                                                ))}
                                                                                {(year.subjects ?? []).length === 0 && (
                                                                                    <span className="text-xs text-muted-foreground/60 italic">No subjects yet</span>
                                                                                )}
                                                                                {isAdmin && (addingSubject === year.id ? (
                                                                                    <InlineAddInput
                                                                                        placeholder="Subject name"
                                                                                        onAdd={name => addSubject(dept.id, year.id, name)}
                                                                                        onCancel={() => setAddingSubject(null)}
                                                                                        loading={saving}
                                                                                    />
                                                                                ) : (
                                                                                    <button onClick={() => setAddingSubject(year.id)}
                                                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                                                                                        <Plus size={11} /> Add subject
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>

                                                                        {/* Division cards */}
                                                                        {year.divisions.length > 0 && (
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                                {year.divisions.map((div, divIdx) => {
                                                                                    const classTeacherName = getClassTeacher(div);

                                                                                    return (
                                                                                        <motion.div
                                                                                            key={div.id}
                                                                                            initial={{ opacity: 0, y: 20 }}
                                                                                            animate={{ opacity: 1, y: 0 }}
                                                                                            transition={{ delay: divIdx * 0.05, duration: 0.3 }}
                                                                                            draggable={isAdmin && divDragReady}
                                                                                            onDragStart={() => setDragDivisionId(div.id)}
                                                                                            onDragOver={(e) => isAdmin && e.preventDefault()}
                                                                                            onDrop={(e) => { e.preventDefault(); handleDivisionDrop(dept.id, year.id, div.id); }}
                                                                                            onDragEnd={() => { setDragDivisionId(null); setDivDragReady(false); }}
                                                                                            className={`group/divcard rounded-2xl border border-border/50 overflow-hidden flex flex-col bg-card hover:shadow-md hover:shadow-black/5 hover:border-border transition-all duration-200 ${dragDivisionId === div.id ? 'opacity-40' : ''}`}>

                                                                                            <div className="px-4 pt-4 pb-3">
                                                                                                <div className="flex items-center justify-between mb-2 gap-2">
                                                                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                                                        {isAdmin && (
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
                                                                                                        {editing?.type === 'division' && editing.id === div.id ? (
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
                                                                                                        {isAdmin && editing?.type === 'division' && editing.id === div.id ? (
                                                                                                            <>
                                                                                                                <button onClick={saveEdit}
                                                                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
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
                                                                                                                            onClick={() => startEdit({ type: 'division', departmentId: dept.id, yearId: year.id, id: div.id }, div.name)}
                                                                                                                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                                                                                                                            <Pencil size={13} className="text-muted-foreground" />
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={() => setConfirmDeleteEntity({ type: 'division', departmentId: dept.id, yearId: year.id, id: div.id, name: div.name })}
                                                                                                                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                                                                                                            <Trash2 size={13} className="text-red-500" />
                                                                                                                        </button>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                <div
                                                                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                                                                                                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                                                                                                    onClick={() => router.push(`/admin/campus/departments/${dept.id}/${year.id}/${div.id}`)}>
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
                                                                                                        const selectedSubs = year.subjects.filter(s => selectedIds.has(s.id));
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

                                                                        {year.divisions.length === 0 && (
                                                                            <p className="text-xs text-muted-foreground/60 italic">No divisions yet</p>
                                                                        )}

                                                                        {/* Add division — ADMIN only */}
                                                                        {isAdmin && (addingDivision === year.id ? (
                                                                            <InlineAddInput
                                                                                placeholder={`e.g. ${year.name}-A`}
                                                                                onAdd={name => addDivision(dept.id, year.id, name)}
                                                                                onCancel={() => setAddingDivision(null)}
                                                                                loading={saving}
                                                                            />
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => setAddingDivision(year.id)}
                                                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                                                                                <Plus size={11} /> Add Division
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                );
                                            })}

                                            {/* Add year — ADMIN only */}
                                            {isAdmin && (addingYear === dept.id ? (
                                                <InlineAddInput
                                                    placeholder="e.g. First Year (FE)"
                                                    onAdd={name => addYear(dept.id, name)}
                                                    onCancel={() => setAddingYear(null)}
                                                    loading={saving}
                                                />
                                            ) : (
                                                <button
                                                    onClick={() => setAddingYear(dept.id)}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                                                    <Plus size={11} /> Add Year
                                                </button>
                                            ))}
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
                                <span className="font-semibold text-foreground">{confirmDeleteSubject.name}</span> will be removed from this year and all its divisions. Teacher assignments for this subject will also be removed.
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmDeleteSubject(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => {
                                    const dept = departments.find(d => d.years.some(y => y.id === confirmDeleteSubject.yearId));
                                    if (dept) deleteSubject(confirmDeleteSubject.id, dept.id, confirmDeleteSubject.yearId);
                                    setConfirmDeleteSubject(null);
                                }}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white bg-red-500 hover:opacity-90 transition-all">
                                    Yes, Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {confirmDeleteEntity && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                            <h3 className="text-base font-bold mb-2">
                                Delete {confirmDeleteEntity.type === 'department' ? 'Department' : confirmDeleteEntity.type === 'year' ? 'Year' : 'Division'}?
                            </h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                <span className="font-semibold text-foreground">{confirmDeleteEntity.name}</span>{' '}
                                {confirmDeleteEntity.type === 'department' && 'will be removed along with all its years, divisions and subjects.'}
                                {confirmDeleteEntity.type === 'year' && 'will be removed along with all its divisions and subjects.'}
                                {confirmDeleteEntity.type === 'division' && 'will be removed. Student data linked to this division may be affected.'}
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmDeleteEntity(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={performEntityDelete}
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
