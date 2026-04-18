'use client';

import type { InstitutionType } from '@/types';
import { getInstitutionAccent, getStructureLabels } from '@/lib/getInstitutionAccent';
import { Plus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StructureHeaderProps {
    institutionType: InstitutionType;
    l1Count: number;
    l2Count: number;
    l3Count: number;
    onAddLevel1: () => void;
}

export function StructureHeader({
    institutionType,
    l1Count,
    l2Count,
    l3Count,
    onAddLevel1,
}: StructureHeaderProps) {
    const accent = getInstitutionAccent(institutionType);
    const labels = getStructureLabels(institutionType);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${accent.bg}18` }}
                >
                    <Layers size={18} style={{ color: accent.bg }} />
                </div>
                <div>
                    <h1
                        className="text-xl font-semibold"
                        style={{ fontFamily: 'var(--font-poppins)' }}
                    >
                        {labels.l1Plural} & {labels.l3Plural}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {l1Count} {l1Count === 1 ? labels.l1 : labels.l1Plural}
                        {' · '}
                        {l2Count} {l2Count === 1 ? labels.l2 : labels.l2Plural}
                        {' · '}
                        {l3Count} {l3Count === 1 ? labels.l3 : labels.l3Plural}
                    </p>
                </div>
            </div>
            <Button
                size="sm"
                onClick={onAddLevel1}
                className="flex items-center gap-1.5 self-start"
                id="add-level1-btn"
            >
                <Plus size={14} />
                Add {labels.l1}
            </Button>
        </div>
    );
}
