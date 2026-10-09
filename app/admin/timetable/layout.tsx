'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { AcademicYearProvider, useAcademicYear } from '@/context/AcademicYearContext';
import { AcademicYearSelector } from '@/components/shared/AcademicYearSelector';

const TABS = [
    { href: '/admin/timetable', label: 'Studio', exact: true },
    { href: '/admin/timetable/setup', label: 'Setup' },
    { href: '/admin/timetable/resources', label: 'Rooms & Teachers' },
    { href: '/admin/timetable/views', label: 'Views & Reports' },
    { href: '/admin/timetable/changes', label: 'Substitutions & Changes' },
];

function Inner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { years, selectedYearId, isCurrentYearSelected } = useAcademicYear();
    const selected = years.find(y => y.id === selectedYearId);
    return (
        <div className="max-w-[1500px] mx-auto px-2 sm:px-4 pb-10">
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                    <Link href="/admin/campus/classes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft className="w-3 h-3" /> Back to classes</Link>
                    <h1 className="text-xl font-bold text-foreground">Timetable Settings &amp; Studio</h1>
                    <p className="text-xs text-muted-foreground">Periods, rooms, availability, reports and substitutions. Edit a single class from its class page.</p>
                </div>
                <AcademicYearSelector />
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-border/60 mb-4">
                {TABS.map(t => {
                    const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
                    return (
                        <Link
                            key={t.href}
                            href={t.href}
                            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${active ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </div>
            {!isCurrentYearSelected && selected && (
                <div className="mb-4 px-3 py-2 text-sm rounded-lg bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900">
                    Showing the {selected.label} timetable (historical, read-only).
                </div>
            )}
            {children}
        </div>
    );
}

export default function TimetableLayout({ children }: { children: React.ReactNode }) {
    return (
        <AcademicYearProvider>
            <Inner>{children}</Inner>
        </AcademicYearProvider>
    );
}
