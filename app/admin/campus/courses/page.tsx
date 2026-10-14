'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ChevronLeft, ChevronRight, Plus, Check, X, BookOpen,
    ArrowUpRight, GripVertical, GraduationCap, LayoutGrid, Pencil, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { colorForSubject, assignSubjectColor } from '@/lib/subjectColors';
import { formatDisplayName } from '@/lib/displayName';

// ── Types ─────────────────────────────────────────────────────────────────────
// Course → Department → Year → Semester → Division. Subjects live on Semester
// (the level immediately above Division) — same spot school's Standard held
// them, since the reused division-workspace components only know "the level
// one above Division", not our specific level names.

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

interface SemesterRecord {
    id: string;
    name: string;
    order: number;
    subjects: Subject[];
    divisions: DivisionRecord[];
}

interface YearRecord {
    id: string;
    name: string;
    order: number;
    semesters: SemesterRecord[];
}

interface DepartmentRecord {
    id: string;
    name: string;
    order: number;
    years: YearRecord[];
}

interface CourseRecord {
    id: string;
    name: string;
    order: number;
    departments: DepartmentRecord[];
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
// one level deeper each — /admin/campus/courses, .../courses/:id/departments,
// .../departments/:id/years, .../years/:id/semesters,
// .../semesters/:id/divisions, .../semesters/:id/subjects. Backend for this
// doesn't exist yet (frontend-first, per plan) — wire these up once the real
// endpoints land.

export default function CoursesPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'ADMIN';
    const [courses, setCourses] = useState<CourseRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

