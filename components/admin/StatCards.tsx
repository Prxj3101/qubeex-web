'use client';

import { Users, GraduationCap, BookOpen, Layers } from 'lucide-react';
import type { AdminOverview, InstitutionType } from '@/types';
import { getFourthStatLabel } from '@/lib/getInstitutionAccent';

interface StatCardsProps {
    stats: AdminOverview['stats'];
    institutionType: InstitutionType;
    plan: AdminOverview['plan'];
}

export function StatCards({ stats, institutionType, plan }: StatCardsProps) {
    const activeTeachers = 0;
    const inactiveTeachers = 0;

    const items = [
        {
            label: 'Total Users',
            value: stats.totalUsers.toLocaleString('en-IN'),
            sub: '∞ limit',
            icon: Users,
            iconBg: 'bg-violet-100 dark:bg-violet-950',
            iconColor: 'text-violet-600 dark:text-violet-400',
        },
        {
            label: 'Students',
            value: stats.totalStudents.toLocaleString('en-IN'),
            sub: 'Enrolled students',
            icon: GraduationCap,
            iconBg: 'bg-emerald-100 dark:bg-emerald-950',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            label: 'Teachers',
            value: stats.totalTeachers.toLocaleString('en-IN'),
            sub: `${activeTeachers} active · ${inactiveTeachers} inactive`,
            icon: BookOpen,
            iconBg: 'bg-amber-100 dark:bg-amber-950',
            iconColor: 'text-amber-600 dark:text-amber-400',
        },
        {
            label: getFourthStatLabel(institutionType),
            value: stats.totalClasses.toLocaleString('en-IN'),
            sub: 'Configured in campus',
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
                    <div key={s.label} className="bg-white dark:bg-muted/50 rounded-xl p-4 relative shadow-sm border border-border/50" data-admin-surface="">
                        <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                            <Icon size={15} className={s.iconColor} />
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                        <p className="text-3xl font-semibold tracking-tight">{s.value}</p>
                        {s.sub && <p className="text-[11px] text-muted-foreground mt-1">{s.sub}</p>}
                    </div>
                );
            })}
        </div>
    );
}
