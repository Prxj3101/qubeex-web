'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import type {
    Teacher,
    TeacherAssignment,
    InstitutionStructure,
    InstitutionType,
} from '@/types';
import { getStructureLabels } from '@/lib/getInstitutionAccent';
import { TeacherTable } from '@/components/admin/TeacherTable';
import { AddTeacherModal } from '@/components/admin/AddTeacherModal';
import { AssignTeacherModal } from '@/components/admin/AssignTeacherModal';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Search, Users } from 'lucide-react';

// ── Mock data — TODO: wire to GET /admin/teachers ──
const MOCK_TEACHERS: Teacher[] = [
    {
        id: 't1',
        name: 'Ritu Sharma',
        email: 'ritu.sharma@dps.edu.in',
        phone: '+91 98765 43210',
        status: 'ACTIVE',
        joinedAt: '2025-08-15T00:00:00Z',
        assignments: [
            {
                id: 'a1',
                level1Id: 'l1-1',
                level1Name: 'Class 10',
                level2Id: 'l2-1',
                level2Name: 'Mathematics',
                level3Id: 'l3-1',
                level3Name: '10-A',
                role: 'CLASS_TEACHER',
            },
            {
                id: 'a2',
                level1Id: 'l1-1',
                level1Name: 'Class 10',
                level2Id: 'l2-1',
                level2Name: 'Mathematics',
                level3Id: 'l3-2',
                level3Name: '10-B',
                role: 'SUBJECT_TEACHER',
            },
        ],
    },
    {
        id: 't2',
        name: 'Ankit Verma',
        email: 'ankit.verma@dps.edu.in',
        status: 'ACTIVE',
        joinedAt: '2025-09-01T00:00:00Z',
        assignments: [
            {
                id: 'a3',
                level1Id: 'l1-1',
                level1Name: 'Class 10',
                level2Id: 'l2-2',
                level2Name: 'Science',
                level3Id: 'l3-4',
                level3Name: '10-A',
                role: 'SUBJECT_TEACHER',
            },
        ],
    },
    {
        id: 't3',
        name: 'Priya Nair',
        email: 'priya.nair@dps.edu.in',
        phone: '+91 87654 32109',
        status: 'ACTIVE',
        joinedAt: '2025-07-20T00:00:00Z',
        assignments: [
            {
                id: 'a4',
                level1Id: 'l1-1',
                level1Name: 'Class 10',
                level2Id: 'l2-3',
                level2Name: 'English',
                level3Id: 'l3-6',
                level3Name: '10-A',
                role: 'SUBJECT_TEACHER',
            },
        ],
    },
    {
        id: 't4',
        name: 'Rajesh Kumar',
        email: 'rajesh.k@dps.edu.in',
        status: 'INACTIVE',
        joinedAt: '2024-06-10T00:00:00Z',
        assignments: [],
    },
    {
        id: 't5',
        name: 'Meena Patel',
        email: 'meena.patel@dps.edu.in',
        phone: '+91 76543 21098',
        status: 'ACTIVE',
        joinedAt: '2026-01-15T00:00:00Z',
        assignments: [
            {
                id: 'a5',
                level1Id: 'l1-2',
                level1Name: 'Class 9',
                level2Id: 'l2-4',
                level2Name: 'Mathematics',
                level3Id: 'l3-7',
                level3Name: '9-A',
                role: 'CLASS_TEACHER',
            },
        ],
    },
];

