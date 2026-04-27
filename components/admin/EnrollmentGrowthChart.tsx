'use client';

import {
    ComposedChart, Bar, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
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
                        <span className="w-6 h-0.5 bg-amber-400 inline-block rounded-full" />
                        Teachers
                    </span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                    <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                            color: 'hsl(var(--foreground))',
                        }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                    />
                    <Bar
                        dataKey="students"
                        fill={accent.bg}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={28}
                        opacity={0.9}
                    />
                    <Line
                        type="monotone"
                        dataKey="teachers"
                        stroke="#F59E0B"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#F59E0B', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#F59E0B', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}