'use client';

import { useState, useEffect } from 'react';
import { Building2, Mail, Users, GraduationCap, ArrowUpRight, ArrowDownRight, BookOpen, TrendingUp, Calendar, Badge as BadgeIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Institution } from '@/types';
import api from '@/lib/api';
import { toast } from 'sonner';

const STATS = [
    {
        label: 'Total Students',
        value: '324',
        sub: '+12 this week',
        trend: 'up',
        icon: Users,
        iconBg: 'bg-emerald-100 dark:bg-emerald-950',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
        label: 'Total Teachers',
        value: '12',
        sub: '+2 this month',
        trend: 'up',
        icon: GraduationCap,
        iconBg: 'bg-violet-100 dark:bg-violet-950',
        iconColor: 'text-violet-600 dark:text-violet-400',
    },
    {
        label: 'Tests Conducted',
        value: '89',
        sub: '+5 today',
        trend: 'up',
        icon: BookOpen,
        iconBg: 'bg-amber-100 dark:bg-amber-950',
        iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
        label: 'Avg Performance',
        value: '78%',
        sub: '+3%',
        trend: 'up',
        icon: TrendingUp,
        iconBg: 'bg-sky-100 dark:bg-sky-950',
        iconColor: 'text-sky-600 dark:text-sky-400',
    },
];

const now = new Date();
const hour = now.getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });


export default function AdminOverview() {
    const [institution, setInstitution] = useState<Institution | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get('/admin/me');
                setInstitution(res.data.data);
            } catch {
                toast.error('Failed to fetch institution data');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    if (loading) return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="-mx-4 relative overflow-hidden rounded-b-[65px] bg-[#7C3AED] dark:bg-[#4C1D95] px-13 py-10 flex items-center justify-between">
                {/* Orbs */}
                <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
                <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />

                {/* Twinkling stars */}
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-27 left-36 animate-pulse delay-300" />
                <div className="absolute w-1 h-1 rounded-full bg-white/70 top-22 left-5 animate-pulse delay-600" />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-4 left-52 animate-pulse delay-700" />

                {/* Left — Greeting */}
                <div className="space-y-1 z-10">
                    <p className="text-white/70 text-base">{greeting}👋, Admin of</p>
                    <p className="text-white text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                        {institution?.name ?? 'Viva Institute of Technology'}
                    </p>
                    <p className="text-white/60 text-sm">Here's what's happening across your institution today.</p>
                    <p className="text-white/50 text-xs mt-2">{dateStr}</p>
                </div>

                {/* Right — Abstract SVG illustration */}
                <div className="z-10 opacity-90">
                    <svg width="140" height="120" viewBox="0 0 140 120" fill="none">
                        {/* Dashboard mockup */}
                        <rect x="10" y="20" width="120" height="85" rx="10" fill="white" fillOpacity="0.12" />
                        <rect x="18" y="28" width="50" height="30" rx="6" fill="white" fillOpacity="0.15" />
                        <rect x="76" y="28" width="46" height="30" rx="6" fill="white" fillOpacity="0.15" />
                        <rect x="18" y="64" width="104" height="6" rx="3" fill="white" fillOpacity="0.1" />
                        <rect x="18" y="74" width="80" height="6" rx="3" fill="white" fillOpacity="0.1" />
                        <rect x="18" y="84" width="60" height="6" rx="3" fill="white" fillOpacity="0.1" />
                        {/* Bar chart inside left card */}
                        <rect x="24" y="46" width="6" height="8" rx="2" fill="white" fillOpacity="0.5" />
                        <rect x="33" y="40" width="6" height="14" rx="2" fill="white" fillOpacity="0.5" />
                        <rect x="42" y="44" width="6" height="10" rx="2" fill="white" fillOpacity="0.5" />
                        <rect x="51" y="36" width="6" height="18" rx="2" fill="white" fillOpacity="0.7" />
                        {/* Right card — circle stat */}
                        <circle cx="99" cy="43" r="10" stroke="white" strokeOpacity="0.3" strokeWidth="3" />
                        <circle cx="99" cy="43" r="10" stroke="white" strokeOpacity="0.8" strokeWidth="3"
                            strokeDasharray="40 23" strokeLinecap="round" />
                        <text x="99" y="47" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">82%</text>
                        {/* Floating badges */}
                        <rect x="85" y="8" width="42" height="16" rx="8" fill="white" fillOpacity="0.2" />
                        <text x="106" y="20" textAnchor="middle" fill="white" fontSize="7">48 Inst.</text>
                        <rect x="5" y="90" width="36" height="16" rx="8" fill="white" fillOpacity="0.2" />
                        <text x="23" y="102" textAnchor="middle" fill="white" fontSize="7">↑ 12%</text>
                    </svg>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {STATS.map((s) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="bg-muted/50 rounded-xl p-4 relative">
                            <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                                <Icon size={15} className={s.iconColor} />
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                            <p className="text-3xl font-semibold tracking-tight">{s.value}</p>
                            <div className="flex items-center gap-1 mt-1.5">
                                {s.trend === 'up'
                                    ? <ArrowUpRight size={13} className="text-emerald-600 dark:text-emerald-400" />
                                    : <ArrowDownRight size={13} className="text-red-500" />
                                }
                                <span className={`text-xs ${s.trend === 'up'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-500'
                                    }`}>
                                    {s.sub}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>


            {institution && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm text-muted-foreground">Institution Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Building2 size={14} className="text-muted-foreground" />
                                <span className="text-sm font-medium">{institution.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail size={14} className="text-muted-foreground" />
                                <span className="text-sm">{institution.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-muted-foreground" />
                                <span className="text-sm">{new Date(institution.createdAt).toLocaleDateString('en-IN')}</span>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="outline">{institution.type}</Badge>
                                <Badge variant={institution.status === 'ACTIVE' ? 'default' : 'destructive'}>
                                    {institution.status}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}