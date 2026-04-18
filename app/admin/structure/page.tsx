'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import type {
    InstitutionStructure,
    StructureLevel1,
    StructureLevel2,
    StructureLevel3,
    InstitutionType,
} from '@/types';
import { getStructureLabels } from '@/lib/getInstitutionAccent';
import { StructureHeader } from '@/components/admin/StructureHeader';
import { StructureTree } from '@/components/admin/StructureTree';
import { StructureItemModal } from '@/components/admin/StructureItemModal';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// ── Mock data — TODO: wire to GET /admin/structure ──
const MOCK_STRUCTURE: InstitutionStructure = {
    institutionType: 'SCHOOL',
    levels: [
        {
            id: 'l1-1',
            name: 'Class 10',
            code: '10',
            order: 1,
            children: [
                {
                    id: 'l2-1',
                    name: 'Mathematics',
                    code: 'MATH',
                    order: 1,
                    children: [
                        { id: 'l3-1', name: '10-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 24 },
                        { id: 'l3-2', name: '10-B', code: 'B', capacity: 30, teacherCount: 1, studentCount: 22 },
                        { id: 'l3-3', name: '10-C', code: 'C', capacity: 30, teacherCount: 1, studentCount: 20 },
                    ],
                },
                {
                    id: 'l2-2',
                    name: 'Science',
                    code: 'SCI',
                    order: 2,
                    children: [
                        { id: 'l3-4', name: '10-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 24 },
                        { id: 'l3-5', name: '10-B', code: 'B', capacity: 30, teacherCount: 1, studentCount: 22 },
                    ],
                },
                {
                    id: 'l2-3',
                    name: 'English',
                    code: 'ENG',
                    order: 3,
                    children: [
                        { id: 'l3-6', name: '10-A', code: 'A', capacity: 35, teacherCount: 1, studentCount: 24 },
                    ],
                },
            ],
        },
        {
            id: 'l1-2',
            name: 'Class 9',
            code: '9',
            order: 2,
            children: [
                {
                    id: 'l2-4',
                    name: 'Mathematics',
                    code: 'MATH',
                    order: 1,
                    children: [
                        { id: 'l3-7', name: '9-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 28 },
                        { id: 'l3-8', name: '9-B', code: 'B', capacity: 30, teacherCount: 1, studentCount: 26 },
                    ],
                },
                {
                    id: 'l2-5',
                    name: 'Hindi',
                    code: 'HIN',
                    order: 2,
                    children: [
                        { id: 'l3-9', name: '9-A', code: 'A', capacity: 30, teacherCount: 1, studentCount: 28 },
                    ],
                },
            ],
        },
        {
            id: 'l1-3',
            name: 'Class 8',
            code: '8',
            order: 3,
            children: [],
        },
    ],
};

// ── Modal state types ──
type ModalState =
    | { type: 'closed' }
    | { type: 'create-l1' }
    | { type: 'create-l2'; parentId: string }
    | { type: 'create-l3'; parentId: string }
    | { type: 'edit-l1'; item: StructureLevel1 }
    | { type: 'edit-l2'; item: StructureLevel2 }
    | { type: 'edit-l3'; item: StructureLevel3 };

type DeleteState =
    | { type: 'closed' }
    | { type: 'l1'; item: StructureLevel1 }
    | { type: 'l2'; item: StructureLevel2 }
    | { type: 'l3'; item: StructureLevel3 };

function generateId() {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function AdminStructurePage() {
    const [structure, setStructure] = useState<InstitutionStructure | null>(null);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<ModalState>({ type: 'closed' });
    const [deleteState, setDeleteState] = useState<DeleteState>({ type: 'closed' });
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function fetchStructure() {
            try {
                const res = await api.get('/admin/structure');
                if (!cancelled) setStructure(res.data.data);
            } catch {
                if (!cancelled) setStructure(MOCK_STRUCTURE);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchStructure();
        return () => { cancelled = true; };
    }, []);

    // ── Counts ──
    const l1Count = structure?.levels.length ?? 0;
    const l2Count = structure?.levels.reduce((n, l1) => n + l1.children.length, 0) ?? 0;
    const l3Count =
        structure?.levels.reduce(
            (n, l1) => n + l1.children.reduce((m, l2) => m + l2.children.length, 0),
            0,
        ) ?? 0;

    const instType: InstitutionType = structure?.institutionType ?? 'SCHOOL';
    const labels = getStructureLabels(instType);

    // ── CRUD handlers (local state + API attempt) ──

    const handleCreateSubmit = useCallback(
        async (data: { name: string; code?: string; capacity?: number }) => {
            setActionLoading(true);
            try {
                if (modal.type === 'create-l1') {
                    try { await api.post('/admin/structure/level1', data); } catch { /* mock */ }
                    const newItem: StructureLevel1 = {
                        id: generateId(),
                        name: data.name,
                        code: data.code,
                        order: l1Count + 1,
                        children: [],
                    };
                    setStructure((s) =>
                        s ? { ...s, levels: [...s.levels, newItem] } : s,
                    );
                    toast.success(`${labels.l1} added`);
                } else if (modal.type === 'create-l2') {
                    try { await api.post(`/admin/structure/level1/${modal.parentId}/level2`, data); } catch { /* mock */ }
                    const newItem: StructureLevel2 = {
                        id: generateId(),
                        name: data.name,
                        code: data.code,
                        order: 0,
                        children: [],
                    };
                    setStructure((s) => {
                        if (!s) return s;
                        return {
                            ...s,
                            levels: s.levels.map((l1) =>
                                l1.id === modal.parentId
                                    ? { ...l1, children: [...l1.children, newItem] }
                                    : l1,
                            ),
                        };
                    });
                    toast.success(`${labels.l2} added`);
                } else if (modal.type === 'create-l3') {
                    try { await api.post(`/admin/structure/level2/${modal.parentId}/level3`, data); } catch { /* mock */ }
                    const newItem: StructureLevel3 = {
                        id: generateId(),
                        name: data.name,
                        code: data.code,
                        capacity: data.capacity,
                        teacherCount: 0,
                        studentCount: 0,
                    };
                    setStructure((s) => {
                        if (!s) return s;
                        return {
                            ...s,
                            levels: s.levels.map((l1) => ({
                                ...l1,
                                children: l1.children.map((l2) =>
                                    l2.id === modal.parentId
                                        ? { ...l2, children: [...l2.children, newItem] }
                                        : l2,
                                ),
                            })),
                        };
                    });
                    toast.success(`${labels.l3} added`);
                }
                setModal({ type: 'closed' });
            } finally {
                setActionLoading(false);
            }
        },
        [modal, labels, l1Count],
    );

    const handleEditSubmit = useCallback(
        async (data: { name: string; code?: string; capacity?: number }) => {
            setActionLoading(true);
            try {
                if (modal.type === 'edit-l1') {
                    try { await api.patch(`/admin/structure/level1/${modal.item.id}`, data); } catch { /* mock */ }
                    setStructure((s) => {
                        if (!s) return s;
                        return {
                            ...s,
                            levels: s.levels.map((l1) =>
                                l1.id === modal.item.id ? { ...l1, ...data } : l1,
                            ),
                        };
                    });
                    toast.success(`${labels.l1} updated`);
                } else if (modal.type === 'edit-l2') {
                    try { await api.patch(`/admin/structure/level2/${modal.item.id}`, data); } catch { /* mock */ }
                    setStructure((s) => {
                        if (!s) return s;
                        return {
                            ...s,
                            levels: s.levels.map((l1) => ({
                                ...l1,
                                children: l1.children.map((l2) =>
                                    l2.id === modal.item.id ? { ...l2, ...data } : l2,
                                ),
                            })),
                        };
                    });
                    toast.success(`${labels.l2} updated`);
                } else if (modal.type === 'edit-l3') {
                    try { await api.patch(`/admin/structure/level3/${modal.item.id}`, data); } catch { /* mock */ }
                    setStructure((s) => {
                        if (!s) return s;
                        return {
                            ...s,
                            levels: s.levels.map((l1) => ({
                                ...l1,
                                children: l1.children.map((l2) => ({
                                    ...l2,
                                    children: l2.children.map((l3) =>
                                        l3.id === modal.item.id ? { ...l3, ...data } : l3,
                                    ),
                                })),
                            })),
                        };
                    });
                    toast.success(`${labels.l3} updated`);
                }
                setModal({ type: 'closed' });
            } finally {
                setActionLoading(false);
            }
        },
        [modal, labels],
    );

    const handleDelete = useCallback(async () => {
        setActionLoading(true);
        try {
            if (deleteState.type === 'l1') {
                try { await api.delete(`/admin/structure/level1/${deleteState.item.id}`); } catch { /* mock */ }
                setStructure((s) => {
                    if (!s) return s;
                    return { ...s, levels: s.levels.filter((l1) => l1.id !== deleteState.item.id) };
                });
                toast.success(`${labels.l1} deleted`);
            } else if (deleteState.type === 'l2') {
                try { await api.delete(`/admin/structure/level2/${deleteState.item.id}`); } catch { /* mock */ }
                setStructure((s) => {
                    if (!s) return s;
                    return {
                        ...s,
                        levels: s.levels.map((l1) => ({
                            ...l1,
                            children: l1.children.filter((l2) => l2.id !== deleteState.item.id),
                        })),
                    };
                });
                toast.success(`${labels.l2} deleted`);
            } else if (deleteState.type === 'l3') {
                try { await api.delete(`/admin/structure/level3/${deleteState.item.id}`); } catch { /* mock */ }
                setStructure((s) => {
                    if (!s) return s;
                    return {
                        ...s,
                        levels: s.levels.map((l1) => ({
                            ...l1,
                            children: l1.children.map((l2) => ({
                                ...l2,
                                children: l2.children.filter((l3) => l3.id !== deleteState.item.id),
                            })),
                        })),
                    };
                });
                toast.success(`${labels.l3} deleted`);
            }
            setDeleteState({ type: 'closed' });
        } finally {
            setActionLoading(false);
        }
    }, [deleteState, labels]);

    // ── Loading state ──
    if (loading || !structure) {
        return (
            <div className="space-y-4 py-4 px-2">
                <Skeleton className="h-12 w-72 rounded-lg" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
            </div>
        );
    }

    // ── Modal config helpers ──
    const modalLabel =
        modal.type === 'create-l1' || modal.type === 'edit-l1'
            ? labels.l1
            : modal.type === 'create-l2' || modal.type === 'edit-l2'
              ? labels.l2
              : modal.type === 'create-l3' || modal.type === 'edit-l3'
                ? labels.l3
                : '';

    const isEditMode = modal.type.startsWith('edit');
    const showCapacity = modal.type === 'create-l3' || modal.type === 'edit-l3';
    const modalDefaults =
        modal.type === 'edit-l1'
            ? { name: modal.item.name, code: modal.item.code }
            : modal.type === 'edit-l2'
              ? { name: modal.item.name, code: modal.item.code }
              : modal.type === 'edit-l3'
                ? { name: modal.item.name, code: modal.item.code, capacity: modal.item.capacity }
                : undefined;

    const deleteLabel =
        deleteState.type === 'l1'
            ? labels.l1
            : deleteState.type === 'l2'
              ? labels.l2
              : deleteState.type === 'l3'
                ? labels.l3
                : '';
    const deleteName =
        deleteState.type !== 'closed' ? deleteState.item.name : '';
    const deleteChildrenLabel =
        deleteState.type === 'l1'
            ? `${labels.l2Plural.toLowerCase()} and ${labels.l3Plural.toLowerCase()}`
            : deleteState.type === 'l2'
              ? labels.l3Plural.toLowerCase()
              : undefined;

    return (
        <div className="space-y-5 py-4 px-2">
            <StructureHeader
                institutionType={instType}
                l1Count={l1Count}
                l2Count={l2Count}
                l3Count={l3Count}
                onAddLevel1={() => setModal({ type: 'create-l1' })}
            />

            <StructureTree
                levels={structure.levels}
                institutionType={instType}
                onAddLevel2={(parentId) => setModal({ type: 'create-l2', parentId })}
                onAddLevel3={(parentId) => setModal({ type: 'create-l3', parentId })}
                onEditLevel1={(item) => setModal({ type: 'edit-l1', item })}
                onEditLevel2={(item) => setModal({ type: 'edit-l2', item })}
                onEditLevel3={(item) => setModal({ type: 'edit-l3', item })}
                onDeleteLevel1={(item) => setDeleteState({ type: 'l1', item })}
                onDeleteLevel2={(item) => setDeleteState({ type: 'l2', item })}
                onDeleteLevel3={(item) => setDeleteState({ type: 'l3', item })}
            />

            {/* Create / Edit modal */}
            <StructureItemModal
                open={modal.type !== 'closed'}
                onOpenChange={(v) => !v && setModal({ type: 'closed' })}
                label={modalLabel}
                mode={isEditMode ? 'edit' : 'create'}
                showCapacity={showCapacity}
                defaultValues={modalDefaults}
                loading={actionLoading}
                onSubmit={isEditMode ? handleEditSubmit : handleCreateSubmit}
            />

            {/* Delete confirm */}
            <DeleteConfirmDialog
                open={deleteState.type !== 'closed'}
                onOpenChange={(v) => !v && setDeleteState({ type: 'closed' })}
                label={deleteLabel}
                name={deleteName}
                childrenLabel={deleteChildrenLabel}
                loading={actionLoading}
                onConfirm={handleDelete}
            />
        </div>
    );
}
