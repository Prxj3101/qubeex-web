'use client';

import { AcademicYearProvider } from '@/context/AcademicYearContext';
import { AcademicYearSelector } from '@/components/shared/AcademicYearSelector';
import { HistoricalYearBanner } from '@/components/shared/HistoricalYearBanner';

// Scoped to the report card only — a student's own historical results.
export default function ReportCardLayout({ children }: { children: React.ReactNode }) {
    return (
        <AcademicYearProvider>
            <div className="flex items-center justify-end px-1 pt-1">
                <AcademicYearSelector />
            </div>
            <HistoricalYearBanner />
            {children}
        </AcademicYearProvider>
    );
}
