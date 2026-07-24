'use client';

import { useState } from 'react';
import type {
    Teacher,
    TeacherAssignment,
    TeacherRole,
    StructureLevel1,
    StructureLevel2,
    StructureLevel3,
    InstitutionType,
} from '@/types';
import { getStructureLabels, getInstitutionAccent } from '@/lib/getInstitutionAccent';
import { formatDisplayName } from '@/lib/displayName';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, ChevronRight, AlertTriangle } from 'lucide-react';

interface AssignTeacherModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teacher: Teacher | null;
    structure: StructureLevel1[];
    institutionType: InstitutionType;
    /** All teachers — used to check CLASS_TEACHER uniqueness */
    allTeachers: Teacher[];
    onAddAssignment: (
        teacherId: string,
        assignment: Omit<TeacherAssignment, 'id'>,
    ) => void;
    onRemoveAssignment: (teacherId: string, assignmentId: string) => void;
}

type Step = 'list' | 'pick-l1' | 'pick-l2' | 'pick-l3' | 'pick-role';

export function AssignTeacherModal({
    open,
    onOpenChange,
    teacher,
    structure,
    institutionType,
    allTeachers,
    onAddAssignment,
    onRemoveAssignment,
}: AssignTeacherModalProps) {
    const labels = getStructureLabels(institutionType);
    const accent = getInstitutionAccent(institutionType);

    const [step, setStep] = useState<Step>('list');
    const [selectedL1, setSelectedL1] = useState<StructureLevel1 | null>(null);
    const [selectedL2, setSelectedL2] = useState<StructureLevel2 | null>(null);
    const [selectedL3, setSelectedL3] = useState<StructureLevel3 | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    const resetFlow = () => {
        setStep('list');
        setSelectedL1(null);
        setSelectedL2(null);
        setSelectedL3(null);
        setWarning(null);
    };

    const handleClose = (v: boolean) => {
        if (!v) resetFlow();
        onOpenChange(v);
    };

    if (!teacher) return null;

    // Check CLASS_TEACHER constraints
    const getClassTeacherWarning = (
        l3Id: string,
        l3Name: string,
    ): string | null => {
        // Check if another teacher is already class teacher of this class
        for (const t of allTeachers) {
            if (t.id === teacher.id) continue;
            const existing = t.assignments.find(
                (a) => a.level3Id === l3Id && a.role === 'CLASS_TEACHER',
            );
            if (existing) {
                return `${formatDisplayName(t.name, t.prefix)} is already the class teacher of ${l3Name}. Only one class teacher is allowed per class.`;
            }
        }
        // Check if this teacher is already a class teacher of another class
        const existingCT = teacher.assignments.find(
            (a) => a.role === 'CLASS_TEACHER' && a.level3Id !== l3Id,
        );
        if (existingCT) {
            return `${formatDisplayName(teacher.name, teacher.prefix)} is already class teacher of ${existingCT.level3Name}. A teacher can only be class teacher of one class.`;
        }
        return null;
    };

    const handleRoleSelect = (role: TeacherRole) => {
        if (!selectedL1 || !selectedL2 || !selectedL3) return;

        if (role === 'CLASS_TEACHER') {
            const warn = getClassTeacherWarning(selectedL3.id, selectedL3.name);
            if (warn) {
                setWarning(warn);
                return;
            }
        }

        onAddAssignment(teacher.id, {
            level1Id: selectedL1.id,
            level1Name: selectedL1.name,
            level2Id: selectedL2.id,
            level2Name: selectedL2.name,
            level3Id: selectedL3.id,
            level3Name: selectedL3.name,
            role,
        });
        resetFlow();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'list'
                            ? `Assignments — ${formatDisplayName(teacher.name, teacher.prefix)}`
                            : step === 'pick-l1'
                              ? `Select ${labels.l1}`
                              : step === 'pick-l2'
                                ? `Select ${labels.l2}`
                                : step === 'pick-l3'
                                  ? `Select ${labels.l3}`
                                  : 'Select Role'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'list'
                            ? 'View and manage class/subject assignments.'
                            : step === 'pick-role'
                              ? 'Choose the role for this assignment.'
                              : `Pick a ${step === 'pick-l1' ? labels.l1.toLowerCase() : step === 'pick-l2' ? labels.l2.toLowerCase() : labels.l3.toLowerCase()} to assign.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-[200px]">
                    {/* ── Step: Current assignments list ── */}
                    {step === 'list' && (
                        <div className="space-y-3">
                            {teacher.assignments.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">
                                    No assignments yet.
                                </p>
                            ) : (
                                <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                                    {teacher.assignments.map((a) => (
                                        <div
                                            key={a.id}
                                            className="flex items-center justify-between py-2.5 px-3 bg-muted/30 rounded-lg group"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {a.level1Name} → {a.level2Name} → {a.level3Name}
                                                </p>
                                                <Badge
                                                    variant={a.role === 'CLASS_TEACHER' ? 'default' : 'outline'}
                                                    className="mt-1 text-[10px]"
                                                >
                                                    {a.role === 'CLASS_TEACHER'
                                                        ? 'Class Teacher'
                                                        : 'Subject Teacher'}
                                                </Badge>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                onClick={() =>
                                                    onRemoveAssignment(teacher.id, a.id)
                                                }
                                            >
                                                <Trash2 size={13} className="text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full flex items-center gap-1.5"
                                onClick={() => setStep('pick-l1')}
                            >
                                <Plus size={14} />
                                Add assignment
                            </Button>
                        </div>
                    )}

                    {/* ── Step: Pick Level 1 ── */}
                    {step === 'pick-l1' && (
                        <div className="space-y-1.5">
                            {structure.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">
                                    No {labels.l1Plural.toLowerCase()} defined. Set up your
                                    structure first.
                                </p>
                            ) : (
                                structure.map((l1) => (
                                    <button
                                        key={l1.id}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                                        onClick={() => {
                                            setSelectedL1(l1);
                                            setStep('pick-l2');
                                        }}
                                    >
                                        <div
                                            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                                            style={{ background: `${accent.bg}18` }}
                                        >
                                            <span
                                                className="text-[10px] font-bold"
                                                style={{ color: accent.bg }}
                                            >
                                                {l1.code ?? l1.name.slice(0, 2)}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium flex-1">
                                            {l1.name}
                                        </span>
                                        <ChevronRight
                                            size={14}
                                            className="text-muted-foreground"
                                        />
                                    </button>
                                ))
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2"
                                onClick={resetFlow}
                            >
                                ← Back
                            </Button>
                        </div>
                    )}

                    {/* ── Step: Pick Level 2 ── */}
                    {step === 'pick-l2' && selectedL1 && (
                        <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground mb-2">
                                In: <span className="font-medium text-foreground">{selectedL1.name}</span>
                            </p>
                            {selectedL1.children.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">
                                    No {labels.l2Plural.toLowerCase()} in {selectedL1.name}.
                                </p>
                            ) : (
                                selectedL1.children.map((l2) => (
                                    <button
                                        key={l2.id}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                                        onClick={() => {
                                            setSelectedL2(l2);
                                            setStep('pick-l3');
                                        }}
                                    >
                                        <span className="text-sm font-medium flex-1">
                                            {l2.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {l2.children.length} {l2.children.length === 1 ? labels.l3 : labels.l3Plural}
                                        </span>
                                        <ChevronRight
                                            size={14}
                                            className="text-muted-foreground"
                                        />
                                    </button>
                                ))
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2"
                                onClick={() => setStep('pick-l1')}
                            >
                                ← Back
                            </Button>
                        </div>
                    )}

                    {/* ── Step: Pick Level 3 ── */}
                    {step === 'pick-l3' && selectedL2 && (
                        <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground mb-2">
                                In: <span className="font-medium text-foreground">{selectedL1?.name}</span>{' '}
                                → <span className="font-medium text-foreground">{selectedL2.name}</span>
                            </p>
                            {selectedL2.children.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">
                                    No {labels.l3Plural.toLowerCase()} in {selectedL2.name}.
                                </p>
                            ) : (
                                selectedL2.children.map((l3) => (
                                    <button
                                        key={l3.id}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                                        onClick={() => {
                                            setSelectedL3(l3);
                                            setWarning(null);
                                            setStep('pick-role');
                                        }}
                                    >
                                        <span className="text-sm font-medium flex-1">
                                            {l3.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {l3.studentCount} students
                                        </span>
                                        <ChevronRight
                                            size={14}
                                            className="text-muted-foreground"
                                        />
                                    </button>
                                ))
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2"
                                onClick={() => setStep('pick-l2')}
                            >
                                ← Back
                            </Button>
                        </div>
                    )}

                    {/* ── Step: Pick Role ── */}
                    {step === 'pick-role' && selectedL3 && (
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground mb-1">
                                Assign to:{' '}
                                <span className="font-medium text-foreground">
                                    {selectedL1?.name} → {selectedL2?.name} → {selectedL3.name}
                                </span>
                            </p>

                            {warning && (
                                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                                    <p className="text-xs text-red-700 dark:text-red-400">
                                        {warning}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    className="flex flex-col items-start gap-1.5 p-3.5 rounded-xl border-2 border-border/50 hover:border-primary hover:bg-primary/5 transition-all text-left"
                                    onClick={() => handleRoleSelect('SUBJECT_TEACHER')}
                                >
                                    <p className="text-sm font-semibold">Subject Teacher</p>
                                    <p className="text-[11px] text-muted-foreground leading-tight">
                                        Teaches this subject in this {labels.l3.toLowerCase()}.
                                    </p>
                                </button>
                                <button
                                    className="flex flex-col items-start gap-1.5 p-3.5 rounded-xl border-2 border-border/50 hover:border-primary hover:bg-primary/5 transition-all text-left"
                                    onClick={() => handleRoleSelect('CLASS_TEACHER')}
                                >
                                    <p className="text-sm font-semibold">Class Teacher</p>
                                    <p className="text-[11px] text-muted-foreground leading-tight">
                                        Primary teacher of this {labels.l3.toLowerCase()}. One per class.
                                    </p>
                                </button>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1"
                                onClick={() => {
                                    setWarning(null);
                                    setStep('pick-l3');
                                }}
                            >
                                ← Back
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
