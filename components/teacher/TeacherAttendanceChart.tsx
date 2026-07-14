'use client';

import { CalendarDays } from 'lucide-react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface AttendanceDataPoint {
    month: string;
    attendance: number;
    students: number;
}

interface TeacherAttendanceChartProps {
    data: AttendanceDataPoint[];
}

const MOCK_DATA: AttendanceDataPoint[] = [
    { month: 'Jun', attendance: 92, students: 210 },
    { month: 'Jul', attendance: 88, students: 208 },
    { month: 'Aug', attendance: 85, students: 212 },
    { month: 'Sep', attendance: 90, students: 210 },
    { month: 'Oct', attendance: 87, students: 209 },
    { month: 'Nov', attendance: 91, students: 211 },
    { month: 'Dec', attendance: 86, students: 210 },
    { month: 'Jan', attendance: 89, students: 213 },
    { month: 'Feb', attendance: 84, students: 211 },
    { month: 'Mar', attendance: 93, students: 212 },
    { month: 'Apr', attendance: 88, students: 210 },
    { month: 'May', attendance: 91, students: 211 },
];

export function TeacherAttendanceChart({ data = MOCK_DATA }: Partial<TeacherAttendanceChartProps>) {
    return (
        <div className="bg-card border border-border/50 rounded-xl p-4 h-full">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <CalendarDays size={15} className="text-muted-foreground" />
                    <p className="text-sm font-medium">Class Attendance Trend</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#7C3AED' }} />
                        Attendance %
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-6 h-0.5 bg-[#F59E0B] inline-block rounded-full" />
                        Students
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
                        formatter={(value: any, name: any) => [
                            name === 'attendance' ? `${value}%` : value,
                            name === 'attendance' ? 'Attendance' : 'Students'
                        ]}
                    />
                    <Bar
                        dataKey="attendance"
                        fill="#7C3AED"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={28}
                        opacity={0.9}
                    />
                    <Line
                        type="monotone"
                        dataKey="students"
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