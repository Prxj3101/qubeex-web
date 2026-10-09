'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';

export interface AcademicYearSummary {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    status: 'ACTIVE' | 'CLOSED';
    isCurrent: boolean;
}

type AcademicYearContextType = {
    years: AcademicYearSummary[];
    selectedYearId: string | null;
    isCurrentYearSelected: boolean;
    setSelectedYearId: (id: string) => void;
    loading: boolean;
};

const AcademicYearContext = createContext<AcademicYearContextType>({
    years: [],
    selectedYearId: null,
    isCurrentYearSelected: true,
    setSelectedYearId: () => {},
    loading: false,
});

export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
    const [years, setYears] = useState<AcademicYearSummary[]>([]);
    const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        api.get('/academic-years')
            .then((res) => {
                if (cancelled) return;
                const fetched: AcademicYearSummary[] = res.data?.data ?? [];
                setYears(fetched);
                const current = fetched.find((y) => y.isCurrent);
                setSelectedYearId(current?.id ?? fetched[0]?.id ?? null);
            })
            .catch(() => {
                // Fail open: no years loaded, selector renders disabled/empty,
                // rest of the admin app is unaffected.
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const currentYear = years.find((y) => y.isCurrent);
    const isCurrentYearSelected = !selectedYearId || selectedYearId === currentYear?.id;

    return (
        <AcademicYearContext.Provider
            value={{ years, selectedYearId, isCurrentYearSelected, setSelectedYearId, loading }}
        >
            {children}
        </AcademicYearContext.Provider>
    );
}

export function useAcademicYear(): AcademicYearContextType {
    return useContext(AcademicYearContext);
}

export function useIsHistoricalYear(): boolean {
    return !useAcademicYear().isCurrentYearSelected;
}

// Query params to spread into an API call: empty for the current year (the
// backend defaults to it), `{ academicYearId }` when a past year is selected.
export function useYearParams(): { academicYearId?: string } {
    const { selectedYearId, isCurrentYearSelected } = useAcademicYear();
    return isCurrentYearSelected || !selectedYearId ? {} : { academicYearId: selectedYearId };
}
