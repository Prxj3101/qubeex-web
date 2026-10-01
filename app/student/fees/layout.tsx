'use client';

import { AcademicYearProvider } from '@/context/AcademicYearContext';
import { AcademicYearSelector } from '@/components/shared/AcademicYearSelector';
import { HistoricalYearBanner } from '@/components/shared/HistoricalYearBanner';

// Scoped to Fees only — a student's own fee structure for a given year
// (payment status itself is always live; see backend scope-cut comment).
export default function FeesLayout({ children }: { children: React.ReactNode }) {
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
