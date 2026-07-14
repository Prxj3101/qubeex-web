'use client';

import { useState } from 'react';
import type { InstitutionType, StructureLevel1, StructureLevel2, StructureLevel3 } from '@/types';
import { getInstitutionAccent, getStructureLabels } from '@/lib/getInstitutionAccent';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Plus, Pencil, Trash2, Users, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StructureTreeProps {
    levels: StructureLevel1[];
    institutionType: InstitutionType;
    onAddLevel2: (parentId: string) => void;
    onAddLevel3: (parentId: string) => void;
    onEditLevel1: (item: StructureLevel1) => void;
    onEditLevel2: (item: StructureLevel2) => void;
    onEditLevel3: (item: StructureLevel3) => void;
    onDeleteLevel1: (item: StructureLevel1) => void;
    onDeleteLevel2: (item: StructureLevel2) => void;
    onDeleteLevel3: (item: StructureLevel3) => void;
}

function Level3Row({
    item,
    accent,
    labels,
    onEdit,
    onDelete,
}: {
    item: StructureLevel3;
    accent: ReturnType<typeof getInstitutionAccent>;
    labels: ReturnType<typeof getStructureLabels>;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-2.5 px-3 sm:px-4 ml-4 sm:ml-10 border-l-2 border-border/40 hover:bg-muted/30 transition-colors rounded-r-lg group">
            <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: `${accent.bg}12` }}
            >
                <span className="text-[10px] font-semibold" style={{ color: accent.bg }}>
                    {labels.l3[0]}
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                {item.code && (
                    <span className="text-[10px] text-muted-foreground font-mono">{item.code}</span>
                )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <GraduationCap size={12} />
                    {item.studentCount}
                </span>
                <span className="flex items-center gap-1">
                    <Users size={12} />
                    {item.teacherCount}
                </span>
                {item.capacity && (
                    <span className="text-[10px] text-muted-foreground/60">
                        / {item.capacity} cap
                    </span>
                )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
                    <Pencil size={12} className="text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
                    <Trash2 size={12} className="text-red-500" />
                </Button>
            </div>
        </div>
    );
}

function Level2Row({
    item,
    accent,
    labels,
    onEdit,
    onDelete,
    onAddChild,
    onEditLevel3,
    onDeleteLevel3,
}: {
    item: StructureLevel2;
    accent: ReturnType<typeof getInstitutionAccent>;
    labels: ReturnType<typeof getStructureLabels>;
    onEdit: () => void;
    onDelete: () => void;
    onAddChild: () => void;
    onEditLevel3: (item: StructureLevel3) => void;
    onDeleteLevel3: (item: StructureLevel3) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const childCount = item.children.length;

    return (
        <div className="ml-2 sm:ml-5">
            <div
                className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-2.5 px-3 hover:bg-muted/30 transition-colors rounded-lg cursor-pointer group"
                onClick={() => setExpanded((v) => !v)}
            >
                <motion.div
                    animate={{ rotate: expanded ? 90 : 0 }}
                    transition={{ duration: 0.15 }}
                    className="shrink-0"
                >
                    <ChevronRight size={14} className="text-muted-foreground" />
                </motion.div>
                <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: `${accent.bg}18` }}
                >
                    <span className="text-[10px] font-bold" style={{ color: accent.bg }}>
                        {labels.l2[0]}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {childCount} {childCount === 1 ? labels.l3 : labels.l3Plural}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddChild} title={`Add ${labels.l3}`}>
                        <Plus size={12} className="text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
                        <Pencil size={12} className="text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
                        <Trash2 size={12} className="text-red-500" />
                    </Button>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {item.children.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-3 pl-16">
                                No {labels.l3Plural.toLowerCase()} yet.{' '}
                                <button
                                    className="text-primary hover:underline"
                                    onClick={(e) => { e.stopPropagation(); onAddChild(); }}
                                >
                                    Add one
                                </button>
                            </p>
                        ) : (
                            item.children.map((l3) => (
                                <Level3Row
                                    key={l3.id}
                                    item={l3}
                                    accent={accent}
                                    labels={labels}
                                    onEdit={() => onEditLevel3(l3)}
                                    onDelete={() => onDeleteLevel3(l3)}
                                />
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function StructureTree({
    levels,
    institutionType,
    onAddLevel2,
    onAddLevel3,
    onEditLevel1,
    onEditLevel2,
    onEditLevel3,
    onDeleteLevel1,
    onDeleteLevel2,
    onDeleteLevel3,
}: StructureTreeProps) {
    const accent = getInstitutionAccent(institutionType);
    const labels = getStructureLabels(institutionType);
    const [expandedL1, setExpandedL1] = useState<Record<string, boolean>>({});

    const toggleL1 = (id: string) =>
        setExpandedL1((prev) => ({ ...prev, [id]: !prev[id] }));

    if (levels.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <span className="text-2xl">{accent.emoji}</span>
                </div>
                <p className="text-sm font-medium mb-1">No {labels.l1Plural.toLowerCase()} defined</p>
                <p className="text-xs text-muted-foreground">
                    Start building your institution&apos;s structure by adding a {labels.l1.toLowerCase()}.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {levels.map((l1) => {
                const isExpanded = expandedL1[l1.id] ?? false;
                const l2Count = l1.children.length;

                return (
                    <div
                        key={l1.id}
                        className="bg-card border border-border/50 rounded-xl overflow-hidden"
                    >
                        {/* Level 1 header */}
                        <div
                            className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors group"
                            onClick={() => toggleL1(l1.id)}
                        >
                            <motion.div
                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                transition={{ duration: 0.15 }}
                                className="shrink-0"
                            >
                                <ChevronRight size={16} className="text-muted-foreground" />
                            </motion.div>
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: `${accent.bg}20` }}
                            >
                                <span className="text-xs font-bold" style={{ color: accent.bg }}>
                                    {l1.code ?? l1.name.slice(0, 2)}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{l1.name}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">
                                {l2Count} {l2Count === 1 ? labels.l2 : labels.l2Plural}
                            </span>
                            <div
                                className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => onAddLevel2(l1.id)}
                                    title={`Add ${labels.l2}`}
                                >
                                    <Plus size={14} className="text-muted-foreground" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => onEditLevel1(l1)}
                                >
                                    <Pencil size={14} className="text-muted-foreground" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => onDeleteLevel1(l1)}
                                >
                                    <Trash2 size={14} className="text-red-500" />
                                </Button>
                            </div>
                        </div>

                        {/* Level 2 children */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden border-t border-border/30"
                                >
                                    {l1.children.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-4 pl-14">
                                            No {labels.l2Plural.toLowerCase()} yet.{' '}
                                            <button
                                                className="text-primary hover:underline"
                                                onClick={() => onAddLevel2(l1.id)}
                                            >
                                                Add one
                                            </button>
                                        </p>
                                    ) : (
                                        <div className="py-1">
                                            {l1.children.map((l2) => (
                                                <Level2Row
                                                    key={l2.id}
                                                    item={l2}
                                                    accent={accent}
                                                    labels={labels}
                                                    onEdit={() => onEditLevel2(l2)}
                                                    onDelete={() => onDeleteLevel2(l2)}
                                                    onAddChild={() => onAddLevel3(l2.id)}
                                                    onEditLevel3={onEditLevel3}
                                                    onDeleteLevel3={onDeleteLevel3}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}