    // Course strip scroll — the strip can overflow horizontally once there
    // are enough courses (the page's global CSS hides scrollbars everywhere,
    // so without these arrows there'd be no visible way to tell more courses
    // exist off-screen, let alone reach them without a trackpad/shift+wheel).
    const stripRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const updateStripScrollState = useCallback(() => {
        const el = stripRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);
    useEffect(() => {
        updateStripScrollState();
        const el = stripRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateStripScrollState);
        window.addEventListener('resize', updateStripScrollState);
        return () => {
            el.removeEventListener('scroll', updateStripScrollState);
            window.removeEventListener('resize', updateStripScrollState);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courses.length]);
    const scrollStrip = (dir: 'left' | 'right') => {
        const el = stripRef.current;
        if (!el) return;
        const amount = Math.max(160, el.clientWidth * 0.7);
        el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    };
    const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
    const [expandedYearId, setExpandedYearId] = useState<string | null>(null);
    const [expandedSemId, setExpandedSemId] = useState<string | null>(null);

    const [addingCourse, setAddingCourse] = useState(false);
    const [addingDepartment, setAddingDepartment] = useState<string | null>(null);
    const [addingYear, setAddingYear] = useState<string | null>(null);
    const [addingSemester, setAddingSemester] = useState<string | null>(null);
    const [addingDivision, setAddingDivision] = useState<string | null>(null);
    const [addingSubject, setAddingSubject] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const fetchedRef = useRef(false);
    const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<{ id: string; name: string; semesterId: string } | null>(null);

    // Rename (edit) state — one entity editable at a time, across all 5 levels
    type EditTarget =
        | { type: 'course'; id: string }
        | { type: 'department'; courseId: string; id: string }
        | { type: 'year'; courseId: string; departmentId: string; id: string }
        | { type: 'semester'; courseId: string; departmentId: string; yearId: string; id: string }
        | { type: 'division'; courseId: string; departmentId: string; yearId: string; semesterId: string; id: string };
    const [editing, setEditing] = useState<EditTarget | null>(null);
    const [editValue, setEditValue] = useState('');

    // Delete confirmation — same idea, one pending delete at a time
    type DeleteTarget =
        | { type: 'course'; id: string; name: string }
        | { type: 'department'; courseId: string; id: string; name: string }
        | { type: 'year'; courseId: string; departmentId: string; id: string; name: string }
        | { type: 'semester'; courseId: string; departmentId: string; yearId: string; id: string; name: string }
        | { type: 'division'; courseId: string; departmentId: string; yearId: string; semesterId: string; id: string; name: string };
    const [confirmDeleteEntity, setConfirmDeleteEntity] = useState<DeleteTarget | null>(null);

    // ── TEMPORARY LOCAL MOCK ─────────────────────────────────────────────────
    // The real backend for Course/Department/Year/Semester/Division doesn't
    // exist yet — until then everything here just reads/writes localStorage so
    // the flow can be clicked through end-to-end — swap each function body back
    // to the commented-out api.* calls once the real endpoints exist, the
    // state-shape logic around them doesn't change.
    const MOCK_KEY = 'qubeex:mockCourses';
    const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const persistMock = (next: CourseRecord[]) => {
        try { window.localStorage.setItem(MOCK_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    };

    const fetchCourses = useCallback(async () => {
        try {
            const raw = window.localStorage.getItem(MOCK_KEY);
            setCourses(raw ? JSON.parse(raw) : []);
        } catch {
            setCourses([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchCourses();
    }, [fetchCourses]);

    // Default to the first course once the list loads (or if the previously
    // selected one no longer exists) — the strip always needs something
    // selected below it, unlike the old per-course accordion which could
    // leave everything collapsed.
    useEffect(() => {
        if (loading) return;
        if (courses.length === 0) { setSelectedCourseId(null); return; }
        if (!courses.some(c => c.id === selectedCourseId)) setSelectedCourseId(courses[0].id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, courses]);

    // ── Add ───────────────────────────────────────────────────────────────────
    const addCourse = async (name: string) => {
        setSaving(true);
        const newCourse: CourseRecord = { id: uid(), name, order: courses.length, departments: [] };
        setCourses(prev => {
            const next = [...prev, newCourse];
            persistMock(next);
            return next;
        });
        setAddingCourse(false);
        setSelectedCourseId(newCourse.id);
        toast.success('Course added');
        setSaving(false);
    };

    const addDepartment = async (courseId: string, name: string) => {
        setSaving(true);
        const newDept: DepartmentRecord = { id: uid(), name, order: 0, years: [] };
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : { ...c, departments: [...c.departments, newDept] });
            persistMock(next);
            return next;
        });
        setAddingDepartment(null);
        setExpandedDeptId(newDept.id);
        toast.success('Department added');
        setSaving(false);
    };

    const addYear = async (courseId: string, departmentId: string, name: string) => {
        setSaving(true);
        const newYear: YearRecord = { id: uid(), name, order: 0, semesters: [] };
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : {
                ...c,
                departments: c.departments.map(d => d.id !== departmentId ? d : { ...d, years: [...d.years, newYear] }),
            });
            persistMock(next);
            return next;
        });
        setAddingYear(null);
        setExpandedYearId(newYear.id);
        toast.success('Year added');
        setSaving(false);
    };

    const addSemester = async (courseId: string, departmentId: string, yearId: string, name: string) => {
        setSaving(true);
        const newSem: SemesterRecord = { id: uid(), name, order: 0, subjects: [], divisions: [] };
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : {
                ...c,
                departments: c.departments.map(d => d.id !== departmentId ? d : {
                    ...d,
                    years: d.years.map(y => y.id !== yearId ? y : { ...y, semesters: [...y.semesters, newSem] }),
                }),
            });
            persistMock(next);
            return next;
        });
        setAddingSemester(null);
        setExpandedSemId(newSem.id);
        toast.success('Semester added');
        setSaving(false);
    };

    const addDivision = async (courseId: string, departmentId: string, yearId: string, semesterId: string, name: string) => {
        setSaving(true);
        const newDiv: DivisionRecord = { id: uid(), name, capacity: null, studentCount: 0, divisionSubjects: [], assignments: [] };
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : {
                ...c,
                departments: c.departments.map(d => d.id !== departmentId ? d : {
                    ...d,
                    years: d.years.map(y => y.id !== yearId ? y : {
                        ...y,
                        semesters: y.semesters.map(s => s.id !== semesterId ? s : { ...s, divisions: [...s.divisions, newDiv] }),
                    }),
                }),
            });
            persistMock(next);
            return next;
        });
        setAddingDivision(null);
        toast.success('Division added');
        setSaving(false);
    };

    const addSubject = async (courseId: string, departmentId: string, yearId: string, semesterId: string, name: string) => {
        setSaving(true);
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : {
                ...c,
                departments: c.departments.map(d => d.id !== departmentId ? d : {
                    ...d,
                    years: d.years.map(y => y.id !== yearId ? y : {
                        ...y,
                        semesters: y.semesters.map(s => {
                            if (s.id !== semesterId) return s;
                            const newSubject: Subject = { id: uid(), name, code: null, color: assignSubjectColor(s.subjects.length), order: s.subjects.length };
                            return { ...s, subjects: [...s.subjects, newSubject] };
                        }),
                    }),
                }),
            });
            persistMock(next);
            return next;
        });
        setAddingSubject(null);
        toast.success('Subject added');
        setSaving(false);
    };

    const deleteSubject = async (subjectId: string, courseId: string, departmentId: string, yearId: string, semesterId: string) => {
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : {
                ...c,
                departments: c.departments.map(d => d.id !== departmentId ? d : {
                    ...d,
                    years: d.years.map(y => y.id !== yearId ? y : {
                        ...y,
                        semesters: y.semesters.map(s => s.id !== semesterId ? s : {
                            ...s,
                            subjects: s.subjects.filter(sub => sub.id !== subjectId),
                            divisions: s.divisions.map(div => ({
                                ...div,
                                divisionSubjects: div.divisionSubjects.filter(ds => ds.subjectId !== subjectId),
                                assignments: div.assignments.filter(a => a.subjectId !== subjectId),
                            })),
                        }),
                    }),
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
        setCourses(prev => {
            let next = prev;
            if (editing.type === 'course') {
                next = prev.map(c => c.id !== editing.id ? c : { ...c, name });
            } else if (editing.type === 'department') {
                next = prev.map(c => c.id !== editing.courseId ? c : {
                    ...c, departments: c.departments.map(d => d.id !== editing.id ? d : { ...d, name }),
                });
            } else if (editing.type === 'year') {
                next = prev.map(c => c.id !== editing.courseId ? c : {
                    ...c,
                    departments: c.departments.map(d => d.id !== editing.departmentId ? d : {
                        ...d, years: d.years.map(y => y.id !== editing.id ? y : { ...y, name }),
                    }),
                });
            } else if (editing.type === 'semester') {
                next = prev.map(c => c.id !== editing.courseId ? c : {
                    ...c,
                    departments: c.departments.map(d => d.id !== editing.departmentId ? d : {
                        ...d,
                        years: d.years.map(y => y.id !== editing.yearId ? y : {
                            ...y, semesters: y.semesters.map(s => s.id !== editing.id ? s : { ...s, name }),
                        }),
                    }),
                });
            } else {
                next = prev.map(c => c.id !== editing.courseId ? c : {
                    ...c,
                    departments: c.departments.map(d => d.id !== editing.departmentId ? d : {
                        ...d,
                        years: d.years.map(y => y.id !== editing.yearId ? y : {
                            ...y,
                            semesters: y.semesters.map(s => s.id !== editing.semesterId ? s : {
                                ...s, divisions: s.divisions.map(div => div.id !== editing.id ? div : { ...div, name }),
                            }),
                        }),
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
        setCourses(prev => {
            let next = prev;
            if (target.type === 'course') {
                next = prev.filter(c => c.id !== target.id);
            } else if (target.type === 'department') {
                next = prev.map(c => c.id !== target.courseId ? c : {
                    ...c, departments: c.departments.filter(d => d.id !== target.id),
                });
            } else if (target.type === 'year') {
                next = prev.map(c => c.id !== target.courseId ? c : {
                    ...c,
                    departments: c.departments.map(d => d.id !== target.departmentId ? d : {
                        ...d, years: d.years.filter(y => y.id !== target.id),
                    }),
                });
            } else if (target.type === 'semester') {
                next = prev.map(c => c.id !== target.courseId ? c : {
                    ...c,
                    departments: c.departments.map(d => d.id !== target.departmentId ? d : {
                        ...d,
                        years: d.years.map(y => y.id !== target.yearId ? y : {
                            ...y, semesters: y.semesters.filter(s => s.id !== target.id),
                        }),
                    }),
                });
            } else {
                next = prev.map(c => c.id !== target.courseId ? c : {
                    ...c,
                    departments: c.departments.map(d => d.id !== target.departmentId ? d : {
                        ...d,
                        years: d.years.map(y => y.id !== target.yearId ? y : {
                            ...y,
                            semesters: y.semesters.map(s => s.id !== target.semesterId ? s : {
                                ...s, divisions: s.divisions.filter(div => div.id !== target.id),
                            }),
                        }),
                    }),
                });
            }
            persistMock(next);
            return next;
        });
        if (target.type === 'course' && selectedCourseId === target.id) setSelectedCourseId(null);
        if (target.type === 'department' && expandedDeptId === target.id) setExpandedDeptId(null);
        if (target.type === 'year' && expandedYearId === target.id) setExpandedYearId(null);
        if (target.type === 'semester' && expandedSemId === target.id) setExpandedSemId(null);
        const label = target.type === 'course' ? 'Course' : target.type === 'department' ? 'Department' : target.type === 'year' ? 'Year' : target.type === 'semester' ? 'Semester' : 'Division';
        toast.success(`${label} deleted`);
        setConfirmDeleteEntity(null);
    };

    // ── Drag & drop reorder — Subjects ──────────────────────────────────────────
    const [dragSubjectId, setDragSubjectId] = useState<string | null>(null);
    const [dragReady, setDragReady] = useState(false);

    const reorderSubjects = async (courseId: string, departmentId: string, yearId: string, semesterId: string, orderedIds: string[]) => {
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : {
                ...c,
                departments: c.departments.map(d => d.id !== departmentId ? d : {
                    ...d,
                    years: d.years.map(y => y.id !== yearId ? y : {
                        ...y,
                        semesters: y.semesters.map(s => s.id !== semesterId ? s : {
                            ...s,
                            subjects: orderedIds
                                .map(id => s.subjects.find(sub => sub.id === id))
                                .filter((sub): sub is Subject => !!sub)
                                .map((sub, i) => ({ ...sub, color: assignSubjectColor(i) })),
                        }),
                    }),
                }),
            });
            persistMock(next);
            return next;
        });
    };

    const findSemester = (courseId: string, departmentId: string, yearId: string, semesterId: string): SemesterRecord | undefined => {
        const c = courses.find(c => c.id === courseId);
        const d = c?.departments.find(d => d.id === departmentId);
        const y = d?.years.find(y => y.id === yearId);
        return y?.semesters.find(s => s.id === semesterId);
    };

    const handleSubjectDrop = (courseId: string, departmentId: string, yearId: string, semesterId: string, targetSubjectId: string) => {
        const draggedId = dragSubjectId;
        setDragSubjectId(null);
        if (!draggedId || draggedId === targetSubjectId) return;
        const sem = findSemester(courseId, departmentId, yearId, semesterId);
        if (!sem) return;
        const ids = sem.subjects.map(s => s.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetSubjectId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderSubjects(courseId, departmentId, yearId, semesterId, newIds);
    };

    // ── Drag & drop reorder — Courses, Departments, Years, Semesters, Divisions ─
    // Track the dragged id, splice it to the drop target's index on drop,
    // persist the new order to the mock. `dragReady` flips true only while the
    // pointer is held down on that card's grip icon, so dragging can't start by
    // grabbing anywhere else on the card (which would fight with the
    // expand/edit/delete click targets covering most of it).
    const [dragCourseId, setDragCourseId] = useState<string | null>(null);
    const [dragDeptId, setDragDeptId] = useState<string | null>(null);
    const [dragYearId, setDragYearId] = useState<string | null>(null);
    const [dragSemId, setDragSemId] = useState<string | null>(null);
    const [dragDivisionId, setDragDivisionId] = useState<string | null>(null);
    const [courseDragReady, setCourseDragReady] = useState(false);
    const [deptDragReady, setDeptDragReady] = useState(false);
    const [yearDragReady, setYearDragReady] = useState(false);
    const [semDragReady, setSemDragReady] = useState(false);
    const [divDragReady, setDivDragReady] = useState(false);

    const reorderCourses = (orderedIds: string[]) => {
        setCourses(prev => {
            const next = orderedIds.map(id => prev.find(c => c.id === id)).filter((c): c is CourseRecord => !!c);
            persistMock(next);
            return next;
        });
    };
    const handleCourseDrop = (targetCourseId: string) => {
        const draggedId = dragCourseId;
        setDragCourseId(null);
        if (!draggedId || draggedId === targetCourseId) return;
        const ids = courses.map(c => c.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetCourseId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderCourses(newIds);
    };

    const reorderDepartments = (courseId: string, orderedIds: string[]) => {
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : {
                ...c, departments: orderedIds.map(id => c.departments.find(d => d.id === id)).filter((d): d is DepartmentRecord => !!d),
            });
            persistMock(next);
            return next;
        });
    };
    const handleDeptDrop = (courseId: string, targetDeptId: string) => {
        const draggedId = dragDeptId;
        setDragDeptId(null);
        if (!draggedId || draggedId === targetDeptId) return;
        const course = courses.find(c => c.id === courseId);
        if (!course) return;
        const ids = course.departments.map(d => d.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetDeptId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderDepartments(courseId, newIds);
    };

    const reorderYears = (courseId: string, departmentId: string, orderedIds: string[]) => {
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : {
                ...c,
                departments: c.departments.map(d => d.id !== departmentId ? d : {
                    ...d, years: orderedIds.map(id => d.years.find(y => y.id === id)).filter((y): y is YearRecord => !!y),
                }),
            });
            persistMock(next);
            return next;
        });
    };
    const handleYearDrop = (courseId: string, departmentId: string, targetYearId: string) => {
        const draggedId = dragYearId;
        setDragYearId(null);
        if (!draggedId || draggedId === targetYearId) return;
        const dept = courses.find(c => c.id === courseId)?.departments.find(d => d.id === departmentId);
        if (!dept) return;
        const ids = dept.years.map(y => y.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetYearId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderYears(courseId, departmentId, newIds);
    };

    const reorderSemesters = (courseId: string, departmentId: string, yearId: string, orderedIds: string[]) => {
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : {
                ...c,
                departments: c.departments.map(d => d.id !== departmentId ? d : {
                    ...d,
                    years: d.years.map(y => y.id !== yearId ? y : {
                        ...y, semesters: orderedIds.map(id => y.semesters.find(s => s.id === id)).filter((s): s is SemesterRecord => !!s),
                    }),
                }),
            });
            persistMock(next);
            return next;
        });
    };
    const handleSemDrop = (courseId: string, departmentId: string, yearId: string, targetSemId: string) => {
        const draggedId = dragSemId;
        setDragSemId(null);
        if (!draggedId || draggedId === targetSemId) return;
        const year = courses.find(c => c.id === courseId)?.departments.find(d => d.id === departmentId)?.years.find(y => y.id === yearId);
        if (!year) return;
        const ids = year.semesters.map(s => s.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetSemId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderSemesters(courseId, departmentId, yearId, newIds);
    };

    const reorderDivisions = (courseId: string, departmentId: string, yearId: string, semesterId: string, orderedIds: string[]) => {
        setCourses(prev => {
            const next = prev.map(c => c.id !== courseId ? c : {
                ...c,
                departments: c.departments.map(d => d.id !== departmentId ? d : {
                    ...d,
                    years: d.years.map(y => y.id !== yearId ? y : {
                        ...y,
                        semesters: y.semesters.map(s => s.id !== semesterId ? s : {
                            ...s, divisions: orderedIds.map(id => s.divisions.find(div => div.id === id)).filter((div): div is DivisionRecord => !!div),
                        }),
                    }),
                }),
            });
            persistMock(next);
            return next;
        });
    };
    const handleDivisionDrop = (courseId: string, departmentId: string, yearId: string, semesterId: string, targetDivisionId: string) => {
        const draggedId = dragDivisionId;
        setDragDivisionId(null);
        if (!draggedId || draggedId === targetDivisionId) return;
        const sem = findSemester(courseId, departmentId, yearId, semesterId);
        if (!sem) return;
        const ids = sem.divisions.map(div => div.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetDivisionId);
        if (fromIdx === -1 || toIdx === -1) return;
        const newIds = [...ids];
        newIds.splice(fromIdx, 1);
        newIds.splice(toIdx, 0, draggedId);
        reorderDivisions(courseId, departmentId, yearId, semesterId, newIds);
    };

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalDepartments = courses.reduce((n, c) => n + c.departments.length, 0);
    const totalYears = courses.reduce((n, c) => n + c.departments.reduce((m, d) => m + d.years.length, 0), 0);
    const totalSemesters = courses.reduce((n, c) => n + c.departments.reduce((m, d) => m + d.years.reduce((k, y) => k + y.semesters.length, 0), 0), 0);
    const totalDivisions = courses.reduce((n, c) => n + c.departments.reduce((m, d) => m + d.years.reduce((k, y) => k + y.semesters.reduce((j, s) => j + s.divisions.length, 0), 0), 0), 0);

    const gradients = [
        'linear-gradient(135deg, #2F6AE6, #5B8DEF)',
        'linear-gradient(135deg, #0891B2, #38BDF8)',
        'linear-gradient(135deg, #7C3AED, #9F67FF)',
        'linear-gradient(135deg, #059669, #34D399)',
        'linear-gradient(135deg, #D97706, #FCD34D)',
    ];

    return (
        <div className="flex flex-col h-full overflow-visible pb-3">

            {/* Header */}
            <div className="shrink-0 pt-0 pb-0 px-1 sticky top-0 z-20 bg-background">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h1 className="text-lg lg:text-xl font-bold flex items-center gap-2">
                            <LayoutGrid size={21} />
                            Courses
                        </h1>
                        <p className="text-[13px] text-muted-foreground">
                            {courses.length} courses · {totalDepartments} departments · {totalYears} years · {totalSemesters} semesters · {totalDivisions} divisions
                        </p>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => setAddingCourse(true)}
                            className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all w-fit"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Plus size={15} /> Add Course
                        </button>
                    )}
                </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {/* Course strip — a horizontal row of course pills, like the Feed/
                Classes tab bar above this page. Selecting one just swaps which
                course's department tree renders below; it's not another
                nested accordion level. */}
            <div className="shrink-0 pt-3 pb-1 px-1 relative">
                {/* Left fade + arrow — overlaid so it never shifts the pills'
                    layout when it appears/disappears, unlike an inline button
                    that takes up flex space. */}
                <div className={`absolute left-0 top-3 bottom-1 z-10 flex items-center pl-1 pr-4 transition-opacity duration-200 ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    style={{ background: 'linear-gradient(90deg, var(--background) 40%, transparent)' }}>
                    <button
                        onClick={() => scrollStrip('left')}
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-card border border-border/60 shadow-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                        <ChevronLeft size={14} />
                    </button>
                </div>

                <div ref={stripRef} className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                <div className="flex items-center gap-1.5 flex-nowrap w-max pr-14">
                    {courses.map((course, cIdx) => {
                        const isSelected = selectedCourseId === course.id;
                        const isEditingThis = editing?.type === 'course' && editing.id === course.id;
                        const pillColor = assignSubjectColor(cIdx);
                        return (
                            <div key={course.id}
                                draggable={isAdmin && courseDragReady && !isEditingThis}
                                onDragStart={() => setDragCourseId(course.id)}
                                onDragOver={(e) => isAdmin && e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); handleCourseDrop(course.id); }}
                                onDragEnd={() => { setDragCourseId(null); setCourseDragReady(false); }}
                                onClick={() => !isEditingThis && setSelectedCourseId(course.id)}
                                onMouseEnter={(e) => {
                                    // A selected pill grows on hover (grip handle + edit/delete
                                    // buttons reveal, ~60px extra width). If the pill is near the
                                    // right edge of the scrollable strip, that growth pushes past
                                    // the visible area and the new buttons land off-screen /
                                    // under the right fade overlay. Nudge the strip so there's
                                    // always room for the expansion before it happens.
                                    const stripEl = stripRef.current;
                                    if (!stripEl) return;
                                    const pillEl = e.currentTarget;
                                    const buffer = 64;
                                    const pillRight = pillEl.offsetLeft + pillEl.offsetWidth + buffer;
                                    const visibleRight = stripEl.scrollLeft + stripEl.clientWidth;
                                    if (pillRight > visibleRight) {
                                        stripEl.scrollTo({ left: pillRight - stripEl.clientWidth, behavior: 'smooth' });
                                    }
                                }}
                                className={`group/pill relative flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer transition-all shrink-0 ${dragCourseId === course.id ? 'opacity-40' : ''} ${isSelected ? '' : 'text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted border border-transparent'}`}
                                style={isSelected ? {
                                    background: pillColor + '30',
                                    color: pillColor,
                                    border: `1px solid ${pillColor}90`,
                                } : {}}>
                                {isAdmin && (
                                    <div className="flex items-center max-w-0 group-hover/pill:max-w-[14px] opacity-0 group-hover/pill:opacity-70 overflow-hidden transition-all duration-200">
                                        <GripVertical
                                            size={12}
                                            className="shrink-0 cursor-grab active:cursor-grabbing"
                                            onMouseDown={(e) => { e.stopPropagation(); setCourseDragReady(true); }}
                                            onMouseUp={() => setCourseDragReady(false)}
                                        />
                                    </div>
                                )}
                                {isEditingThis ? (
                                    <input
                                        autoFocus
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                        onClick={e => e.stopPropagation()}
                                        className="h-6 px-2 rounded-full border bg-background text-sm font-semibold focus:outline-none w-28"
                                        style={{ borderColor: pillColor, color: pillColor }}
                                    />
                                ) : (
                                    <span className="flex items-center gap-1.5">
                                        <GraduationCap size={16} />
                                        {course.name}
                                    </span>
                                )}
                                {isAdmin && isSelected && !isEditingThis && (
                                    <div className="flex items-center gap-0.5 max-w-0 group-hover/pill:max-w-[44px] ml-0 group-hover/pill:ml-0.5 opacity-0 group-hover/pill:opacity-100 overflow-hidden transition-all duration-200">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); startEdit({ type: 'course', id: course.id }, course.name); }}
                                            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/15 transition-colors shrink-0">
                                            <Pencil size={10} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteEntity({ type: 'course', id: course.id, name: course.name }); }}
                                            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/15 transition-colors shrink-0">
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                )}
                                {isEditingThis && (
                                    <div className="flex items-center gap-0.5">
                                        <button onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                                            className="w-5 h-5 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors">
                                            <Check size={10} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                                            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                                            <X size={10} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {isAdmin && addingCourse && (
                        <InlineAddInput
                            placeholder="e.g. BE, BTech, BCom"
                            onAdd={addCourse}
                            onCancel={() => setAddingCourse(false)}
                            loading={saving}
                        />
                    )}
                </div>
                </div>

                {/* Right fade + arrow — same overlay treatment. */}
                <div className={`absolute right-0 top-3 bottom-1 z-10 flex items-center justify-end pr-1 pl-4 transition-opacity duration-200 ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    style={{ background: 'linear-gradient(270deg, var(--background) 40%, transparent)' }}>
                    <button
                        onClick={() => scrollStrip('right')}
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-card border border-border/60 shadow-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Selected course's structure */}
            <div className="flex-1 overflow-y-auto px-1 pb-6 pt-3 space-y-3">

                {loading && (
                    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                        Loading...
                    </div>
                )}

                {!loading && courses.length === 0 && !addingCourse && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                            <GraduationCap size={22} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No courses yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Click &ldquo;Add Course&rdquo; above to get started</p>
                    </div>
                )}

                {!loading && courses.length > 0 && (() => {
                    const course = courses.find(c => c.id === selectedCourseId);
                    if (!course) return null;
                    const cIdx = courses.findIndex(c => c.id === selectedCourseId);
                    const cGrad = gradients[cIdx % gradients.length];

                    return (
                        <div className="space-y-3">

                                            {course.departments.length === 0 && !addingDepartment && (
                                                <p className="text-xs text-muted-foreground/60 italic">No departments yet</p>
                                            )}

                                            {course.departments.map((dept) => {
                                                const isDeptExpanded = expandedDeptId === dept.id;
                                                const totalDeptStudents = dept.years.reduce((n, y) => n + y.semesters.reduce((m, s) => m + s.divisions.reduce((j, div) => j + div.studentCount, 0), 0), 0);

                                                return (
                                                    <div key={dept.id}
                                                        draggable={isAdmin && deptDragReady}
                                                        onDragStart={() => setDragDeptId(dept.id)}
                                                        onDragOver={(e) => isAdmin && e.preventDefault()}
                                                        onDrop={(e) => { e.preventDefault(); handleDeptDrop(course.id, dept.id); }}
                                                        onDragEnd={() => { setDragDeptId(null); setDeptDragReady(false); }}
                                                        className={`rounded-xl border border-border/50 overflow-hidden bg-card transition-opacity ${dragDeptId === dept.id ? 'opacity-40' : ''}`} data-admin-surface="">

                                                        {/* Department header */}
                                                        <div className="group/dept w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                                                            {isAdmin && (
                                                                <GripVertical
                                                                    size={13}
                                                                    className="text-muted-foreground/40 shrink-0 opacity-0 group-hover/dept:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mr-1"
                                                                    onMouseDown={() => setDeptDragReady(true)}
                                                                    onMouseUp={() => setDeptDragReady(false)}
                                                                />
                                                            )}
                                                            <button
                                                                onClick={() => setExpandedDeptId(isDeptExpanded ? null : dept.id)}
                                                                disabled={editing?.type === 'department' && editing.id === dept.id}
                                                                className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border-2 border-white/20"
                                                                    style={{ background: cGrad }}>
                                                                    <span className="text-xs font-black text-white">{dept.name.replace(/[^0-9A-Za-z]/g, '').slice(0, 2) || dept.name[0]}</span>
                                                                </div>
                                                                {editing?.type === 'department' && editing.id === dept.id ? (
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
                                                                        <p className="text-[13px] font-bold truncate">{dept.name}</p>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <span className="text-[10px] text-muted-foreground">{dept.years.length} years</span>
                                                                            <span className="text-muted-foreground/40 text-[10px]">·</span>
                                                                            <span className="text-[10px] text-muted-foreground">{totalDeptStudents} students</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </button>

                                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                {isAdmin && editing?.type === 'department' && editing.id === dept.id ? (
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
                                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover/dept:opacity-100 transition-opacity">
                                                                                <button
                                                                                    onClick={() => startEdit({ type: 'department', courseId: course.id, id: dept.id }, dept.name)}
                                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                                                                                    <Pencil size={12} className="text-muted-foreground" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setConfirmDeleteEntity({ type: 'department', courseId: course.id, id: dept.id, name: dept.name })}
                                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                                                                    <Trash2 size={12} className="text-red-500" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isDeptExpanded ? 'rotate-180' : ''}`} />
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
                                                                    <div className="border-t border-border/40 px-4 py-3 space-y-3">

                                                                        {dept.years.length === 0 && !addingYear && (
                                                                            <p className="text-xs text-muted-foreground/60 italic">No years yet</p>
                                                                        )}

                                                                        {dept.years.map((year) => {
                                                                            const isYearExpanded = expandedYearId === year.id;
                                                                            const totalYearStudents = year.semesters.reduce((m, s) => m + s.divisions.reduce((j, div) => j + div.studentCount, 0), 0);

                                                                            return (
                                                                                <div key={year.id}
                                                                                    draggable={isAdmin && yearDragReady}
                                                                                    onDragStart={() => setDragYearId(year.id)}
                                                                                    onDragOver={(e) => isAdmin && e.preventDefault()}
                                                                                    onDrop={(e) => { e.preventDefault(); handleYearDrop(course.id, dept.id, year.id); }}
                                                                                    onDragEnd={() => { setDragYearId(null); setYearDragReady(false); }}
                                                                                    className={`rounded-lg border border-border/40 overflow-hidden bg-background transition-opacity ${dragYearId === year.id ? 'opacity-40' : ''}`}>

                                                                                    {/* Year header */}
                                                                                    <div className="group/year w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/20 transition-colors">
                                                                                        {isAdmin && (
                                                                                            <GripVertical
                                                                                                size={12}
                                                                                                className="text-muted-foreground/40 shrink-0 opacity-0 group-hover/year:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mr-1"
                                                                                                onMouseDown={() => setYearDragReady(true)}
                                                                                                onMouseUp={() => setYearDragReady(false)}
                                                                                            />
                                                                                        )}
                                                                                        <button
                                                                                            onClick={() => setExpandedYearId(isYearExpanded ? null : year.id)}
                                                                                            disabled={editing?.type === 'year' && editing.id === year.id}
                                                                                            className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                                                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-white/20"
                                                                                                style={{ background: cGrad }}>
                                                                                                <span className="text-[10px] font-black text-white">{year.name.slice(0, 2).toUpperCase()}</span>
                                                                                            </div>
                                                                                            {editing?.type === 'year' && editing.id === year.id ? (
                                                                                                <input
                                                                                                    autoFocus
                                                                                                    value={editValue}
                                                                                                    onChange={e => setEditValue(e.target.value)}
                                                                                                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                                                                                    onClick={e => e.stopPropagation()}
                                                                                                    className="h-7 px-2 rounded-lg border border-primary/50 bg-primary/5 text-[12px] font-bold focus:outline-none focus:border-primary transition-all w-36"
                                                                                                />
                                                                                            ) : (
                                                                                                <div className="min-w-0">
                                                                                                    <p className="text-[12px] font-bold truncate">{year.name}</p>
                                                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                                                        <span className="text-[10px] text-muted-foreground">{year.semesters.length} semesters</span>
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
                                                                                                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                                                                                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                                                                        <Check size={11} />
                                                                                                    </button>
                                                                                                    <button onClick={cancelEdit}
                                                                                                        className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                                                                        <X size={11} />
                                                                                                    </button>
                                                                                                </>
                                                                                            ) : (
                                                                                                <>
                                                                                                    {isAdmin && (
                                                                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover/year:opacity-100 transition-opacity">
                                                                                                            <button
                                                                                                                onClick={() => startEdit({ type: 'year', courseId: course.id, departmentId: dept.id, id: year.id }, year.name)}
                                                                                                                className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                                                                                                                <Pencil size={11} className="text-muted-foreground" />
                                                                                                            </button>
                                                                                                            <button
                                                                                                                onClick={() => setConfirmDeleteEntity({ type: 'year', courseId: course.id, departmentId: dept.id, id: year.id, name: year.name })}
                                                                                                                className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                                                                                                <Trash2 size={11} className="text-red-500" />
                                                                                                            </button>
                                                                                                        </div>
                                                                                                    )}
                                                                                                    <ChevronDown size={13} className={`text-muted-foreground transition-transform duration-200 ${isYearExpanded ? 'rotate-180' : ''}`} />
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Expanded — Semesters */}
                                                                                    <AnimatePresence>
                                                                                        {isYearExpanded && (
                                                                                            <motion.div
                                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                                transition={{ duration: 0.2 }}
                                                                                                className="overflow-hidden">
                                                                                                <div className="border-t border-border/40 px-3 py-3 space-y-3">

                                                                                                    {year.semesters.length === 0 && !addingSemester && (
                                                                                                        <p className="text-xs text-muted-foreground/60 italic">No semesters yet</p>
                                                                                                    )}

                                                                                                    {year.semesters.map((sem) => {
                                                                                                        const isSemExpanded = expandedSemId === sem.id;

                                                                                                        return (
                                                                                                            <div key={sem.id}
                                                                                                                draggable={isAdmin && semDragReady}
                                                                                                                onDragStart={() => setDragSemId(sem.id)}
                                                                                                                onDragOver={(e) => isAdmin && e.preventDefault()}
                                                                                                                onDrop={(e) => { e.preventDefault(); handleSemDrop(course.id, dept.id, year.id, sem.id); }}
                                                                                                                onDragEnd={() => { setDragSemId(null); setSemDragReady(false); }}
                                                                                                                className={`rounded-lg border border-border/40 overflow-hidden bg-card transition-opacity ${dragSemId === sem.id ? 'opacity-40' : ''}`}>

                                                                                                                {/* Semester header */}
                                                                                                                <div className="group/sem w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/20 transition-colors">
                                                                                                                    {isAdmin && (
                                                                                                                        <GripVertical
                                                                                                                            size={12}
                                                                                                                            className="text-muted-foreground/40 shrink-0 opacity-0 group-hover/sem:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mr-1"
                                                                                                                            onMouseDown={() => setSemDragReady(true)}
                                                                                                                            onMouseUp={() => setSemDragReady(false)}
                                                                                                                        />
                                                                                                                    )}
                                                                                                                    <button
                                                                                                                        onClick={() => setExpandedSemId(isSemExpanded ? null : sem.id)}
                                                                                                                        disabled={editing?.type === 'semester' && editing.id === sem.id}
                                                                                                                        className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                                                                                                        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-white/20"
                                                                                                                            style={{ background: cGrad }}>
                                                                                                                            <span className="text-[9px] font-black text-white">{sem.name.slice(0, 2).toUpperCase()}</span>
                                                                                                                        </div>
                                                                                                                        {editing?.type === 'semester' && editing.id === sem.id ? (
                                                                                                                            <input
                                                                                                                                autoFocus
                                                                                                                                value={editValue}
                                                                                                                                onChange={e => setEditValue(e.target.value)}
                                                                                                                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                                                                                                                onClick={e => e.stopPropagation()}
                                                                                                                                className="h-7 px-2 rounded-lg border border-primary/50 bg-primary/5 text-[12px] font-bold focus:outline-none focus:border-primary transition-all w-32"
                                                                                                                            />
                                                                                                                        ) : (
                                                                                                                            <div className="min-w-0">
                                                                                                                                <p className="text-[12px] font-bold truncate">{sem.name}</p>
                                                                                                                                <span className="text-[10px] text-muted-foreground">{sem.divisions.length} divisions</span>
                                                                                                                            </div>
                                                                                                                        )}
                                                                                                                    </button>

                                                                                                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                                                                        {isAdmin && editing?.type === 'semester' && editing.id === sem.id ? (
                                                                                                                            <>
                                                                                                                                <button onClick={saveEdit}
                                                                                                                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                                                                                                                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                                                                                                                    <Check size={11} />
                                                                                                                                </button>
                                                                                                                                <button onClick={cancelEdit}
                                                                                                                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted border border-border/50">
                                                                                                                                    <X size={11} />
                                                                                                                                </button>
                                                                                                                            </>
                                                                                                                        ) : (
                                                                                                                            <>
                                                                                                                                {isAdmin && (
                                                                                                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/sem:opacity-100 transition-opacity">
                                                                                                                                        <button
                                                                                                                                            onClick={() => startEdit({ type: 'semester', courseId: course.id, departmentId: dept.id, yearId: year.id, id: sem.id }, sem.name)}
                                                                                                                                            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                                                                                                                                            <Pencil size={11} className="text-muted-foreground" />
                                                                                                                                        </button>
                                                                                                                                        <button
                                                                                                                                            onClick={() => setConfirmDeleteEntity({ type: 'semester', courseId: course.id, departmentId: dept.id, yearId: year.id, id: sem.id, name: sem.name })}
                                                                                                                                            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                                                                                                                            <Trash2 size={11} className="text-red-500" />
                                                                                                                                        </button>
                                                                                                                                    </div>
                                                                                                                                )}
                                                                                                                                <ChevronDown size={13} className={`text-muted-foreground transition-transform duration-200 ${isSemExpanded ? 'rotate-180' : ''}`} />
                                                                                                                            </>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                </div>

                                                                                                                {/* Expanded — Subjects + Divisions */}
                                                                                                                <AnimatePresence>
                                                                                                                    {isSemExpanded && (
                                                                                                                        <motion.div
                                                                                                                            initial={{ height: 0, opacity: 0 }}
                                                                                                                            animate={{ height: 'auto', opacity: 1 }}
                                                                                                                            exit={{ height: 0, opacity: 0 }}
                                                                                                                            transition={{ duration: 0.2 }}
                                                                                                                            className="overflow-hidden">
                                                                                                                            <div className="border-t border-border/40 px-3 py-3 space-y-4">

                                                                                                                                {/* Subjects */}
                                                                                                                                <div>
                                                                                                                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                                                                                                                                        Subjects
                                                                                                                                    </p>
                                                                                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                                                                                        {(sem.subjects ?? []).map((sub) => (
                                                                                                                                            <span key={sub.id}
                                                                                                                                                draggable={isAdmin && dragReady}
                                                                                                                                                onDragStart={() => setDragSubjectId(sub.id)}
                                                                                                                                                onDragOver={(e) => isAdmin && e.preventDefault()}
                                                                                                                                                onDrop={(e) => { e.preventDefault(); handleSubjectDrop(course.id, dept.id, year.id, sem.id, sub.id); }}
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
                                                                                                                                                        onClick={() => setConfirmDeleteSubject({ id: sub.id, name: sub.name, semesterId: sem.id })}
                                                                                                                                                        className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all">
                                                                                                                                                        <X size={9} />
                                                                                                                                                    </button>
                                                                                                                                                )}
                                                                                                                                            </span>
                                                                                                                                        ))}
                                                                                                                                        {(sem.subjects ?? []).length === 0 && (
                                                                                                                                            <span className="text-xs text-muted-foreground/60 italic">No subjects yet</span>
                                                                                                                                        )}
                                                                                                                                        {isAdmin && (addingSubject === sem.id ? (
                                                                                                                                            <InlineAddInput
                                                                                                                                                placeholder="Subject name"
                                                                                                                                                onAdd={name => addSubject(course.id, dept.id, year.id, sem.id, name)}
                                                                                                                                                onCancel={() => setAddingSubject(null)}
                                                                                                                                                loading={saving}
                                                                                                                                            />
                                                                                                                                        ) : (
                                                                                                                                            <button onClick={() => setAddingSubject(sem.id)}
                                                                                                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                                                                                                                                                <Plus size={11} /> Add subject
                                                                                                                                            </button>
                                                                                                                                        ))}
                                                                                                                                    </div>
                                                                                                                                </div>

                                                                                                                                {/* Division cards */}
                                                                                                                                {sem.divisions.length > 0 && (
                                                                                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                                                                                        {sem.divisions.map((div, divIdx) => {
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
                                                                                                                                                    onDrop={(e) => { e.preventDefault(); handleDivisionDrop(course.id, dept.id, year.id, sem.id, div.id); }}
                                                                                                                                                    onDragEnd={() => { setDragDivisionId(null); setDivDragReady(false); }}
                                                                                                                                                    className={`group/divcard rounded-2xl border border-border/50 overflow-hidden flex flex-col bg-background hover:shadow-md hover:shadow-black/5 hover:border-border transition-all duration-200 ${dragDivisionId === div.id ? 'opacity-40' : ''}`} data-admin-surface="">

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
                                                                                                                                                                    style={{ background: cGrad }}>
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
                                                                                                                                                                                    onClick={() => startEdit({ type: 'division', courseId: course.id, departmentId: dept.id, yearId: year.id, semesterId: sem.id, id: div.id }, div.name)}
                                                                                                                                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                                                                                                                                                                                    <Pencil size={13} className="text-muted-foreground" />
                                                                                                                                                                                </button>
                                                                                                                                                                                <button
                                                                                                                                                                                    onClick={() => setConfirmDeleteEntity({ type: 'division', courseId: course.id, departmentId: dept.id, yearId: year.id, semesterId: sem.id, id: div.id, name: div.name })}
                                                                                                                                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                                                                                                                                                                    <Trash2 size={13} className="text-red-500" />
                                                                                                                                                                                </button>
                                                                                                                                                                            </div>
                                                                                                                                                                        )}
                                                                                                                                                                        <div
                                                                                                                                                                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                                                                                                                                                                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                                                                                                                                                            onClick={() => router.push(`/admin/campus/courses/${course.id}/${dept.id}/${year.id}/${sem.id}/${div.id}`)}>
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
                                                                                                                                                                const selectedSubs = sem.subjects.filter(s => selectedIds.has(s.id));
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

                                                                                                                                {sem.divisions.length === 0 && (
                                                                                                                                    <p className="text-xs text-muted-foreground/60 italic">No divisions yet</p>
                                                                                                                                )}

                                                                                                                                {/* Add division — ADMIN only */}
                                                                                                                                {isAdmin && (addingDivision === sem.id ? (
                                                                                                                                    <InlineAddInput
                                                                                                                                        placeholder={`e.g. ${year.name}-A`}
                                                                                                                                        onAdd={name => addDivision(course.id, dept.id, year.id, sem.id, name)}
                                                                                                                                        onCancel={() => setAddingDivision(null)}
                                                                                                                                        loading={saving}
                                                                                                                                    />
                                                                                                                                ) : (
                                                                                                                                    <button
                                                                                                                                        onClick={() => setAddingDivision(sem.id)}
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

                                                                                                    {/* Add semester — ADMIN only */}
                                                                                                    {isAdmin && (addingSemester === year.id ? (
                                                                                                        <InlineAddInput
                                                                                                            placeholder="e.g. Semester 1"
                                                                                                            onAdd={name => addSemester(course.id, dept.id, year.id, name)}
                                                                                                            onCancel={() => setAddingSemester(null)}
                                                                                                            loading={saving}
                                                                                                        />
                                                                                                    ) : (
                                                                                                        <button
                                                                                                            onClick={() => setAddingSemester(year.id)}
                                                                                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                                                                                                            <Plus size={11} /> Add Semester
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
                                                                                onAdd={name => addYear(course.id, dept.id, name)}
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

                                            {/* Add department — ADMIN only */}
                                            {isAdmin && (addingDepartment === course.id ? (
                                                <InlineAddInput
                                                    placeholder="e.g. Computer Engineering"
                                                    onAdd={name => addDepartment(course.id, name)}
                                                    onCancel={() => setAddingDepartment(null)}
                                                    loading={saving}
                                                />
                                            ) : (
                                                <button
                                                    onClick={() => setAddingDepartment(course.id)}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                                                    <Plus size={11} /> Add Department
                                                </button>
                                            ))}
                        </div>
                    );
                })()}
            </div>

            <AnimatePresence>
                {confirmDeleteSubject && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" data-admin-surface="">
                            <h3 className="text-base font-bold mb-2">Delete Subject?</h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                <span className="font-semibold text-foreground">{confirmDeleteSubject.name}</span> will be removed from this semester and all its divisions. Teacher assignments for this subject will also be removed.
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirmDeleteSubject(null)}
                                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => {
                                    for (const course of courses) {
                                        for (const dept of course.departments) {
                                            for (const year of dept.years) {
                                                if (year.semesters.some(s => s.id === confirmDeleteSubject.semesterId)) {
                                                    deleteSubject(confirmDeleteSubject.id, course.id, dept.id, year.id, confirmDeleteSubject.semesterId);
                                                }
                                            }
                                        }
                                    }
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
                            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" data-admin-surface="">
                            <h3 className="text-base font-bold mb-2">
                                Delete {confirmDeleteEntity.type === 'course' ? 'Course' : confirmDeleteEntity.type === 'department' ? 'Department' : confirmDeleteEntity.type === 'year' ? 'Year' : confirmDeleteEntity.type === 'semester' ? 'Semester' : 'Division'}?
                            </h3>
                            <p className="text-sm text-muted-foreground mb-5">
                                <span className="font-semibold text-foreground">{confirmDeleteEntity.name}</span>{' '}
                                {confirmDeleteEntity.type === 'course' && 'will be removed along with all its departments, years, semesters and divisions.'}
                                {confirmDeleteEntity.type === 'department' && 'will be removed along with all its years, semesters and divisions.'}
                                {confirmDeleteEntity.type === 'year' && 'will be removed along with all its semesters and divisions.'}
                                {confirmDeleteEntity.type === 'semester' && 'will be removed along with all its divisions and subjects.'}
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
