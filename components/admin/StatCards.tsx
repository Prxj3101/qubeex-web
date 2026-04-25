'use client';

import { Users, GraduationCap, BookOpen, Layers } from 'lucide-react';
import type { AdminOverview, InstitutionType } from '@/types';
import { getFourthStatLabel } from '@/lib/getInstitutionAccent';

interface StatCardsProps {
    stats: AdminOverview['stats'];
    institutionType: InstitutionType;
}

export function StatCards({ stats, institutionType }: StatCardsProps) {
    const items = [
        {
            label: 'Total users',
            value: stats.totalUsers.toLocaleString('en-IN'),
            icon: Users,
            iconBg: 'bg-violet-100 dark:bg-violet-950',
            iconColor: 'text-violet-600 dark:text-violet-400',
        },
        {
            label: 'Students',
            value: stats.totalStudents.toLocaleString('en-IN'),
            icon: GraduationCap,
            iconBg: 'bg-emerald-100 dark:bg-emerald-950',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            label: 'Teachers',
            value: stats.totalTeachers.toLocaleString('en-IN'),
            icon: BookOpen,
            iconBg: 'bg-amber-100 dark:bg-amber-950',
            iconColor: 'text-amber-600 dark:text-amber-400',
        },
        {
            label: getFourthStatLabel(institutionType),
            value: stats.totalClasses.toLocaleString('en-IN'),
            icon: Layers,
            iconBg: 'bg-sky-100 dark:bg-sky-950',
            iconColor: 'text-sky-600 dark:text-sky-400',
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {items.map((s) => {
                const Icon = s.icon;
                return (
                    <div key={s.label} className="bg-white dark:bg-muted/50 rounded-xl p-4 relative shadow-sm border border-border/50">
                        <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                            <Icon size={15} className={s.iconColor} />
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                        <p className="text-3xl font-semibold tracking-tight">{s.value}</p>
                    </div>
                );
            })}
        </div>
    );
}
