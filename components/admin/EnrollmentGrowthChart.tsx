'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { AdminOverview, InstitutionType } from '@/types';
import { getInstitutionAccent } from '@/lib/getInstitutionAccent';

interface EnrollmentGrowthChartProps {
    data: AdminOverview['enrollmentGrowth'];
    institutionType: InstitutionType;
}

export function EnrollmentGrowthChart({ data, institutionType }: EnrollmentGrowthChartProps) {
    const accent = getInstitutionAccent(institutionType);

    return (
        <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Enrollment growth</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: accent.bg }} />
                        Students
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-border inline-block" />
                        Teachers
                    </span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} barGap={4}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                        cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
                    />
                    <Bar dataKey="students" fill={accent.bg} radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="teachers" fill="hsl(var(--border))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
