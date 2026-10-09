'use client';

import { AcademicYearProvider } from '@/context/AcademicYearContext';
import { AcademicYearSelector } from '@/components/shared/AcademicYearSelector';

export default function TimetableLayout({ children }: { children: React.ReactNode }) {
    return (
        <AcademicYearProvider>
            <div className="max-w-5xl mx-auto px-2 sm:px-4 pb-10">
                <div className="flex items-center justify-end py-2"><AcademicYearSelector /></div>
                {children}
            </div>
        </AcademicYearProvider>
    );
}