// ── Mock structure (same as structure page) ──
const MOCK_STRUCTURE: InstitutionStructure = {
    institutionType: 'SCHOOL',
    levels: [
        {
            id: 'l1-1', name: 'Class 10', code: '10', order: 1,
            children: [
                { id: 'l2-1', name: 'Mathematics', code: 'MATH', order: 1, children: [
                    { id: 'l3-1', name: '10-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 24 },
                    { id: 'l3-2', name: '10-B', code: 'B', capacity: 30, teacherCount: 1, studentCount: 22 },
                    { id: 'l3-3', name: '10-C', code: 'C', capacity: 30, teacherCount: 1, studentCount: 20 },
                ]},
                { id: 'l2-2', name: 'Science', code: 'SCI', order: 2, children: [
                    { id: 'l3-4', name: '10-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 24 },
                    { id: 'l3-5', name: '10-B', code: 'B', capacity: 30, teacherCount: 1, studentCount: 22 },
                ]},
                { id: 'l2-3', name: 'English', code: 'ENG', order: 3, children: [
                    { id: 'l3-6', name: '10-A', code: 'A', capacity: 35, teacherCount: 1, studentCount: 24 },
                ]},
            ],
        },
        {
            id: 'l1-2', name: 'Class 9', code: '9', order: 2,
            children: [
                { id: 'l2-4', name: 'Mathematics', code: 'MATH', order: 1, children: [
                    { id: 'l3-7', name: '9-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 28 },
                    { id: 'l3-8', name: '9-B', code: 'B', capacity: 30, teacherCount: 1, studentCount: 26 },
                ]},
                { id: 'l2-5', name: 'Hindi', code: 'HIN', order: 2, children: [
                    { id: 'l3-9', name: '9-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 28 },
                ]},
            ],
        },
    ],
};

// ── Modal state ──
type ModalState =
    | { type: 'closed' }
    | { type: 'add' }
    | { type: 'edit'; teacher: Teacher }
    | { type: 'assign'; teacher: Teacher }
    | { type: 'deactivate'; teacher: Teacher };

function generateId() {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function TeachersPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [structure, setStructure] = useState<InstitutionStructure | null>(null);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<ModalState>({ type: 'closed' });
    const [actionLoading, setActionLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;
        async function fetchData() {
            try {
                const [tRes, sRes] = await Promise.allSettled([
                    api.get('/admin/teachers'),
                    api.get('/admin/structure'),
                ]);
                if (!cancelled) {
                    setTeachers(
                        tRes.status === 'fulfilled' ? tRes.value.data.data : MOCK_TEACHERS,
                    );
                    setStructure(
                        sRes.status === 'fulfilled' ? sRes.value.data.data : MOCK_STRUCTURE,
                    );
                }
            } catch {
                if (!cancelled) {
                    setTeachers(MOCK_TEACHERS);
                    setStructure(MOCK_STRUCTURE);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchData();
        return () => { cancelled = true; };
    }, []);

    const instType: InstitutionType = structure?.institutionType ?? 'SCHOOL';
    const labels = getStructureLabels(instType);

    // ── Filtered teachers ──
    const filtered = search.trim()
        ? teachers.filter(
              (t) =>
                  t.name.toLowerCase().includes(search.toLowerCase()) ||
                  t.email.toLowerCase().includes(search.toLowerCase()),
          )
        : teachers;

    const activeCount = teachers.filter((t) => t.status === 'ACTIVE').length;

    // ── CRUD handlers ──

    const handleAddTeacher = useCallback(
        async (data: { name: string; email: string; phone?: string }) => {
            setActionLoading(true);
            try {
                try { await api.post('/admin/teachers', data); } catch { /* mock */ }
                const newTeacher: Teacher = {
                    id: generateId(),
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    status: 'ACTIVE',
                    joinedAt: new Date().toISOString(),
                    assignments: [],
                };
                setTeachers((prev) => [...prev, newTeacher]);
                toast.success('Teacher added');
                setModal({ type: 'closed' });
            } finally {
                setActionLoading(false);
            }
        },
        [],
    );

    const handleEditTeacher = useCallback(
        async (data: { name: string; email: string; phone?: string }) => {
            if (modal.type !== 'edit') return;
            setActionLoading(true);
            try {
                try { await api.patch(`/admin/teachers/${modal.teacher.id}`, data); } catch { /* mock */ }
                setTeachers((prev) =>
                    prev.map((t) =>
                        t.id === modal.teacher.id ? { ...t, ...data } : t,
                    ),
                );
                toast.success('Teacher updated');
                setModal({ type: 'closed' });
            } finally {
                setActionLoading(false);
            }
        },
        [modal],
    );

    const handleToggleStatus = useCallback(async () => {
        if (modal.type !== 'deactivate') return;
        setActionLoading(true);
        const t = modal.teacher;
        const newStatus = t.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            try { await api.patch(`/admin/teachers/${t.id}`, { status: newStatus }); } catch { /* mock */ }
            setTeachers((prev) =>
                prev.map((x) => (x.id === t.id ? { ...x, status: newStatus } : x)),
            );
            toast.success(
                newStatus === 'ACTIVE' ? 'Teacher activated' : 'Teacher deactivated',
            );
            setModal({ type: 'closed' });
        } finally {
            setActionLoading(false);
        }
    }, [modal]);

    const handleAddAssignment = useCallback(
        async (
            teacherId: string,
            assignment: Omit<TeacherAssignment, 'id'>,
        ) => {
            try { await api.post(`/admin/teachers/${teacherId}/assign`, assignment); } catch { /* mock */ }
            const newAssignment: TeacherAssignment = {
                id: generateId(),
                ...assignment,
            };
            setTeachers((prev) =>
                prev.map((t) =>
                    t.id === teacherId
                        ? { ...t, assignments: [...t.assignments, newAssignment] }
                        : t,
                ),
            );
            toast.success('Assignment added');
        },
        [],
    );

    const handleRemoveAssignment = useCallback(
        async (teacherId: string, assignmentId: string) => {
            try { await api.delete(`/admin/teachers/${teacherId}/assign/${assignmentId}`); } catch { /* mock */ }
            setTeachers((prev) =>
                prev.map((t) =>
                    t.id === teacherId
                        ? {
                              ...t,
                              assignments: t.assignments.filter(
                                  (a) => a.id !== assignmentId,
                              ),
                          }
                        : t,
                ),
            );
            toast.success('Assignment removed');
        },
        [],
    );

    // ── Loading state ──
    if (loading) {
        return (
            <div className="space-y-4 py-4 px-2">
                <Skeleton className="h-10 w-48 rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-5 py-4 px-2">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center shrink-0">
                        <Users size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                            Teachers
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {activeCount} active · {teachers.length - activeCount} inactive
                        </p>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={() => setModal({ type: 'add' })}
                    className="flex items-center gap-1.5 self-start"
                    id="add-teacher-btn"
                >
                    <Plus size={14} />
                    Add Teacher
                </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    id="teacher-search"
                />
            </div>

            {/* Table */}
            <TeacherTable
                teachers={filtered}
                loading={false}
                onEdit={(t) => setModal({ type: 'edit', teacher: t })}
                onAssign={(t) => setModal({ type: 'assign', teacher: t })}
                onToggleStatus={(t) => setModal({ type: 'deactivate', teacher: t })}
            />

            {/* Add / Edit modal */}
            <AddTeacherModal
                open={modal.type === 'add' || modal.type === 'edit'}
                onOpenChange={(v) => !v && setModal({ type: 'closed' })}
                mode={modal.type === 'edit' ? 'edit' : 'create'}
                defaultValues={
                    modal.type === 'edit'
                        ? {
                              name: modal.teacher.name,
                              email: modal.teacher.email,
                              phone: modal.teacher.phone,
                          }
                        : undefined
                }
                loading={actionLoading}
                onSubmit={modal.type === 'edit' ? handleEditTeacher : handleAddTeacher}
            />

            {/* Assign modal */}
            <AssignTeacherModal
                open={modal.type === 'assign'}
                onOpenChange={(v) => !v && setModal({ type: 'closed' })}
                teacher={modal.type === 'assign' ? modal.teacher : null}
                structure={structure?.levels ?? []}
                institutionType={instType}
                allTeachers={teachers}
                onAddAssignment={handleAddAssignment}
                onRemoveAssignment={handleRemoveAssignment}
            />

            {/* Deactivate confirm */}
            <DeleteConfirmDialog
                open={modal.type === 'deactivate'}
                onOpenChange={(v) => !v && setModal({ type: 'closed' })}
                label={
                    modal.type === 'deactivate' && modal.teacher.status === 'ACTIVE'
                        ? 'Deactivate'
                        : 'Activate'
                }
                name={modal.type === 'deactivate' ? modal.teacher.name : ''}
                childrenLabel={
                    modal.type === 'deactivate' && modal.teacher.status === 'ACTIVE'
                        ? `${labels.l3Plural.toLowerCase()} assignments`
                        : undefined
                }
                loading={actionLoading}
                onConfirm={handleToggleStatus}
            />
        </div>
    );
}
