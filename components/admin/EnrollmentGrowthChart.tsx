'use client';

import { TrendingUp } from 'lucide-react';

import {
    ComposedChart, Bar, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import type { AdminOverview, InstitutionType } from '@/types';
import { useThemeAccent } from '@/hooks/useThemeAccent';

interface EnrollmentGrowthChartProps {
    data: AdminOverview['enrollmentGrowth'];
    institutionType: InstitutionType;
}

export function EnrollmentGrowthChart({ data }: EnrollmentGrowthChartProps) {
    // Students bar follows whatever accent color the admin picked in Settings
    // (was previously hardcoded per institution type, so it never matched a
    // custom theme pick).
    const accentColor = useThemeAccent('--primary');

    return (
        <div className="bg-card border border-border/50 rounded-xl p-4 lg:p-5 h-full w-full overflow-hidden flex flex-col" data-admin-surface="">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 shrink-0">
                <div className="flex items-center gap-2">
                    <TrendingUp size={15} className="text-muted-foreground" />
                    <p className="text-sm font-medium">Enrollment growth</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: accentColor }} />
                        Students
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-6 h-0.5 bg-amber-400 inline-block rounded-full" />
                        Teachers
                    </span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height="100%" className="flex-1 min-h-0">
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
                        fill={accentColor}
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